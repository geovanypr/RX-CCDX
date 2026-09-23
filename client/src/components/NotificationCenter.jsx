import React, { useContext, useEffect, useRef, useState } from 'react';
import Icon from './Icons';
import { NotificationContext } from '../context/NotificationContext';

const TIPO_COLOR = {
  success: '#15803d',
  error: '#b91c1c',
  warning: '#b45309',
  nuevo: '#1d4ed8',
  enviado: '#c2410c',
  diagnostico: '#15803d',
  devuelto: '#be123c',
  mensaje: '#0f766e',
  archivo: '#4338ca',
  default: '#475569',
};

const formatHoraNotificacion = (timestamp) => {
  try {
    return new Date(timestamp).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

/**
 * Historial de avisos de la sesión (los toast desaparecen a los 8 s, este panel los conserva).
 */
const NotificationCenter = ({ variant = 'light' }) => {
  const { notifications, clearNotifications, notificationsEnabled, toggleNotifications } = useContext(NotificationContext);
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef(null);
  const oscuro = variant === 'dark';

  useEffect(() => {
    const alClicFuera = (evento) => {
      if (!contenedorRef.current?.contains(evento.target)) setAbierto(false);
    };
    const alTecla = (evento) => { if (evento.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', alClicFuera);
    document.addEventListener('keydown', alTecla);
    return () => {
      document.removeEventListener('mousedown', alClicFuera);
      document.removeEventListener('keydown', alTecla);
    };
  }, []);

  const sinLeer = notifications.length;

  return (
    <div ref={contenedorRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setAbierto(v => !v)}
        title="Centro de notificaciones"
        aria-label="Centro de notificaciones"
        className={oscuro ? 'btn btn-sm' : 'btn btn-ghost btn-sm'}
        style={{
          gap: 6,
          background: oscuro ? 'rgba(255,255,255,0.14)' : undefined,
          color: oscuro ? '#fff' : undefined,
          position: 'relative',
          opacity: notificationsEnabled ? 1 : 0.6,
        }}
      >
        <Icon name={notificationsEnabled ? 'bell' : 'x'} size={14} color={oscuro ? '#fff' : 'currentColor'} />
        {!oscuro && 'Avisos'}
        {notificationsEnabled && sinLeer > 0 && (
          <span style={{
            background: '#ef4444', color: '#fff', borderRadius: 999, padding: '1px 7px',
            fontSize: 10, fontWeight: 800, minWidth: 18, textAlign: 'center',
          }}>
            {sinLeer}
          </span>
        )}
      </button>

      {abierto && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 8, zIndex: 9999,
          width: 'min(360px, 86vw)', background: '#fff', borderRadius: 14,
          border: '1px solid var(--color-border)', boxShadow: '0 20px 50px -16px rgba(15,23,42,0.35)',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px',
            borderBottom: '1px solid var(--color-border)', background: 'linear-gradient(135deg,#f8fafc,#eff6ff)',
          }}>
            <Icon name="bell" size={15} color="var(--color-primary)" />
            <strong style={{ fontSize: 13, color: 'var(--color-text)', flex: 1 }}>Avisos de la sesión</strong>
            
            <button
              className="btn btn-ghost btn-xs"
              onClick={toggleNotifications}
              style={{ gap: 4, color: notificationsEnabled ? '#ef4444' : '#10b981' }}
              title={notificationsEnabled ? "Silenciar y ocultar notificaciones" : "Activar notificaciones"}
            >
              <Icon name={notificationsEnabled ? 'x' : 'check'} size={11} /> {notificationsEnabled ? 'Silenciar' : 'Activar'}
            </button>

            {notifications.length > 0 && notificationsEnabled && (
              <button className="btn btn-ghost btn-xs" onClick={clearNotifications} style={{ gap: 4 }}>
                <Icon name="trash" size={11} /> Limpiar
              </button>
            )}
          </div>

          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '28px 18px', textAlign: 'center' }}>
                <Icon name="bell" size={30} color="#cbd5e1" />
                <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 8 }}>
                  Sin avisos por ahora. Aquí verás las placas recibidas, diagnósticos y mensajes.
                </p>
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id} style={{ display: 'flex', gap: 10, padding: '11px 14px', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: TIPO_COLOR[n.type] || TIPO_COLOR.default, marginTop: 5, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text)' }}>{n.title}</p>
                    <p style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', marginTop: 2, lineHeight: 1.45 }}>{n.message}</p>
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{formatHoraNotificacion(n.timestamp)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
