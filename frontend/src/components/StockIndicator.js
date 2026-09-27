import React from 'react';
import { useStockIndicator } from '../utils/stockIndicator';
import PropTypes from 'prop-types';

/**
 * Componente para mostrar el indicador de stock tipo semáforo
 */
const StockIndicator = ({
  stock,
  stockMinimo,
  stockMaximo,
  showBadge = true,
  showProgress = false,
  showDetails = false,
  showIcon = true,
  size = 'md'
}) => {
  const indicador = useStockIndicator(stock, stockMinimo, stockMaximo);

  // Clases de tamaño
  const sizeClasses = {
    sm: 'badge-sm',
    md: '',
    lg: 'badge-lg'
  };

  // Renderizar badge
  if (showBadge) {
    return (
      <span className={`badge ${indicador.badgeClass} ${sizeClasses[size]}`} style={indicador.badgeStyle || {}}>
        {showIcon && <i className={`fas fa-${indicador.icon} mr-1`}></i>}
        {indicador.status.toUpperCase()}
        {showDetails && (
          <span className="ml-2">
            ({stock}/{stockMinimo})
          </span>
        )}
      </span>
    );
  }

  // Renderizar barra de progreso
  if (showProgress) {
    return (
      <div>
        <div className="d-flex justify-content-between mb-1">
          <small className="text-muted">Stock: {stock}</small>
          <small className={indicador.textClass}>{indicador.porcentaje}%</small>
        </div>
        <div className="progress" style={{ height: size === 'sm' ? '5px' : size === 'lg' ? '20px' : '10px' }}>
          <div
            className={`progress-bar ${indicador.progressClass}`}
            role="progressbar"
            style={{ width: `${indicador.porcentaje}%`, ...(indicador.progressStyle || {}) }}
            aria-valuenow={indicador.porcentaje}
            aria-valuemin="0"
            aria-valuemax="100"
          >
            {size === 'lg' && `${indicador.porcentaje}%`}
          </div>
        </div>
        {showDetails && (
          <small className="text-muted">
            Mín: {stockMinimo} {stockMaximo && `| Máx: ${stockMaximo}`}
          </small>
        )}
      </div>
    );
  }

  // Renderizar alerta con detalles
  return (
    <div className={`alert ${indicador.alertClass} mb-0`} role="alert">
      <i className={`fas fa-${indicador.icon} mr-2`}></i>
      <strong>{indicador.mensaje}</strong>
      {showDetails && (
        <div className="mt-2">
          <small>
            <strong>Stock actual:</strong> {indicador.stockActual} unidades<br />
            <strong>Stock mínimo:</strong> {indicador.stockMinimo} unidades<br />
            {indicador.stockMaximo && (
              <>
                <strong>Stock máximo:</strong> {indicador.stockMaximo} unidades<br />
              </>
            )}
            {indicador.requiereAtencion && (
              <>
                <strong>Cantidad para mínimo:</strong> {indicador.cantidadParaMinimo} unidades<br />
                <strong>Compra recomendada:</strong> {indicador.cantidadRecomendadaCompra} unidades
              </>
            )}
          </small>
        </div>
      )}
    </div>
  );
};

StockIndicator.propTypes = {
  stock: PropTypes.number.isRequired,
  stockMinimo: PropTypes.number.isRequired,
  stockMaximo: PropTypes.number,
  showBadge: PropTypes.bool,
  showProgress: PropTypes.bool,
  showDetails: PropTypes.bool,
  showIcon: PropTypes.bool,
  size: PropTypes.oneOf(['sm', 'md', 'lg'])
};

export default StockIndicator;

/**
 * Componente simplificado para badge
 */
export const StockBadge = ({ stock, stockMinimo, stockMaximo, size = 'md', showIcon = true }) => (
  <StockIndicator
    stock={stock}
    stockMinimo={stockMinimo}
    stockMaximo={stockMaximo}
    showBadge={true}
    size={size}
    showIcon={showIcon}
  />
);

/**
 * Componente para barra de progreso
 */
export const StockProgress = ({ stock, stockMinimo, stockMaximo, size = 'md', showDetails = false }) => (
  <StockIndicator
    stock={stock}
    stockMinimo={stockMinimo}
    stockMaximo={stockMaximo}
    showProgress={true}
    size={size}
    showDetails={showDetails}
  />
);

/**
 * Componente para alerta con detalles
 */
export const StockAlert = ({ stock, stockMinimo, stockMaximo, showDetails = true }) => (
  <StockIndicator
    stock={stock}
    stockMinimo={stockMinimo}
    stockMaximo={stockMaximo}
    showBadge={false}
    showProgress={false}
    showDetails={showDetails}
  />
);
