import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('rxccdx_token');
    const role = localStorage.getItem('rxccdx_role');
    const username = localStorage.getItem('rxccdx_username');
    const rawId = localStorage.getItem('rxccdx_id');
    const id = rawId && rawId !== 'null' ? Number(rawId) : null;
    if (token && role) {
      setUser({ token, role, username, id: Number.isFinite(id) ? id : null });
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

  const login = (data) => {
    localStorage.setItem('rxccdx_token', data.token);
    localStorage.setItem('rxccdx_role', data.role);
    localStorage.setItem('rxccdx_username', data.username);
    // Solo guardar el ID si es un valor numérico válido
    if (data.id != null && Number.isFinite(Number(data.id))) {
      localStorage.setItem('rxccdx_id', String(data.id));
    } else {
      localStorage.removeItem('rxccdx_id');
    }
    setUser({ token: data.token, role: data.role, username: data.username, id: data.id ?? null });
  };

  const logout = () => {
    ['rxccdx_token', 'rxccdx_role', 'rxccdx_username', 'rxccdx_id'].forEach(k => localStorage.removeItem(k));
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
