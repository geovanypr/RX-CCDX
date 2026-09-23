import React, { useState, useEffect, useContext, useCallback, useRef, Suspense, lazy } from 'react';
import AccountSettings from './AccountSettings';
import CommunicationPanel from './CommunicationPanel';
import RegisterModal from './RegisterModal';
import ThemeToggle from './ThemeToggle';

// Solo se descargan cuando el radiólogo los abre.
const CommunicationHub = lazy(() => import('./CommunicationHub'));
const InformeViewer = lazy(() => import('./InformeViewer'));
import Icon from './Icons';
import PacsViewer from './PacsViewer';
import { API_URL, authenticatedFileUrl, downloadAuthenticatedFile } from '../config';
import { parseFechaServidor } from '../utils/format';
import { categoriaSugerida, regionDeTipo } from '../utils/catalogoRadiologia';
import NotificationCenter from './NotificationCenter';
import { AuthContext } from '../context/AuthContext';
import { NotificationContext } from '../context/NotificationContext';
import { useTheme } from '../utils/useTheme';


const WORKLIST_ESTADOS = ['Recibida', 'Pendiente de enviar al radiólogo', 'Enviada al radiólogo', 'Devuelta por revisión'];

// Plantillas predeterminadas (las personalizadas se cargan desde el servidor)
const DEFAULT_TEMPLATES = [
  { id: 'default-torax', label: 'Tórax normal', texto: 'Campos pulmonares de apariencia normal. No se observan imágenes de condensación, derrame ni neumotórax. Silueta cardiomediastínica dentro de límites normales. Estructuras óseas sin alteraciones evidentes.\n\nCONCLUSIÓN: Radiografía de tórax sin hallazgos patológicos significativos.' },
  { id: 'default-cervical', label: 'Columna cervical', texto: 'Se observa rectificación de la lordosis cervical fisiológica. Los espacios intervertebrales se encuentran conservados. No se aprecian fracturas ni listesis. Los procesos articulares y los agujeros de conjunción sin alteraciones significativas.\n\nCONCLUSIÓN: Cambios posturales a nivel cervical. Correlacionar con clínica.' },
  { id: 'default-sin-hallazgos', label: 'Sin hallazgos', texto: 'Estudio radiográfico dentro de parámetros normales. No se identifican lesiones óseas, imágenes de consolidación ni otras alteraciones patológicas evidentes.\n\nCONCLUSIÓN: Estudio sin hallazgos patológicos de importancia.' },
];

const DRAFT_KEY = (userId, id) => `rxccdx_draft_u${userId}_${id}`;

const RadiologistView = () => {
  const [diagnostico, setDiagnostico] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommunicationOpen, setIsCommunicationOpen] = useState(false);
  const [estudios, setEstudios] = useState([]);
  const [worklistSearch, setWorklistSearch] = useState('');
  const [selectedEstudio, setSelectedEstudio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [archivos, setArchivos] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [plantillaBusqueda, setPlantillaBusqueda] = useState('');
  const [customTemplates, setCustomTemplates] = useState([]);
  const [worklistFiltro, setWorklistFiltro] = useState('pendientes'); // 'pendientes' | 'todos'
  const [historial, setHistorial] = useState(null);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [centro, setCentro] = useState(null);
  const [informeEstudio, setInformeEstudio] = useState(null);
  const [takingStudy, setTakingStudy] = useState(null);
  const [sendingImages, setSendingImages] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [descargandoPlacas, setDescargandoPlacas] = useState(false);
  const [comparacion, setComparacion] = useState(null);
  const [showDevolverModal, setShowDevolverModal] = useState(false);
  const [notaDevolucion, setNotaDevolucion] = useState('');
  const [submittingDevolver, setSubmittingDevolver] = useState(false);
  const { logout, user } = useContext(AuthContext);
  const { pendingRadiologo, setPendingRadiologo, unreadMessages, setUnreadMessages, on, off, fetchPendingCounts, addNotification } = useContext(NotificationContext);
  const { isDark, toggleTheme } = useTheme(user?.id);
  const textareaRef = useRef(null);

  const headers = { Authorization: `Bearer ${user.token}` };

  const fetchEstudios = useCallback(() => {
    setLoading(true);
    const fetchPromise = worklistFiltro === 'todos'
      ? fetch(`${API_URL}/api/estudios`, { headers }).then(r => r.json())
      : Promise.all(
          WORKLIST_ESTADOS.map(s =>
            fetch(`${API_URL}/api/estudios?estado=${encodeURIComponent(s)}`, { headers }).then(r => r.json())
          )
        ).then(results => results.flat());

    fetchPromise.then(d => {
      const all = Array.isArray(d) ? d.filter(e => e && e.id) : [];
      all.sort((a, b) => {
        if (a.estado === 'Devuelta por revisión' && b.estado !== 'Devuelta por revisión') return -1;
        if (b.estado === 'Devuelta por revisión' && a.estado !== 'Devuelta por revisión') return 1;
        if (!!a.urgente !== !!b.urgente) return a.urgente ? -1 : 1;
        const fechaA = parseFechaServidor(a.fecha_creacion)?.getTime() || 0;
        const fechaB = parseFechaServidor(b.fecha_creacion)?.getTime() || 0;
        return fechaB - fechaA;
      });
      setEstudios(all);
      if (worklistFiltro === 'pendientes') setPendingRadiologo(all.length);
      setSelectedEstudio(prev => {
        if (all.length === 0) return null;
        if (prev && all.find(e => e.id === prev.id)) return prev;
        return all[0];
      });
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, [user.token, setPendingRadiologo, worklistFiltro]);

  useEffect(() => {
    fetchEstudios();
  }, [worklistFiltro]);

  const loadArchivos = useCallback((estudio) => {
    if (!estudio) { setArchivos([]); return; }
    fetch(`${API_URL}/api/estudios/${estudio.id}/archivos`, { headers })
      .then(r => r.json())
      .then(d => Array.isArray(d) && setArchivos(d))
      .catch(() => setArchivos([]));
  }, [user.token]);

  // Cargar plantillas personalizadas del servidor
  useEffect(() => {
    fetch(`${API_URL}/api/plantillas`, { headers })
      .then(r => r.json())
      .then(d => Array.isArray(d) && setCustomTemplates(d))
      .catch(() => {});
  }, [user.token]);

  // Parámetros del centro (membrete de informes)
  useEffect(() => {
    fetch(`${API_URL}/api/config`, { headers })
      .then(r => r.json())
      .then(d => d && typeof d === 'object' && setCentro(d))
      .catch(() => {});
  }, [user.token]);

  const loadHistorial = useCallback((estudio) => {
    if (!estudio?.paciente_id) return;
    setHistorialLoading(true);
    fetch(`${API_URL}/api/pacientes/${estudio.paciente_id}/estudios`, { headers })
      .then(r => r.json())
      .then(d => { if (d && Array.isArray(d.estudios)) setHistorial(d); })
      .catch(() => setHistorial(null))
      .finally(() => setHistorialLoading(false));
  }, [user.token]);

  useEffect(() => { fetchEstudios(); }, []);

  useEffect(() => {
    if (!selectedImage && archivos.length > 0) {
      const firstImage = archivos.find(f => f.isImage);
      if (firstImage) setSelectedImage(firstImage.url);
    }
  }, [archivos, selectedImage]);

  useEffect(() => {
    on('estudio:enviado', () => fetchEstudios());
    on('estudio:devuelto', () => fetchEstudios());
    on('archivo:subido', (data) => {
      if (selectedEstudio && data.estudio_id === selectedEstudio.id) loadArchivos(selectedEstudio);
    });
    return () => { off('estudio:enviado'); off('estudio:devuelto'); off('archivo:subido'); };
  }, [on, off, fetchEstudios, selectedEstudio, loadArchivos]);

  useEffect(() => {
    if (selectedEstudio) {
      const draft = localStorage.getItem(DRAFT_KEY(user.id, selectedEstudio.id));
      setDiagnostico(draft || '');
      setDraftSaved(!!draft);
      loadArchivos(selectedEstudio);
      loadHistorial(selectedEstudio);
      setSelectedImage(null);
      setShowPreview(false);
    }
  }, [selectedEstudio?.id]);

  // Autosave
  useEffect(() => {
    if (!selectedEstudio) return;
    const t = setTimeout(() => {
      if (diagnostico.trim()) {
        localStorage.setItem(DRAFT_KEY(user.id, selectedEstudio.id), diagnostico);
        setDraftSaved(true);
      } else {
        localStorage.removeItem(DRAFT_KEY(user.id, selectedEstudio.id));
        setDraftSaved(false);
      }
    }, 800);
    return () => clearTimeout(t);
  }, [diagnostico, selectedEstudio, user.id]);

  // Atajo Ctrl+Enter
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (diagnostico.trim() && selectedEstudio && !submitting) setShowPreview(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [diagnostico, selectedEstudio, submitting]);

  const handleEnviarDiagnostico = async () => {
    if (!selectedEstudio) { addNotification('ℹ️ Sin estudio seleccionado', 'Seleccione un estudio de la lista de trabajo.', 'default'); return; }
    if (!diagnostico.trim()) { addNotification('ℹ️ Diagnóstico vacío', 'Redacte el diagnóstico antes de enviar.', 'default'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/estudios/${selectedEstudio.id}/diagnostico`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagnostico }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.removeItem(DRAFT_KEY(user.id, selectedEstudio.id));
        setDiagnostico('');
        setShowPreview(false);
        addNotification('✅ Diagnóstico enviado', `Informe firmado y guardado en la carpeta de ${selectedEstudio.nombre}.`, 'success');
        const remaining = estudios.filter(e => e.id !== selectedEstudio.id);
        setEstudios(remaining);
        setSelectedEstudio(remaining[0] || null);
        setPendingRadiologo(remaining.length);
        fetchPendingCounts();
      } else {
        addNotification('❌ No se pudo enviar el diagnóstico', data.error || 'Error desconocido', 'error');
      }
    } catch { addNotification('❌ Error de conexión', 'No se pudo conectar con el servidor', 'error'); }
    finally { setSubmitting(false); }
  };

  const confirmarEnvio = () => {
    setShowPreview(false);
    handleEnviarDiagnostico();
  };

  const handleTomarEstudio = async (estudio) => {
    setTakingStudy(estudio.id);
    try {
      const res = await fetch(`${API_URL}/api/estudios/${estudio.id}/tomar`, { method: 'POST', headers });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo iniciar el estudio');
      addNotification('Estudio iniciado', 'Ahora puedes cargar placas y redactar el informe.', 'success');
      setSelectedEstudio(data.estudio);
      fetchEstudios();
    } catch (error) {
      addNotification('No se pudo iniciar', error.message, 'error');
    } finally {
      setTakingStudy(null);
    }
  };

  const handleEnviarRadiografias = async () => {
    if (!selectedEstudio) return;
    if (images.length === 0) {
      addNotification('Primero cargue las radiografías', 'Use el panel “Archivos y envío” de la derecha para adjuntar una o más imágenes.', 'default');
      return;
    }
    setSendingImages(true);
    try {
      const res = await fetch(`${API_URL}/api/estudios/${selectedEstudio.id}/enviar-placas`, { method: 'POST', headers });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'No se pudieron enviar las radiografías');
      addNotification('Radiografías enviadas', `${data.count} radiografía(s) compartida(s) con el encargado.`, 'success');
    } catch (error) {
      addNotification('No se pudieron enviar las radiografías', error.message, 'error');
    } finally {
      setSendingImages(false);
    }
  };

  const handleAlternarUrgente = async (estudio) => {
    try {
      const res = await fetch(`${API_URL}/api/estudios/${estudio.id}/urgente`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ urgente: !estudio.urgente }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo actualizar la prioridad');
      addNotification(
        data.urgente ? 'Estudio marcado como urgente' : 'Urgencia retirada',
        `${estudio.registro_id} — ${estudio.nombre}`,
        data.urgente ? 'error' : 'success'
      );
      setSelectedEstudio(prev => (prev ? { ...prev, urgente: data.urgente } : prev));
      fetchEstudios();
    } catch (error) {
      addNotification('No se pudo actualizar la prioridad', error.message, 'error');
    }
  };

  const handleDevolverEstudio = async () => {
    if (!selectedEstudio) return;
    if (!notaDevolucion.trim()) {
      addNotification('Nota requerida', 'Debe escribir el motivo de la devolución para el encargado.', 'warning');
      return;
    }
    setSubmittingDevolver(true);
    try {
      const res = await fetch(`${API_URL}/api/estudios/${selectedEstudio.id}/devolver`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nota_revision: notaDevolucion.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo devolver el estudio');
      addNotification('Estudio devuelto para revisión', `El estudio ${selectedEstudio.registro_id} fue devuelto al encargado.`, 'success');
      setShowDevolverModal(false);
      setNotaDevolucion('');
      fetchEstudios();
      fetchPendingCounts();
    } catch (error) {
      addNotification('No se pudo devolver el estudio', error.message, 'error');
    } finally {
      setSubmittingDevolver(false);
    }
  };

  const applyTemplate = (text) => {
    setDiagnostico(prev => (prev ? prev + '\n\n' + text : text));
    setShowTemplates(false);
    setPlantillaBusqueda('');
    textareaRef.current?.focus();
  };

  const allTemplates = [
    ...customTemplates.map(t => ({ key: `custom-${t.id}`, label: t.label, text: t.texto, categoria: t.categoria || 'General' })),
    ...DEFAULT_TEMPLATES.map(t => ({ key: `default-${t.id}`, label: t.label, text: t.texto, categoria: 'Predeterminadas' })),
  ];
  const plantillasFiltradas = allTemplates
    .filter(t => {
      const q = plantillaBusqueda.trim().toLowerCase();
      if (!q) return true;
      return `${t.label} ${t.categoria} ${t.texto}`.toLowerCase().includes(q);
    })
    // La plantilla de la región anatómica del estudio aparece primero
    .sort((a, b) => (b.categoria === categoriaSugerida(selectedEstudio?.tipo_estudio) ? 1 : 0) - (a.categoria === categoriaSugerida(selectedEstudio?.tipo_estudio) ? 1 : 0));
  const historialPrevios = historial?.estudios?.filter(e => e.id !== selectedEstudio?.id) || [];

  const paciente = selectedEstudio ? {
    nombre: selectedEstudio.nombre,
    edad: selectedEstudio.edad,
    fecha: selectedEstudio.fecha_estudio,
    tipo_estudio: selectedEstudio.tipo_estudio,
    notas: selectedEstudio.notas_clinicas || 'Sin notas clínicas.',
    registro_id: selectedEstudio.registro_id,
    estado: selectedEstudio.estado,
    nota_revision: selectedEstudio.nota_revision,
    medico_remitente: selectedEstudio.medico_remitente,
  } : null;

  const images = archivos.filter(f => f.isImage);
  const isDevuelta = selectedEstudio?.estado === 'Devuelta por revisión';
  const categoriaEstudio = categoriaSugerida(selectedEstudio?.tipo_estudio);
  const regionEstudio = selectedEstudio?.region || regionDeTipo(selectedEstudio?.tipo_estudio);

  const indiceImagen = Math.max(0, images.findIndex(f => f.url === selectedImage));

  const seleccionarRelativa = (paso) => {
    if (images.length === 0) return;
    const siguiente = Math.min(images.length - 1, Math.max(0, indiceImagen + paso));
    setSelectedImage(images[siguiente].url);
  };

  // Descarga directa de una radiografía concreta
  const handleDescargarPlaca = async (url, nombre) => {
    if (!selectedEstudio || !url) return;
    const archivo = nombre || images.find(f => f.url === url)?.name;
    if (!archivo) return;
    try {
      await downloadAuthenticatedFile(`/api/estudios/${selectedEstudio.id}/archivos/${encodeURIComponent(archivo)}/download`, user.token, archivo);
      addNotification('Radiografía descargada', archivo, 'success');
    } catch (error) {
      addNotification('No se pudo descargar la radiografía', error.message, 'error');
    }
  };

  // Descarga de todas las placas del estudio en un ZIP
  const handleDescargarRadiografias = async () => {
    if (!selectedEstudio || images.length === 0) return;
    setDescargandoPlacas(true);
    try {
      await downloadAuthenticatedFile(`/api/estudios/${selectedEstudio.id}/radiografias/download`, user.token, `placas_${selectedEstudio.nombre}_${selectedEstudio.registro_id}.zip`);
      addNotification('Placas descargadas', `${images.length} radiografía(s) en un archivo ZIP.`, 'success');
    } catch (error) {
      addNotification('No se pudieron descargar las placas', error.message, 'error');
    } finally {
      setDescargandoPlacas(false);
    }
  };

  // Comparación lado a lado con el estudio previo más reciente que tenga placas
  const abrirComparacion = async () => {
    if (!selectedEstudio) return;
    const candidatos = historialPrevios.slice(0, 4);
    if (candidatos.length === 0) {
      addNotification('Sin estudios previos', 'Este paciente no tiene estudios anteriores registrados.', 'default');
      return;
    }
    setComparacion({ cargando: true, estudio: null, imagenUrl: null });
    for (const previo of candidatos) {
      try {
        const res = await fetch(`${API_URL}/api/estudios/${previo.id}/archivos`, { headers });
        const data = await res.json();
        const imagenes = Array.isArray(data) ? data.filter(f => f.isImage) : [];
        if (imagenes.length > 0) {
          setComparacion({ cargando: false, estudio: previo, archivo: imagenes[0] });
          return;
        }
      } catch {
        // se intenta con el siguiente estudio previo
      }
    }
    setComparacion(null);
    addNotification('Los estudios previos no tienen placas', 'El historial existe, pero sin radiografías adjuntas para comparar.', 'default');
  };

  // Flechas del teclado: recorren las placas sin salir del informe
  useEffect(() => {
    const handler = (e) => {
      const etiqueta = (e.target.tagName || '').toLowerCase();
      if (etiqueta === 'input' || etiqueta === 'textarea' || e.target.isContentEditable) return;
      if (comparacion) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); seleccionarRelativa(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); seleccionarRelativa(-1); }
      if (e.key.toLowerCase() === 'd' && selectedImage) handleDescargarPlaca(selectedImage);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [comparacion, indiceImagen, selectedImage, images.length, selectedEstudio?.id]);

  return (
    <div className="app-container" style={{ position: 'relative', background: '#0d1f38', width: '100vw', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* ============ Header ============ */}
      <header style={{
        flexShrink: 0, height: 60, zIndex: 2500,
        background: 'linear-gradient(90deg, #003366, #0a4d8c)',
        display: 'flex', alignItems: 'center', padding: '0 20px', color: '#fff',
        boxShadow: '0 2px 16px rgba(0,0,0,0.35)',
      }}>
        <div className="sidebar-brand" style={{ marginRight: 12 }}>
          <img className="brand-img" src="/logo.png" alt="RX CCDX" />
        </div>
        <div>
          <h2 style={{ fontSize: 15.5, margin: 0, color: '#fff' }}>RX CCDX — Estación de Lectura</h2>
          <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>RX CCDX</p>
        </div>
        {pendingRadiologo > 0 && (
          <span style={{ marginLeft: 16, background: '#ef4444', color: '#fff', borderRadius: 999, padding: '3px 12px', fontSize: 12, fontWeight: 700, animation: 'pulse 2s infinite', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name="bell" size={11} color="#fff" /> {pendingRadiologo} pendiente{pendingRadiologo > 1 ? 's' : ''}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <NotificationCenter variant="dark" />
          {/* Toggle tema — en el header oscuro del radiólogo */}
          <button
            className="btn btn-sm"
            style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', gap: 5 }}
            onClick={toggleTheme}
            title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
          >
            <Icon name={isDark ? 'sun' : 'moon'} size={13} color="#fff" />
          </button>
          <span style={{ fontSize: 12.5, opacity: 0.8 }}>Dr. Alcántara</span>
          <button className="btn btn-sm" style={{ background: '#fff', color: '#075399', gap: 5, fontWeight: 800 }} onClick={() => setIsRegisterOpen(true)}>
            <Icon name="plus" size={14} color="#075399" /> Nuevo estudio
          </button>
          <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', gap: 5 }} onClick={() => setIsSettingsOpen(true)}>
            <Icon name="settings" size={13} color="#fff" /> Ajustes
          </button>
          <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', gap: 5 }} onClick={() => { setIsCommunicationOpen(true); setUnreadMessages(0); }}>
            <Icon name="message" size={13} color="#fff" /> Mensajería
            {unreadMessages > 0 && (
              <span style={{ background: '#ef4444', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 10.5, fontWeight: 700 }}>{unreadMessages}</span>
            )}
          </button>
          <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', gap: 5 }} onClick={logout}>
            <Icon name="logout" size={13} color="#fff" /> Salir
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', width: '100%', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* ============ Worklist ============ */}
        <div style={{
          width: 290, background: '#0f2b4e', color: '#fff', display: 'flex', flexDirection: 'column',
          flexShrink: 0, borderRight: '1px solid #1e3a5f', height: '100%', overflow: 'hidden'
        }}>
          <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #1e3a5f', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ fontSize: 11, margin: 0, color: '#9db8d9', textTransform: 'uppercase', letterSpacing: '0.1em', flex: 1 }}>Lista de Trabajo</h3>
              <button
                className="btn btn-xs"
                onClick={fetchEstudios}
                title="Actualizar lista de trabajo"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#b5cdf0', padding: '5px 7px' }}
              >
                <Icon name="rotate" size={13} color="#b5cdf0" />
              </button>
            </div>
            
            {/* Pestañas Pendientes / Todos */}
            <div style={{ display: 'flex', gap: 4, marginTop: 10, background: 'rgba(0,0,0,0.2)', padding: 3, borderRadius: 8 }}>
              <button
                onClick={() => setWorklistFiltro('pendientes')}
                style={{
                  flex: 1, border: 0, borderRadius: 6, padding: '5px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  background: worklistFiltro === 'pendientes' ? '#1f7ed1' : 'transparent',
                  color: worklistFiltro === 'pendientes' ? '#fff' : '#9db8d9',
                  transition: 'all 0.15s'
                }}
              >
                Pendientes
              </button>
              <button
                onClick={() => setWorklistFiltro('todos')}
                style={{
                  flex: 1, border: 0, borderRadius: 6, padding: '5px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  background: worklistFiltro === 'todos' ? '#1f7ed1' : 'transparent',
                  color: worklistFiltro === 'todos' ? '#fff' : '#9db8d9',
                  transition: 'all 0.15s'
                }}
              >
                Todos
              </button>
            </div>

            <button className="btn btn-sm" onClick={() => setIsRegisterOpen(true)} style={{ width: '100%', marginTop: 10, justifyContent: 'center', gap: 6, background: '#1f7ed1', color: '#fff', fontWeight: 700 }}>
              <Icon name="plus" size={14} color="#fff" /> Registrar y enviar estudio
            </button>

            {/* Buscador inteligente de pacientes */}
            <div style={{ marginTop: 10, position: 'relative' }}>
              <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}>
                <Icon name="search" size={13} color="#5f7ba0" />
              </div>
              <input
                type="text"
                className="input"
                placeholder="Buscar por paciente, ID, estudio..."
                value={worklistSearch}
                onChange={e => setWorklistSearch(e.target.value)}
                style={{ width: '100%', paddingLeft: 30, fontSize: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid #1e3a5f', color: '#fff' }}
              />
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 8 }}>
            {loading ? (
              <div style={{ padding: '24px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div className="spinner" style={{ borderColor: 'rgba(51,153,255,0.25)', borderTopColor: '#3399FF' }} />
                <p style={{ fontSize: 12, color: '#64748b' }}>Cargando...</p>
              </div>
            ) : (() => {
              const normalizeText = (str) => String(str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
              const q = normalizeText(worklistSearch.trim());
              const filtrados = estudios.filter(e => {
                if (!q) return true;
                const searchable = normalizeText(
                  `${e.nombre} ${e.registro_id} ${e.documento || ''} ${e.tipo_estudio || ''} ${e.estado || ''} ${e.medico_remitente || ''} ${e.region || ''} ${e.notas_clinicas || ''}`
                );
                return searchable.includes(q);
              });

              if (estudios.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '30px 14px', color: '#64748b' }}>
                    <div style={{ marginBottom: 10, opacity: 0.35 }}><Icon name="inbox" size={38} color="#64748b" /></div>
                    <p style={{ fontSize: 13, color: '#a8c4e4' }}>{worklistFiltro === 'pendientes' ? 'Sin placas pendientes' : 'Sin estudios'}</p>
                    <p style={{ fontSize: 11, marginTop: 8, lineHeight: 1.6, color: '#5f7ba0' }}>
                      {worklistFiltro === 'pendientes' ? 'Los estudios disponibles aparecen aquí.' : 'No hay estudios registrados en el sistema.'}
                    </p>
                    <button className="btn btn-xs" onClick={fetchEstudios} style={{ marginTop: 14, gap: 5, background: 'rgba(51,153,255,0.15)', color: '#8cc3ff', border: '1px solid rgba(51,153,255,0.3)' }}>
                      <Icon name="rotate" size={12} color="#8cc3ff" /> Actualizar ahora
                    </button>
                  </div>
                );
              }

              if (filtrados.length === 0 && worklistSearch.trim()) {
                return (
                  <div style={{ textAlign: 'center', padding: '30px 14px', color: '#64748b' }}>
                    <p style={{ fontSize: 13, color: '#a8c4e4' }}>Sin resultados para "{worklistSearch}"</p>
                    <button className="btn btn-xs" onClick={() => setWorklistFiltro('todos')} style={{ marginTop: 10, background: 'rgba(51,153,255,0.15)', color: '#8cc3ff' }}>
                      Buscar en todos los estudios
                    </button>
                  </div>
                );
              }

              return filtrados.map(est => {
                const devuelta = est.estado === 'Devuelta por revisión';
                const canTake = ['Recibida', 'Pendiente de enviar al radiólogo', 'Enviada al radiólogo'].includes(est.estado)
                  && (!est.radiologo_id || est.radiologo_id === user.id);
                const needsStart = canTake && est.radiologo_id !== user.id;
                const isSelected = selectedEstudio?.id === est.id;
                return (
                  <div
                    key={est.id}
                    onClick={() => setSelectedEstudio(est)}
                    style={{
                      padding: '12px 14px', marginBottom: 6, borderRadius: 10, cursor: 'pointer',
                      background: isSelected ? 'linear-gradient(135deg, #1a66b3, #0a4d8c)' : devuelta ? 'rgba(244,63,94,0.12)' : 'rgba(255,255,255,0.04)',
                      border: isSelected ? '1px solid #3399FF' : devuelta ? '1px solid rgba(244,63,94,0.4)' : '1px solid transparent',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      {devuelta && <Icon name="return" size={13} color="#fda4af" />}
                      <span className="mono" style={{ fontWeight: 700, fontSize: 12.5, color: isSelected ? '#fff' : '#b5cdf0' }}>{est.registro_id}</span>
                      {devuelta && <span style={{ marginLeft: 'auto', fontSize: 9.5, fontWeight: 700, color: '#fda4af' }}>CORREGIR</span>}
                      {est.urgente ? (
                        <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800, color: '#fff', background: '#ef4444', padding: '1px 7px', borderRadius: 999, letterSpacing: '0.03em' }}>URGENTE</span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 3, color: isSelected ? '#e0f2ff' : '#cbd5e1', fontWeight: 500 }}>{est.nombre}</div>
                    <div style={{ fontSize: 11, color: isSelected ? '#a8d4ff' : '#64748b', marginTop: 3 }}>{est.tipo_estudio} · <span style={{ opacity: 0.8 }}>{est.estado}</span></div>
                    {canTake && (
                      <button
                        className="btn btn-primary btn-xs"
                        onClick={event => { event.stopPropagation(); handleTomarEstudio(est); }}
                        disabled={takingStudy === est.id}
                        style={{ marginTop: 8, width: '100%', justifyContent: 'center', gap: 5 }}
                      >
                        {takingStudy === est.id ? 'Iniciando...' : <><Icon name="edit" size={11} /> {needsStart ? 'Tomar e iniciar lectura' : 'Reanudar lectura'}</>}
                      </button>
                    )}
                  </div>
                );
              });
            })()}
          </div>
          <div style={{ padding: 12, borderTop: '1px solid #1e3a5f', textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
            Creadores: GYPR y AnabelLp
          </div>
        </div>

        {/* ============ Área de lectura ============ */}
        {!selectedEstudio ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(ellipse at 50% 0%, #173c68 0%, #0d1f38 58%)', padding: 32, overflowY: 'auto' }}>
            <div style={{ width: 'min(860px, 100%)' }}>
              <div style={{ textAlign: 'center', marginBottom: 30 }}>
                <div style={{ width: 84, height: 62, margin: '0 auto 16px', padding: '6px 8px', borderRadius: 16, background: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 14px 34px rgba(0,0,0,.28)' }}>
                  <img className="brand-img" src="/logo.png" alt="RX CCDX" />
                </div>
                <h3 style={{ color: '#e7f2ff', fontSize: 23, margin: 0 }}>Estación del radiólogo</h3>
                <p style={{ fontSize: 13.5, marginTop: 8, color: '#91b5dd' }}>Registre un estudio propio o seleccione uno de la lista para leerlo, adjuntar placas y remitir el informe.</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
                <ActionCard icon="plus" title="1. Registrar estudio" text="Cree el expediente y el estudio. Quedará asignado a usted de inmediato." action="Nuevo estudio" onClick={() => setIsRegisterOpen(true)} primary />
                <ActionCard icon="upload" title="2. Cargar placas" text="Seleccione el estudio y adjunte imágenes desde el panel de archivos." action="Ver lista de trabajo" onClick={fetchEstudios} />
                <ActionCard icon="fileText" title="3. Enviar informe" text="Redacte, previsualice y firme el informe para enviarlo al encargado." action="Ver cómo funciona" onClick={() => addNotification('Flujo de lectura', 'Registre o tome un estudio, cargue las placas, y luego use “Previsualizar y firmar” para remitir el informe.', 'default')} />
              </div>
              <div style={{ marginTop: 18, padding: '13px 16px', borderRadius: 12, border: '1px solid rgba(96,165,250,.25)', background: 'rgba(15,43,78,.7)', color: '#9ec4ec', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 9 }}>
                <Icon name="info" size={17} color="#60a5fa" /> Las acciones de envío se habilitan al registrar o seleccionar un estudio, para que cada placa e informe quede asociado al paciente correcto.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* ---------- Izquierda: visor ---------- */}
            <div style={{ flex: 1, background: '#0d1f38', display: 'flex', flexDirection: 'column', borderRight: '1px solid #1e3a5f' }}>
              {/* Visor PACS */}
              {selectedImage ? (
                <PacsViewer
                  key={selectedImage}
                  imageUrl={authenticatedFileUrl(selectedImage, user.token)}
                  imageName={images.find(f => f.url === selectedImage)?.name}
                  index={indiceImagen}
                  total={images.length}
                  onDownload={() => handleDescargarPlaca(selectedImage)}
                  onPrevious={() => seleccionarRelativa(-1)}
                  onNext={() => seleccionarRelativa(1)}
                />
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(ellipse at center, #16294a 0%, #091527 100%)' }}>
                  <div style={{ textAlign: 'center', color: '#334155' }}>
                    <div style={{ marginBottom: 12, opacity: 0.15 }}><Icon name="bone" size={72} color="#475569" /></div>
                    <p style={{ color: '#4b5f85', fontSize: 14 }}>{paciente.tipo_estudio}</p>
                    <p style={{ fontSize: 12, color: '#334155', marginTop: 6 }}>
                      {images.length === 0 ? 'Sin imágenes adjuntas.' : 'Seleccione una imagen de abajo.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Miniaturas */}
              {images.length > 0 && (
                <div style={{ height: 92, background: '#0f2b4e', display: 'flex', gap: 6, padding: 10, overflowX: 'auto', alignItems: 'center', borderTop: '1px solid #1e3a5f' }}>
                  {images.map(f => (
                    <img
                      key={f.name}
                      src={authenticatedFileUrl(f.url, user.token)}
                      alt={f.name}
                      onClick={() => setSelectedImage(f.url)}
                      style={{
                        height: 70, width: 70, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', flexShrink: 0,
                        border: selectedImage === f.url ? '2px solid #3399FF' : '2px solid transparent',
                        opacity: selectedImage === f.url ? 1 : 0.65,
                        transition: 'all 0.15s ease',
                      }}
                    />
                  ))}
                </div>
              )}

              <div style={{ padding: '10px 14px', background: '#102b4d', borderTop: '1px solid #1e3a5f', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#dbeafe', fontSize: 11.5, fontWeight: 700 }}>Radiografías del estudio</div>
                  <div style={{ color: '#7fa5d1', fontSize: 10.5, marginTop: 2 }}>{images.length ? `${images.length} lista(s) para compartir` : 'Adjunte imágenes en “Archivos y envío”'}</div>
                </div>
                <button
                  className="btn btn-sm"
                  onClick={handleDescargarRadiografias}
                  disabled={descargandoPlacas || images.length === 0}
                  title={images.length ? 'Descargar todas las radiografías del estudio en un ZIP' : 'Primero adjunte radiografías'}
                  style={{ gap: 5, whiteSpace: 'nowrap', background: 'rgba(34,197,94,0.18)', color: '#bbf7d0', border: '1px solid rgba(34,197,94,0.35)', opacity: images.length ? 1 : 0.55 }}
                >
                  {descargandoPlacas ? 'Descargando...' : <><Icon name="download" size={13} color="#bbf7d0" /> ZIP</>}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleEnviarRadiografias}
                  disabled={sendingImages || images.length === 0}
                  title={images.length ? 'Enviar radiografías al encargado' : 'Primero adjunte radiografías'}
                  style={{ gap: 5, whiteSpace: 'nowrap', opacity: images.length ? 1 : 0.55 }}
                >
                  {sendingImages ? 'Enviando...' : <><Icon name="send" size={13} color="#fff" /> Enviar al encargado</>}
                </button>
              </div>

              {/* Info del paciente */}
              <div style={{ background: '#0f2b4e', padding: '14px 16px', borderTop: '1px solid #1e3a5f' }}>
                {isDevuelta && paciente.nota_revision && (
                  <div style={{ padding: '10px 14px', background: 'rgba(244,63,94,0.12)', borderRadius: 10, borderLeft: '4px solid #f43f5e', marginBottom: 12 }}>
                    <strong style={{ fontSize: 11, color: '#fda4af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Nota de corrección del encargado</strong>
                    <p style={{ marginTop: 5, color: '#fecdd3', fontSize: 12.5, lineHeight: 1.55 }}>{paciente.nota_revision}</p>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleAlternarUrgente(selectedEstudio)}
                    className="btn btn-xs"
                    title="Alternar la prioridad de este estudio"
                    style={{ gap: 5, background: selectedEstudio.urgente ? '#ef4444' : 'rgba(255,255,255,0.10)', color: '#fff', fontWeight: 700, border: '1px solid rgba(255,255,255,0.14)' }}
                  >
                    <Icon name="bell" size={11} color="#fff" /> {selectedEstudio.urgente ? 'Quitar urgencia' : 'Marcar urgente'}
                  </button>
                  {selectedEstudio.urgente ? (
                    <span style={{ fontSize: 11, color: '#fda4af', fontWeight: 700 }}>Prioridad máxima en la lista de trabajo</span>
                  ) : null}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 14px', fontSize: 12.5 }}>
                  <div><span style={{ color: '#64748b' }}>Paciente:</span> <strong style={{ color: '#e2e8f0' }}>{paciente.nombre} ({paciente.edad} años)</strong></div>
                  <div><span style={{ color: '#64748b' }}>Registro:</span> <strong className="mono" style={{ color: '#a8c2ea' }}>{paciente.registro_id}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Estudio:</span> <span style={{ color: '#cbd5e1' }}>{paciente.tipo_estudio}{regionEstudio ? ` · ${regionEstudio}` : ''}</span></div>
                  <div><span style={{ color: '#64748b' }}>Ref.:</span> <span style={{ color: '#cbd5e1' }}>{paciente.medico_remitente}</span>
                  </div>
                </div>
                {paciente.notas !== 'Sin notas clínicas.' && (
                  <div style={{ marginTop: 10, padding: '9px 12px', background: 'rgba(34,197,94,0.1)', borderRadius: 8, borderLeft: '3px solid #22c55e' }}>
                    <p style={{ fontSize: 11.5, color: '#86efac', lineHeight: 1.5, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                      <Icon name="info" size={13} color="#86efac" style={{ flexShrink: 0, marginTop: 1 }} />{paciente.notas}
                    </p>
                  </div>
                )}

                {/* Historial clínico previo */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 10.5, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Historial clínico previo</span>
                    {historialPrevios.length > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(51,153,255,0.22)', color: '#8cc3ff', padding: '1px 8px', borderRadius: 999 }}>{historialPrevios.length}</span>
                    )}
                  </div>
                  {historialPrevios.length > 0 && (
                    <button
                      className="btn btn-xs"
                      onClick={abrirComparacion}
                      style={{ marginBottom: 8, gap: 5, background: 'rgba(51,153,255,0.18)', color: '#8cc3ff', border: '1px solid rgba(51,153,255,0.3)', width: '100%', justifyContent: 'center' }}
                    >
                      <Icon name="eye" size={12} color="#8cc3ff" /> Comparar con el estudio previo
                    </button>
                  )}
                  {historialLoading ? (
                    <p style={{ fontSize: 11.5, color: '#4b5f85' }}>Cargando historial...</p>
                  ) : historialPrevios.length === 0 ? (
                    <p style={{ fontSize: 11.5, color: '#334155' }}>Sin estudios previos registrados.</p>
                  ) : (
                    <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {historialPrevios.map(h => (                          <div key={h.id} style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: '1px solid #1e3a5f' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: 11, color: '#8cc3ff' }}>{h.tipo_estudio}</strong>
                            <span style={{ fontSize: 10, color: '#5f7ba0' }}>{h.fecha_estudio}</span>
                            <span style={{ fontSize: 9.5, marginLeft: 'auto', padding: '1px 7px', borderRadius: 999, background: '#1e293b', color: '#94a3b8' }}>{h.estado}</span>
                          </div>
                          {h.diagnostico ? (
                            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, whiteSpace: 'pre-wrap', lineHeight: 1.45, maxHeight: 54, overflow: 'hidden', fontFamily: '"Times New Roman", Times, serif' }}>
                              {h.diagnostico}
                            </p>
                          ) : (
                            <p style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>Sin diagnóstico emitido.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ---------- Centro: editor estilo Word ---------- */}
            <div style={{ width: 400, flexShrink: 0, background: '#e8ecf3', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid #cbd5e1' }}>
              <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column' }}>
                <div className="paper" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 420 }}>
                  <div className="paper-letterhead">
                    <div style={{ fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon name="xray" size={16} color="#fff" /> {centro?.centro_nombre || 'RX CCDX'}
                    </div>
                  </div>
                  <div style={{ padding: '12px 18px', borderBottom: '1px solid #e2e8f0', fontFamily: '"Times New Roman", Times, serif', fontSize: 12, lineHeight: 1.9, color: '#374151' }}>
                    <div><strong>FECHA:</strong> {new Date().toLocaleDateString('es-HN', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    <div><strong>PACIENTE:</strong> {paciente.nombre}</div>
                    <div><strong>EDAD:</strong> {paciente.edad} AÑOS</div>
                    <div><strong>ESTUDIO:</strong> {paciente.tipo_estudio?.toUpperCase()}</div>
                    <div><strong>MÉDICO REMITENTE:</strong> {paciente.medico_remitente}</div>
                  </div>
                  <div style={{ flex: 1, padding: '12px 18px 18px', display: 'flex', flexDirection: 'column', minHeight: 200 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <strong style={{ fontSize: 11, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Diagnóstico Médico</strong>
                      <div style={{ position: 'relative' }}>
                        <button className="btn btn-ghost btn-xs" onClick={() => setShowTemplates(!showTemplates)} style={{ gap: 5 }}>
                          <Icon name="clipboard" size={12} /> Plantillas
                        </button>
                        {showTemplates && (
                          <div style={{
                            position: 'absolute', right: 0, top: '100%', marginTop: 6, background: '#fff',
                            border: '1px solid var(--color-border)', borderRadius: 12, zIndex: 100,
                            boxShadow: 'var(--shadow-lg)', minWidth: 290, padding: 6, display: 'flex', flexDirection: 'column', gap: 6,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, background: '#f1f5f9', borderRadius: 8, padding: '5px 8px', color: '#475569' }}>
                              <Icon name="clipboard" size={12} color="#475569" />
                              Sugerida para <strong>{regionEstudio || categoriaEstudio}</strong>: {categoriaEstudio}
                            </div>
                            <input
                              className="input"
                              autoFocus
                              placeholder="Buscar plantilla por nombre o texto..."
                              value={plantillaBusqueda}
                              onChange={e => setPlantillaBusqueda(e.target.value)}
                              style={{ fontSize: 12, padding: '6px 9px' }}
                            />
                            <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {plantillasFiltradas.length === 0 && (
                                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: 8, margin: 0 }}>
                                  {allTemplates.length === 0 ? 'Sin plantillas disponibles.' : 'Ninguna plantilla coincide con la búsqueda.'}
                                </p>
                              )}
                              {plantillasFiltradas.map(t => (
                                <button
                                  key={t.key}
                                  onClick={() => applyTemplate(t.text)}
                                  style={{
                                    textAlign: 'left', padding: '9px 12px',
                                    border: 'none', background: 'none', cursor: 'pointer', fontSize: 12.5,
                                    borderRadius: 8, fontFamily: 'inherit',
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                >
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                    <strong style={{ fontSize: 12.5, color: 'var(--color-text)' }}>{t.label}</strong>
                                    <span style={{ fontSize: 9.5, color: '#1d4ed8', background: '#eff6ff', padding: '1px 7px', borderRadius: 999, fontWeight: 700, marginLeft: 'auto' }}>{t.categoria}</span>
                                  </span>
                                  <span style={{ display: 'block', fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
                                    {t.text.slice(0, 70)}{t.text.length > 70 ? '…' : ''}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <textarea
                      ref={textareaRef}
                      className="input"
                      style={{
                        flex: 1, resize: 'none', fontFamily: '"Times New Roman", Times, serif', fontSize: 14,
                        lineHeight: 1.7, border: '1px solid #d3dbe7', marginBottom: 0, minHeight: 180,
                        background: '#fffef7',
                      }}
                      placeholder="Redacte el diagnóstico aquí, o use una plantilla arriba. También puede pegar (Ctrl+V)."
                      value={diagnostico}
                      onChange={e => setDiagnostico(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Footer del editor */}
              <div style={{ padding: '12px 16px', background: '#fff', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setDiagnostico('')}>Limpiar</button>
                {selectedEstudio?.diagnostico && (
                  <button className="btn btn-info" style={{ fontSize: 12, gap: 5 }} onClick={() => setInformeEstudio(selectedEstudio)}>
                    <Icon name="eye" size={13} /> Ver informe
                  </button>
                )}
                {selectedEstudio && selectedEstudio.estado !== 'Devuelta por revisión' && selectedEstudio.estado !== 'Entregado' && (
                  <button
                    className="btn btn-danger"
                    style={{ fontSize: 12, gap: 5 }}
                    onClick={() => { setNotaDevolucion(''); setShowDevolverModal(true); }}
                    title="Devolver estudio al encargado para revisión de placas o datos"
                  >
                    <Icon name="return" size={13} /> Devolver para revisión
                  </button>
                )}
                <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {draftSaved ? <><Icon name="check" size={12} color="var(--color-success)" /> Borrador guardado</> : 'Ctrl+Enter'}
                </span>
                <div style={{ flex: 1 }} />
                <button
                  className="btn btn-secondary"
                  onClick={() => { if (diagnostico.trim()) setShowPreview(true); }}
                  disabled={submitting || !diagnostico.trim()}
                  style={{ fontSize: 13, padding: '10px 18px', opacity: (submitting || !diagnostico.trim()) ? 0.55 : 1, gap: 6 }}
                >
                  {submitting ? 'Enviando...' : <><Icon name="checkCircle" size={14} color="#fff" /> Previsualizar y firmar</>}
                </button>
              </div>
            </div>

            {/* ---------- Derecha: comunicación ---------- */}
            <div style={{ width: 310, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <CommunicationPanel
                estudio={selectedEstudio}
                onFileUploaded={() => loadArchivos(selectedEstudio)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Comparación lado a lado con el estudio previo del mismo paciente */}
      {comparacion && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(3,10,20,0.97)', display: 'flex', flexDirection: 'column' }}>
          <header style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', background: 'linear-gradient(90deg, #003366, #0a4d8c)', color: '#fff' }}>
            <Icon name="eye" size={16} color="#fff" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>Comparación radiológica — {paciente?.nombre}</div>
              <div style={{ fontSize: 10.5, opacity: 0.8 }}>
                Actual: {selectedEstudio?.tipo_estudio} ({selectedEstudio?.fecha_estudio})
                {comparacion.estudio ? ` · Previo: ${comparacion.estudio.tipo_estudio} (${comparacion.estudio.fecha_estudio})` : ''}
              </div>
            </div>
            <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', gap: 5 }} onClick={() => setComparacion(null)}>
              <Icon name="close" size={13} color="#fff" /> Cerrar comparación
            </button>
          </header>
          {comparacion.cargando ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8fa9cc', fontSize: 13 }}>Buscando la radiografía previa...</div>
          ) : (
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #1e3a5f' }}>
                <div style={{ padding: '7px 12px', background: '#102b4d', color: '#8cc3ff', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>ESTUDIO ACTUAL</div>
                {selectedImage ? (
                  <PacsViewer
                    key={`cmp-actual-${selectedImage}`}
                    imageUrl={authenticatedFileUrl(selectedImage, user.token)}
                    imageName={images.find(f => f.url === selectedImage)?.name}
                    index={indiceImagen}
                    total={images.length}
                    onDownload={() => handleDescargarPlaca(selectedImage)}
                    onPrevious={() => seleccionarRelativa(-1)}
                    onNext={() => seleccionarRelativa(1)}
                  />
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5f85', fontSize: 12.5 }}>Seleccione una placa del estudio actual.</div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '7px 12px', background: '#102b4d', color: '#fbbf24', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>ESTUDIO PREVIO</div>
                {comparacion.archivo ? (
                  <PacsViewer
                    key={`cmp-previo-${comparacion.archivo.name}`}
                    imageUrl={authenticatedFileUrl(comparacion.archivo.url, user.token)}
                    imageName={comparacion.archivo.name}
                    index={0}
                    total={1}
                    onDownload={() => downloadAuthenticatedFile(`/api/estudios/${comparacion.estudio.id}/archivos/${encodeURIComponent(comparacion.archivo.name)}/download`, user.token, comparacion.archivo.name).catch(err => addNotification('No se pudo descargar', err.message, 'error'))}
                  />
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5f85', fontSize: 12.5 }}>El estudio previo no tiene placas.</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {isSettingsOpen && <AccountSettings onClose={() => setIsSettingsOpen(false)} />}
      <Suspense fallback={null}>
        {isCommunicationOpen && <CommunicationHub onClose={() => setIsCommunicationOpen(false)} />}
      </Suspense>
      {isRegisterOpen && (
        <RegisterModal
          onClose={() => setIsRegisterOpen(false)}
          onSuccess={() => {
            setIsRegisterOpen(false);
            addNotification('Estudio creado y asignado', 'Ya puede adjuntar radiografías y preparar el informe.', 'success');
            fetchEstudios();
          }}
        />
      )}

      {/* Previsualización */}
      {showPreview && selectedEstudio && (
        <div className="modal-backdrop" onClick={() => setShowPreview(false)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <strong style={{ fontSize: 15, color: 'var(--color-text)', flex: 1 }}>Previsualización del informe</strong>
              <button className="modal-close" onClick={() => setShowPreview(false)}>
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="paper">
                <div className="paper-letterhead">
                  <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="xray" size={15} color="#fff" /> {centro?.centro_nombre || 'RX CCDX'}
                  </div>
                </div>
                <div style={{ padding: '14px 18px', border: '1px solid #e2e8f0', borderTop: 'none', fontFamily: '"Times New Roman", Times, serif', fontSize: 13, lineHeight: 1.85, color: '#374151' }}>
                  <div><strong>FECHA:</strong> {new Date().toLocaleDateString('es-HN', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                  <div><strong>PACIENTE:</strong> {paciente.nombre}</div>
                  <div><strong>EDAD:</strong> {paciente.edad} AÑOS</div>
                  <div><strong>ESTUDIO:</strong> {paciente.tipo_estudio?.toUpperCase()}</div>
                  <div><strong>MÉDICO REMITENTE:</strong> {paciente.medico_remitente}</div>
                  <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '12px 0' }} />
                  <strong style={{ fontSize: 12, letterSpacing: '0.05em' }}>DIAGNÓSTICO MÉDICO</strong>
                  <p style={{ whiteSpace: 'pre-wrap', marginTop: 8, lineHeight: 1.7 }}>{diagnostico}</p>
                </div>
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 12 }}>
                Al confirmar, el informe se guardará como documento Word en la carpeta del paciente y el estudio pasará a "Diagnóstico recibido". Podrá reeditarlo después sin generar duplicados.
              </p>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowPreview(false)}>Volver a editar</button>
              <button className="btn btn-primary" onClick={confirmarEnvio} disabled={submitting} style={{ gap: 6 }}>
                {submitting ? 'Enviando...' : <><Icon name="checkCircle" size={14} color="#fff" /> Confirmar y firmar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Devolver para revisión */}
      {showDevolverModal && selectedEstudio && (
        <div className="modal-backdrop" onClick={() => setShowDevolverModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="return" size={18} color="var(--color-danger)" />
                <strong style={{ fontSize: 15, color: 'var(--color-text)' }}>Devolver estudio para revisión</strong>
              </div>
              <button className="modal-close" onClick={() => setShowDevolverModal(false)}>
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Indique el motivo por el cual devuelve el estudio <strong style={{ color: 'var(--color-text)' }}>{selectedEstudio.registro_id} ({selectedEstudio.nombre})</strong> al encargado (ej: placas incompletas, imágenes borrosas, datos clínicos insuficientes, etc.).
              </p>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
                  Motivo de revisión / Observación para el encargado *
                </label>
                <textarea
                  className="input"
                  autoFocus
                  rows={4}
                  placeholder="Escriba aquí la observación o solicitud de corrección..."
                  value={notaDevolucion}
                  onChange={e => setNotaDevolucion(e.target.value)}
                  style={{ width: '100%', resize: 'vertical', fontSize: 13, minHeight: 90 }}
                />
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowDevolverModal(false)} disabled={submittingDevolver}>
                Cancelar
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDevolverEstudio}
                disabled={submittingDevolver || !notaDevolucion.trim()}
                style={{ gap: 6 }}
              >
                {submittingDevolver ? (
                  <><div className="spinner" style={{ width: 13, height: 13 }} /> Devolviendo...</>
                ) : (
                  <><Icon name="return" size={14} color="#fff" /> Confirmar devolución</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <Suspense fallback={null}>
        {informeEstudio && (
          <InformeViewer
            estudio={informeEstudio}
            userRole={user.role}
            onClose={() => setInformeEstudio(null)}
            onSaved={() => { setInformeEstudio(null); fetchEstudios(); }}
          />
        )}
      </Suspense>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
      `}</style>
    </div>
  );
};

const ActionCard = ({ icon, title, text, action, onClick, primary = false }) => (
  <div style={{ padding: 18, borderRadius: 15, border: `1px solid ${primary ? 'rgba(96,165,250,.62)' : 'rgba(96,165,250,.20)'}`, background: primary ? 'linear-gradient(145deg, rgba(29,107,185,.48), rgba(15,43,78,.88))' : 'rgba(15,43,78,.8)', boxShadow: primary ? '0 14px 30px rgba(0,0,0,.18)' : 'none' }}>
    <div style={{ width: 36, height: 36, borderRadius: 10, background: primary ? '#268ce3' : 'rgba(51,153,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 13 }}><Icon name={icon} size={18} color={primary ? '#fff' : '#79baff'} /></div>
    <h4 style={{ margin: 0, color: '#e7f2ff', fontSize: 14 }}>{title}</h4>
    <p style={{ minHeight: 44, margin: '7px 0 15px', color: '#8fb2d7', fontSize: 11.5, lineHeight: 1.55 }}>{text}</p>
    <button className="btn btn-sm" onClick={onClick} style={{ width: '100%', justifyContent: 'center', gap: 6, background: primary ? '#fff' : 'rgba(51,153,255,.15)', color: primary ? '#075399' : '#a9d6ff', border: primary ? 'none' : '1px solid rgba(96,165,250,.32)' }}>
      <Icon name={icon} size={13} color={primary ? '#075399' : '#a9d6ff'} /> {action}
    </button>
  </div>
);

/* ============ Visor PACS interactivo (zoom, pan, brillo/contraste, fullscreen) ============ */
export default RadiologistView;
