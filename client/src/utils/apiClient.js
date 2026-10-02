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

    const respuesta = await fetchOriginal(recurso, opcionesFinales);

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
