import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { API_URL } from '../config';

const AccountSettings = ({ onClose }) => {
  // Cerrar con tecla Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
  const { user, logout } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    current_password: '',
    new_username: '',
    new_password: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!formData.new_username && !formData.new_password) {
      setError('No hay cambios para guardar');
      return;
    }
    if (!formData.current_password) {
      setError('Confirme su contraseña actual para guardar los cambios');
      return;
    }
    if (formData.new_username && !/^[a-zA-Z0-9._-]{3,40}$/.test(formData.new_username)) {
      setError('El usuario debe tener 3–40 caracteres: letras, números, punto, guion o guion bajo');
      return;
    }
    if (formData.new_password && formData.new_password.length < 10) {
      setError('La nueva contraseña debe tener al menos 10 caracteres');
      return;
    }

    setSaving(true);
    fetch(`${API_URL}/api/usuarios/me`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      body: JSON.stringify(formData)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setSuccess('Credenciales actualizadas. Por seguridad debe iniciar sesión nuevamente.');
        setTimeout(() => logout(), 1600);
      } else {
        setError(data.error || 'Error al guardar');
      }
    })
    .catch(() => setError('Error de conexión'))
    .finally(() => setSaving(false));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="flex-1">
            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--color-text)' }}>⚙️ Ajustes de Cuenta</h3>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>Cambie su usuario o contraseña</p>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="alert alert-danger">
              <span>⚠️</span><span>{error}</span>
            </div>
          )}
          {success && (
            <div className="alert alert-success">
              <span>✓</span><span>{success}</span>
            </div>
          )}
          <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', marginBottom: 18, lineHeight: 1.6 }}>
            Deje en blanco lo que no desee cambiar. Al guardar deberá iniciar sesión nuevamente.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="field-label">Contraseña Actual</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                autoComplete="current-password"
                value={formData.current_password}
                onChange={e => setFormData({ ...formData, current_password: e.target.value })}
              />
              <span style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                Requerida para confirmar cualquier cambio de credenciales.
              </span>
            </div>
            <div>
              <label className="field-label">Nuevo Usuario (Opcional)</label>
              <input type="text" className="input" placeholder={user.username} value={formData.new_username} onChange={e => setFormData({...formData, new_username: e.target.value})} />
            </div>
            <div>
              <label className="field-label">Nueva Contraseña (Opcional)</label>
              <input type="password" className="input" placeholder="Mínimo 10 caracteres" autoComplete="new-password" value={formData.new_password} onChange={e => setFormData({...formData, new_password: e.target.value})} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;
