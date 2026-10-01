// Rastrea si el Super Administrador entró a una vista operativa (encargada /
// radiólogo) DESDE su portal (/admin). Solo en ese caso las vistas muestran
// el botón "Volver al Portal SuperAdmin".
//
// Se guarda en sessionStorage para que sobreviva a un refrescar, y se exige
// rol SUPER_ADMIN al leerlo, así que nunca aparece para el personal.

const CLAVE = 'rxccdx_admin_origen';

export function marcarOrigenAdmin(destino) {
  try {
    window.sessionStorage.setItem(CLAVE, destino);
  } catch { /* almacenamiento no disponible */ }
}

export function limpiarOrigenAdmin() {
  try {
    window.sessionStorage.removeItem(CLAVE);
  } catch { /* almacenamiento no disponible */ }
}

// destino: 'dashboard' | 'radiologo'
export function vieneDeAdmin(destino, state) {
  if (state?.fromAdmin === true) return true;
  try {
    return window.sessionStorage.getItem(CLAVE) === destino;
  } catch {
    return false;
  }
}
