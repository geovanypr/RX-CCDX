import React, { useState, useEffect, useRef, useContext, useCallback, Suspense, lazy } from 'react';
import { AuthContext } from '../context/AuthContext';
import { NotificationContext } from '../context/NotificationContext';
import Icon from './Icons';
import { API_URL, authenticatedFileUrl, downloadAuthenticatedFile } from '../config';
import { sexoLabel, formatHora, formatFechaHora } from '../utils/format';
import ConfirmDialog from './ConfirmDialog';

// El visor de informes se descarga solo cuando se abre.
const InformeViewer = lazy(() => import('./InformeViewer'));
import { insertarEmoji } from '../utils/emoji';
import EmojiPicker from './EmojiPicker';
import PacsViewer from './PacsViewer';


const ESTADO_COLORS = {
  'Recibida': { bg: '#f0f9ff', text: '#0369a1', dot: '#38bdf8' },
  'Pendiente de enviar al radiólogo': { bg: '#fffbeb', text: '#854d0e', dot: '#f59e0b' },
  'Enviada al radiólogo': { bg: '#fff7ed', text: '#9a3412', dot: '#f97316' },
  'En lectura': { bg: '#fdf4ff', text: '#7e22ce', dot: '#a855f7' },
  'Diagnóstico recibido': { bg: '#f0fdf4', text: '#166534', dot: '#22c55e' },
  'Devuelta por revisión': { bg: '#fff1f2', text: '#9f1239', dot: '#f43f5e' },
  'Listo para imprimir': { bg: '#f0fdfa', text: '#134e4a', dot: '#14b8a6' },
  'Entregado': { bg: '#f8fafc', text: '#475569', dot: '#94a3b8' },
};

const StateBadge = ({ estado }) => {
  const s = ESTADO_COLORS[estado] || { bg: '#f1f5f9', text: '#64748b', dot: '#94a3b8' };
  return (
    <span className="badge" style={{ background: s.bg, color: s.text, fontSize: 11.5 }}>
      <span className="badge-dot" style={{ background: s.dot }} />
      {estado}
    </span>
  );
};

const StudyDetailModal = ({ estudio: initialEstudio, onClose, onUpdated, userRole }) => {
  const { user } = useContext(AuthContext);
  const { on, off, addNotification } = useContext(NotificationContext);
  const [estudio, setEstudio] = useState(initialEstudio);
  const [tab, setTab] = useState('info');
  const [archivos, setArchivos] = useState([]);
  const [descargandoPlacas, setDescargandoPlacas] = useState(false);
  const [visorIndex, setVisorIndex] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [envios, setEnvios] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [emojiAbierto, setEmojiAbierto] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [showDevolver, setShowDevolver] = useState(false);
  const [notaRevision, setNotaRevision] = useState('');
  const [showEditDiag, setShowEditDiag] = useState(false);
  const [editedDiag, setEditedDiag] = useState(estudio.diagnostico || '');
  const [dragOver, setDragOver] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [submittingReenvio, setSubmittingReenvio] = useState(false);
  const [showInforme, setShowInforme] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [confirmDeleteMsg, setConfirmDeleteMsg] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const fileInputRef = useRef(null);
  const msgEndRef = useRef(null);
  const msgInputRef = useRef(null);

  const headers = { Authorization: `Bearer ${user.token}` };

  const loadArchivos = useCallback(() => {
    fetch(`${API_URL}/api/estudios/${estudio.id}/archivos`, { headers })
      .then(r => r.json())
      .then(d => Array.isArray(d) && setArchivos(d))
      .catch(() => {});
  }, [estudio.id]);

  const loadMensajes = useCallback(() => {
    fetch(`${API_URL}/api/estudios/${estudio.id}/mensajes`, { headers })
      .then(r => r.json())
      .then(d => Array.isArray(d) && setMensajes(d))
      .catch(() => {});
  }, [estudio.id]);

  const loadEnvios = useCallback(() => {
    fetch(`${API_URL}/api/estudios/${estudio.id}/envios`, { headers })
      .then(r => r.json())
      .then(d => Array.isArray(d) && setEnvios(d))
      .catch(() => {});
  }, [estudio.id]);

  const reloadEstudio = useCallback(() => {
    fetch(`${API_URL}/api/estudios/${estudio.id}`, { headers })
      .then(r => r.json())
      .then(d => { if (d.id) { setEstudio(d); onUpdated?.(); } })
      .catch(() => {});
  }, [estudio.id]);

  useEffect(() => {
    loadArchivos();
    loadMensajes();
    loadEnvios();
  }, []);

  useEffect(() => {
    if (tab === 'archivos') loadArchivos();
    if (tab === 'mensajes') loadMensajes();
    if (tab === 'envios') loadEnvios();
  }, [tab]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  useEffect(() => {
    const onMensajeNuevo = (data) => {
      if (data.estudio_id === estudio.id) loadMensajes();
    };
    const onMensajeEditado = (data) => {
      if (data.estudio_id === estudio.id) {
        setMensajes(prev => prev.map(m => m.id === data.id ? { ...m, ...data } : m));
      }
    };
    const onMensajeEliminado = (data) => {
      if (data.estudio_id === estudio.id) {
        if (data.modo === 'todos' && data.mensaje) {
          setMensajes(prev => prev.map(m => m.id === data.id ? { ...m, ...data.mensaje } : m));
        } else {
          setMensajes(prev => prev.filter(m => m.id !== data.id));
        }
      }
    };
    const onArchivoSubido = (data) => {
      if (data.estudio_id === estudio.id) loadArchivos();
    };

    on('mensaje:nuevo', onMensajeNuevo);
    on('mensaje:editado', onMensajeEditado);
    on('mensaje:eliminado', onMensajeEliminado);
    on('archivo:subido', onArchivoSubido);

    return () => {
      off('mensaje:nuevo', onMensajeNuevo);
      off('mensaje:editado', onMensajeEditado);
      off('mensaje:eliminado', onMensajeEliminado);
      off('archivo:subido', onArchivoSubido);
    };
  }, [on, off, estudio.id, loadMensajes, loadArchivos]);

  // Cerrar con tecla Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSendMessage = async () => {
    if (!nuevoMensaje.trim()) return;
    setSendingMsg(true);
    try {
      if (editingMessage) {
        const res = await fetch(`${API_URL}/api/estudios/${estudio.id}/mensajes/${editingMessage.id}`, {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ contenido: nuevoMensaje.trim() }),
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
          body: JSON.stringify({ contenido: nuevoMensaje.trim() }),
        });
        const data = await res.json();
        if (data.success) {
          setNuevoMensaje('');
          loadMensajes();
        }
      }
    } finally {
      setSendingMsg(false);
    }
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
      setConfirmDeleteMsg(null);
      setActiveMenuId(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const uploadFiles = async (files) => {
    if (!files || files.length === 0) return;
    // Convert to array to avoid issues with FileList reference after input reset
    const fileList = Array.from(files);
    setUploadingFiles(true);
    const formData = new FormData();
    for (const f of fileList) formData.append('archivos', f);
    try {
      const res = await fetch(`${API_URL}/api/estudios/${estudio.id}/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });
      let d;
      try {
        d = await res.json();
      } catch {
        throw new Error('Respuesta inválida del servidor');
      }
      if (!res.ok || !d.success) {
        addNotification('❌ No se pudo subir el archivo', d.error || `Error ${res.status}`, 'error');
      } else {
        addNotification('📎 Archivos subidos', `${fileList.length} archivo(s) agregado(s) a la carpeta del paciente`, 'success');
        loadArchivos();
      }
    } catch (err) {
      addNotification('❌ Error al subir archivos', err.message || 'Error de conexión', 'error');
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleFileInput = (e) => {
    const files = e.target.files;
    uploadFiles(files);
    // Reset so same file can be re-selected
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(e.dataTransfer.files);
  };

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles = [];
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) uploadFiles(imageFiles);
  }, [estudio.id]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const handleDeleteFile = async (filename) => {
    setConfirmDialog({
      title: 'Eliminar archivo',
      message: `¿Eliminar "${filename}"? Esta acción no se puede deshacer.`,
      variant: 'danger',
      confirmLabel: 'Eliminar',
      onConfirm: async () => {
        await fetch(`${API_URL}/api/estudios/${estudio.id}/archivos/${encodeURIComponent(filename)}`, {
          method: 'DELETE', headers,
        });
        loadArchivos();
      },
    });
  };

  const imagenesDelEstudio = archivos.filter(f => f.isImage);

  const handleDownloadFile = async (archivo) => {
    try {
      await downloadAuthenticatedFile(`/api/estudios/${estudio.id}/archivos/${encodeURIComponent(archivo.name)}/download`, user.token, archivo.name);
      addNotification('Archivo descargado', archivo.name, 'success');
    } catch (error) {
      addNotification('No se pudo descargar el archivo', error.message, 'error');
    }
  };

  const handleDownloadPlacas = async () => {
    setDescargandoPlacas(true);
    try {
      await downloadAuthenticatedFile(`/api/estudios/${estudio.id}/radiografias/download`, user.token, `placas_${estudio.nombre}_${estudio.registro_id}.zip`);
      addNotification('Placas descargadas', 'Radiografías del estudio en un solo ZIP.', 'success');
    } catch (error) {
      addNotification('No se pudieron descargar las placas', error.message, 'error');
    } finally {
      setDescargandoPlacas(false);
    }
  };

  const handleDevolver = async () => {
    if (!notaRevision.trim()) {
      setConfirmDialog({
        title: 'Nota requerida',
        message: 'Debe escribir una nota de revisión antes de devolver el estudio al radiólogo.',
        variant: 'warning',
        confirmLabel: 'Entendido',
        cancelLabel: null,
        onConfirm: () => {},
      });
      return;
    }
    const res = await fetch(`${API_URL}/api/estudios/${estudio.id}/devolver`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nota_revision: notaRevision }),
    });
    const data = await res.json();
    if (data.success) { reloadEstudio(); setShowDevolver(false); setNotaRevision(''); }
    else if (data.error) {
      setConfirmDialog({
        title: 'No se pudo devolver',
        message: data.error,
        variant: 'warning',
        confirmLabel: 'Entendido',
        cancelLabel: null,
        onConfirm: () => {},
      });
    }
  };

  const handleReenviarRadiologo = async () => {
    setSubmittingReenvio(true);
    try {
      const res = await fetch(`${API_URL}/api/estudios/${estudio.id}/estado`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'Enviada al radiólogo' }),
      });
      const d = await res.json();
      if (!d.success) {
        addNotification('❌ No se pudo reenviar', d.error || 'Error al cambiar el estado', 'error');
      } else {
        addNotification('📤 Estudio reenviado al radiólogo', 'Revisión finalizada. El radiólogo ya tiene el estudio en su lista de trabajo.', 'success');
        reloadEstudio();
        onUpdated?.();
      }
    } catch (err) {
      addNotification('❌ Error de conexión', 'No se pudo reenviar el estudio al radiólogo.', 'error');
    } finally {
      setSubmittingReenvio(false);
    }
  };

  const handleSaveDiag = async () => {
    const res = await fetch(`${API_URL}/api/estudios/${estudio.id}/diagnostico`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ diagnostico: editedDiag }),
    });
    const data = await res.json();
    if (data.success) { reloadEstudio(); setShowEditDiag(false); }
  };

  const handleDeleteStudy = async () => {
    setConfirmDialog({
      title: 'Eliminar estudio',
      message: `Esta acción eliminará el estudio ${estudio.registro_id}, su historial de envíos, mensajes y archivos asociados. Esta acción no se puede deshacer.`,
      variant: 'danger',
      confirmLabel: 'Eliminar permanentemente',
      onConfirm: async () => {
        setDeleting(true);
        try {
          const res = await fetch(`${API_URL}/api/estudios/${estudio.id}`, { method: 'DELETE', headers });
          const data = await res.json();
          if (!res.ok || !data.success) {
            addNotification('No se pudo eliminar', data.error || 'El servidor rechazó la operación', 'error');
            return;
          }
          addNotification('Estudio eliminado', `${estudio.registro_id} fue eliminado del expediente operativo`, 'success');
          onUpdated?.();
          onClose();
        } catch {
          addNotification('Error de conexión', 'No se pudo completar la eliminación', 'error');
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  const handleToggleUrgente = async () => {
    try {
      const res = await fetch(`${API_URL}/api/estudios/${estudio.id}/urgente`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ urgente: !estudio.urgente }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo actualizar la prioridad');
      setEstudio(prev => ({ ...prev, urgente: data.urgente }));
      addNotification(data.urgente ? 'Estudio marcado como urgente' : 'Prioridad normal restaurada', `${estudio.registro_id} — ${estudio.nombre}`, data.urgente ? 'error' : 'success');
      onUpdated?.();
    } catch (error) {
      addNotification('No se pudo actualizar la prioridad', error.message, 'error');
    }
  };

  const isEncargado = userRole === 'ENCARGADO' || userRole === 'SUPER_ADMIN';
  const hasDiagnostico = !!estudio.diagnostico;

  const tabs = [
    { id: 'info', icon: 'info', label: 'Información' },
    { id: 'archivos', icon: 'clip', label: `Archivos${archivos.length > 0 ? ` (${archivos.length})` : ''}` },
    { id: 'mensajes', icon: 'message', label: `Mensajes${mensajes.length > 0 ? ` (${mensajes.length})` : ''}` },
    ...(envios.length > 0 ? [{ id: 'envios', icon: 'send', label: `Envíos (${envios.length})` }] : []),
  ];

  return (
    <>
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 800 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="flex-1">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className="mono font-bold" style={{ fontSize: 15, color: 'var(--color-primary)' }}>{estudio.registro_id}</span>
              <StateBadge estado={estudio.estado} />
            </div>
            <p style={{ fontSize: 15, marginTop: 4, color: 'var(--color-text)' }}>{estudio.nombre}</p>
            <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
              {estudio.tipo_estudio} · {estudio.fecha_estudio} · Ref: {estudio.medico_remitente}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="tabs" style={{ padding: '0 24px' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              className={`tab-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <Icon name={t.icon} size={13} /> {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="modal-body">

          {/* INFO */}
          {tab === 'info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 14px', borderRadius: 12,
                border: `1px solid ${estudio.urgente ? '#fecaca' : 'var(--color-border)'}`,
                background: estudio.urgente ? '#fef2f2' : '#f8fafc',
              }}>
                <Icon name="bell" size={15} color={estudio.urgente ? '#b91c1c' : 'var(--color-text-muted)'} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: estudio.urgente ? '#b91c1c' : 'var(--color-text-secondary)' }}>
                  {estudio.urgente ? 'Estudio marcado como URGENTE' : 'Prioridad normal'}
                </span>
                <button
                  onClick={handleToggleUrgente}
                  className={`btn btn-xs ${estudio.urgente ? 'btn-ghost' : 'btn-danger'}`}
                  style={{ marginLeft: 'auto', gap: 5 }}
                >
                  {estudio.urgente ? 'Quitar urgencia' : 'Marcar como urgente'}
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <InfoField label="Paciente" value={estudio.nombre} />
                <InfoField label="Registro" value={estudio.registro_id} />
                <InfoField label="Tipo de estudio" value={estudio.tipo_estudio || '—'} />
                <InfoField label="Fecha" value={estudio.fecha_estudio} />
                <InfoField label="Médico remitente" value={estudio.medico_remitente} />
                <InfoField label="Edad / Sexo" value={`${estudio.edad} años · ${sexoLabel(estudio.sexo)}`} />
                {estudio.lateralidad && <InfoField label="Lateralidad" value={estudio.lateralidad} />}
              </div>

              {estudio.notas_clinicas && (
                <div style={{ padding: '14px 16px', background: 'var(--color-success-bg)', borderRadius: 12, borderLeft: '4px solid #22c55e' }}>
                  <strong style={{ fontSize: 11.5, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notas clínicas del remitente</strong>
                  <p style={{ marginTop: 8, color: '#15803d', lineHeight: 1.6, fontSize: 13.5 }}>{estudio.notas_clinicas}</p>
                </div>
              )}

              {estudio.nota_revision && (
                <div style={{ padding: '14px 16px', background: 'var(--color-danger-bg)', borderRadius: 12, borderLeft: '4px solid #f43f5e' }}>
                  <strong style={{ fontSize: 11.5, color: '#9f1239', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nota de revisión del encargado</strong>
                  <p style={{ marginTop: 8, color: '#be123c', lineHeight: 1.6, fontSize: 13.5 }}>{estudio.nota_revision}</p>
                </div>
              )}

              {hasDiagnostico && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <strong style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Diagnóstico médico</strong>
                    {isEncargado && (
                      <button className="btn btn-ghost btn-xs" onClick={() => { setEditedDiag(estudio.diagnostico); setShowEditDiag(true); }}>
                        Editar
                      </button>
                    )}
                  </div>
                  {showEditDiag ? (
                    <div>
                      <textarea
                        className="input"
                        style={{ height: 180, resize: 'vertical', fontFamily: '"Times New Roman", Times, serif', fontSize: 15, lineHeight: 1.7 }}
                        value={editedDiag}
                        onChange={e => setEditedDiag(e.target.value)}
                      />
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                        <button className="btn btn-ghost" onClick={() => setShowEditDiag(false)}>Cancelar</button>
                        <button className="btn btn-primary" onClick={handleSaveDiag}>Guardar cambios</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      padding: '16px 18px', background: '#fcfcfd', borderRadius: 12, border: '1px solid var(--color-border)',
                      fontFamily: '"Times New Roman", Times, serif', fontSize: 14.5, lineHeight: 1.7, whiteSpace: 'pre-wrap',
                    }}>
                      {estudio.diagnostico}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ARCHIVOS */}
          {tab === 'archivos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  className="btn btn-success btn-sm"
                  onClick={handleDownloadPlacas}
                  disabled={descargandoPlacas || !archivos.some(f => f.isImage)}
                  style={{ gap: 5 }}
                >
                  <Icon name="download" size={12} />
                  {descargandoPlacas ? 'Preparando ZIP...' : `Descargar placas (${archivos.filter(f => f.isImage).length})`}
                </button>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  Descarga las radiografías del estudio en un ZIP; los informes van aparte.
                </span>
              </div>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--color-secondary)' : 'var(--color-border-strong)'}`,
                  borderRadius: 14, padding: 30, textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? '#eff6ff' : '#f8fafc', transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
                  {uploadingFiles ? <div className="spinner" style={{ width: 26, height: 26 }} /> : <Icon name="upload" size={32} color="var(--color-text-muted)" />}
                </div>
                <p style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
                  {uploadingFiles ? 'Subiendo archivos...' : 'Arrastra archivos aquí, haz clic para seleccionar, o pega imágenes con Ctrl+V'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>Imágenes, PDFs, TXT, documentos (máx. 50MB por archivo)</p>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileInput} multiple accept="image/*,.pdf,.docx,.doc,.txt" style={{ display: 'none' }} />

              {archivos.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 20, fontSize: 13.5 }}>
                  No hay archivos adjuntos en esta carpeta.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {archivos.map(f => (
                    <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#f8fafc', borderRadius: 12, border: '1px solid var(--color-border)' }}>
                      <Icon name={f.isImage ? 'image' : f.isDoc ? 'fileText' : 'file'} size={20} color="var(--color-text-muted)" />
                      <span style={{ flex: 1, fontSize: 13, wordBreak: 'break-all' }}>{f.name}</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleDownloadFile(f)}
                          title="Descargar este archivo"
                          style={{ gap: 5, display: 'flex', alignItems: 'center' }}
                        >
                          <Icon name="download" size={12} /> Bajar
                        </button>
                        <a
                          href={authenticatedFileUrl(f.url, user.token)}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-info btn-sm"
                          style={{ textDecoration: 'none', gap: 5, display: 'flex', alignItems: 'center' }}
                        >
                          <Icon name="eye" size={12} /> Ver
                        </a>
                        {isEncargado && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteFile(f.name)} style={{ gap: 5, display: 'flex', alignItems: 'center' }}>
                            <Icon name="trash" size={12} /> Eliminar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {archivos.some(f => f.isImage) && (
                <div>
                  <strong style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Visor radiológico</strong>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 8 }}>Haga clic en una placa para abrirla con zoom, ventana y medición.</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginTop: 10 }}>
                    {imagenesDelEstudio.map((f, i) => (
                      <button
                        key={f.name}
                        onClick={() => setVisorIndex(i)}
                        title="Abrir en el visor radiológico"
                        style={{ display: 'block', padding: 0, background: '#0d1f38', borderRadius: 12, overflow: 'hidden', border: '2px solid var(--color-border)', cursor: 'zoom-in', transition: 'border-color 0.15s' }}
                      >
                        <img
                          src={authenticatedFileUrl(f.url, user.token)}
                          alt={f.name}
                          style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }}
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MENSAJES */}
          {tab === 'mensajes' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: 420 }}>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                {mensajes.length === 0 && (
                  <div className="empty-state" style={{ padding: '40px 20px' }}>
                    <div style={{ marginBottom: 10 }}><Icon name="message" size={40} color="#94a3b8" /></div>
                    <h4>No hay mensajes aún</h4>
                    <p>Use este canal para comunicarse directamente sobre este estudio.</p>
                  </div>
                )}
                {mensajes.map(m => {
                  const isMine = m.sender_id === user.id;
                  const isDeleted = !!m.eliminado_para_todos;
                  return (
                    <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', position: 'relative' }}>
                      <div style={{
                        maxWidth: '75%', padding: '10px 14px', position: 'relative',
                        borderRadius: isMine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        background: isMine ? 'linear-gradient(135deg,#1a66b3,#003366)' : '#f1f5f9',
                        color: isMine ? '#fff' : 'var(--color-text)',
                        boxShadow: isMine ? '0 2px 10px -2px rgba(0,51,102,0.4)' : 'none',
                      }}>
                        {/* Botón de opciones */}
                        {!isDeleted && (
                          <div style={{ position: 'absolute', top: 4, right: 6, zIndex: 10 }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); setActiveMenuId(prev => prev === m.id ? null : m.id); }}
                              style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 2, color: isMine ? 'rgba(255,255,255,0.7)' : 'var(--color-text-muted)', borderRadius: '50%' }}
                              title="Opciones de mensaje"
                            >
                              <Icon name="chevronDown" size={12} color="currentColor" />
                            </button>

                            {/* Dropdown */}
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
                                  onClick={() => { setConfirmDeleteMsg(m); setActiveMenuId(null); }}
                                  style={{ width: '100%', border: 0, background: 'transparent', padding: '6px 10px', textAlign: 'left', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444' }}
                                >
                                  <Icon name="trash" size={12} color="#ef4444" /> Eliminar
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {isDeleted ? (
                          <p style={{ margin: 0, fontSize: 12.5, fontStyle: 'italic', color: isMine ? 'rgba(255,255,255,0.75)' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            🚫 Este mensaje fue eliminado
                          </p>
                        ) : (
                          <p style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
                            {m.contenido}
                          </p>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3, padding: '0 4px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {m.sender_username} · {formatHora(m.created_at)}
                        {m.editado === 1 && !isDeleted && (
                          <span style={{ fontSize: 10, fontStyle: 'italic', opacity: 0.8 }}>(editado)</span>
                        )}
                      </span>
                    </div>
                  );
                })}
                <div ref={msgEndRef} />
              </div>

              {/* Banner de edición */}
              {editingMessage && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 12px', background: 'rgba(51,153,255,0.12)', borderTop: '1px solid var(--color-border)',
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
              {confirmDeleteMsg && (
                <div style={{
                  position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
                }} onClick={() => setConfirmDeleteMsg(null)}>
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
                        onClick={() => handleDeleteMessage(confirmDeleteMsg, 'mi')}
                        style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', justifyContent: 'center' }}
                      >
                        Eliminar para mí
                      </button>
                      {(confirmDeleteMsg.sender_id === user.id || user.role === 'SUPER_ADMIN') && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteMessage(confirmDeleteMsg, 'todos')}
                          style={{ justifyContent: 'center' }}
                        >
                          Eliminar para todos
                        </button>
                      )}
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setConfirmDeleteMsg(null)}
                        style={{ justifyContent: 'center', marginTop: 4 }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <textarea
                    ref={msgInputRef}
                    className="input"
                    placeholder="Escribe un mensaje... (Enter para enviar, Shift+Enter para nueva línea)"
                    value={nuevoMensaje}
                    onChange={e => setNuevoMensaje(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={2}
                    style={{ width: '100%', resize: 'none', fontSize: 13 }}
                  />
                  {emojiAbierto && (
                    <EmojiPicker
                      onClose={() => setEmojiAbierto(false)}
                      onSelect={(emoji) => setNuevoMensaje(prev => insertarEmoji(prev, emoji, msgInputRef.current))}
                    />
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setEmojiAbierto(v => !v)}
                  title="Insertar emoji"
                  aria-label="Insertar emoji"
                  style={{ alignSelf: 'flex-end', padding: '10px 12px', fontSize: 17, lineHeight: 1 }}
                >
                  <span aria-hidden="true">🙂</span>
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSendMessage}
                  disabled={sendingMsg || !nuevoMensaje.trim()}
                  style={{ alignSelf: 'flex-end', padding: '10px 18px', opacity: (!nuevoMensaje.trim() || sendingMsg) ? 0.5 : 1 }}
                >
                  Enviar
                </button>
              </div>
            </div>
          )}

          {/* ENVIOS */}
          {tab === 'envios' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
                Trazabilidad de envíos del diagnóstico. Cada vez que el radiólogo envía o actualiza el informe se registra aquí, sin duplicar el estudio.
              </p>
              {envios.map(env => (
                <div key={env.id} className="card-flat" style={{ padding: '14px 16px', margin: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span className="badge badge-blue">Intento #{env.numero_intento}</span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{env.sender_username} · {formatFechaHora(env.fecha_envio)}</span>
                    <span style={{ marginLeft: 'auto' }} className={`badge ${env.calificacion === 'Aceptado' ? 'badge-green' : 'badge-gray'}`}>
                      {env.calificacion}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--color-text)', whiteSpace: 'pre-wrap', fontFamily: '"Times New Roman", Times, serif', lineHeight: 1.6 }}>{env.contenido}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <div className="flex-1" />
          {hasDiagnostico && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowInforme(true)}
              style={{ gap: 5 }}
            >
              <Icon name="eye" size={13} color="#fff" /> Ver informe
            </button>
          )}
          <button
            className="btn btn-ghost"
            onClick={async () => {
              try {
                await downloadAuthenticatedFile(`/api/estudios/${estudio.id}/export`, user.token, `${estudio.nombre}_${estudio.registro_id}.zip`);
              } catch (error) {
                addNotification('No se pudo descargar', error.message, 'error');
              }
            }}
            style={{ gap: 5 }}
          >
            <Icon name="download" size={13} /> Descargar ZIP
          </button>

          {isEncargado && (
            <button
              className="btn btn-info"
              disabled={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  const res = await fetch(`${API_URL}/api/estudios/${estudio.id}/export-desktop`, {
                    method: 'POST',
                    headers,
                  });
                  const d = await res.json();
                  addNotification(
                    d.success ? 'Carpeta exportada' : 'Error al exportar',
                    d.success ? 'La carpeta del paciente se copió al escritorio.' : (d.error || 'No se pudo exportar'),
                    d.success ? 'success' : 'error'
                  );
                } catch { addNotification('Error de conexión', 'No se pudo conectar con el servidor', 'error'); }
                finally { setExporting(false); }
              }}
              style={{ gap: 5 }}
            >
              {exporting
                ? <><div className="spinner" style={{ width: 13, height: 13 }} /> Exportando...</>
                : <><Icon name="desktop" size={13} /> Escritorio</>}
            </button>
          )}

          {isEncargado && (estudio.estado === 'Devuelta por revisión' || estudio.estado === 'Pendiente de enviar al radiólogo') && (
            <button
              className="btn btn-primary"
              onClick={handleReenviarRadiologo}
              disabled={submittingReenvio}
              style={{ gap: 5 }}
            >
              {submittingReenvio ? (
                <><div className="spinner" style={{ width: 13, height: 13 }} /> Reenviando...</>
              ) : (
                <><Icon name="send" size={13} color="#fff" /> Reenviar al radiólogo</>
              )}
            </button>
          )}

          {isEncargado && hasDiagnostico && estudio.estado === 'Diagnóstico recibido' && !showDevolver && (
            <button className="btn btn-danger" onClick={() => setShowDevolver(true)} style={{ gap: 5 }}>
              <Icon name="return" size={13} /> Devolver
            </button>
          )}

          {isEncargado && (
            <button className="btn btn-danger" onClick={handleDeleteStudy} disabled={deleting} style={{ gap: 5 }}>
              {deleting ? <div className="spinner" style={{ width: 13, height: 13 }} /> : <Icon name="trash" size={13} />}
              {deleting ? 'Eliminando...' : 'Eliminar estudio'}
            </button>
          )}

          <button onClick={onClose} className="btn btn-ghost">Cerrar</button>
        </div>

        {/* Devolver inline */}
        {showDevolver && (
          <div style={{ padding: '16px 24px', borderTop: '2px solid #f43f5e', background: 'var(--color-danger-bg)' }}>
            <strong style={{ fontSize: 13, color: '#9f1239' }}>Nota para el radiólogo (corrección solicitada):</strong>
            <textarea
              className="input"
              placeholder="Explique qué debe corregirse..."
              value={notaRevision}
              onChange={e => setNotaRevision(e.target.value)}
              rows={3}
              style={{ marginTop: 8, marginBottom: 10, resize: 'none' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowDevolver(false)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleDevolver} style={{ gap: 5 }}>
                <Icon name="return" size={13} /> Confirmar devolución
              </button>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Visor radiológico a pantalla completa */}
    {visorIndex !== null && imagenesDelEstudio[visorIndex] && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(3,10,20,0.98)', display: 'flex', flexDirection: 'column' }}>
        <header style={{ height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', background: 'linear-gradient(90deg, #003366, #0a4d8c)', color: '#fff' }}>
          <Icon name="bone" size={16} color="#fff" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {estudio.nombre} · {estudio.tipo_estudio}
            </div>
            <div style={{ fontSize: 10.5, opacity: 0.75 }}>
              <span className="mono">{estudio.registro_id}</span> · {imagenesDelEstudio[visorIndex].name}
            </div>
          </div>
          <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', gap: 5 }} onClick={() => setVisorIndex(null)}>
            <Icon name="close" size={13} color="#fff" /> Cerrar visor
          </button>
        </header>
        <PacsViewer
          key={imagenesDelEstudio[visorIndex].name}
          imageUrl={authenticatedFileUrl(imagenesDelEstudio[visorIndex].url, user.token)}
          imageName={imagenesDelEstudio[visorIndex].name}
          index={visorIndex}
          total={imagenesDelEstudio.length}
          onDownload={() => handleDownloadFile(imagenesDelEstudio[visorIndex])}
          onPrevious={() => setVisorIndex(i => Math.max(0, i - 1))}
          onNext={() => setVisorIndex(i => Math.min(imagenesDelEstudio.length - 1, i + 1))}
        />
      </div>
    )}

    <Suspense fallback={null}>
    {showInforme && (
      <InformeViewer
        estudio={estudio}
        userRole={userRole}
        onClose={() => setShowInforme(false)}
        onSaved={() => { setShowInforme(false); reloadEstudio(); }}
      />
    )}
    </Suspense>

    {/* ── ConfirmDialog: reemplaza window.confirm y window.alert ── */}
    {confirmDialog && (
      <ConfirmDialog
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmLabel={confirmDialog.confirmLabel}
        cancelLabel={confirmDialog.cancelLabel}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(null)}
      />
    )}
    </>
  );
};

const InfoField = ({ label, value }) => (
  <div>
    <p style={{ fontSize: 10.5, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, fontWeight: 700 }}>{label}</p>
    <p style={{ fontSize: 14, color: 'var(--color-text)', fontWeight: 500 }}>{value || '—'}</p>
  </div>
);

export default StudyDetailModal;
