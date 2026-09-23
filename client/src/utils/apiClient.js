// Interceptor global de `fetch`:
//  1. Adjunta el token guardado a las llamadas al API (evita depender de que cada
//     componente recuerde enviar la cabecera Authorization).
//  2. Si el servidor responde 401 en una ruta protegida, limpia la sesión y
//     regresa al inicio de sesión explicando el motivo.
import { API_URL } from '../config';

const CLAVES_SESION = ['rxccdx_token', 'rxccdx_role', 'rxccdx_username', 'rxccdx_id'];
const RUTAS_SIN_SESION = /\/api\/auth\/(login|recover)/;

let instalado = false;

export const instalarInterceptorSesion = () => {
  if (instalado || typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  instalado = true;

  const fetchOriginal = window.fetch.bind(window);

  window.fetch = async (recurso, opciones = {}) => {
    const url = typeof recurso === 'string' ? recurso : recurso?.url || '';
    const esApi = url.startsWith(API_URL) || url.startsWith('/api');
    let opcionesFinales = opciones;

    const token = localStorage.getItem('rxccdx_token');
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
      localStorage.getItem('rxccdx_token')
    ) {
      CLAVES_SESION.forEach(clave => localStorage.removeItem(clave));
      if (!window.location.pathname.startsWith('/login')) {
        window.location.replace('/login?sesion=expirada');
      }
    }

    return respuesta;
  };
};
