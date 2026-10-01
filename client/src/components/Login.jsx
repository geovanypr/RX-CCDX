import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { API_URL } from '../config';
import { getRememberChoice, getSavedUsername } from '../utils/sessionStore';
import { enableSound } from '../utils/notificationSound';
import Icon from './Icons';
import { enforceLightMode } from '../utils/useTheme';

// Garantizar modo claro en cuanto se carga el módulo — antes del primer render
enforceLightMode();

const Login = () => {
  const [username, setUsername] = useState(() => getSavedUsername());
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(() => getRememberChoice());
  const [loading, setLoading] = useState(false);
  const [verificandoSesion, setVerificandoSesion] = useState(false);
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(
    searchParams.get('sesion') === 'expirada'
      ? 'Su sesión expiró por seguridad. Inicie sesión nuevamente.'
      : ''
  );
  const navigate = useNavigate();
  const { user, loading: authLoading, login, logout } = useContext(AuthContext);

  const irAInicio = (role) => {
    if (role === 'SUPER_ADMIN') navigate('/admin', { replace: true });
    else if (role === 'RADIOLOGO') navigate('/radiologo', { replace: true });
    else navigate('/dashboard', { replace: true });
  };

  // Entrada directa: si ya hay sesión guardada, verificarla y entrar
  // sin pedir credenciales de nuevo.
  useEffect(() => {
    if (authLoading || !user?.token) return;
    setVerificandoSesion(true);
    fetch(`${API_URL}/api/config`, {
      headers: { 'Authorization': `Bearer ${user.token}` },
    })
      .then(res => {
        if (!res.ok) throw new Error('Sesión inválida');
        return res.json();
      })
      .then(() => irAInicio(user.role))
      .catch(() => {
        logout();
        setVerificandoSesion(false);
      });
  }, [authLoading, user?.token]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    enableSound();
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password, remember }),
      });
      const data = await res.json();
      if (data.token) {
        login(data, remember);
        if (data.role === 'SUPER_ADMIN') navigate('/admin');
        else if (data.role === 'RADIOLOGO') navigate('/radiologo');
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

  // Mientras se verifica una sesión guardada, mostrar espera en vez del formulario.
  if (!authLoading && user?.token && verificandoSesion && !error) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <img className="brand-logo" src="/logo.png" alt="RX CCDX — Logo institucional" />
          <h1 className="brand-name">RX CCDX</h1>
          <p className="brand-tagline">
            <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Abriendo su sesión, {user.username}...
          </p>
        </div>
      </div>
    );
  }

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

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--color-secondary)', cursor: 'pointer' }}
            />
            Recuérdame en este dispositivo
          </label>

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
