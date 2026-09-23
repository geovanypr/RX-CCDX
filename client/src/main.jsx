import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { instalarInterceptorSesion } from './utils/apiClient'

// Manejo centralizado del token y de las sesiones expiradas
instalarInterceptorSesion()

// ── Aplicar tema antes del primer render para evitar flash ──────────────────
// Lee el userId guardado y busca su preferencia de tema.
// Solo activa dark si el usuario lo eligió explícitamente.
// El modo claro es el default si no hay preferencia.
;(function applyThemeEarly() {
  try {
    const userId = localStorage.getItem('rxccdx_id') || 'guest'
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
