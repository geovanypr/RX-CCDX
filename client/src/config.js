// Central configuration — all components must import API_URL from here
const API_URL_PRODUCCION = 'https://rx-ccdx-page.onrender.com';
export const API_URL = import.meta.env.VITE_API_URL || (
  import.meta.env.DEV ? 'http://localhost:3002' : API_URL_PRODUCCION
);

// Browser media tags cannot attach Authorization headers. The server accepts this
// short-lived session token only for authenticated private files and disables
// referrers/caching on those responses.
export const authenticatedFileUrl = (filePath, token) =>
  `${API_URL}${filePath}${filePath.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;

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
