import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import GlobalScanPopup from '../GlobalScanPopup';
import api from '../../services/api';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import {
  cacheProductos, cacheSales, cacheSaleMax,
  cacheCategories, cacheMovements, cacheDashboard
} from '../../utils/offlineQueue';

const preloadAll = async () => {
  try {
    const [prods, sales, cats, movs, stats] = await Promise.all([
      api.get('/products', { params: { activo: true } }),
      api.get('/sales', { params: { limit: 500 } }),
      api.get('/categories'),
      api.get('/inventory/movimientos', { params: { limit: 1000 } }),
      api.get('/dashboard/stats')
    ]);
    const prodsData = Array.isArray(prods.data) ? prods.data : [];
    const salesData = Array.isArray(sales.data) ? sales.data : [];
    const catsData  = Array.isArray(cats.data)  ? cats.data  : (cats.data?.categories || []);
    const movsData  = movs.data?.movimientos || [];
    cacheProductos(prodsData);
    cacheSales(salesData);
    cacheSaleMax(salesData);
    cacheCategories(catsData);
    cacheMovements(movsData);
    cacheDashboard(stats.data);
  } catch {}
};

const MainLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 992);
  const { lastSyncAt } = useOnlineStatus();

  useEffect(() => {
    preloadAll();
  }, []);

  useEffect(() => {
    if (lastSyncAt) preloadAll();
  }, [lastSyncAt]);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 992;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(false);
    };
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Sync body.sidebar-open so AdminLTE CSS shows the aside on mobile
  useEffect(() => {
    if (isMobile) {
      document.body.classList.toggle('sidebar-open', sidebarOpen);
    } else {
      document.body.classList.remove('sidebar-open');
    }
    return () => document.body.classList.remove('sidebar-open');
  }, [sidebarOpen, isMobile]);

  const toggleSidebar = () => setSidebarOpen(prev => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  // Desktop: sidebar-collapse oculta el sidebar cuando sidebarOpen=true
  // Mobile: content siempre ocupa 100% del ancho, sidebar es overlay
  const wrapperClass = isMobile
    ? 'wrapper'
    : `wrapper ${sidebarOpen ? 'sidebar-collapse' : ''}`;

  return (
    <div className={wrapperClass}>
      <Navbar toggleSidebar={toggleSidebar} />

      {/* Sidebar: overlay en móvil, normal en desktop */}
      <div
        style={isMobile ? {
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          zIndex: 1050,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-250px)',
          transition: 'transform 0.3s ease',
          overflowY: 'auto',
          width: '250px',
          pointerEvents: sidebarOpen ? 'auto' : 'none',
        } : {}}
      >
        <Sidebar onLinkClick={isMobile ? closeSidebar : undefined} onClose={closeSidebar} isMobile={isMobile} />
      </div>

      {/* Backdrop oscuro en móvil — siempre montado, transición de opacidad */}
      {isMobile && (
        <div
          onClick={sidebarOpen ? closeSidebar : undefined}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1040,
            opacity: sidebarOpen ? 1 : 0,
            pointerEvents: sidebarOpen ? 'auto' : 'none',
            transition: 'opacity 0.3s ease',
          }}
        />
      )}

      <div
        className="content-wrapper"
        style={isMobile ? { marginLeft: 0 } : {}}
      >
        {children}
      </div>

      <footer
        className="main-footer"
        style={isMobile ? { marginLeft: 0 } : {}}
      >
        <strong>Copyright &copy; 2025 Lubrieduarcars.</strong>
        <div className="float-right d-none d-sm-inline-block">
          <b>Version</b> 1.0.0
        </div>
      </footer>

      <GlobalScanPopup />
    </div>
  );
};

export default MainLayout;
