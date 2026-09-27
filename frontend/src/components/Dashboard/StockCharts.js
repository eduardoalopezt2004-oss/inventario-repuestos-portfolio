import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { dashboardAPI } from '../../services/api';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, Filler
);

const StockCharts = () => {
  const [stockTrend, setStockTrend] = useState(null);
  const [criticalProducts, setCriticalProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('30');
  const [chartType, setChartType] = useState('line');

  const fetchChartData = async () => {
    setLoading(true);
    try {
      const trendRes = await dashboardAPI.getStockTrend(periodo);
      setStockTrend(trendRes.data);
    } catch {}
    try {
      const criticalRes = await dashboardAPI.getCriticalProducts();
      setCriticalProducts(criticalRes.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchChartData(); }, [periodo]);

  const getTrendChartData = () => {
    if (!stockTrend || stockTrend.length === 0) return null;
    const labels = stockTrend.map(item =>
      new Date(item.fecha).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
    );
    return {
      labels,
      datasets: [
        {
          label: 'Entradas',
          data: stockTrend.map(item => item.entradas),
          borderColor: '#34A873',
          backgroundColor: chartType === 'bar' ? 'rgba(52,168,115,0.7)' : 'rgba(52,168,115,0.15)',
          tension: 0.3, fill: chartType === 'line'
        },
        {
          label: 'Salidas',
          data: stockTrend.map(item => item.salidas),
          borderColor: '#D65656',
          backgroundColor: chartType === 'bar' ? 'rgba(214,86,86,0.7)' : 'rgba(214,86,86,0.15)',
          tension: 0.3, fill: chartType === 'line'
        }
      ]
    };
  };

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'top' }, tooltip: { mode: 'index', intersect: false } },
    scales: { y: { beginAtZero: true } }
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="spinner-border text-primary" role="status">
          <span className="sr-only">Cargando gráficas...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Controles de período */}
      <div className="row mb-3">
        <div className="col-12 d-flex align-items-center gap-2">
          <span className="text-muted small mr-2">Período:</span>
          <div className="btn-group" role="group">
            {['7', '30', '90'].map(p => (
              <button key={p} type="button"
                className={`btn btn-sm ${periodo === p ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setPeriodo(p)}
              >{p} días</button>
            ))}
          </div>
          <div className="btn-group btn-group-sm ml-auto" role="group">
            <button type="button"
              className={`btn ${chartType === 'line' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setChartType('line')} title="Líneas">
              <i className="fas fa-chart-line"></i>
            </button>
            <button type="button"
              className={`btn ${chartType === 'bar' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setChartType('bar')} title="Barras">
              <i className="fas fa-chart-bar"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Gráfica de tendencia — ancho completo */}
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header border-0">
              <h3 className="card-title">
                <i className={`fas ${chartType === 'line' ? 'fa-chart-line' : 'fa-chart-bar'} mr-2`}></i>
                Movimiento de Stock — Últimos {periodo} días
              </h3>
            </div>
            <div className="card-body">
              <div style={{ height: '280px' }}>
                {getTrendChartData() ? (
                  chartType === 'line'
                    ? <Line data={getTrendChartData()} options={chartOptions} />
                    : <Bar  data={getTrendChartData()} options={chartOptions} />
                ) : (
                  <div className="text-center text-muted py-5">
                    <i className={`fas ${chartType === 'line' ? 'fa-chart-line' : 'fa-chart-bar'} fa-3x mb-3`}></i>
                    <p>No hay datos de movimientos en este período</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Productos Críticos */}
      {criticalProducts && criticalProducts.length > 0 && (
        <div className="row">
          <div className="col-12">
            <div className="card card-danger">
              <div className="card-header">
                <h3 className="card-title">
                  <i className="fas fa-exclamation-triangle mr-2"></i>
                  Productos Críticos
                </h3>
                <div className="card-tools">
                  <span className="badge badge-light">{criticalProducts.length}</span>
                </div>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-striped m-0">
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Producto</th>
                        <th className="text-center">Stock Local</th>
                        <th className="text-center">Mínimo</th>
                        <th className="text-center">Reponer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {criticalProducts.map(p => (
                        <tr key={p._id}>
                          <td><span className="badge badge-secondary">{p.codigo}</span></td>
                          <td><strong>{p.nombre}</strong></td>
                          <td className="text-center">
                            <span className={`badge ${p.stock === 0 ? 'badge-dark' : 'badge-danger'}`}>{p.stock}</span>
                          </td>
                          <td className="text-center">{p.stockMinimo}</td>
                          <td className="text-center">
                            <span className="badge badge-info">{p.indicador?.cantidadRecomendadaCompra ?? '—'} unid.</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StockCharts;
