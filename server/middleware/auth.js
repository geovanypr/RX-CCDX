'use strict';
const jwt = require('jsonwebtoken');
const db  = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET no está definido en las variables de entorno.');
  process.exit(1);
}

/**
 * Verifica el JWT del header Authorization: Bearer <token>
 * Adjunta req.user = { id, username, role }
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.query.token; // fallback para <img src> y descargas

  if (!token) return res.status(401).json({ error: 'Token requerido' });

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  // Re-leer usuario de DB para verificar que sigue activo y obtener rol actual
  const user = db.prepare(
    'SELECT id, username, role, activo FROM usuarios WHERE id = ?'
  ).get(payload.id);

  if (!user)         return res.status(401).json({ error: 'Usuario no encontrado' });
  if (!user.activo)  return res.status(403).json({ error: 'Cuenta desactivada' });

  req.user = { id: user.id, username: user.username, role: user.role };
  next();
}

/**
 * Fábrica de middleware de rol.
 * Uso: requireRole('SUPER_ADMIN', 'ENCARGADO')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    // El SUPER_ADMIN (Modo Fantasma) tiene acceso a todas las operaciones del sistema.
    if (req.user.role === 'SUPER_ADMIN' || roles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({ error: 'Acceso denegado' });
  };
}

module.exports = { authenticateToken, requireRole, JWT_SECRET };
