import React from 'react';
import Icon from './Icons';

/**
 * Barra de navegación inferior solo visible en móvil (≤900px, ver responsive.css).
 * Botones: { id, icon, label, badge, fab }
 */
const MobileTabBar = ({ buttons = [], active = '', onSelect }) => {
  if (!buttons.length) return null;
  const elegir = (id) => {
    // Micro-vibración táctil (solo Android / dispositivos que lo soportan)
    try { navigator.vibrate?.(8); } catch { /* sin háptica */ }
    onSelect?.(id);
  };
  return (
    <nav className="mobile-tabbar" aria-label="Navegación principal">
      {buttons.map((b) => {
        const isActive = active === b.id;
        return (
          <button
            key={b.id}
            type="button"
            className={`${isActive ? 'active' : ''}${b.fab ? ' mobile-tabbar-fab' : ''}`}
            onClick={() => elegir(b.id)}
            aria-label={b.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <span style={{ position: 'relative', display: 'flex' }}>
              <Icon name={b.icon} size={b.fab ? 22 : 20} color="currentColor" />
              {b.badge > 0 && <span className="tabbar-badge">{b.badge > 99 ? '99+' : b.badge}</span>}
            </span>
            {!b.fab && <span>{b.label}</span>}
          </button>
        );
      })}
    </nav>
  );
};

export default MobileTabBar;
