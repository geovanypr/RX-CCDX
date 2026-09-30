// Cron Job de Vercel para mantener activo el backend en Render (plan Free).
// Vercel invoca GET /api/keep-alive según el `schedule` definido en vercel.json.
// Esta función hace ping a https://rx-ccdx.onrender.com/api/health para
// evitar que Render suspenda el servicio por inactividad (15 min).
//
// Docs: https://vercel.com/docs/cron-jobs

const RENDER_URL = process.env.RENDER_PING_URL || 'https://rx-ccdx.onrender.com/api/health';
const TIMEOUT_MS = 25000;

export default async function handler(req, res) {
  // Solo permitir GET (Vercel Cron siempre usa GET)
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  // Seguridad opcional: si defines CRON_SECRET en Vercel, se valida el header.
  // Vercel envía `Authorization: Bearer <CRON_SECRET>` automáticamente cuando
  // el secreto está configurado en el proyecto.
  // Si no hay secreto configurado, la ruta queda abierta (solo hace un ping).
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${expectedSecret}`) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const upstream = await fetch(RENDER_URL, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'vercel-cron-keepalive/1.0' },
    });
    const latencyMs = Date.now() - startedAt;
    const body = await upstream.text().catch(() => '');

    console.log(
      `[keep-alive] ping ${RENDER_URL} -> ${upstream.status} en ${latencyMs}ms`
    );

    return res.status(200).json({
      ok: upstream.ok,
      renderStatus: upstream.status,
      latencyMs,
      target: RENDER_URL,
      timestamp: new Date().toISOString(),
      detail: body.slice(0, 500),
    });
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    console.error(`[keep-alive] fallo ping a ${RENDER_URL}:`, err?.message || err);
    // Responder 200 con ok:false para no reintentar agresivamente,
    // pero dejar constancia del fallo en los logs de Vercel.
    return res.status(200).json({
      ok: false,
      target: RENDER_URL,
      latencyMs,
      timestamp: new Date().toISOString(),
      error: err?.name === 'AbortError' ? 'Timeout' : String(err?.message || err),
    });
  } finally {
    clearTimeout(timer);
  }
}
