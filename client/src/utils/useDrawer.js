import { useEffect } from 'react';

// Solo tiene sentido en dispositivos táctiles.
const esTactil = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(hover: none) and (pointer: coarse)').matches;

/**
 * Cierra un drawer lateral (sidebar / worklist) deslizando el dedo
 * hacia la izquierda sobre él. Ignora gestos sobre campos de texto
 * para no interrumpir la escritura o selección.
 */
export const useSwipeClose = (ref, onClose, activo = true) => {
  useEffect(() => {
    if (!activo || !esTactil()) return;
    const el = ref?.current;
    if (!el || typeof onClose !== 'function') return;
    let x0 = 0;
    let y0 = 0;
    let t0 = 0;
    const onStart = (e) => {
      if (e.touches.length !== 1) return;
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      const t = e.touches[0];
      x0 = t.clientX;
      y0 = t.clientY;
      t0 = Date.now();
    };
    const onEnd = (e) => {
      if (!x0 && !y0) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - x0;
      const dy = t.clientY - y0;
      x0 = 0;
      y0 = 0;
      if (Date.now() - t0 > 600) return;
      if (dx < -70 && Math.abs(dy) < 60) onClose();
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchend', onEnd);
    };
  }, [ref, onClose, activo]);
};

/**
 * Cierra un drawer automáticamente al pasar a ancho de escritorio
 * (p. ej. rotar la tableta o redimensionar). Evita que el backdrop
 * quede cubriendo la pantalla en escritorio.
 */
export const useDrawerAutoClose = (onClose) => {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(min-width: 901px)');
    const handler = (e) => {
      if (e.matches) onClose();
    };
    // Por si el componente montó ya en escritorio con el drawer abierto.
    if (mq.matches) onClose();
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, [onClose]);
};
