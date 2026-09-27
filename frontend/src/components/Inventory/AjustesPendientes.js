import React, { useState, useEffect } from 'react';
import axios from '../../services/api';
import { toast } from 'react-toastify';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { enqueue, cacheAjustes, getCachedAjustes } from '../../utils/offlineQueue';

const AjustesPendientes = ({ onAprobado }) => {
  const { isOnline, lastSyncAt, refreshCount } = useOnlineStatus();
  const [ajustes, setAjustes] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { cargarAjustesPendientes(); }, []);

  useEffect(() => { if (lastSyncAt) cargarAjustesPendientes(); }, [lastSyncAt]);

  const cargarAjustesPendientes = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/inventory/ajustes-pendientes');
      setAjustes(response.data);
      cacheAjustes(response.data);
    } catch {
      const cached = getCachedAjustes();
      if (cached) {
        setAjustes(cached);
        toast.info('Mostrando ajustes pendientes en caché (sin conexión)');
      } else {
        toast.error('Error al cargar ajustes pendientes');
      }
    } finally {
      setLoading(false);
    }
  };

  const aprobarAjuste = async (id) => {
    if (!window.confirm('¿Está seguro de aprobar este ajuste? Esta acción modificará el stock del producto.')) {
      return;
    }

    // ── SIN CONEXIÓN ──
    if (!isOnline) {
      enqueue('ajuste-aprobar', `/inventory/ajuste/${id}/aprobar`, 'put', {});
      const cached = getCachedAjustes() || [];
      cacheAjustes(cached.filter(a => a._id !== id));
      refreshCount();
      setAjustes(prev => prev.filter(a => a._id !== id));
      toast.info('Sin conexión — aprobación guardada localmente. Se sincronizará al reconectarse.');
      if (onAprobado) onAprobado();
      return;
    }

    // ── CON CONEXIÓN ──
    try {
      await axios.put(`/inventory/ajuste/${id}/aprobar`, {});
      toast.success('Ajuste aprobado exitosamente');
      cargarAjustesPendientes();
      if (onAprobado) onAprobado();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al aprobar el ajuste');
    }
  };

  return (
    <div className="card">
      <div className="card-header bg-warning">
        <h3 className="card-title">
          <i className="fas fa-clock mr-2"></i>
          Ajustes Pendientes de Aprobación
        </h3>
      </div>
      <div className="card-body">
        {loading ? (
          <div className="text-center p-5">
            <i className="fas fa-spinner fa-spin fa-3x text-primary"></i>
          </div>
        ) : ajustes.length === 0 ? (
          <div className="alert alert-info">
            <i className="fas fa-info-circle mr-2"></i>
            No hay ajustes pendientes de aprobación
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-bordered">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Tipo</th>
                  <th>Cantidad</th>
                  <th>Stock Actual</th>
                  <th>Stock Propuesto</th>
                  <th>Motivo</th>
                  <th>Solicitado por</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ajustes.map(ajuste => (
                  <tr key={ajuste._id}>
                    <td>{new Date(ajuste.createdAt).toLocaleString()}</td>
                    <td>
                      <strong>{ajuste.producto?.codigo}</strong>
                      <br />
                      <small>{ajuste.producto?.nombre}</small>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          ajuste.tipo === 'AJUSTE_ENTRADA' ? 'badge-info' : 'badge-warning'
                        }`}
                      >
                        {ajuste.tipo.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="text-center">
                      <strong>{ajuste.cantidad}</strong>
                    </td>
                    <td className="text-center">{ajuste.stockAnterior}</td>
                    <td className="text-center">
                      <strong
                        className={
                          ajuste.stockNuevo > ajuste.stockAnterior ? 'text-success' : 'text-danger'
                        }
                      >
                        {ajuste.stockNuevo}
                      </strong>
                    </td>
                    <td>
                      <small>{ajuste.motivo}</small>
                      {ajuste.observaciones && (
                        <>
                          <br />
                          <small className="text-muted">
                            <em>Obs: {ajuste.observaciones}</em>
                          </small>
                        </>
                      )}
                    </td>
                    <td>
                      <small>{ajuste.usuario?.nombre}</small>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => aprobarAjuste(ajuste._id)}
                      >
                        <i className="fas fa-check mr-1"></i>
                        Aprobar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AjustesPendientes;
