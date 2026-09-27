/**
 * Utilidad para calcular el indicador de nivel de stock tipo semáforo
 * @module utils/stockIndicator
 */

/**
 * Estados posibles del indicador de stock
 */
export const StockStatus = {
  ROJO: 'rojo',
  AMARILLO: 'amarillo',
  VERDE: 'verde',
  SIN_STOCK: 'sin_stock'
};

/**
 * Niveles de stock con sus respectivas prioridades
 */
export const StockPriority = {
  [StockStatus.SIN_STOCK]: 0,
  [StockStatus.ROJO]: 1,
  [StockStatus.AMARILLO]: 2,
  [StockStatus.VERDE]: 3
};

/**
 * Calcula el indicador de stock tipo semáforo
 *
 * @param {number} stockActual - Cantidad actual en inventario
 * @param {number} stockMinimo - Umbral mínimo de stock
 * @param {number} stockMaximo - Umbral máximo de stock (opcional)
 * @returns {Object} Objeto con el indicador y metadata
 */
export function getStockIndicator(stockActual, stockMinimo, stockMaximo = null) {
  // Validación de parámetros
  if (typeof stockActual !== 'number' || stockActual < 0) {
    throw new Error('stockActual debe ser un número mayor o igual a 0');
  }

  if (typeof stockMinimo !== 'number' || stockMinimo < 0) {
    throw new Error('stockMinimo debe ser un número mayor o igual a 0');
  }

  if (stockMaximo !== null && (typeof stockMaximo !== 'number' || stockMaximo < stockMinimo)) {
    throw new Error('stockMaximo debe ser un número mayor o igual a stockMinimo');
  }

  let status;
  let mensaje;
  let prioridad;
  let porcentaje = 0;

  // Sin stock
  if (stockActual === 0) {
    status = StockStatus.SIN_STOCK;
    mensaje = 'Sin stock disponible - Reabastecer urgente';
    prioridad = StockPriority[StockStatus.SIN_STOCK];
    porcentaje = 0;
  }
  // Con stockMaximo definido: umbrales porcentuales 20% / 50%
  else if (stockMaximo && stockMaximo > 0) {
    porcentaje = Math.min(Math.round((stockActual / stockMaximo) * 100), 100);
    if (porcentaje < 20) {
      status = StockStatus.ROJO;
      mensaje = `Stock crítico - ${porcentaje}% del máximo (${stockMaximo})`;
      prioridad = StockPriority[StockStatus.ROJO];
    } else if (porcentaje < 50) {
      status = StockStatus.AMARILLO;
      mensaje = `Stock bajo - ${porcentaje}% del máximo`;
      prioridad = StockPriority[StockStatus.AMARILLO];
    } else {
      status = StockStatus.VERDE;
      mensaje = `Stock suficiente - ${porcentaje}% del máximo`;
      prioridad = StockPriority[StockStatus.VERDE];
    }
  }
  // Sin stockMaximo: usar stockMinimo como referencia
  else if (stockActual < stockMinimo) {
    status = StockStatus.ROJO;
    mensaje = `Stock crítico - Por debajo del mínimo (${stockMinimo})`;
    prioridad = StockPriority[StockStatus.ROJO];
    porcentaje = stockMinimo > 0 ? Math.round((stockActual / stockMinimo) * 100) : 0;
  } else if (stockActual <= stockMinimo * 2) {
    status = StockStatus.AMARILLO;
    mensaje = 'Stock bajo - Considerar reabastecimiento';
    prioridad = StockPriority[StockStatus.AMARILLO];
    porcentaje = stockMinimo > 0 ? Math.round((stockActual / (stockMinimo * 2)) * 100) : 50;
  } else {
    status = StockStatus.VERDE;
    mensaje = 'Stock suficiente';
    prioridad = StockPriority[StockStatus.VERDE];
    porcentaje = 100;
  }

  // Configuración visual por estado
  const visualConfig = {
    [StockStatus.SIN_STOCK]: {
      color: '#dc3545',
      colorName: 'danger',
      icon: 'times-circle',
      badgeClass: 'badge-danger',
      alertClass: 'alert-danger',
      progressClass: 'bg-danger',
      textClass: 'text-danger',
      badgeStyle: null,
      progressStyle: null
    },
    [StockStatus.ROJO]: {
      color: '#fd7e14',
      colorName: 'orange',
      icon: 'exclamation-circle',
      badgeClass: '',
      alertClass: 'alert-warning',
      progressClass: '',
      textClass: '',
      badgeStyle: { background: '#fd7e14', color: '#fff' },
      progressStyle: { backgroundColor: '#fd7e14' }
    },
    [StockStatus.AMARILLO]: {
      color: '#ffc107',
      colorName: 'warning',
      icon: 'exclamation-triangle',
      badgeClass: 'badge-warning',
      alertClass: 'alert-warning',
      progressClass: 'bg-warning',
      textClass: 'text-warning',
      badgeStyle: null,
      progressStyle: null
    },
    [StockStatus.VERDE]: {
      color: '#28a745',
      colorName: 'success',
      icon: 'check-circle',
      badgeClass: 'badge-success',
      alertClass: 'alert-success',
      progressClass: 'bg-success',
      textClass: 'text-success',
      badgeStyle: null,
      progressStyle: null
    }
  };

  return {
    status,
    mensaje,
    prioridad,
    porcentaje,
    stockActual,
    stockMinimo,
    stockMaximo,
    diferencia: stockActual - stockMinimo,
    requiereAtencion: status === StockStatus.ROJO || status === StockStatus.SIN_STOCK,
    esUrgente: status === StockStatus.SIN_STOCK,
    ...visualConfig[status],
    cantidadParaMinimo: Math.max(0, stockMinimo - stockActual),
    cantidadParaMaximo: stockMaximo ? Math.max(0, stockMaximo - stockActual) : 0,
    cantidadRecomendadaCompra: stockMaximo
      ? Math.max(0, stockMaximo - stockActual)
      : Math.max(0, (stockMinimo * 2) - stockActual)
  };
}

/**
 * Obtiene solo el estado del indicador (versión optimizada)
 */
export function getStockStatus(stockActual, stockMinimo, stockMaximo = null) {
  if (stockActual === 0) return StockStatus.SIN_STOCK;
  if (stockMaximo && stockMaximo > 0) {
    const pct = (stockActual / stockMaximo) * 100;
    if (pct < 20) return StockStatus.ROJO;
    if (pct < 50) return StockStatus.AMARILLO;
    return StockStatus.VERDE;
  }
  if (stockActual < stockMinimo) return StockStatus.ROJO;
  if (stockActual <= stockMinimo * 2) return StockStatus.AMARILLO;
  return StockStatus.VERDE;
}

/**
 * Filtra productos por estado de stock
 */
export function filterByStockStatus(productos, estadoFiltro) {
  return productos.filter(producto => {
    const status = getStockStatus(
      producto.stock,
      producto.stockMinimo,
      producto.stockMaximo
    );
    return status === estadoFiltro;
  });
}

/**
 * Agrupa productos por estado de stock
 */
export function groupByStockStatus(productos) {
  const grupos = {
    [StockStatus.SIN_STOCK]: [],
    [StockStatus.ROJO]: [],
    [StockStatus.AMARILLO]: [],
    [StockStatus.VERDE]: []
  };

  productos.forEach(producto => {
    const status = getStockStatus(
      producto.stock,
      producto.stockMinimo,
      producto.stockMaximo
    );
    grupos[status].push(producto);
  });

  return grupos;
}

/**
 * Obtiene estadísticas de stock
 */
export function getStockStatistics(productos) {
  const grupos = groupByStockStatus(productos);

  return {
    total: productos.length,
    sin_stock: grupos[StockStatus.SIN_STOCK].length,
    rojo: grupos[StockStatus.ROJO].length,
    amarillo: grupos[StockStatus.AMARILLO].length,
    verde: grupos[StockStatus.VERDE].length,
    requierenAtencion: grupos[StockStatus.SIN_STOCK].length + grupos[StockStatus.ROJO].length,
    porcentajes: {
      sin_stock: productos.length > 0 ? Math.round((grupos[StockStatus.SIN_STOCK].length / productos.length) * 100) : 0,
      rojo: productos.length > 0 ? Math.round((grupos[StockStatus.ROJO].length / productos.length) * 100) : 0,
      amarillo: productos.length > 0 ? Math.round((grupos[StockStatus.AMARILLO].length / productos.length) * 100) : 0,
      verde: productos.length > 0 ? Math.round((grupos[StockStatus.VERDE].length / productos.length) * 100) : 0
    }
  };
}

/**
 * Ordena productos por prioridad de stock
 */
export function sortByStockPriority(productos) {
  return [...productos].sort((a, b) => {
    const statusA = getStockStatus(a.stock, a.stockMinimo, a.stockMaximo);
    const statusB = getStockStatus(b.stock, b.stockMinimo, b.stockMaximo);

    const prioridadA = StockPriority[statusA];
    const prioridadB = StockPriority[statusB];

    if (prioridadA !== prioridadB) {
      return prioridadA - prioridadB;
    }

    return a.stock - b.stock;
  });
}

/**
 * Calcula el stock máximo recomendado
 */
export function calculateRecommendedMaxStock(stockMinimo, multiplicador = 3) {
  if (typeof stockMinimo !== 'number' || stockMinimo < 0) {
    throw new Error('stockMinimo debe ser un número mayor o igual a 0');
  }
  return Math.ceil(stockMinimo * multiplicador);
}

/**
 * Hook personalizado de React para usar el indicador de stock
 */
export function useStockIndicator(stockActual, stockMinimo, stockMaximo = null) {
  try {
    return getStockIndicator(stockActual, stockMinimo, stockMaximo);
  } catch (error) {
    console.error('Error en useStockIndicator:', error);
    return {
      status: StockStatus.VERDE,
      mensaje: 'Error al calcular indicador',
      prioridad: 3,
      porcentaje: 0,
      color: '#28a745',
      icon: 'question-circle',
      badgeClass: 'badge-secondary',
      requiereAtencion: false,
      esUrgente: false
    };
  }
}
