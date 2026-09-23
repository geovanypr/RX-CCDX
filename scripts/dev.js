const { spawn } = require('node:child_process');
const http = require('node:http');

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];

function start(label, args) {
  const env = { ...process.env };
  if (label === 'server') env.PORT = process.env.PORT || '3002';
  const child = spawn(npmCommand, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });
  children.push(child);
  child.on('exit', (code, signal) => {
    if (code && code !== 0) console.error(`[${label}] finalizó con código ${code}`);
    if (signal) console.log(`[${label}] finalizó por señal ${signal}`);
  });
  return child;
}

function isRunning(url) {
  return new Promise(resolve => {
    const request = http.get(url, response => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 500);
    });
    request.setTimeout(800, () => { request.destroy(); resolve(false); });
    request.on('error', () => resolve(false));
  });
}

console.log('\nRX CCDX en desarrollo');
console.log('Frontend: http://localhost:5173/ (o el puerto alternativo que indique Vite)');
console.log('Backend:  http://localhost:3002');
console.log('Presiona Ctrl+C para detener ambos servicios.\n');

async function main() {
  const [serverRunning, clientRunning] = await Promise.all([
    isRunning('http://localhost:3002/api/health'),
    isRunning('http://localhost:5173/'),
  ]);

  if (serverRunning) console.log('[server] API ya activa en http://localhost:3002');
  else start('server', ['--prefix', 'server', 'start']);

  if (clientRunning) console.log('[client] Frontend ya activo en http://localhost:5173/');
  else start('client', ['--prefix', 'client', 'run', 'dev']);
}

main().catch(error => {
  console.error('[dev] No se pudo iniciar el proyecto:', error.message);
  process.exitCode = 1;
});

function stop() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
}

process.on('SIGINT', () => { stop(); process.exit(0); });
process.on('SIGTERM', () => { stop(); process.exit(0); });
