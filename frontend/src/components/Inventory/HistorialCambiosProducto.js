import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { productAPI } from '../../services/api';
import { CAMPOS_LABEL, formatValorCambio } from '../../utils/productChangeFields';

const LIMITE_RECIENTES = 5;

const HistorialCambiosProducto = ({ productoId }) => {
  const navigate = useNavigate();
  const [historial, setHistorial] = useState([]);
  const [hayMas, setHayMas] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!productoId) return;

    const cargarHistorial = async () => {
      setLoading(true);
      setError(false);
      try {
        // Pedimos uno de más para saber si hay que ofrecer "ver todo el historial"
        const response = await productAPI.getHistorial(productoId, { limite: LIMITE_RECIENTES + 1 });
        const data = response.data || [];
        setHayMas(data.length > LIMITE_RECIENTES);
        setHistorial(data.slice(0, LIMITE_RECIENTES));
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    cargarHistorial();
  }, [productoId]);

  const handleVerTodo = () => {
    navigate(`/historial-cambios?producto=${productoId}`);
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">
          <i className="fas fa-history mr-2"></i>
          Historial de Cambios
          {hayMas && <small className="ml-2 text-muted">(últimos {LIMITE_RECIENTES})</small>}
        </h3>
      </div>
      <div className="card-body table-responsive p-0">
        {loading ? (
          <div className="text-center p-5">
            <i className="fas fa-spinner fa-spin fa-3x text-primary"></i>
          </div>
        ) : error ? (
          <div className="text-center p-5 text-muted">
            <i className="fas fa-wifi fa-3x mb-3"></i>
            <p>Historial no disponible sin conexión</p>
          </div>
        ) : historial.length === 0 ? (
          <div className="text-center p-5 text-muted">
            <i className="fas fa-inbox fa-3x mb-3"></i>
            <p>No hay cambios registrados</p>
          </div>
        ) : (
          <table className="table table-hover">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Campo</th>
                <th>Valor anterior</th>
                <th>Valor nuevo</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((log) => (
                (log.cambios || []).map((cambio, idx) => (
                  <tr key={`${log._id}-${idx}`}>
                    {idx === 0 && (
                      <>
                        <td rowSpan={log.cambios.length}>{new Date(log.createdAt).toLocaleString()}</td>
                        <td rowSpan={log.cambios.length}>
                          <small>{log.usuario?.nombre || '—'}</small>
                        </td>
                      </>
                    )}
                    <td>{CAMPOS_LABEL[cambio.campo] || cambio.campo}</td>
                    <td>{formatValorCambio(cambio.valorAnterior)}</td>
                    <td>{formatValorCambio(cambio.valorNuevo)}</td>
                  </tr>
                ))
              ))}
            </tbody>
          </table>
        )}
      </div>
      {hayMas && (
        <div className="card-footer text-center">
          <button className="btn btn-outline-primary btn-sm" onClick={handleVerTodo}>
            <i className="fas fa-list mr-1"></i>Ver todo el historial de este producto
          </button>
        </div>
      )}
    </div>
  );
};

export default HistorialCambiosProducto;
