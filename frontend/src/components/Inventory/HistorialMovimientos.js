import React, { useState, useEffect, memo } from 'react';
import axios from '../../services/api';
import { toast } from 'react-toastify';
import { cacheMovements, getCachedMovements } from '../../utils/offlineQueue';

const PAGE_SIZE = 500;

const HistorialMovimientos = memo(({ productos }) => {
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [paginacion, setPaginacion] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState({
    producto: '',
    tipo: '',
    fechaDesde: '',
    fechaHasta: ''
  });

  useEffect(() => {
    cargarMovimientos(true);
  }, []);

  const buildParams = (p = 1) => {
    const params = new URLSearchParams();
    Object.keys(filtros).forEach(key => { if (filtros[key]) params.append(key, filtros[key]); });
    params.append('limit', PAGE_SIZE);
    params.append('page', p);
    return params;
  };

  const cargarMovimientos = async (reset = true) => {
    if (reset) {
      setLoading(true);
      setPagina(1);
    } else {
      setLoadingMore(true);
    }

    const nextPage = reset ? 1 : pagina + 1;

    try {
      const params = buildParams(nextPage);
      const response = await axios.get(`/inventory/movimientos?${params.toString()}`);
      const data = response.data.movimientos || [];
      const pag = response.data.paginacion;
      setPaginacion(pag);
      setPagina(nextPage);

      if (reset) {
        setMovimientos(data);
        if (!params.has('producto') && !params.has('tipo') && !params.has('fechaDesde') && !params.has('fechaHasta')) {
          cacheMovements(data);
        }
      } else {
        setMovimientos(prev => [...prev, ...data]);
      }
    } catch {
      if (reset) {
        const cached = getCachedMovements();
        if (cached) {
          setMovimientos(cached);
          setPaginacion(null);
          toast.info('Mostrando historial en caché (sin conexión)');
        } else {
          toast.error('Error al cargar el historial');
        }
      } else {
        toast.error('Error al cargar más movimientos');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleBuscar = () => cargarMovimientos(true);
  const handleCargarMas = () => cargarMovimientos(false);

  const getTipoBadge = (tipo) => {
    const badges = {
      ENTRADA: 'badge-success',
      SALIDA: 'badge-danger',
      AJUSTE_ENTRADA: 'badge-info',
      AJUSTE_SALIDA: 'badge-warning'
    };
    return badges[tipo] || 'badge-secondary';
  };

  const getTipoIcon = (tipo) => {
    const icons = {
      ENTRADA: 'fa-arrow-down',
      SALIDA: 'fa-arrow-up',
      AJUSTE_ENTRADA: 'fa-plus-circle',
      AJUSTE_SALIDA: 'fa-minus-circle'
    };
    return icons[tipo] || 'fa-exchange-alt';
  };

  const hayMas = paginacion && movimientos.length < paginacion.total;

  return (
    <div>
      {/* Filtros */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <i className="fas fa-filter mr-2"></i>
            Filtros
          </h3>
        </div>
        <div className="card-body">
          <div className="row">
            <div className="col-md-3">
              <div className="form-group">
                <label>Producto</label>
                <select
                  className="form-control"
                  value={filtros.producto}
                  onChange={(e) => setFiltros({ ...filtros, producto: e.target.value })}
                >
                  <option value="">Todos</option>
                  {(productos || []).map(p => (
                    <option key={p._id} value={p._id}>
                      {p.codigo} - {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="col-md-3">
              <div className="form-group">
                <label>Tipo</label>
                <select
                  className="form-control"
                  value={filtros.tipo}
                  onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}
                >
                  <option value="">Todos</option>
                  <option value="ENTRADA">Entrada</option>
                  <option value="SALIDA">Salida</option>
                  <option value="AJUSTE_ENTRADA">Ajuste Entrada</option>
                  <option value="AJUSTE_SALIDA">Ajuste Salida</option>
                </select>
              </div>
            </div>
            <div className="col-md-2">
              <div className="form-group">
                <label>Desde</label>
                <input
                  type="date"
                  className="form-control"
                  value={filtros.fechaDesde}
                  onChange={(e) => setFiltros({ ...filtros, fechaDesde: e.target.value })}
                />
              </div>
            </div>
            <div className="col-md-2">
              <div className="form-group">
                <label>Hasta</label>
                <input
                  type="date"
                  className="form-control"
                  value={filtros.fechaHasta}
                  onChange={(e) => setFiltros({ ...filtros, fechaHasta: e.target.value })}
                />
              </div>
            </div>
            <div className="col-md-2">
              <div className="form-group">
                <label>&nbsp;</label>
                <button
                  className="btn btn-primary btn-block"
                  onClick={handleBuscar}
                  disabled={loading}
                >
                  <i className="fas fa-search mr-2"></i>
                  Buscar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de movimientos */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <i className="fas fa-history mr-2"></i>
            Historial de Movimientos
            {paginacion && (
              <small className="ml-2 text-muted">
                ({movimientos.length} de {paginacion.total})
              </small>
            )}
          </h3>
        </div>
        <div className="card-body table-responsive p-0">
          {loading ? (
            <div className="text-center p-5">
              <i className="fas fa-spinner fa-spin fa-3x text-primary"></i>
            </div>
          ) : movimientos.length === 0 ? (
            <div className="text-center p-5 text-muted">
              <i className="fas fa-inbox fa-3x mb-3"></i>
              <p>No hay movimientos registrados</p>
            </div>
          ) : (
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Stock Anterior</th>
                  <th>Stock Nuevo</th>
                  <th>Usuario</th>
                  <th>Motivo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map(mov => (
                  <tr key={mov._id}>
                    <td>{new Date(mov.createdAt).toLocaleString()}</td>
                    <td>
                      <span className={`badge ${getTipoBadge(mov.tipo)}`}>
                        <i className={`fas ${getTipoIcon(mov.tipo)} mr-1`}></i>
                        {mov.tipo.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <strong>{mov.producto?.codigo}</strong>
                      <br />
                      <small>{mov.producto?.nombre}</small>
                    </td>
                    <td className="text-center">
                      <strong>{mov.cantidad}</strong>
                    </td>
                    <td className="text-center">{mov.stockAnterior}</td>
                    <td className="text-center">
                      <span className={mov.stockNuevo > mov.stockAnterior ? 'text-success' : 'text-danger'}>
                        <strong>{mov.stockNuevo}</strong>
                      </span>
                    </td>
                    <td>
                      <small>{mov.usuario?.nombre}</small>
                    </td>
                    <td>
                      <small>{mov.motivo}</small>
                    </td>
                    <td>
                      {mov.cancelado ? (
                        <span className="badge badge-dark">Cancelado</span>
                      ) : !mov.aprobado ? (
                        <span className="badge badge-warning">Pendiente</span>
                      ) : (
                        <span className="badge badge-success">Aprobado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {hayMas && (
          <div className="card-footer text-center">
            <button
              className="btn btn-outline-secondary"
              onClick={handleCargarMas}
              disabled={loadingMore}
            >
              {loadingMore
                ? <><i className="fas fa-spinner fa-spin mr-2"></i>Cargando...</>
                : <><i className="fas fa-chevron-down mr-2"></i>Cargar más ({paginacion.total - movimientos.length} restantes)</>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

export default HistorialMovimientos;
