'use strict';
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// En producción (Render) la BD se guarda en el disco persistente montado en
// /var/data para que sobreviva reinicios y redeploys. En desarrollo local se
// guarda junto al código como antes.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'rxccdx.sqlite');
const db = new Database(DB_PATH);

// Performance pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -32000'); // 32MB cache

// ─── Schema ─────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    username         TEXT    NOT NULL UNIQUE,
    password_hash    TEXT    NOT NULL,
    role             TEXT    NOT NULL CHECK(role IN ('SUPER_ADMIN','ENCARGADO','RADIOLOGO')),
    nombre_completo  TEXT,
    pregunta_seguridad TEXT,
    respuesta_seguridad TEXT,
    activo           INTEGER NOT NULL DEFAULT 1,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    last_login       TEXT
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash TEXT    NOT NULL UNIQUE,
    expires_at TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS pacientes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    registro_id     TEXT    NOT NULL UNIQUE,
    nombre          TEXT    NOT NULL,
    fecha_nacimiento TEXT,
    sexo            TEXT    CHECK(sexo IN ('M','F','O')),
    edad            INTEGER,
    telefono        TEXT,
    direccion       TEXT,
    correo          TEXT,
    notas           TEXT,
    fecha_creacion  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS estudios (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id            INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
    fecha_estudio          TEXT    NOT NULL DEFAULT (date('now','localtime')),
    tipo_estudio           TEXT,
    region                 TEXT,
    lateralidad            TEXT,
    medico_remitente       TEXT,
    estado                 TEXT    NOT NULL DEFAULT 'Recibida',
    notas_clinicas         TEXT,
    diagnostico            TEXT,
    fecha_entrega_estimada TEXT,
    ruta_carpeta           TEXT,
    ruta_informe           TEXT,
    urgente                INTEGER NOT NULL DEFAULT 0,
    radiologo_id           INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    nota_revision          TEXT,
    fecha_estado           TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    fecha_creacion         TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS mensajes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    estudio_id      INTEGER NOT NULL REFERENCES estudios(id) ON DELETE CASCADE,
    sender_id       INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    sender_username TEXT    NOT NULL,
    sender_role     TEXT    NOT NULL,
    contenido       TEXT    NOT NULL,
    leido           INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS mensajes_generales (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id       INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    sender_username TEXT    NOT NULL,
    sender_role     TEXT    NOT NULL,
    recipient_role  TEXT    NOT NULL,
    contenido       TEXT,
    archivo_nombre  TEXT,
    archivo_original TEXT,
    archivo_mimetype TEXT,
    archivo_size    INTEGER,
    leido           INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS envios (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    estudio_id          INTEGER NOT NULL REFERENCES estudios(id) ON DELETE CASCADE,
    numero_intento      INTEGER NOT NULL DEFAULT 1,
    tipo                TEXT    NOT NULL,
    estado              TEXT    NOT NULL DEFAULT 'pendiente',
    contenido           TEXT,
    sender_id           INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    sender_username     TEXT,
    sender_role         TEXT,
    fecha_envio         TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    fecha_limite        TEXT,
    comentario_encargado TEXT,
    calificacion        TEXT    NOT NULL DEFAULT 'Sin calificar'
  );

  CREATE TABLE IF NOT EXISTS plantillas (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    label       TEXT    NOT NULL,
    texto       TEXT    NOT NULL,
    categoria   TEXT    NOT NULL DEFAULT 'General',
    creado_por  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS auditoria (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id      INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    usuario_nombre  TEXT,
    rol             TEXT,
    accion          TEXT    NOT NULL,
    detalle         TEXT,
    estudio_id      INTEGER REFERENCES estudios(id) ON DELETE SET NULL,
    ip              TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS config (
    clave  TEXT PRIMARY KEY,
    valor  TEXT NOT NULL DEFAULT ''
  );

`);

// ─── Migraciones de columnas ────────────────────────────────────────────────
// Las bases creadas por versiones anteriores no reciben las columnas nuevas con
// CREATE TABLE IF NOT EXISTS, así que se agregan aquí de forma idempotente.
const COLUMNAS_REQUERIDAS = {
  usuarios: [
    ['nombre_completo', 'TEXT'],
    ['created_at', 'TEXT'],
    ['last_login', 'TEXT'],
    ['pregunta_seguridad', 'TEXT'],
    ['respuesta_seguridad', 'TEXT'],
  ],
  pacientes: [
    ['telefono', 'TEXT'],
    ['direccion', 'TEXT'],
    ['correo', 'TEXT'],
    ['notas', 'TEXT'],
  ],
  estudios: [
    ['region', 'TEXT'],
    ['lateralidad', 'TEXT'],
    ['urgente', 'INTEGER NOT NULL DEFAULT 0'],
    ['nota_revision', 'TEXT'],
    ['radiologo_id', 'INTEGER'],
    ['fecha_entrega_estimada', 'TEXT'],
    ['ruta_informe', 'TEXT'],
    ['ruta_carpeta', 'TEXT'],
    // Nombre estable de la subcarpeta del estudio (E-NNN_TipoEstudio).
    // Se guarda en BD para que los paths no cambien si se renombra el paciente.
    ['estudio_folder_name', 'TEXT'],
  ],
  plantillas: [
    ['categoria', "TEXT NOT NULL DEFAULT 'General'"],
    ['creado_por', 'INTEGER'],
    ['updated_at', 'TEXT'],
  ],
  mensajes: [
    ['editado', 'INTEGER NOT NULL DEFAULT 0'],
    ['editado_at', 'TEXT'],
    ['eliminado_para_todos', 'INTEGER NOT NULL DEFAULT 0'],
    ['eliminado_por', 'TEXT'],
  ],
  mensajes_generales: [
    ['contenido', 'TEXT'],
    ['archivo_nombre', 'TEXT'],
    ['archivo_original', 'TEXT'],
    ['archivo_mimetype', 'TEXT'],
    ['archivo_size', 'INTEGER'],
    ['leido', 'INTEGER NOT NULL DEFAULT 0'],
    ['editado', 'INTEGER NOT NULL DEFAULT 0'],
    ['editado_at', 'TEXT'],
    ['eliminado_para_todos', 'INTEGER NOT NULL DEFAULT 0'],
    ['eliminado_por', 'TEXT'],
  ],
  envios: [
    ['fecha_limite', 'TEXT'],
    ['comentario_encargado', 'TEXT'],
    ['calificacion', "TEXT NOT NULL DEFAULT 'Sin calificar'"],
    ['sender_username', 'TEXT'],
    ['sender_role', 'TEXT'],
  ],
  auditoria: [
    ['rol', 'TEXT'],
    ['ip', 'TEXT'],
    ['estudio_id', 'INTEGER'],
  ],
};

for (const [tabla, columnas] of Object.entries(COLUMNAS_REQUERIDAS)) {
  const existentes = db.prepare(`PRAGMA table_info(${tabla})`).all().map(columna => columna.name);
  if (existentes.length === 0) continue;
  for (const [nombre, definicion] of columnas) {
    if (existentes.includes(nombre)) continue;
    db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${nombre} ${definicion}`);
    console.log(`[DB] Columna agregada: ${tabla}.${nombre}`);
  }
}

db.prepare("UPDATE usuarios SET created_at = datetime('now','localtime') WHERE created_at IS NULL").run();

// ─── Índices de rendimiento (después de las migraciones) ────────────────────
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_estudios_estado       ON estudios(estado);
  CREATE INDEX IF NOT EXISTS idx_estudios_paciente     ON estudios(paciente_id);
  CREATE INDEX IF NOT EXISTS idx_estudios_radiologo    ON estudios(radiologo_id);
  CREATE INDEX IF NOT EXISTS idx_estudios_urgente      ON estudios(urgente);
  CREATE INDEX IF NOT EXISTS idx_estudios_fecha        ON estudios(fecha_estudio);
  CREATE INDEX IF NOT EXISTS idx_mensajes_estudio      ON mensajes(estudio_id);
  CREATE INDEX IF NOT EXISTS idx_mensajes_generales_roles ON mensajes_generales(recipient_role, created_at);
  CREATE INDEX IF NOT EXISTS idx_auditoria_usuario     ON auditoria(usuario_id);
  CREATE INDEX IF NOT EXISTS idx_auditoria_fecha       ON auditoria(created_at);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash   ON refresh_tokens(token_hash);
  CREATE INDEX IF NOT EXISTS idx_pacientes_nombre      ON pacientes(nombre);
  CREATE INDEX IF NOT EXISTS idx_pacientes_registro    ON pacientes(registro_id);
`);

// ─── Seed config defaults ────────────────────────────────────────────────────
const insertConfig = db.prepare(
  `INSERT OR IGNORE INTO config(clave, valor) VALUES (?, ?)`
);
const configDefaults = [
  ['centro_nombre',     'RX CCDX'],
  ['centro_direccion',  ''],
  ['centro_telefono',   ''],
  ['centro_email',      ''],
  ['informe_pie',       ''],
  ['timezone',          'America/Tegucigalpa'],
  // Secuencia atómica para registro_id. El valor es el último número
  // asignado. Se inicializa con el máximo ya existente en la tabla pacientes
  // para que no haya salto al migrar una BD existente.
  ['next_registro_seq', '0'],
];
const seedConfig = db.transaction(() => {
  for (const [k, v] of configDefaults) insertConfig.run(k, v);
});
seedConfig();

// ─── Limpiar pacientes huérfanos (sin estudios) al arrancar ─────────────────
// Puede quedar pacientes sin estudios si el proceso murió a mitad de una
// transacción o si se eliminaron estudios individualmente en versiones anteriores.
{
  const huerfanos = db.prepare(
    'DELETE FROM pacientes WHERE id NOT IN (SELECT DISTINCT paciente_id FROM estudios)'
  ).run();
  if (huerfanos.changes > 0) {
    console.log(`[DB] Pacientes huérfanos eliminados al arrancar: ${huerfanos.changes}`);
  }
}

// ─── Sincronizar secuencia con datos existentes ──────────────────────────────
// Si la BD ya tenía pacientes (migrando desde versión anterior), la secuencia
// debe arrancar desde el número más alto ya usado para evitar colisiones.
{
  const rows = db.prepare("SELECT registro_id FROM pacientes WHERE registro_id GLOB 'RX-[0-9]*'").all();
  const maxExistente = rows.reduce((max, row) => {
    const n = parseInt(row.registro_id.slice(3), 10);
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
  const seqActual = parseInt(db.prepare("SELECT valor FROM config WHERE clave = 'next_registro_seq'").get()?.valor || '0', 10);
  if (maxExistente > seqActual) {
    db.prepare("UPDATE config SET valor = ? WHERE clave = 'next_registro_seq'").run(String(maxExistente));
  }
}

module.exports = db;
