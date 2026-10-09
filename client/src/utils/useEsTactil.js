import { useEffect, useState } from 'react';

/**
 * Detecta dispositivo táctil (móvil/tableta) con el estándar web:
 * `(hover: none) and (pointer: coarse)`. A diferencia de husmear el
 * User-Agent (librerías tipo react-device-detect), esto detecta la
 * CAPACIDAD real: funciona con tablets, plegables y 2-en-1, no suma
 * peso al bundle y reacciona si se conecta un mouse.
 */
export const useEsTactil = () => {
  const [tactil, setTactil] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: none) and (pointer: coarse)').matches === true
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(hover: none) and (pointer: coarse)');
    const handler = (e) => setTactil(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  return tactil;
};
