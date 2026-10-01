import React, { createContext, useState, useEffect } from 'react';
import { readSession, writeSession, clearSession, getRememberChoice } from '../utils/sessionStore';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sesion = readSession();
    if (sesion) {
      setUser(sesion);
    }
    setLoading(false);

    // Sincronizar logout entre pestañas: si otra pestaña borra el token, cerrar sesión aquí también
    const handleStorage = (e) => {
      if (e.key === 'rxccdx_token' && !e.newValue) {
        setUser(null);
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
    setUser({ token: data.token, role: data.role, username: data.username, id: data.id ?? null });
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
