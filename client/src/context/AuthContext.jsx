import React, { createContext, useState, useEffect } from 'react';
import { readSession, writeSession, clearSession, getRememberChoice } from '../utils/sessionStore';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sesion = readSession();
    if (sesion) {
      const normalizedRole = sesion.role ? sesion.role.toUpperCase().replace('ENCARGADA', 'ENCARGADO') : '';
      setUser({ ...sesion, role: normalizedRole });
    }
    setLoading(false);

    // Sincronizar sesión entre pestañas: si otra pestaña borra o actualiza
    // el token, reflejar el cambio aquí también.
    const handleStorage = (e) => {
      if (e.key === 'rxccdx_token') {
        if (!e.newValue) {
          // Otra pestaña cerró sesión
          setUser(null);
        } else if (e.newValue !== e.oldValue) {
          // Otra pestaña actualizó la sesión (p. ej. cambio de credenciales):
          // re-leer la sesión completa del storage para no quedarnos con datos viejos.
          const sesionActualizada = readSession();
          if (sesionActualizada) setUser(sesionActualizada);
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // remember === undefined → conserva la elección actual (p. ej. al
  // actualizar la sesión tras cambiar credenciales).
  const login = (data, remember) => {
    const recordar = remember === undefined ? getRememberChoice() : !!remember;
    writeSession(data, recordar);
    const normalizedRole = data.role ? data.role.toUpperCase().replace('ENCARGADA', 'ENCARGADO') : '';
    setUser({ token: data.token, role: normalizedRole, username: data.username, id: data.id ?? null });
  };

  const logout = () => {
    clearSession();
    setUser(null);
    // Sincronizar logout entre pestañas del navegador
    window.dispatchEvent(new StorageEvent('storage', { key: 'rxccdx_token', newValue: null }));
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
