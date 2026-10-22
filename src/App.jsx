import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import PrivateRoute from './components/PrivateRoute';
import Dashboard from './pages/Dashboard';

function App() {
  // Persistir la autenticación en localStorage para que no se cierre sesión al recargar
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('gpc_auth') === 'true';
  });

  // Guardar en localStorage cada vez que cambie
  useEffect(() => {
    if (isAuthenticated) {
      localStorage.setItem('gpc_auth', 'true');
    } else {
      localStorage.removeItem('gpc_auth');
    }
  }, [isAuthenticated]);

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/login" 
          element={<Login onLogin={setIsAuthenticated} />} 
        />
        
        <Route 
          path="/dashboard" 
          element={
            <PrivateRoute isAuthenticated={isAuthenticated}>
              <Dashboard onLogout={() => { localStorage.removeItem('gpc_user'); setIsAuthenticated(false); }} />
            </PrivateRoute>
          } 
        />
        
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
