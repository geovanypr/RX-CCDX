import { useEffect, useRef } from 'react';

// Revalida datos al volver a la app: desbloquear el teléfono, cambiar de app
// o volver a la pestaña. En móvil la pantalla se apaga a cada rato y los
// datos quedan viejos sin esto.
//
// Solo dispara si estuvo oculta más de 30 s, y como máximo una vez por minuto
// (evita ráfagas al alternar entre apps).
export const useVisibleRefetch = (refetch, activo = true) => {
  const cbRef = useRef(refetch);
  cbRef.current = refetch;
  const ultimoRef = useRef(0);
  const ocultaEnRef = useRef(0);

  useEffect(() => {
    if (!activo) return;
    const onHidden = () => {
      ocultaEnRef.current = Date.now();
    };
    const onVisible = () => {
      const ahora = Date.now();
      const ocultaDesde = ocultaEnRef.current;
      ocultaEnRef.current = 0;
      if (!ocultaDesde) return;
      if (ahora - ocultaDesde < 30000) return;
      if (ahora - ultimoRef.current < 60000) return;
      ultimoRef.current = ahora;
      try {
        cbRef.current?.();
      } catch {
        /* un refetch fallido no debe romper la vista */
      }
    };
    const onVisibilidad = () => {
      if (document.hidden) onHidden();
      else onVisible();
    };
    document.addEventListener('visibilitychange', onVisibilidad);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilidad);
      window.removeEventListener('focus', onVisible);
    };
  }, [activo]);
};
