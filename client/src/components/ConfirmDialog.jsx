import React, { useEffect } from 'react';
import Icon from './Icons';

/**
 * Modal de confirmación / alerta que reemplaza window.confirm y window.alert.
 *
 * Props:
 *   title      — Título del diálogo
 *   message    — Mensaje descriptivo (string o JSX)
 *   variant    — 'danger' | 'warning' | 'info'  (por defecto 'danger')
 *   confirmLabel — Texto del botón de confirmación (por defecto 'Confirmar')
 *   cancelLabel  — Texto del botón de cancelar. Si es null, no se muestra (modo alerta).
 *   onConfirm  — Callback al confirmar
 *   onCancel   — Callback al cancelar / cerrar
 */
const ConfirmDialog = ({
  title,
  message,
  variant = 'danger',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}) => {
  // Cerrar con Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  const iconName = variant === 'info' ? 'info' : 'alertTriangle';
  const iconColor = variant === 'danger'
    ? 'var(--color-danger)'
    : variant === 'warning'
      ? 'var(--color-warning)'
      : 'var(--color-secondary)';

  const confirmBtnClass = variant === 'danger' ? 'btn-danger-solid' : variant === 'warning' ? 'btn-warning' : 'btn-primary';

  return (
    <div
      className="confirm-modal"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div
        className="confirm-modal-box"
        onClick={e => e.stopPropagation()}
      >
        <div className={`confirm-modal-icon ${variant}`}>
          <Icon name={iconName} size={26} color={iconColor} />
        </div>

        <div id="confirm-title" className="confirm-modal-title">{title}</div>
        <div className="confirm-modal-body">{message}</div>

        <div className="confirm-modal-actions">
          {cancelLabel !== null && (
            <button className="btn btn-ghost" onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
          <button
            className={`btn ${confirmBtnClass}`}
            onClick={() => { onCancel?.(); onConfirm?.(); }}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
