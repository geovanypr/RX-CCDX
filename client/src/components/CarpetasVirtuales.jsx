import React, { useState, useEffect, useContext, useCallback, Suspense, lazy, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext';
import Icon from './Icons';
import { API_URL, authenticatedFileUrl, downloadAuthenticatedFile } from '../config';
import { sexoLabel } from '../utils/format';
import { ESTADO_COLORS, getEstadoColors } from '../utils/constants';

// Se carga solo cuando el usuario abre un informe.
const InformeViewer = lazy(() => import('./InformeViewer'));


// ESTADO_COLORS importado desde utils/constants.js

const CarpetasVirtuales = ({ userRole, onOpenStudy, onNewStudy }) => {
  const { user } = useContext(AuthContext);
  const [carpetas, setCarpetas] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);      // paciente seleccionado
  const [detalle, setDetalle] = useState(null);         // { paciente, estudios, archivos }
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [informeEstudio, setInformeEstudio] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [descargandoPlacas, setDescargandoPlacas] = useState(false);
  const [folderAction, setFolderAction] = useState(null);
  // Modal de confirmación (reemplaza window.confirm)
  const [confirmDialog, setConfirmDialog] = useState(null);
  // Modal de edición de nombre (reemplaza window.prompt)
  const [editDialog, setEditDialog] = useState(null); // { folder, nombre }
  // Historial de paciente
  const [historial, setHistorial] = useState([]);
  const [historialPage, setHistorialPage] = useState(1);
  const [historialPages, setHistorialPages] = useState(1);
  const [historialTotal, setHistorialTotal] = useState(0);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [borrandoHistorial, setBorrandoHistorial] = useState(false);

  const headers = useMemo(() => ({ Authorization: `Bearer ${user.token}` }), [user.token]);
  const LIMIT = 20;

  const loadHistorial = useCallback((pacienteId, p = 1) => {
    setHistorialLoading(true);
    fetch(`${API_URL}/api/pacientes/${pacienteId}/historial?page=${p}&limit=10`, { headers })
      .then(r => r.json())
      .then(d => {
        if (d && Array.isArray(d.historial)) {
          setHistorial(d.historial);
          setHistorialPage(d.page || 1);
          setHistorialPages(d.pages || 1);
          setHistorialTotal(d.total || 0);
        }
      })
      .catch(() => {})
      .finally(() => setHistorialLoading(false));
  }, [headers]);

  const fetchCarpetas = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: LIMIT });
    if (q.trim()) params.set('q', q.trim());
    fetch(`${API_URL}/api/carpetas?${params}`, { headers })
      .then(r => r.json())
      .then(d => {
        setCarpetas(d.carpetas || []);
        setTotal(d.total || 0);
        setPages(d.pages || 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, q, user.token]);

  useEffect(() => { fetchCarpetas(); }, [fetchCarpetas]);

  const openDetalle = (paciente) => {
    setSelected(paciente);
    setLoadingDetalle(true);
    fetch(`${API_URL}/api/carpetas/${paciente.id}`, { headers })
      .then(r => r.json())
      .then(d => setDetalle(d))
      .catch(() => setDetalle(null))
      .finally(() => setLoadingDetalle(false));
    loadHistorial(paciente.id, 1);
  };

  const handleClearHistorial = () => {
    if (!selected) return;
    setConfirmDialog({
      title: 'Borrar historial de acciones',
      message: `¿Eliminar permanentemente todo el historial de acciones de "${selected.nombre}"? Esta acción no se puede deshacer.`,
      variant: 'danger',
      onConfirm: async () => {
        setBorrandoHistorial(true);
        try {
          const res = await fetch(`${API_URL}/api/pacientes/${selected.id}/historial`, { method: 'DELETE', headers });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo borrar el historial');
          loadHistorial(selected.id, 1);
        } catch (error) {
          console.error('[CarpetasVirtuales]', error.message);
        } finally {
          setBorrandoHistorial(false);
        }
      },
    });
  };

  const handleDeleteHistorialItem = (historiaId) => {
    if (!selected) return;
    setConfirmDialog({
      title: 'Eliminar evento del historial',
      message: '¿Deseas eliminar este registro específico del historial del paciente?',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_URL}/api/pacientes/${selected.id}/historial/${historiaId}`, { method: 'DELETE', headers });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo eliminar la entrada');
          loadHistorial(selected.id, historialPage);
        } catch (error) {
          console.error('[CarpetasVirtuales]', error.message);
        }
      },
    });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchCarpetas();
  };

  const handleEditFolder = (folder) => {
    // Abre el modal de edición en lugar de window.prompt
    setEditDialog({ folder, nombre: folder.nombre });
  };

  const commitEditFolder = async () => {
    if (!editDialog) return;
    const { folder, nombre } = editDialog;
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio || nombreLimpio === folder.nombre) { setEditDialog(null); return; }
    setFolderAction(folder.id);
    setEditDialog(null);
    try {
      const response = await fetch(`${API_URL}/api/pacientes/${folder.id}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombreLimpio }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo modificar la carpeta');
      fetchCarpetas();
      if (selected?.id === folder.id) openDetalle({ ...folder, nombre: nombreLimpio });
    } catch (error) {
      // Notificar sin alert nativo
      console.error('[CarpetasVirtuales]', error.message);
    }
    finally { setFolderAction(null); }
  };

  const handleDeleteFolder = (folder) => {
    setConfirmDialog({
      title: 'Eliminar expediente',
      message: `¿Eliminar el expediente de "${folder.nombre}"? Se borrarán todos sus estudios, mensajes y archivos. Esta acción no se puede deshacer.`,
      variant: 'danger',
      onConfirm: async () => {
        setFolderAction(folder.id);
        try {
          const response = await fetch(`${API_URL}/api/pacientes/${folder.id}`, { method: 'DELETE', headers });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'No se pudo eliminar la carpeta');
          if (selected?.id === folder.id) { setSelected(null); setDetalle(null); }
          fetchCarpetas();
        } catch (error) {
          console.error('[CarpetasVirtuales]', error.message);
        }
        finally { setFolderAction(null); }
      },
    });
  };

  const handleDownloadCarpeta = async (pacienteId) => {
    setDownloading(true);
    try {
      await downloadAuthenticatedFile(`/api/carpetas/${pacienteId}/download`, user.token, `${selected.nombre}_${selected.registro_id}_expediente.zip`);
    } catch (error) {
      console.error('[CarpetasVirtuales] descarga carpeta:', error.message);
    } finally {
      setDownloading(false);
    }
  };

  // Descarga solo las radiografías del expediente (ZIP), sin informes ni documentos
  const handleDownloadRadiografias = async (pacienteId) => {
    setDescargandoPlacas(true);
    try {
      await downloadAuthenticatedFile(`/api/pacientes/${pacienteId}/radiografias/download`, user.token, `placas_${selected.nombre}_${selected.registro_id}.zip`);
    } catch (error) {
      console.error('[CarpetasVirtuales] descarga radiografías:', error.message);
    } finally {
      setDescargandoPlacas(false);
    }
  };

  // Descarga individual: el atributo HTML "download" no funciona entre orígenes (5173 vs 3002)
  const handleDownloadArchivo = async (archivo) => {
    if (!selected) return;
    try {
      await downloadAuthenticatedFile(`/api/pacientes/${selected.id}/archivos/${encodeURIComponent(archivo.name)}/download`, user.token, archivo.name);
    } catch (error) {
      console.error('[CarpetasVirtuales] descarga archivo:', error.message);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const images = detalle?.archivos?.filter(f => f.isImage) || [];
  const docs = detalle?.archivos?.filter(f => f.isDoc) || [];
  const others = detalle?.archivos?.filter(f => !f.isImage && !f.isDoc) || [];

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* ===== Lista de carpetas ===== */}
      <div style={{ width: 340, flexShrink: 0, borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', background: '#fff' }}>
        {/* Búsqueda */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}>
                <Icon name="search" size={14} color="var(--color-text-muted)" />
              </div>
              <input
                className="input"
                style={{ paddingLeft: 32, fontSize: 13 }}
                placeholder="Buscar paciente o registro..."
                value={q}
                onChange={e => { setQ(e.target.value); if (!e.target.value.trim()) { setPage(1); } }}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-sm">Buscar</button>
          </form>
          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
            {total} carpeta{total !== 1 ? 's' : ''} · página {page} de {pages}
          </p>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
          ) : carpetas.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <div style={{ marginBottom: 10 }}><Icon name="folder" size={40} color="#94a3b8" /></div>
              <h4>Sin carpetas</h4>
              <p>Registre pacientes para que aparezcan aquí.</p>
            </div>
          ) : carpetas.map(c => {
            const isActive = selected?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => openDetalle(c)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%', textAlign: 'left',
                  padding: '13px 16px', border: 'none', borderBottom: '1px solid #f1f5f9',
                  background: isActive ? '#eff6ff' : '#fff', cursor: 'pointer',
                  transition: 'background 0.12s ease', borderLeft: isActive ? '3px solid var(--color-secondary)' : '3px solid transparent',
                }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: isActive ? 'linear-gradient(135deg,#dbeafe,#bfdbfe)' : 'linear-gradient(135deg,#f1f5f9,#e2e8f0)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="folder" size={18} color={isActive ? '#1d4ed8' : '#64748b'} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: isActive ? 'var(--color-primary)' : 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.nombre}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                    {c.registro_id}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>{c.edad} años · {c.sexo === 'F' ? 'F' : 'M'}</span>
                    <span style={{ fontSize: 10.5, color: '#64748b' }}>{c.total_estudios} estudio{c.total_estudios !== 1 ? 's' : ''}</span>
                    {c.en_proceso > 0 && (
                      <span style={{ fontSize: 10, background: '#fff7ed', color: '#c2410c', padding: '1px 6px', borderRadius: 999, fontWeight: 700 }}>
                        {c.en_proceso} en proceso
                      </span>
                    )}
                  </div>
                </div>
                {userRole !== 'RADIOLOGO' && (
                  <span style={{ display: 'flex', gap: 3 }} onClick={event => event.stopPropagation()}>
                    <button className="btn btn-ghost btn-xs" title="Modificar carpeta" onClick={() => handleEditFolder(c)} disabled={folderAction === c.id} style={{ padding: 5 }}>
                      <Icon name="edit" size={13} color="#2563eb" />
                    </button>
                    <button className="btn btn-ghost btn-xs" title="Eliminar carpeta" onClick={() => handleDeleteFolder(c)} disabled={folderAction === c.id} style={{ padding: 5 }}>
                      <Icon name="trash" size={13} color="#dc2626" />
                    </button>
                  </span>
                )}
                <Icon name="chevronRight" size={14} color={isActive ? 'var(--color-secondary)' : '#94a3b8'} />
              </button>
            );
          })}
        </div>

        {/* Paginación */}
        {pages > 1 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc' }}>
            <button
              className="btn btn-ghost btn-sm"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              style={{ padding: '6px 10px' }}
            >
              <Icon name="chevronLeft" size={14} />
            </button>
            <span style={{ flex: 1, textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}>
              {page} / {pages}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              disabled={page >= pages}
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              style={{ padding: '6px 10px' }}
            >
              <Icon name="chevronRight" size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ===== Detalle de carpeta ===== */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--color-bg)' }}>
        {!selected ? (
          <div className="empty-state" style={{ padding: '80px 24px' }}>
            <div style={{ marginBottom: 14 }}><Icon name="folderOpen" size={56} color="#94a3b8" /></div>
            <h4>Seleccione una carpeta</h4>
            <p>Haga clic en un paciente de la lista para ver su carpeta: estudios, radiografías e informes.</p>
          </div>
        ) : loadingDetalle ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>
        ) : detalle && (
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header del paciente */}
            <div className="card-flat" style={{ padding: 20, margin: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16, flexShrink: 0,
                  background: 'linear-gradient(135deg,#eff6ff,#dbeafe)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="user" size={26} color="#1a66b3" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                    <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>{detalle.paciente.nombre}</h3>
                    <span className="chip mono" style={{ fontSize: 11 }}>{detalle.paciente.registro_id}</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
                    {detalle.paciente.edad} años · {sexoLabel(detalle.paciente.sexo)}
                    {detalle.paciente.fecha_nacimiento ? ` · Nac. ${detalle.paciente.fecha_nacimiento}` : ''}
                  </p>
                  <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="file" size={12} color="var(--color-text-muted)" />
                      {detalle.estudios.length} estudio{detalle.estudios.length !== 1 ? 's' : ''}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="clip" size={12} color="var(--color-text-muted)" />
                      {detalle.archivos.length} archivo{detalle.archivos.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <button
                  className="btn btn-success btn-sm"
                  disabled={descargandoPlacas || images.length === 0}
                  onClick={() => handleDownloadRadiografias(selected.id)}
                  title="Descargar solo las radiografías del expediente"
                  style={{ gap: 6 }}
                >
                  {descargandoPlacas ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <Icon name="download" size={14} />}
                  {descargandoPlacas ? 'Preparando...' : `Radiografías (${images.length})`}
                </button>
                <button
                  className="btn btn-info btn-sm"
                  disabled={downloading}
                  onClick={() => handleDownloadCarpeta(selected.id)}
                  style={{ gap: 6 }}
                >
                  {downloading ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <Icon name="download" size={14} />}
                  {downloading ? 'Preparando ZIP...' : 'Descargar carpeta'}
                </button>
                {onNewStudy && (
                  <button className="btn btn-primary btn-sm" onClick={() => onNewStudy(detalle.paciente)} style={{ gap: 6 }}>
                    <Icon name="plus" size={14} /> Nuevo estudio
                  </button>
                )}
              </div>
            </div>

            {/* Radiografías / Imágenes */}
            {images.length > 0 && (
              <div className="card-flat" style={{ padding: 18, margin: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Icon name="image" size={15} color="var(--color-primary)" />
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)', flex: 1 }}>
                    Radiografías e Imágenes ({images.length})
                  </span>
                  <button
                    className="btn btn-success btn-xs"
                    disabled={descargandoPlacas}
                    onClick={() => handleDownloadRadiografias(selected.id)}
                    style={{ gap: 4 }}
                  >
                    <Icon name="download" size={11} /> ZIP
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                  {images.map(f => (
                    <div
                      key={f.name}
                      style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '2px solid var(--color-border)', cursor: 'zoom-in', aspectRatio: '1', background: '#0d1f38' }}
                      onClick={() => setLightbox(f)}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownloadArchivo(f); }}
                        title="Descargar esta radiografía"
                        style={{
                          position: 'absolute', top: 6, right: 6, zIndex: 3,
                          background: 'rgba(15,23,42,0.75)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff',
                          borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        }}
                      >
                        <Icon name="download" size={13} color="#fff" />
                      </button>
                      <img
                        src={authenticatedFileUrl(f.url, user.token)}
                        alt={f.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                        padding: '18px 8px 6px', display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        <Icon name="eye" size={11} color="#fff" />
                        <span style={{ fontSize: 10, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Informes y Documentos */}
            {docs.length > 0 && (
              <div className="card-flat" style={{ padding: 18, margin: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Icon name="fileText" size={15} color="var(--color-primary)" />
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>
                    Informes y Documentos ({docs.length})
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {docs.map(f => (
                    <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid var(--color-border)' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: f.isDoc && f.name.endsWith('.pdf') ? '#fef2f2' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="fileText" size={17} color={f.name.endsWith('.pdf') ? '#ef4444' : '#1a66b3'} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</p>
                        {f.size > 0 && <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>{formatBytes(f.size)}</p>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <a href={authenticatedFileUrl(f.url, user.token)} target="_blank" rel="noreferrer"
                          className="btn btn-info btn-xs" style={{ textDecoration: 'none', gap: 4 }}>
                          <Icon name="eye" size={11} /> Ver
                        </a>
                        <button onClick={() => handleDownloadArchivo(f)}
                          className="btn btn-ghost btn-xs" style={{ gap: 4 }}>
                          <Icon name="download" size={11} /> Bajar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Otros archivos */}
            {others.length > 0 && (
              <div className="card-flat" style={{ padding: 18, margin: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Icon name="clip" size={15} color="var(--color-primary)" />
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>
                    Otros archivos ({others.length})
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {others.map(f => (
                    <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: '#f8fafc', borderRadius: 9, border: '1px solid var(--color-border)' }}>
                      <Icon name="file" size={16} color="var(--color-text-muted)" />
                      <span style={{ flex: 1, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                      <button onClick={() => handleDownloadArchivo(f)}
                        className="btn btn-ghost btn-xs" style={{ gap: 4 }}>
                        <Icon name="download" size={11} /> Bajar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detalle.archivos.length === 0 && (
              <div className="card-flat" style={{ padding: 24, margin: 0 }}>
                <div className="empty-state" style={{ padding: '16px 0' }}>
                  <div style={{ marginBottom: 8 }}><Icon name="folder" size={32} color="#94a3b8" /></div>
                  <p>Carpeta vacía. Suba archivos desde el panel de comunicación.</p>
                </div>
              </div>
            )}

            {/* Historial de estudios */}
            {detalle.estudios.length > 0 && (
              <div className="card-flat" style={{ padding: 18, margin: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Icon name="clipboard" size={15} color="var(--color-primary)" />
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>
                    Historial de Estudios ({detalle.estudios.length})
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {detalle.estudios.map(e => {
                    const ec = ESTADO_COLORS[e.estado] || ESTADO_COLORS['Recibida'];
                    return (
                      <div key={e.id} style={{ padding: '14px 16px', background: '#f8fafc', borderRadius: 12, border: '1px solid var(--color-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--color-primary)' }}>{e.tipo_estudio}</span>
                          <span className="badge" style={{ background: ec.bg, color: ec.text, fontSize: 11 }}>
                            <span className="badge-dot" style={{ background: ec.dot }} />
                            {e.estado}
                          </span>
                          <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                            {e.fecha_estudio} · {e.medico_remitente}
                          </span>
                        </div>
                        {e.notas_clinicas && (
                          <p style={{ fontSize: 12, color: '#15803d', background: '#f0fdf4', padding: '6px 10px', borderRadius: 7, marginBottom: 8 }}>
                            {e.notas_clinicas}
                          </p>
                        )}
                        {e.diagnostico ? (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.65, fontFamily: '"Times New Roman", Times, serif', color: '#374151', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'hidden' }}>
                              {e.diagnostico}
                            </div>
                            <button
                              className="btn btn-primary btn-xs"
                              onClick={() => setInformeEstudio({ ...e, nombre: detalle.paciente.nombre, registro_id: detalle.paciente.registro_id, edad: detalle.paciente.edad })}
                              style={{ gap: 4, flexShrink: 0 }}
                            >
                              <Icon name="eye" size={11} /> Ver informe
                            </button>
                          </div>
                        ) : (
                          <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Sin diagnóstico emitido aún.</p>
                        )}
                        {onOpenStudy && (
                          <button
                            className="btn btn-secondary btn-xs"
                            onClick={() => onOpenStudy({ ...e, nombre: detalle.paciente.nombre, registro_id: detalle.paciente.registro_id, edad: detalle.paciente.edad, sexo: detalle.paciente.sexo })}
                            style={{ marginTop: 10, gap: 4 }}
                          >
                            <Icon name="message" size={11} /> Abrir estudio y enviar placas
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Historial de Acciones / Auditoría del paciente */}
            <div className="card-flat" style={{ padding: 18, margin: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="clock" size={15} color="var(--color-primary)" />
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>
                    Historial de Acciones ({historialTotal})
                  </span>
                </div>
                {userRole !== 'RADIOLOGO' && historialTotal > 0 && (
                  <button
                    className="btn btn-ghost btn-xs"
                    disabled={borrandoHistorial}
                    onClick={handleClearHistorial}
                    style={{ color: '#ef4444', gap: 4 }}
                  >
                    <Icon name="trash" size={12} /> {borrandoHistorial ? 'Borrando...' : 'Borrar historial'}
                  </button>
                )}
              </div>

              {historialLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 44 }} />)}
                </div>
              ) : historial.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>Sin acciones registradas aún para este expediente.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {historial.map(h => (
                    <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f8fafc', borderRadius: 9, border: '1px solid var(--color-border)' }}>
                      <div style={{
                        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                        background: h.accion?.includes('ELIMINADO') || h.accion?.includes('DEVUELTO') ? '#ef4444'
                          : h.accion?.includes('REGISTRADO') || h.accion?.includes('CREADO') ? '#22c55e'
                          : h.accion?.includes('ENVIADO') || h.accion?.includes('ENVIADA') ? '#f97316'
                          : '#2563eb',
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700 }}>{h.accion}</span>
                          <span style={{ fontSize: 11, color: '#64748b' }}>({h.usuario_nombre || 'Sistema'})</span>
                        </div>
                        {h.detalle && <p style={{ fontSize: 11.5, color: 'var(--color-text-muted)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.detalle}</p>}
                      </div>
                      <span style={{ fontSize: 10.5, color: '#94a3b8', flexShrink: 0 }}>{h.created_at}</span>
                      {userRole !== 'RADIOLOGO' && (
                        <button
                          className="btn btn-ghost btn-xs"
                          title="Eliminar este evento"
                          onClick={() => handleDeleteHistorialItem(h.id)}
                          style={{ padding: 3, color: '#dc2626' }}
                        >
                          <Icon name="trash" size={12} />
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Paginación del Historial */}
                  {historialPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 }}>
                      <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
                        Página {historialPage} de {historialPages}
                      </span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="btn btn-ghost btn-xs"
                          disabled={historialPage <= 1}
                          onClick={() => loadHistorial(selected.id, historialPage - 1)}
                        >
                          <Icon name="chevronLeft" size={12} /> Anterior
                        </button>
                        <button
                          className="btn btn-ghost btn-xs"
                          disabled={historialPage >= historialPages}
                          onClick={() => loadHistorial(selected.id, historialPage + 1)}
                        >
                          Siguiente <Icon name="chevronRight" size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox de imágenes */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(6,16,32,0.94)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}
        >
          <img
            src={authenticatedFileUrl(lightbox.url, user.token)}
            alt={lightbox.name || 'Vista ampliada'}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '92vw', maxHeight: '92vh', objectFit: 'contain', borderRadius: 10, boxShadow: 'var(--shadow-lg)' }}
          />
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', bottom: 24, display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ color: '#cbd5e1', fontSize: 12.5, maxWidth: '60vw', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lightbox.name}</span>
            <button className="btn btn-success btn-sm" onClick={() => handleDownloadArchivo(lightbox)} style={{ gap: 5 }}>
              <Icon name="download" size={12} /> Descargar
            </button>
          </div>
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={20} color="#fff" />
          </button>
        </div>
      )}

      {/* Visor de informe */}
      <Suspense fallback={null}>
      {informeEstudio && (
        <InformeViewer
          estudio={informeEstudio}
          userRole={userRole}
          onClose={() => setInformeEstudio(null)}
          onSaved={() => {
            setInformeEstudio(null);
            if (selected) openDetalle(selected);
          }}
        />
      )}
      </Suspense>

      {/* ── Modal de confirmación ── */}
      {confirmDialog && (
        <div className="confirm-modal" onClick={() => setConfirmDialog(null)}>
          <div className="confirm-modal-box" onClick={e => e.stopPropagation()}>
            <div className="confirm-modal-icon danger">
              <Icon name="alertTriangle" size={24} color="var(--color-danger)" />
            </div>
            <div className="confirm-modal-title">{confirmDialog.title}</div>
            <div className="confirm-modal-body">{confirmDialog.message}</div>
            <div className="confirm-modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDialog(null)}>Cancelar</button>
              <button className="btn btn-danger-solid" onClick={() => { setConfirmDialog(null); confirmDialog.onConfirm(); }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de edición de nombre (reemplaza window.prompt) ── */}
      {editDialog && (
        <div className="confirm-modal" onClick={() => setEditDialog(null)}>
          <div className="confirm-modal-box" onClick={e => e.stopPropagation()}>
            <div className="confirm-modal-title">Editar nombre del paciente</div>
            <div className="confirm-modal-body">
              <input
                type="text"
                className="input"
                value={editDialog.nombre}
                onChange={e => setEditDialog(prev => ({ ...prev, nombre: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') commitEditFolder(); if (e.key === 'Escape') setEditDialog(null); }}
                autoFocus
                maxLength={160}
                placeholder="Nombre completo del paciente"
              />
            </div>
            <div className="confirm-modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditDialog(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={commitEditFolder} disabled={!editDialog.nombre.trim()}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CarpetasVirtuales;
