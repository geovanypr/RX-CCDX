import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import RegisterUser from './components/RegisterUser';
import RecoverPassword from './components/RecoverPassword';
import Dashboard from './components/Dashboard';
import RadiologistView from './components/RadiologistView';
import AppErrorBoundary from './components/AppErrorBoundary';

function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <BrowserRouter>
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
            
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
          </BrowserRouter>
        </NotificationProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}

export default App;
