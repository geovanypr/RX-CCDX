import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { NotificationContext } from '../context/NotificationContext';
import Icon from './Icons';
import { API_URL, authenticatedFileUrl } from '../config';
import { formatHora } from '../utils/format';
import { insertarEmoji } from '../utils/emoji';
import EmojiPicker from './EmojiPicker';

const CHAT_BG_LIGHT = 'var(--color-bg)';
const CHAT_BG_DARK  = 'var(--color-bg)';

/* ── Palomitas de estado ─────────────────────────────────────────────────── */
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

/* ── Indicador "escribiendo…" ────────────────────────────────────────────── */
const TypingBubble = ({ name }) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, padding: '4px 0 6px 4px' }}>
    <div style={{
      padding: '8px 14px', borderRadius: '18px 18px 18px 4px',
      background: 'var(--color-surface)',
      boxShadow: '0 1px 2px rgba(0,0,0,0.13)',
      display: 'flex', alignItems: 'center', gap: 7,
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

const CommunicationHub = ({ onClose }) => {
  const { user } = useContext(AuthContext);
  const { on, off, addNotification, emitSocket } = useContext(NotificationContext);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [emojiAbierto, setEmojiAbierto] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [typingUser, setTypingUser] = useState(null);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  const inputRef = useRef(null);
  const endRef = useRef(null);
  const textRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);
  const typingClearRef = useRef(null);

  const target = user.role === 'RADIOLOGO' ? 'Encargado' : 'Radiólogo';
  const headers = { Authorization: `Bearer ${user.token}` };

  // Seguir el tema del documento en tiempo real
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const chatBg = isDark ? CHAT_BG_DARK : CHAT_BG_LIGHT;

  const loadMessages = useCallback(() => {
    fetch(`${API_URL}/api/comunicacion/mensajes`, { headers })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setMessages(data);
      })
      .catch(() => {});
  }, [user.token]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Suscripciones a socket
  useEffect(() => {
    const onNew = (message) => {
      setMessages(prev =>
        prev.some(m => m.id === message.id) ? prev : [...prev, message]
      );
    };
    const onLeidos = () => {
      // Marcar todos los mensajes del propio usuario como leídos
      setMessages(prev => prev.map(m =>
        m.sender_id === user.id ? { ...m, leido: 1 } : m
      ));
    };
    const onTypingStart = (data) => {
      if (data.canal === 'general') {
        setTypingUser({ name: data.sender_username });
        clearTimeout(typingClearRef.current);
        typingClearRef.current = setTimeout(() => setTypingUser(null), 4000);
      }
    };
    const onTypingStop = (data) => {
      if (data.canal === 'general') setTypingUser(null);
    };

    const onEdit = (data) => {
      setMessages(prev => prev.map(m => m.id === data.id ? { ...m, ...data } : m));
    };
    const onEliminado = (data) => {
      if (data.modo === 'todos' && data.mensaje) {
        setMessages(prev => prev.map(m => m.id === data.id ? { ...m, ...data.mensaje } : m));
      } else {
        setMessages(prev => prev.filter(m => m.id !== data.id));
      }
    };

    on('comunicacion:nuevo', onNew);
    on('comunicacion:editado', onEdit);
    on('comunicacion:eliminado', onEliminado);
    on('comunicacion:leidos', onLeidos);
    on('typing:start', onTypingStart);
    on('typing:stop', onTypingStop);

    return () => {
      off('comunicacion:nuevo', onNew);
      off('comunicacion:editado', onEdit);
      off('comunicacion:eliminado', onEliminado);
      off('comunicacion:leidos', onLeidos);
      off('typing:start', onTypingStart);
      off('typing:stop', onTypingStop);
      clearTimeout(typingClearRef.current);
    };
  }, [on, off, user.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUser]);

  // Typing con debounce
  const handleTyping = (value) => {
    setText(value);
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      emitSocket('typing:start', { canal: 'general' });
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      emitSocket('typing:stop', { canal: 'general' });
    }, 1500);
  };

  const sendMessage = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    clearTimeout(typingTimerRef.current);
    isTypingRef.current = false;
    emitSocket('typing:stop', { canal: 'general' });
    setSending(true);
    try {
      if (editingMessage) {
        const res = await fetch(`${API_URL}/api/comunicacion/mensajes/${editingMessage.id}`, {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ contenido: trimmed }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo editar');
        setText('');
        setEditingMessage(null);
        loadMessages();
      } else {
        const res = await fetch(`${API_URL}/api/comunicacion/mensajes`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ contenido: trimmed }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo enviar');
        setText('');
        loadMessages();
      }
    } catch (error) {
      addNotification('Error', error.message, 'error');
    } finally { setSending(false); }
  };

  const handleEditClick = (msg) => {
    setEditingMessage(msg);
    setText(msg.contenido || '');
    setActiveMenuId(null);
    textRef.current?.focus();
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setText('');
  };

  const handleDeleteMessage = async (msg, modo) => {
    try {
      const res = await fetch(`${API_URL}/api/comunicacion/mensajes/${msg.id}?modo=${modo}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();
      if (data.success) {
        if (modo === 'mi') {
          setMessages(prev => prev.filter(x => x.id !== msg.id));
        } else {
          loadMessages();
        }
        addNotification('Mensaje eliminado', modo === 'todos' ? 'Eliminado para todos' : 'Eliminado para ti', 'success');
      } else {
        addNotification('Error al eliminar', data.error, 'error');
      }
    } catch (error) {
      addNotification('Error', error.message, 'error');
    } finally {
      setConfirmDelete(null);
      setActiveMenuId(null);
    }
  };

  const sendFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      addNotification('Archivo demasiado grande', 'El límite es 50 MB.', 'error');
      return;
    }
    setUploading(true);
    const form = new FormData();
    form.append('archivo', file);
    if (text.trim()) form.append('contenido', text.trim());
    try {
      const res = await fetch(`${API_URL}/api/comunicacion/archivos`, { method: 'POST', headers, body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo adjuntar');
      setText('');
      loadMessages();
    } catch (error) {
      addNotification('No se pudo enviar el archivo', error.message, 'error');
    } finally { setUploading(false); }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // Agrupar por fecha para separadores de día
  const grouped = messages.reduce((acc, m) => {
    const dia = (m.created_at || '').split(' ')[0] || (m.created_at || '').split('T')[0] || '';
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
      <style>{`
        @keyframes typingDot {
          0%,60%,100%{transform:translateY(0);opacity:.4}
          30%{transform:translateY(-4px);opacity:1}
        }
        .hub-bubble-mine{animation:popIn .15s ease}
        .hub-bubble-other{animation:slideInLeft .15s ease}
      `}</style>

      {/* ── Backdrop ── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(7,24,45,.42)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
        padding: 20,
      }}>
        <section style={{
          width: 'min(460px, 100%)', height: 'min(680px, 88vh)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          borderRadius: 16,
          boxShadow: '0 24px 70px rgba(0,25,60,.35)',
          background: 'var(--color-bg)',
        }}>

          {/* ── Header ── */}
          <header style={{
            padding: '10px 14px', flexShrink: 0,
            background: isDark ? 'linear-gradient(90deg,#003366,#0a4d8c)' : 'linear-gradient(90deg,#003366,#1a66b3)',
            display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="message" size={20} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: '#fff' }}>
                Mensajería
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'rgba(255,255,255,0.75)' }}>
                {typingUser
                  ? <span style={{ color: '#9de1d0' }}>✎ {typingUser.name} está escribiendo…</span>
                  : `Canal directo con el ${target}`
                }
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar mensajería"
              style={{ border: 0, background: 'transparent', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', padding: 5, borderRadius: '50%', display: 'flex' }}
            >
              <Icon name="close" size={18} color="currentColor" />
            </button>
          </header>

          {/* ── Lista de mensajes ── */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '10px 12px',
            display: 'flex', flexDirection: 'column', gap: 2,
            background: chatBg,
          }}>
            {messages.length === 0 && !typingUser && (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32,
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="message" size={30} color={isDark ? '#8696a0' : '#54656f'} />
                </div>
                <p style={{ margin: 0, fontSize: 13, color: isDark ? '#8696a0' : '#54656f', textAlign: 'center' }}>
                  Todavía no hay mensajes.
                </p>
                <p style={{ margin: 0, fontSize: 11.5, color: isDark ? '#667781' : '#94a3b4', textAlign: 'center' }}>
                  Usa este canal para comunicarte directamente con el {target.toLowerCase()}.
                </p>
              </div>
            )}

            {grouped.map(({ dia, msgs }) => (
              <div key={dia}>
                {/* Separador de fecha */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '10px 0 6px' }}>
                  <span style={{
                    background: isDark ? 'rgba(0,51,102,0.5)' : 'rgba(0,51,102,0.1)',
                    color: isDark ? '#a8c4e4' : '#003366',
                    fontSize: 11, fontWeight: 600, padding: '3px 12px', borderRadius: 8,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  }}>
                    {diaLabel(dia)}
                  </span>
                </div>

                {msgs.map((msg, idx) => {
                  const mine = msg.sender_id === user.id;
                  const prevSame = idx > 0 && msgs[idx - 1].sender_id === msg.sender_id;
                  const nextSame = idx < msgs.length - 1 && msgs[idx + 1].sender_id === msg.sender_id;
                  const isDeleted = !!msg.eliminado_para_todos;
                  const fileUrl = msg.archivo_nombre && !isDeleted
                    ? authenticatedFileUrl(`/api/comunicacion/archivos/${encodeURIComponent(msg.archivo_nombre)}`, user.token)
                    : null;

                  const bubbleRadius = mine
                    ? `${prevSame ? 12 : 18}px ${prevSame ? 12 : 4}px 4px 18px`
                    : `${prevSame ? 12 : 4}px ${prevSame ? 12 : 18}px 18px 4px`;

                  return (
                    <div
                      key={msg.id}
                      className={mine ? 'hub-bubble-mine' : 'hub-bubble-other'}
                      style={{
                        display: 'flex',
                        justifyContent: mine ? 'flex-end' : 'flex-start',
                        marginBottom: nextSame ? 2 : 8,
                        paddingLeft: mine ? 52 : 0,
                        paddingRight: mine ? 0 : 52,
                        position: 'relative',
                      }}
                    >
                      <div style={{
                        maxWidth: '85%',
                        background: mine
                          ? (isDark ? 'linear-gradient(135deg,#003366,#1a66b3)' : 'linear-gradient(135deg,#1a66b3,#3399FF)')
                          : 'var(--color-surface)',
                        borderRadius: bubbleRadius,
                        padding: '7px 10px 5px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                        border: mine ? 'none' : '1px solid var(--color-border)',
                        position: 'relative',
                      }}>
                        {/* Botón de opciones */}
                        {!isDeleted && (
                          <div style={{ position: 'absolute', top: 4, right: 6, zIndex: 10 }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); setActiveMenuId(prev => prev === msg.id ? null : msg.id); }}
                              style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 2, color: mine ? 'rgba(255,255,255,0.7)' : 'var(--color-text-muted)', borderRadius: '50%' }}
                              title="Opciones de mensaje"
                            >
                              <Icon name="chevronDown" size={12} color="currentColor" />
                            </button>

                            {/* Dropdown */}
                            {activeMenuId === msg.id && (
                              <div style={{
                                position: 'absolute', right: 0, top: 18, zIndex: 50,
                                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                                borderRadius: 8, boxShadow: '0 4px 14px rgba(0,0,0,0.2)', padding: 4, minWidth: 120
                              }}>
                                {mine && (
                                  <button
                                    onClick={() => handleEditClick(msg)}
                                    style={{ width: '100%', border: 0, background: 'transparent', padding: '6px 10px', textAlign: 'left', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text)' }}
                                  >
                                    <Icon name="edit" size={12} /> Editar
                                  </button>
                                )}
                                <button
                                  onClick={() => { setConfirmDelete(msg); setActiveMenuId(null); }}
                                  style={{ width: '100%', border: 0, background: 'transparent', padding: '6px 10px', textAlign: 'left', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444' }}
                                >
                                  <Icon name="trash" size={12} color="#ef4444" /> Eliminar
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Nombre del emisor en mensajes del otro */}
                        {!mine && !prevSame && (
                          <p style={{ fontSize: 11.5, fontWeight: 700, color: isDark ? '#60a5fa' : '#1a66b3', margin: '0 0 3px', lineHeight: 1 }}>
                            {msg.sender_username}
                          </p>
                        )}

                        {isDeleted ? (
                          <p style={{ margin: 0, fontSize: 12.5, fontStyle: 'italic', color: mine ? 'rgba(255,255,255,0.75)' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            🚫 Este mensaje fue eliminado
                          </p>
                        ) : (
                          msg.contenido && (
                            <p style={{
                              margin: 0, fontSize: 13, lineHeight: 1.5,
                              color: mine ? '#fff' : 'var(--color-text)',
                              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                            }}>
                              {msg.contenido}
                            </p>
                          )
                        )}

                        {/* Archivo adjunto */}
                        {fileUrl && (
                          msg.archivo_mimetype?.startsWith('image/') ? (
                            <button
                              onClick={() => setLightbox({ url: fileUrl, name: msg.archivo_original })}
                              style={{ display: 'block', marginTop: msg.contenido ? 8 : 0, padding: 0, border: 0, background: 'transparent', cursor: 'zoom-in' }}
                            >
                              <img
                                src={fileUrl}
                                alt={msg.archivo_original}
                                style={{ display: 'block', width: 220, maxWidth: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 9, border: '1px solid rgba(255,255,255,.2)' }}
                              />
                              <span style={{ display: 'block', color: mine ? '#d1fae5' : (isDark ? '#8696a0' : '#54656f'), fontSize: 10, textAlign: 'left', marginTop: 3 }}>
                                {msg.archivo_original}
                              </span>
                            </button>
                          ) : (
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'flex', alignItems: 'center', gap: 7,
                                color: mine ? '#fff' : (isDark ? '#8696a0' : '#54656f'),
                                marginTop: msg.contenido ? 8 : 0, fontSize: 12, textDecoration: 'none',
                                padding: '6px 8px', borderRadius: 8,
                                background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.04)',
                              }}
                            >
                              <Icon name="fileText" size={18} color="currentColor" />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                {msg.archivo_original}
                              </span>
                            </a>
                          )
                        )}

                        {/* Hora + palomitas + marca (editado) */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2, marginTop: 3 }}>
                          {msg.editado === 1 && !isDeleted && (
                            <span style={{ fontSize: 10, color: mine ? 'rgba(255,255,255,0.75)' : (isDark ? '#8696a0' : '#667781'), fontStyle: 'italic', marginRight: 3 }}>
                              (editado)
                            </span>
                          )}
                          <span style={{ fontSize: 10.5, color: mine ? 'rgba(255,255,255,0.65)' : 'var(--color-text-muted)', lineHeight: 1 }}>
                            {formatHora(msg.created_at)}
                          </span>
                          <MessageStatus leido={!!msg.leido} isMine={mine} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Indicador de escritura */}
            {typingUser && <TypingBubble name={typingUser.name} />}

            <div ref={endRef} />
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
          <footer style={{
            padding: '8px 10px', flexShrink: 0,
            background: isDark ? '#1f2c34' : '#f0f2f5',
            display: 'flex', alignItems: 'flex-end', gap: 7,
            borderTop: `1px solid ${isDark ? '#2a3942' : '#d1d7db'}`,
          }}>
            {/* Adjuntar archivo */}
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              title="Enviar imagen o documento"
              style={{
                border: 0, background: 'transparent', cursor: 'pointer', padding: 8,
                color: isDark ? '#8696a0' : '#54656f', borderRadius: '50%', display: 'flex',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <Icon name="clip" size={20} color="currentColor" />
            </button>
            <input ref={inputRef} type="file" accept="image/*,.pdf,.doc,.docx,.zip,.txt" onChange={sendFile} hidden />

            {/* Emoji */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setEmojiAbierto(v => !v)}
                disabled={uploading}
                title="Insertar emoji"
                style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 8, fontSize: 18, lineHeight: 1, borderRadius: '50%', display: 'flex' }}
              >
                <span aria-hidden="true">🙂</span>
              </button>
              {emojiAbierto && (
                <EmojiPicker
                  onClose={() => setEmojiAbierto(false)}
                  onSelect={(emoji) => setText(prev => insertarEmoji(prev, emoji, textRef.current))}
                />
              )}
            </div>

            {/* Textarea */}
            <textarea
              ref={textRef}
              value={text}
              onChange={e => handleTyping(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Mensaje…"
              rows={1}
              style={{
                flex: 1, resize: 'none', border: 'none', outline: 'none',
                borderRadius: 10, padding: '9px 14px', fontSize: 13, lineHeight: 1.5,
                fontFamily: 'inherit', maxHeight: 120, overflowY: 'auto',
                background: isDark ? '#2a3942' : '#fff',
                color: isDark ? '#e9edef' : '#111b21',
                boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.08)',
              }}
              onInput={e => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
            />

            {/* Botón enviar */}
            <button
              onClick={sendMessage}
              disabled={sending || !text.trim()}
              title="Enviar mensaje"
              style={{
                border: 0, borderRadius: '50%', flexShrink: 0,
                width: 42, height: 42,
                background: text.trim() ? '#25d366' : (isDark ? '#2a3942' : '#d9d9d9'),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: text.trim() ? 'pointer' : 'default',
                transition: 'background 0.2s, transform 0.1s',
                transform: text.trim() ? 'scale(1)' : 'scale(0.9)',
              }}
            >
              {sending
                ? <div className="spinner" style={{ width: 16, height: 16, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                : <Icon name="send" size={17} color={text.trim() ? '#fff' : (isDark ? '#667781' : '#aaa')} />
              }
            </button>
          </footer>
        </section>

        {/* ── Lightbox ── */}
        {lightbox && (
          <div
            onClick={() => setLightbox(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 2100, background: 'rgba(5,16,30,.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}
          >
            <img
              src={lightbox.url}
              alt={lightbox.name}
              style={{ maxWidth: '94vw', maxHeight: '82vh', objectFit: 'contain', borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}
            />
            {/* Barra inferior con nombre + descarga */}
            <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>{lightbox.name}</span>
              <a
                href={lightbox.url}
                download={lightbox.name}
                title="Descargar imagen"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.25)', color: '#fff',
                  padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                  textDecoration: 'none', transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              >
                <Icon name="download" size={14} color="#fff" /> Descargar
              </a>
            </div>
            <button
              onClick={() => setLightbox(null)}
              aria-label="Cerrar imagen ampliada"
              style={{ position: 'absolute', top: 18, right: 18, width: 40, height: 40, border: 0, borderRadius: '50%', background: 'rgba(255,255,255,0.14)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="close" size={19} color="#fff" />
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default CommunicationHub;
