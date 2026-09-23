import React from 'react';
import Icon from './Icons';

const TYPE_META = {
  enviado:     { accent: '#3b82f6', bg: '#eff6ff', icon: 'send',        iconColor: '#3b82f6' },
  diagnostico: { accent: '#16a34a', bg: '#f0fdf4', icon: 'checkCircle', iconColor: '#16a34a' },
  nuevo:       { accent: '#d97706', bg: '#fffbeb', icon: 'plus',        iconColor: '#d97706' },
  devuelto:    { accent: '#f97316', bg: '#fff7ed', icon: 'return',      iconColor: '#f97316' },
  mensaje:     { accent: '#7c3aed', bg: '#f5f3ff', icon: 'message',     iconColor: '#7c3aed' },
  archivo:     { accent: '#06b6d4', bg: '#ecfeff', icon: 'clip',        iconColor: '#06b6d4' },
  success:     { accent: '#16a34a', bg: '#f0fdf4', icon: 'checkCircle', iconColor: '#16a34a' },
  error:       { accent: '#dc2626', bg: '#fef2f2', icon: 'warning',     iconColor: '#dc2626' },
  default:     { accent: '#64748b', bg: '#f8fafc', icon: 'bell',        iconColor: '#64748b' },
};

const NotificationToast = ({ notifications, onDismiss }) => {
  if (notifications.length === 0) return null;

  return (
    <div className="toast-stack">
      {notifications.map(n => {
        const meta = TYPE_META[n.type] || TYPE_META.default;
        return (
          <div
            key={n.id}
            className="toast"
            onClick={() => onDismiss(n.id)}
            style={{ borderLeftColor: meta.accent, background: meta.bg }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10, background: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, boxShadow: 'var(--shadow-xs)',
                border: '1px solid var(--color-border)',
              }}>
                <Icon name={meta.icon} size={16} color={meta.iconColor} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong className="toast-title">{n.title}</strong>
                <p className="toast-msg">{n.message}</p>
                <span className="toast-time">{new Date(n.timestamp).toLocaleTimeString()}</span>
              </div>
              <div style={{ flexShrink: 0, marginTop: 2, color: 'var(--color-text-muted)' }}>
                <Icon name="close" size={14} color="var(--color-text-muted)" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default NotificationToast;
