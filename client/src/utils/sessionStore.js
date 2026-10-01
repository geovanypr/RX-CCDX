// Almacén centralizado de la sesión.
//
// - "Recuérdame" activado  → localStorage (persiste al cerrar el navegador).
// - "Recuérdame" desactivado → sessionStorage (se borra al cerrar la pestaña).
// La bandera `rxccdx_remember` vive siempre en localStorage para saber
// dónde buscar la sesión al arrancar. Las sesiones antiguas (solo
// localStorage, sin bandera) se tratan como "recordadas" por compatibilidad.

const CLAVES_SESION = ['rxccdx_token', 'rxccdx_role', 'rxccdx_username', 'rxccdx_id'];
const CLAVE_REMEMBER = 'rxccdx_remember';
const CLAVE_SAVED_USERNAME = 'rxccdx_saved_username';

function storeSeguro(tipo) {
  try {
    return tipo === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

export function getRememberChoice() {
  try {
    const v = window.localStorage.getItem(CLAVE_REMEMBER);
    // Sin bandera (sesiones de versiones anteriores o primer uso) → recordar.
    if (v === null) return true;
    return v === '1';
  } catch {
    return true;
  }
}

export function getSavedUsername() {
  try {
    return window.localStorage.getItem(CLAVE_SAVED_USERNAME) || '';
  } catch {
    return '';
  }
}

export function readSession() {
  const local = storeSeguro('local');
  const sesion = storeSeguro('session');
  const leer = (store) => {
    if (!store) return null;
    const token = store.getItem('rxccdx_token');
    const role = store.getItem('rxccdx_role');
    if (!token || !role) return null;
    const username = store.getItem('rxccdx_username');
    const rawId = store.getItem('rxccdx_id');
    const id = rawId && rawId !== 'null' ? Number(rawId) : null;
    return { token, role, username, id: Number.isFinite(id) ? id : null };
  };
  // Prioridad a localStorage (sesión recordada / versiones anteriores).
  return (local && leer(local)) || (sesion && leer(sesion)) || null;
}

export function getSessionToken() {
  return readSession()?.token || null;
}

export function writeSession(data, remember) {
  const destino = storeSeguro(remember ? 'local' : 'session');
  const otro = storeSeguro(remember ? 'session' : 'local');
  // Limpiar el otro almacén para no dejar sesiones duplicadas.
  try {
    if (otro) CLAVES_SESION.forEach((k) => otro.removeItem(k));
    if (destino) {
      destino.setItem('rxccdx_token', data.token);
      destino.setItem('rxccdx_role', data.role);
      destino.setItem('rxccdx_username', data.username);
      if (data.id != null && Number.isFinite(Number(data.id))) {
        destino.setItem('rxccdx_id', String(data.id));
      } else {
        destino.removeItem('rxccdx_id');
      }
    }
    window.localStorage.setItem(CLAVE_REMEMBER, remember ? '1' : '0');
    if (remember && data.username) {
      window.localStorage.setItem(CLAVE_SAVED_USERNAME, data.username);
    } else if (!remember) {
      window.localStorage.removeItem(CLAVE_SAVED_USERNAME);
    }
  } catch {
    // Almacenamiento no disponible: la sesión vivirá solo en memoria.
  }
}

export function clearSession() {
  try {
    const local = storeSeguro('local');
    const sesion = storeSeguro('session');
    if (local) CLAVES_SESION.forEach((k) => local.removeItem(k));
    if (sesion) CLAVES_SESION.forEach((k) => sesion.removeItem(k));
  } catch {
    // Ignorar: ya no hay sesión accesible.
  }
}

export const SESSION_KEYS = CLAVES_SESION;
