'use strict';

const bcrypt = require('bcryptjs');

const SECURITY_QUESTION = '¿Cuál fue tu primera mascota?';

function bootstrapUsers(db) {
  const userCount = db.prepare('SELECT COUNT(*) AS total FROM usuarios').get().total;
  if (userCount > 0) return;

  const securityAnswer = process.env.DEFAULT_USER_SECURITY_ANSWER;
  const users = [
    {
      username: process.env.DEFAULT_SUPER_ADMIN_USERNAME || 'superadmin',
      password: process.env.DEFAULT_SUPER_ADMIN_PASSWORD,
      role: 'SUPER_ADMIN',
    },
    {
      username: process.env.DEFAULT_ENCARGADA_USERNAME || 'encargada',
      password: process.env.DEFAULT_ENCARGADA_PASSWORD,
      role: 'ENCARGADO',
    },
    {
      username: process.env.DEFAULT_RADIOLOGO_USERNAME || 'radiologo',
      password: process.env.DEFAULT_RADIOLOGO_PASSWORD,
      role: 'RADIOLOGO',
    },
  ];

  if (!securityAnswer || users.some(user => !user.password)) {
    console.warn('[Usuarios] Bootstrap omitido: faltan variables DEFAULT_* requeridas.');
    return;
  }

  const insertUser = db.prepare(
    `INSERT INTO usuarios
      (username, password_hash, role, pregunta_seguridad, respuesta_seguridad)
     VALUES (?, ?, ?, ?, ?)`
  );
  const createUsers = db.transaction(() => {
    const created = [];
    for (const user of users) {
      const salt = bcrypt.genSaltSync(10);
      insertUser.run(
        user.username,
        bcrypt.hashSync(user.password, salt),
        user.role,
        SECURITY_QUESTION,
        bcrypt.hashSync(securityAnswer.trim().toLowerCase(), salt)
      );
      created.push(user.username);
    }
    return created;
  });

  const created = createUsers();
  if (created.length) console.log(`[Usuarios] Cuentas iniciales creadas: ${created.join(', ')}`);
}

module.exports = bootstrapUsers;