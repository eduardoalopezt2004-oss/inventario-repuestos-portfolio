import React, { useContext, useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { creditoAPI } from '../../services/api';
import PendingSyncModal from './PendingSyncModal';

const Navbar = ({ toggleSidebar }) => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { isOnline, isSyncing, pendingCount } = useOnlineStatus();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [creditAlertas, setCreditAlertas] = useState(0);
  const [showPendingModal, setShowPendingModal] = useState(false);

  useEffect(() => {
    const fetchAlertas = async () => {
      try {
        const res = await creditoAPI.getAlertas();
        setCreditAlertas((res.data.vencidos || 0) + (res.data.porVencer || 0));
      } catch {}
    };
    fetchAlertas();
    const interval = setInterval(fetchAlertas, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    setDropdownOpen(false);
    logout();
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
    <nav className="main-header navbar navbar-expand navbar-white navbar-light">
      {/* Left navbar links */}
      <ul className="navbar-nav">
        <li className="nav-item">
          <button
            className="nav-link"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem 1rem' }}
            onClick={toggleSidebar}
          >
            <i className="fas fa-bars"></i>
          </button>
        </li>
        <li className="nav-item d-none d-sm-inline-block ml-3">
          <h5 className="mb-0" style={{ fontWeight: 600, color: '#2D3748' }}>
            Lubrieduarcars
          </h5>
          <small style={{ color: '#718096', fontSize: '0.875rem' }}>
            Gestión de inventario y ventas
          </small>
        </li>
      </ul>

      {/* Right navbar links */}
      <ul className="navbar-nav ml-auto align-items-center">

        {/* Badge créditos vencidos / por vencer */}
        {creditAlertas > 0 && (
          <li className="nav-item mr-2">
            <Link to="/creditos" style={{ textDecoration: 'none' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: '#fef3c7', color: '#92400e', borderRadius: 20,
                padding: '3px 10px', fontSize: '0.75rem', fontWeight: 600
              }}>
                <i className="fas fa-hand-holding-usd" style={{ fontSize: '0.7rem' }}></i>
                {creditAlertas} crédito{creditAlertas > 1 ? 's' : ''}
              </span>
            </Link>
          </li>
        )}

        {/* Indicador offline / sincronizando */}
        {(!isOnline || pendingCount > 0) && (
          <li className="nav-item mr-2">
            {!isOnline ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: '#fee2e2', color: '#b91c1c', borderRadius: 20,
                padding: '3px 10px', fontSize: '0.75rem', fontWeight: 600
              }}>
                <i className="fas fa-wifi-slash" style={{ fontSize: '0.7rem' }}></i>
                Sin conexión
                {pendingCount > 0 && <span style={{ background: '#b91c1c', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: '0.7rem' }}>{pendingCount}</span>}
              </span>
            ) : isSyncing ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: '#fef3c7', color: '#92400e', borderRadius: 20,
                padding: '3px 10px', fontSize: '0.75rem', fontWeight: 600
              }}>
                <i className="fas fa-sync fa-spin" style={{ fontSize: '0.7rem' }}></i>
                Sincronizando...
              </span>
            ) : pendingCount > 0 ? (
              <button
                onClick={() => setShowPendingModal(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: '#fef3c7', color: '#92400e', borderRadius: 20,
                  padding: '3px 10px', fontSize: '0.75rem', fontWeight: 600,
                  border: 'none', cursor: 'pointer'
                }}
              >
                <i className="fas fa-clock" style={{ fontSize: '0.7rem' }}></i>
                {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
              </button>
            ) : null}
          </li>
        )}

        {/* Current Date/Time */}
        <li className="nav-item d-none d-md-block mr-3">
          <span style={{ color: '#64748b', fontSize: '0.813rem', fontWeight: 500 }}>
            <i className="far fa-calendar-alt mr-2" style={{ fontSize: '0.875rem' }}></i>
            {new Date().toLocaleDateString('es-ES', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </span>
        </li>

        {/* User Dropdown */}
        <li className="nav-item" ref={dropdownRef} style={{ position: 'relative' }}>
          <a
            className="nav-link user-dropdown"
            href="#"
            style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}
            onClick={(e) => { e.preventDefault(); setDropdownOpen(!dropdownOpen); }}
          >
            <div className="user-avatar">
              {getInitials(user?.nombre)}
            </div>
            <div className="user-info d-none d-md-flex">
              <span className="user-name">{user?.nombre || 'Usuario'}</span>
              <span className="user-role">{user?.rol === 'admin' ? 'Administrador' : 'Vendedor'}</span>
            </div>
            <i className={`fas fa-chevron-${dropdownOpen ? 'up' : 'down'} ml-2`} style={{ fontSize: '0.75rem', color: '#6B7B8D', transition: 'transform 0.2s' }}></i>
          </a>

          {dropdownOpen && (
            <div
              className="dropdown-menu dropdown-menu-right show"
              style={{ minWidth: '250px', position: 'absolute', right: 0, top: '100%', zIndex: 1000 }}
            >
              <div className="dropdown-header" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="user-avatar" style={{ width: '48px', height: '48px', fontSize: '1.125rem' }}>
                    {getInitials(user?.nombre)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.938rem' }}>{user?.nombre}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{user?.email}</div>
                    <span className="badge badge-primary mt-1" style={{ fontSize: '0.688rem', padding: '0.25rem 0.5rem' }}>
                      {user?.rol === 'admin' ? 'Administrador' : 'Vendedor'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="dropdown-divider"></div>
              <a
                href="#"
                className="dropdown-item"
                style={{ padding: '0.625rem 1rem', color: '#D65656' }}
                onClick={(e) => { e.preventDefault(); handleLogout(); }}
              >
                <i className="fas fa-sign-out-alt mr-2" style={{ width: '20px', fontSize: '0.875rem' }}></i>
                <span style={{ fontSize: '0.875rem' }}>Cerrar Sesión</span>
              </a>
            </div>
          )}
        </li>
      </ul>
    </nav>
    <PendingSyncModal show={showPendingModal} onHide={() => setShowPendingModal(false)} />
    </>
  );
};

export default Navbar;
