import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import Icon from './Icons';
import { API_URL } from '../config';
import ConfirmDialog from './ConfirmDialog';


const ROLE_LABELS = {
  ENCARGADO: 'Administrativo / Encargado',
  RADIOLOGO: 'Médico Radiólogo',
  SUPER_ADMIN: 'Super Administrador',
};

const AdminPanel = ({ onClose }) => {
  const { user } = useContext(AuthContext);
  const [tab, setTab] = useState('usuarios');
  const [usuarios, setUsuarios] = useState([]);
  const [auditoria, setAuditoria] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [config, setConfig] = useState(null);
  const [configSaved, setConfigSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [audFiltros, setAudFiltros] = useState({ q: '', accion: '', usuario: '', desde: '', hasta: '' });
  const [accionesSet, setAccionesSet] = useState(new Set());

  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'RADIOLOGO', pregunta_seguridad: '¿Cuál fue tu primera mascota?', respuesta_seguridad: '' });
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ username: '', role: '' });
  const [tplForm, setTplForm] = useState({ label: '', texto: '', categoria: 'General' });
  const [editingTpl, setEditingTpl] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const headers = { Authorization: `Bearer ${user.token}` };

  const loadUsuarios = useCallback(() => {
    fetch(`${API_URL}/api/usuarios`, { headers })
      .then(r => r.json())
      .then(d => Array.isArray(d) && setUsuarios(d))
      .catch(() => {});
  }, [user.token]);

  const loadAuditoria = useCallback(() => {
    setLoading(true);
    fetch(`${API_URL}/api/auditoria?limit=200`, { headers })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setAuditoria(d);
          // Acumular acciones distintas (para que el filtro no se encoja con los resultados)
          setAccionesSet(prev => new Set([...prev, ...d.map(a => a.accion)]));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user.token]);

  const loadPlantillas = useCallback(() => {
    fetch(`${API_URL}/api/plantillas`, { headers })
      .then(r => r.json())
      .then(d => Array.isArray(d) && setPlantillas(d))
      .catch(() => {});
  }, [user.token]);

  const loadConfig = useCallback(() => {
    fetch(`${API_URL}/api/config`, { headers })
      .then(r => r.json())
      .then(d => d && typeof d === 'object' && setConfig(d))
      .catch(() => {});
  }, [user.token]);

  useEffect(() => { loadUsuarios(); }, [loadUsuarios]);
  useEffect(() => { if (tab === 'auditoria') loadAuditoria(); }, [tab, loadAuditoria]);
  useEffect(() => { if (tab === 'plantillas') loadPlantillas(); }, [tab, loadPlantillas]);
  useEffect(() => { if (tab === 'parametros') { loadConfig(); setConfigSaved(false); } }, [tab, loadConfig]);

  // Cerrar con tecla Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      const d = await res.json();
      if (d.success) {
        setNewUser({ username: '', password: '', role: 'RADIOLOGO', pregunta_seguridad: '¿Cuál fue tu primera mascota?', respuesta_seguridad: '' });
        loadUsuarios();
      } else setError(d.error || 'Error al crear el usuario');
    } catch { setError('Error de conexión'); }
  };

  const handleToggleActivo = async (u) => {
    await fetch(`${API_URL}/api/usuarios/${u.id}/activo`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: u.activo === 1 ? 0 : 1 }),
    });
    loadUsuarios();
  };

  const handleResetPassword = async () => {
    if (resetPassword.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres');
      return;
    }
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/usuarios/${resetTarget.id}/password`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: resetPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'No se pudo cambiar la contraseña');
        return;
      }
      setResetTarget(null);
      setResetPassword('');
    } catch {
      setError('Error de conexión');
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    if (!editForm.username.trim() || !editForm.role) return;
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/usuarios/${editTarget.id}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const d = await res.json();
      if (d.success) {
        setEditTarget(null);
        loadUsuarios();
      } else {
        setError(d.error || 'Error al editar usuario');
      }
    } catch {
      setError('Error de conexión');
    }
  };

  const handleSavePlantilla = async (e) => {
    e.preventDefault();
    if (!tplForm.label.trim() || !tplForm.texto.trim()) return;
    const url = editingTpl ? `${API_URL}/api/plantillas/${editingTpl.id}` : `${API_URL}/api/plantillas`;
    await fetch(url, {
      method: editingTpl ? 'PUT' : 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(tplForm),
    });
    setTplForm({ label: '', texto: '', categoria: 'General' });
    setEditingTpl(null);
    loadPlantillas();
  };

  const handleDeletePlantilla = async (id) => {
    setConfirmDialog({
      title: 'Eliminar plantilla',
      message: '¿Eliminar esta plantilla de diagnóstico? No se puede deshacer.',
      variant: 'danger',
      confirmLabel: 'Eliminar',
      onConfirm: async () => {
        await fetch(`${API_URL}/api/plantillas/${id}`, { method: 'DELETE', headers });
        loadPlantillas();
      },
    });
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/api/config`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const d = await res.json();
    if (d.success) { setConfig(d.config); setConfigSaved(true); }
    else setError(d.error || 'Error al guardar');
  };

  const aplicarAudFiltros = () => {
    const params = new URLSearchParams({ limit: '300' });
    if (audFiltros.q) params.set('q', audFiltros.q);
    if (audFiltros.accion) params.set('accion', audFiltros.accion);
    if (audFiltros.usuario) params.set('usuario', audFiltros.usuario);
    if (audFiltros.desde) params.set('desde', audFiltros.desde);
    if (audFiltros.hasta) params.set('hasta', audFiltros.hasta);
    setLoading(true);
    fetch(`${API_URL}/api/auditoria?${params}`, { headers })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setAuditoria(d);
          setAccionesSet(prev => new Set([...prev, ...d.map(a => a.accion)]));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const exportarAuditoria = () => {
    const escapar = (valor) => `"${String(valor ?? '').replace(/"/g, '""')}"`;
    const filas = auditoria.map(a => [
      a.created_at, a.usuario_nombre, a.rol, a.accion, a.detalle, a.estudio_id ?? '',
    ].map(escapar).join(','));
    const csv = [
      ['Fecha', 'Usuario', 'Rol', 'Acción', 'Detalle', 'Estudio'].map(escapar).join(','),
      ...filas,
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Acciones distintas registradas (acumuladas, para que el filtro no se encoja)
  const accionesDistintas = [...accionesSet].sort();

  return (
    <>
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 3000 }}>
      <div className="modal" style={{ maxWidth: 1000 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="flex-1">
            <h3 style={{ margin: 0, fontSize: 17, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="shield" size={18} color="var(--color-primary)" /> Panel de Super Administrador
            </h3>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>Modo Fantasma activo — tu cuenta es invisible para el resto del sistema</p>
          </div>
          <button className="modal-close" onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="tabs" style={{ padding: '0 24px' }}>
          {[
            { id: 'usuarios', icon: 'users', label: 'Usuarios' },
            { id: 'auditoria', icon: 'clipboard', label: 'Auditoría' },
            { id: 'plantillas', icon: 'fileText', label: 'Plantillas' },
            { id: 'parametros', icon: 'settings', label: 'Parámetros' },
          ].map(t => (
            <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon name={t.icon} size={13} /> {t.label}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {error && (
            <div className="alert alert-danger">
              <span>⚠️</span><span>{error}</span>
            </div>
          )}

          {/* USUARIOS */}
          {tab === 'usuarios' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 24 }}>
              <form onSubmit={handleCreateUser} className="card-flat" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 18, margin: 0, height: 'fit-content' }}>
                <div className="section-title" style={{ marginBottom: 2 }}>Crear nuevo usuario</div>
                <div>
                  <label className="field-label">Usuario</label>
                  <input className="input" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} required />
                </div>
                <div>
                  <label className="field-label">Contraseña</label>
                  <input type="password" className="input" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} required />
                </div>
                <div>
                  <label className="field-label">Rol</label>
                  <select className="input" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                    <option value="RADIOLOGO">Médico Radiólogo</option>
                    <option value="ENCARGADO">Administrativo / Encargado</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Pregunta de seguridad</label>
                  <select className="input" value={newUser.pregunta_seguridad} onChange={e => setNewUser({ ...newUser, pregunta_seguridad: e.target.value })}>
                    <option value="¿Cuál fue tu primera mascota?">¿Cuál fue tu primera mascota?</option>
                    <option value="¿En qué ciudad nació tu madre?">¿En qué ciudad nació tu madre?</option>
                    <option value="¿Cuál es el nombre de tu escuela primaria?">¿Cuál es el nombre de tu escuela primaria?</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Respuesta de seguridad</label>
                  <input className="input" value={newUser.respuesta_seguridad} onChange={e => setNewUser({ ...newUser, respuesta_seguridad: e.target.value })} required />
                </div>
                <button type="submit" className="btn btn-primary">Crear cuenta</button>
              </form>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {usuarios.length === 0 && <p className="text-muted" style={{ fontSize: 13 }}>No hay usuarios.</p>}
                {usuarios.map(u => (
                  <div key={u.id} className="card-flat" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', margin: 0 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: u.role === 'SUPER_ADMIN' ? '#f3e8ff' : u.role === 'RADIOLOGO' ? '#eff6ff' : '#fffbeb',
                    }}>
                      <Icon name={u.role === 'SUPER_ADMIN' ? 'shield' : u.role === 'RADIOLOGO' ? 'microscope' : 'clipboard'} size={16} color={u.role === 'SUPER_ADMIN' ? '#7e22ce' : u.role === 'RADIOLOGO' ? '#1a66b3' : '#b45309'} />
                    </div>
                    <div className="flex-1">
                      <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>{u.username}</p>
                      <p style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>{ROLE_LABELS[u.role] || u.role}</p>
                    </div>
                    <span className={`badge ${u.activo === 1 ? 'badge-green' : 'badge-red'}`}>
                      {u.activo === 1 ? 'Activo' : 'Desactivado'}
                    </span>
                    <button className="btn btn-ghost btn-xs" onClick={() => { setEditTarget(u); setEditForm({ username: u.username, role: u.role }); }} style={{ gap: 4 }}>
                      <Icon name="edit" size={11} /> Editar
                    </button>
                    <button className="btn btn-ghost btn-xs" onClick={() => { setResetTarget(u); setResetPassword(''); }} style={{ gap: 4 }}>
                      <Icon name="key" size={11} /> Reset
                    </button>
                    <button className={`btn btn-xs ${u.activo === 1 ? 'btn-danger' : 'btn-success'}`} onClick={() => handleToggleActivo(u)}>
                      {u.activo === 1 ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AUDITORÍA */}
          {tab === 'auditoria' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="card-flat" style={{ padding: 14, margin: 0, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
                <div>
                  <label className="field-label">Buscar</label>
                  <input className="input" placeholder="Texto libre (usuario, acción, detalle)..." value={audFiltros.q}
                    onChange={e => setAudFiltros(f => ({ ...f, q: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && aplicarAudFiltros()} />
                </div>
                <div>
                  <label className="field-label">Acción</label>
                  <select className="input" value={audFiltros.accion} onChange={e => setAudFiltros(f => ({ ...f, accion: e.target.value }))}>
                    <option value="">Todas</option>
                    {accionesDistintas.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Usuario</label>
                  <input className="input" placeholder="Usuario..." value={audFiltros.usuario} onChange={e => setAudFiltros(f => ({ ...f, usuario: e.target.value }))} />
                </div>
                <div>
                  <label className="field-label">Desde</label>
                  <input type="date" className="input" value={audFiltros.desde} onChange={e => setAudFiltros(f => ({ ...f, desde: e.target.value }))} />
                </div>
                <div>
                  <label className="field-label">Hasta</label>
                  <input type="date" className="input" value={audFiltros.hasta} onChange={e => setAudFiltros(f => ({ ...f, hasta: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={aplicarAudFiltros}>Filtrar</button>
                  <button
                    className="btn btn-ghost"
                    onClick={exportarAuditoria}
                    disabled={auditoria.length === 0}
                    title="Descargar los eventos visibles en CSV"
                  >
                    CSV
                  </button>
                </div>
              </div>

              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                  <div className="spinner" />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {auditoria.length === 0 && <p className="text-muted" style={{ fontSize: 13 }}>Sin eventos que coincidan con los filtros.</p>}
                  {auditoria.map(a => (
                    <div key={a.id} className="card-flat" style={{ display: 'flex', gap: 12, padding: '10px 14px', margin: 0, alignItems: 'center' }}>
                      <span className="mono text-xs" style={{ color: 'var(--color-text-muted)', flexShrink: 0, fontSize: 10.5 }}>{a.created_at?.replace('T', ' ').slice(0, 16)}</span>
                      <span className="badge badge-blue" style={{ flexShrink: 0, fontSize: 10.5 }}>{a.accion}</span>
                      <span className="text-sm" style={{ color: 'var(--color-text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.detalle}</span>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>{a.usuario_nombre} ({a.rol})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PARÁMETROS DEL SISTEMA */}
          {tab === 'parametros' && (
            <div style={{ maxWidth: 640 }}>
              {configSaved && (
                <div className="alert alert-success" style={{ marginBottom: 16, gap: 8, alignItems: 'center' }}>
                  <Icon name="checkCircle" size={14} color="#15803d" />
                  <span>Parámetros guardados. El membrete de los informes y la interfaz se actualizan de inmediato.</span>
                </div>
              )}
              {!config ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
              ) : (
                <form onSubmit={handleSaveConfig} className="card-flat" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 20, margin: 0 }}>
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                      Estos datos aparecen en el membrete de los informes Word, en la estación de lectura y en la marca del sistema. Son privados y solo el Super Administrador puede modificarlos.
                    </p>
                  </div>
                  <div>
                    <label className="field-label" htmlFor="cfg-nombre">Nombre del centro radiológico</label>
                    <input id="cfg-nombre" className="input" value={config.centro_nombre || ''} onChange={e => setConfig({ ...config, centro_nombre: e.target.value })} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label className="field-label" htmlFor="cfg-dir">Dirección</label>
                      <input id="cfg-dir" className="input" value={config.centro_direccion || ''} onChange={e => setConfig({ ...config, centro_direccion: e.target.value })} />
                    </div>
                    <div>
                      <label className="field-label" htmlFor="cfg-tel">Teléfono</label>
                      <input id="cfg-tel" className="input" value={config.centro_telefono || ''} onChange={e => setConfig({ ...config, centro_telefono: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="field-label" htmlFor="cfg-email">Correo institucional</label>
                    <input id="cfg-email" className="input" value={config.centro_email || ''} onChange={e => setConfig({ ...config, centro_email: e.target.value })} />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="cfg-pie">Pie de página del informe (leyenda legal)</label>
                    <textarea id="cfg-pie" className="input" rows={3} value={config.informe_pie || ''} onChange={e => setConfig({ ...config, informe_pie: e.target.value })} style={{ resize: 'vertical', fontSize: 12.5 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="submit" className="btn btn-primary" style={{ gap: 5 }}>
                      <Icon name="checkCircle" size={13} color="#fff" /> Guardar parámetros
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={loadConfig}>Descartar cambios</button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* PLANTILLAS */}
          {tab === 'plantillas' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 24 }}>
              <form onSubmit={handleSavePlantilla} className="card-flat" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 18, margin: 0, height: 'fit-content' }}>
                <div className="section-title" style={{ marginBottom: 2 }}>
                  {editingTpl ? 'Editar plantilla' : 'Nueva plantilla de diagnóstico'}
                </div>
                <div>
                  <label className="field-label">Etiqueta (ej. "Tórax normal")</label>
                  <input className="input" value={tplForm.label} onChange={e => setTplForm({ ...tplForm, label: e.target.value })} required />
                </div>
                <div>
                  <label className="field-label">Categoría</label>
                  <input
                    className="input"
                    list="categorias-plantilla"
                    value={tplForm.categoria}
                    onChange={e => setTplForm({ ...tplForm, categoria: e.target.value })}
                    placeholder="General"
                  />
                  <datalist id="categorias-plantilla">
                    {['General', 'Tórax', 'Columna', 'Abdomen', 'Extremidades', 'Cráneo', 'Obstetricia', 'Pediátrica'].map(c => <option key={c} value={c} />)}
                  </datalist>
                  <span style={{ display: 'block', fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 4 }}>
                    El radiólogo puede filtrar las plantillas por esta categoría.
                  </span>
                </div>
                <div>
                  <label className="field-label">Texto del informe</label>
                  <textarea className="input" rows={8} value={tplForm.texto} onChange={e => setTplForm({ ...tplForm, texto: e.target.value })} required style={{ resize: 'vertical', fontFamily: '"Times New Roman", Times, serif' }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{editingTpl ? 'Guardar cambios' : 'Crear plantilla'}</button>
                  {editingTpl && (
                    <button type="button" className="btn btn-ghost" onClick={() => { setEditingTpl(null); setTplForm({ label: '', texto: '', categoria: 'General' }); }}>Cancelar</button>
                  )}
                </div>
              </form>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {plantillas.length === 0 && <p className="text-muted" style={{ fontSize: 13 }}>Aún no hay plantillas personalizadas.</p>}
                {plantillas.map(t => (
                  <div key={t.id} className="card-flat" style={{ padding: '12px 14px', margin: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <strong style={{ fontSize: 13, color: 'var(--color-text)', flex: 1 }}>{t.label}</strong>
                      <span className="badge badge-blue" style={{ fontSize: 10 }}>{t.categoria || 'General'}</span>
                      <button className="btn btn-info btn-xs" onClick={() => { setEditingTpl(t); setTplForm({ label: t.label, texto: t.texto, categoria: t.categoria || 'General' }); }}>
                        Editar
                      </button>
                      <button className="btn btn-danger btn-xs" onClick={() => handleDeletePlantilla(t.id)}>
                        Eliminar
                      </button>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', maxHeight: 90, overflow: 'hidden', lineHeight: 1.5 }}>{t.texto}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reset password modal */}
      {resetTarget && (
        <div className="modal-backdrop" style={{ zIndex: 3100, background: 'rgba(11,19,34,0.5)' }} onClick={() => setResetTarget(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <strong style={{ fontSize: 15, color: 'var(--color-text)', flex: 1 }}>Resetear contraseña — {resetTarget.username}</strong>
              <button className="modal-close" onClick={() => setResetTarget(null)}>×</button>
            </div>
            <div className="modal-body">
              <label className="field-label">Nueva contraseña</label>
              <input type="password" className="input" placeholder="Nueva contraseña (mínimo 4 caracteres)" value={resetPassword} onChange={e => setResetPassword(e.target.value)} minLength={4} autoFocus />
            </div>
            <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setResetTarget(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleResetPassword} disabled={resetPassword.length < 4}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editTarget && (
        <div className="modal-backdrop" style={{ zIndex: 3100, background: 'rgba(11,19,34,0.5)' }} onClick={() => setEditTarget(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <form onSubmit={handleEditUser}>
              <div className="modal-header">
                <strong style={{ fontSize: 15, color: 'var(--color-text)', flex: 1 }}>Editar Usuario</strong>
                <button type="button" className="modal-close" onClick={() => setEditTarget(null)}>×</button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="field-label">Nombre de usuario</label>
                  <input className="input" value={editForm.username} onChange={e => setEditForm({ ...editForm, username: e.target.value })} required />
                </div>
                <div>
                  <label className="field-label">Rol</label>
                  <select className="input" value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                    <option value="RADIOLOGO">Médico Radiólogo</option>
                    <option value="ENCARGADO">Administrativo / Encargado</option>
                    <option value="SUPER_ADMIN">Super Administrador</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setEditTarget(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={!editForm.username.trim()}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>

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

export default AdminPanel;
