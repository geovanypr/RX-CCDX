import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Cargando RX CCDX...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // SUPER_ADMIN tiene acceso a todo
  if (user.role === 'SUPER_ADMIN') {
    return children;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'RADIOLOGO') return <Navigate to="/radiologo" replace />;
    if (user.role === 'ENCARGADO') return <Navigate to="/dashboard" replace />;
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
