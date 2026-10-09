// Interceptor global de `fetch`:
//  1. Adjunta el token guardado a las llamadas al API (evita depender de que cada
//     componente recuerde enviar la cabecera Authorization).
//  2. Si el servidor responde 401 en una ruta protegida, limpia la sesión y
//     regresa al inicio de sesión explicando el motivo.
import { API_URL } from '../config';
import { getSessionToken, clearSession } from './sessionStore';

// Rutas donde un 401 NO significa "sesión expirada" sino un error
// esperado (credenciales inválidas, contraseña actual incorrecta, etc.)
// y por tanto no se debe limpiar la sesión ni redirigir al login.
const RUTAS_SIN_SESION = /\/api\/auth\/(login|recover)|\/api\/usuarios\/me/;

let instalado = false;

// Tiempos máximos de espera: en redes móviles la conexión se puede colgar
// y fetch esperaría para siempre (spinners eternos, "no se envía nada").
export const TIMEOUT_API = 45000;
export const TIMEOUT_SUBIDA = 5 * 60 * 1000;

const esSocketIO = (url) => url.includes('/socket.io/');

const errorTimeout = () =>
  new Error('Tiempo de espera agotado. Verifique su conexión e intente de nuevo.');

/**
 * fetch con tiempo máximo: aborta y rechaza con un error legible si el
 * servidor no responde a tiempo. Respeta una signal propia si se provee.
 */
export const fetchConTimeout = (recurso, opciones = {}, ms = TIMEOUT_API) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(errorTimeout()), ms);
  const externa = opciones.signal;
  if (externa) {
    if (externa.aborted) ctrl.abort(externa.reason);
    else externa.addEventListener('abort', () => ctrl.abort(externa.reason), { once: true });
  }
  return fetch(recurso, { ...opciones, signal: ctrl.signal })
    .finally(() => clearTimeout(timer));
};

export const instalarInterceptorSesion = () => {
  if (instalado || typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  instalado = true;

  const fetchOriginal = window.fetch.bind(window);

  window.fetch = async (recurso, opciones = {}) => {
    const url = typeof recurso === 'string' ? recurso : recurso?.url || '';
    const esApi = url.startsWith(API_URL) || url.startsWith('/api');
    let opcionesFinales = opciones;

    const token = getSessionToken();
    if (esApi && token) {
      const headers = new Headers(opciones.headers || {});
      if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
      opcionesFinales = { ...opciones, headers };
    }

    const respuesta = await (async () => {
      // Sin signal propia: timeout por defecto (45 s) para no colgarse en
      // redes móviles. Se excluye socket.io (polling con espera larga) y las
      // subidas, que proveen su propio timeout más generoso.
      if (esApi && !esSocketIO(url) && !opcionesFinales.signal) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(errorTimeout()), TIMEOUT_API);
        try {
          return await fetchOriginal(recurso, { ...opcionesFinales, signal: ctrl.signal });
        } finally {
          clearTimeout(timer);
        }
      }
      return fetchOriginal(recurso, opcionesFinales);
    })();

    if (
      respuesta.status === 401 &&
      esApi &&
      !RUTAS_SIN_SESION.test(url) &&
      getSessionToken()
    ) {
      clearSession();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.replace('/login?sesion=expirada');
      }
    }

    return respuesta;
  };
};
