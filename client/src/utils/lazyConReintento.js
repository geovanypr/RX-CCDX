import { lazy } from 'react';

// `lazy()` con reintento ante chunks obsoletos.
//
// Cada redeploy genera chunks con hash nuevo. Si el usuario tenía la app
// abierta, el bundle viejo pide un chunk que ya no existe en el servidor y
// el import dinámico falla ("Failed to fetch dynamically imported module"),
// lo que antes terminaba en la pantalla "No se pudo cargar esta pantalla".
//
// Con este envoltorio, ante un fallo de carga de chunk se recarga la página
// UNA vez para obtener el bundle fresco. La marca en sessionStorage evita
// bucles infinitos si el error es real (entonces sí se muestra el boundary).
const YA_RECARGADO = 'rxccdx_chunk_reload';

export function lazyConReintento(importFn) {
  return lazy(() =>
    importFn().catch((error) => {
      const esChunkObsoleto =
        error?.name === 'ChunkLoadError' ||
        /Failed to fetch dynamically imported module|Loading chunk|ChunkLoadError|Importing a module script failed/i.test(
          error?.message || ''
        );
      try {
        if (esChunkObsoleto && !window.sessionStorage.getItem(YA_RECARGADO)) {
          window.sessionStorage.setItem(YA_RECARGADO, '1');
          window.location.reload();
          return new Promise(() => {}); // la página se recarga; nunca se resuelve
        }
        window.sessionStorage.removeItem(YA_RECARGADO);
      } catch { /* almacenamiento no disponible */ }
      throw error;
    })
  );
}
