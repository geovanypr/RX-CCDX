import React, { useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { API_URL } from '../config';

const RegisterUser = () => {
  const { user, logout } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'RADIOLOGO',
    pregunta_seguridad: '¿Cuál fue tu primera mascota?',
    respuesta_seguridad: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`,
      },
      body: JSON.stringify(formData)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setSuccess(true);
        setFormData({ ...formData, username: '', password: '', respuesta_seguridad: '' });
      } else {
        setError(data.error || 'Error al crear la cuenta');
      }
    })
    .catch(() => setError('Error de conexión con el servidor.'));
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ width: 460 }}>
        <div className="auth-brand">
          <img className="brand-logo" src="/logo.png" alt="RX CCDX — Logo institucional" />
          <h1 className="brand-name" style={{ fontSize: 19 }}>Registro Institucional</h1>
          <p className="brand-tagline">Panel exclusivo del Super Administrador</p>
        </div>

        {error && (
          <div className="alert alert-danger">
            <span>⚠️</span><span>{error}</span>
          </div>
        )}
        {success && (
          <div className="alert alert-success">
            <span>✅</span><span>Cuenta creada exitosamente.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="field-label">Usuario</label>
            <input type="text" className="input" name="username" value={formData.username} onChange={handleChange} required />
          </div>
          <div>
            <label className="field-label">Contraseña</label>
            <input type="password" className="input" name="password" value={formData.password} onChange={handleChange} required />
          </div>
          <div>
            <label className="field-label">Rol Asignado</label>
            <select className="input" name="role" value={formData.role} onChange={handleChange}>
              <option value="RADIOLOGO">Médico Radiólogo</option>
              <option value="ENCARGADO">Administrativo / Encargado</option>
            </select>
          </div>

          <div className="divider" style={{ margin: '4px 0' }} />

          <div>
            <label className="field-label">Pregunta de Seguridad</label>
            <select className="input" name="pregunta_seguridad" value={formData.pregunta_seguridad} onChange={handleChange}>
              <option value="¿Cuál fue tu primera mascota?">¿Cuál fue tu primera mascota?</option>
              <option value="¿En qué ciudad nació tu madre?">¿En qué ciudad nació tu madre?</option>
              <option value="¿Cuál es el nombre de tu escuela primaria?">¿Cuál es el nombre de tu escuela primaria?</option>
            </select>
          </div>
          <div>
            <label className="field-label">Respuesta de Seguridad</label>
            <input type="text" className="input" name="respuesta_seguridad" value={formData.respuesta_seguridad} onChange={handleChange} required />
          </div>

          <button type="submit" className="btn btn-primary btn-lg btn-block" style={{ marginTop: '6px' }}>Registrar Cuenta</button>
        </form>

        <div className="auth-footer">
          <Link to="/dashboard" style={{ color: 'var(--color-secondary)', textDecoration: 'none', fontWeight: 600 }}>
            ← Volver al panel
          </Link>
          <button onClick={logout} style={{ marginLeft: 14, fontSize: 12.5, color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegisterUser;
