const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const os = require('os');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const db = require('./db');
const fsManager = require('./fs_manager');
const wordGen = require('./word_generator');
const archiverModule = require('archiver');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken, requireRole, JWT_SECRET } = require('./middleware/auth');

function createZipArchive() {
  const options = { zlib: { level: 9 } };
  return typeof archiverModule === 'function'
    ? archiverModule('zip', options)
    : new archiverModule.ZipArchive(options);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
});

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',').map(origin => origin.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origen no autorizado por CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '1mb' }));
app.disable('x-powered-by');

// Cabeceras de seguridad básicas (sin dependencias externas)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// Serve patient folders as static files so client can display images
function authenticateDownload(req, res, next) {
  if (!req.headers.authorization && req.query.token) req.headers.authorization = `Bearer ${req.query.token}`;
  authenticateToken(req, res, next);
}
app.use('/pacientes', authenticateDownload, (req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
}, express.static(path.join(__dirname, 'data', 'pacientes')));

// --- Multer: file upload to study subfolder ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const estudio = db.prepare('SELECT e.*, p.nombre, p.registro_id FROM estudios e JOIN pacientes p ON e.paciente_id = p.id WHERE e.id = ?').get(req.params.id);
      if (!estudio) return cb(new Error('Estudio no encontrado'));
      // Si el estudio tiene su subcarpeta guardada en BD, la usa; si no, cae a la carpeta raíz
      let folderPath;
      if (estudio.estudio_folder_name) {
        folderPath = fsManager.getEstudioFolderPath(estudio.registro_id, estudio.nombre, estudio.estudio_folder_name);
      } else {
        folderPath = fsManager.getPatientFolderPath(estudio.registro_id, estudio.nombre);
      }
      cb(null, folderPath);
    } catch (e) {
      cb(e);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, '_');
    cb(null, `${base}_${Date.now()}${ext}`);
  }
});
// Validación MIME real + extensiones permitidas
const EXTENSIONES_PERMITIDAS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.pdf', '.docx', '.doc', '.txt'];
function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeOk = file.mimetype && (
    file.mimetype.startsWith('image/') ||
    file.mimetype.startsWith('text/') ||
    ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'].includes(file.mimetype)
  );
  if (!EXTENSIONES_PERMITIDAS.includes(ext) || !mimeOk) {
    return cb(new Error(`Tipo de archivo no permitido: ${file.originalname}`));
  }
  cb(null, true);
}
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 }, fileFilter }); // 50MB max

const communicationDir = path.join(__dirname, 'data', 'comunicacion');
fs.mkdirSync(communicationDir, { recursive: true });
const communicationStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, communicationDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi, '_').slice(0, 70) || 'archivo';
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});
const communicationUpload = multer({
  storage: communicationStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = file.mimetype?.startsWith('image/') || file.mimetype?.startsWith('text/') || [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip',
      'text/plain',
    ].includes(file.mimetype);
    cb(allowed ? null : new Error('Solo se permiten imágenes, PDF, Word, TXT o ZIP'), allowed);
  },
});

// --- Helpers ---
function emitToRole(role, event, data) {
  io.to(role).emit(event, data);
}

// --- Configuración del centro (parámetros editables por SUPER_ADMIN) ---
function getConfig() {
  const rows = db.prepare('SELECT clave, valor FROM config').all();
  const cfg = {};
  for (const r of rows) cfg[r.clave] = r.valor;
  return cfg;
}

// --- Fecha local (YYYY-MM-DD) ---
// No se usa toISOString() porque convierte a UTC y desfasa el día
// entre las 18:00 y las 23:59 en la zona horaria del centro.
function fechaLocalISO(fecha = new Date()) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

// --- Fecha de entrega estimada: ciclo semanal Miércoles → Martes ---
// Las placas recibidas en la semana se agrupan y se estima entrega el siguiente miércoles.
function calcularFechaEntregaEstimada() {
  const ahora = new Date();
  // 3 = miércoles. Si hoy es miércoles o después, la entrega es el próximo miércoles.
  const diasHastaMiercoles = (3 - ahora.getDay() + 7) % 7;
  const entrega = new Date(ahora);
  entrega.setDate(ahora.getDate() + (diasHastaMiercoles === 0 ? 7 : diasHastaMiercoles));
  return fechaLocalISO(entrega);
}

function calcularEdad(fechaNacimiento) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNacimiento || '')) return null;
  const nacimiento = new Date(`${fechaNacimiento}T00:00:00`);
  const [anio, mes, dia] = fechaNacimiento.split('-').map(Number);
  if (Number.isNaN(nacimiento.getTime()) || nacimiento.getFullYear() !== anio || nacimiento.getMonth() !== mes - 1 || nacimiento.getDate() !== dia || nacimiento > new Date()) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  if (hoy < new Date(hoy.getFullYear(), nacimiento.getMonth(), nacimiento.getDate())) edad -= 1;
  return edad >= 0 && edad <= 120 ? edad : null;
}

function cleanText(value, maxLength = 500) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';
}

function validStudyPayload(body) {
  const tipo_estudio = cleanText(body.tipo_estudio, 120) || null;
  const medico_remitente = cleanText(body.medico_remitente, 120);
  const notas_clinicas = typeof body.notas_clinicas === 'string' ? body.notas_clinicas.trim().slice(0, 4000) : '';
  if (!medico_remitente) throw new Error('El médico remitente es obligatorio');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.fecha_estudio || '')) throw new Error('La fecha de estudio no es válida');
  return { tipo_estudio, medico_remitente, notas_clinicas, fecha_estudio: body.fecha_estudio };
}

// --- Rate limiting (in-memory, sin dependencias) ---
const rateBuckets = new Map();
// Limpieza periódica de buckets expirados (evita crecimiento sin límite)
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (bucket.resetAt < now) rateBuckets.delete(key);
  }
}, 10 * 60 * 1000);
function rateLimit({ windowMs = 15 * 60 * 1000, max = 20, label = 'req', keyFn } = {}) {
  return (req, res, next) => {
    const extra = keyFn ? keyFn(req) : '';
    const key = `${label}:${req.ip}:${extra}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key) || { count: 0, resetAt: now + windowMs };
    if (bucket.resetAt < now) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }
    bucket.count += 1;
    rateBuckets.set(key, bucket);
    if (bucket.count > max) {
      return res.status(429).json({ error: 'Demasiados intentos. Espere unos minutos e intente de nuevo.' });
    }
    next();
  };
}

// --- Auditoría ---
function logAudit(usuario, accion, detalle, estudio_id) {
  try {
    db.prepare(
      'INSERT INTO auditoria (usuario_id, usuario_nombre, rol, accion, detalle, estudio_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(usuario?.id || null, usuario?.username || 'sistema', usuario?.role || 'SISTEMA', accion, detalle || '', estudio_id || null);
  } catch (e) {
    console.error('[Auditoría]', e.message);
  }
}

// --- Máquina de estados: transiciones válidas ---
const ESTADOS_VALIDOS = [
  'Recibida',
  'Pendiente de enviar al radiólogo',
  'Enviada al radiólogo',
  'Diagnóstico recibido',
  'Devuelta por revisión',
  'Entregado',
  'Listo para imprimir',
];

const TRANSICIONES = {
  'Recibida': ['Pendiente de enviar al radiólogo', 'Enviada al radiólogo'],
  'Pendiente de enviar al radiólogo': ['Enviada al radiólogo'],
  'Enviada al radiólogo': ['Diagnóstico recibido', 'Devuelta por revisión'],
  'Diagnóstico recibido': ['Listo para imprimir', 'Devuelta por revisión'],
  'Devuelta por revisión': ['Diagnóstico recibido', 'Enviada al radiólogo'],
  'Listo para imprimir': ['Entregado'],
  'Entregado': [],
};

const AVANCE_AUTOMATICO = {
  'Recibida': 'Pendiente de enviar al radiólogo',
  'Pendiente de enviar al radiólogo': 'Enviada al radiólogo',
  'Enviada al radiólogo': 'Enviada al radiólogo',
  'Diagnóstico recibido': 'Listo para imprimir',
  'Devuelta por revisión': 'Enviada al radiólogo',
  'Listo para imprimir': 'Entregado',
};

function getEstudioInfo(id) {
  return db.prepare(`
    SELECT e.*, p.nombre, p.registro_id, p.edad, p.sexo, p.fecha_nacimiento, p.telefono, p.direccion, p.correo, p.notas as paciente_notas,
           u.nombre_completo as radiologo_nombre, u.username as radiologo_username
    FROM estudios e
    JOIN pacientes p ON e.paciente_id = p.id
    LEFT JOIN usuarios u ON e.radiologo_id = u.id
    WHERE e.id = ?
  `).get(id);
}

// Devuelve la ruta de la carpeta donde están los archivos del estudio.
// Estudios nuevos tienen subcarpeta (estudio_folder_name); los legacy usan la raíz.
function getEstudioFolderPath(estudio) {
  if (estudio.estudio_folder_name) {
    return fsManager.getEstudioFolderPath(estudio.registro_id, estudio.nombre, estudio.estudio_folder_name);
  }
  return fsManager.getPatientFolderPath(estudio.registro_id, estudio.nombre);
}

function ensureStudyAccess(req, estudio) {
  if (!estudio) {
    const error = new Error('Estudio no encontrado');
    error.status = 404;
    throw error;
  }
  if (req.user.role === 'RADIOLOGO' && estudio.radiologo_id && estudio.radiologo_id !== req.user.id) {
    const error = new Error('No tiene acceso a este estudio');
    error.status = 403;
    throw error;
  }
}

function authorizeStudy(req, res, next) {
  try {
    ensureStudyAccess(req, getEstudioInfo(req.params.id));
    next();
  } catch (e) {
    res.status(e.status || 403).json({ error: e.message });
  }
}

// --- Socket Auth + Rooms ---
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Autenticación requerida'));
  try {
    socket.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    next(new Error('Token inválido'));
  }
});

io.on('connection', (socket) => {
  socket.join(socket.user.role);
  socket.join(`user:${socket.user.id}`);
  if (socket.user.role === 'SUPER_ADMIN') {
    socket.join('ENCARGADO');
    socket.join('RADIOLOGO');
  }
  console.log(`[Socket] ${socket.user.username} (${socket.user.role}) conectado`);

  // ── Indicador de escritura (typing) ─────────────────────────────────────
  // El cliente emite 'typing:start' o 'typing:stop' con { estudio_id?, canal }
  // canal: 'estudio' | 'general'
  socket.on('typing:start', ({ estudio_id, canal }) => {
    const targetRole = socket.user.role === 'ENCARGADO' ? 'RADIOLOGO' : 'ENCARGADO';
    const payload = {
      sender_id: socket.user.id,
      sender_username: socket.user.username,
      sender_role: socket.user.role,
      estudio_id: estudio_id || null,
      canal: canal || 'general',
    };
    emitToRole(targetRole, 'typing:start', payload);
  });

  socket.on('typing:stop', ({ estudio_id, canal }) => {
    const targetRole = socket.user.role === 'ENCARGADO' ? 'RADIOLOGO' : 'ENCARGADO';
    const payload = {
      sender_id: socket.user.id,
      sender_username: socket.user.username,
      estudio_id: estudio_id || null,
      canal: canal || 'general',
    };
    emitToRole(targetRole, 'typing:stop', payload);
  });
});

// ============================================================
// CONFIGURACIÓN DEL CENTRO (parámetros del sistema)
// ============================================================

app.get('/api/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', service: 'RX CCDX', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});

app.get('/api/config', authenticateToken, (req, res) => {
  res.json(getConfig());
});

app.put('/api/config', authenticateToken, requireRole('SUPER_ADMIN'), (req, res) => {
  const permitidas = ['centro_nombre', 'centro_direccion', 'centro_telefono', 'centro_email', 'informe_pie'];
  const upsert = db.prepare('INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor');
  try {
    for (const [clave, valor] of Object.entries(req.body || {})) {
      if (permitidas.includes(clave) && typeof valor === 'string') {
        upsert.run(clave, valor.trim());
      }
    }
    logAudit(req.user, 'CONFIG_ACTUALIZADA', 'Parámetros del centro actualizados');
    res.json({ success: true, config: getConfig() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// AUTH ROUTES
// ============================================================

app.post('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, label: 'login', keyFn: (req) => req.body?.username || '' }), (req, res) => {
  const { username, password } = req.body;
  try {
    const user = db.prepare('SELECT * FROM usuarios WHERE username = ?').get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      logAudit(user ? { id: user.id, username: user.username, role: user.role } : null, 'LOGIN_FALLIDO', `Intento de inicio de sesión fallido: ${username || '(sin usuario)'}`);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    if (user.activo === 0) return res.status(403).json({ error: 'Cuenta desactivada. Contacte al administrador.' });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
    logAudit({ id: user.id, username: user.username, role: user.role }, 'LOGIN', 'Inicio de sesión exitoso');
    res.json({ token, role: user.role, username: user.username, id: user.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Registro de cuentas: SOLO el Super Administrador (autenticado) puede crear usuarios
app.post('/api/auth/register', authenticateToken, requireRole('SUPER_ADMIN'), rateLimit({ windowMs: 60 * 60 * 1000, max: 50, label: 'register' }), (req, res) => {
  const { username, password, role, pregunta_seguridad, respuesta_seguridad } = req.body;
  if (role !== 'ENCARGADO' && role !== 'RADIOLOGO') return res.status(400).json({ error: 'Rol no permitido' });
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username || '')) return res.status(400).json({ error: 'El usuario debe tener 3–40 caracteres: letras, números, punto, guion o guion bajo' });
  if (typeof password !== 'string' || password.length < 10) return res.status(400).json({ error: 'La contraseña debe tener al menos 10 caracteres' });
  if (!cleanText(pregunta_seguridad, 180) || !cleanText(respuesta_seguridad, 180)) return res.status(400).json({ error: 'Configure una pregunta y respuesta de seguridad' });
  try {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    const answerHash = bcrypt.hashSync((respuesta_seguridad || '').toLowerCase(), salt);
    db.prepare('INSERT INTO usuarios (username, password_hash, role, pregunta_seguridad, respuesta_seguridad) VALUES (?, ?, ?, ?, ?)').run(username, hash, role, pregunta_seguridad, answerHash);
    logAudit(req.user, 'USUARIO_CREADO', `Usuario creado: ${username} (${role})`);
    res.json({ success: true });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'El usuario ya existe' });
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/recover/:username', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, label: 'recover' }), (req, res) => {
  try {
    const user = db.prepare('SELECT pregunta_seguridad FROM usuarios WHERE username = ?').get(req.params.username);
    if (!user || !user.pregunta_seguridad) return res.status(404).json({ error: 'Usuario no encontrado o sin pregunta configurada' });
    res.json({ pregunta: user.pregunta_seguridad });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/recover', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, label: 'recover2' }), (req, res) => {
  const { username, respuesta_seguridad, new_password } = req.body;
  try {
    const user = db.prepare('SELECT * FROM usuarios WHERE username = ?').get(username);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.activo === 0) return res.status(403).json({ error: 'Cuenta desactivada. Contacte al administrador.' });
    if (typeof new_password !== 'string' || new_password.length < 10) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 10 caracteres' });
    }
    if (typeof respuesta_seguridad !== 'string' || !user.respuesta_seguridad) return res.status(401).json({ error: 'Respuesta incorrecta' });
    if (!bcrypt.compareSync(respuesta_seguridad.trim().toLowerCase(), user.respuesta_seguridad)) return res.status(401).json({ error: 'Respuesta incorrecta' });
    const salt = bcrypt.genSaltSync(10);
    db.prepare('UPDATE usuarios SET password_hash = ? WHERE username = ?').run(bcrypt.hashSync(new_password, salt), username);
    logAudit(null, 'PASSWORD_RESET', `Contraseña restablecida vía pregunta de seguridad: ${username}`);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Cambio de credenciales propias. Exige la contraseña actual y valida el formato
// para que nadie pueda apropiarse de una sesión abierta y cambiar el acceso.
app.put('/api/usuarios/me', authenticateToken, (req, res) => {
  const { new_username, new_password, current_password } = req.body;
  try {
    const nuevoUsuario = typeof new_username === 'string' ? new_username.trim() : '';
    const nuevaClave = typeof new_password === 'string' ? new_password : '';
    if (!nuevoUsuario && !nuevaClave) return res.status(400).json({ error: 'No hay cambios para guardar' });

    const cuenta = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.user.id);
    if (!cuenta) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (typeof current_password !== 'string' || !bcrypt.compareSync(current_password, cuenta.password_hash)) {
      return res.status(401).json({ error: 'La contraseña actual no es correcta' });
    }
    if (nuevoUsuario && !/^[a-zA-Z0-9._-]{3,40}$/.test(nuevoUsuario)) {
      return res.status(400).json({ error: 'El usuario debe tener 3–40 caracteres: letras, números, punto, guion o guion bajo' });
    }
    if (nuevaClave && nuevaClave.length < 10) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 10 caracteres' });
    }
    if (nuevoUsuario && nuevoUsuario !== cuenta.username) {
      const ocupado = db.prepare('SELECT id FROM usuarios WHERE username = ? AND id != ?').get(nuevoUsuario, cuenta.id);
      if (ocupado) return res.status(400).json({ error: 'Ese nombre de usuario ya está en uso' });
      db.prepare('UPDATE usuarios SET username = ? WHERE id = ?').run(nuevoUsuario, cuenta.id);
    }
    if (nuevaClave) {
      db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?')
        .run(bcrypt.hashSync(nuevaClave, bcrypt.genSaltSync(10)), cuenta.id);
    }
    logAudit(req.user, 'CREDENCIALES_CAMBIADAS', 'Cambio de usuario y/o contraseña propio');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// GENERAL COMMUNICATION
// ============================================================

function getCommunicationTarget(role, solicitado) {
  if (role === 'RADIOLOGO') return 'ENCARGADO';
  // El SUPER_ADMIN puede dirigirse a cualquiera de los dos roles.
  if (role === 'SUPER_ADMIN') return solicitado === 'RADIOLOGO' ? 'RADIOLOGO' : 'ENCARGADO';
  return 'RADIOLOGO';
}

app.get('/api/comunicacion/mensajes', authenticateToken, (req, res) => {
  try {
    const userTag = `%,${req.user.id},%`;
    const rows = req.user.role === 'SUPER_ADMIN'
      ? db.prepare(
          `SELECT * FROM mensajes_generales
           WHERE (sender_id = ? OR recipient_role IN ('ENCARGADO', 'RADIOLOGO'))
             AND (eliminado_por IS NULL OR eliminado_por NOT LIKE ?)
           ORDER BY created_at ASC LIMIT 300`
        ).all(req.user.id, userTag)
      : db.prepare(
          `SELECT * FROM mensajes_generales
           WHERE (sender_id = ? OR recipient_role = ?)
             AND (eliminado_por IS NULL OR eliminado_por NOT LIKE ?)
           ORDER BY created_at ASC LIMIT 300`
        ).all(req.user.id, req.user.role, userTag);
    db.prepare(
      `UPDATE mensajes_generales SET leido = 1
       WHERE recipient_role = ? AND sender_id != ? AND leido = 0`
    ).run(req.user.role, req.user.id);
    // Notificar al emisor que sus mensajes fueron leídos
    const otherRole = req.user.role === 'ENCARGADO' ? 'RADIOLOGO' : 'ENCARGADO';
    emitToRole(otherRole, 'comunicacion:leidos', { reader_role: req.user.role });
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/comunicacion/mensajes/:id', authenticateToken, (req, res) => {
  try {
    const msg = db.prepare('SELECT * FROM mensajes_generales WHERE id = ?').get(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Mensaje no encontrado' });
    if (msg.sender_id !== req.user.id) return res.status(403).json({ error: 'Solo el emisor puede editar el mensaje' });
    if (msg.eliminado_para_todos) return res.status(400).json({ error: 'No se puede editar un mensaje eliminado' });

    const nuevoContenido = typeof req.body?.contenido === 'string' ? req.body.contenido.trim().slice(0, 4000) : '';
    if (!nuevoContenido) return res.status(400).json({ error: 'El mensaje no puede estar vacío' });

    db.prepare(
      `UPDATE mensajes_generales SET contenido = ?, editado = 1, editado_at = datetime('now','localtime') WHERE id = ?`
    ).run(nuevoContenido, msg.id);

    const updated = db.prepare('SELECT * FROM mensajes_generales WHERE id = ?').get(msg.id);
    emitToRole('ENCARGADO', 'comunicacion:editado', updated);
    emitToRole('RADIOLOGO', 'comunicacion:editado', updated);
    res.json({ success: true, mensaje: updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/comunicacion/mensajes/:id', authenticateToken, (req, res) => {
  try {
    const msg = db.prepare('SELECT * FROM mensajes_generales WHERE id = ?').get(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Mensaje no encontrado' });
    const modo = req.query.modo === 'todos' ? 'todos' : 'mi';

    if (modo === 'todos') {
      if (msg.sender_id !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Solo el emisor o administrador puede eliminar para todos' });
      }
      db.prepare(
        `UPDATE mensajes_generales
         SET contenido = '🚫 Este mensaje fue eliminado',
             archivo_nombre = NULL, archivo_original = NULL, archivo_mimetype = NULL, archivo_size = NULL,
             eliminado_para_todos = 1
         WHERE id = ?`
      ).run(msg.id);
      const updated = db.prepare('SELECT * FROM mensajes_generales WHERE id = ?').get(msg.id);
      emitToRole('ENCARGADO', 'comunicacion:eliminado', { id: msg.id, modo: 'todos', mensaje: updated });
      emitToRole('RADIOLOGO', 'comunicacion:eliminado', { id: msg.id, modo: 'todos', mensaje: updated });
      return res.json({ success: true, modo: 'todos', mensaje: updated });
    } else {
      let current = msg.eliminado_por || '';
      const userTag = `,${req.user.id},`;
      if (!current.includes(userTag)) {
        current = current ? `${current}${req.user.id},` : `,${req.user.id},`;
        db.prepare('UPDATE mensajes_generales SET eliminado_por = ? WHERE id = ?').run(current, msg.id);
      }
      return res.json({ success: true, modo: 'mi', id: msg.id });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/comunicacion/mensajes', authenticateToken, (req, res) => {
  const contenido = typeof req.body?.contenido === 'string' ? req.body.contenido.trim().slice(0, 4000) : '';
  if (!contenido) return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
  try {
    const result = db.prepare(
      `INSERT INTO mensajes_generales
       (sender_id, sender_username, sender_role, recipient_role, contenido)
       VALUES (?, ?, ?, ?, ?)`
    ).run(req.user.id, req.user.username, req.user.role, getCommunicationTarget(req.user.role, req.body?.recipient_role), contenido);
    const message = db.prepare('SELECT * FROM mensajes_generales WHERE id = ?').get(result.lastInsertRowid);
    emitToRole(message.recipient_role, 'comunicacion:nuevo', message);
    res.status(201).json(message);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/comunicacion/archivos', authenticateToken, (req, res) => {
  communicationUpload.single('archivo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message || 'Error al procesar el archivo' });
    }
    if (!req.file) return res.status(400).json({ success: false, error: 'No se recibió ningún archivo' });
    try {
      const result = db.prepare(
        `INSERT INTO mensajes_generales
         (sender_id, sender_username, sender_role, recipient_role, contenido,
          archivo_nombre, archivo_original, archivo_mimetype, archivo_size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        req.user.id, req.user.username, req.user.role, getCommunicationTarget(req.user.role, req.body?.recipient_role),
        req.body?.contenido?.trim() || '', req.file.filename, req.file.originalname,
        req.file.mimetype, req.file.size,
      );
      const message = db.prepare('SELECT * FROM mensajes_generales WHERE id = ?').get(result.lastInsertRowid);
      emitToRole(message.recipient_role, 'comunicacion:nuevo', message);
      res.status(201).json(message);
    } catch (e) {
      fs.rmSync(req.file.path, { force: true });
      res.status(500).json({ success: false, error: e.message });
    }
  });
});

app.get('/api/comunicacion/archivos/:filename', authenticateToken, (req, res) => {
  const filename = path.basename(req.params.filename);
  const file = db.prepare(
    `SELECT id FROM mensajes_generales
     WHERE archivo_nombre = ? AND (sender_id = ? OR recipient_role = ?)`
  ).get(filename, req.user.id, req.user.role);
  if (!file) return res.status(404).json({ error: 'Archivo no encontrado' });
  const fullPath = path.join(communicationDir, filename);
  if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Archivo no encontrado' });
  res.setHeader('Cache-Control', 'private, no-store');
  res.sendFile(fullPath);
});

// ============================================================
// PATIENT ROUTES
// ============================================================

app.put('/api/pacientes/:id', authenticateToken, requireRole('ENCARGADO', 'SUPER_ADMIN'), (req, res) => {
  try {
    const patient = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });
    const nombre = cleanText(req.body?.nombre, 160) || patient.nombre;
    const fields = ['fecha_nacimiento', 'sexo', 'edad', 'telefono', 'direccion', 'correo', 'notas'];
    const values = fields.map(field => req.body?.[field] ?? patient[field]);
    const oldFolder = fsManager.getPatientFolderPath(patient.registro_id, patient.nombre);
    const newFolder = path.join(fsManager.DATA_DIR, fsManager.getFolderName(patient.registro_id, nombre));
    if (oldFolder !== newFolder && fs.existsSync(oldFolder) && !fs.existsSync(newFolder)) fs.renameSync(oldFolder, newFolder);
    db.prepare(
      `UPDATE pacientes SET nombre = ?, fecha_nacimiento = ?, sexo = ?, edad = ?, telefono = ?, direccion = ?, correo = ?, notas = ? WHERE id = ?`
    ).run(nombre, ...values, patient.id);
    db.prepare('UPDATE estudios SET ruta_carpeta = ? WHERE paciente_id = ?').run(newFolder, patient.id);
    res.json(db.prepare('SELECT * FROM pacientes WHERE id = ?').get(patient.id));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/pacientes/:id', authenticateToken, requireRole('ENCARGADO', 'SUPER_ADMIN'), (req, res) => {
  try {
    const patient = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });
    const studies = db.prepare('SELECT id, ruta_carpeta FROM estudios WHERE paciente_id = ?').all(patient.id);
    const remove = db.transaction(() => {
      for (const study of studies) {
        db.prepare('DELETE FROM mensajes WHERE estudio_id = ?').run(study.id);
        db.prepare('DELETE FROM envios WHERE estudio_id = ?').run(study.id);
        db.prepare('DELETE FROM estudios WHERE id = ?').run(study.id);
        if (study.ruta_carpeta) fs.rmSync(study.ruta_carpeta, { recursive: true, force: true });
      }
      db.prepare('DELETE FROM pacientes WHERE id = ?').run(patient.id);
    });
    remove();
    // Eliminar carpeta física del paciente
    try { fsManager.removePatientFolder(patient.registro_id, patient.nombre); } catch { /* ya no existe */ }
    logAudit(req.user, 'PACIENTE_ELIMINADO', `${patient.registro_id}: ${patient.nombre} (${studies.length} estudio(s) eliminado(s))`);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/pacientes/bulk-delete', authenticateToken, requireRole('ENCARGADO', 'SUPER_ADMIN'), (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Lista de IDs no válida' });
    }
    let deletedCount = 0;
    const removeAll = db.transaction(() => {
      for (const id of ids) {
        const patient = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(id);
        if (!patient) continue;
        const studies = db.prepare('SELECT id, ruta_carpeta FROM estudios WHERE paciente_id = ?').all(patient.id);
        for (const study of studies) {
          db.prepare('DELETE FROM mensajes WHERE estudio_id = ?').run(study.id);
          db.prepare('DELETE FROM envios WHERE estudio_id = ?').run(study.id);
          db.prepare('DELETE FROM estudios WHERE id = ?').run(study.id);
          if (study.ruta_carpeta) {
            try { fs.rmSync(study.ruta_carpeta, { recursive: true, force: true }); } catch {}
          }
        }
        db.prepare('DELETE FROM pacientes WHERE id = ?').run(patient.id);
        try { fsManager.removePatientFolder(patient.registro_id, patient.nombre); } catch {}
        logAudit(req.user, 'PACIENTE_ELIMINADO', `${patient.registro_id}: ${patient.nombre} (eliminación masiva)`);
        deletedCount++;
      }
    });
    removeAll();
    res.json({ success: true, count: deletedCount });
  } catch (e) { res.status(400).json({ error: e.message || 'Error al eliminar pacientes' }); }
});

app.get('/api/pacientes', authenticateToken, (req, res) => {
  res.json(db.prepare('SELECT * FROM pacientes ORDER BY fecha_creacion DESC').all());
});

// Buscar un paciente específico por su número de registro (usado en el formulario de registro)
app.get('/api/pacientes/por-registro/:registroId', authenticateToken, (req, res) => {
  try {
    const registroId = (req.params.registroId || '').trim().toUpperCase();
    if (!registroId) return res.json({ found: false, paciente: null });
    const patient = db.prepare('SELECT * FROM pacientes WHERE registro_id = ?').get(registroId);
    if (!patient) return res.json({ found: false, paciente: null });
    res.json({ found: true, paciente: patient });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Historial de auditoría de un paciente ────────────────────────────────────
// Devuelve todas las entradas de auditoría que mencionan el registro_id del
// paciente en el campo detalle, o cuyo estudio_id pertenece al paciente.
// Soporta paginación: ?page=1&limit=20
app.get('/api/pacientes/:id/historial', authenticateToken, requireRole('ENCARGADO', 'SUPER_ADMIN'), (req, res) => {
  try {
    const patient = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(5, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const rid = patient.registro_id;

    // Contar total para la paginación
    const total = db.prepare(`
      SELECT COUNT(*) AS c FROM auditoria
      WHERE detalle LIKE ?
         OR estudio_id IN (SELECT id FROM estudios WHERE paciente_id = ?)
    `).get(`%${rid}%`, patient.id).c;

    const rows = db.prepare(`
      SELECT * FROM auditoria
      WHERE detalle LIKE ?
         OR estudio_id IN (SELECT id FROM estudios WHERE paciente_id = ?)
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(`%${rid}%`, patient.id, limit, offset);

    res.json({ total, page, pages: Math.ceil(total / limit), limit, historial: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Borrar historial de auditoría de un paciente ─────────────────────────────
app.delete('/api/pacientes/:id/historial', authenticateToken, requireRole('ENCARGADO', 'SUPER_ADMIN'), (req, res) => {
  try {
    const patient = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

    const result = db.prepare(`
      DELETE FROM auditoria
      WHERE detalle LIKE ?
         OR estudio_id IN (SELECT id FROM estudios WHERE paciente_id = ?)
    `).run(`%${patient.registro_id}%`, patient.id);

    logAudit(req.user, 'HISTORIAL_BORRADO', `${patient.registro_id}: ${result.changes} entrada(s) eliminada(s) del historial`);
    res.json({ success: true, deleted: result.changes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Borrar una entrada individual del historial de un paciente ───────────────
app.delete('/api/pacientes/:id/historial/:historiaId', authenticateToken, requireRole('ENCARGADO', 'SUPER_ADMIN'), (req, res) => {
  try {
    const patient = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });

    const result = db.prepare(`
      DELETE FROM auditoria
      WHERE id = ? AND (detalle LIKE ? OR estudio_id IN (SELECT id FROM estudios WHERE paciente_id = ?))
    `).run(req.params.historiaId, `%${patient.registro_id}%`, patient.id);

    if (result.changes === 0) return res.status(404).json({ error: 'Entrada de historial no encontrada' });

    logAudit(req.user, 'HISTORIAL_ITEM_ELIMINADO', `${patient.registro_id}: Entrada #${req.params.historiaId} eliminada del historial`);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/pacientes', authenticateToken, requireRole('ENCARGADO'), (req, res) => {
  const { registro_id, nombre, fecha_nacimiento, sexo, edad } = req.body;
  try {
    const registro = cleanText(registro_id, 30).toUpperCase();
    const patientName = cleanText(nombre, 160);
    const calculatedAge = calcularEdad(fecha_nacimiento);
    if (!/^RX-\d{6,}$/.test(registro) || !patientName || !['M', 'F', 'O'].includes(sexo) || calculatedAge === null) {
      return res.status(400).json({ error: 'Datos del paciente incompletos o inválidos' });
    }
    const info = db.prepare('INSERT INTO pacientes (registro_id, nombre, fecha_nacimiento, sexo, edad) VALUES (?, ?, ?, ?, ?)').run(registro, patientName, fecha_nacimiento, sexo, calculatedAge);
    fsManager.getPatientFolderPath(registro, patientName);
    logAudit(req.user, 'PACIENTE_CREADO', `${registro}: ${patientName}`);
    res.json({ id: info.lastInsertRowid, registro_id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Registro operativo: crea el paciente (si no existe) y su estudio en una sola
// transacción. Evita expedientes incompletos y carreras al generar registros.
app.post('/api/registrar', authenticateToken, (req, res) => {
  try {
    if (!['ENCARGADO', 'RADIOLOGO', 'SUPER_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'No tiene permiso para registrar estudios' });
    }
    const registro = cleanText(req.body.registro_id, 30).toUpperCase();
    const patientName = cleanText(req.body.nombre, 160);
    // Acepta edad calculada desde fecha_nacimiento o directamente como número
    const edadCalculada = calcularEdad(req.body.fecha_nacimiento);
    const edadDirecta = req.body.edad !== undefined && req.body.edad !== '' ? parseInt(req.body.edad, 10) : null;
    const edad = edadCalculada !== null ? edadCalculada : (Number.isFinite(edadDirecta) && edadDirecta >= 0 ? edadDirecta : null);
    const study = validStudyPayload(req.body);
    const region = cleanText(req.body.region, 60);
    const LATERALIDADES_VALIDAS = ['Derecha', 'Izquierda', 'Ambos'];
    const lateralidad = LATERALIDADES_VALIDAS.includes(req.body.lateralidad) ? req.body.lateralidad : null;
    if (!/^RX-\d{6,}$/.test(registro)) throw new Error('Número de registro inválido');

    const registrar = db.transaction(() => {
      let patient = null;
      if (req.body.paciente_id) {
        patient = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(req.body.paciente_id);
      }
      if (!patient && registro) {
        patient = db.prepare('SELECT * FROM pacientes WHERE registro_id = ?').get(registro);
      }
      if (!patient && patientName) {
        const normNew = patientName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
        const candidates = db.prepare('SELECT * FROM pacientes').all();
        patient = candidates.find(p => {
          const norm = (p.nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
          return norm === normNew;
        });
      }
      if (!patient) {
        // Validar cada campo con mensaje específico
        if (!patientName) throw new Error('El nombre del paciente es obligatorio');
        if (!['M', 'F', 'O'].includes(req.body.sexo)) throw new Error('El sexo del paciente es obligatorio (M, F u O)');
        if (edad === null) throw new Error('La edad del paciente es obligatoria y debe ser un número entre 0 y 120');
        const fnac = req.body.fecha_nacimiento && /^\d{4}-\d{2}-\d{2}$/.test(req.body.fecha_nacimiento)
          ? req.body.fecha_nacimiento : null;
        const result = db.prepare('INSERT INTO pacientes (registro_id, nombre, fecha_nacimiento, sexo, edad) VALUES (?, ?, ?, ?, ?)')
          .run(registro, patientName, fnac, req.body.sexo, edad);
        patient = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(result.lastInsertRowid);
      }
      const creadoPorRadiologo = req.user.role === 'RADIOLOGO';
      const urgente = req.body.urgente ? 1 : 0;
      // Calcular el número de orden de este estudio para el paciente (1-based)
      const estudioNum = db.prepare('SELECT COUNT(*) AS c FROM estudios WHERE paciente_id = ?').get(patient.id).c + 1;
      const estudioFolderName = fsManager.getEstudioSubFolderName(estudioNum, study.tipo_estudio);
      const result = db.prepare(`INSERT INTO estudios
        (paciente_id, fecha_estudio, tipo_estudio, region, lateralidad, medico_remitente, notas_clinicas, estado, urgente, radiologo_id, fecha_entrega_estimada, fecha_estado, estudio_folder_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`)
        .run(patient.id, study.fecha_estudio, study.tipo_estudio, region, lateralidad, study.medico_remitente, study.notas_clinicas,
          creadoPorRadiologo ? 'Enviada al radiólogo' : 'Recibida', urgente, creadoPorRadiologo ? req.user.id : null,
          calcularFechaEntregaEstimada(), estudioFolderName);
      return { patient, estudioId: Number(result.lastInsertRowid), urgente, estudioFolderName };
    });
    const result = registrar();
    // Crear la subcarpeta del estudio en disco inmediatamente
    fsManager.getEstudioFolderPath(result.patient.registro_id, result.patient.nombre, result.estudioFolderName);
    logAudit(req.user, 'ESTUDIO_REGISTRADO', `${registro}: ${study.tipo_estudio}${result.urgente ? ' (urgente)' : ''}`, result.estudioId);
    emitToRole('ENCARGADO', 'estudio:nuevo', { id: result.estudioId, registro_id: registro, nombre: result.patient.nombre, tipo_estudio: study.tipo_estudio, urgente: result.urgente });
    if (req.user.role === 'RADIOLOGO') {
      emitToRole('RADIOLOGO', 'estudio:enviado', { id: result.estudioId, registro_id: registro, nombre: result.patient.nombre, tipo_estudio: study.tipo_estudio, urgente: result.urgente });
    }
    res.status(201).json({ success: true, paciente_id: result.patient.id, estudio_id: result.estudioId });
  } catch (e) {
    res.status(400).json({ error: e.message || 'No fue posible registrar el estudio' });
  }
});

// ============================================================
// STUDY ROUTES
// ============================================================

app.get('/api/estudios', authenticateToken, (req, res) => {
  const { estado } = req.query;
  // Tope de seguridad: evita payloads gigantes cuando el centro acumula años de estudios.
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 300, 1), 1000);
  let query = 'SELECT e.*, p.nombre, p.registro_id, p.edad, p.sexo FROM estudios e JOIN pacientes p ON e.paciente_id = p.id';
  const params = [];
  const conds = [];

  // Radiólogos only see studies assigned to them or sent to all radiologists
  if (req.user.role === 'RADIOLOGO') {
    conds.push('(e.radiologo_id = ? OR e.radiologo_id IS NULL)');
    params.push(req.user.id);
  }
  if (estado) {
    conds.push('e.estado = ?');
    params.push(estado);
  }
  if (conds.length) query += ' WHERE ' + conds.join(' AND ');
  // Los estudios urgentes siempre encabezan cada bandeja.
  query += ' ORDER BY e.urgente DESC, e.fecha_creacion DESC LIMIT ?';
  params.push(limit);

  res.json(db.prepare(query).all(...params));
});

app.get('/api/estudios/:id', authenticateToken, (req, res) => {
  const est = getEstudioInfo(req.params.id);
  if (!est) return res.status(404).json({ error: 'Estudio no encontrado' });
  try { ensureStudyAccess(req, est); } catch (e) { return res.status(e.status || 403).json({ error: e.message }); }
  res.json(est);
});

app.post('/api/estudios', authenticateToken, requireRole('ENCARGADO'), (req, res) => {
  const { paciente_id, fecha_estudio, tipo_estudio, medico_remitente, notas_clinicas } = req.body;
  try {
    const study = validStudyPayload({ fecha_estudio, tipo_estudio, medico_remitente, notas_clinicas });
    const urgente = req.body.urgente ? 1 : 0;
    const region = cleanText(req.body.region, 60);
    const patient = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(paciente_id);
    if (!patient) return res.status(404).json({ error: 'Paciente no encontrado' });
    const info = db.prepare(`INSERT INTO estudios (paciente_id, fecha_estudio, tipo_estudio, region, medico_remitente, notas_clinicas, estado, urgente, fecha_entrega_estimada, fecha_estado)
      VALUES (?, ?, ?, ?, ?, ?, 'Recibida', ?, ?, datetime('now'))`).run(patient.id, study.fecha_estudio, study.tipo_estudio, region, study.medico_remitente, study.notas_clinicas, urgente, calcularFechaEntregaEstimada());
    logAudit(req.user, 'ESTUDIO_REGISTRADO', `${patient.registro_id}: ${study.tipo_estudio}${urgente ? ' (urgente)' : ''}`, info.lastInsertRowid);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Marcar / desmarcar un estudio como urgente (prioridad en la lista de trabajo)
app.put('/api/estudios/:id/urgente', authenticateToken, requireRole('ENCARGADO', 'RADIOLOGO'), (req, res) => {
  try {
    const estudio = getEstudioInfo(req.params.id);
    ensureStudyAccess(req, estudio);
    const urgente = req.body?.urgente ? 1 : 0;
    db.prepare('UPDATE estudios SET urgente = ? WHERE id = ?').run(urgente, estudio.id);
    logAudit(req.user, urgente ? 'ESTUDIO_URGENTE' : 'ESTUDIO_NORMALIZADO', `${estudio.registro_id}: prioridad ${urgente ? 'urgente' : 'normal'}`, estudio.id);
    emitToRole('RADIOLOGO', 'estudio:actualizado', { id: estudio.id, registro_id: estudio.registro_id, urgente });
    emitToRole('ENCARGADO', 'estudio:actualizado', { id: estudio.id, registro_id: estudio.registro_id, urgente });
    res.json({ success: true, urgente });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// El borrado de un estudio es una operación administrativa irreversible.
app.delete('/api/estudios/:id', authenticateToken, requireRole('ENCARGADO'), (req, res) => {
  try {
    const estudio = getEstudioInfo(req.params.id);
    if (!estudio) return res.status(404).json({ error: 'Estudio no encontrado' });

    const removeStudy = db.transaction(() => {
      db.prepare('DELETE FROM mensajes WHERE estudio_id = ?').run(estudio.id);
      db.prepare('DELETE FROM envios WHERE estudio_id = ?').run(estudio.id);
      db.prepare('DELETE FROM estudios WHERE id = ?').run(estudio.id);
      const remaining = db.prepare('SELECT COUNT(*) AS total FROM estudios WHERE paciente_id = ?').get(estudio.paciente_id);
      const esUltimo = remaining.total === 0;
      // Si era el último estudio del paciente, eliminar también el paciente de la BD
      // para que no aparezca como "duplicado" en futuros registros
      if (esUltimo) {
        db.prepare('DELETE FROM pacientes WHERE id = ?').run(estudio.paciente_id);
      }
      return esUltimo;
    });

    const removePatientFolder = removeStudy();
    if (removePatientFolder) fsManager.removePatientFolder(estudio.registro_id, estudio.nombre);
    logAudit(req.user, 'ESTUDIO_ELIMINADO', `${estudio.registro_id}: ${estudio.tipo_estudio}${removePatientFolder ? ' (paciente eliminado)' : ''}`, null);
    emitToRole('RADIOLOGO', 'estudio:eliminado', { id: estudio.id, registro_id: estudio.registro_id });
    res.json({ success: true });
  } catch (e) {
    console.error('[Eliminar estudio]', e);
    res.status(500).json({ error: 'No se pudo eliminar el estudio' });
  }
});

// Update study state (encargado manual transitions) — con máquina de estados estricta
app.put('/api/estudios/:id/estado', authenticateToken, requireRole('ENCARGADO'), (req, res) => {
  const { estado } = req.body;
  try {
    if (!ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ error: `Estado no válido: ${estado}` });
    }
    const estudioInfo = getEstudioInfo(req.params.id);
    if (!estudioInfo) return res.status(404).json({ error: 'Estudio no encontrado' });

    // Si el estado no cambia, permitir (idempotente)
    if (estudioInfo.estado !== estado) {
      const allowed = TRANSICIONES[estudioInfo.estado] || [];
      const viaAvance = AVANCE_AUTOMATICO[estudioInfo.estado];
      if (!allowed.includes(estado) && viaAvance !== estado) {
        return res.status(400).json({ error: `Transición no permitida: ${estudioInfo.estado} → ${estado}` });
      }
    }

    db.prepare("UPDATE estudios SET estado = ?, fecha_estado = datetime('now') WHERE id = ?").run(estado, req.params.id);
    const estudioActualizado = getEstudioInfo(req.params.id);
    logAudit(req.user, 'ESTADO_CAMBIADO', `${estudioInfo.registro_id}: ${estudioInfo.estado} → ${estado}`, estudioInfo.id);

    if (estudioInfo && estudioInfo.estado !== estado && estado === 'Enviada al radiólogo') {
      const envioCount = db.prepare("SELECT COUNT(*) as c FROM envios WHERE estudio_id = ? AND tipo = 'envio_radiologo'").get(estudioInfo.id).c;
      const folderPath = getEstudioFolderPath(estudioInfo);
      const archivos = fs.readdirSync(folderPath).filter(name => !name.startsWith('.'));
      const radiografias = archivos.filter(name => /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(name));
      db.prepare(
        `INSERT INTO envios (estudio_id, numero_intento, tipo, estado, contenido, sender_id, sender_username, sender_role, fecha_limite)
         VALUES (?, ?, 'envio_radiologo', 'enviado', ?, ?, ?, ?, ?)`
      ).run(estudioInfo.id, envioCount + 1, 'Radiografías adjuntas: ' + radiografias.length + '. ' + (estudioInfo.notas_clinicas || 'Estudio enviado para lectura radiológica'), req.user.id, req.user.username, req.user.role, estudioInfo.fecha_entrega_estimada);
      emitToRole('RADIOLOGO', 'estudio:enviado', {
        id: estudioInfo.id,
        registro_id: estudioInfo.registro_id,
        nombre: estudioInfo.nombre,
        tipo_estudio: estudioInfo.tipo_estudio,
        notas_clinicas: estudioInfo.notas_clinicas,
        edad: estudioInfo.edad,
        fecha_estudio: estudioInfo.fecha_estudio,
        archivos,
        radiografias,
        radiografias_count: radiografias.length,
      });
    }

    if (estudioInfo && estado === 'Devuelta por revisión') {
      emitToRole('RADIOLOGO', 'estudio:devuelto', {
        id: estudioInfo.id,
        registro_id: estudioInfo.registro_id,
        nombre: estudioInfo.nombre,
        tipo_estudio: estudioInfo.tipo_estudio,
        nota_revision: estudioInfo.nota_revision,
      });
    }

    res.json({ success: true, estudio: estudioActualizado });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// El radiólogo puede iniciar directamente un estudio que aún no fue tomado.
app.post('/api/estudios/:id/tomar', authenticateToken, requireRole('RADIOLOGO'), (req, res) => {
  try {
    const estudio = getEstudioInfo(req.params.id);
    if (!estudio) return res.status(404).json({ error: 'Estudio no encontrado' });
    if (estudio.radiologo_id && estudio.radiologo_id !== req.user.id) {
      return res.status(409).json({ error: 'Este estudio ya fue tomado por otro radiólogo.' });
    }
    if (!['Recibida', 'Pendiente de enviar al radiólogo', 'Enviada al radiólogo'].includes(estudio.estado)) {
      return res.status(400).json({ error: `El estudio está en estado "${estudio.estado}" y no puede iniciarse.` });
    }
    db.prepare(`UPDATE estudios SET estado = 'Enviada al radiólogo', radiologo_id = ?, fecha_estado = datetime('now')
      WHERE id = ? AND (radiologo_id IS NULL OR radiologo_id = ?)`).run(req.user.id, estudio.id, req.user.id);
    const actualizado = getEstudioInfo(estudio.id);
    logAudit(req.user, 'ESTUDIO_INICIADO', `${estudio.registro_id}: lectura iniciada por el radiólogo`, estudio.id);
    emitToRole('ENCARGADO', 'estudio:tomado', { id: estudio.id, registro_id: estudio.registro_id, radiologo: req.user.username });
    res.json({ success: true, estudio: actualizado });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// Update diagnosis by ENCARGADO (for corrections on finalized ones)
app.put('/api/estudios/:id/diagnostico', authenticateToken, requireRole('ENCARGADO'), async (req, res) => {
  const { diagnostico } = req.body;
  try {
    if (!diagnostico?.trim()) return res.status(400).json({ error: 'El diagnóstico no puede estar vacío' });
    const estudioInfo = getEstudioInfo(req.params.id);
    if (!estudioInfo) return res.status(404).json({ error: 'Estudio no encontrado' });

    const folderPath = getEstudioFolderPath(estudioInfo);
    const docPath = await wordGen.generateWordReport(folderPath, {
      estudioId: req.params.id,
      fecha: new Date().toLocaleDateString('es-HN'),
      pacienteNombre: estudioInfo.nombre,
      pacienteEdad: estudioInfo.edad,
      tipoEstudio: estudioInfo.tipo_estudio,
      region: estudioInfo.region || '',
      lateralidad: estudioInfo.lateralidad || '',
      medicoRemitente: estudioInfo.medico_remitente,
      diagnostico: diagnostico.trim(),
      radiologo: estudioInfo.radiologo_id ? (db.prepare('SELECT username FROM usuarios WHERE id = ?').get(estudioInfo.radiologo_id)?.username || 'Radiólogo') : 'Radiólogo',
      config: getConfig(),
    });
    db.prepare('UPDATE estudios SET diagnostico = ?, ruta_informe = ? WHERE id = ?').run(diagnostico.trim(), docPath, req.params.id);
    const intento = db.prepare("SELECT COUNT(*) AS c FROM envios WHERE estudio_id = ? AND tipo IN ('diagnostico', 'correccion_encargado')").get(req.params.id).c + 1;
    db.prepare(
      `INSERT INTO envios (estudio_id, numero_intento, tipo, estado, contenido, sender_id, sender_username, sender_role, calificacion)
       VALUES (?, ?, 'correccion_encargado', 'aceptado', ?, ?, ?, ?, 'Sin calificar')`
    ).run(req.params.id, intento, diagnostico.trim(), req.user.id, req.user.username, req.user.role);
    logAudit(req.user, 'DIAGNOSTICO_EDITADO', `${estudioInfo.registro_id}: corrección del encargado`, req.params.id);
    emitToRole('RADIOLOGO', 'diagnostico:corregido', { id: estudioInfo.id, registro_id: estudioInfo.registro_id });
    res.json({ success: true, docPath });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Devolver estudio para revisión (Encargado o Radiólogo)
app.put('/api/estudios/:id/devolver', authenticateToken, requireRole('ENCARGADO', 'RADIOLOGO'), (req, res) => {
  const { nota_revision } = req.body;
  try {
    const estudioInfo = getEstudioInfo(req.params.id);
    if (!estudioInfo) return res.status(404).json({ error: 'Estudio no encontrado' });
    if (['Devuelta por revisión', 'Entregado'].includes(estudioInfo.estado)) {
      return res.status(400).json({ error: `No se puede devolver un estudio en estado "${estudioInfo.estado}"` });
    }
    db.prepare("UPDATE estudios SET estado = ?, nota_revision = ?, fecha_estado = datetime('now') WHERE id = ?").run('Devuelta por revisión', nota_revision || '', req.params.id);
    logAudit(req.user, 'ESTUDIO_DEVUELTO', `${estudioInfo.registro_id}: devuelto para revisión por ${req.user.role}`, estudioInfo.id);
    const payload = {
      id: estudioInfo.id,
      registro_id: estudioInfo.registro_id,
      nombre: estudioInfo.nombre,
      tipo_estudio: estudioInfo.tipo_estudio,
      nota_revision: nota_revision || '',
      devuelto_por: req.user.username,
      devuelto_por_rol: req.user.role,
    };
    emitToRole('RADIOLOGO', 'estudio:devuelto', payload);
    emitToRole('ENCARGADO', 'estudio:devuelto', payload);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Encargado sends a message to the radiologist on a specific study
app.post('/api/estudios/:id/mensaje', authenticateToken, (req, res) => {
  const { contenido } = req.body;
  if (!contenido?.trim()) return res.status(400).json({ error: 'Mensaje vacío' });
  try {
    const estudioInfo = getEstudioInfo(req.params.id);
    if (!estudioInfo) return res.status(404).json({ error: 'Estudio no encontrado' });
    ensureStudyAccess(req, estudioInfo);

    const info = db.prepare(
      'INSERT INTO mensajes (estudio_id, sender_id, sender_username, sender_role, contenido) VALUES (?, ?, ?, ?, ?)'
    ).run(req.params.id, req.user.id, req.user.username, req.user.role, contenido.trim());

    const msg = db.prepare('SELECT * FROM mensajes WHERE id = ?').get(info.lastInsertRowid);

    // Emit to the other party
    const targetRole = req.user.role === 'ENCARGADO' ? 'RADIOLOGO' : 'ENCARGADO';
    emitToRole(targetRole, 'mensaje:nuevo', {
      ...msg,
      estudio_registro_id: estudioInfo.registro_id,
      estudio_nombre: estudioInfo.nombre,
      estudio_tipo: estudioInfo.tipo_estudio,
    });

    res.json({ success: true, mensaje: msg });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get messages for a study
app.get('/api/estudios/:id/mensajes', authenticateToken, (req, res) => {
  try {
    const estudio = getEstudioInfo(req.params.id);
    ensureStudyAccess(req, estudio);
    const userTag = `%,${req.user.id},%`;
    const msgs = db.prepare(
      `SELECT * FROM mensajes WHERE estudio_id = ? AND (eliminado_por IS NULL OR eliminado_por NOT LIKE ?) ORDER BY created_at ASC`
    ).all(req.params.id, userTag);
    res.json(msgs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Editar un mensaje de un estudio
app.put('/api/estudios/:estudioId/mensajes/:id', authenticateToken, (req, res) => {
  try {
    const estudio = getEstudioInfo(req.params.estudioId);
    ensureStudyAccess(req, estudio);
    const msg = db.prepare('SELECT * FROM mensajes WHERE id = ? AND estudio_id = ?').get(req.params.id, req.params.estudioId);
    if (!msg) return res.status(404).json({ error: 'Mensaje no encontrado' });
    if (msg.sender_id !== req.user.id) return res.status(403).json({ error: 'Solo el emisor puede editar el mensaje' });
    if (msg.eliminado_para_todos) return res.status(400).json({ error: 'No se puede editar un mensaje eliminado' });

    const nuevoContenido = typeof req.body?.contenido === 'string' ? req.body.contenido.trim().slice(0, 4000) : '';
    if (!nuevoContenido) return res.status(400).json({ error: 'El mensaje no puede estar vacío' });

    db.prepare(
      `UPDATE mensajes SET contenido = ?, editado = 1, editado_at = datetime('now','localtime') WHERE id = ?`
    ).run(nuevoContenido, msg.id);

    const updated = db.prepare('SELECT * FROM mensajes WHERE id = ?').get(msg.id);
    emitToRole('ENCARGADO', 'mensaje:editado', updated);
    emitToRole('RADIOLOGO', 'mensaje:editado', updated);
    res.json({ success: true, mensaje: updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Eliminar un mensaje de un estudio (para todos o para mí)
app.delete('/api/estudios/:estudioId/mensajes/:id', authenticateToken, (req, res) => {
  try {
    const estudio = getEstudioInfo(req.params.estudioId);
    ensureStudyAccess(req, estudio);
    const msg = db.prepare('SELECT * FROM mensajes WHERE id = ? AND estudio_id = ?').get(req.params.id, req.params.estudioId);
    if (!msg) return res.status(404).json({ error: 'Mensaje no encontrado' });
    const modo = req.query.modo === 'todos' ? 'todos' : 'mi';

    if (modo === 'todos') {
      if (msg.sender_id !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Solo el emisor o administrador puede eliminar para todos' });
      }
      db.prepare(
        `UPDATE mensajes SET contenido = '🚫 Este mensaje fue eliminado', eliminado_para_todos = 1 WHERE id = ?`
      ).run(msg.id);
      const updated = db.prepare('SELECT * FROM mensajes WHERE id = ?').get(msg.id);
      emitToRole('ENCARGADO', 'mensaje:eliminado', { id: msg.id, estudio_id: Number(req.params.estudioId), modo: 'todos', mensaje: updated });
      emitToRole('RADIOLOGO', 'mensaje:eliminado', { id: msg.id, estudio_id: Number(req.params.estudioId), modo: 'todos', mensaje: updated });
      return res.json({ success: true, modo: 'todos', mensaje: updated });
    } else {
      let current = msg.eliminado_por || '';
      const userTag = `,${req.user.id},`;
      if (!current.includes(userTag)) {
        current = current ? `${current}${req.user.id},` : `,${req.user.id},`;
        db.prepare('UPDATE mensajes SET eliminado_por = ? WHERE id = ?').run(current, msg.id);
      }
      return res.json({ success: true, modo: 'mi', id: msg.id });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Marcar mensajes del estudio como leídos por el receptor
app.put('/api/estudios/:id/mensajes/leer', authenticateToken, (req, res) => {
  try {
    const estudio = getEstudioInfo(req.params.id);
    ensureStudyAccess(req, estudio);
    // Solo marca como leídos los mensajes que NO envió el usuario actual
    const result = db.prepare(
      "UPDATE mensajes SET leido = 1 WHERE estudio_id = ? AND sender_id != ? AND leido = 0"
    ).run(req.params.id, req.user.id);
    if (result.changes > 0) {
      // Notificar al emisor que sus mensajes fueron leídos
      const otherRole = req.user.role === 'ENCARGADO' ? 'RADIOLOGO' : 'ENCARGADO';
      emitToRole(otherRole, 'mensajes:leidos', { estudio_id: Number(req.params.id) });
    }
    res.json({ success: true, updated: result.changes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get files attached to a study's folder (subcarpeta si existe, raíz si no)
app.get('/api/estudios/:id/archivos', authenticateToken, (req, res) => {
  try {
    const estudio = getEstudioInfo(req.params.id);
    ensureStudyAccess(req, estudio);
    let folderPath, urlBase;
    if (estudio.estudio_folder_name) {
      folderPath = fsManager.getEstudioFolderPath(estudio.registro_id, estudio.nombre, estudio.estudio_folder_name);
      urlBase = `/pacientes/${encodeURIComponent(fsManager.getFolderName(estudio.registro_id, estudio.nombre))}/${encodeURIComponent(estudio.estudio_folder_name)}`;
    } else {
      folderPath = fsManager.getPatientFolderPath(estudio.registro_id, estudio.nombre);
      urlBase = `/pacientes/${encodeURIComponent(fsManager.getFolderName(estudio.registro_id, estudio.nombre))}`;
    }
    const files = fs.readdirSync(folderPath)
      .filter(f => fs.statSync(path.join(folderPath, f)).isFile())
      .map(f => ({
        name: f,
        url: `${urlBase}/${encodeURIComponent(f)}`,
        isImage: /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(f),
        isDoc: /\.(docx|doc|pdf|txt)$/i.test(f),
        size: (() => { try { return fs.statSync(path.join(folderPath, f)).size; } catch { return 0; } })(),
      }));
    res.json(files);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Upload file to patient folder
app.post('/api/estudios/:id/upload', authenticateToken, authorizeStudy, (req, res) => {
  upload.array('archivos', 10)(req, res, (err) => {
    if (err) {
      // Multer errors: file type rejected, size exceeded, etc.
      return res.status(400).json({ success: false, error: err.message || 'Error al procesar los archivos' });
    }
    try {
      const estudioInfo = getEstudioInfo(req.params.id);
      ensureStudyAccess(req, estudioInfo);
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, error: 'No se recibieron archivos válidos' });
      }
      const files = req.files.map(f => ({
        name: f.filename,
        size: f.size,
        isImage: /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(f.filename),
      }));

      logAudit(req.user, 'ARCHIVOS_SUBIDOS', `${estudioInfo?.registro_id}: ${files.length} archivo(s)`, req.params.id);
      const targetRole = req.user.role === 'ENCARGADO' ? 'RADIOLOGO' : 'ENCARGADO';
      const imageFiles = files.filter(file => file.isImage);
      emitToRole(targetRole, 'archivo:subido', {
        estudio_id: parseInt(req.params.id),
        registro_id: estudioInfo?.registro_id,
        nombre: estudioInfo?.nombre,
        files,
        sender_username: req.user.username,
        sender_role: req.user.role,
        target_role: targetRole,
        image_count: imageFiles.length,
      });

      res.json({ success: true, files });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
});

// Envío explícito de las placas ya cargadas al otro profesional.
app.post('/api/estudios/:id/enviar-placas', authenticateToken, authorizeStudy, (req, res) => {
  try {
    if (!['RADIOLOGO', 'ENCARGADO', 'SUPER_ADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Rol no autorizado para enviar placas.' });
    const estudioInfo = getEstudioInfo(req.params.id);
    ensureStudyAccess(req, estudioInfo);
    const folderPath = getEstudioFolderPath(estudioInfo);
    const radiografias = fs.readdirSync(folderPath).filter(name => /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(name));
    if (radiografias.length === 0) return res.status(400).json({ error: 'Debe cargar al menos una radiografía antes de enviarla.' });

    const targetRole = req.user.role === 'RADIOLOGO' ? 'ENCARGADO' : 'RADIOLOGO';
    const envioCount = db.prepare("SELECT COUNT(*) AS c FROM envios WHERE estudio_id = ? AND tipo = 'archivos'").get(estudioInfo.id).c;
    db.prepare(
      `INSERT INTO envios (estudio_id, numero_intento, tipo, estado, contenido, sender_id, sender_username, sender_role, calificacion)
       VALUES (?, ?, 'archivos', 'enviado', ?, ?, ?, ?, 'Sin calificar')`
    ).run(estudioInfo.id, envioCount + 1, `Envío explícito de ${radiografias.length} radiografía(s): ${radiografias.join(', ')}`, req.user.id, req.user.username, req.user.role);
    logAudit(req.user, 'PLACAS_ENVIADAS', `${estudioInfo.registro_id}: ${radiografias.length} radiografía(s) a ${targetRole}`, estudioInfo.id);
    emitToRole(targetRole, 'placas:enviadas', {
      estudio_id: estudioInfo.id,
      registro_id: estudioInfo.registro_id,
      nombre: estudioInfo.nombre,
      radiografias,
      radiografias_count: radiografias.length,
      sender_username: req.user.username,
      sender_role: req.user.role,
    });
    res.json({ success: true, targetRole, radiografias, count: radiografias.length });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// Descarga individual de un archivo (radiografía, PDF o informe) del estudio
app.get('/api/estudios/:id/archivos/:filename/download', authenticateDownload, (req, res) => {
  try {
    const estudio = getEstudioInfo(req.params.id);
    ensureStudyAccess(req, estudio);
    const folderPath = getEstudioFolderPath(estudio);
    const filePath = path.resolve(folderPath, req.params.filename);
    if (!filePath.startsWith(path.resolve(folderPath) + path.sep)) return res.status(403).json({ error: 'Acceso denegado' });
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return res.status(404).json({ error: 'Archivo no encontrado' });
    logAudit(req.user, 'ARCHIVO_DESCARGADO', `${estudio.registro_id}: ${path.basename(filePath)}`, estudio.id);
    res.download(filePath, path.basename(filePath));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// Descarga de las radiografías del estudio (solo imágenes) en un ZIP
app.get('/api/estudios/:id/radiografias/download', authenticateDownload, (req, res) => {
  try {
    const estudio = getEstudioInfo(req.params.id);
    ensureStudyAccess(req, estudio);
    const folderPath = getEstudioFolderPath(estudio);
    const radiografias = fs.readdirSync(folderPath).filter(nombre => /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(nombre));
    if (radiografias.length === 0) return res.status(404).json({ error: 'Este estudio no tiene radiografías cargadas' });
    logAudit(req.user, 'PLACAS_DESCARGADAS', `${estudio.registro_id}: ${radiografias.length} radiografía(s) en ZIP`, estudio.id);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="placas_${estudio.registro_id}_${estudio.nombre.replace(/[^a-z0-9]/gi, '_')}.zip"`);
    const archive = createZipArchive();
    archive.on('error', err => res.status(500).send({ error: err.message }));
    archive.pipe(res);
    for (const archivo of radiografias) archive.file(path.join(folderPath, archivo), { name: archivo });
    archive.finalize();
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// Descarga de todas las radiografías del paciente (todos sus estudios) en un ZIP
app.get('/api/pacientes/:id/radiografias/download', authenticateDownload, requireRole('ENCARGADO', 'RADIOLOGO'), (req, res) => {
  try {
    const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(req.params.id);
    if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });
    const folderPath = fsManager.getPatientFolderPath(paciente.registro_id, paciente.nombre);
    const radiografias = fs.readdirSync(folderPath).filter(nombre => /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(nombre));
    if (radiografias.length === 0) return res.status(404).json({ error: 'El expediente no tiene radiografías cargadas' });
    logAudit(req.user, 'PLACAS_DESCARGADAS', `${paciente.registro_id}: ${radiografias.length} radiografía(s) del expediente`, null);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="placas_${paciente.registro_id}_${paciente.nombre.replace(/[^a-z0-9]/gi, '_')}.zip"`);
    const archive = createZipArchive();
    archive.on('error', err => res.status(500).send({ error: err.message }));
    archive.pipe(res);
    for (const radiografia of radiografias) archive.file(path.join(folderPath, radiografia), { name: radiografia });
    archive.finalize();
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// Descarga individual de un archivo del expediente del paciente (placa o informe)
app.get('/api/pacientes/:id/archivos/:filename/download', authenticateDownload, requireRole('ENCARGADO', 'RADIOLOGO'), (req, res) => {
  try {
    const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(req.params.id);
    if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });
    const folderPath = fsManager.getPatientFolderPath(paciente.registro_id, paciente.nombre);
    const filePath = path.resolve(folderPath, req.params.filename);
    if (!filePath.startsWith(path.resolve(folderPath) + path.sep)) return res.status(403).json({ error: 'Acceso denegado' });
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return res.status(404).json({ error: 'Archivo no encontrado' });
    logAudit(req.user, 'ARCHIVO_DESCARGADO', `${paciente.registro_id}: ${path.basename(filePath)}`, null);
    res.download(filePath, path.basename(filePath));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// Delete a file from patient folder
app.delete('/api/estudios/:id/archivos/:filename', authenticateToken, requireRole('ENCARGADO'), (req, res) => {
  try {
    const estudio = getEstudioInfo(req.params.id);
    ensureStudyAccess(req, estudio);
    const folderPath = getEstudioFolderPath(estudio);
    const filePath = path.resolve(folderPath, req.params.filename);
    // Prevent path traversal
    if (!filePath.startsWith(path.resolve(folderPath) + path.sep)) return res.status(403).json({ error: 'Acceso denegado' });
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado' });
    if (!fs.statSync(filePath).isFile()) return res.status(400).json({ error: 'El recurso no es un archivo' });
    fs.unlinkSync(filePath);
    logAudit(req.user, 'ARCHIVO_ELIMINADO', `${estudio.registro_id}: ${req.params.filename}`, estudio.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Generate next available registro_id — secuencia atómica vía tabla config.
// SQLite serializa las escrituras, así que el UPDATE + SELECT es seguro frente
// a concurrencia (no hay race condition entre dos encargados registrando a la vez).
app.get('/api/next-registro-id', authenticateToken, (req, res) => {
  try {
    const nextSeq = db.transaction(() => {
      db.prepare("UPDATE config SET valor = CAST(CAST(valor AS INTEGER) + 1 AS TEXT) WHERE clave = 'next_registro_seq'").run();
      return parseInt(db.prepare("SELECT valor FROM config WHERE clave = 'next_registro_seq'").get().valor, 10);
    })();
    res.json({ registro_id: `RX-${String(nextSeq).padStart(6, '0')}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Buscar paciente por registro_id exacto (para autocompletar en el modal de registro)
app.get('/api/pacientes/por-registro/:registro_id', authenticateToken, (req, res) => {
  try {
    const p = db.prepare('SELECT * FROM pacientes WHERE registro_id = ?').get(req.params.registro_id);
    if (!p) return res.json({ found: false });
    if (p.fecha_nacimiento) {
      p.edad = calcularEdad(p.fecha_nacimiento) ?? p.edad;
    }
    res.json({ found: true, paciente: p });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Submit diagnosis (RADIOLOGO)
app.post('/api/estudios/:id/diagnostico', authenticateToken, requireRole('RADIOLOGO'), async (req, res) => {
  const { diagnostico } = req.body;
  try {
    const estudioInfo = db.prepare('SELECT e.*, p.nombre, p.registro_id, p.edad FROM estudios e JOIN pacientes p ON e.paciente_id = p.id WHERE e.id = ?').get(req.params.id);
    if (!estudioInfo) return res.status(404).json({ error: 'Estudio no encontrado' });
    ensureStudyAccess(req, estudioInfo);
    // Solo se puede emitir diagnóstico desde estados válidos (incluye reenvío sin duplicados desde 'Diagnóstico recibido')
    const estadosPermitidos = ['Enviada al radiólogo', 'Devuelta por revisión', 'Diagnóstico recibido'];
    if (!estadosPermitidos.includes(estudioInfo.estado)) {
      return res.status(400).json({ error: `No se puede emitir diagnóstico en estado "${estudioInfo.estado}"` });
    }
    if (!diagnostico?.trim()) return res.status(400).json({ error: 'El diagnóstico no puede estar vacío' });

    const folderPath = getEstudioFolderPath(estudioInfo);
    const docPath = await wordGen.generateWordReport(folderPath, {
      estudioId: req.params.id,
      fecha: new Date().toLocaleDateString('es-HN'),
      pacienteNombre: estudioInfo.nombre,
      pacienteEdad: estudioInfo.edad,
      tipoEstudio: estudioInfo.tipo_estudio,
      region: estudioInfo.region || '',
      lateralidad: estudioInfo.lateralidad || '',
      medicoRemitente: estudioInfo.medico_remitente,
      diagnostico,
      radiologo: req.user.username,
      config: getConfig(),
    });

    const updated = db.prepare(`UPDATE estudios SET diagnostico = ?, ruta_informe = ?, estado = ?, radiologo_id = ?, fecha_estado = datetime('now')
      WHERE id = ? AND (radiologo_id IS NULL OR radiologo_id = ?)`)
      .run(diagnostico.trim(), docPath, 'Diagnóstico recibido', req.user.id, req.params.id, req.user.id);
    if (updated.changes !== 1) return res.status(409).json({ error: 'El estudio fue asignado a otro radiólogo. Actualice la bandeja.' });

    // Trazabilidad de envíos (sin duplicados: se actualiza el mismo estudio)
    const envioCount = db.prepare("SELECT COUNT(*) as c FROM envios WHERE estudio_id = ? AND tipo = 'diagnostico'").get(req.params.id).c;
    db.prepare(
      `INSERT INTO envios (estudio_id, numero_intento, tipo, estado, contenido, sender_id, sender_username, sender_role, calificacion)
       VALUES (?, ?, 'diagnostico', 'aceptado', ?, ?, ?, ?, 'Sin calificar')`
    ).run(req.params.id, envioCount + 1, diagnostico, req.user.id, req.user.username, req.user.role);
    logAudit(req.user, 'DIAGNOSTICO_ENVIADO', `${estudioInfo.registro_id}: envío #${envioCount + 1}`, estudioInfo.id);

    emitToRole('ENCARGADO', 'diagnostico:recibido', {
      id: estudioInfo.id,
      registro_id: estudioInfo.registro_id,
      nombre: estudioInfo.nombre,
      tipo_estudio: estudioInfo.tipo_estudio,
      diagnostico,
    });

    res.json({ success: true, docPath });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Stats
app.get('/api/stats', authenticateToken, (req, res) => {
  const now = new Date();
  const firstDayOfMonth = fechaLocalISO(new Date(now.getFullYear(), now.getMonth(), 1));
  const totalMes = db.prepare("SELECT COUNT(*) as count FROM estudios WHERE fecha_creacion >= ?").get(firstDayOfMonth).count;
  const totalAll = db.prepare("SELECT COUNT(*) as count FROM estudios").get().count;
  const entregados = db.prepare("SELECT COUNT(*) as count FROM estudios WHERE estado = 'Entregado'").get().count;
  const pendientes = db.prepare("SELECT COUNT(*) as count FROM estudios WHERE estado NOT IN ('Entregado', 'Listo para imprimir')").get().count;
  const listosImprimir = db.prepare("SELECT COUNT(*) as count FROM estudios WHERE estado = 'Listo para imprimir'").get().count;
  const enRadiologo = db.prepare("SELECT COUNT(*) as count FROM estudios WHERE estado = 'Enviada al radiólogo'").get().count;
  const diagnosticosRecibidos = db.prepare("SELECT COUNT(*) as count FROM estudios WHERE estado = 'Diagnóstico recibido'").get().count;
  const urgentes = db.prepare("SELECT COUNT(*) as count FROM estudios WHERE urgente = 1 AND estado != 'Entregado'").get().count;
  const vencidos = db.prepare("SELECT COUNT(*) as count FROM estudios WHERE estado != 'Entregado' AND fecha_entrega_estimada IS NOT NULL AND fecha_entrega_estimada < date('now','localtime')").get().count;
  res.json({ totalMes, totalAll, entregados, pendientes, listosImprimir, enRadiologo, diagnosticosRecibidos, urgentes, vencidos });
});

// Conteo por bandeja en una sola consulta (evita una petición por cada fase)
app.get('/api/stats/por-estado', authenticateToken, (req, res) => {
  try {
    const conteos = Object.fromEntries(ESTADOS_VALIDOS.map(estado => [estado, 0]));
    const rows = db.prepare('SELECT estado, COUNT(*) AS total FROM estudios GROUP BY estado').all();
    for (const row of rows) {
      if (row.estado in conteos) conteos[row.estado] = row.total;
    }
    res.json(conteos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Export folder as ZIP (with token in query for browser downloads)
app.get('/api/estudios/:id/export', authenticateDownload, (req, res) => {
  try {
    const estudioInfo = getEstudioInfo(req.params.id);
    ensureStudyAccess(req, estudioInfo);
    const folderPath = getEstudioFolderPath(estudioInfo);
    logAudit(req.user, 'DESCARGA_ZIP', `${estudioInfo.registro_id}: descarga de carpeta`, estudioInfo.id);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${estudioInfo.registro_id}_${estudioInfo.nombre.replace(/[^a-z0-9]/gi, '_')}.zip"`);
    const archive = createZipArchive();
    archive.on('error', err => res.status(500).send({ error: err.message }));
    archive.pipe(res);
    archive.directory(folderPath, false);
    archive.finalize();
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ============================================================
// HISTORIAL CLÍNICO DEL PACIENTE
// ============================================================

app.get('/api/pacientes/:id/estudios', authenticateToken, (req, res) => {
  try {
    const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(req.params.id);
    if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });
    const filters = ['e.paciente_id = ?'];
    const params = [paciente.id];
    if (req.user.role === 'RADIOLOGO') {
      filters.push('(e.radiologo_id = ? OR e.radiologo_id IS NULL)');
      params.push(req.user.id);
    }
    const estudios = db.prepare(
      `SELECT e.* FROM estudios e WHERE ${filters.join(' AND ')} ORDER BY e.fecha_creacion DESC`
    ).all(...params);
    res.json({ paciente, estudios });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Búsqueda de pacientes con paginación (devuelve todos si q está vacío)
app.get('/api/pacientes/buscar', authenticateToken, (req, res) => {
  const q = (req.query.q || '').trim();
  const page  = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(5, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  try {
    let total, rows;
    if (!q) {
      total = db.prepare(`SELECT COUNT(*) AS c FROM pacientes`).get().c;
      rows = db.prepare(
        `SELECT p.id, p.registro_id, p.nombre, p.edad, p.sexo, p.fecha_nacimiento, p.telefono, p.direccion, p.correo, p.notas, p.fecha_creacion,
                (SELECT COUNT(*) FROM estudios e WHERE e.paciente_id = p.id) as total_estudios
         FROM pacientes p
         ORDER BY p.fecha_creacion DESC
         LIMIT ? OFFSET ?`
      ).all(limit, offset);
    } else {
      total = db.prepare(
        `SELECT COUNT(*) AS c FROM pacientes WHERE nombre LIKE ? OR registro_id LIKE ?`
      ).get(`%${q}%`, `%${q}%`).c;
      rows = db.prepare(
        `SELECT p.id, p.registro_id, p.nombre, p.edad, p.sexo, p.fecha_nacimiento, p.telefono, p.direccion, p.correo, p.notas, p.fecha_creacion,
                (SELECT COUNT(*) FROM estudios e WHERE e.paciente_id = p.id) as total_estudios
         FROM pacientes p
         WHERE p.nombre LIKE ? OR p.registro_id LIKE ?
         ORDER BY p.fecha_creacion DESC
         LIMIT ? OFFSET ?`
      ).all(`%${q}%`, `%${q}%`, limit, offset);
    }

    // Detectar posibles duplicados por nombre normalizado
    const normalize = str => String(str || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/\s+/g, ' ').trim();
    const grupos = {};
    for (const p of rows) {
      const key = normalize(p.nombre);
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(p.registro_id);
    }
    const pacientes = rows.map(p => ({
      ...p,
      posible_duplicado: grupos[normalize(p.nombre)]?.length > 1
        ? grupos[normalize(p.nombre)].filter(rid => rid !== p.registro_id)
        : null,
    }));

    res.json({ total, page, pages: Math.ceil(total / limit) || 1, limit, pacientes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// EXPORTAR CARPETA AL ESCRITORIO
// ============================================================

app.post('/api/estudios/:id/export-desktop', authenticateToken, requireRole('ENCARGADO'), (req, res) => {
  try {
    const estudioInfo = db.prepare('SELECT e.*, p.nombre, p.registro_id FROM estudios e JOIN pacientes p ON e.paciente_id = p.id WHERE e.id = ?').get(req.params.id);
    if (!estudioInfo) return res.status(404).json({ error: 'Estudio no encontrado' });
    // Export-desktop: exporta la carpeta completa del paciente (no solo la subcarpeta)
    const folderPath = fsManager.getPatientFolderPath(estudioInfo.registro_id, estudioInfo.nombre);
    if (!fs.existsSync(folderPath)) return res.status(404).json({ error: 'La carpeta del paciente no existe' });
    // Escritorio de la PC donde corre el servidor (Windows: C:\Users\X\Desktop, macOS: ~/Desktop)
    let desktopPath = path.join(os.homedir(), 'Desktop');
    if (!fs.existsSync(desktopPath)) desktopPath = path.join(os.homedir(), 'Escritorio');
    if (!fs.existsSync(desktopPath)) return res.status(500).json({ error: 'No se encontró la carpeta de escritorio del servidor' });
    const destPath = fsManager.exportPatientToDesktop(estudioInfo.registro_id, estudioInfo.nombre, desktopPath);
    logAudit(req.user, 'EXPORTAR_DESKTOP', `${estudioInfo.registro_id}: carpeta exportada al escritorio`, estudioInfo.id);
    res.json({ success: true, destino: destPath });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// REPORTES ESTADÍSTICOS MENSUALES
// ============================================================

app.get('/api/reportes/mensual', authenticateToken, requireRole('ENCARGADO'), (req, res) => {
  try {
    const meses = Math.min(parseInt(req.query.meses) || 12, 36);
    const rows = db.prepare(`
      SELECT strftime('%Y-%m', fecha_creacion) as mes,
             COUNT(*) as total,
             SUM(CASE WHEN estado = 'Entregado' THEN 1 ELSE 0 END) as entregados,
             SUM(CASE WHEN estado = 'Diagnóstico recibido' THEN 1 ELSE 0 END) as diagnosticos
      FROM estudios
      WHERE fecha_creacion >= date('now', 'localtime', '-' || ? || ' months')
      GROUP BY mes
      ORDER BY mes ASC
    `).all(meses);
    res.json(rows.map(r => ({
      mes: r.mes,
      total: r.total || 0,
      entregados: r.entregados || 0,
      diagnosticos: r.diagnosticos || 0,
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// CALENDARIO DE ENTREGAS (lunes a viernes)
// ============================================================

app.get('/api/calendario/entregas', authenticateToken, requireRole('ENCARGADO'), (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT strftime('%Y-%m-%d', fecha_entrega_estimada) as dia, COUNT(*) as total
      FROM estudios
      WHERE fecha_entrega_estimada IS NOT NULL
        AND fecha_entrega_estimada >= date('now', 'localtime', '-7 days')
        AND fecha_entrega_estimada <= date('now', 'localtime', '+30 days')
      GROUP BY dia
      ORDER BY dia ASC
    `).all();
    res.json(rows.map(r => ({ dia: r.dia, total: r.total })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Top estudios por tipo (para el panel de reportes)
app.get('/api/reportes/top-estudios', authenticateToken, requireRole('ENCARGADO'), (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT tipo_estudio,
             COUNT(*) as total,
             SUM(CASE WHEN estado = 'Entregado' THEN 1 ELSE 0 END) as entregados
      FROM estudios
      GROUP BY tipo_estudio
      ORDER BY total DESC
      LIMIT 8
    `).all();
    res.json(rows.map(r => ({ tipo: r.tipo_estudio, total: r.total, entregados: r.entregados || 0 })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// PRODUCTIVIDAD DEL PERÍODO (panel de reportes del encargado)
// ============================================================
app.get('/api/reportes/productividad', authenticateToken, requireRole('ENCARGADO'), (req, res) => {
  try {
    const dias = Math.min(Math.max(parseInt(req.query.dias) || 30, 1), 365);
    const desde = fechaLocalISO(new Date(Date.now() - (dias - 1) * 86400000));

    const totales = db.prepare(`
      SELECT COUNT(*) AS estudios,
             SUM(CASE WHEN estado = 'Entregado' THEN 1 ELSE 0 END) AS entregados,
             SUM(CASE WHEN urgente = 1 THEN 1 ELSE 0 END) AS urgentes,
             SUM(CASE WHEN diagnostico IS NOT NULL AND TRIM(diagnostico) != '' THEN 1 ELSE 0 END) AS informes
      FROM estudios WHERE fecha_creacion >= ?
    `).get(desde);

    const radiologos = db.prepare(`
      SELECT u.username AS radiologo,
             COUNT(e.id) AS asignados,
             SUM(CASE WHEN e.diagnostico IS NOT NULL AND TRIM(e.diagnostico) != '' THEN 1 ELSE 0 END) AS informes,
             SUM(CASE WHEN e.estado = 'Entregado' THEN 1 ELSE 0 END) AS entregados
      FROM estudios e
      JOIN usuarios u ON u.id = e.radiologo_id
      WHERE e.fecha_creacion >= ?
      GROUP BY u.id, u.username
      ORDER BY informes DESC, asignados DESC
    `).all(desde);

    // Tiempo medio de lectura: del envío de placas al radiólogo hasta la emisión del informe.
    const tiempos = db.prepare(`
      SELECT u.username AS radiologo,
             AVG((julianday((SELECT MIN(d.fecha_envio) FROM envios d WHERE d.estudio_id = e.id AND d.tipo = 'diagnostico'))
                - julianday((SELECT MIN(r.fecha_envio) FROM envios r WHERE r.estudio_id = e.id AND r.tipo = 'envio_radiologo'))) * 24) AS horas
      FROM estudios e
      JOIN usuarios u ON u.id = e.radiologo_id
      WHERE e.radiologo_id IS NOT NULL AND e.fecha_creacion >= ?
      GROUP BY u.id, u.username
    `).all(desde);
    const horasPorRadiologo = {};
    for (const t of tiempos) horasPorRadiologo[t.radiologo] = t.horas;

    const medicos = db.prepare(`
      SELECT medico_remitente AS medico,
             COUNT(*) AS total,
             SUM(CASE WHEN estado = 'Entregado' THEN 1 ELSE 0 END) AS entregados
      FROM estudios
      WHERE fecha_creacion >= ? AND medico_remitente IS NOT NULL AND TRIM(medico_remitente) != ''
      GROUP BY medico_remitente
      ORDER BY total DESC LIMIT 12
    `).all(desde);

    // Distribución por región anatómica (si el estudio no la registra, se usa el tipo)
    const regiones = db.prepare(`
      SELECT COALESCE(NULLIF(TRIM(region), ''), 'Sin clasificar') AS region,
             COUNT(*) AS total,
             SUM(CASE WHEN urgente = 1 THEN 1 ELSE 0 END) AS urgentes
      FROM estudios
      WHERE fecha_creacion >= ?
      GROUP BY region
      ORDER BY total DESC LIMIT 12
    `).all(desde);

    const vencidos = db.prepare(`
      SELECT e.id, e.estado, e.tipo_estudio, e.urgente, e.fecha_entrega_estimada, p.nombre, p.registro_id
      FROM estudios e JOIN pacientes p ON p.id = e.paciente_id
      WHERE e.estado != 'Entregado'
        AND e.fecha_entrega_estimada IS NOT NULL
        AND e.fecha_entrega_estimada < date('now','localtime')
      ORDER BY e.urgente DESC, e.fecha_entrega_estimada ASC
      LIMIT 50
    `).all();

    res.json({
      dias,
      desde,
      totales: {
        estudios: totales.estudios || 0,
        entregados: totales.entregados || 0,
        urgentes: totales.urgentes || 0,
        informes: totales.informes || 0,
        pendientes: Math.max(0, (totales.estudios || 0) - (totales.entregados || 0)),
      },
      radiologos: radiologos.map(r => ({
        radiologo: r.radiologo,
        asignados: r.asignados || 0,
        informes: r.informes || 0,
        entregados: r.entregados || 0,
        horas_promedio: Number.isFinite(horasPorRadiologo[r.radiologo]) ? Math.round(horasPorRadiologo[r.radiologo] * 10) / 10 : null,
      })),
      medicos: medicos.map(m => ({ medico: m.medico, total: m.total || 0, entregados: m.entregados || 0 })),
      regiones: regiones.map(r => ({ region: r.region, total: r.total || 0, urgentes: r.urgentes || 0 })),
      vencidos,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Lote de entregas: marcar varias placas 'Listo para imprimir' como entregadas de una vez
app.post('/api/estudios/lote/entregar', authenticateToken, requireRole('ENCARGADO'), (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Seleccione al menos un estudio' });
  }
  try {
    let ok = 0;
    const fallidos = [];
    for (const id of ids) {
      const info = db.prepare('SELECT id, registro_id, estado FROM estudios WHERE id = ?').get(id);
      if (!info) { fallidos.push(id); continue; }
      const allowed = (TRANSICIONES[info.estado] || []).includes('Entregado');
      if (!allowed) { fallidos.push(id); continue; }
      db.prepare("UPDATE estudios SET estado = ?, fecha_estado = datetime('now') WHERE id = ?").run('Entregado', id);
      logAudit(req.user, 'ESTADO_CAMBIADO', `${info.registro_id}: entregado en lote (${info.estado} → Entregado)`, id);
      ok++;
    }
    res.json({ success: true, ok, fallidos });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// PLANTILLAS DE DIAGNÓSTICO (editables por el encargado)
// ============================================================

app.get('/api/plantillas', authenticateToken, (req, res) => {
  const rows = db.prepare('SELECT * FROM plantillas ORDER BY label ASC').all();
  res.json(rows);
});

app.post('/api/plantillas', authenticateToken, requireRole('ENCARGADO'), (req, res) => {
  const { label, texto, categoria } = req.body;
  if (!label?.trim() || !texto?.trim()) return res.status(400).json({ error: 'Etiqueta y texto son requeridos' });
  try {
    // `creado_por` es una clave foránea a usuarios(id): guarda el id, no el nombre.
    const info = db.prepare('INSERT INTO plantillas (label, texto, categoria, creado_por) VALUES (?, ?, ?, ?)')
      .run(label.trim(), texto.trim(), cleanText(categoria, 40) || 'General', req.user.id);
    logAudit(req.user, 'PLANTILLA_CREADA', `Plantilla: ${label.trim()}`, null);
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/plantillas/:id', authenticateToken, requireRole('ENCARGADO'), (req, res) => {
  const { label, texto, categoria } = req.body;
  try {
    if (!label?.trim() || !texto?.trim()) return res.status(400).json({ error: 'Etiqueta y texto son requeridos' });
    db.prepare("UPDATE plantillas SET label = ?, texto = ?, categoria = ?, updated_at = datetime('now','localtime') WHERE id = ?")
      .run(label.trim(), texto.trim(), cleanText(categoria, 40) || 'General', req.params.id);
    logAudit(req.user, 'PLANTILLA_EDITADA', `Plantilla: ${label.trim()}`, null);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/plantillas/:id', authenticateToken, requireRole('ENCARGADO'), (req, res) => {
  try {
    const t = db.prepare('SELECT * FROM plantillas WHERE id = ?').get(req.params.id);
    db.prepare('DELETE FROM plantillas WHERE id = ?').run(req.params.id);
    logAudit(req.user, 'PLANTILLA_ELIMINADA', `Plantilla: ${t?.label || req.params.id}`, null);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// VISOR DE INFORME WORD INLINE (devuelve el texto del diagnóstico formateado)
// ============================================================

app.get('/api/estudios/:id/informe/download', authenticateDownload, (req, res) => {
  try {
    const estudio = getEstudioInfo(req.params.id);
    ensureStudyAccess(req, estudio);
    if (!estudio.ruta_informe || !fs.existsSync(estudio.ruta_informe)) {
      return res.status(404).json({ error: 'Este estudio todavía no tiene un informe Word generado' });
    }
    logAudit(req.user, 'DESCARGA_INFORME', `${estudio.registro_id}: informe Word`, estudio.id);
    res.download(estudio.ruta_informe, path.basename(estudio.ruta_informe));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.get('/api/estudios/:id/informe/preview', authenticateToken, (req, res) => {
  try {
    const est = getEstudioInfo(req.params.id);
    ensureStudyAccess(req, est);
    const cfg = getConfig();
    res.json({
      centro_nombre: cfg.centro_nombre || 'RX CCDX',
      centro_direccion: cfg.centro_direccion || '',
      centro_telefono: cfg.centro_telefono || '',
      centro_email: cfg.centro_email || '',
      centro_rnc: cfg.centro_rnc || '',
      informe_pie: cfg.informe_pie || '',
      paciente: est.nombre,
      registro_id: est.registro_id,
      edad: est.edad,
      sexo: est.sexo,
      fecha_nacimiento: est.fecha_nacimiento || '',
      telefono: est.telefono || '',
      direccion: est.direccion || '',
      correo: est.correo || '',
      tipo_estudio: est.tipo_estudio,
      region: est.region || '',
      lateralidad: est.lateralidad || '',
      medico_remitente: est.medico_remitente || '',
      notas_clinicas: est.notas_clinicas || '',
      fecha_estudio: est.fecha_estudio,
      fecha_entrega_estimada: est.fecha_entrega_estimada || '',
      diagnostico: est.diagnostico || '',
      radiologo_nombre: est.radiologo_nombre || (est.radiologo_username ? `Dr. ${est.radiologo_username}` : 'Dr. Alcántara'),
      estado: est.estado,
      urgente: !!est.urgente,
      tiene_informe: !!est.ruta_informe,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// CARPETAS VIRTUALES DE PACIENTES (con paginación)
// ============================================================

app.get('/api/carpetas', authenticateToken, requireRole('ENCARGADO'), (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(5, parseInt(req.query.limit) || 20));
    const q = (req.query.q || '').trim();
    const offset = (page - 1) * limit;

    let where = '';
    const params = [];
    if (q) {
      where = 'WHERE p.nombre LIKE ? OR p.registro_id LIKE ?';
      params.push(`%${q}%`, `%${q}%`);
    }

    const total = db.prepare(`SELECT COUNT(DISTINCT p.id) as c FROM pacientes p ${where}`).get(...params).c;

    const rows = db.prepare(`
      SELECT p.id, p.registro_id, p.nombre, p.edad, p.sexo, p.fecha_nacimiento, p.fecha_creacion,
             COUNT(e.id) as total_estudios,
             SUM(CASE WHEN e.estado = 'Entregado' THEN 1 ELSE 0 END) as entregados,
             SUM(CASE WHEN e.estado NOT IN ('Entregado') AND e.estado IS NOT NULL THEN 1 ELSE 0 END) as en_proceso,
             MAX(e.fecha_creacion) as ultimo_estudio
      FROM pacientes p
      LEFT JOIN estudios e ON e.paciente_id = p.id
      ${where}
      GROUP BY p.id
      ORDER BY p.fecha_creacion DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    res.json({
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
      carpetas: rows,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Detalle de carpeta de un paciente: estudios + archivos agrupados por subcarpeta de estudio
app.get('/api/carpetas/:paciente_id', authenticateToken, requireRole('ENCARGADO'), (req, res) => {
  try {
    const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(req.params.paciente_id);
    if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });

    const estudios = db.prepare(`
      SELECT e.id, e.paciente_id, e.radiologo_id, e.tipo_estudio, e.fecha_estudio, e.estado, e.diagnostico,
        e.medico_remitente, e.notas_clinicas, e.nota_revision, e.ruta_informe, e.fecha_creacion,
        e.fecha_estado, e.fecha_entrega_estimada, e.urgente, e.region, e.lateralidad, e.estudio_folder_name,
        p.nombre, p.registro_id, p.edad, p.sexo
      FROM estudios e JOIN pacientes p ON p.id = e.paciente_id
      WHERE e.paciente_id = ?
      ORDER BY e.fecha_creacion DESC
    `).all(paciente.id);

    // ── Archivos del expediente ─────────────────────────────────────────────
    // FIX T3: usar fsManager.getFolderName() con normalización NFD correcta
    // en lugar del replace simple que rompía nombres con tildes.
    const patientFolder = path.join(fsManager.DATA_DIR, fsManager.getFolderName(paciente.registro_id, paciente.nombre));
    const folderName = fsManager.getFolderName(paciente.registro_id, paciente.nombre);

    // Archivos en la raíz del expediente (compatibilidad con estudios sin subcarpeta)
    let archivosRaiz = [];
    try {
      if (fs.existsSync(patientFolder)) {
        archivosRaiz = fs.readdirSync(patientFolder)
          .filter(f => {
            // Ignorar las subcarpetas de estudios (E-NNN...)
            const fullPath = path.join(patientFolder, f);
            return fs.statSync(fullPath).isFile();
          })
          .map(f => ({
            name: f,
            url: `/pacientes/${encodeURIComponent(folderName)}/${encodeURIComponent(f)}`,
            isImage: /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(f),
            isDoc: /\.(docx|doc|pdf)$/i.test(f),
            size: (() => { try { return fs.statSync(path.join(patientFolder, f)).size; } catch { return 0; } })(),
            estudio_id: null,  // archivo raíz, no ligado a estudio específico
          }));
      }
    } catch { /* carpeta aún no existe */ }

    // Archivos en subcarpetas de cada estudio (T7)
    const archivosPorEstudio = {};
    for (const est of estudios) {
      if (!est.estudio_folder_name) continue;
      const subPath = path.join(patientFolder, est.estudio_folder_name);
      try {
        if (fs.existsSync(subPath)) {
          archivosPorEstudio[est.id] = fs.readdirSync(subPath)
            .filter(f => fs.statSync(path.join(subPath, f)).isFile())
            .map(f => ({
              name: f,
              url: `/pacientes/${encodeURIComponent(folderName)}/${encodeURIComponent(est.estudio_folder_name)}/${encodeURIComponent(f)}`,
              isImage: /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(f),
              isDoc: /\.(docx|doc|pdf)$/i.test(f),
              size: (() => { try { return fs.statSync(path.join(subPath, f)).size; } catch { return 0; } })(),
              estudio_id: est.id,
            }));
        }
      } catch { /* subcarpeta vacía o no existe */ }
    }

    // Lista plana de todos los archivos para compatibilidad con componentes existentes
    const todosArchivos = [
      ...archivosRaiz,
      ...Object.values(archivosPorEstudio).flat(),
    ];

    res.json({
      paciente,
      estudios,
      archivos: todosArchivos,          // lista plana (compatibilidad)
      archivos_raiz: archivosRaiz,      // solo los de la raíz
      archivos_por_estudio: archivosPorEstudio,  // agrupados por estudio_id
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Descargar carpeta completa de un paciente como ZIP
app.get('/api/carpetas/:paciente_id/download', authenticateDownload, requireRole('ENCARGADO'), (req, res) => {
  try {
    const paciente = db.prepare('SELECT * FROM pacientes WHERE id = ?').get(req.params.paciente_id);
    if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });
    const folderPath = fsManager.getPatientFolderPath(paciente.registro_id, paciente.nombre);
    logAudit(req.user, 'DESCARGA_CARPETA_PACIENTE', `${paciente.registro_id} — ${paciente.nombre}`, null);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${paciente.registro_id}_${paciente.nombre.replace(/[^a-z0-9]/gi, '_')}.zip"`);
    const archive = createZipArchive();
    archive.on('error', err => res.status(500).send({ error: err.message }));
    archive.pipe(res);
    archive.directory(folderPath, false);
    archive.finalize();
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ============================================================
// HISTORIAL DE ENVÍOS (trazabilidad sin duplicados)
// ============================================================

app.get('/api/estudios/:id/envios', authenticateToken, (req, res) => {
  try {
    const estudio = getEstudioInfo(req.params.id);
    ensureStudyAccess(req, estudio);
    const rows = db.prepare(
      `SELECT * FROM envios WHERE estudio_id = ? ORDER BY numero_intento DESC, fecha_envio DESC`
    ).all(req.params.id);
    res.json(rows);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// List all users — el Super Administrador queda oculto para el ENCARGADO, pero visible para SUPER_ADMIN
app.get('/api/usuarios', authenticateToken, requireRole('ENCARGADO'), (req, res) => {
  let query = "SELECT id, username, role, activo FROM usuarios";
  if (req.user.role !== 'SUPER_ADMIN') {
    query += " WHERE role != 'SUPER_ADMIN'";
  }
  query += " ORDER BY role, username";
  const users = db.prepare(query).all();
  res.json(users);
});

// Desactivar / reactivar usuario (solo SUPER_ADMIN)
app.put('/api/usuarios/:id/activo', authenticateToken, requireRole('SUPER_ADMIN'), (req, res) => {
  const { activo } = req.body;
  try {
    const target = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });
    db.prepare('UPDATE usuarios SET activo = ? WHERE id = ?').run(activo ? 1 : 0, req.params.id);
    logAudit(req.user, activo ? 'USUARIO_ACTIVADO' : 'USUARIO_DESACTIVADO', `Usuario: ${target.username}`);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Modificar usuario (username, role) (solo SUPER_ADMIN)
app.put('/api/usuarios/:id', authenticateToken, requireRole('SUPER_ADMIN'), (req, res) => {
  const { username, role } = req.body;
  try {
    const target = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    // Check if new username already exists for a different user
    if (username && username !== target.username) {
      const exists = db.prepare('SELECT id FROM usuarios WHERE username = ?').get(username);
      if (exists) return res.status(400).json({ error: 'El nombre de usuario ya está en uso' });
    }

    const updates = [];
    const params = [];
    if (username) { updates.push('username = ?'); params.push(username); }
    if (role) { updates.push('role = ?'); params.push(role); }
    
    if (updates.length > 0) {
      params.push(req.params.id);
      db.prepare(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      logAudit(req.user, 'USUARIO_MODIFICADO', `Usuario modificado: ${target.username} -> ${username || target.username}`);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Resetear contraseña de otro usuario (solo SUPER_ADMIN)
app.put('/api/usuarios/:id/password', authenticateToken, requireRole('SUPER_ADMIN'), (req, res) => {
  const { new_password, respuesta_seguridad } = req.body;
  if (typeof new_password !== 'string' || new_password.length < 4) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
  }
  try {
    const target = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });
    const salt = bcrypt.genSaltSync(10);
    const updates = ['password_hash = ?'];
    const params = [bcrypt.hashSync(new_password, salt)];
    if (respuesta_seguridad) {
      updates.push('respuesta_seguridad = ?');
      params.push(bcrypt.hashSync(respuesta_seguridad.toLowerCase(), salt));
    }
    params.push(req.params.id);
    db.prepare(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    logAudit(req.user, 'USUARIO_PASSWORD_RESET', `Contraseña restablecida: ${target.username}`);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Auditoría (solo SUPER_ADMIN) con filtros de búsqueda
app.get('/api/auditoria', authenticateToken, requireRole('SUPER_ADMIN'), (req, res) => {
  const { q, accion, usuario, desde, hasta } = req.query;
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const conds = [];
  const params = [];
  if (q) {
    conds.push('(usuario_nombre LIKE ? OR accion LIKE ? OR detalle LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (accion) { conds.push('accion = ?'); params.push(accion); }
  if (usuario) { conds.push('usuario_nombre = ?'); params.push(usuario); }
  if (desde) { conds.push('created_at >= ?'); params.push(desde + ' 00:00:00'); }
  if (hasta) { conds.push('created_at <= ?'); params.push(hasta + ' 23:59:59'); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const rows = db.prepare(`SELECT * FROM auditoria ${where} ORDER BY created_at DESC LIMIT ?`).all(...params, limit);
  res.json(rows);
});

// Manejador de errores central (incluye rechazos de multer por tipo de archivo)
app.use((err, req, res, next) => {
  if (err && err.message && err.message.includes('Tipo de archivo')) {
    return res.status(400).json({ error: err.message });
  }
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'El archivo supera el límite de 50MB' });
  }
  if (err && err.message && err.message.includes('Estudio no encontrado')) {
    return res.status(404).json({ error: err.message });
  }
  if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
    return res.status(400).json({ error: 'El cuerpo de la petición no es JSON válido' });
  }
  console.error('[Error]', err);
  res.status(500).json({ error: err.message || 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3002;
server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.warn(`[Servidor] El puerto ${PORT} ya está ocupado. La API probablemente ya está ejecutándose en http://localhost:${PORT}`);
    process.exitCode = 0;
    return;
  }
  console.error('[Servidor] No se pudo iniciar:', error);
  process.exitCode = 1;
});
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket activo para comunicación en tiempo real`);
});
