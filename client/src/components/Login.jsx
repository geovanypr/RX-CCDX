import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { API_URL } from '../config';
import { enableSound } from '../utils/notificationSound';
import Icon from './Icons';
import { enforceLightMode } from '../utils/useTheme';

// Garantizar modo claro en cuanto se carga el módulo — antes del primer render
enforceLightMode();

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(
    searchParams.get('sesion') === 'expirada'
      ? 'Su sesión expiró por seguridad. Inicie sesión nuevamente.'
      : ''
  );
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    enableSound();
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.token) {
        login(data);
        if (data.role === 'RADIOLOGO') navigate('/radiologo');
        else navigate('/dashboard');
      } else {
        setError(data.error || 'Credenciales inválidas');
      }
    } catch {
      setError('No se pudo conectar al servidor. Verifique que el servidor esté en ejecución.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <img className="brand-logo" src="/logo.png" alt="RX CCDX — Logo institucional" />
          <h1 className="brand-name">RX CCDX</h1>
          <p className="brand-tagline">Sistema de Gestión Radiológica</p>
        </div>

        {/* aria-live: el lector de pantalla anuncia el error en cuanto aparece */}
        <div role="alert" aria-live="assertive" aria-atomic="true">
          {error && (
            <div className="alert alert-danger">
              <span aria-hidden="true">⚠️</span>
              <span>{error}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="field-label" htmlFor="username">Usuario</label>
            <input
              id="username"
              type="text"
              className="input"
              placeholder="Ingrese su usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              autoComplete="username"
              spellCheck={false}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="password">Contraseña</label>
            <div className="password-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                tabIndex={-1}
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} size={16} color="currentColor" />
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg btn-block"
            style={{ marginTop: '6px' }}
            disabled={loading}
          >
            {loading ? (
              <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Verificando...</>
            ) : 'Ingresar al Sistema'}
          </button>
        </form>

        <div className="auth-footer">
          <Link
            to="/recover"
            style={{ color: 'var(--color-secondary)', textDecoration: 'none', fontWeight: 600 }}
          >
            ¿Olvidaste tu contraseña?
          </Link>
          <p style={{ marginTop: 14, fontSize: 11, color: 'var(--color-text-muted)' }}>
            Solo el administrador puede crear cuentas de usuario
          </p>
          <p style={{ marginTop: 8, fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 700 }}>
            Creadores: GYPR y AnabelLp
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
