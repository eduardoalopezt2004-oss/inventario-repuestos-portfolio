import React, { useState, useMemo } from 'react';
import { toast } from 'react-toastify';
import axios from '../../services/api';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { enqueue, updateLocalStockTransferencia } from '../../utils/offlineQueue';
import { normalize } from '../../utils/textUtils';

const TransferenciaInventario = ({ productos, onSuccess }) => {
  const { isOnline, refreshCount } = useOnlineStatus();
  const [loading, setLoading] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [cantidades, setCantidades] = useState({});

  // Productos con local bajo y depósito disponible — pre-filtrados
  const productosConAlerta = useMemo(() => {
    return (productos || []).filter(p =>
      p.activo !== false &&
      (p.stockDeposito || 0) > 0 &&
      (p.stockLocal || 0) <= (p.stockMinimoLocal || 5)
    );
  }, [productos]);

  // Todos los productos activos con depósito disponible
  const productosDisponibles = useMemo(() => {
    return (productos || []).filter(p => p.activo !== false && (p.stockDeposito || 0) > 0);
  }, [productos]);

  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const listaActiva = mostrarTodos ? productosDisponibles : productosConAlerta;

  const listaFiltrada = useMemo(() => {
    if (!busqueda.trim()) return listaActiva;
    const q = normalize(busqueda);
    return listaActiva.filter(p =>
      normalize(p.nombre).includes(q) ||
      normalize(p.codigo).includes(q)
    );
  }, [listaActiva, busqueda]);

  const handleCantidad = (productoId, valor) => {
    const n = parseInt(valor);
    setCantidades(prev => ({ ...prev, [productoId]: isNaN(n) || n < 0 ? '' : n }));
  };

  const itemsATransferir = Object.entries(cantidades)
    .filter(([, cant]) => cant > 0)
    .map(([productoId, cantidad]) => ({ productoId, cantidad }));

  const validar = () => {
    if (itemsATransferir.length === 0) {
      toast.error('Ingrese al menos una cantidad para transferir');
      return false;
    }
    for (const { productoId, cantidad } of itemsATransferir) {
      const prod = productos.find(p => p._id === productoId);
      if (prod && cantidad > (prod.stockDeposito || 0)) {
        toast.error(`${prod.nombre}: cantidad (${cantidad}) supera el stock en depósito (${prod.stockDeposito || 0})`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validar()) return;
    setLoading(true);

    // ── SIN CONEXIÓN ──
    if (!isOnline) {
      for (const { productoId, cantidad } of itemsATransferir) {
        enqueue('transferencia', '/inventory/transferencia', 'post', {
          items: [{ productoId, cantidad }],
          motivo: motivo || 'Reposición depósito → local'
        });
        updateLocalStockTransferencia(productoId, cantidad);
      }
      refreshCount();
      toast.info(`Sin conexión — ${itemsATransferir.length} transferencia(s) guardadas localmente.`);
      setCantidades({});
      setMotivo('');
      setLoading(false);
      if (onSuccess) onSuccess();
      return;
    }

    // ── CON CONEXIÓN ──
    try {
      await axios.post('/inventory/transferencia', {
        items: itemsATransferir,
        motivo: motivo || 'Reposición depósito → local'
      });
      toast.success(`${itemsATransferir.length} producto(s) transferido(s) al local`);
      setCantidades({});
      setMotivo('');
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al realizar la transferencia');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="row">
      <div className="col-12 col-md-8">
        <form onSubmit={handleSubmit}>
          <div className="card">
            <div className="card-header bg-warning" style={{ gap: '0.5rem' }}>
              <div className="d-flex flex-wrap align-items-center justify-content-between mb-2">
                <h3 className="card-title mb-0" style={{ fontSize: '1rem' }}>
                  <i className="fas fa-exchange-alt mr-2"></i>
                  Depósito → Local
                </h3>
                <button
                  type="button"
                  className={`btn btn-sm ${mostrarTodos ? 'btn-light' : 'btn-dark'}`}
                  onClick={() => setMostrarTodos(v => !v)}
                >
                  <i className={`fas ${mostrarTodos ? 'fa-filter' : 'fa-list'} mr-1`}></i>
                  {mostrarTodos ? 'Solo alertas' : 'Ver todos'}
                </button>
              </div>
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white border-right-0">
                  <i className="fas fa-search text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-left-0"
                  placeholder="Buscar por nombre o código..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                />
                {busqueda && (
                  <button
                    type="button"
                    className="btn btn-sm btn-light border"
                    onClick={() => setBusqueda('')}
                  >
                    <i className="fas fa-times"></i>
                  </button>
                )}
              </div>
            </div>

            <div className="card-body p-0">
              {listaFiltrada.length === 0 ? (
                <div className="p-4 text-center text-muted">
                  <i className="fas fa-check-circle fa-2x mb-2 text-success"></i>
                  <p className="mb-0">
                    {busqueda
                      ? `Sin resultados para "${busqueda}"`
                      : mostrarTodos
                        ? 'No hay productos con stock en depósito'
                        : 'No hay productos con local bajo y depósito disponible'}
                  </p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm table-hover mb-0">
                    <thead className="thead-light">
                      <tr>
                        <th>Producto</th>
                        <th className="text-center" style={{ width: 60 }}>Dep.</th>
                        <th className="text-center" style={{ width: 60 }}>Local</th>
                        <th style={{ width: 90 }}>Cant.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listaFiltrada.map(p => {
                        const stockLocal = p.stockLocal || 0;
                        const minimoLocal = p.stockMinimoLocal || 5;
                        const stockDeposito = p.stockDeposito || 0;
                        const localBajo = stockLocal <= minimoLocal;
                        const cant = cantidades[p._id] || '';
                        const excede = cant !== '' && parseInt(cant) > stockDeposito;
                        return (
                          <tr key={p._id} className={localBajo ? 'table-warning' : ''}>
                            <td style={{ maxWidth: 140 }}>
                              <div className="font-weight-bold text-truncate" style={{ fontSize: 12 }}>{p.nombre}</div>
                              <small className="text-muted">{p.codigo}</small>
                            </td>
                            <td className="text-center align-middle px-1">
                              <span className="badge badge-secondary">{stockDeposito}</span>
                            </td>
                            <td className="text-center align-middle px-1">
                              <span className={`badge ${localBajo ? 'badge-danger' : 'badge-success'}`}>
                                {stockLocal}
                              </span>
                              {localBajo && (
                                <small className="d-block text-danger" style={{ fontSize: 9 }}>mín:{minimoLocal}</small>
                              )}
                            </td>
                            <td className="align-middle px-1">
                              <input
                                type="number"
                                className={`form-control form-control-sm ${excede ? 'is-invalid' : ''}`}
                                placeholder="0"
                                min="0"
                                max={stockDeposito}
                                value={cant}
                                onChange={e => handleCantidad(p._id, e.target.value)}
                                disabled={loading}
                                style={{ minWidth: 60 }}
                              />
                              {excede && (
                                <div className="invalid-feedback" style={{ display: 'block', fontSize: 9 }}>
                                  Máx: {stockDeposito}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card-footer">
              <div className="form-group mb-2">
                <label className="mb-1" style={{ fontSize: 13 }}>Motivo <span className="text-muted">(opcional)</span></label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Ej: Reposición semanal"
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  disabled={loading}
                  maxLength={200}
                />
              </div>
              {itemsATransferir.length > 0 && (
                <small className="text-muted d-block mb-2">
                  {itemsATransferir.length} producto(s) seleccionado(s)
                </small>
              )}
              <button
                type="submit"
                className="btn btn-warning btn-sm w-100"
                disabled={loading || itemsATransferir.length === 0}
              >
                {loading
                  ? <><i className="fas fa-spinner fa-spin mr-1"></i>Transfiriendo...</>
                  : <><i className="fas fa-exchange-alt mr-1"></i>Confirmar transferencia</>}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Panel lateral — oculto en móvil */}
      <div className="col-12 col-md-4 d-none d-md-block">
        <div className="card">
          <div className="card-header bg-info">
            <h3 className="card-title"><i className="fas fa-info-circle mr-2"></i>¿Cómo funciona?</h3>
          </div>
          <div className="card-body">
            <ul className="list-unstyled mb-0" style={{ fontSize: 14 }}>
              <li className="mb-2"><i className="fas fa-exclamation-triangle text-warning mr-2"></i>Las filas <strong>amarillas</strong> tienen el local por debajo del mínimo</li>
              <li className="mb-2"><i className="fas fa-warehouse text-secondary mr-2"></i>Solo puedes transferir lo que hay en depósito</li>
              <li className="mb-2"><i className="fas fa-exchange-alt text-primary mr-2"></i>El stock sale del depósito y entra al local</li>
              <li><i className="fas fa-wifi text-success mr-2"></i>Funciona offline: se sincroniza al reconectarse</li>
            </ul>
          </div>
        </div>
        {productosConAlerta.length > 0 && (
          <div className="callout callout-warning mt-3">
            <h6><i className="fas fa-exclamation-triangle mr-1"></i>{productosConAlerta.length} producto(s) con local bajo</h6>
            <p className="mb-0" style={{ fontSize: 13 }}>
              {productosConAlerta.map(p => p.nombre).join(', ')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransferenciaInventario;
