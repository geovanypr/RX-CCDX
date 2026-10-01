import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { marcarOrigenAdmin, limpiarOrigenAdmin } from '../utils/adminPreview';
import { AuthContext } from '../context/AuthContext';
import { NotificationContext } from '../context/NotificationContext';
import { API_URL } from '../config';
import Icon from './Icons';
import ThemeToggle from './ThemeToggle';
import NotificationCenter from './NotificationCenter';
import AccountSettings from './AccountSettings';
import AdminPanel from './AdminPanel';

// Panel propio del Super Administrador: identidad diferenciada de las vistas
// operativas (encargada / radiólogo), con resumen del sistema, supervisión de
// las bandejas y las herramientas de administración integradas.
const SECCIONES = [
  { id: 'resumen', icon: 'chart', label: 'Resumen del sistema' },
  { id: 'usuarios', icon: 'users', label: 'Usuarios' },
  { id: 'auditoria', icon: 'clipboard', label: 'Auditoría' },
  { id: 'plantillas', icon: 'fileText', label: 'Plantillas' },
  { id: 'parametros', icon: 'settings', label: 'Parámetros' },
];

const TITULOS = {
  resumen: 'Resumen del sistema',
  usuarios: 'Gestión de usuarios',
  auditoria: 'Auditoría del sistema',
  plantillas: 'Plantillas de diagnóstico',
  parametros: 'Parámetros del centro',
};

const SuperAdminPanel = () => {
  const { user, logout } = useContext(AuthContext);
  const { on, off, pendingRadiologo, pendingEncargado } = useContext(NotificationContext);
  const navigate = useNavigate();
  // Entrar a una vista operativa marcando el origen: solo así aparece el
  // botón "Volver al Portal SuperAdmin" dentro de esa vista.
  const verComoEncargada = (fase, view) => {
    marcarOrigenAdmin('dashboard');
    const state = { fromAdmin: true };
    if (fase) { state.fase = fase; state.view = view || 'placas'; }
    else if (view) { state.view = view; }
    navigate('/dashboard', { state });
  };
  const verComoRadiologo = () => {
    marcarOrigenAdmin('radiologo');
    navigate('/radiologo', { state: { fromAdmin: true } });
  };
  const [seccion, setSeccion] = useState('resumen');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [porEstado, setPorEstado] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [totalPacientes, setTotalPacientes] = useState(null);
  const [actividad, setActividad] = useState([]);
  const [numPlantillas, setNumPlantillas] = useState(null);
  const [apiOk, setApiOk] = useState(null);
  const [cargando, setCargando] = useState(true);

  const headers = { Authorization: `Bearer ${user.token}` };

  const cargarResumen = useCallback(() => {
    setCargando(true);
    Promise.all([
      fetch(`${API_URL}/api/stats`, { headers }).then(r => r.json()).catch(() => null),
      fetch(`${API_URL}/api/stats/por-estado`, { headers }).then(r => r.json()).catch(() => null),
      fetch(`${API_URL}/api/usuarios`, { headers }).then(r => r.json()).catch(() => null),
      fetch(`${API_URL}/api/pacientes/buscar?q=&limit=5`, { headers }).then(r => r.json()).catch(() => null),
      fetch(`${API_URL}/api/auditoria?limit=8`, { headers }).then(r => r.json()).catch(() => null),
      fetch(`${API_URL}/api/plantillas`, { headers }).then(r => r.json()).catch(() => null),
      fetch(`${API_URL}/api/health`).then(r => r.json()).then(() => true).catch(() => false),
    ]).then(([st, pe, us, pac, aud, tpl, health]) => {
      if (st && typeof st === 'object') setStats(st);
      if (pe && typeof pe === 'object') setPorEstado(pe);
      if (Array.isArray(us)) setUsuarios(us);
      if (pac && typeof pac.total === 'number') setTotalPacientes(pac.total);
      if (Array.isArray(aud)) setActividad(aud);
      if (Array.isArray(tpl)) setNumPlantillas(tpl.length);
      setApiOk(health);
    }).finally(() => setCargando(false));
  }, [user.token]);

  useEffect(() => { cargarResumen(); }, [cargarResumen]);

  // Resumen en vivo: cualquier cambio operativo lo actualiza sin refrescar.
  useEffect(() => {
    const recargar = () => cargarResumen();
    const eventos = ['estudio:nuevo', 'estudio:enviado', 'estudio:devuelto', 'estudio:actualizado',
      'estudio:eliminado', 'estudio:tomado', 'diagnostico:recibido', 'paciente:nuevo',
      'paciente:actualizado', 'paciente:eliminado', 'usuario:actualizado',
      'plantilla:actualizada', 'sesion:resincronizada'];
    eventos.forEach(ev => on(ev, recargar));
    return () => { eventos.forEach(ev => off(ev, recargar)); };
  }, [on, off, cargarResumen]);

  const handleLogout = () => { limpiarOrigenAdmin(); logout(); navigate('/login', { replace: true }); };

  const usuariosActivos = usuarios.filter(u => u.activo === 1).length;
  const encargados = usuarios.filter(u => u.role === 'ENCARGADO').length;
  const radiologos = usuarios.filter(u => u.role === 'RADIOLOGO').length;
  // Solo cuenta si es un objeto plano de conteos (una respuesta de error no debe romper el resumen).
  const conteosValidos = porEstado && typeof porEstado === 'object' && !Array.isArray(porEstado)
    && Object.values(porEstado).every(v => typeof v === 'number');
  const totalPorEstado = conteosValidos ? Object.values(porEstado).reduce((a, b) => a + b, 0) : 0;

  const tarjetas = [
    { label: 'Estudios este mes', valor: stats?.totalMes, icon: 'calendar', color: '#1a66b3', bg: '#eff6ff', accion: () => verComoEncargada('Recibida') },
    { label: 'Estudios en total', valor: stats?.totalAll, icon: 'inbox', color: '#1a66b3', bg: '#eff6ff', accion: () => verComoEncargada('Recibida') },
    { label: 'Pendientes de flujo', valor: stats?.pendientes, icon: 'clock', color: '#b45309', bg: '#fffbeb', accion: () => verComoEncargada('Recibida') },
    { label: 'Urgentes sin entregar', valor: stats?.urgentes, icon: 'warning', color: '#dc2626', bg: '#fef2f2', accion: () => verComoEncargada('Enviada al radiólogo') },
    { label: 'Vencidos', valor: stats?.vencidos, icon: 'calendar', color: '#dc2626', bg: '#fef2f2', accion: () => verComoEncargada('Diagnóstico recibido') },
    { label: 'Pacientes', valor: totalPacientes, icon: 'users', color: '#0d9488', bg: '#f0fdfa', accion: () => verComoEncargada(null, 'pacientes') },
    { label: 'Usuarios activos', valor: usuarios.length ? `${usuariosActivos}/${usuarios.length}` : null, icon: 'user', color: '#7e22ce', bg: '#faf5ff', accion: () => setSeccion('usuarios') },
    { label: 'Entregados', valor: stats?.entregados, icon: 'check', color: '#15803d', bg: '#f0fdf4', accion: () => verComoEncargada('Entregado') },
  ];

  const itemNav = (id, icon, label, badge) => (
    <button
      key={id}
      onClick={() => setSeccion(id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
        background: seccion === id ? 'rgba(255,255,255,0.14)' : 'transparent',
        color: seccion === id ? '#fff' : 'rgba(255,255,255,0.72)',
        fontSize: 13.5, fontWeight: seccion === id ? 700 : 500, textAlign: 'left',
      }}
    >
      <Icon name={icon} size={15} color={seccion === id ? '#e9d5ff' : 'rgba(255,255,255,0.6)'} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge != null && badge > 0 && (
        <span style={{ background: '#dc2626', color: '#fff', fontSize: 10.5, fontWeight: 800, borderRadius: 999, padding: '1px 7px' }}>{badge}</span>
      )}
    </button>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* ── Barra lateral administrativa (identidad propia, morada) ── */}
      <aside style={{
        width: 248, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4,
        padding: '18px 14px', color: '#fff',
        background: 'linear-gradient(180deg, #2e1065 0%, #1e0a44 60%, #150832 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 6px 14px' }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="shield" size={20} color="#e9d5ff" />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>RX CCDX</p>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, background: '#7e22ce', borderRadius: 999, padding: '2px 8px' }}>
              SUPER ADMIN
            </span>
          </div>
        </div>

        <p style={{ margin: '6px 6px 4px', fontSize: 10.5, fontWeight: 700, letterSpacing: 0.8, color: 'rgba(255,255,255,0.45)' }}>ADMINISTRACIÓN</p>
        {SECCIONES.map(s => itemNav(s.id, s.icon, s.label))}

        <p style={{ margin: '12px 6px 4px', fontSize: 10.5, fontWeight: 700, letterSpacing: 0.8, color: 'rgba(255,255,255,0.45)' }}>SUPERVISIÓN OPERATIVA</p>
        <button
          onClick={() => verComoEncargada()}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'transparent', color: 'rgba(255,255,255,0.72)', fontSize: 13.5, fontWeight: 500, textAlign: 'left' }}
        >
          <Icon name="inbox" size={15} color="rgba(255,255,255,0.6)" />
          <span style={{ flex: 1 }}>Vista Encargada</span>
          {pendingEncargado > 0 && <span style={{ background: '#dc2626', color: '#fff', fontSize: 10.5, fontWeight: 800, borderRadius: 999, padding: '1px 7px' }}>{pendingEncargado}</span>}
        </button>
        <button
          onClick={verComoRadiologo}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'transparent', color: 'rgba(255,255,255,0.72)', fontSize: 13.5, fontWeight: 500, textAlign: 'left' }}
        >
          <Icon name="microscope" size={15} color="rgba(255,255,255,0.6)" />
          <span style={{ flex: 1 }}>Vista Radiólogo</span>
          {pendingRadiologo > 0 && <span style={{ background: '#dc2626', color: '#fff', fontSize: 10.5, fontWeight: 800, borderRadius: 999, padding: '1px 7px' }}>{pendingRadiologo}</span>}
        </button>

        <div style={{ flex: 1 }} />
        <button
          onClick={() => setIsSettingsOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'transparent', color: 'rgba(255,255,255,0.72)', fontSize: 13.5, fontWeight: 500 }}
        >
          <Icon name="key" size={15} color="rgba(255,255,255,0.6)" /> Ajustes de cuenta
        </button>
        <button
          onClick={handleLogout}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'transparent', color: 'rgba(255,255,255,0.72)', fontSize: 13.5, fontWeight: 500 }}
        >
          <Icon name="logout" size={15} color="rgba(255,255,255,0.6)" /> Cerrar sesión
        </button>
        <p style={{ margin: '10px 6px 0', fontSize: 10.5, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Creadores: GYPR y AnabelLp</p>
      </aside>

      {/* ── Contenido ── */}
      <main style={{ flex: 1, minWidth: 0, padding: '20px 26px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 20, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="shield" size={20} color="#7e22ce" /> {TITULOS[seccion]}
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--color-text-muted)' }}>
              {user.username} · Super Administrador · Modo Fantasma (invisible para el personal)
            </p>
          </div>
          <span className={`badge ${apiOk === false ? 'badge-red' : 'badge-green'}`} title="Estado de la API en Render">
            {apiOk === null ? '● Verificando API…' : apiOk ? '● API conectada' : '● API sin respuesta'}
          </span>
          <NotificationCenter />
          <ThemeToggle />
        </div>

        {seccion === 'resumen' && (
          <>
            {cargando ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
                  {tarjetas.map(t => (
                    <button
                      key={t.label}
                      onClick={t.accion}
                      title="Ver detalle"
                      className="card-flat"
                      style={{ padding: '14px 16px', margin: 0, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', border: '1px solid transparent', textAlign: 'left', background: 'var(--color-surface)' }}
                    >
                      <div style={{ width: 38, height: 38, borderRadius: 11, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon name={t.icon} size={17} color={t.color} />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--color-text)' }}>{t.valor ?? '—'}</p>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{t.label}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {(stats?.vencidos > 0 || stats?.urgentes > 0) && (
                  <div className="alert alert-danger" style={{ marginBottom: 16 }}>
                    <span>⚠️</span>
                    <span>
                      {stats?.urgentes > 0 && <><strong>{stats.urgentes}</strong> urgente(s) sin entregar. </>}
                      {stats?.vencidos > 0 && <><strong>{stats.vencidos}</strong> estudio(s) con entrega vencida. </>}
                      <button onClick={() => verComoEncargada('Diagnóstico recibido')} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', fontWeight: 800, textDecoration: 'underline', cursor: 'pointer' }}>
                        Revisar en bandeja de Encargada →
                      </button>
                    </span>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div className="card-flat" style={{ padding: '16px 18px', margin: 0 }}>
                    <p className="section-title" style={{ marginBottom: 12 }}>Estudios por estado <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--color-text-muted)' }}>(clic para ver bandeja)</span></p>
                    {!conteosValidos || totalPorEstado === 0 ? (
                      <p className="text-muted" style={{ fontSize: 13 }}>Aún no hay estudios registrados.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {Object.entries(porEstado).map(([estado, total]) => (
                          <button
                            key={estado}
                            onClick={() => verComoEncargada(estado)}
                            title={`Ver bandeja: ${estado}`}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer', textAlign: 'left' }}
                          >
                            <span style={{ flex: '0 0 220px', fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{estado}</span>
                            <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--color-border, #e5e7eb)', overflow: 'hidden' }}>
                              <div style={{ width: `${totalPorEstado ? Math.round((total / totalPorEstado) * 100) : 0}%`, height: '100%', borderRadius: 999, background: '#7e22ce' }} />
                            </div>
                            <strong style={{ flex: '0 0 30px', textAlign: 'right', fontSize: 13, color: 'var(--color-text)' }}>{total}</strong>
                          </button>
                        ))}
                      </div>
                    )}
                    <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {encargados} encargado(s) · {radiologos} radiólogo(s) · En bandeja de radiólogo: <strong>{pendingRadiologo}</strong> · Por entregar: <strong>{pendingEncargado}</strong>
                    </p>
                  </div>

                  <div className="card-flat" style={{ padding: '16px 18px', margin: 0 }}>
                    <p className="section-title" style={{ marginBottom: 12 }}>Supervisión operativa</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <button className="btn btn-primary" onClick={() => verComoEncargada()} style={{ justifyContent: 'flex-start', gap: 8 }}>
                        <Icon name="inbox" size={15} color="#fff" /> Ver bandeja de Encargada
                      </button>
                      <button className="btn btn-primary" onClick={verComoRadiologo} style={{ justifyContent: 'flex-start', gap: 8 }}>
                        <Icon name="microscope" size={15} color="#fff" /> Ver estación de Radiólogo
                      </button>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                        Entras en modo supervisión con todos los permisos. Tus acciones quedan registradas en la auditoría.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="card-flat" style={{ padding: '16px 18px', margin: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                    <p className="section-title" style={{ margin: 0, flex: 1 }}>Actividad reciente</p>
                    <button className="btn btn-ghost btn-xs" onClick={() => setSeccion('auditoria')}>Ver auditoría completa →</button>
                  </div>
                  {actividad.length === 0 ? (
                    <p className="text-muted" style={{ fontSize: 13 }}>Sin actividad registrada.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {actividad.map(a => (
                        <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12.5 }}>
                          <span className="mono" style={{ color: 'var(--color-text-muted)', fontSize: 10.5, flexShrink: 0 }}>{String(a.created_at || '').replace('T', ' ').slice(0, 16)}</span>
                          <span className="badge badge-blue" style={{ flexShrink: 0, fontSize: 10.5 }}>{a.accion}</span>
                          <span style={{ color: 'var(--color-text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.detalle}</span>
                          <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>{a.usuario_nombre} ({a.rol})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="card-flat" style={{ padding: '16px 18px', margin: '0 0 16px' }}>
                  <p className="section-title" style={{ marginBottom: 12 }}>Sistema</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12.5 }}>
                    <div>
                      <p style={{ margin: '0 0 2px', color: 'var(--color-text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>API (Render)</p>
                      <p className="mono" style={{ margin: 0, color: 'var(--color-text)', wordBreak: 'break-all' }}>{API_URL}</p>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 2px', color: 'var(--color-text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>App web</p>
                      <p className="mono" style={{ margin: 0, color: 'var(--color-text)', wordBreak: 'break-all' }}>{window.location.origin}</p>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 2px', color: 'var(--color-text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Plantillas</p>
                      <p style={{ margin: 0, color: 'var(--color-text)', fontWeight: 700 }}>{numPlantillas ?? '—'} <button onClick={() => setSeccion('plantillas')} style={{ background: 'none', border: 'none', padding: 0, color: '#7e22ce', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>gestionar →</button></p>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 2px', color: 'var(--color-text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Anti-suspensión</p>
                      <p style={{ margin: 0, color: 'var(--color-text)' }}>GitHub Actions cada 10 min → /api/health</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {seccion !== 'resumen' && (
          <AdminPanel embedded initialTab={seccion} />
        )}
      </main>

      {isSettingsOpen && <AccountSettings onClose={() => setIsSettingsOpen(false)} />}
    </div>
  );
};

export default SuperAdminPanel;
