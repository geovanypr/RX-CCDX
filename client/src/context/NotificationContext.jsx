import React, { createContext, useState, useEffect, useCallback, useRef, useContext } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../config';
import { AuthContext } from './AuthContext';
import { playNotificationSound, enableSound } from '../utils/notificationSound';
import NotificationToast from '../components/NotificationToast';

export const NotificationContext = createContext();


export const NotificationProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('rx_ccdx_notifications_enabled') !== 'false';
  });
  const [pendingRadiologo, setPendingRadiologo] = useState(0);
  const [pendingEncargado, setPendingEncargado] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const socketRef = useRef(null);
  const listenersRef = useRef({});

  const addNotification = useCallback((title, message, type = 'default') => {
    if (localStorage.getItem('rx_ccdx_notifications_enabled') === 'false') return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    // El toast se oculta a los 8 s; el aviso queda en el centro de notificaciones.
    setNotifications(prev => [
      { id, title, message, type, timestamp: Date.now(), visible: true, read: false },
      ...prev,
    ].slice(0, 30));
    playNotificationSound(type);
    setTimeout(() => {
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, visible: false } : n)));
    }, 8000);
  }, []);

  const toggleNotifications = useCallback(() => {
    setNotificationsEnabled(prev => {
      const next = !prev;
      localStorage.setItem('rx_ccdx_notifications_enabled', String(next));
      if (!next) setNotifications([]);
      return next;
    });
  }, []);

  const dismissNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearNotifications = useCallback(() => setNotifications([]), []);

  // Marcar todas las notificaciones como leídas
  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  // Varios componentes pueden escuchar el mismo evento del servidor a la vez.
  const on = useCallback((event, callback) => {
    const actuales = listenersRef.current[event] || [];
    listenersRef.current[event] = [...actuales.filter(cb => cb !== callback), callback];
  }, []);

  // IMPORTANTE: siempre pasar la función específica para no eliminar otros suscriptores
  const off = useCallback((event, callback) => {
    if (!callback) {
      // Sin callback: solo elimina si no hay otros suscriptores registrados (compatibilidad legada)
      console.warn(`[RX CCDX] off('${event}') llamado sin callback — puede eliminar suscriptores de otros componentes`);
      delete listenersRef.current[event];
      return;
    }
    const restantes = (listenersRef.current[event] || []).filter(cb => cb !== callback);
    if (restantes.length) listenersRef.current[event] = restantes;
    else delete listenersRef.current[event];
  }, []);

  const notificarListeners = useCallback((event, data) => {
    for (const callback of listenersRef.current[event] || []) {
      try { callback(data); } catch (error) { console.error('[RX CCDX] Error al procesar', event, error); }
    }
  }, []);

  useEffect(() => {
    if (!user?.token) return;

    enableSound();

    const socket = io(API_URL, {
      auth: { token: user.token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('estudio:enviado', (data) => {
      setPendingRadiologo(prev => prev + 1);
      addNotification('Nueva placa recibida', `${data.tipo_estudio} — ${data.nombre} (${data.registro_id})`, 'enviado');
      notificarListeners('estudio:enviado', data);
    });

    socket.on('diagnostico:recibido', (data) => {
      setPendingEncargado(prev => prev + 1);
      addNotification('Diagnóstico recibido', `${data.nombre} — ${data.tipo_estudio} (${data.registro_id})`, 'diagnostico');
      notificarListeners('diagnostico:recibido', data);
    });

    socket.on('estudio:nuevo', (data) => {
      addNotification('Nueva placa registrada', `${data.tipo_estudio} — ${data.nombre} (${data.registro_id})`, 'nuevo');
      notificarListeners('estudio:nuevo', data);
    });

    socket.on('estudio:devuelto', (data) => {
      addNotification('Estudio devuelto para revisión', `${data.nombre} — ${data.tipo_estudio} (${data.registro_id})`, 'devuelto');
      notificarListeners('estudio:devuelto', data);
    });

    socket.on('mensaje:nuevo', (data) => {
      setUnreadMessages(prev => prev + 1);
      const extracto = String(data.contenido || '');
      // El sonido de mensaje suena siempre (independientemente de si las notificaciones toast están activas)
      playNotificationSound('mensaje');
      addNotification('💬 Nuevo mensaje', `${data.sender_username}: ${extracto.slice(0, 60)}${extracto.length > 60 ? '…' : ''}`, 'mensaje');
      notificarListeners('mensaje:nuevo', data);
    });

    socket.on('comunicacion:nuevo', (data) => {
      setUnreadMessages(prev => prev + 1);
      const preview = data.contenido || data.archivo_original || 'Archivo recibido';
      // El sonido de mensaje suena siempre
      playNotificationSound('mensaje');
      addNotification('💬 Nueva comunicación', `${data.sender_username}: ${preview.slice(0, 60)}${preview.length > 60 ? '…' : ''}`, 'mensaje');
      notificarListeners('comunicacion:nuevo', data);
    });

    socket.on('archivo:subido', (data) => {
      addNotification('Archivos adjuntados', `${data.files.length} archivo(s) en ${data.registro_id}`, 'archivo');
      notificarListeners('archivo:subido', data);
    });

    socket.on('connect_error', (err) => {
      console.warn('[RX CCDX] Error de conexión:', err.message);
    });

    // Reconectar: resincronizar contadores cuando el socket vuelve tras una desconexión
    socket.on('reconnect', () => {
      console.info('[RX CCDX] Socket reconectado — resincronizando contadores');
      fetchPendingCounts();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.token, addNotification, notificarListeners]);

  const fetchPendingCounts = useCallback(async () => {
    if (!user?.token) return;
    try {
      const headers = { Authorization: `Bearer ${user.token}` };
      const [enviados, diagnosticos] = await Promise.all([
        fetch(`${API_URL}/api/estudios?estado=${encodeURIComponent('Enviada al radiólogo')}`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/api/estudios?estado=${encodeURIComponent('Diagnóstico recibido')}`, { headers }).then(r => r.json()),
      ]);
      if (Array.isArray(enviados)) setPendingRadiologo(enviados.length);
      if (Array.isArray(diagnosticos)) setPendingEncargado(diagnosticos.length);
    } catch { /* silenciar */ }
  }, [user?.token]);

  useEffect(() => {
    fetchPendingCounts();
  }, [fetchPendingCounts]);

  return (
    <NotificationContext.Provider value={{
      addNotification,
      notifications,
      clearNotifications,
      markAllRead,
      pendingRadiologo,
      pendingEncargado,
      unreadMessages,
      setPendingRadiologo,
      setPendingEncargado,
      setUnreadMessages,
      fetchPendingCounts,
      on,
      off,
      notificarListeners,
      notificationsEnabled,
      toggleNotifications,
      // Permite que componentes emitan eventos directamente por el socket
      emitSocket: (event, data) => socketRef.current?.emit(event, data),
    }}>
      {children}
      {notificationsEnabled && <NotificationToast notifications={notifications.filter(n => n.visible !== false)} onDismiss={dismissNotification} />}
    </NotificationContext.Provider>
  );
};
