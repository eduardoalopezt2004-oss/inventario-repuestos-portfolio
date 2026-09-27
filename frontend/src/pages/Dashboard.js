import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardAPI } from '../services/api';
import { toast } from 'react-toastify';
import StockCharts from '../components/Dashboard/StockCharts';
import { cacheDashboard, computeStatsFromCache } from '../utils/offlineQueue';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await dashboardAPI.getStats();
      setStats(response.data);
      cacheDashboard(response.data);
    } catch {
      const local = computeStatsFromCache();
      setStats(local);
      toast.info('Sin conexión — estadísticas calculadas desde datos locales');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="sr-only">Cargando...</span>
        </div>
      </div>
    );
  }

  const stockBajoTotal = (stats?.productosStockBajo || 0) + (stats?.productosDepositoBajo || 0);

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="content-header">
        <div className="container-fluid">
          <div className="row mb-2">
            <div className="col-sm-6">
              <h1 className="m-0">Inicio</h1>
            </div>
            <div className="col-sm-6 text-right">
              <button
                className="btn btn-sm btn-primary"
                onClick={fetchStats}
                disabled={loading}
                title="Actualizar estadísticas"
              >
                <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''} mr-1`}></i>
                Actualizar
              </button>
            </div>
          </div>
        </div>
      </div>

      <section className="content">
        <div className="container-fluid">

          {/* ── KPI boxes ─────────────────────────────────────────────────── */}
          <div className="row">
            <div className="col-lg-3 col-6">
              <Link to="/ventas" style={{ textDecoration: 'none' }}>
                <div className="small-box bg-info" style={{ cursor: 'pointer' }}>
                  <div className="inner">
                    <h3>${stats?.ventasHoy?.total?.toLocaleString() || 0}</h3>
                    <p>Ventas Hoy</p>
                    <small>{stats?.ventasHoy?.cantidad || 0} transacciones</small>
                  </div>
                  <div className="icon"><i className="fas fa-shopping-cart"></i></div>
                  <div className="small-box-footer">Ver más <i className="fas fa-arrow-circle-right"></i></div>
                </div>
              </Link>
            </div>

            <div className="col-lg-3 col-6">
              <Link to="/reportes" style={{ textDecoration: 'none' }}>
                <div className="small-box bg-success" style={{ cursor: 'pointer' }}>
                  <div className="inner">
                    <h3>${stats?.ventasMes?.total?.toLocaleString() || 0}</h3>
                    <p>Ventas del Mes</p>
                    <small>{stats?.ventasMes?.cantidad || 0} transacciones</small>
                  </div>
                  <div className="icon"><i className="fas fa-chart-line"></i></div>
                  <div className="small-box-footer">Ver más <i className="fas fa-arrow-circle-right"></i></div>
                </div>
              </Link>
            </div>

            <div className="col-lg-3 col-6">
              <Link to="/inventario" style={{ textDecoration: 'none' }}>
                <div className="small-box bg-warning" style={{ cursor: 'pointer' }}>
                  <div className="inner">
                    <h3>{stats?.productosStockBajo || 0}</h3>
                    <p>Local bajo mínimo</p>
                    <small>Transferir del depósito</small>
                  </div>
                  <div className="icon"><i className="fas fa-store"></i></div>
                  <div className="small-box-footer">Ir a Transferencias <i className="fas fa-arrow-circle-right"></i></div>
                </div>
              </Link>
            </div>

            <div className="col-lg-3 col-6">
              <Link to="/stock" style={{ textDecoration: 'none' }}>
                <div className="small-box bg-danger" style={{ cursor: 'pointer' }}>
                  <div className="inner">
                    <h3 style={{ color: '#fff' }}>{stats?.productosDepositoBajo || 0}</h3>
                    <p>Depósito bajo mínimo</p>
                    <small>Reponer con proveedor</small>
                  </div>
                  <div className="icon"><i className="fas fa-warehouse"></i></div>
                  <div className="small-box-footer">Ver detalles <i className="fas fa-arrow-circle-right"></i></div>
                </div>
              </Link>
            </div>
          </div>

          {/* ── Acciones Rápidas ───────────────────────────────────────────── */}
          <div className="row mb-4">
            {[
              { to: '/ventas',    icon: 'fa-cash-register', label: 'Nueva Venta',    bg: '#28a745', badge: null },
              { to: '/categorias', icon: 'fa-box',          label: 'Productos',      bg: '#3B82C4', badge: null },
              { to: '/inventario?tab=transferencia', icon: 'fa-exchange-alt', label: 'Stock Bajo', bg: '#e0923c',
                badge: stockBajoTotal > 0 ? stockBajoTotal : null },
              { to: '/creditos',   icon: 'fa-hand-holding-usd', label: 'Créditos',  bg: '#8E6EC2', badge: null },
              { to: '/reportes',   icon: 'fa-chart-bar',    label: 'Reportes',      bg: '#17a2b8', badge: null },
              { to: '/stock',      icon: 'fa-boxes',        label: 'Monitoreo',     bg: '#6c757d', badge: null },
            ].map(({ to, icon, label, bg, badge }) => (
              <div key={to} className="col-4 col-sm-2 mb-2">
                <Link to={to} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: bg, borderRadius: '0.75rem',
                    padding: '0.85rem 0.5rem',
                    textAlign: 'center', position: 'relative',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    cursor: 'pointer'
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.22)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)';    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.18)'; }}
                  >
                    {badge !== null && (
                      <span style={{
                        position: 'absolute', top: '-6px', right: '-6px',
                        background: '#dc3545', color: '#fff',
                        borderRadius: '50%', width: '20px', height: '20px',
                        fontSize: '0.65rem', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>{badge}</span>
                    )}
                    <i className={`fas ${icon}`} style={{ fontSize: '1.5rem', color: '#fff', display: 'block', marginBottom: '0.35rem' }}></i>
                    <span style={{ color: '#fff', fontSize: '0.72rem', fontWeight: 600, lineHeight: 1.2 }}>{label}</span>
                  </div>
                </Link>
              </div>
            ))}
          </div>

          {/* ── Info boxes ────────────────────────────────────────────────── */}
          <div className="row">
            <div className="col-12 col-sm-6 col-md-4">
              <Link to="/categorias" style={{ textDecoration: 'none' }}>
                <div className="info-box" style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                  <span className="info-box-icon bg-info elevation-1"><i className="fas fa-dollar-sign"></i></span>
                  <div className="info-box-content">
                    <span className="info-box-text">Valor Inventario</span>
                    <span className="info-box-number">${stats?.valorInventario?.toLocaleString() || 0}</span>
                    <small className="text-muted">Click para ver productos</small>
                  </div>
                </div>
              </Link>
            </div>

            <div className="col-12 col-sm-6 col-md-4">
              <Link to="/reportes" style={{ textDecoration: 'none' }}>
                <div className="info-box mb-3" style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                  <span className="info-box-icon bg-success elevation-1"><i className="fas fa-calendar"></i></span>
                  <div className="info-box-content">
                    <span className="info-box-text">Ventas del Año</span>
                    <span className="info-box-number">${stats?.ventasAnio?.total?.toLocaleString() || 0}</span>
                    <small>{stats?.ventasAnio?.cantidad || 0} ventas</small>
                  </div>
                </div>
              </Link>
            </div>

            <div className="col-12 col-sm-6 col-md-4">
              <Link to="/ventas" style={{ textDecoration: 'none' }}>
                <div className="info-box mb-3" style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                  <span className="info-box-icon bg-warning elevation-1"><i className="fas fa-chart-line"></i></span>
                  <div className="info-box-content">
                    <span className="info-box-text">Promedio Diario</span>
                    <span className="info-box-number">${Math.round((stats?.ventasMes?.total || 0) / 30).toLocaleString()}</span>
                    <small>Últimos 30 días</small>
                  </div>
                </div>
              </Link>
            </div>
          </div>

          {/* ── Productos más vendidos ─────────────────────────────────────── */}
          {stats?.productosMasVendidos && stats.productosMasVendidos.length > 0 && (
            <div className="row">
              <div className="col-12">
                <div className="card">
                  <div className="card-header border-transparent">
                    <h3 className="card-title">
                      <i className="fas fa-trophy mr-2"></i>Productos Más Vendidos
                    </h3>
                    <div className="card-tools">
                      <Link to="/reportes" className="btn btn-sm btn-primary mr-2">
                        <i className="fas fa-chart-bar"></i> Ver Reporte
                      </Link>
                    </div>
                  </div>
                  <div className="card-body p-0">
                    <div className="table-responsive">
                      <table className="table m-0">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Producto</th>
                            <th>Código</th>
                            <th className="text-center">Unidades</th>
                            <th className="text-right">Ingresos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.productosMasVendidos.map((item, index) => (
                            <tr key={item._id}>
                              <td>
                                <span className={`badge ${index === 0 ? 'badge-warning' : index === 1 ? 'badge-secondary' : 'badge-light'}`}>
                                  #{index + 1}
                                </span>
                              </td>
                              <td>
                                <strong>{item.producto.nombre}</strong>
                                {item.producto.marca && <small className="text-muted d-block">{item.producto.marca}</small>}
                              </td>
                              <td><span className="badge badge-info">{item.producto.codigo}</span></td>
                              <td className="text-center"><span className="badge badge-success">{item.totalVendido}</span></td>
                              <td className="text-right">${item.ingresos.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="card-footer clearfix">
                    <Link to="/categorias" className="btn btn-sm btn-info float-left">Ver Productos</Link>
                    <Link to="/ventas" className="btn btn-sm btn-secondary float-right">Nueva Venta</Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Gráficas (tendencia + productos críticos) ──────────────────── */}
          <StockCharts />

        </div>
      </section>
    </div>
  );
};

export default Dashboard;
