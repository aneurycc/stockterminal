import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Eye, EyeOff, Moon, Sun } from 'lucide-react';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Estado Modo Oscuro
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('gpc_theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.body.setAttribute('data-theme', 'dark');
      localStorage.setItem('gpc_theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
      localStorage.setItem('gpc_theme', 'light');
    }
  }, [isDarkMode]);

  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    if (username === 'gerente' && password === 'admin123') {
      localStorage.setItem('gpc_user', username);
      onLogin(true);
      navigate('/dashboard'); 
    } else {
      alert('Credenciales incorrectas.');
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      position: 'relative'
    }}>
      {/* Imagen de fondo con Blur */}
      <div style={{
        position: 'fixed',
        top: '-10px', left: '-10px', right: '-10px', bottom: '-10px',
        backgroundImage: 'url("/terminal-bg.jpg")',
        backgroundPosition: 'center',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        filter: 'blur(4px)',
        zIndex: 0
      }}></div>
      
      {/* Overlay oscuro para que el texto resalte */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        zIndex: 1
      }}></div>

      {/* Top Nav Corporativa */}
      <nav className="top-nav" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1000 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/logo-app.png" alt="Logo" style={{ height: '48px', objectFit: 'contain' }} />
          <h2 style={{ margin: 0, color: 'var(--q-accent)', fontWeight: 900 }}>Stock <span style={{ color: 'var(--text-main)', fontWeight: 300 }}>Terminal</span></h2>
        </div>
        
        <button onClick={() => setIsDarkMode(!isDarkMode)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--q-dark)', display: 'flex', alignItems: 'center' }} title="Alternar Modo Oscuro">
          {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
        </button>
      </nav>

      <div style={{ 
        flex: 1, 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        paddingTop: '80px', 
        paddingBottom: '60px', 
        boxSizing: 'border-box',
        position: 'relative', 
        zIndex: 2 
      }}>
        
        {/* Tarjeta Central */}
        <div className="material-card login-card">
          <h2 style={{ color: 'var(--q-dark)', marginBottom: '30px', fontWeight: '400' }}>Portal Operativo</h2>
          
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* Input Usuario ID */}
            <div className="material-input-group" style={{ display: 'flex', alignItems: 'center' }}>
              <User color="var(--text-muted)" size={20} style={{ marginLeft: '16px' }} />
              <input 
                type="text" 
                placeholder="Usuario ID" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            {/* Input Contraseña */}
            <div className="material-input-group" style={{ display: 'flex', alignItems: 'center' }}>
              <Lock color="var(--text-muted)" size={20} style={{ marginLeft: '16px' }} />
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="Contraseña" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '16px' }}
              >
                {showPassword ? <EyeOff color="var(--text-muted)" size={20} /> : <Eye color="var(--text-muted)" size={20} />}
              </button>
            </div>

            <button type="submit" className="btn-primary" style={{ padding: '14px', fontSize: '16px', marginTop: '10px' }}>
              AUTENTICAR
            </button>
          </form>
        </div>

      </div>

      {/* Footer Fijo */}
      <footer className="footer" style={{ zIndex: 2, backgroundColor: 'var(--nav-bg)' }}>
        © 2026 Grupo Puntacana. Sistema de Inventario Terminales.
      </footer>
    </div>
  );
};

export default Login;
