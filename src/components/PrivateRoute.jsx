import React from 'react';
import { Navigate } from 'react-router-dom';

// Este componente acta como un "guardaespaldas"
const PrivateRoute = ({ isAuthenticated, children }) => {
  if (!isAuthenticated) {
    // Si alguien intenta entrar sin estar logueado, lo devolvemos a la pantalla de login
    return <Navigate to="/login" replace />;
  }
  // Si est logueado, le permitimos ver el componente "hijo" (en nuestro caso, el Dashboard)
  return children;
};

export default PrivateRoute;
