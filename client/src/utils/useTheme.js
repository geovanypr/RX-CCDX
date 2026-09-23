import { useState, useEffect, useCallback } from 'react';

/** Clave de localStorage por usuario */
function storageKey(userId) {
  return `rxccdx_theme_${userId ?? 'guest'}`;
}

/** Lee el tema guardado para un userId. Default: 'light' */
function readTheme(userId) {
  try {
    return localStorage.getItem(storageKey(userId)) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** Aplica la clase dark al documento de forma síncrona */
function applyToDocument(theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

/**
 * Hook de tema claro/oscuro por usuario.
 *
 * @param {string|number|null} userId  ID del usuario (de AuthContext).
 *
 * Reglas:
 * - Modo claro es el default.
 * - Cada userId tiene su propia preferencia en localStorage.
 * - El Login llama enforceLightMode() y no usa este hook.
 */
export function useTheme(userId) {
  const [theme, setThemeState] = useState(() => readTheme(userId));

  // Cuando el userId cambia (cambio de sesión), leer la preferencia del nuevo usuario
  useEffect(() => {
    const t = readTheme(userId);
    setThemeState(t);
    applyToDocument(t);
  }, [userId]);

  // Aplicar al documento cuando el estado cambia
  useEffect(() => {
    applyToDocument(theme);
  }, [theme]);

  const setTheme = useCallback((value) => {
    try {
      localStorage.setItem(storageKey(userId), value);
    } catch { /* localStorage no disponible */ }
    setThemeState(value);
  }, [userId]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, toggleTheme, setTheme, isDark: theme === 'dark' };
}

/**
 * Quita la clase dark del documento sin tocar preferencias guardadas.
 * Usar en páginas que siempre deben verse en claro (Login).
 */
export function enforceLightMode() {
  document.documentElement.classList.remove('dark');
}
