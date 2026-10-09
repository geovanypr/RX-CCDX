import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './responsive.css'
import App from './App.jsx'
import { instalarInterceptorSesion } from './utils/apiClient'
import { readSession } from './utils/sessionStore'

// Manejo centralizado del token y de las sesiones expiradas
instalarInterceptorSesion()

// ── Aplicar tema antes del primer render para evitar flash ──────────────────
// Lee el userId guardado y busca su preferencia de tema.
// Solo activa dark si el usuario lo eligió explícitamente.
// El modo claro es el default si no hay preferencia.
;(function applyThemeEarly() {
  try {
    const userId = readSession()?.id || 'guest'
    const theme = localStorage.getItem(`rxccdx_theme_${userId}`)
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      // Modo claro por defecto — asegurar que no haya clase dark residual
      document.documentElement.classList.remove('dark')
    }
  } catch {
    // localStorage no disponible (SSR, incógnito restringido) — modo claro
    document.documentElement.classList.remove('dark')
  }
})()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Service Worker: solo en producción y sin romper nada si falla.
// Cachea el shell estático (JS/CSS/logo) para aperturas instantáneas en móvil.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
