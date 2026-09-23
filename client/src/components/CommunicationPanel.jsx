import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { NotificationContext } from '../context/NotificationContext';
import Icon from './Icons';
import { API_URL, authenticatedFileUrl } from '../config';
import { formatHora } from '../utils/format';
import { insertarEmoji } from '../utils/emoji';
import EmojiPicker from './EmojiPicker';

/* ── Fondo de chat coordinado con la página ──────────────────────────── */
const CHAT_BG_LIGHT = 'var(--color-bg)';
const CHAT_BG_DARK  = 'var(--color-bg)';

/* ── Componente de palomitas de estado ──────────────────────────────────────── */
const MessageStatus = ({ leido, isMine }) => {
  if (!isMine) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 4 }}>
      <Icon
        name={leido ? 'checkDouble' : 'checkSent'}
        size={13}
        color={leido ? '#53bdeb' : 'rgba(255,255,255,0.55)'}
      />
    </span>
  );
};

/* ── Indicador "escribiendo…" ────────────────────────────────────────────────── */
const TypingIndicator = ({ name }) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, padding: '4px 0 6px 4px' }}>
    <div style={{
      padding: '8px 14px', borderRadius: '18px 18px 18px 4px',
      background: 'var(--color-surface)',
      boxShadow: '0 1px 2px rgba(0,0,0,0.13)',
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
        {name} está escribiendo
      </span>
      <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--color-text-muted)',
            animation: `typingDot 1.4s ${i * 0.2}s ease-in-out infinite`,
          }} />
        ))}
      </span>
    </div>
  </div>
);

const CommunicationPanel = ({ estudio, onClose, onFileUploaded }) => {
  const { user } = useContext(AuthContext);
  const { on, off, addNotification, emitSocket } = useContext(NotificationContext);

  const [tab, setTab] = useState('mensajes');
  const [mensajes, setMensajes] = useState([]);
  const [archivos, setArchivos] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sendingImages, setSendingImages] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [emojiAbierto, setEmojiAbierto] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [typingUser, setTypingUser] = useState(null); // { name, timestamp }
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  const fileInputRef = useRef(null);
  const msgEndRef = useRef(null);
  const msgInputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);
  const typingClearRef = useRef(null);

  const headers = { Authorization: `Bearer ${user.token}` };

  // Seguir el tema del documento
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const chatBg = isDark ? CHAT_BG_DARK : CHAT_BG_LIGHT;

  const loadMensajes = useCallback(() => {
    fetch(`${API_URL}/api/estudios/${estudio.id}/mensajes`, { headers })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setMensajes(d); })
      .catch(() => {});
  }, [estudio.id, user.token]);

  const loadArchivos = useCallback(() => {
    fetch(`${API_URL}/api/estudios/${estudio.id}/archivos`, { headers })
      .then(r => r.json())
      .then(d => Array.isArray(d) && setArchivos(d))
      .catch(() => {});
  }, [estudio.id, user.token]);

  // Marcar como leídos al abrir el panel
  const marcarLeidos = useCallback(() => {
    fetch(`${API_URL}/api/estudios/${estudio.id}/mensajes/leer`, {
      method: 'PUT', headers,
    }).catch(() => {});
  }, [estudio.id, user.token]);

  useEffect(() => {
    loadMensajes();
    loadArchivos();
  }, [estudio.id]);

  // Marcar leídos cuando el panel de mensajes está activo
  useEffect(() => {
    if (tab === 'mensajes') marcarLeidos();
  }, [tab, mensajes.length]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, typingUser]);

  // Eventos de socket
  useEffect(() => {
    const onMensaje = (data) => {
      if (data.estudio_id === estudio.id) { loadMensajes(); marcarLeidos(); }
    };
    const onLeidos = (data) => {
      if (data.estudio_id === estudio.id) {
        setMensajes(prev => prev.map(m =>
          m.sender_id === user.id ? { ...m, leido: 1 } : m
        ));
      }
    };
    const onArchivo = (data) => {
      if (data.estudio_id === estudio.id) {
        loadArchivos(); onFileUploaded?.();
        addNotification('📎 Archivos recibidos', `${data.sender_username} envió ${data.image_count || data.files?.length || 0} archivo(s).`, 'success');
      }
    };
    const onPlacas = (data) => {
      if (data.estudio_id === estudio.id) { loadArchivos(); addNotification('📥 Placas recibidas', `${data.sender_username || 'El otro profesional'} envió ${data.radiografias_count || 0} radiografía(s).`, 'success'); }
    };
    const onTypingStart = (data) => {
      if (data.estudio_id === estudio.id && data.canal === 'estudio') {
        setTypingUser({ name: data.sender_username });
        clearTimeout(typingClearRef.current);
        typingClearRef.current = setTimeout(() => setTypingUser(null), 4000);
      }
    };
    const onTypingStop = (data) => {
      if (data.estudio_id === estudio.id && data.canal === 'estudio') setTypingUser(null);
    };

    const onEdit = (data) => {
      if (data.estudio_id === estudio.id) {
        setMensajes(prev => prev.map(m => m.id === data.id ? { ...m, ...data } : m));
      }
    };
    const onEliminado = (data) => {
      if (data.estudio_id === estudio.id) {
        if (data.modo === 'todos' && data.mensaje) {
          setMensajes(prev => prev.map(m => m.id === data.id ? { ...m, ...data.mensaje } : m));
        } else {
          setMensajes(prev => prev.filter(m => m.id !== data.id));
        }
      }
    };

    on('mensaje:nuevo', onMensaje);
    on('mensaje:editado', onEdit);
    on('mensaje:eliminado', onEliminado);
    on('mensajes:leidos', onLeidos);
    on('archivo:subido', onArchivo);
    on('placas:enviadas', onPlacas);
    on('typing:start', onTypingStart);
    on('typing:stop', onTypingStop);

    return () => {
      off('mensaje:nuevo', onMensaje);
      off('mensaje:editado', onEdit);
      off('mensaje:eliminado', onEliminado);
      off('mensajes:leidos', onLeidos);
      off('archivo:subido', onArchivo);
      off('placas:enviadas', onPlacas);
      off('typing:start', onTypingStart);
      off('typing:stop', onTypingStop);
      clearTimeout(typingClearRef.current);
    };
  }, [on, off, estudio.id, loadMensajes, loadArchivos, marcarLeidos]);

  // Paste de imágenes desde portapapeles
  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imgs = [];
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) imgs.push(f);
      }
    }
    if (imgs.length > 0) doUpload(imgs);
  }, [estudio.id]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // ── Typing: emitir al servidor con debounce ──
  const handleTyping = (value) => {
    setNuevoMensaje(value);
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      emitSocket('typing:start', { estudio_id: estudio.id, canal: 'estudio' });
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      emitSocket('typing:stop', { estudio_id: estudio.id, canal: 'estudio' });
    }, 1500);
  };

  const handleSend = async () => {
    const texto = nuevoMensaje.trim();
    if (!texto) return;
    clearTimeout(typingTimerRef.current);
    isTypingRef.current = false;
    emitSocket('typing:stop', { estudio_id: estudio.id, canal: 'estudio' });
    setSending(true);
    try {
      if (editingMessage) {
        const res = await fetch(`${API_URL}/api/estudios/${estudio.id}/mensajes/${editingMessage.id}`, {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ contenido: texto }),
        });
        const data = await res.json();
        if (data.success) {
          setNuevoMensaje('');
          setEditingMessage(null);
          loadMensajes();
        } else {
          addNotification('Error al editar', data.error || 'No se pudo editar el mensaje', 'error');
        }
      } else {
        const res = await fetch(`${API_URL}/api/estudios/${estudio.id}/mensaje`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ contenido: texto }),
        });
        const data = await res.json();
        if (data.success) { setNuevoMensaje(''); loadMensajes(); }
      }
    } catch (e) {
      addNotification('Error', e.message, 'error');
    } finally { setSending(false); }
  };

  const handleEditClick = (m) => {
    setEditingMessage(m);
    setNuevoMensaje(m.contenido);
    setActiveMenuId(null);
    msgInputRef.current?.focus();
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setNuevoMensaje('');
  };

  const handleDeleteMessage = async (m, modo) => {
    try {
      const res = await fetch(`${API_URL}/api/estudios/${estudio.id}/mensajes/${m.id}?modo=${modo}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();
      if (data.success) {
        if (modo === 'mi') {
          setMensajes(prev => prev.filter(x => x.id !== m.id));
        } else {
          loadMensajes();
        }
        addNotification('Mensaje eliminado', modo === 'todos' ? 'Eliminado para todos' : 'Eliminado para ti', 'success');
      } else {
        addNotification('Error al eliminar', data.error, 'error');
      }
    } catch (e) {
      addNotification('Error', e.message, 'error');
    } finally {
      setConfirmDelete(null);
      setActiveMenuId(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const doUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const fd = new FormData();
    for (const f of files) fd.append('archivos', f);
    try {
      const res = await fetch(`${API_URL}/api/estudios/${estudio.id}/upload`, { method: 'POST', headers, body: fd });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || 'No se pudieron cargar los archivos');
      const imageCount = d.files?.filter(f => f.isImage).length || 0;
      const recipient = user.role === 'RADIOLOGO' ? 'encargado' : 'radiólogo';
      addNotification('Archivos cargados', imageCount ? `${imageCount} imagen(es) lista(s) para enviar al ${recipient}.` : 'Archivo agregado.', 'success');
      loadArchivos(); onFileUploaded?.(); setTab('archivos');
    } catch (error) {
      addNotification('No se pudieron cargar los archivos', error.message, 'error');
    } finally { setUploading(false); }
  };

  const handleFileInput = (e) => { doUpload(e.target.files); e.target.value = ''; };
  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); doUpload(e.dataTransfer.files); };

  const handleDelete = async (filename) => {
    await fetch(`${API_URL}/api/estudios/${estudio.id}/archivos/${encodeURIComponent(filename)}`, { method: 'DELETE', headers });
    loadArchivos();
  };

  const handleSendImages = async () => {
    setSendingImages(true);
    try {
      const res = await fetch(`${API_URL}/api/estudios/${estudio.id}/enviar-placas`, { method: 'POST', headers });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'No se pudieron enviar las placas');
      const recipient = user.role === 'RADIOLOGO' ? 'encargado' : 'radiólogo';
      addNotification('📤 Placas enviadas', `${data.count} radiografía(s) enviadas al ${recipient}.`, 'success');
    } catch (error) {
      addNotification('No se pudieron enviar las placas', error.message, 'error');
    } finally { setSendingImages(false); }
  };

  const isEncargado = user.role === 'ENCARGADO' || user.role === 'SUPER_ADMIN';
  const images = archivos.filter(f => f.isImage);

  // Agrupar mensajes por fecha para separadores de día
  const mensajesConFecha = mensajes.reduce((acc, m) => {
    const dia = m.created_at?.split(' ')[0] || m.created_at?.split('T')[0] || '';
    const last = acc[acc.length - 1];
    if (!last || last.dia !== dia) acc.push({ dia, msgs: [m] });
    else last.msgs.push(m);
    return acc;
  }, []);

  const hoyISO = new Date().toISOString().split('T')[0];
  const ayerISO = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const diaLabel = (d) => {
    if (d === hoyISO) return 'Hoy';
    if (d === ayerISO) return 'Ayer';
    return d;
  };

  return (
    <>
      {/* Keyframes para animación del indicador de escritura */}
      <style>{`
        @keyframes typingDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        .chat-bubble-mine { animation: popIn 0.15s ease; }
        .chat-bubble-other { animation: slideInLeft 0.15s ease; }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--color-surface)' }}>

        {/* ── Header coordinado con la página ── */}
        <div style={{
          padding: '12px 16px', flexShrink: 0,
          background: 'var(--color-primary)',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        }}>
          {/* Avatar */}
          <div style={{
            width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="user" size={20} color="#fff" />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {estudio.nombre}
            </p>
            <p style={{ margin: '1px 0 0', fontSize: 11.5, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {typingUser
                ? <span style={{ color: '#9de1d0' }}>✎ {typingUser.name} está escribiendo…</span>
                : `${estudio.registro_id} · ${estudio.tipo_estudio || 'Estudio'}`
              }
            </p>
          </div>

          {onClose && (
            <button onClick={onClose} style={{ border: 0, background: 'transparent', color: '#fff', cursor: 'pointer', padding: 4, display: 'flex', borderRadius: 6 }} aria-label="Cerrar panel">
              <Icon name="close" size={18} color="currentColor" />
            </button>
          )}
        </div>

        {/* ── Tabs ── */}
        <div style={{
          display: 'flex', flexShrink: 0,
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
        }}>
          {[
            { id: 'mensajes', icon: 'message', label: 'Mensajes', count: mensajes.filter(m => !m.leido && m.sender_id !== user.id).length },
            { id: 'archivos', icon: 'clip', label: 'Archivos', count: archivos.length },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: '10px 6px', border: 'none', cursor: 'pointer',
                background: 'transparent', fontFamily: 'inherit',
                fontSize: 12.5, fontWeight: tab === t.id ? 700 : 500,
                color: tab === t.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
                borderBottom: `2px solid ${tab === t.id ? 'var(--color-primary)' : 'transparent'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                transition: 'all 0.15s',
              }}
            >
              <Icon name={t.icon} size={13} color="currentColor" />
              {t.label}
              {t.count > 0 && (
                <span style={{ background: 'var(--color-primary)', color: '#fff', borderRadius: 9999, fontSize: 10, fontWeight: 700, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Mensajes ── */}
        {tab === 'mensajes' && (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--color-bg)' }}>
              {mensajes.length === 0 && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', gap: 10 }}>
                  <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="message" size={28} color="var(--color-text-muted)" />
                  </div>
                  <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--color-text)', margin: 0, fontWeight: 600 }}>Sin mensajes aún</p>
                  <p style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--color-text-muted)', margin: 0 }}>Los mensajes en este canal son sobre el estudio.</p>
                </div>
              )}

              {mensajesConFecha.map(({ dia, msgs }) => (
                <div key={dia}>
                  {/* Separador de fecha */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '10px 0 6px' }}>
                    <span style={{
                      background: 'var(--color-surface-2)',
                      color: 'var(--color-text-muted)',
                      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 8,
                      border: '1px solid var(--color-border)',
                    }}>
                      {diaLabel(dia)}
                    </span>
                  </div>

                  {msgs.map((m, idx) => {
                    const isMine = m.sender_id === user.id;
                    const prevSame = idx > 0 && msgs[idx - 1].sender_id === m.sender_id;
                    const nextSame = idx < msgs.length - 1 && msgs[idx + 1].sender_id === m.sender_id;
                    const isDeleted = !!m.eliminado_para_todos;

                    const bubbleRadius = isMine
                      ? `${prevSame ? 12 : 18}px ${prevSame ? 12 : 4}px 4px 18px`
                      : `${prevSame ? 12 : 4}px ${prevSame ? 12 : 18}px 18px 4px`;

                    return (
                      <div
                        key={m.id}
                        className={isMine ? 'chat-bubble-mine' : 'chat-bubble-other'}
                        style={{
                          display: 'flex',
                          justifyContent: isMine ? 'flex-end' : 'flex-start',
                          marginBottom: nextSame ? 2 : 8,
                          paddingLeft: isMine ? 48 : 0,
                          paddingRight: isMine ? 0 : 48,
                          position: 'relative',
                        }}
                      >
                        <div
                          style={{
                            maxWidth: '85%',
                            background: isMine
                              ? (isDark ? '#1d3557' : '#eff6ff')
                              : (isDark ? '#1e293b' : '#ffffff'),
                            border: `1px solid ${isMine ? (isDark ? '#2b4c7e' : '#bfdbfe') : 'var(--color-border)'}`,
                            borderRadius: bubbleRadius,
                            padding: '7px 10px 5px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                            position: 'relative',
                          }}
                        >
                          {/* Botón de opciones (tres puntos) */}
                          {!isDeleted && (
                            <div style={{ position: 'absolute', top: 4, right: 6, zIndex: 10 }}>
                              <button
                                onClick={(e) => { e.stopPropagation(); setActiveMenuId(prev => prev === m.id ? null : m.id); }}
                                style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 2, color: 'var(--color-text-muted)', borderRadius: '50%', opacity: 0.7 }}
                                title="Opciones de mensaje"
                              >
                                <Icon name="chevronDown" size={12} color="currentColor" />
                              </button>

                              {/* Menú desplegable */}
                              {activeMenuId === m.id && (
                                <div style={{
                                  position: 'absolute', right: 0, top: 18, zIndex: 50,
                                  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                                  borderRadius: 8, boxShadow: '0 4px 14px rgba(0,0,0,0.2)', padding: 4, minWidth: 120
                                }}>
                                  {isMine && (
                                    <button
                                      onClick={() => handleEditClick(m)}
                                      style={{ width: '100%', border: 0, background: 'transparent', padding: '6px 10px', textAlign: 'left', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text)' }}
                                    >
                                      <Icon name="edit" size={12} /> Editar
                                    </button>
                                  )}
                                  <button
                                    onClick={() => { setConfirmDelete(m); setActiveMenuId(null); }}
                                    style={{ width: '100%', border: 0, background: 'transparent', padding: '6px 10px', textAlign: 'left', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444' }}
                                  >
                                    <Icon name="trash" size={12} color="#ef4444" /> Eliminar
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Nombre del emisor (solo en mensajes del otro) */}
                          {!isMine && !prevSame && (
                            <p style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#00a884' : '#075e54', margin: '0 0 3px', lineHeight: 1 }}>
                              {m.sender_username}
                            </p>
                          )}

                          {isDeleted ? (
                            <p style={{ margin: 0, fontSize: 12.5, fontStyle: 'italic', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              🚫 Este mensaje fue eliminado
                            </p>
                          ) : (
                            <p style={{
                              margin: 0, fontSize: 13, lineHeight: 1.5,
                              color: isDark ? '#e9edef' : '#111b21',
                              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                            }}>
                              {m.contenido}
                            </p>
                          )}

                          {/* Hora + palomitas + marca (editado) */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2, marginTop: 2 }}>
                            {m.editado === 1 && !isDeleted && (
                              <span style={{ fontSize: 10, color: isDark ? '#8696a0' : '#667781', fontStyle: 'italic', marginRight: 3 }}>
                                (editado)
                              </span>
                            )}
                            <span style={{ fontSize: 10.5, color: isDark ? '#8696a0' : '#667781', lineHeight: 1 }}>
                              {formatHora(m.created_at)}
                            </span>
                            <MessageStatus leido={!!m.leido} isMine={isMine} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Indicador de escritura */}
              {typingUser && <TypingIndicator name={typingUser.name} />}

              <div ref={msgEndRef} />
            </div>

            {/* ── Banner de edición ── */}
            {editingMessage && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 12px', background: 'rgba(51,153,255,0.12)', borderBottom: '1px solid var(--color-border)',
                fontSize: 12, color: 'var(--color-primary)', fontWeight: 600
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="edit" size={12} /> Editando mensaje
                </span>
                <button
                  onClick={handleCancelEdit}
                  style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 14 }}
                  title="Cancelar edición"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Modal de confirmación de borrado */}
            {confirmDelete && (
              <div style={{
                position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
              }} onClick={() => setConfirmDelete(null)}>
                <div style={{
                  background: 'var(--color-surface)', borderRadius: 12, padding: 20, maxWidth: 320, width: '100%',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.3)', border: '1px solid var(--color-border)'
                }} onClick={e => e.stopPropagation()}>
                  <h4 style={{ margin: '0 0 10px', fontSize: 15 }}>Eliminar mensaje</h4>
                  <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '0 0 16px' }}>
                    ¿Cómo deseas eliminar este mensaje?
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleDeleteMessage(confirmDelete, 'mi')}
                      style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', justifyContent: 'center' }}
                    >
                      Eliminar para mí
                    </button>
                    {(confirmDelete.sender_id === user.id || user.role === 'SUPER_ADMIN') && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteMessage(confirmDelete, 'todos')}
                        style={{ justifyContent: 'center' }}
                      >
                        Eliminar para todos
                      </button>
                    )}
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setConfirmDelete(null)}
                      style={{ justifyContent: 'center', marginTop: 4 }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Input de mensaje ── */}
            <div style={{
              padding: '8px 10px', flexShrink: 0,
              background: isDark ? '#1f2c34' : '#f0f2f5',
              display: 'flex', alignItems: 'flex-end', gap: 7,
              borderTop: `1px solid ${isDark ? '#2a3942' : '#d1d7db'}`,
            }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Adjuntar archivo o imagen"
                style={{
                  border: 0, background: 'transparent', cursor: 'pointer', padding: '8px',
                  color: isDark ? '#8696a0' : '#54656f', display: 'flex', borderRadius: '50%',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Icon name="clip" size={20} color="currentColor" />
              </button>
              <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.docx,.doc,.txt" onChange={handleFileInput} style={{ display: 'none' }} />

              {/* Emoji */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setEmojiAbierto(v => !v)}
                  title="Emoji"
                  style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: '8px', fontSize: 18, lineHeight: 1, borderRadius: '50%', display: 'flex' }}
                >
                  <span aria-hidden="true">🙂</span>
                </button>
                {emojiAbierto && (
                  <EmojiPicker
                    onClose={() => setEmojiAbierto(false)}
                    onSelect={(emoji) => setNuevoMensaje(prev => insertarEmoji(prev, emoji, msgInputRef.current))}
                  />
                )}
              </div>

              {/* Textarea */}
              <div style={{ flex: 1, position: 'relative' }}>
                <textarea
                  ref={msgInputRef}
                  value={nuevoMensaje}
                  onChange={e => handleTyping(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Mensaje…"
                  rows={1}
                  style={{
                    width: '100%', resize: 'none', border: 'none', outline: 'none',
                    borderRadius: 10, padding: '9px 14px', fontSize: 13, lineHeight: 1.5,
                    background: isDark ? '#2a3942' : '#fff',
                    color: isDark ? '#e9edef' : '#111b21',
                    fontFamily: 'inherit', maxHeight: 120, overflowY: 'auto',
                    boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.08)',
                  }}
                  onInput={e => {
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                  }}
                />
              </div>

              {/* Botón enviar */}
              <button
                onClick={handleSend}
                disabled={sending || !nuevoMensaje.trim()}
                title="Enviar"
                style={{
                  border: 0, borderRadius: '50%', cursor: nuevoMensaje.trim() ? 'pointer' : 'default',
                  width: 42, height: 42, flexShrink: 0,
                  background: nuevoMensaje.trim() ? '#25d366' : (isDark ? '#2a3942' : '#d9d9d9'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s, transform 0.1s',
                  transform: nuevoMensaje.trim() ? 'scale(1)' : 'scale(0.9)',
                }}
              >
                {sending
                  ? <div className="spinner" style={{ width: 16, height: 16, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                  : <Icon name="send" size={17} color={nuevoMensaje.trim() ? '#fff' : (isDark ? '#667781' : '#aaa')} />
                }
              </button>
            </div>
          </>
        )}

        {/* ── Archivos ── */}
        {tab === 'archivos' && (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--color-surface)' }}>
            {/* Zona de drop */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                margin: 12, padding: '18px 12px',
                border: `2px dashed ${dragOver ? '#25d366' : (isDark ? '#2a3942' : 'var(--color-border-strong)')}`,
                borderRadius: 12, textAlign: 'center', cursor: 'pointer',
                background: dragOver ? (isDark ? '#0d1f17' : '#f0fdf4') : (isDark ? '#182229' : '#f8fafc'),
                transition: 'all 0.2s', flexShrink: 0,
              }}
            >
              <div style={{ marginBottom: 6 }}>
                {uploading
                  ? <div className="spinner" style={{ display: 'inline-block', width: 22, height: 22 }} />
                  : <Icon name="upload" size={26} color={isDark ? '#8696a0' : 'var(--color-text-muted)'} />}
              </div>
              <p style={{ fontSize: 12, color: isDark ? '#8696a0' : 'var(--color-text-secondary)', margin: 0 }}>
                {uploading ? 'Subiendo…' : 'Arrastra, haz clic o pega con Ctrl+V'}
              </p>
              <p style={{ fontSize: 10.5, color: isDark ? '#667781' : 'var(--color-text-muted)', marginTop: 3 }}>Imágenes, PDF, Word, TXT — máx. 50 MB</p>
            </div>

            {/* Botón enviar placas */}
            <div style={{ padding: '0 12px 10px' }}>
              <button
                className="btn btn-primary"
                onClick={() => images.length > 0 ? handleSendImages() : fileInputRef.current?.click()}
                disabled={sendingImages || uploading}
                style={{ width: '100%', justifyContent: 'center', gap: 7, background: '#25d366', border: 'none' }}
              >
                {sendingImages || uploading
                  ? <div className="spinner" style={{ width: 14, height: 14 }} />
                  : <Icon name={images.length > 0 ? 'send' : 'upload'} size={14} color="#fff" />}
                {sendingImages ? 'Enviando placas…' : uploading ? 'Cargando…' : images.length > 0
                  ? `Enviar ${images.length} placa${images.length !== 1 ? 's' : ''} al ${user.role === 'RADIOLOGO' ? 'encargado' : 'radiólogo'}`
                  : 'Cargar placas para enviar'}
              </button>
            </div>

            {/* Galería de imágenes */}
            {images.length > 0 && (
              <div style={{ padding: '0 12px 8px', flexShrink: 0 }}>
                <p style={{ fontSize: 10, color: isDark ? '#8696a0' : 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontWeight: 700 }}>Radiografías</p>
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                  {images.map(f => (
                    <img key={f.name} src={authenticatedFileUrl(f.url, user.token)} alt={f.name}
                      onClick={() => setLightbox(authenticatedFileUrl(f.url, user.token))}
                      style={{ width: 76, height: 76, objectFit: 'cover', borderRadius: 10, cursor: 'zoom-in', border: `2px solid ${isDark ? '#2a3942' : 'var(--color-border)'}`, flexShrink: 0 }}
                      onError={e => { e.target.style.display = 'none'; }} />
                  ))}
                </div>
              </div>
            )}

            {/* Lista de archivos */}
            <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {archivos.length === 0
                ? <p style={{ textAlign: 'center', color: isDark ? '#8696a0' : 'var(--color-text-muted)', fontSize: 12, padding: 10 }}>Sin archivos adjuntos.</p>
                : archivos.map(f => (
                  <div key={f.name} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                    background: isDark ? '#182229' : '#f8fafc',
                    borderRadius: 10, border: `1px solid ${isDark ? '#2a3942' : 'var(--color-border)'}`,
                  }}>
                    <Icon name={f.isImage ? 'image' : f.isDoc ? 'fileText' : 'file'} size={16} color={isDark ? '#8696a0' : 'var(--color-text-muted)'} />
                    <span style={{ flex: 1, fontSize: 11, wordBreak: 'break-all', color: isDark ? '#e9edef' : 'var(--color-text-secondary)', lineHeight: 1.3 }}>{f.name}</span>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <a href={authenticatedFileUrl(f.url, user.token)} target="_blank" rel="noopener noreferrer"
                        className="btn btn-info btn-xs" style={{ fontSize: 11, textDecoration: 'none', padding: '3px 9px', gap: 4, display: 'flex', alignItems: 'center' }}>
                        <Icon name="eye" size={10} /> Ver
                      </a>
                      {isEncargado && (
                        <button onClick={() => handleDelete(f.name)} className="btn btn-danger btn-xs" style={{ fontSize: 11, padding: '3px 9px', display: 'flex', alignItems: 'center' }}>
                          <Icon name="trash" size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── Lightbox ── */}
        {lightbox && (
          <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(6,16,32,0.95)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
            <img src={lightbox} alt="Vista ampliada" style={{ maxWidth: '92vw', maxHeight: '82vh', objectFit: 'contain', borderRadius: 10, boxShadow: 'var(--shadow-lg)' }} />
            {/* Controles del lightbox */}
            <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 24, display: 'flex', gap: 10, alignItems: 'center' }}>
              <a
                href={lightbox}
                download
                title="Descargar imagen"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.25)', color: '#fff',
                  padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                  textDecoration: 'none', cursor: 'pointer', transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              >
                <Icon name="download" size={15} color="#fff" /> Descargar
              </a>
            </div>
            <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={20} color="#fff" />
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default CommunicationPanel;
