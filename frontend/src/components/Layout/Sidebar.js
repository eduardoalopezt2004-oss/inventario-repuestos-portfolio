import React, { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';

const Sidebar = ({ onLinkClick, onClose, isMobile }) => {
  const { user } = useContext(AuthContext);
  const location = useLocation();

  const isActive = (path) => location.pathname === path ? 'active' : '';

  const handleLink = () => {
    if (onLinkClick) onLinkClick();
  };

  return (
    <aside className="main-sidebar sidebar-dark-primary elevation-4" style={{ height: '100%', minHeight: '100vh' }}>
      {/* Brand Logo */}
      <Link to="/" className="brand-link" onClick={handleLink}>
        <div className="brand-image">
          <i className="fas fa-oil-can" style={{ color: '#7EB3DC', fontSize: '1.5rem' }}></i>
        </div>
        <span className="brand-text font-weight-bold">Lubrieduarcars</span>
        {/* Botón cerrar en móvil */}
        {isMobile && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose && onClose(); }}
            style={{
              marginLeft: 'auto',
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: '0.375rem',
              color: 'white',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <i className="fas fa-times"></i>
          </button>
        )}
      </Link>

      {/* Sidebar */}
      <div className="sidebar">
        <nav className="mt-3">
          <ul className="nav nav-pills nav-sidebar flex-column" role="menu">

            <li className="nav-item">
              <Link to="/" className={`nav-link ${isActive('/')}`} onClick={handleLink}>
                <i className="nav-icon fas fa-home"></i>
                <p>Inicio</p>
              </Link>
            </li>

            <li className="nav-item">
              <Link to="/categorias" className={`nav-link ${isActive('/categorias')}`} onClick={handleLink}>
                <i className="nav-icon fas fa-box"></i>
                <p>Productos</p>
              </Link>
            </li>

            <li className="nav-item">
              <Link to="/ventas" className={`nav-link ${isActive('/ventas')}`} onClick={handleLink}>
                <i className="nav-icon fas fa-cash-register"></i>
                <p>Ventas</p>
              </Link>
            </li>

            <li className="nav-item">
              <Link to="/inventario" className={`nav-link ${isActive('/inventario')}`} onClick={handleLink}>
                <i className="nav-icon fas fa-exchange-alt"></i>
                <p>Entradas y Salidas</p>
              </Link>
            </li>

            <li className="nav-item">
              <Link to="/stock" className={`nav-link ${isActive('/stock')}`} onClick={handleLink}>
                <i className="nav-icon fas fa-boxes"></i>
                <p>Monitoreo de Stock</p>
              </Link>
            </li>

            <li className="nav-item">
              <Link to="/creditos" className={`nav-link ${isActive('/creditos')}`} onClick={handleLink}>
                <i className="nav-icon fas fa-hand-holding-usd"></i>
                <p>Créditos</p>
              </Link>
            </li>

            <li className="nav-item">
              <Link to="/reportes" className={`nav-link ${isActive('/reportes')}`} onClick={handleLink}>
                <i className="nav-icon fas fa-chart-line"></i>
                <p>Reportes</p>
              </Link>
            </li>

            {user?.rol === 'admin' && (
              <>
                <li className="nav-header" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Administración</li>

                <li className="nav-item">
                  <Link to="/usuarios" className={`nav-link ${isActive('/usuarios')}`} onClick={handleLink}>
                    <i className="nav-icon fas fa-users-cog"></i>
                    <p>Gestión de Usuarios</p>
                  </Link>
                </li>

                <li className="nav-item">
                  <Link to="/historial-cambios" className={`nav-link ${isActive('/historial-cambios')}`} onClick={handleLink}>
                    <i className="nav-icon fas fa-history"></i>
                    <p>Historial de Cambios</p>
                  </Link>
                </li>

                <li className="nav-item">
                  <Link to="/importar" className={`nav-link ${isActive('/importar')}`} onClick={handleLink}>
                    <i className="nav-icon fas fa-file-import"></i>
                    <p>Importar Proveedor</p>
                  </Link>
                </li>

                <li className="nav-item">
                  <Link to="/exportar" className={`nav-link ${isActive('/exportar')}`} onClick={handleLink}>
                    <i className="nav-icon fas fa-sync-alt"></i>
                    <p>Exportar / Importar</p>
                  </Link>
                </li>
              </>
            )}

            <li className="nav-item mt-4" style={{ marginLeft: '0.75rem', marginRight: '0.75rem', pointerEvents: 'none' }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '0.875rem',
                borderRadius: '0.375rem',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '0.375rem',
                    background: 'rgba(255, 255, 255, 0.1)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', marginRight: '0.625rem'
                  }}>
                    <i className="fas fa-shield-alt" style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.75rem' }}></i>
                  </div>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600, fontSize: '0.813rem' }}>Sistema Activo</div>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.688rem' }}>Versión 1.0.0</div>
                  </div>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.625rem', marginTop: '0.5rem', lineHeight: 1.4 }}>
                  © 2025 Lubrieduarcars
                </div>
              </div>
            </li>

          </ul>
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;
