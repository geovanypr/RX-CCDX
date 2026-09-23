'use strict';
const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data', 'pacientes');
fs.mkdirSync(DATA_DIR, { recursive: true });

// ─── Utilidad de normalización ────────────────────────────────────────────────
// Elimina tildes, caracteres no ASCII y colapsa espacios.
// Usada en todos los nombres de carpeta para garantizar paths consistentes.
function safeName(str, maxLen = 50) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // quitar marcas diacríticas (tildes, etc.)
    .replace(/[^a-zA-Z0-9 _-]/g, '')   // solo alfanumérico + espacio/guión/guión bajo
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, maxLen) || 'Paciente';
}

// ─── Carpeta raíz del paciente: "RX-XXXXXX - NombreSaneado" ──────────────────
function getFolderName(registroId, nombre) {
  return `${registroId} - ${safeName(nombre, 50)}`;
}

/**
 * Crea (si no existe) la carpeta raíz del paciente y devuelve la ruta absoluta.
 * Todos los estudios del mismo paciente comparten esta carpeta raíz.
 */
function ensurePatientFolder(registroId, nombre) {
  const folderPath = path.join(DATA_DIR, getFolderName(registroId, nombre));
  fs.mkdirSync(folderPath, { recursive: true });
  return folderPath;
}

// Alias para compatibilidad con código existente
const getPatientFolderPath = ensurePatientFolder;

// ─── Subcarpeta por estudio: "<raíz>/E-<NNN> - TipoEstudio" ──────────────────
/**
 * Genera el nombre canónico de la subcarpeta de un estudio específico.
 * @param {number} estudioNumero  - Número de orden del estudio en el expediente (1-based)
 * @param {string} tipoEstudio    - Tipo de estudio (puede ser vacío)
 */
function getEstudioSubFolderName(estudioNumero, tipoEstudio) {
  const num = String(estudioNumero).padStart(3, '0');
  const tipo = tipoEstudio ? `_${safeName(tipoEstudio, 40)}` : '';
  return `E-${num}${tipo}`;
}

/**
 * Crea (si no existe) la subcarpeta del estudio dentro de la carpeta del paciente
 * y devuelve la ruta absoluta.
 * @param {string} registroId    - e.g. "RX-000001"
 * @param {string} nombre        - Nombre completo del paciente
 * @param {number} estudioNumero - Número de orden del estudio (1-based)
 * @param {string} tipoEstudio   - Tipo de estudio (puede ser vacío)
 * @returns {string}             - Ruta absoluta a la subcarpeta del estudio
 */
function ensureEstudioFolder(registroId, nombre, estudioNumero, tipoEstudio) {
  const patientFolder = ensurePatientFolder(registroId, nombre);
  const subName = getEstudioSubFolderName(estudioNumero, tipoEstudio);
  const subPath = path.join(patientFolder, subName);
  fs.mkdirSync(subPath, { recursive: true });
  return subPath;
}

/**
 * Devuelve la ruta a la subcarpeta de un estudio a partir de su nombre guardado
 * en la BD (estudio_folder_name). Si no existe, la crea.
 * @param {string} registroId         - e.g. "RX-000001"
 * @param {string} nombre             - Nombre completo del paciente
 * @param {string} estudioFolderName  - Nombre de subcarpeta, e.g. "E-001_Torax_PA"
 * @returns {string}                  - Ruta absoluta
 */
function getEstudioFolderPath(registroId, nombre, estudioFolderName) {
  const patientFolder = ensurePatientFolder(registroId, nombre);
  const subPath = path.join(patientFolder, estudioFolderName);
  fs.mkdirSync(subPath, { recursive: true });
  return subPath;
}

// ─── Eliminar carpeta del paciente (cuando se borra el último estudio) ────────
function removePatientFolder(registroId, nombre) {
  const folderPath = path.join(DATA_DIR, getFolderName(registroId, nombre));
  try {
    if (fs.existsSync(folderPath)) fs.rmSync(folderPath, { recursive: true, force: true });
  } catch (e) {
    console.error('[fs_manager] Error al eliminar carpeta del paciente:', e.message);
  }
}

// ─── Exportar carpeta al escritorio ──────────────────────────────────────────
function exportPatientToDesktop(registroId, nombre, desktopPath) {
  const src = path.join(DATA_DIR, getFolderName(registroId, nombre));
  const dest = path.join(desktopPath, getFolderName(registroId, nombre));
  if (!fs.existsSync(src)) throw new Error('La carpeta del paciente no existe en el servidor');
  fs.cpSync(src, dest, { recursive: true, force: true });
  return dest;
}

module.exports = {
  DATA_DIR,
  safeName,
  getFolderName,
  ensurePatientFolder,
  getPatientFolderPath,           // alias para compatibilidad
  getEstudioSubFolderName,
  ensureEstudioFolder,
  getEstudioFolderPath,
  removePatientFolder,
  exportPatientToDesktop,
};
