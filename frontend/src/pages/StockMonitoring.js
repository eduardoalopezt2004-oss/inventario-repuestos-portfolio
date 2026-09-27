import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import axios from '../services/api';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { cacheMonitoring, getCachedMonitoring } from '../utils/offlineQueue';

const StockMonitoring = () => {
  const { isOnline, lastSyncAt } = useOnlineStatus();
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { cargarDatosMonitoreo(); }, [refreshKey]);
  useEffect(() => { if (lastSyncAt) cargarDatosMonitoreo(); }, [lastSyncAt]);

  const cargarDatosMonitoreo = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/monitoring/kpis');
      setKpis(response.data);
      cacheMonitoring(response.data);
    } catch {
      const cached = getCachedMonitoring();
      if (cached) {
        setKpis(cached);
        toast.info('Mostrando datos de monitoreo en caché (sin conexión)');
      } else {
        toast.error('Error al cargar los datos de monitoreo');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (!isOnline) { toast.warning('Sin conexión. Mostrando datos en caché.'); return; }
    setRefreshKey(prev => prev + 1);
    toast.info('Actualizando datos...');
  };

  if (loading) {
    return (
      <div className="content-wrapper">
        <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="sr-only">Cargando...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!kpis) {
    return (
      <div className="content-wrapper">
        <div className="alert alert-warning">No se pudieron cargar los datos de monitoreo.</div>
      </div>
    );
  }

  const { estadoStockLocal: loc, estadoStockDeposito: dep } = kpis;

  const StockBar = ({ label, icon, count, total, colorClass, barStyle }) => {
    const pct = total > 0 ? (count / total) * 100 : 0;
    return (
      <div className="progress-group">
        <span className="float-right"><b>{count}</b>/{total}</span>
        <span className="progress-text">
          <i className={`fas fa-${icon} mr-2`}></i>{label}
        </span>
        <div className="progress progress-sm">
          <div className={`progress-bar ${colorClass}`} style={{ width: `${pct}%`, ...(barStyle || {}) }}></div>
        </div>
      </div>
    );
  };

  const AlertasCard = ({ alertas, titulo }) => {
    if (!alertas || alertas.length === 0) return null;
    return (
      <div className="card card-danger">
        <div className="card-header">
          <h3 className="card-title">
            <i className="fas fa-bell mr-2"></i>{titulo} ({alertas.length})
          </h3>
        </div>
        <div className="card-body">
          <div className="row">
            {alertas.map((alerta, i) => (
              <div key={i} className="col-lg-6 col-12">
                <div
                  className={`alert ${alerta.tipo === 'SIN_STOCK' ? 'alert-danger' : ''}`}
                  style={alerta.tipo === 'CRITICO' ? { backgroundColor: '#fff3e0', borderColor: '#fd7e14', color: '#7a3e00' } : {}}
                >
                  <h5>
                    <i className={`icon fas fa-${alerta.tipo === 'CRITICO' ? 'exclamation-circle' : 'times-circle'}`}></i>
                    {alerta.producto.nombre}
                  </h5>
                  <p className="mb-0">
                    {alerta.mensaje}
                    <br />
                    <small>Código: {alerta.producto.codigo} | Stock mínimo: {alerta.producto.stockMinimo}</small>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="content-wrapper">
      <section className="content-header">
        <div className="container-fluid">
          <div className="row mb-2">
            <div className="col-sm-6">
              <h1>
                <i className="fas fa-chart-line mr-2"></i>
                Monitoreo de Stock
              </h1>
            </div>
            <div className="col-sm-6 text-right">
              <button className="btn btn-primary" onClick={handleRefresh}>
                <i className="fas fa-sync-alt mr-2"></i>Actualizar
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="content">
        <div className="container-fluid">

          {/* ── KPIs generales ─────────────────────────────────────────────── */}
          <div className="row">
            <div className="col-lg-3 col-6">
              <div className="small-box bg-info">
                <div className="inner">
                  <h3>{kpis.kpis.rotacionInventario}</h3>
                  <p>Rotación de Inventario</p>
                  <small>Últimos 30 días</small>
                </div>
                <div className="icon"><i className="fas fa-sync-alt"></i></div>
              </div>
            </div>
            <div className="col-lg-3 col-6">
              <div className="small-box bg-success">
                <div className="inner">
                  <h3>${parseFloat(kpis.kpis.valorInventario).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</h3>
                  <p>Valor Total del Inventario</p>
                  <small>Local + Depósito</small>
                </div>
                <div className="icon"><i className="fas fa-dollar-sign"></i></div>
              </div>
            </div>
            <div className="col-lg-3 col-6">
              <div className="small-box bg-warning">
                <div className="inner">
                  <h3>{kpis.kpis.diasInventarioDisponible}</h3>
                  <p>Días de Inventario</p>
                  <small>Disponibilidad estimada</small>
                </div>
                <div className="icon"><i className="fas fa-calendar-alt"></i></div>
              </div>
            </div>
            <div className="col-lg-3 col-6">
              <div className="small-box bg-primary">
                <div className="inner">
                  <h3>{kpis.kpis.movimientosHoy}</h3>
                  <p>Movimientos Hoy</p>
                  <small>↑ {kpis.kpis.entradasHoy} entradas · ↓ {kpis.kpis.salidasHoy} salidas</small>
                </div>
                <div className="icon"><i className="fas fa-exchange-alt"></i></div>
              </div>
            </div>
          </div>

          {/* ── Dos secciones de estado de stock ───────────────────────────── */}
          <div className="row">

            {/* Stock LOCAL */}
            <div className="col-lg-6">
              <div className="card">
                <div className="card-header bg-gradient-primary">
                  <h3 className="card-title text-white">
                    <i className="fas fa-store mr-2"></i>Stock Local
                  </h3>
                  <div className="card-tools">
                    <span className="badge badge-light">
                      Desabastecimiento: {kpis.kpis.tasaDesabastecimientoLocal}%
                    </span>
                  </div>
                </div>
                <div className="card-body">
                  <StockBar label="Normal"    icon="check-circle"        count={loc.stockNormal}  total={loc.total} colorClass="bg-success" />
                  <StockBar label="Bajo"      icon="exclamation-triangle" count={loc.stockBajo}    total={loc.total} colorClass="bg-warning" />
                  <StockBar label="Crítico"   icon="exclamation-circle"   count={loc.stockCritico} total={loc.total} colorClass="" barStyle={{ backgroundColor: '#fd7e14' }} />
                  <StockBar label="Sin stock" icon="times-circle"         count={loc.sinStock}     total={loc.total} colorClass="bg-danger" />
                </div>
              </div>
            </div>

            {/* Stock DEPÓSITO */}
            <div className="col-lg-6">
              <div className="card">
                <div className="card-header bg-gradient-info">
                  <h3 className="card-title text-white">
                    <i className="fas fa-warehouse mr-2"></i>Stock Depósito
                  </h3>
                  <div className="card-tools">
                    <span className="badge badge-light">
                      Desabastecimiento: {kpis.kpis.tasaDesabastecimientoDeposito}%
                    </span>
                  </div>
                </div>
                <div className="card-body">
                  <StockBar label="Normal"    icon="check-circle"        count={dep.stockNormal}  total={dep.total} colorClass="bg-success" />
                  <StockBar label="Bajo"      icon="exclamation-triangle" count={dep.stockBajo}    total={dep.total} colorClass="bg-warning" />
                  <StockBar label="Crítico"   icon="exclamation-circle"   count={dep.stockCritico} total={dep.total} colorClass="" barStyle={{ backgroundColor: '#fd7e14' }} />
                  <StockBar label="Sin stock" icon="times-circle"         count={dep.sinStock}     total={dep.total} colorClass="bg-danger" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Alertas LOCAL ───────────────────────────────────────────────── */}
          <AlertasCard alertas={kpis.alertasLocal}    titulo="Alertas — Stock Local"    />

          {/* ── Alertas DEPÓSITO ────────────────────────────────────────────── */}
          <AlertasCard alertas={kpis.alertasDeposito} titulo="Alertas — Stock Depósito" />

          {/* ── Top productos más vendidos ──────────────────────────────────── */}
          {kpis.topProductos && kpis.topProductos.length > 0 && (
            <div className="row">
              <div className="col-lg-6">
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">
                      <i className="fas fa-fire text-danger mr-2"></i>
                      Productos Más Vendidos (30 días)
                    </h3>
                  </div>
                  <div className="card-body p-0">
                    <table className="table table-striped">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th className="text-center">Unidades</th>
                          <th className="text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kpis.topProductos.filter(i => i.producto).map((item, idx) => (
                          <tr key={idx}>
                            <td>
                              <strong>{item.producto.nombre}</strong>
                              <br /><small className="text-muted">{item.producto.codigo}</small>
                            </td>
                            <td className="text-center">
                              <span className="badge badge-success">{item.cantidadVendida}</span>
                            </td>
                            <td className="text-right">
                              <strong>${item.valorVendido.toFixed(2)}</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Productos de lento movimiento */}
              <div className="col-lg-6">
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">
                      <i className="fas fa-hourglass-half text-warning mr-2"></i>
                      Productos de Lento Movimiento
                    </h3>
                  </div>
                  <div className="card-body p-0">
                    {kpis.productosLentoMovimiento && kpis.productosLentoMovimiento.length > 0 ? (
                      <table className="table table-striped">
                        <thead>
                          <tr>
                            <th>Producto</th>
                            <th className="text-center">Stock Total</th>
                            <th className="text-right">Valor Retenido</th>
                          </tr>
                        </thead>
                        <tbody>
                          {kpis.productosLentoMovimiento.map((item, idx) => (
                            <tr key={idx}>
                              <td>
                                <strong>{item.nombre}</strong>
                                <br /><small className="text-muted">{item.codigo}</small>
                              </td>
                              <td className="text-center">
                                <span className="badge badge-warning">{item.stock}</span>
                              </td>
                              <td className="text-right">
                                <strong>${item.valorRetenido}</strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="text-center py-4">
                        <i className="fas fa-check-circle fa-3x text-success mb-3"></i>
                        <p className="text-muted">No hay productos de lento movimiento</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Resumen por Categoría ───────────────────────────────────────── */}
          <div className="row">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">
                    <i className="fas fa-layer-group mr-2"></i>Resumen por Categoría
                  </h3>
                </div>
                <div className="card-body p-0">
                  <table className="table table-striped">
                    <thead>
                      <tr>
                        <th>Categoría</th>
                        <th className="text-center">Productos</th>
                        <th className="text-center">Stock Total</th>
                        <th className="text-right">Valor Inventario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kpis.distribucionCategoria.map((cat, idx) => (
                        <tr key={idx}>
                          <td><strong>{cat.categoria}</strong></td>
                          <td className="text-center">{cat.productos}</td>
                          <td className="text-center">
                            <span className="badge badge-primary">{cat.cantidad} unidades</span>
                          </td>
                          <td className="text-right">
                            <strong>${parseFloat(cat.valor).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-light">
                        <th>TOTAL</th>
                        <th className="text-center">{loc.total}</th>
                        <th className="text-center">
                          <strong>
                            {kpis.distribucionCategoria.reduce((s, c) => s + c.cantidad, 0)} unidades
                          </strong>
                        </th>
                        <th className="text-right">
                          <strong>
                            ${parseFloat(kpis.kpis.valorInventario).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                          </strong>
                        </th>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>
    </div>
  );
};

export default StockMonitoring;
