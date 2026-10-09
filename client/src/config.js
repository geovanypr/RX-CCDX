// Central configuration — all components must import API_URL from here
const API_URL_PRODUCCION = 'https://rx-ccdx.onrender.com';
export const API_URL = import.meta.env.VITE_API_URL || (
  import.meta.env.DEV ? 'http://localhost:3002' : API_URL_PRODUCCION
);

// Browser media tags cannot attach Authorization headers. The server accepts this
// short-lived session token only for authenticated private files and disables
// referrers/caching on those responses.
export const authenticatedFileUrl = (filePath, token) =>
  `${API_URL}${filePath}${filePath.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;

// Miniatura liviana (~320px, ~15-40 KB) para listados y tiras en móvil.
// El servidor la genera con sharp y la cachea en disco (?thumb=1).
// El visor PACS, el lightbox y las descargas siguen usando la imagen completa.
export const thumbUrl = (filePath, token) =>
  authenticatedFileUrl(`${filePath}${filePath.includes('?') ? '&' : '?'}thumb=1`, token);

export async function downloadAuthenticatedFile(path, token, fallbackName = 'descarga.zip') {
  const url = authenticatedFileUrl(path, token);
  const link = document.createElement('a');
  link.href = url;
  if (fallbackName) {
    link.setAttribute('download', fallbackName);
  }
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    try { link.remove(); } catch {}
  }, 1000);
}
