/* RX CCDX — Service Worker mínimo y seguro.
 *
 * Solo cachea recursos estáticos INMUTABLES (hash en el nombre):
 *   /assets/*, /logo.png, /favicon.ico, /manifest.webmanifest
 * NUNCA cachea index.html, la API ni vistas con token: esas siempre van a red.
 * Así las visitas repetidas en móvil abren al instante incluso con red pobre,
 * y un redeploy jamás deja la app atascada en una versión vieja.
 */
const CACHE = 'rxccdx-static-v1';
const ESTATICOS = [/^\/assets\//, /^\/logo\.png$/, /^\/favicon\.ico$/, /^\/manifest\.webmanifest$/];

self.addEventListener('install', () => {
  // No precacheamos nada: la caché se llena sola con lo que se usa.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  // Solo mismo origen y solo estáticos versionados.
  if (url.origin !== self.location.origin) return;
  if (!ESTATICOS.some((re) => re.test(url.pathname))) return;
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(request).then((hit) => {
        // Stale-while-revalidate: responde al instante y actualiza en fondo.
        const fondo = fetch(request).then((res) => {
          if (res && res.ok) cache.put(request, res.clone());
          return res;
        }).catch(() => hit);
        return hit || fondo;
      })
    )
  );
});
