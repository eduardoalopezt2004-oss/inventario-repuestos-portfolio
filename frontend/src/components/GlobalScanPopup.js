import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { productAPI } from '../services/api';
import { getCachedProductos } from '../utils/offlineQueue';
import { variantesCodigoBarras, coincideCodigoBarras } from '../utils/barcodeUtils';
import { getStockStatus, StockStatus } from '../utils/stockIndicator';
import useDolarRate from '../hooks/useDolarRate';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import useHardwareScanner from '../hooks/useHardwareScanner';

const STOCK_LABEL = {
  [StockStatus.SIN_STOCK]: { label: 'Sin stock', cls: 'bg-danger', style: null },
  [StockStatus.ROJO]:      { label: 'Crítico',   cls: '',           style: { background: '#fd7e14', color: '#fff' } },
  [StockStatus.AMARILLO]:  { label: 'Bajo',       cls: 'bg-warning text-dark', style: null },
  [StockStatus.VERDE]:     { label: 'Normal',     cls: 'bg-success', style: null },
};

// Popup global: se activa desde CUALQUIER pantalla de la app al usar la
// pistola de código de barras/QR (ver useHardwareScanner) sin necesidad de
// estar en un formulario o pantalla específica. Muestra el precio y stock
// si el producto ya existe, o la opción de registrarlo si no.
const GlobalScanPopup = () => {
  const navigate = useNavigate();
  const { isOnline } = useOnlineStatus();
  const { tasaBs, formatBs, convertirABs } = useDolarRate();
  const [estado, setEstado] = useState(null); // null | 'buscando' | 'encontrado' | 'no-encontrado'
  const [codigo, setCodigo] = useState('');
  const [producto, setProducto] = useState(null);

  const buscarProducto = useCallback(async (codigoEscaneado) => {
    setCodigo(codigoEscaneado);
    setProducto(null);
    setEstado('buscando');

    // La cámara suele leer un UPC-A como EAN-13 (agrega un "0" al inicio);
    // la pistola normalmente entrega el UPC-A tal cual. Se prueban ambas
    // formas para que no importe con cuál se haya registrado el producto.
    const cache = getCachedProductos() || [];
    let encontrado = cache.find(p => coincideCodigoBarras(p.codigo, codigoEscaneado) && p.activo !== false);

    if (!encontrado && isOnline) {
      try {
        for (const variante of variantesCodigoBarras(codigoEscaneado)) {
          const resp = await productAPI.getAll({ search: variante, activo: true });
          const lista = Array.isArray(resp.data) ? resp.data : [];
          encontrado = lista.find(p => coincideCodigoBarras(p.codigo, codigoEscaneado));
          if (encontrado) break;
        }
      } catch {
        // Sin conexión o error de red: nos quedamos con lo que había en caché.
      }
    }

    if (encontrado) {
      setProducto(encontrado);
      setEstado('encontrado');
    } else {
      setEstado('no-encontrado');
    }
  }, [isOnline]);

  useHardwareScanner(buscarProducto);

  const cerrar = () => {
    setEstado(null);
    setProducto(null);
    setCodigo('');
  };

  const irARegistrar = () => {
    const codigoAregistrar = codigo;
    cerrar();
    navigate(`/categorias?nuevoCodigo=${encodeURIComponent(codigoAregistrar)}`);
  };

  const irAEditar = () => {
    const codigoAeditar = codigo;
    cerrar();
    navigate(`/categorias?editarCodigo=${encodeURIComponent(codigoAeditar)}`);
  };

  if (!estado) return null;

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1080 }}
      onClick={(e) => { if (e.target === e.currentTarget) cerrar(); }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="fas fa-barcode mr-2"></i>
              Lectura de código
            </h5>
            <button type="button" className="close" onClick={cerrar}>
              <span>&times;</span>
            </button>
          </div>

          <div className="modal-body text-center py-4">
            {estado === 'buscando' && (
              <>
                <div className="spinner-border text-primary mb-3" role="status">
                  <span className="sr-only">Buscando...</span>
                </div>
                <p className="text-muted mb-0">Buscando código <strong>{codigo}</strong>...</p>
              </>
            )}

            {estado === 'encontrado' && producto && (() => {
              const stockTotal = (producto.stockLocal ?? 0) + (producto.stockDeposito ?? 0);
              const status = getStockStatus(producto.stockLocal ?? 0, producto.stockMinimoLocal ?? 5, producto.stockMaximo ?? null);
              const badge = STOCK_LABEL[status];
              return (
                <>
                  <h4 className="mb-1">{producto.nombre}</h4>
                  {producto.marca && <div className="text-muted mb-3">{producto.marca}</div>}
                  <div style={{ fontSize: '2.5rem', fontWeight: 700 }} className="text-success mb-1">
                    ${producto.precioVenta?.toFixed(2) ?? '0.00'}
                  </div>
                  {tasaBs && (
                    <div className="text-info mb-3">{formatBs(convertirABs(producto.precioVenta ?? 0))}</div>
                  )}
                  <div className="d-flex justify-content-center align-items-center mb-2" style={{ gap: 8 }}>
                    <span className={`badge ${badge.cls}`} style={badge.style || {}}>{badge.label}</span>
                    <small className="text-muted">
                      Local: {producto.stockLocal ?? 0} · Depósito: {producto.stockDeposito ?? 0} · Total: {stockTotal}
                    </small>
                  </div>
                  <small className="text-muted d-block">Código: {producto.codigo}</small>
                </>
              );
            })()}

            {estado === 'no-encontrado' && (
              <>
                <i className="fas fa-box-open fa-3x text-muted mb-3"></i>
                <p className="mb-1">No se encontró ningún producto con el código:</p>
                <p className="font-weight-bold mb-3">{codigo}</p>
                <p className="text-muted mb-0">¿Quieres registrarlo como producto nuevo?</p>
              </>
            )}
          </div>

          <div className="modal-footer">
            {estado === 'encontrado' && (
              <button type="button" className="btn btn-outline-primary" onClick={irAEditar}>
                <i className="fas fa-edit mr-2"></i>Ver / Editar producto
              </button>
            )}
            {estado === 'no-encontrado' && (
              <button type="button" className="btn btn-primary" onClick={irARegistrar}>
                <i className="fas fa-plus mr-2"></i>Registrar producto
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={cerrar}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalScanPopup;
