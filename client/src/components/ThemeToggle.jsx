import React, { useContext } from 'react';
import Icon from './Icons';
import { useTheme } from '../utils/useTheme';
import { AuthContext } from '../context/AuthContext';

/**
 * Botón para alternar entre modo claro y oscuro.
 * Usa el userId del AuthContext para que la preferencia sea por usuario.
 *
 * Props:
 *   variant: 'sidebar' | 'topbar' | 'icon'
 */
const ThemeToggle = ({ variant = 'topbar' }) => {
  const { user } = useContext(AuthContext);
  const { isDark, toggleTheme } = useTheme(user?.id);

  const label = isDark ? 'Modo claro' : 'Modo oscuro';
  const ariaLabel = isDark ? 'Activar modo claro' : 'Activar modo oscuro';
  const iconName = isDark ? 'sun' : 'moon';

  if (variant === 'sidebar') {
    return (
      <button
        className="btn"
        onClick={toggleTheme}
        title={label}
        aria-label={ariaLabel}
        style={{
          width: '100%',
          justifyContent: 'flex-start',
          background: 'transparent',
          color: 'rgba(255,255,255,0.55)',
          borderColor: 'transparent',
          fontSize: 12.5,
          padding: '8px 11px',
          gap: 8,
        }}
      >
        <Icon name={iconName} size={14} color="currentColor" />
        {label}
      </button>
    );
  }

  if (variant === 'icon') {
    return (
      <button
        className="btn btn-ghost btn-icon btn-sm"
        onClick={toggleTheme}
        title={label}
        aria-label={ariaLabel}
      >
        <Icon name={iconName} size={16} color="var(--color-text-secondary)" />
      </button>
    );
  }

  // topbar (default)
  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={toggleTheme}
      title={label}
      aria-label={ariaLabel}
      style={{ gap: 6, padding: '6px 10px' }}
    >
      <Icon name={iconName} size={15} color="var(--color-text-secondary)" />
      <span style={{ fontSize: 12.5 }}>{label}</span>
    </button>
  );
};

export default ThemeToggle;
