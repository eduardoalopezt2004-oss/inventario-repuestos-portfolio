/**
 * Tests unitarios para el indicador de stock
 */

const {
  getStockIndicator,
  getStockStatus,
  filterByStockStatus,
  groupByStockStatus,
  getStockStatistics,
  sortByStockPriority,
  calculateRecommendedMaxStock,
  StockStatus
} = require('./stockIndicator');

describe('getStockIndicator', () => {
  test('debe retornar verde cuando stock es mayor que máximo', () => {
    const resultado = getStockIndicator(100, 10, 50);
    expect(resultado.status).toBe(StockStatus.VERDE);
    expect(resultado.mensaje).toContain('Stock suficiente');
    expect(resultado.requiereAtencion).toBe(false);
    expect(resultado.porcentaje).toBe(100);
  });

  test('debe retornar amarillo cuando stock está entre mínimo y máximo', () => {
    const resultado = getStockIndicator(30, 10, 50);
    expect(resultado.status).toBe(StockStatus.AMARILLO);
    expect(resultado.mensaje).toContain('Stock bajo');
    expect(resultado.requiereAtencion).toBe(false);
    expect(resultado.porcentaje).toBe(60); // 30/50 * 100
  });

  test('debe retornar rojo cuando stock es menor que mínimo', () => {
    const resultado = getStockIndicator(5, 10, 50);
    expect(resultado.status).toBe(StockStatus.ROJO);
    expect(resultado.mensaje).toContain('Stock crítico');
    expect(resultado.requiereAtencion).toBe(true);
    expect(resultado.esUrgente).toBe(false);
  });

  test('debe retornar sin_stock cuando stock es 0', () => {
    const resultado = getStockIndicator(0, 10, 50);
    expect(resultado.status).toBe(StockStatus.SIN_STOCK);
    expect(resultado.mensaje).toContain('Sin stock');
    expect(resultado.requiereAtencion).toBe(true);
    expect(resultado.esUrgente).toBe(true);
    expect(resultado.porcentaje).toBe(0);
  });

  test('debe funcionar sin stockMaximo definido', () => {
    const resultado = getStockIndicator(100, 10);
    expect(resultado.status).toBe(StockStatus.VERDE);
    expect(resultado.stockMaximo).toBeNull();
  });

  test('debe calcular correctamente la diferencia de stock', () => {
    const resultado = getStockIndicator(15, 10, 50);
    expect(resultado.diferencia).toBe(5); // 15 - 10
  });

  test('debe calcular cantidad para llegar al mínimo', () => {
    const resultado = getStockIndicator(5, 10, 50);
    expect(resultado.cantidadParaMinimo).toBe(5); // 10 - 5
  });

  test('debe calcular cantidad para llegar al máximo', () => {
    const resultado = getStockIndicator(30, 10, 50);
    expect(resultado.cantidadParaMaximo).toBe(20); // 50 - 30
  });

  test('debe calcular compra recomendada con máximo definido', () => {
    const resultado = getStockIndicator(30, 10, 50);
    expect(resultado.cantidadRecomendadaCompra).toBe(20);
  });

  test('debe calcular compra recomendada sin máximo (doble del mínimo)', () => {
    const resultado = getStockIndicator(5, 10);
    expect(resultado.cantidadRecomendadaCompra).toBe(15); // (10 * 2) - 5
  });

  test('debe incluir configuración visual correcta', () => {
    const resultado = getStockIndicator(5, 10, 50);
    expect(resultado.color).toBeDefined();
    expect(resultado.icon).toBeDefined();
    expect(resultado.badgeClass).toBeDefined();
    expect(resultado.alertClass).toBeDefined();
    expect(resultado.progressClass).toBeDefined();
  });

  test('debe lanzar error con stockActual negativo', () => {
    expect(() => getStockIndicator(-1, 10, 50)).toThrow();
  });

  test('debe lanzar error con stockMinimo negativo', () => {
    expect(() => getStockIndicator(10, -1, 50)).toThrow();
  });

  test('debe lanzar error con stockMaximo menor que mínimo', () => {
    expect(() => getStockIndicator(10, 20, 10)).toThrow();
  });

  test('debe lanzar error con stockActual no numérico', () => {
    expect(() => getStockIndicator('abc', 10, 50)).toThrow();
  });
});

describe('getStockStatus', () => {
  test('debe retornar solo el estado (optimizado)', () => {
    expect(getStockStatus(100, 10, 50)).toBe(StockStatus.VERDE);
    expect(getStockStatus(30, 10, 50)).toBe(StockStatus.AMARILLO);
    expect(getStockStatus(5, 10, 50)).toBe(StockStatus.ROJO);
    expect(getStockStatus(0, 10, 50)).toBe(StockStatus.SIN_STOCK);
  });

  test('debe funcionar sin stockMaximo', () => {
    expect(getStockStatus(100, 10)).toBe(StockStatus.VERDE);
    expect(getStockStatus(5, 10)).toBe(StockStatus.ROJO);
  });
});

describe('filterByStockStatus', () => {
  const productos = [
    { id: 1, stock: 0, stockMinimo: 10, stockMaximo: 50 },
    { id: 2, stock: 5, stockMinimo: 10, stockMaximo: 50 },
    { id: 3, stock: 30, stockMinimo: 10, stockMaximo: 50 },
    { id: 4, stock: 100, stockMinimo: 10, stockMaximo: 50 }
  ];

  test('debe filtrar productos sin stock', () => {
    const resultado = filterByStockStatus(productos, StockStatus.SIN_STOCK);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe(1);
  });

  test('debe filtrar productos en rojo', () => {
    const resultado = filterByStockStatus(productos, StockStatus.ROJO);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe(2);
  });

  test('debe filtrar productos en amarillo', () => {
    const resultado = filterByStockStatus(productos, StockStatus.AMARILLO);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe(3);
  });

  test('debe filtrar productos en verde', () => {
    const resultado = filterByStockStatus(productos, StockStatus.VERDE);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe(4);
  });
});

describe('groupByStockStatus', () => {
  const productos = [
    { id: 1, stock: 0, stockMinimo: 10, stockMaximo: 50 },
    { id: 2, stock: 5, stockMinimo: 10, stockMaximo: 50 },
    { id: 3, stock: 30, stockMinimo: 10, stockMaximo: 50 },
    { id: 4, stock: 100, stockMinimo: 10, stockMaximo: 50 }
  ];

  test('debe agrupar productos por estado', () => {
    const resultado = groupByStockStatus(productos);

    expect(resultado[StockStatus.SIN_STOCK]).toHaveLength(1);
    expect(resultado[StockStatus.ROJO]).toHaveLength(1);
    expect(resultado[StockStatus.AMARILLO]).toHaveLength(1);
    expect(resultado[StockStatus.VERDE]).toHaveLength(1);
  });

  test('debe retornar arrays vacíos para estados sin productos', () => {
    const productosVerde = [
      { id: 1, stock: 100, stockMinimo: 10, stockMaximo: 50 }
    ];

    const resultado = groupByStockStatus(productosVerde);

    expect(resultado[StockStatus.SIN_STOCK]).toHaveLength(0);
    expect(resultado[StockStatus.ROJO]).toHaveLength(0);
    expect(resultado[StockStatus.AMARILLO]).toHaveLength(0);
    expect(resultado[StockStatus.VERDE]).toHaveLength(1);
  });
});

describe('getStockStatistics', () => {
  const productos = [
    { id: 1, stock: 0, stockMinimo: 10, stockMaximo: 50 },
    { id: 2, stock: 5, stockMinimo: 10, stockMaximo: 50 },
    { id: 3, stock: 30, stockMinimo: 10, stockMaximo: 50 },
    { id: 4, stock: 100, stockMinimo: 10, stockMaximo: 50 }
  ];

  test('debe calcular estadísticas correctas', () => {
    const stats = getStockStatistics(productos);

    expect(stats.total).toBe(4);
    expect(stats.sin_stock).toBe(1);
    expect(stats.rojo).toBe(1);
    expect(stats.amarillo).toBe(1);
    expect(stats.verde).toBe(1);
    expect(stats.requierenAtencion).toBe(2); // sin_stock + rojo
  });

  test('debe calcular porcentajes correctos', () => {
    const stats = getStockStatistics(productos);

    expect(stats.porcentajes.sin_stock).toBe(25); // 1/4 * 100
    expect(stats.porcentajes.rojo).toBe(25);
    expect(stats.porcentajes.amarillo).toBe(25);
    expect(stats.porcentajes.verde).toBe(25);
  });

  test('debe manejar array vacío', () => {
    const stats = getStockStatistics([]);

    expect(stats.total).toBe(0);
    expect(stats.porcentajes.sin_stock).toBe(0);
  });
});

describe('sortByStockPriority', () => {
  const productos = [
    { id: 1, stock: 100, stockMinimo: 10, stockMaximo: 50 }, // verde
    { id: 2, stock: 30, stockMinimo: 10, stockMaximo: 50 },  // amarillo
    { id: 3, stock: 0, stockMinimo: 10, stockMaximo: 50 },   // sin_stock
    { id: 4, stock: 5, stockMinimo: 10, stockMaximo: 50 }    // rojo
  ];

  test('debe ordenar productos por prioridad (más críticos primero)', () => {
    const resultado = sortByStockPriority(productos);

    expect(resultado[0].id).toBe(3); // sin_stock (prioridad 0)
    expect(resultado[1].id).toBe(4); // rojo (prioridad 1)
    expect(resultado[2].id).toBe(2); // amarillo (prioridad 2)
    expect(resultado[3].id).toBe(1); // verde (prioridad 3)
  });

  test('debe ordenar por cantidad cuando tienen misma prioridad', () => {
    const productosRojos = [
      { id: 1, stock: 8, stockMinimo: 10, stockMaximo: 50 },
      { id: 2, stock: 3, stockMinimo: 10, stockMaximo: 50 },
      { id: 3, stock: 5, stockMinimo: 10, stockMaximo: 50 }
    ];

    const resultado = sortByStockPriority(productosRojos);

    expect(resultado[0].id).toBe(2); // stock: 3
    expect(resultado[1].id).toBe(3); // stock: 5
    expect(resultado[2].id).toBe(1); // stock: 8
  });
});

describe('calculateRecommendedMaxStock', () => {
  test('debe calcular máximo recomendado con multiplicador por defecto', () => {
    expect(calculateRecommendedMaxStock(10)).toBe(30); // 10 * 3
  });

  test('debe calcular máximo recomendado con multiplicador personalizado', () => {
    expect(calculateRecommendedMaxStock(10, 5)).toBe(50); // 10 * 5
  });

  test('debe redondear hacia arriba', () => {
    expect(calculateRecommendedMaxStock(7, 3)).toBe(21); // 7 * 3 = 21
  });

  test('debe lanzar error con stockMinimo negativo', () => {
    expect(() => calculateRecommendedMaxStock(-1)).toThrow();
  });

  test('debe lanzar error con stockMinimo no numérico', () => {
    expect(() => calculateRecommendedMaxStock('abc')).toThrow();
  });
});

describe('Casos edge', () => {
  test('debe manejar stock igual al mínimo', () => {
    const resultado = getStockIndicator(10, 10, 50);
    expect(resultado.status).toBe(StockStatus.AMARILLO);
    expect(resultado.diferencia).toBe(0);
  });

  test('debe manejar stock igual al máximo', () => {
    const resultado = getStockIndicator(50, 10, 50);
    expect(resultado.status).toBe(StockStatus.AMARILLO);
  });

  test('debe manejar mínimo en 0', () => {
    const resultado = getStockIndicator(10, 0, 50);
    expect(resultado.status).toBe(StockStatus.AMARILLO);
  });

  test('debe manejar máximo igual a mínimo', () => {
    const resultado = getStockIndicator(15, 10, 10);
    expect(resultado.status).toBe(StockStatus.VERDE);
  });
});
