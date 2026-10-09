import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import RegisterUser from './components/RegisterUser';
import RecoverPassword from './components/RecoverPassword';
import AppErrorBoundary from './components/AppErrorBoundary';
import { lazyConReintento } from './utils/lazyConReintento';

// Vistas pesadas: cada una se descarga solo al entrar a su ruta.
// En móviles con red lenta esto recorta el primer pintado a menos de la mitad.
const Dashboard = lazyConReintento(() => import('./components/Dashboard'));
const RadiologistView = lazyConReintento(() => import('./components/RadiologistView'));
const SuperAdminPanel = lazyConReintento(() => import('./components/SuperAdminPanel'));

const CargandoVista = () => (
  <div className="loading-screen">
    <div className="spinner" />
    <p>Cargando pantalla…</p>
  </div>
);

function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <BrowserRouter>
          <Suspense fallback={<CargandoVista />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <RegisterUser />
              </ProtectedRoute>
            } />
            <Route path="/recover" element={<RecoverPassword />} />
            
            <Route path="/dashboard" element={
              <ProtectedRoute allowedRoles={['ENCARGADO', 'SUPER_ADMIN']}>
                <Dashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/radiologo" element={
              <ProtectedRoute allowedRoles={['RADIOLOGO', 'SUPER_ADMIN']}>
                <RadiologistView />
              </ProtectedRoute>
            } />

            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <SuperAdminPanel />
              </ProtectedRoute>
            } />
            
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
          </Suspense>
          </BrowserRouter>
        </NotificationProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}

export default App;
