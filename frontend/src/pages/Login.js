import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.message);
    }

    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
            <i className="fas fa-box-open" style={{ color: 'white' }}></i>
          </div>
          <h1 style={{ margin: 0 }}>Bienvenido</h1>
        </div>
        <p className="login-subtitle">Ingresa a tu cuenta del Sistema de Inventario</p>

        <div className="login-card-body">
          {error && (
            <div className="alert alert-danger alert-dismissible fade show" role="alert">
              <i className="fas fa-exclamation-triangle mr-2"></i>
              {error}
              <button type="button" className="close" onClick={() => setError('')}>
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label text-muted" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                Correo o Nombre de Usuario
              </label>
              <div className="input-group">
                <span className="input-group-text">
                  <i className="fas fa-user text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="admin@repuestos.com o Juan Pérez"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label text-muted" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                Contraseña
              </label>
              <div className="input-group">
                <span className="input-group-text">
                  <i className="fas fa-lock text-muted"></i>
                </span>
                <input
                  type="password"
                  className="form-control"
                  placeholder="admin123"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg w-100 mb-3" disabled={loading}>
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Iniciando Sesión...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
