import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { API_URL } from '../config';
import { CATALOGO_ESTUDIOS, REGIONES, regionDeTipo, categoriaSugerida } from '../utils/catalogoRadiologia';
import Icon from './Icons';

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Normaliza un nombre para comparar: sin tildes, minúsculas, espacios colapsados
function normalizarNombre(str) {
  return String(str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

const EMPTY_FORM = {
  registro_id: '',
  nombre: '',
  sexo: 'M',
  edad: '',
  fecha_nacimiento: '',
  fecha_estudio: getToday(),
  tipo_estudio: '',
  region: '',
  lateralidad: '',
  medico_remitente: 'Dr. Alcántara',
  notas_clinicas: '',
  urgente: false,
};

const RegisterModal = ({ onClose, onSuccess, initialPatient = null }) => {
  const { user } = useContext(AuthContext);
  const [loadingId, setLoadingId] = useState(true);
  const [patientLookup, setPatientLookup] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState(EMPTY_FORM);
  // Advertencia de posibles pacientes duplicados por nombre
  const [duplicados, setDuplicados] = useState([]);
  const [buscandoDups, setBuscandoDups] = useState(false);
  const dupTimerRef = useRef(null);

  // --- Carga inicial ---
  useEffect(() => {
    if (initialPatient) {
      setFormData(prev => ({
        ...prev,
        registro_id: initialPatient.registro_id || '',
        nombre: initialPatient.nombre || '',
        sexo: initialPatient.sexo || 'M',
        edad: String(initialPatient.edad ?? ''),
        fecha_nacimiento: initialPatient.fecha_nacimiento || '',
      }));
      setPatientLookup(initialPatient);
      setLoadingId(false);
      return;
    }
    fetch(`${API_URL}/api/next-registro-id`, {
      headers: { Authorization: `Bearer ${user.token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.registro_id) setFormData(prev => ({ ...prev, registro_id: d.registro_id })); })
      .catch(() => {})
      .finally(() => setLoadingId(false));
  }, [initialPatient, user.token]);

  // Limpiar timer al desmontar
  useEffect(() => () => clearTimeout(dupTimerRef.current), []);

  // --- Buscar paciente por registro ---
  const buscarPaciente = useCallback(async (id) => {
    const rid = id.trim().toUpperCase();
    if (!rid) return;
    setLookingUp(true);
    try {
      const r = await fetch(
        `${API_URL}/api/pacientes/por-registro/${encodeURIComponent(rid)}`,
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      const result = await r.json();
      if (result.found && result.paciente) {
        const p = result.paciente;
        setPatientLookup(p);
        setDuplicados([]);
        setFormData(prev => ({
          ...prev,
          nombre: p.nombre || '',
          sexo: p.sexo || 'M',
          edad: String(p.edad ?? ''),
          fecha_nacimiento: p.fecha_nacimiento || '',
        }));
      } else {
        setPatientLookup(null);
      }
    } catch { /* silent */ }
    finally { setLookingUp(false); }
  }, [user.token]);

  // --- Búsqueda de duplicados con debounce al escribir el nombre ---
  const buscarDuplicados = useCallback(async (nombre) => {
    const q = nombre.trim();
    if (q.length < 3) { setDuplicados([]); return; }
    setBuscandoDups(true);
    try {
      const r = await fetch(
        `${API_URL}/api/pacientes/buscar?q=${encodeURIComponent(q)}`,
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      const data = await r.json();
      const list = Array.isArray(data) ? data : (data.pacientes || []);
      const nombreNorm = normalizarNombre(q);
      const registroActual = formData.registro_id.trim().toUpperCase();
      const coincidencias = list.filter(p =>
        normalizarNombre(p.nombre) === nombreNorm &&
        p.registro_id !== registroActual
      );
      setDuplicados(coincidencias);
      // Auto-enlazar si existe coincidencia exacta
      const matchExacto = list.find(p => normalizarNombre(p.nombre) === nombreNorm);
      if (matchExacto && !patientLookup) {
        setPatientLookup(matchExacto);
        setFormData(prev => ({
          ...prev,
          registro_id: matchExacto.registro_id,
          nombre: matchExacto.nombre,
          sexo: matchExacto.sexo || 'M',
          edad: String(matchExacto.edad ?? ''),
          fecha_nacimiento: matchExacto.fecha_nacimiento || '',
        }));
      }
    } catch { setDuplicados([]); }
    finally { setBuscandoDups(false); }
  }, [user.token, patientLookup, formData.registro_id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: type === 'checkbox' ? checked : value };
      if (name === 'tipo_estudio') {
        const auto = regionDeTipo(value);
        if (auto) next.region = auto;
      }
      return next;
    });
    if (name === 'registro_id') {
      setPatientLookup(null);
      setDuplicados([]);
    }
    // Buscar duplicados con debounce al escribir nombre (solo paciente nuevo)
    if (name === 'nombre' && !patientLookup) {
      clearTimeout(dupTimerRef.current);
      setDuplicados([]);
      dupTimerRef.current = setTimeout(() => buscarDuplicados(value), 600);
    }
  };

  const handleRegistroBlur = () => buscarPaciente(formData.registro_id);

  // --- Validación client-side antes de enviar ---
  const validate = () => {
    if (!formData.registro_id.trim()) return 'Ingrese el número de registro';
    if (!/^RX-\d{6,}$/i.test(formData.registro_id.trim())) return 'El registro debe tener formato RX-XXXXXX';
    if (!patientLookup) {
      if (!formData.nombre.trim()) return 'Ingrese el nombre completo del paciente';
      const edadNum = parseInt(formData.edad, 10);
      if (formData.edad === '' || !Number.isFinite(edadNum) || edadNum < 0 || edadNum > 120)
        return 'Ingrese una edad válida (0–120 años)';
    }
    return null;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setSaving(true);

    const payload = {
      ...formData,
      paciente_id: patientLookup ? patientLookup.id : undefined,
      registro_id: formData.registro_id.trim().toUpperCase(),
      edad: formData.edad !== '' ? parseInt(formData.edad, 10) : undefined,
    };

    fetch(`${API_URL}/api/registrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
      body: JSON.stringify(payload),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) onSuccess(data);
        else setError(data.error || 'Error al registrar');
      })
      .catch(() => setError('Error de conexión. Verifique que el servidor esté activo.'))
      .finally(() => setSaving(false));
  };

  const isExistingPatient = !!patientLookup;
  const nombreCatalogo = categoriaSugerida(formData.tipo_estudio);
  const mostrarDuplicados = !isExistingPatient && duplicados.length > 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="flex-1">
            <h3 style={{ margin: 0, fontSize: 17, color: 'var(--color-text)' }}>＋ Registrar Nuevo Estudio</h3>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
              {loadingId ? 'Generando ID…' : isExistingPatient
                ? `Nuevo estudio para ${patientLookup.nombre}`
                : 'Complete los datos del paciente y del estudio'}
            </p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="alert alert-danger" role="alert">
              <span>⚠️</span><span>{error}</span>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            id="register-placa-form"
            noValidate
          >
            {/* ── Número de Registro ── */}
            <div>
              <label className="field-label" htmlFor="reg-registro">
                Número de Registro
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 400, marginLeft: 8 }}>
                  {loadingId ? 'Generando...' : isExistingPatient ? '— paciente existente' : '— generado automáticamente'}
                </span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="reg-registro"
                  type="text"
                  className="input"
                  name="registro_id"
                  value={formData.registro_id}
                  onChange={handleChange}
                  onBlur={handleRegistroBlur}
                  required
                  autoComplete="off"
                  style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15, paddingRight: lookingUp ? 36 : undefined }}
                />
                {lookingUp && (
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                    <span className="spinner" style={{ width: 15, height: 15, borderWidth: 2 }} />
                  </span>
                )}
              </div>
              {isExistingPatient && (
                <div className="alert alert-success" style={{ marginTop: 8, marginBottom: 0, padding: '9px 12px', fontSize: 12.5 }}>
                  <span>✓</span>
                  <span>Paciente existente: <strong>{patientLookup.nombre}</strong> — datos pre-llenados. Solo completa el estudio.</span>
                </div>
              )}
            </div>

            {/* ── Datos del Paciente ── */}
            <fieldset style={{
              border: `1px solid ${isExistingPatient ? 'var(--color-success-border, #86efac)' : mostrarDuplicados ? '#f59e0b' : 'var(--color-border)'}`,
              borderRadius: 14, padding: '14px 16px',
              opacity: isExistingPatient ? 0.7 : 1, margin: 0,
              background: isExistingPatient ? 'var(--color-success-bg, #f0fdf4)' : undefined,
            }}>
              <legend style={{ fontSize: 11.5, color: isExistingPatient ? '#16a34a' : 'var(--color-text-muted)', padding: '0 8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {isExistingPatient ? '✓ Paciente existente (pre-llenado)' : 'Datos del Paciente'}
              </legend>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 6 }}>

                <div>
                  <label className="field-label">
                    Nombre Completo {!isExistingPatient && <span style={{ color: '#ef4444' }}>*</span>}
                    {buscandoDups && (
                      <span style={{ marginLeft: 8, opacity: 0.5 }}>
                        <span className="spinner" style={{ width: 11, height: 11, borderWidth: 2, display: 'inline-block', verticalAlign: 'middle' }} />
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    className="input"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    required={!isExistingPatient}
                    readOnly={isExistingPatient}
                    placeholder="Nombre y apellidos del paciente"
                    style={mostrarDuplicados ? { borderColor: '#f59e0b', background: '#fffbeb' } : undefined}
                  />

                  {/* ── Advertencia de posibles duplicados ── */}
                  {mostrarDuplicados && (
                    <div style={{
                      marginTop: 8, padding: '10px 13px', borderRadius: 10,
                      background: '#fffbeb', border: '1px solid #f59e0b',
                      fontSize: 12.5, color: '#78350f',
                    }} role="alert">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6, fontWeight: 700 }}>
                        <Icon name="info" size={14} color="#d97706" />
                        Posible duplicado — ya existe{duplicados.length > 1 ? 'n' : ''} {duplicados.length} registro{duplicados.length > 1 ? 's' : ''} con este nombre
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {duplicados.map(d => (
                          <div key={d.registro_id} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 10px', borderRadius: 8,
                            background: '#fef3c7', border: '1px solid #fde68a',
                          }}>
                            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, fontSize: 12, color: '#92400e', flexShrink: 0 }}>
                              {d.registro_id}
                            </span>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {d.nombre}
                            </span>
                            <span style={{ fontSize: 11, color: '#b45309', flexShrink: 0 }}>
                              {d.edad ? `${d.edad} años` : ''}{d.sexo ? ` · ${d.sexo}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p style={{ margin: '8px 0 0', fontSize: 11.5, color: '#92400e' }}>
                        Si es el mismo paciente, ingresa su número de registro arriba para agregar el estudio a su expediente.
                      </p>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label className="field-label">
                      Edad (años) {!isExistingPatient && <span style={{ color: '#ef4444' }}>*</span>}
                    </label>
                    <input
                      type="number"
                      className="input"
                      name="edad"
                      value={formData.edad}
                      onChange={handleChange}
                      required={!isExistingPatient}
                      min="0"
                      max="120"
                      readOnly={isExistingPatient}
                      placeholder="Ej. 45"
                    />
                  </div>
                  <div style={{ width: 160 }}>
                    <label className="field-label">Sexo</label>
                    <select className="input" name="sexo" value={formData.sexo} onChange={handleChange} disabled={isExistingPatient}>
                      <option value="M">Masculino</option>
                      <option value="F">Femenino</option>
                      <option value="O">Otro / No especificado</option>
                    </select>
                  </div>
                </div>
              </div>
            </fieldset>

            {/* ── Datos del Estudio ── */}
            <fieldset style={{ border: '1px solid var(--color-border)', borderRadius: 14, padding: '14px 16px', margin: 0 }}>
              <legend style={{ fontSize: 11.5, color: 'var(--color-text-muted)', padding: '0 8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Datos del Estudio
              </legend>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 6 }}>

                <div>
                  <label className="field-label" htmlFor="reg-fecha-estudio">
                    Fecha del Estudio <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    id="reg-fecha-estudio"
                    type="date"
                    className="input"
                    name="fecha_estudio"
                    value={formData.fecha_estudio}
                    onChange={handleChange}
                    required
                    max={getToday()}
                  />
                </div>

                <div>
                  <label className="field-label" htmlFor="reg-tipo">
                    Tipo de Estudio
                    <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 6 }}>(opcional)</span>
                  </label>
                  <input
                    id="reg-tipo"
                    type="text"
                    className="input"
                    name="tipo_estudio"
                    value={formData.tipo_estudio}
                    onChange={handleChange}
                    placeholder="Ej. Tórax PA, Columna lumbar AP…"
                    list="catalogo-estudios"
                    autoComplete="off"
                  />
                  <datalist id="catalogo-estudios">
                    {CATALOGO_ESTUDIOS.map(e => (
                      <option key={e.tipo} value={e.tipo}>{e.region} · {e.categoria}</option>
                    ))}
                  </datalist>
                  {formData.tipo_estudio && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 4 }}>
                      <Icon name="info" size={12} color="var(--color-text-muted)" />
                      Plantilla sugerida: <strong>{nombreCatalogo}</strong>
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label className="field-label" htmlFor="reg-region">Región Anatómica</label>
                    <select id="reg-region" className="input" name="region" value={formData.region} onChange={handleChange}>
                      <option value="">Sin especificar</option>
                      {REGIONES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div style={{ width: 160 }}>
                    <label className="field-label" htmlFor="reg-lateralidad">Lateralidad</label>
                    <select id="reg-lateralidad" className="input" name="lateralidad" value={formData.lateralidad} onChange={handleChange}>
                      <option value="">Sin especificar</option>
                      <option value="Derecha">Derecha</option>
                      <option value="Izquierda">Izquierda</option>
                      <option value="Ambos">Ambos</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="field-label">Médico Remitente</label>
                  <input
                    type="text"
                    className="input"
                    name="medico_remitente"
                    value={formData.medico_remitente}
                    readOnly
                    tabIndex={-1}
                    style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', cursor: 'default' }}
                  />
                </div>

                <div>
                  <label className="field-label">
                    Notas Clínicas
                    <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 6 }}>(opcional)</span>
                  </label>
                  <textarea
                    className="input"
                    name="notas_clinicas"
                    value={formData.notas_clinicas}
                    onChange={handleChange}
                    rows={3}
                    style={{ resize: 'vertical', minHeight: 72 }}
                    placeholder="Indicaciones clínicas, motivo de consulta, antecedentes relevantes…"
                  />
                </div>

                <label
                  htmlFor="reg-urgente"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, cursor: 'pointer',
                    padding: '10px 13px', borderRadius: 10,
                    border: `1px solid ${formData.urgente ? '#fecaca' : 'var(--color-border)'}`,
                    background: formData.urgente ? '#fef2f2' : 'var(--color-surface)',
                    color: formData.urgente ? '#b91c1c' : 'var(--color-text-secondary)',
                    fontWeight: formData.urgente ? 700 : 500,
                    transition: 'all 0.15s',
                  }}
                >
                  <input
                    id="reg-urgente"
                    type="checkbox"
                    name="urgente"
                    checked={!!formData.urgente}
                    onChange={handleChange}
                    style={{ accentColor: '#ef4444', width: 16, height: 16, flexShrink: 0 }}
                  />
                  <span>
                    <span style={{ fontWeight: 700 }}>Urgente</span>
                    <span style={{ fontWeight: 400, marginLeft: 6, opacity: 0.8 }}>— aparece primero en la lista del radiólogo</span>
                  </span>
                </label>
              </div>
            </fieldset>
          </form>
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="submit"
            form="register-placa-form"
            className="btn btn-primary"
            disabled={saving || loadingId}
            style={{ minWidth: 220 }}
          >
            {saving ? (
              <><span className="spinner" style={{ width: 15, height: 15, borderWidth: 2 }} /> Registrando…</>
            ) : isExistingPatient
              ? <><Icon name="plus" size={14} color="#fff" /> Agregar estudio a {formData.registro_id}</>
              : <><Icon name="plus" size={14} color="#fff" /> Registrar e ingresar a "Recibida"</>
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegisterModal;
