import React, { useState, useEffect, useContext, useCallback, useRef, Suspense, lazy, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import RegisterModal from './RegisterModal';
import AccountSettings from './AccountSettings';
import CommunicationPanel from './CommunicationPanel';
import NotificationCenter from './NotificationCenter';
import ThemeToggle from './ThemeToggle';
import ConfirmDialog from './ConfirmDialog';
import Icon from './Icons';
import { regionDeTipo } from '../utils/catalogoRadiologia';
import { FASES, FASE_META, ESTADO_COLORS, getEstadoColors } from '../utils/constants';
import { useTheme } from '../utils/useTheme';

// Vistas pesadas que solo se necesitan cuando el usuario las abre: se cargan
// bajo demanda para que el panel abra más rápido.
const StudyDetailModal = lazy(() => import('./StudyDetailModal'));
const AdminPanel = lazy(() => import('./AdminPanel'));
const CommunicationHub = lazy(() => import('./CommunicationHub'));
const CarpetasVirtuales = lazy(() => import('./CarpetasVirtuales'));
const ReportesView = lazy(() => import('./ReportesView'));
const InformeViewer = lazy(() => import('./InformeViewer'));

const CargandoPanel = () => (
  <div style={{ flex: 1, padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div className="skeleton" style={{ height: 48 }} />
    <div className="skeleton" style={{ height: 240 }} />
  </div>
);
import { AuthContext } from '../context/AuthContext';
import { NotificationContext } from '../context/NotificationContext';
import { API_URL } from '../config';
import { sexoLabel } from '../utils/format';

// FASES, FASE_META y ESTADO_COLORS vienen de utils/constants.js (importados arriba)

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

// Fecha local en formato YYYY-MM-DD (no se usa toISOString para no desfasar el día).
const hoyLocalISO = () => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
};

const Dashboard = () => {
  const [activeFase, setActiveFase] = useState('Recibida');
  const [estudios, setEstudios] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [registrationPatient, setRegistrationPatient] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isCommunicationOpen, setIsCommunicationOpen] = useState(false);
  const [selectedEstudio, setSelectedEstudio] = useState(null);
  const [detailModalEstudio, setDetailModalEstudio] = useState(null);
  const [stats, setStats] = useState({ totalMes: 0, totalAll: 0, entregados: 0, listosImprimir: 0, enRadiologo: 0, diagnosticosRecibidos: 0 });
  const [search, setSearch] = useState('');
  const [faseCounts, setFaseCounts] = useState({});
  const [reportes, setReportes] = useState([]);
  const [entregas, setEntregas] = useState([]);
  const [view, setView] = useState('placas'); // placas | pacientes | carpetas
  const [pacientes, setPacientes] = useState([]);
  const [pacienteDetail, setPacienteDetail] = useState(null);
  const [pacienteBusqueda, setPacienteBusqueda] = useState('');
  const [pacientePage, setPacientePage] = useState(1);
  const [pacientePages, setPacientePages] = useState(1);
  const [pacienteTotal, setPacienteTotal] = useState(0);
  const PACIENTE_LIMIT = 20;
  const [exporting, setExporting] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedPatientIds, setSelectedPatientIds] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroRegion, setFiltroRegion] = useState('');
  const [soloUrgentes, setSoloUrgentes] = useState(false);
  const [filtroDesde, setFiltroDesde] = useState('');
  const [topEstudios, setTopEstudios] = useState([]);
  const [entregandoLote, setEntregandoLote] = useState(false);
  const [centro, setCentro] = useState(null);
  const [informeEstudio, setInformeEstudio] = useState(null);
  const [dismissedPendingCount, setDismissedPendingCount] = useState(0);
  const searchRef = useRef(null);
  const navigate = useNavigate();
  const { logout, user } = useContext(AuthContext);
  const { pendingEncargado, setPendingEncargado, unreadMessages, setUnreadMessages, on, off, fetchPendingCounts, addNotification } = useContext(NotificationContext);
  const { isDark, toggleTheme } = useTheme(user?.id);

  // useMemo evita que los callbacks memorizados dependan de un objeto headers recreado en cada render
  const headers = useMemo(() => ({ Authorization: `Bearer ${user.token}` }), [user.token]);

  // Estado para modal de confirmación (reemplaza window.confirm)
  const [confirmDialog, setConfirmDialog] = useState(null); // { title, message, onConfirm, variant }
  const showConfirm = useCallback((title, message, onConfirm, variant = 'danger') => {
    setConfirmDialog({ title, message, onConfirm, variant });
  }, []);

  useEffect(() => {
    if (pendingEncargado === 0) setDismissedPendingCount(0);
  }, [pendingEncargado]);

  const fetchEstudios = useCallback(() => {
    fetch(`${API_URL}/api/estudios?estado=${encodeURIComponent(activeFase)}`, { headers })
      .then(r => r.json())
      .then(d => Array.isArray(d) && setEstudios(d))
      .catch(e => console.error(e));
  }, [activeFase, user.token]);

  const fetchStats = useCallback(() => {
    fetch(`${API_URL}/api/stats`, { headers })
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(e => console.error(e));
  }, [user.token]);

  // Un solo endpoint devuelve el conteo de todas las bandejas (antes: 7 peticiones).
  const fetchAllCounts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/stats/por-estado`, { headers });
      const conteos = await res.json();
      const counts = {};
      for (const fase of FASES) counts[fase] = Number(conteos?.[fase]) || 0;
      setFaseCounts(counts);
    } catch {
      // Si falla el conteo se conserva el último valor conocido de cada bandeja.
    }
  }, [user.token]);

  const fetchReportes = useCallback(() => {
    fetch(`${API_URL}/api/reportes/mensual?meses=6`, { headers })
      .then(r => r.json())
      .then(d => Array.isArray(d) && setReportes(d))
      .catch(() => {});
  }, [user.token]);

  const fetchEntregas = useCallback(() => {
    fetch(`${API_URL}/api/calendario/entregas`, { headers })
      .then(r => r.json())
      .then(d => Array.isArray(d) && setEntregas(d))
      .catch(() => {});
  }, [user.token]);

  const fetchTopEstudios = useCallback(() => {
    fetch(`${API_URL}/api/reportes/top-estudios`, { headers })
      .then(r => r.json())
      .then(d => Array.isArray(d) && setTopEstudios(d))
      .catch(() => {});
  }, [user.token]);

  const fetchConfig = useCallback(() => {
    fetch(`${API_URL}/api/config`, { headers })
      .then(r => r.json())
      .then(d => d && typeof d === 'object' && setCentro(d))
      .catch(() => {});
  }, [user.token]);

  const buscarPacientes = useCallback((q = '', page = 1) => {
    fetch(`${API_URL}/api/pacientes/buscar?q=${encodeURIComponent((q || '').trim())}&page=${page}&limit=20`, { headers })
      .then(r => r.json())
      .then(d => {
        if (d && Array.isArray(d.pacientes)) {
          setPacientes(d.pacientes);
          setPacientePage(d.page || 1);
          setPacientePages(d.pages || 1);
          setPacienteTotal(d.total || 0);
        }
      })
      .catch(() => {});
  }, [user.token]);

  useEffect(() => { fetchEstudios(); }, [fetchEstudios]);
  useEffect(() => { fetchStats(); fetchAllCounts(); fetchReportes(); fetchEntregas(); fetchTopEstudios(); fetchConfig(); }, [fetchStats, fetchAllCounts, fetchReportes, fetchEntregas, fetchTopEstudios, fetchConfig]);

  // Limpiar selección de lote al cambiar de bandeja
  useEffect(() => { setSelectedIds([]); }, [activeFase]);

  useEffect(() => {
    const onDiagnostico = () => { fetchEstudios(); fetchStats(); fetchAllCounts(); fetchPendingCounts(); fetchTopEstudios(); };
    const onNuevo      = () => { fetchEstudios(); fetchStats(); fetchAllCounts(); fetchReportes(); fetchEntregas(); fetchTopEstudios(); };
    const onDevuelto   = () => { fetchEstudios(); fetchStats(); fetchAllCounts(); };
    on('diagnostico:recibido', onDiagnostico);
    on('estudio:nuevo', onNuevo);
    on('estudio:devuelto', onDevuelto);
    return () => { off('diagnostico:recibido', onDiagnostico); off('estudio:nuevo', onNuevo); off('estudio:devuelto', onDevuelto); };
  }, [on, off, fetchEstudios, fetchStats, fetchAllCounts, fetchPendingCounts, fetchReportes, fetchEntregas, fetchTopEstudios]);

  useEffect(() => {
    if (view === 'pacientes') {
      setPacientePage(1);
      buscarPacientes(pacienteBusqueda, 1);
    }
  }, [view, pacienteBusqueda, buscarPacientes]);

  // Atajo Ctrl+K: enfocar la búsqueda de placas desde cualquier vista
  useEffect(() => {
    const handler = (evento) => {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
        evento.preventDefault();
        setView('placas');
        setTimeout(() => searchRef.current?.focus(), 0);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Cerrar panel de comunicación con Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setSelectedEstudio(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleAvanzarFase = async (id, currentFase) => {
    let nextFase = null;
    if (currentFase === 'Recibida') nextFase = 'Pendiente de enviar al radiólogo';
    else if (currentFase === 'Pendiente de enviar al radiólogo') nextFase = 'Enviada al radiólogo';
    else if (currentFase === 'Diagnóstico recibido') nextFase = 'Listo para imprimir';
    else if (currentFase === 'Devuelta por revisión') nextFase = 'Enviada al radiólogo';
    else if (currentFase === 'Listo para imprimir') nextFase = 'Entregado';
    if (!nextFase) return;
    try {
      const res = await fetch(`${API_URL}/api/estudios/${id}/estado`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nextFase }),
      });
      const d = await res.json();
      if (!d.success && d.error) addNotification('❌ No se pudo avanzar', d.error, 'error');
      fetchEstudios(); fetchStats(); fetchAllCounts(); fetchEntregas();
    } catch {
      addNotification('❌ Error de conexión', 'No se pudo actualizar el estado del estudio.', 'error');
    }
  };

  const handleEnviarRadiologo = async (id) => {
    try {
      const filesRes = await fetch(`${API_URL}/api/estudios/${id}/archivos`, { headers });
      const files = await filesRes.json();
      const images = Array.isArray(files) ? files.filter(file => file.isImage) : [];
      const res = await fetch(`${API_URL}/api/estudios/${id}/estado`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'Enviada al radiólogo' }),
      });
      const d = await res.json();
      if (!d.success) {
        addNotification('❌ No se pudo enviar', d.error || 'Error al cambiar el estado', 'error');
      } else {
        addNotification(
          images.length ? '📤 Radiografías enviadas' : '📤 Estudio enviado sin imágenes',
          images.length ? `${images.length} radiografía(s) disponible(s) para el radiólogo.` : 'Puedes adjuntar imágenes desde el detalle del estudio.',
          images.length ? 'success' : 'warning'
        );
      }
      fetchEstudios(); fetchStats(); fetchAllCounts();
    } catch {
      addNotification('❌ Error de conexión', 'No se pudo enviar el estudio al radiólogo.', 'error');
    }
  };

  const handleExportDesktop = async (id) => {
    setExporting(id);
    try {
      const res = await fetch(`${API_URL}/api/estudios/${id}/export-desktop`, {
        method: 'POST',
        headers,
      });
      const d = await res.json();
      addNotification(
        d.success ? '✅ Carpeta exportada al escritorio' : '❌ Error al exportar',
        d.success ? 'La carpeta del paciente se copió al escritorio de la PC del servidor.' : (d.error || 'No se pudo exportar la carpeta'),
        d.success ? 'success' : 'error'
      );
    } catch { addNotification('❌ Error de conexión', 'No se pudo conectar con el servidor', 'error'); }
    finally { setExporting(null); }
  };

  const toggleSelected = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleEntregarLote = async () => {
    if (selectedIds.length === 0) return;
    showConfirm(
      'Confirmar entrega en lote',
      `¿Marcar como entregadas ${selectedIds.length} placa(s) seleccionada(s)? Esta acción no se puede deshacer.`,
      async () => {
        setEntregandoLote(true);
        try {
          const res = await fetch(`${API_URL}/api/estudios/lote/entregar`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: selectedIds }),
          });
          const d = await res.json();
          if (d.success) {
            const mensaje = d.fallidos?.length
              ? `✅ ${d.ok} entregada(s). ${d.fallidos.length} no pudieron (estado no válido).`
              : `✅ ${d.ok} placa(s) entregada(s).`;
            addNotification('📦 Lote de entrega', mensaje, 'success');
          } else addNotification('❌ Error en lote', d.error || 'Error al entregar lote', 'error');
          fetchEstudios(); fetchStats(); fetchAllCounts(); fetchEntregas(); fetchReportes(); fetchTopEstudios();
        } catch { addNotification('❌ Error de conexión', 'No se pudo conectar con el servidor', 'error'); }
        finally { setEntregandoLote(false); setSelectedIds([]); }
      }
    );
  };

  const filteredEstudios = estudios.filter(e => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const match = e.nombre?.toLowerCase().includes(q) || e.registro_id?.toLowerCase().includes(q) || e.tipo_estudio?.toLowerCase().includes(q) || e.medico_remitente?.toLowerCase().includes(q) || e.region?.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (soloUrgentes && !e.urgente) return false;
    if (filtroTipo && e.tipo_estudio !== filtroTipo) return false;
    if (filtroRegion && (e.region || regionDeTipo(e.tipo_estudio)) !== filtroRegion) return false;
    if (filtroDesde && e.fecha_estudio !== filtroDesde) return false;
    return true;
  });

  // Tipos de estudio únicos para el filtro
  const tiposUnicos = [...new Set(estudios.map(e => e.tipo_estudio).filter(Boolean))].sort();
  const regionesUnicas = [...new Set(estudios.map(e => e.region || regionDeTipo(e.tipo_estudio)).filter(Boolean))].sort();

  // Días transcurridos en el estado actual (SLA operativo)
  const diasEnEstado = (e) => {
    const base = e.fecha_estado || e.fecha_creacion;
    if (!base) return null;
    const t = new Date(base.replace(' ', 'T'));
    if (isNaN(t)) return null;
    return Math.max(0, Math.floor((Date.now() - t.getTime()) / 86400000));
  };

  const slaColor = (dias) => {
    if (dias === null) return null;
    if (dias === 0) return { bg: '#f0fdf4', text: '#15803d' };
    if (dias <= 2) return { bg: '#fffbeb', text: '#b45309' };
    return { bg: '#fef2f2', text: '#b91c1c' };
  };

  // Exportar reporte mensual a CSV
  const exportCSV = () => {
    const cab = 'Mes,Placas realizadas,Diagnósticos recibidos,Entregadas\n';
    const filas = reportes.map(r => `${r.mes},${r.total},${r.diagnosticos},${r.entregados}`).join('\n');
    const blob = new Blob(['\uFEFF' + cab + filas], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_mensual_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isEncargado = user.role === 'ENCARGADO' || user.role === 'SUPER_ADMIN';
  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  return (
    <div className="app-container" style={{ position: 'relative' }}>
      {/* ============ Sidebar ============ */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <img className="brand-img" src="/logo.png" alt="RX CCDX" />
          </div>
          <div>
            <h2 style={{ color: '#fff', fontSize: 16, margin: 0, letterSpacing: '-0.01em' }}>RX CCDX</h2>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 2 }}>{centro?.centro_nombre || 'Gestión Radiológica'}</p>
          </div>
        </div>

        {/* Stats resumen */}
        <div style={{ padding: '14px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <SidebarStat label="Este mes" value={stats.totalMes} color="#60a5fa" />
          <SidebarStat label="Total" value={stats.totalAll} color="#94a3b8" />
          <SidebarStat label="En radiólogo" value={stats.enRadiologo} color="#fb923c" />
          <SidebarStat label="Entregados" value={stats.entregados} color="#34d399" />
        </div>

        <nav className="sidebar-nav">
          <p className="sidebar-nav-label">Bandejas de estado</p>
          {FASES.map(fase => {
            const meta = FASE_META[fase];
            const active = activeFase === fase && view === 'placas';
            return (
              <button
                key={fase}
                className={`nav-item ${active ? 'active' : ''}`}
                onClick={() => {
                  setView('placas');
                  setActiveFase(fase);
                  if (fase === 'Diagnóstico recibido') setPendingEncargado(0);
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: meta.dot, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12.5, lineHeight: 1.3 }}>{fase}</span>
                {(faseCounts[fase] || 0) > 0 && (
                  <span className={`nav-badge ${fase !== 'Diagnóstico recibido' ? 'nav-badge-muted' : ''}`}>
                    {faseCounts[fase]}
                  </span>
                )}
              </button>
            );
          })}

          <p className="sidebar-nav-label" style={{ marginTop: 16 }}>Expedientes</p>
          <button
            className={`nav-item ${view === 'pacientes' ? 'active' : ''}`}
            onClick={() => setView('pacientes')}
          >
            <Icon name="users" size={14} color={view === 'pacientes' ? '#fff' : '#94a3b8'} />
            <span style={{ flex: 1, fontSize: 12.5 }}>Pacientes</span>
          </button>
          <button
            className={`nav-item ${view === 'carpetas' ? 'active' : ''}`}
            onClick={() => setView('carpetas')}
          >
            <Icon name="folder" size={14} color={view === 'carpetas' ? '#fff' : '#94a3b8'} />
            <span style={{ flex: 1, fontSize: 12.5 }}>Carpetas Virtuales</span>
          </button>
          <button
            className={`nav-item ${view === 'reportes' ? 'active' : ''}`}
            onClick={() => setView('reportes')}
          >
            <Icon name="chart" size={14} color={view === 'reportes' ? '#fff' : '#94a3b8'} />
            <span style={{ flex: 1, fontSize: 12.5 }}>Reportes</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="btn" onClick={() => { setIsCommunicationOpen(true); setUnreadMessages(0); }} style={{ gap: 8, position: 'relative' }}>
            <Icon name="message" size={14} color="#cbd5e1" /> Mensajería con radiólogo
            {unreadMessages > 0 && <span className="nav-badge">{unreadMessages}</span>}
          </button>
          {isSuperAdmin && (
            <button className="btn" onClick={() => setIsAdminOpen(true)} style={{ gap: 8 }}>
              <Icon name="shield" size={14} color="#cbd5e1" /> Panel de Administración
            </button>
          )}
          <button className="btn" onClick={() => setIsSettingsOpen(true)} style={{ gap: 8 }}>
            <Icon name="settings" size={14} color="#cbd5e1" /> Ajustes de cuenta
          </button>
          <button className="btn" onClick={() => { logout(); navigate('/login'); }} style={{ gap: 8 }}>
            <Icon name="logout" size={14} color="#cbd5e1" /> Cerrar sesión
          </button>
          <div style={{ marginTop: 12, textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
            Creadores: GYPR y AnabelLp
          </div>
        </div>
      </aside>

      {/* ============ Main ============ */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div className="flex-1">
            <h3 style={{ margin: 0, fontSize: 15.5, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 9 }}>
              {view === 'pacientes' ? (
                <Icon name="users" size={17} color="var(--color-text-secondary)" />
              ) : view === 'carpetas' ? (
                <Icon name="folder" size={17} color="var(--color-text-secondary)" />
              ) : view === 'reportes' ? (
                <Icon name="chart" size={17} color="var(--color-text-secondary)" />
              ) : (
                <Icon name={FASE_META[activeFase]?.icon || 'file'} size={17} color="var(--color-text-secondary)" />
              )}
              {view === 'pacientes' ? 'Expedientes de Pacientes' : view === 'carpetas' ? 'Carpetas Virtuales' : view === 'reportes' ? 'Reportes de Productividad' : activeFase}
              {view === 'placas' && (faseCounts[activeFase] || 0) > 0 && (
                <span className="badge badge-blue" style={{ fontSize: 11 }}>{faseCounts[activeFase]} placa{faseCounts[activeFase] !== 1 ? 's' : ''}</span>
              )}
            </h3>
            <p style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
              {user.username} · {user.role === 'SUPER_ADMIN' ? 'Super Administrador' : 'Administrativo'}
            </p>
          </div>

          {/* Toggle vista — solo en topbar para placas/pacientes; carpetas se accede desde sidebar */}
          {view !== 'carpetas' && view !== 'reportes' && (
            <div style={{ display: 'flex', background: 'var(--color-surface-2)', borderRadius: 10, padding: 3, border: '1px solid var(--color-border)' }}>
              {[
                { id: 'placas', icon: 'xray', label: 'Placas' },
                { id: 'pacientes', icon: 'users', label: 'Pacientes' },
              ].map(v => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  style={{
                    padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: 6,
                    backgroundColor: view === v.id ? '#fff' : 'transparent',
                    color: view === v.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    boxShadow: view === v.id ? 'var(--shadow-sm)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon name={v.icon} size={13} />
                  {v.label}
                </button>
              ))}
            </div>
          )}

          {view === 'placas' ? (
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}>
                <Icon name="search" size={14} color="var(--color-text-muted)" />
              </div>
              <input
                ref={searchRef}
                type="text"
                className="input"
                placeholder="Buscar por paciente, ID, estudio... (Ctrl+K)"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: 250, paddingLeft: 32 }}
              />
            </div>
          ) : view === 'pacientes' ? (
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}>
                <Icon name="search" size={14} color="var(--color-text-muted)" />
              </div>
              <input
                type="text"
                className="input"
                placeholder="Buscar paciente por nombre o registro..."
                value={pacienteBusqueda}
                onChange={e => setPacienteBusqueda(e.target.value)}
                style={{ width: 250, paddingLeft: 32 }}
              />
            </div>
          ) : null}

          <NotificationCenter />
          <ThemeToggle variant="topbar" />

          {isEncargado && view === 'placas' && (
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)} style={{ gap: 6 }}>
              <Icon name="plus" size={15} color="#fff" /> Registrar Placa
            </button>
          )}
        </header>

        {/* Barra de filtros (placas) */}
        {view === 'placas' && (
          <div style={{ display: 'flex', gap: 10, padding: '10px 22px 0', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="input"
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value)}
              style={{ width: 190, padding: '7px 10px', fontSize: 12.5 }}
            >
              <option value="">Todos los tipos de estudio</option>
              {tiposUnicos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              className="input"
              value={filtroRegion}
              onChange={e => setFiltroRegion(e.target.value)}
              style={{ width: 180, padding: '7px 10px', fontSize: 12.5 }}
              title="Filtrar por región anatómica"
            >
              <option value="">Todas las regiones</option>
              {regionesUnicas.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-muted)' }}>
              <Icon name="calendar" size={14} color="var(--color-text-muted)" />
              <input type="date" className="input" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)} style={{ width: 148, padding: '7px 10px', fontSize: 12.5 }} />
            </div>
            <button
              className={`btn btn-xs ${soloUrgentes ? 'btn-danger' : 'btn-ghost'}`}
              onClick={() => setSoloUrgentes(v => !v)}
              title="Mostrar solo los estudios marcados como urgentes"
              style={{ gap: 5 }}
            >
              <Icon name="bell" size={11} /> Solo urgentes{stats.urgentes ? ` (${stats.urgentes})` : ''}
            </button>
            {(filtroTipo || filtroRegion || filtroDesde || soloUrgentes) && (
              <button className="btn btn-ghost btn-xs" onClick={() => { setFiltroTipo(''); setFiltroRegion(''); setFiltroDesde(''); setSoloUrgentes(false); }} style={{ gap: 4 }}>
                <Icon name="close" size={10} /> Limpiar filtros
              </button>
            )}
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => {
                const filas = filteredEstudios.map(e => [
                  e.registro_id, e.nombre, e.edad, sexoLabel(e.sexo), e.tipo_estudio, e.region || regionDeTipo(e.tipo_estudio), e.fecha_estudio,
                  e.estado, e.medico_remitente || '', e.urgente ? 'URGENTE' : 'Normal', e.fecha_entrega_estimada || '',
                ].map(campo => `"${String(campo ?? '').replace(/"/g, '""')}"`).join(','));
                const csv = ['"Registro","Paciente","Edad","Sexo","Estudio","Región","Fecha","Estado","Médico remitente","Prioridad","Entrega estimada"', ...filas].join('\n');
                const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `bandeja_${activeFase.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
                link.click();
                URL.revokeObjectURL(url);
              }}
              disabled={filteredEstudios.length === 0}
              title="Descargar esta bandeja en CSV (Excel)"
              style={{ gap: 4 }}
            >
              <Icon name="download" size={11} /> CSV
            </button>
            <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>
              {filteredEstudios.length} de {estudios.length} placas en esta bandeja
            </span>
          </div>
        )}

        {/* Barra de lote de entrega (solo en "Listo para imprimir") */}
        {view === 'placas' && activeFase === 'Listo para imprimir' && isEncargado && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 22px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <span className="chip" style={{ background: '#eff6ff', borderColor: '#bfdbfe', color: '#003366', gap: 6 }}>
                <Icon name="package" size={13} color="#003366" />
                Lote de entrega: {selectedIds.length} seleccionada{selectedIds.length !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-muted">Marque las placas listas y entréguelas juntas. Se registrarán en auditoría.</span>
            </div>
            <button
              className="btn btn-success"
              onClick={handleEntregarLote}
              disabled={selectedIds.length === 0 || entregandoLote}
              style={{ fontSize: 12.5, gap: 6 }}
            >
              {entregandoLote ? 'Entregando...' : <><Icon name="package" size={13} /> Entregar lote ({selectedIds.length})</>}
            </button>
          </div>
        )}

        {/* Alerta estudios urgentes sin entregar */}
        {view === 'placas' && stats.urgentes > 0 && (
          <div
            onClick={() => { setView('placas'); setSoloUrgentes(true); }}
            className="alert alert-danger"
            style={{ margin: '10px 22px 0', cursor: 'pointer', borderLeftColor: '#ef4444' }}
          >
            <Icon name="bell" size={15} color="#b91c1c" />
            <span>
              <strong>{stats.urgentes}</strong> estudio{stats.urgentes > 1 ? 's' : ''} marcado{stats.urgentes > 1 ? 's' : ''} como urgente{stats.urgentes > 1 ? 's' : ''} — clic para verlos
            </span>
          </div>
        )}

        {/* Alerta de entregas vencidas (fecha estimada superada) */}
        {view === 'placas' && stats.vencidos > 0 && (
          <div className="alert alert-warning" style={{ margin: '10px 22px 0', borderLeftColor: '#f59e0b' }}>
            <Icon name="clock" size={15} color="#b45309" />
            <span>
              <strong>{stats.vencidos}</strong> estudio{stats.vencidos > 1 ? 's' : ''} superó la fecha de entrega estimada. Revise el módulo de Reportes.
            </span>
          </div>
        )}

        {/* Alerta diagnósticos pendientes */}
        {pendingEncargado > 0 && pendingEncargado !== dismissedPendingCount && view === 'placas' && activeFase !== 'Diagnóstico recibido' && (
          <div
            onClick={() => setActiveFase('Diagnóstico recibido')}
            className="alert alert-danger"
            style={{ margin: '10px 22px 0', cursor: 'pointer', borderLeftColor: '#ef4444' }}
          >
            <Icon name="bell" size={15} color="#b91c1c" />
            <span>
              <strong>{pendingEncargado}</strong> diagnóstico{pendingEncargado > 1 ? 's' : ''} nuevo{pendingEncargado > 1 ? 's' : ''} recibido{pendingEncargado > 1 ? 's' : ''} — clic para revisar
            </span>
            <button
              type="button"
              aria-label="Cerrar notificación"
              onClick={event => { event.stopPropagation(); setDismissedPendingCount(pendingEncargado); }}
              style={{ marginLeft: 'auto', border: 0, background: 'transparent', color: '#b91c1c', cursor: 'pointer', padding: 4, display: 'flex' }}
            >
              <Icon name="x" size={16} color="#b91c1c" />
            </button>
          </div>
        )}

        {/* ============ Cuerpo ============ */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* ---------- VISTA CARPETAS ---------- */}
          {view === 'carpetas' ? (
            <Suspense fallback={<CargandoPanel />}>
              <CarpetasVirtuales
                userRole={user.role}
                onNewStudy={(patient) => { setRegistrationPatient(patient || null); setIsModalOpen(true); }}
                onOpenStudy={(study) => setDetailModalEstudio(study)}
              />
            </Suspense>
          ) : view === 'reportes' ? (
            <Suspense fallback={<CargandoPanel />}>
            <ReportesView
              headers={headers}
              onOpenStudy={async (estudio) => {
                // El listado de vencidos trae datos parciales: se carga el estudio completo
                // para que el modal muestre paciente, edad y diagnóstico correctos.
                try {
                  const res = await fetch(`${API_URL}/api/estudios/${estudio.id}`, { headers });
                  const completo = await res.json();
                  setDetailModalEstudio(completo?.id ? completo : estudio);
                } catch {
                  setDetailModalEstudio(estudio);
                }
              }}
            />
            </Suspense>
          ) : view === 'pacientes' ? (
            /* ---------- VISTA PACIENTES ---------- */
            <div style={{ flex: 1, height: '100%', minHeight: 0, overflowY: 'auto', padding: '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
                    Pacientes Registrados
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                    {pacienteTotal} paciente{pacienteTotal !== 1 ? 's' : ''} registrado{pacienteTotal !== 1 ? 's' : ''} en la base de datos
                  </p>
                </div>

                {/* ── Acciones de Selección Múltiple ── */}
                {pacientes.length > 0 && (user.role === 'ENCARGADO' || user.role === 'SUPER_ADMIN') && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, cursor: 'pointer', userSelect: 'none', fontWeight: 600, color: 'var(--color-text)' }}>
                      <input
                        type="checkbox"
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                        checked={pacientes.length > 0 && pacientes.every(p => selectedPatientIds.includes(p.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPatientIds(Array.from(new Set([...selectedPatientIds, ...pacientes.map(p => p.id)])));
                          } else {
                            const pageIds = new Set(pacientes.map(p => p.id));
                            setSelectedPatientIds(selectedPatientIds.filter(id => !pageIds.has(id)));
                          }
                        }}
                      />
                      <span>Seleccionar todos ({pacientes.length})</span>
                    </label>

                    {selectedPatientIds.length > 0 && (
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ gap: 6, fontWeight: 700 }}
                        onClick={() => {
                          const count = selectedPatientIds.length;
                          showConfirm(
                            'Eliminar Pacientes Seleccionados',
                            `¿Eliminar permanentemente a los ${count} paciente${count > 1 ? 's' : ''} seleccionado${count > 1 ? 's' : ''} y todos sus estudios/archivos de la base de datos? Esta acción no se puede deshacer.`,
                            async () => {
                              try {
                                const idsToRemove = [...selectedPatientIds];
                                const res = await fetch(`${API_URL}/api/pacientes/bulk-delete`, {
                                  method: 'POST',
                                  headers: { ...headers, 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ ids: idsToRemove }),
                                });
                                const data = await res.json();
                                if (!res.ok || !data.success) throw new Error(data.error || 'No se pudieron eliminar los pacientes');

                                // Actualización INMEDIATA para hacerlos desaparecer de la pantalla al instante
                                setPacientes(prev => prev.filter(p => !idsToRemove.includes(p.id)));
                                setEstudios(prev => prev.filter(e => !idsToRemove.includes(e.paciente_id)));
                                setPacienteTotal(prev => Math.max(0, prev - idsToRemove.length));
                                setSelectedPatientIds([]);
                                addNotification('Pacientes eliminados', `Se eliminaron ${data.count || count} paciente(s) de la base de datos.`, 'success');

                                fetchEstudios();
                                buscarPacientes(pacienteBusqueda, pacientePage);
                                fetchAllCounts();
                                fetchStats();
                              } catch (err) {
                                addNotification('Error', err.message, 'danger');
                              }
                            }
                          );
                        }}
                      >
                        <Icon name="trash" size={13} /> Eliminar ({selectedPatientIds.length}) seleccionados
                      </button>
                    )}
                  </div>
                )}
              </div>

              {pacientes.length === 0 ? (
                <div className="card" style={{ margin: 0 }}>
                  <div className="empty-state" style={{ padding: 40 }}>
                    <div style={{ marginBottom: 12 }}><Icon name="users" size={40} color="#94a3b8" /></div>
                    <h4>Sin pacientes</h4>
                    <p>{pacienteBusqueda.trim() ? `No se encontraron pacientes para "${pacienteBusqueda}".` : 'No hay pacientes registrados en el sistema.'}</p>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {pacientes.map(p => {
                    const isSelected = selectedPatientIds.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        className="card-flat"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', margin: 0,
                          transition: 'all 0.15s ease',
                          border: isSelected ? '1px solid var(--color-primary)' : undefined,
                          background: isSelected ? 'rgba(26,102,179,0.05)' : undefined,
                        }}
                      >
                        {(user.role === 'ENCARGADO' || user.role === 'SUPER_ADMIN') && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedPatientIds(prev => [...prev, p.id]);
                              else setSelectedPatientIds(prev => prev.filter(id => id !== p.id));
                            }}
                            style={{ width: 17, height: 17, cursor: 'pointer', flexShrink: 0, accentColor: 'var(--color-primary)' }}
                          />
                        )}

                        <div
                          style={{
                            width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#eff6ff,#dbeafe)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer',
                          }}
                          onClick={() => setPacienteDetail(p)}
                        >
                          <Icon name="user" size={20} color="#1a66b3" />
                        </div>
                        <div className="flex-1" style={{ cursor: 'pointer' }} onClick={() => setPacienteDetail(p)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{p.nombre}</span>
                            <span className="chip mono" style={{ fontSize: 11 }}>{p.registro_id}</span>
                            <span className="chip" style={{ fontSize: 11 }}>{p.total_estudios} estudio{p.total_estudios !== 1 ? 's' : ''}</span>
                          </div>
                          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 3 }}>
                            {p.edad} años · {sexoLabel(p.sexo)}
                            {(p.telefono || p.correo || p.direccion) && ` · ${[p.telefono, p.correo, p.direccion].filter(Boolean).join(' · ')}`}
                          </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => setPacienteDetail(p)}
                            style={{ gap: 6 }}
                          >
                            <Icon name="eye" size={13} /> Expediente
                          </button>
                          {(user.role === 'ENCARGADO' || user.role === 'SUPER_ADMIN') && (
                            <button
                              className="btn btn-danger btn-sm"
                              title="Eliminar paciente de la base de datos"
                              onClick={() => {
                                showConfirm(
                                  'Eliminar Paciente',
                                  `¿Eliminar permanentemente al paciente "${p.nombre}" (${p.registro_id}) y todos sus estudios/archivos de la base de datos? Esta acción no se puede deshacer.`,
                                  async () => {
                                    try {
                                      const res = await fetch(`${API_URL}/api/pacientes/${p.id}`, { method: 'DELETE', headers });
                                      const data = await res.json();
                                      if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo eliminar el paciente');
                                      
                                      // Actualización INMEDIATA del estado local para que desaparezca al instante:
                                      setPacientes(prev => prev.filter(item => item.id !== p.id));
                                      setEstudios(prev => prev.filter(e => e.paciente_id !== p.id));
                                      setPacienteTotal(prev => Math.max(0, prev - 1));
                                      setSelectedPatientIds(prev => prev.filter(id => id !== p.id));
                                      addNotification('Paciente eliminado', `El paciente "${p.nombre}" fue eliminado de la base de datos.`, 'success');

                                      fetchEstudios();
                                      buscarPacientes(pacienteBusqueda, pacientePage);
                                      fetchAllCounts();
                                      fetchStats();
                                    } catch (err) {
                                      addNotification('Error', err.message, 'danger');
                                    }
                                  }
                                );
                              }}
                              style={{ gap: 6 }}
                            >
                              <Icon name="trash" size={13} /> Eliminar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* ── Paginación de Pacientes ── */}
                  {pacientePages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 4px 0' }}>
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        {pacienteTotal} paciente{pacienteTotal !== 1 ? 's' : ''} · Página {pacientePage} de {pacientePages}
                      </span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={pacientePage <= 1}
                          onClick={() => { const p = pacientePage - 1; setPacientePage(p); buscarPacientes(pacienteBusqueda, p); }}
                          style={{ gap: 5 }}
                        >
                          <Icon name="chevronLeft" size={13} /> Anterior
                        </button>
                        {Array.from({ length: Math.min(5, pacientePages) }, (_, idx) => {
                          let pageNum;
                          if (pacientePages <= 5) pageNum = idx + 1;
                          else if (pacientePage <= 3) pageNum = idx + 1;
                          else if (pacientePage >= pacientePages - 2) pageNum = pacientePages - 4 + idx;
                          else pageNum = pacientePage - 2 + idx;
                          return (
                            <button
                              key={pageNum}
                              className={`btn btn-sm ${pacientePage === pageNum ? 'btn-primary' : 'btn-ghost'}`}
                              onClick={() => { setPacientePage(pageNum); buscarPacientes(pacienteBusqueda, pageNum); }}
                              style={{ minWidth: 32, padding: '4px 8px' }}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={pacientePage >= pacientePages}
                          onClick={() => { const p = pacientePage + 1; setPacientePage(p); buscarPacientes(pacienteBusqueda, p); }}
                          style={{ gap: 5 }}
                        >
                          Siguiente <Icon name="chevronRight" size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* ---------- IZQUIERDA: tabla ---------- */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>
                <div className="table-shell" style={{ margin: 0 }}>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          {activeFase === 'Listo para imprimir' && isEncargado && (
                            <th style={{ width: 34 }}>
                              <input
                                type="checkbox"
                                checked={filteredEstudios.length > 0 && filteredEstudios.every(e => selectedIds.includes(e.id))}
                                onChange={() => {
                                  const todos = filteredEstudios.map(e => e.id);
                                  setSelectedIds(prev =>
                                    prev.length === todos.length ? [] : [...new Set([...prev, ...todos])]
                                  );
                                }}
                                style={{ cursor: 'pointer', accentColor: 'var(--color-secondary)' }}
                              />
                            </th>
                          )}
                          <th style={{ width: 115 }}>Registro</th>
                          <th>Paciente</th>
                          <th>Estudio</th>
                          <th style={{ width: 105 }}>Fecha</th>
                          <th style={{ width: 110 }}>Entrega</th>
                          <th style={{ width: 84 }}>En estado</th>
                          <th>Médico Ref.</th>
                          <th style={{ width: 250 }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEstudios.length === 0 ? (
                          <tr>
                            <td colSpan={activeFase === 'Listo para imprimir' && isEncargado ? 9 : 8} style={{ textAlign: 'center', padding: '48px 20px' }}>
                              <div className="empty-state" style={{ padding: 0 }}>
                                <div style={{ marginBottom: 10 }}><Icon name="inbox" size={40} color="#94a3b8" /></div>
                                <h4>{search ? 'Sin resultados' : 'Bandeja vacía'}</h4>
                                <p>{search ? 'No hay placas que coincidan con esa búsqueda.' : 'No hay placas en esta bandeja de estado.'}</p>
                              </div>
                            </td>
                          </tr>
                        ) : filteredEstudios.map(est => {
                          const isActive = selectedEstudio?.id === est.id;
                          const ec = ESTADO_COLORS[activeFase] || ESTADO_COLORS['Recibida'];
                          const dias = diasEnEstado(est);
                          const sla = slaColor(dias);
                          const isSelected = selectedIds.includes(est.id);
                          return (
                            <tr
                              key={est.id}
                              className={isActive ? 'row-active' : ''}
                              onClick={(e) => {
                                if (e.target.type === 'checkbox') return;
                                setSelectedEstudio(isActive ? null : est);
                              }}
                              style={{ cursor: 'pointer', boxShadow: est.urgente ? 'inset 3px 0 0 #ef4444' : undefined }}
                            >
                              {activeFase === 'Listo para imprimir' && isEncargado && (
                                <td onClick={e => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSelected(est.id)}
                                    style={{ cursor: 'pointer', accentColor: 'var(--color-secondary)' }}
                                  />
                                </td>
                              )}
                              <td>
                                <span className="mono font-bold" style={{ color: 'var(--color-primary)', fontSize: 12.5 }}>{est.registro_id}</span>
                              </td>
                              <td style={{ fontWeight: 600, fontSize: 13.5 }}>
                                {est.nombre}
                                {est.urgente ? (
                                  <span className="badge badge-red" style={{ marginLeft: 8, fontSize: 9.5, padding: '2px 7px', verticalAlign: 'middle' }}>
                                    URGENTE
                                  </span>
                                ) : null}
                              </td>
                              <td>
                                <span className="badge" style={{ background: ec.bg, color: ec.text, fontSize: 11.5 }}>
                                  <span className="badge-dot" style={{ background: ec.dot }} />
                                  {est.tipo_estudio}
                                </span>
                              </td>
                              <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{est.fecha_estudio}</td>
                              <td style={{ fontSize: 12 }}>
                                {est.fecha_entrega_estimada ? (
                                  <span
                                    title={est.estado === 'Entregado' ? 'Estudio entregado' : 'Fecha de entrega estimada (ciclo miércoles → martes)'}
                                    style={{
                                      color: est.estado !== 'Entregado' && est.fecha_entrega_estimada < hoyLocalISO() ? '#b91c1c' : 'var(--color-text-muted)',
                                      fontWeight: est.estado !== 'Entregado' && est.fecha_entrega_estimada < hoyLocalISO() ? 700 : 500,
                                    }}
                                  >
                                    {est.fecha_entrega_estimada}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                                )}
                              </td>
                              <td>
                                {sla && (
                                  <span
                                    className="badge"
                                    style={{ background: sla.bg, color: sla.text, fontSize: 10.5 }}
                                    title={`En estado ${activeFase} desde ${est.fecha_estado || est.fecha_creacion}`}
                                  >
                                    <Icon name="clock" size={10} /> {dias === 0 ? 'hoy' : dias === 1 ? '1 día' : `${dias} días`}
                                  </span>
                                )}
                              </td>
                              <td style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{est.medico_remitente}</td>
                              <td onClick={e => e.stopPropagation()}>
                                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                  {isEncargado && activeFase !== 'Devuelta por revisión' && est.estado !== 'Devuelta por revisión' && activeFase !== 'Enviada al radiólogo' && activeFase !== 'Diagnóstico recibido' && activeFase !== 'Listo para imprimir' && activeFase !== 'Entregado' && (
                                    <button className="btn btn-warning btn-xs" onClick={() => handleEnviarRadiologo(est.id)} style={{ gap: 4 }}>
                                      <Icon name="send" size={11} /> Asignar
                                    </button>
                                  )}
                                  {isEncargado && (activeFase === 'Devuelta por revisión' || est.estado === 'Devuelta por revisión') && (
                                    <button
                                      className="btn btn-primary btn-xs"
                                      onClick={() => handleEnviarRadiologo(est.id)}
                                      style={{ gap: 4 }}
                                      title="Completar revisión y reenviar estudio al radiólogo"
                                    >
                                      <Icon name="send" size={11} color="#fff" /> Reenviar al radiólogo
                                    </button>
                                  )}
                                  {isEncargado && activeFase !== 'Entregado' && activeFase !== 'Enviada al radiólogo' && activeFase !== 'Diagnóstico recibido' && activeFase !== 'Devuelta por revisión' && activeFase !== 'Listo para imprimir' && (
                                    <button className="btn btn-success btn-xs" onClick={() => handleAvanzarFase(est.id, activeFase)} style={{ gap: 4 }}>
                                      Avanzar <Icon name="chevronRight" size={11} />
                                    </button>
                                  )}
                                  {isEncargado && activeFase === 'Diagnóstico recibido' && (
                                    <button className="btn btn-teal btn-xs" onClick={() => handleAvanzarFase(est.id, activeFase)} style={{ gap: 4, background: '#0d9488', color: '#fff', border: 'none' }} title="Mover estudio a Listo para imprimir">
                                      <Icon name="check" size={11} /> Listo p/ imprimir
                                    </button>
                                  )}
                                  {isEncargado && (activeFase === 'Diagnóstico recibido' || activeFase === 'Listo para imprimir') && (
                                    <button className="btn btn-success btn-xs" onClick={() => setInformeEstudio({ ...est, autoPrint: true })} style={{ gap: 4 }} title="Imprimir informe médico y datos completos del paciente">
                                      <Icon name="print" size={11} /> Imprimir
                                    </button>
                                  )}
                                  {(activeFase === 'Diagnóstico recibido' || activeFase === 'Listo para imprimir' || activeFase === 'Entregado') && (est.diagnostico || est.estado === 'Diagnóstico recibido' || est.estado === 'Listo para imprimir') && (
                                    <button className="btn btn-primary btn-xs" onClick={() => setInformeEstudio(est)} style={{ gap: 4 }} title="Ver informe radiológico">
                                      <Icon name="eye" size={11} color="#fff" /> Informe
                                    </button>
                                  )}
                                  {isEncargado && activeFase === 'Listo para imprimir' && (
                                    <button className="btn btn-ghost btn-xs" onClick={() => handleAvanzarFase(est.id, activeFase)} style={{ gap: 4 }} title="Marcar como entregado al paciente">
                                      Entregar <Icon name="chevronRight" size={11} />
                                    </button>
                                  )}
                                  {isEncargado && (
                                    <button className="btn btn-info btn-xs" onClick={() => handleExportDesktop(est.id)} disabled={exporting === est.id} style={{ gap: 4 }}>
                                      {exporting === est.id ? <div className="spinner" style={{ width: 10, height: 10 }} /> : <Icon name="desktop" size={11} />}
                                      {exporting === est.id ? '' : 'Escritorio'}
                                    </button>
                                  )}
                                  <button
                                    className={`btn btn-xs ${isActive ? 'btn-secondary' : 'btn-ghost'}`}
                                    onClick={() => setSelectedEstudio(isActive ? null : est)}
                                    style={{ gap: 4 }}
                                  >
                                    {isActive ? <><Icon name="close" size={10} /> Cerrar</> : <><Icon name="message" size={11} /> Canal</>}
                                  </button>
                                  <button className="btn btn-ghost btn-xs" onClick={() => setDetailModalEstudio(est)}>
                                    ···
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* ---------- DERECHA: reportes + calendario ---------- */}
              <div style={{
                width: 336, flexShrink: 0, borderLeft: '1px solid var(--color-border)',
                overflowY: 'auto', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', gap: 14, padding: '18px 16px',
              }}>
                {/* Reportes — solo mostrar si hay datos */}
                {reportes.length > 0 ? (
                <div className="card-flat" style={{ padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div className="section-title" style={{ marginBottom: 0 }}>
                      <Icon name="chart" size={14} color="var(--color-text-secondary)" /> Reportes Mensuales
                    </div>
                    <button className="btn btn-ghost btn-xs" onClick={exportCSV} title="Descargar reporte en CSV" style={{ gap: 4 }}>
                      <Icon name="download" size={12} /> CSV
                    </button>
                  </div>
                  <p style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginBottom: 14 }}>Últimos 6 meses · placas realizadas</p>
                  <MonthlyChart data={reportes} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 14 }}>
                    <MiniStat label="Placas (6m)" value={reportes.reduce((s, d) => s + d.total, 0)} color="#003366" />
                    <MiniStat label="Diag. recibidos" value={reportes.reduce((s, d) => s + d.diagnosticos, 0)} color="#0f766e" />
                    <MiniStat label="Entregadas" value={reportes.reduce((s, d) => s + d.entregados, 0)} color="#15803d" />
                  </div>
                </div>
                ) : null}

                {/* Top estudios */}
                {topEstudios.length > 0 && (
                  <div className="card-flat" style={{ padding: 18 }}>
                    <div className="section-title">
                      <Icon name="microscope" size={14} color="var(--color-text-secondary)" /> Estudios más frecuentes
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {topEstudios.slice(0, 6).map(t => {
                        const max = topEstudios[0]?.total || 1;
                        const pct = Math.round((t.total / max) * 100);
                        return (
                          <div key={t.tipo}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3 }}>
                              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{t.tipo}</span>
                              <span style={{ color: 'var(--color-text-muted)', fontWeight: 700 }}>{t.total}</span>
                            </div>
                            <div style={{ height: 7, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#003366,#3399FF)', borderRadius: 999 }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Calendario de entregas — solo si hay datos */}
                {entregas.length > 0 ? (
                <div className="card-flat" style={{ padding: 18 }}>
                  <div className="section-title">
                    <Icon name="calendar" size={14} color="var(--color-text-secondary)" /> Entregas de la Semana
                  </div>
                  <p style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginBottom: 12 }}>Ciclo Miércoles → Martes</p>
                  <DeliveryCalendar entregas={entregas} />
                </div>
                ) : null}

                {/* Mensaje cuando no hay ningún dato todavía */}
                {reportes.length === 0 && entregas.length === 0 && topEstudios.length === 0 && (
                  <div className="card-flat" style={{ padding: 28, textAlign: 'center' }}>
                    <Icon name="chart" size={36} color="#cbd5e1" />
                    <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 12, lineHeight: 1.6 }}>
                      Los reportes y el calendario de entregas aparecerán aquí una vez que registres estudios.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modales */}
      {isModalOpen && (
        <RegisterModal
          onClose={() => setIsModalOpen(false)}
          initialPatient={registrationPatient}
          onSuccess={() => {
            setIsModalOpen(false);
            setRegistrationPatient(null);
            if (activeFase === 'Recibida') fetchEstudios();
            else setActiveFase('Recibida');
            fetchStats(); fetchAllCounts(); fetchReportes(); fetchEntregas();
          }}
        />
      )}
      {isSettingsOpen && <AccountSettings onClose={() => setIsSettingsOpen(false)} />}
      <Suspense fallback={null}>
        {isAdminOpen && <AdminPanel onClose={() => setIsAdminOpen(false)} />}
        {isCommunicationOpen && <CommunicationHub onClose={() => setIsCommunicationOpen(false)} />}
        {detailModalEstudio && (
          <StudyDetailModal
            estudio={detailModalEstudio}
            userRole={user.role}
            onClose={() => setDetailModalEstudio(null)}
            onUpdated={() => { fetchEstudios(); fetchStats(); fetchAllCounts(); fetchEntregas(); }}
          />
        )}
      </Suspense>
      {selectedEstudio && (
        <div className="animate-slide-in" style={{ width: 340, flexShrink: 0, borderLeft: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff', position: 'absolute', top: 'var(--topbar-height)', bottom: 0, right: 0, zIndex: 50, boxShadow: '-12px 0 32px -12px rgba(15,23,42,0.25)' }}>
          <CommunicationPanel
            estudio={selectedEstudio}
            onClose={() => setSelectedEstudio(null)}
            onFileUploaded={() => { fetchEstudios(); fetchAllCounts(); }}
          />
        </div>
      )}
      {pacienteDetail && (
        <PacienteExpedienteModal
          paciente={pacienteDetail}
          onClose={() => setPacienteDetail(null)}
          headers={headers}
          onUpdated={() => { buscarPacientes(pacienteBusqueda, pacientePage); fetchAllCounts(); fetchStats(); }}
          onDeleted={() => {
            if (pacienteDetail) {
              const pid = pacienteDetail.id;
              setPacientes(prev => prev.filter(p => p.id !== pid));
              setEstudios(prev => prev.filter(e => e.paciente_id !== pid));
              setPacienteTotal(prev => Math.max(0, prev - 1));
            }
            setPacienteDetail(null);
            fetchEstudios();
            buscarPacientes(pacienteBusqueda, 1);
            setPacientePage(1);
            fetchAllCounts();
            fetchStats();
            fetchReportes();
          }}
          isSuperAdmin={isSuperAdmin}
        />
      )}
      <Suspense fallback={null}>
        {informeEstudio && (
          <InformeViewer
            estudio={informeEstudio}
            userRole={user.role}
            autoPrint={!!informeEstudio.autoPrint}
            onClose={() => setInformeEstudio(null)}
            onSaved={() => { setInformeEstudio(null); fetchEstudios(); fetchAllCounts(); fetchStats(); }}
          />
        )}
      </Suspense>

      {/* ── Modal de confirmación (reemplaza window.confirm) ── */}
      {confirmDialog && (
        <div className="confirm-modal" onClick={() => setConfirmDialog(null)}>
          <div className="confirm-modal-box" onClick={e => e.stopPropagation()}>
            <div className={`confirm-modal-icon ${confirmDialog.variant}`}>
              <Icon
                name={confirmDialog.variant === 'danger' ? 'alertTriangle' : 'info'}
                size={24}
                color={confirmDialog.variant === 'danger' ? 'var(--color-danger)' : 'var(--color-info)'}
              />
            </div>
            <div className="confirm-modal-title">{confirmDialog.title}</div>
            <div className="confirm-modal-body">{confirmDialog.message}</div>
            <div className="confirm-modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDialog(null)}>Cancelar</button>
              <button
                className={`btn ${confirmDialog.variant === 'danger' ? 'btn-danger-solid' : 'btn-primary'}`}
                onClick={() => { setConfirmDialog(null); confirmDialog.onConfirm(); }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ============ Reporte mensual: gráfico de barras SVG ============ */
const MonthlyChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--color-text-muted)', fontSize: 12.5 }}>
        Sin datos aún. Registre placas para ver el reporte.
      </div>
    );
  }
  const max = Math.max(...data.map(d => d.total), 1);
  const barW = 24;
  const chartH = 110;
  return (
    <div>
      <svg viewBox={`0 0 ${data.length * (barW + 12) + 6} ${chartH + 26}`} style={{ width: '100%', height: 'auto' }}>
        {data.map((d, i) => {
          const h = Math.max((d.total / max) * (chartH - 14), 3);
          const x = i * (barW + 12) + 4;
          const y = chartH - h;
          const label = d.mes ? d.mes.slice(5) + '/' + d.mes.slice(2, 4) : '';
          return (
            <g key={d.mes}>
              <rect x={x} y={y} width={barW} height={h} rx="4" fill="url(#barGrad)">
                <title>{`${d.mes}: ${d.total} placas (${d.entregados} entregadas)`}</title>
              </rect>
              <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize="9" fontWeight="700" fill="#003366">{d.total}</text>
              <text x={x + barW / 2} y={chartH + 14} textAnchor="middle" fontSize="8" fill="#94a3b8">{label}</text>
            </g>
          );
        })}
        <defs>
          <linearGradient id="barGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#003366" />
            <stop offset="100%" stopColor="#3399FF" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

const MiniStat = ({ label, value, color }) => (
  <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px', textAlign: 'center', border: '1px solid var(--color-border)' }}>
    <div style={{ fontSize: 18, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
  </div>
);

/* ===== (MiniStat llamado con colores institucionales en Dashboard) ===== */

/* ============ Calendario de entregas ============ */
const DeliveryCalendar = ({ entregas }) => {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const byDay = {};
  entregas.forEach(e => { byDay[e.dia] = e.total; });

  const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  const hoyISO = fmt(today);
  const isToday = (iso) => iso === hoyISO;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {DIAS_SEMANA.map((dia, i) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        const iso = fmt(d);
        const count = byDay[iso] || 0;
        const todayF = isToday(iso);
        return (
          <div
            key={dia}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              background: todayF ? '#eff6ff' : '#f8fafc', borderRadius: 10,
              border: todayF ? '1px solid var(--color-secondary)' : '1px solid var(--color-border)',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: todayF ? 'var(--color-primary)' : 'var(--color-text-secondary)', width: 72 }}>{dia}</span>
            {todayF && (
              <span style={{ fontSize: 9.5, fontWeight: 700, color: '#1d4ed8', background: '#dbeafe', padding: '1px 7px', borderRadius: 999, letterSpacing: '0.03em' }}>
                HOY
              </span>
            )}              <div style={{ flex: 1, height: 18, background: '#e2e8f0', borderRadius: 9, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(count * 14, 100)}%`, height: '100%',
                background: 'linear-gradient(90deg,#3399FF,#66b8ff)', borderRadius: 9,
                transition: 'width 0.4s ease',
              }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: count > 0 ? 'var(--color-primary)' : '#cbd5e1', width: 20, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {count}
            </span>
          </div>
        );
      })}
      <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6, lineHeight: 1.5 }}>
        La barra muestra las placas con entrega estimada por día. El ciclo de entrega corre de miércoles a martes.
      </p>
    </div>
  );
};

/* ============ Expediente de paciente ============ */
const PacienteExpedienteModal = ({ paciente, onClose, headers, onUpdated, onDeleted, isSuperAdmin }) => {
  const { user } = useContext(AuthContext);
  const [tab, setTab] = useState('estudios'); // 'estudios' | 'historial'
  const [estudios, setEstudios] = useState([]);
  const [loading, setLoading] = useState(true);
  // Historial
  const [historial, setHistorial] = useState([]);
  const [historialPage, setHistorialPage] = useState(1);
  const [historialPages, setHistorialPages] = useState(1);
  const [historialTotal, setHistorialTotal] = useState(0);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [borrando, setBorrando] = useState(false);
  // Resto del estado
  const [informeEstudio, setInformeEstudio] = useState(null);
  const [pacienteData, setPacienteData] = useState(paciente);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [form, setForm] = useState({
    telefono: paciente.telefono || '',
    direccion: paciente.direccion || '',
    correo: paciente.correo || '',
    notas: paciente.notas || '',
  });
  const puedeEditar = user.role === 'ENCARGADO' || user.role === 'SUPER_ADMIN';

  const ACCION_LABELS = {
    ESTUDIO_REGISTRADO: 'Estudio registrado',
    ESTUDIO_ELIMINADO:  'Estudio eliminado',
    ESTADO_CAMBIADO:    'Estado cambiado',
    DIAGNOSTICO_ENVIADO:'Diagnóstico emitido',
    DIAGNOSTICO_EDITADO:'Diagnóstico corregido',
    ESTUDIO_DEVUELTO:   'Estudio devuelto',
    ESTUDIO_INICIADO:   'Lectura iniciada',
    ARCHIVOS_SUBIDOS:   'Archivos subidos',
    PLACAS_ENVIADAS:    'Placas enviadas',
    PLACAS_DESCARGADAS: 'Placas descargadas',
    ARCHIVO_DESCARGADO: 'Archivo descargado',
    ARCHIVO_ELIMINADO:  'Archivo eliminado',
    EXPORTAR_DESKTOP:   'Exportado al escritorio',
    PACIENTE_CREADO:    'Paciente registrado',
    PACIENTE_ELIMINADO: 'Paciente eliminado',
    DESCARGA_INFORME:   'Informe descargado',
    DESCARGA_ZIP:       'ZIP descargado',
  };

  const loadHistorial = useCallback((page = 1) => {
    setHistorialLoading(true);
    fetch(`${API_URL}/api/pacientes/${paciente.id}/historial?page=${page}&limit=15`, { headers })
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
  }, [paciente.id, user.token]);

  const guardarCambios = async (evento) => {
    evento.preventDefault();
    setErrorForm('');
    setGuardando(true);
    try {
      const res = await fetch(`${API_URL}/api/pacientes/${pacienteData.id}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'No se pudieron guardar los datos');
      setPacienteData(data);
      setEditando(false);
      onUpdated?.();
    } catch (error) {
      setErrorForm(error.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminarPaciente = async () => {
    setConfirmDialog({
      title: 'Eliminar expediente',
      message: `Se eliminarán el paciente ${pacienteData.registro_id}, sus estudios, mensajes y archivos. Esta acción no se puede deshacer.`,
      variant: 'danger',
      confirmLabel: 'Eliminar expediente',
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_URL}/api/pacientes/${pacienteData.id}`, { method: 'DELETE', headers });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo eliminar el paciente');
          onDeleted?.();
          onClose();
        } catch (error) {
          setErrorForm(error.message);
        }
      },
    });
  };

  const eliminarHistorial = () => {
    setConfirmDialog({
      title: 'Borrar historial de acciones',
      message: `Se eliminarán permanentemente todas las entradas del historial de ${pacienteData.nombre}. No se puede deshacer.`,
      variant: 'danger',
      confirmLabel: 'Borrar historial',
      onConfirm: async () => {
        setBorrando(true);
        try {
          const res = await fetch(`${API_URL}/api/pacientes/${pacienteData.id}/historial`, { method: 'DELETE', headers });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo borrar el historial');
          setHistorial([]);
          setHistorialTotal(0);
          setHistorialPages(1);
          setHistorialPage(1);
        } catch (error) {
          setErrorForm(error.message);
        } finally {
          setBorrando(false);
        }
      },
    });
  };

  const eliminarEntradaHistorial = (historiaId) => {
    setConfirmDialog({
      title: 'Eliminar evento del historial',
      message: '¿Deseas eliminar este registro específico del historial del paciente?',
      variant: 'danger',
      confirmLabel: 'Eliminar entrada',
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_URL}/api/pacientes/${pacienteData.id}/historial/${historiaId}`, { method: 'DELETE', headers });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo eliminar la entrada');
          loadHistorial(historialPage);
        } catch (error) {
          setErrorForm(error.message);
        }
      },
    });
  };

  useEffect(() => {
    fetch(`${API_URL}/api/pacientes/${paciente.id}/estudios`, { headers })
      .then(r => r.json())
      .then(d => { if (d && Array.isArray(d.estudios)) setEstudios(d.estudios); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [paciente.id, user.token]);

  // Cargar historial cuando se activa esa pestaña
  useEffect(() => {
    if (tab === 'historial') loadHistorial(1);
  }, [tab, loadHistorial]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 760 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{
            width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#eff6ff,#dbeafe)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon name="user" size={26} color="#1a66b3" />
          </div>
          <div className="flex-1">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)' }}>{pacienteData.nombre}</span>
              <span className="chip mono">{pacienteData.registro_id}</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 3 }}>
              {pacienteData.edad} años · {sexoLabel(pacienteData.sexo)} · Nacimiento: {pacienteData.fecha_nacimiento || '—'}
            </p>
            {(pacienteData.telefono || pacienteData.correo || pacienteData.direccion) && (
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                {[pacienteData.telefono, pacienteData.correo, pacienteData.direccion].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <button className="modal-close" onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="tabs" style={{ padding: '0 24px', flexShrink: 0 }}>
          {[
            { id: 'estudios', icon: 'clipboard', label: `Estudios (${estudios.length})` },
            { id: 'historial', icon: 'clock', label: `Historial${historialTotal > 0 ? ` (${historialTotal})` : ''}` },
          ].map(t => (
            <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)} style={{ gap: 6 }}>
              <Icon name={t.icon} size={13} color="currentColor" /> {t.label}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {/* ── Botones de acción (siempre visibles) ── */}
          {puedeEditar && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setEditando(v => !v); setErrorForm(''); }} style={{ gap: 6 }}>
                <Icon name="edit" size={13} /> {editando ? 'Cancelar edición' : 'Editar datos de contacto'}
              </button>
              <button className="btn btn-danger btn-sm" onClick={eliminarPaciente} style={{ gap: 6 }}>
                <Icon name="trash" size={13} /> Eliminar expediente
              </button>
              {puedeEditar && tab === 'historial' && historialTotal > 0 && (
                <button className="btn btn-danger btn-sm" onClick={eliminarHistorial} disabled={borrando} style={{ gap: 6, marginLeft: 'auto' }}>
                  <Icon name="trash" size={13} /> {borrando ? 'Borrando…' : 'Borrar historial completo'}
                </button>
              )}
            </div>
          )}

          {editando && (
            <form onSubmit={guardarCambios} className="card-flat" style={{ padding: 16, margin: '0 0 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {errorForm && <div className="alert alert-danger"><span>⚠️</span><span>{errorForm}</span></div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="field-label" htmlFor="pac-tel">Teléfono</label>
                  <input id="pac-tel" className="input" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="(000) 000-0000" />
                </div>
                <div>
                  <label className="field-label" htmlFor="pac-mail">Correo</label>
                  <input id="pac-mail" type="email" className="input" value={form.correo} onChange={e => setForm({ ...form, correo: e.target.value })} placeholder="paciente@correo.com" />
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="pac-dir">Dirección</label>
                <input id="pac-dir" className="input" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} />
              </div>
              <div>
                <label className="field-label" htmlFor="pac-notas">Notas del expediente</label>
                <textarea id="pac-notas" className="input" rows={3} value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} style={{ resize: 'vertical', fontSize: 12.5 }} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditando(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar datos'}</button>
              </div>
            </form>
          )}

          {!editando && errorForm && (
            <div className="alert alert-danger" style={{ marginBottom: 16 }}><span>⚠️</span><span>{errorForm}</span></div>
          )}

          {/* ══ PESTAÑA: ESTUDIOS ══ */}
          {tab === 'estudios' && (
            <>
              <div className="section-title">
                <Icon name="clipboard" size={13} color="var(--color-text-secondary)" /> Historial clínico completo
              </div>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 90 }} />)}
                </div>
              ) : estudios.length === 0 ? (
                <div className="empty-state" style={{ padding: 32 }}>
                  <div style={{ marginBottom: 10 }}><Icon name="folder" size={40} color="#94a3b8" /></div>
                  <h4>Sin estudios</h4>
                  <p>Este paciente no tiene estudios registrados.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {estudios.map(e => {
                    const ec = ESTADO_COLORS[e.estado] || ESTADO_COLORS['Recibida'];
                    return (
                      <div key={e.id} className="card-flat" style={{ padding: 14, margin: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-primary)' }}>{e.tipo_estudio || '—'}</span>
                          <span className="badge" style={{ background: ec.bg, color: ec.text, fontSize: 11 }}>
                            <span className="badge-dot" style={{ background: ec.dot }} />
                            {e.estado}
                          </span>
                          <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                            {e.fecha_estudio} · Ref: {e.medico_remitente}
                          </span>
                        </div>
                        {e.notas_clinicas && (
                          <p style={{ fontSize: 12, color: '#15803d', background: 'var(--color-success-bg)', padding: '8px 12px', borderRadius: 8, marginBottom: 8, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                            <Icon name="info" size={13} color="#15803d" style={{ flexShrink: 0, marginTop: 1 }} /> {e.notas_clinicas}
                          </p>
                        )}
                        {e.diagnostico ? (
                          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <div style={{
                              flex: 1, fontSize: 13, color: 'var(--color-text)', lineHeight: 1.65,
                              fontFamily: '"Times New Roman", Times, serif', whiteSpace: 'pre-wrap',
                              background: '#fcfcfd', border: '1px solid var(--color-border)', borderRadius: 8,
                              padding: '10px 14px', maxHeight: 100, overflow: 'hidden',
                            }}>
                              {e.diagnostico}
                            </div>
                            <button
                              className="btn btn-primary btn-xs"
                              style={{ flexShrink: 0, gap: 4 }}
                              onClick={() => setInformeEstudio({ ...e, nombre: paciente.nombre, registro_id: paciente.registro_id, edad: paciente.edad })}
                            >
                              <Icon name="eye" size={11} color="#fff" /> Ver
                            </button>
                          </div>
                        ) : (
                          <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Sin diagnóstico emitido aún.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ══ PESTAÑA: HISTORIAL ══ */}
          {tab === 'historial' && (
            <>
              <div className="section-title" style={{ marginBottom: 12 }}>
                <Icon name="clock" size={13} color="var(--color-text-secondary)" />
                Historial de acciones · {historialTotal} registro{historialTotal !== 1 ? 's' : ''}
              </div>

              {historialLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 52 }} />)}
                </div>
              ) : historial.length === 0 ? (
                <div className="empty-state" style={{ padding: 32 }}>
                  <div style={{ marginBottom: 10 }}><Icon name="clock" size={40} color="#94a3b8" /></div>
                  <h4>Sin registros</h4>
                  <p>No hay acciones registradas para este paciente.</p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {historial.map(h => (
                      <div key={h.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 14px', borderRadius: 10,
                        background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                      }}>
                        {/* Dot de color según tipo */}
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: h.accion?.includes('ELIMINADO') || h.accion?.includes('DEVUELTO') ? '#f43f5e'
                            : h.accion?.includes('REGISTRADO') || h.accion?.includes('CREADO') ? '#22c55e'
                            : h.accion?.includes('ENVIADO') || h.accion?.includes('ENVIADA') ? '#f97316'
                            : '#3399FF',
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                              {ACCION_LABELS[h.accion] || h.accion}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', background: 'var(--color-surface-3)', borderRadius: 6, padding: '1px 7px' }}>
                              {h.usuario_nombre} · {h.rol}
                            </span>
                          </div>
                          {h.detalle && (
                            <p style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {h.detalle}
                            </p>
                          )}
                        </div>
                        <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)', flexShrink: 0, textAlign: 'right', lineHeight: 1.4 }}>
                          {h.created_at?.split(' ')[0]}<br />
                          <span style={{ fontWeight: 600 }}>{h.created_at?.split(' ')[1]?.slice(0, 5)}</span>
                        </span>
                        {puedeEditar && (
                          <button
                            className="btn btn-ghost btn-xs"
                            title="Eliminar esta entrada del historial"
                            onClick={() => eliminarEntradaHistorial(h.id)}
                            style={{ padding: 4, color: '#dc2626' }}
                          >
                            <Icon name="trash" size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Paginación del historial */}
                  {historialPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 4px 0' }}>
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        Página {historialPage} de {historialPages}
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={historialPage <= 1}
                          onClick={() => { const p = historialPage - 1; setHistorialPage(p); loadHistorial(p); }}
                          style={{ gap: 5 }}
                        >
                          <Icon name="chevronLeft" size={13} /> Anterior
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={historialPage >= historialPages}
                          onClick={() => { const p = historialPage + 1; setHistorialPage(p); loadHistorial(p); }}
                          style={{ gap: 5 }}
                        >
                          Siguiente <Icon name="chevronRight" size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
    <Suspense fallback={null}>
    {informeEstudio && (
      <InformeViewer
        estudio={informeEstudio}
        userRole={user.role}
        autoPrint={!!informeEstudio.autoPrint}
        onClose={() => setInformeEstudio(null)}
        onSaved={() => {
          setInformeEstudio(null);
          fetch(`${API_URL}/api/pacientes/${paciente.id}/estudios`, { headers })
            .then(r => r.json())
            .then(d => { if (d && Array.isArray(d.estudios)) setEstudios(d.estudios); })
            .catch(() => {});
        }}
      />
    )}
    </Suspense>

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

const SidebarStat = ({ label, value, color }) => (
  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '9px 6px', textAlign: 'center' }}>
    <div style={{ fontSize: 19, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.5)', marginTop: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
  </div>
);

export default Dashboard;
