import React, { useState } from 'react';
import { API_URL } from '../config';
import { useNavigate, Link } from 'react-router-dom';
import { enforceLightMode } from '../utils/useTheme';

// La página de recuperación siempre en modo claro
enforceLightMode();

const RecoverPassword = () => {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [pregunta, setPregunta] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    respuesta_seguridad: '',
    new_password: ''
  });

  const navigate = useNavigate();

  const handleFetchQuestion = (e) => {
    e.preventDefault();
    setError('');
    fetch(`${API_URL}/api/auth/recover/${encodeURIComponent(username)}`)
      .then(res => res.json())
      .then(data => {
        if (data.pregunta) {
          setPregunta(data.pregunta);
          setStep(2);
        } else {
          setError(data.error || 'Usuario no encontrado');
        }
      })
      .catch(() => setError('Error de conexión con el servidor.'));
  };

  const handleReset = (e) => {
    e.preventDefault();
    setError('');
    fetch(`${API_URL}/api/auth/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        respuesta_seguridad: formData.respuesta_seguridad,
        new_password: formData.new_password
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // Mostrar mensaje de éxito inline y redirigir tras 2.5 s
        setSuccess('Contraseña actualizada con éxito. Redirigiendo al inicio de sesión…');
        setTimeout(() => navigate('/login'), 2500);
      } else {
        setError(data.error || 'Error al restablecer la contraseña');
      }
    })
    .catch(() => setError('Error de conexión con el servidor.'));
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <img className="brand-logo" src="/logo.png" alt="RX CCDX — Logo institucional" />
          <h1 className="brand-name" style={{ fontSize: 19 }}>Recuperar Contraseña</h1>
          <p className="brand-tagline">RX CCDX — Sistema de Gestión Radiológica</p>
        </div>

        {error && (
          <div className="alert alert-danger" role="alert">
            <span aria-hidden="true">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success" role="status" aria-live="polite">
            <span aria-hidden="true">✅</span>
            <span>{success}</span>
          </div>
        )}

        {!success && step === 1 && (
          <form onSubmit={handleFetchQuestion} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', textAlign: 'center', lineHeight: 1.6 }}>
              Ingrese su nombre de usuario para recuperar su pregunta de seguridad.
            </p>
            <div>
              <label className="field-label">Usuario</label>
              <input type="text" className="input" value={username} onChange={e => setUsername(e.target.value)} required autoFocus autoComplete="username" />
            </div>
            <button type="submit" className="btn btn-primary btn-lg btn-block">Buscar Usuario</button>
          </form>
        )}

        {!success && step === 2 && (
          <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '14px 16px', background: 'var(--color-info-bg)', borderRadius: 12, borderLeft: '4px solid var(--color-secondary)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Pregunta de seguridad
              </p>
              <p style={{ fontSize: 14, color: '#003366', fontWeight: 600 }}>{pregunta}</p>
            </div>
            <div>
              <label className="field-label">Tu Respuesta</label>
              <input type="text" className="input" value={formData.respuesta_seguridad} onChange={e => setFormData({...formData, respuesta_seguridad: e.target.value})} required autoComplete="off" />
            </div>
            <div>
              <label className="field-label">Nueva Contraseña</label>
              <input type="password" className="input" value={formData.new_password} onChange={e => setFormData({...formData, new_password: e.target.value})} required autoComplete="new-password" minLength={10} />
              <p className="field-hint">Mínimo 10 caracteres</p>
            </div>
            <button type="submit" className="btn btn-primary btn-lg btn-block">Restablecer Contraseña</button>
          </form>
        )}

        <div className="auth-footer">
          <Link to="/login" style={{ color: 'var(--color-secondary)', textDecoration: 'none', fontWeight: 600 }}>
            ← Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RecoverPassword;
