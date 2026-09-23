// Formateadores compartidos por la interfaz RX CCDX.

const SEXO_LABEL = { M: 'Masculino', F: 'Femenino', O: 'Otro' };

/** Etiqueta legible del sexo registrado (M / F / O). */
export const sexoLabel = (sexo) => SEXO_LABEL[sexo] || 'Sin especificar';

/**
 * Las fechas del backend llegan como "YYYY-MM-DD HH:MM:SS" (hora local del centro).
 * Se normalizan a ISO antes de parsear porque Safari y algunas versiones de Firefox
 * devuelven Invalid Date con el formato original separado por espacio.
 */
export const parseFechaServidor = (valor) => {
  if (!valor) return null;
  const fecha = new Date(String(valor).replace(' ', 'T'));
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

/** Hora corta (hh:mm) a partir de una fecha del servidor. */
export const formatHora = (valor) => {
  const fecha = parseFechaServidor(valor);
  return fecha ? fecha.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' }) : '';
};

/** Fecha y hora legibles a partir de una fecha del servidor. */
export const formatFechaHora = (valor) => {
  const fecha = parseFechaServidor(valor);
  if (!fecha) return '';
  return `${fecha.toLocaleDateString('es-HN')} ${formatHora(valor)}`;
};
