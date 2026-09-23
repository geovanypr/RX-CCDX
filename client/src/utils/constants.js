/**
 * Constantes compartidas del sistema RX CCDX.
 * Centralizadas aquí para evitar duplicación entre
 * Dashboard, CarpetasVirtuales, StudyDetailModal, etc.
 */

// ── Fases / estados del flujo de un estudio ─────────────────────────────────
export const FASES = [
  'Recibida',
  'Pendiente de enviar al radiólogo',
  'Enviada al radiólogo',
  'Diagnóstico recibido',
  'Devuelta por revisión',
  'Entregado',
  'Listo para imprimir',
];

// ── Metadatos de cada fase (icono, color del dot, clase badge) ───────────────
export const FASE_META = {
  'Recibida':                         { icon: 'inbox',       dot: '#38bdf8', badge: 'badge-blue' },
  'Pendiente de enviar al radiólogo':  { icon: 'clock',       dot: '#f59e0b', badge: 'badge-amber' },
  'Enviada al radiólogo':              { icon: 'send',        dot: '#f97316', badge: 'badge-orange' },
  'Diagnóstico recibido':              { icon: 'checkCircle', dot: '#22c55e', badge: 'badge-green' },
  'Devuelta por revisión':             { icon: 'return',      dot: '#f43f5e', badge: 'badge-red' },
  'Listo para imprimir':               { icon: 'print',       dot: '#14b8a6', badge: 'badge-teal' },
  'Entregado':                         { icon: 'package',     dot: '#94a3b8', badge: 'badge-gray' },
};

// ── Colores semánticos para badges y filas de tabla ─────────────────────────
// bg  → fondo del badge
// text → color del texto
// dot  → color del indicador redondo
export const ESTADO_COLORS = {
  'Recibida':                         { bg: '#f0f9ff', text: '#0369a1', dot: '#38bdf8' },
  'Pendiente de enviar al radiólogo':  { bg: '#fffbeb', text: '#854d0e', dot: '#f59e0b' },
  'Enviada al radiólogo':              { bg: '#fff7ed', text: '#9a3412', dot: '#f97316' },
  'Diagnóstico recibido':              { bg: '#f0fdf4', text: '#166534', dot: '#22c55e' },
  'Devuelta por revisión':             { bg: '#fff1f2', text: '#9f1239', dot: '#f43f5e' },
  'Listo para imprimir':               { bg: '#f0fdfa', text: '#134e4a', dot: '#14b8a6' },
  'Entregado':                         { bg: '#f8fafc', text: '#475569', dot: '#94a3b8' },
};

// Estado fallback cuando el estado no está en el mapa
export const ESTADO_COLOR_DEFAULT = { bg: '#f1f5f9', text: '#64748b', dot: '#94a3b8' };

/** Devuelve los colores del estado, con fallback seguro. */
export function getEstadoColors(estado) {
  return ESTADO_COLORS[estado] ?? ESTADO_COLOR_DEFAULT;
}

// ── Transiciones válidas de la máquina de estados ───────────────────────────
export const TRANSICIONES = {
  'Recibida':                         ['Pendiente de enviar al radiólogo', 'Enviada al radiólogo'],
  'Pendiente de enviar al radiólogo':  ['Enviada al radiólogo'],
  'Enviada al radiólogo':              ['Diagnóstico recibido', 'Devuelta por revisión'],
  'Diagnóstico recibido':              ['Listo para imprimir', 'Devuelta por revisión'],
  'Devuelta por revisión':             ['Diagnóstico recibido', 'Enviada al radiólogo'],
  'Listo para imprimir':               ['Entregado'],
  'Entregado':                         [],
};

// ── Lateralidades válidas ────────────────────────────────────────────────────
export const LATERALIDADES = ['Derecha', 'Izquierda', 'Ambos'];

// ── Roles del sistema ────────────────────────────────────────────────────────
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ENCARGADO:   'ENCARGADO',
  RADIOLOGO:   'RADIOLOGO',
};

export const ROL_LABELS = {
  SUPER_ADMIN: 'Super Administrador',
  ENCARGADO:   'Encargado',
  RADIOLOGO:   'Radiólogo',
};
