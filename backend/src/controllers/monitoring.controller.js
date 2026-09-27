const Product = require('../models/Product');
const InventoryMovement = require('../models/InventoryMovement');

exports.getStockMonitoringKPIs = async (req, res) => {
  try {
    const productos = await Product.find({ activo: true }).populate('categoria');

    // ── Movimientos últimos 30 días ──────────────────────────────────────────
    const movimientos = await InventoryMovement.find({
      tipo: { $in: ['SALIDA', 'AJUSTE_SALIDA'] },
      cancelado: false,
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });

    const totalVendido = movimientos.reduce((sum, mov) => sum + mov.cantidad, 0);

    // ── KPIs generales ───────────────────────────────────────────────────────
    const stockTotalPromedio = productos.reduce((sum, p) =>
      sum + (p.stockLocal || 0) + (p.stockDeposito || 0), 0) / (productos.length || 1);

    const rotacionInventario = (totalVendido / (stockTotalPromedio || 1)).toFixed(2);

    const valorInventario = productos.reduce((sum, p) =>
      sum + (((p.stockLocal || 0) + (p.stockDeposito || 0)) * p.precioCompra), 0);

    const ventaDiariaPromedio = totalVendido / 30 || 1;
    const diasInventario = Math.round(stockTotalPromedio / ventaDiariaPromedio);

    // ── Clasificación LOCAL (stockLocal vs stockMinimoLocal, umbral x2) ──────
    const localSinStock  = productos.filter(p => (p.stockLocal || 0) === 0);
    const localCritico   = productos.filter(p => (p.stockLocal || 0) > 0 && (p.stockLocal || 0) < (p.stockMinimoLocal || 5));
    const localBajo      = productos.filter(p => (p.stockLocal || 0) >= (p.stockMinimoLocal || 5) && (p.stockLocal || 0) <= (p.stockMinimoLocal || 5) * 2);
    const localNormal    = productos.filter(p => (p.stockLocal || 0) > (p.stockMinimoLocal || 5) * 2);

    const tasaDesabastecimientoLocal = ((localSinStock.length / (productos.length || 1)) * 100).toFixed(2);

    // ── Clasificación DEPÓSITO (stockDeposito vs stockMinimoDeposito, umbral x2) ──
    const depositoSinStock = productos.filter(p => (p.stockDeposito || 0) === 0);
    const depositoCritico  = productos.filter(p => (p.stockDeposito || 0) > 0 && (p.stockDeposito || 0) < (p.stockMinimoDeposito || 5));
    const depositoBajo     = productos.filter(p => (p.stockDeposito || 0) >= (p.stockMinimoDeposito || 5) && (p.stockDeposito || 0) <= (p.stockMinimoDeposito || 5) * 2);
    const depositoNormal   = productos.filter(p => (p.stockDeposito || 0) > (p.stockMinimoDeposito || 5) * 2);

    const tasaDesabastecimientoDeposito = ((depositoSinStock.length / (productos.length || 1)) * 100).toFixed(2);

    // ── Movimientos del día ──────────────────────────────────────────────────
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const movimientosHoy = await InventoryMovement.countDocuments({ createdAt: { $gte: hoy }, cancelado: false });

    const [entradasRes, salidasRes] = await Promise.all([
      InventoryMovement.aggregate([
        { $match: { tipo: { $in: ['ENTRADA', 'AJUSTE_ENTRADA'] }, createdAt: { $gte: hoy }, cancelado: false } },
        { $group: { _id: null, total: { $sum: '$cantidad' } } }
      ]),
      InventoryMovement.aggregate([
        { $match: { tipo: { $in: ['SALIDA', 'AJUSTE_SALIDA'] }, createdAt: { $gte: hoy }, cancelado: false } },
        { $group: { _id: null, total: { $sum: '$cantidad' } } }
      ])
    ]);

    // ── Top 5 productos más vendidos ─────────────────────────────────────────
    const ventasPorProducto = {};
    movimientos.forEach(mov => {
      const id = mov.producto.toString();
      if (!ventasPorProducto[id]) ventasPorProducto[id] = 0;
      ventasPorProducto[id] += mov.cantidad;
    });

    const topProductosRaw = await Promise.all(
      Object.entries(ventasPorProducto)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(async ([prodId, cantidad]) => {
          const prod = await Product.findById(prodId).populate('categoria');
          if (!prod) return null;
          return { producto: prod, cantidadVendida: cantidad, valorVendido: cantidad * (prod.precioVenta || 0) };
        })
    );
    const topProductos = topProductosRaw.filter(Boolean).slice(0, 5);

    // ── Productos de lento movimiento ────────────────────────────────────────
    const productosConVentas = new Set(movimientos.map(m => m.producto.toString()));
    const productosLentoMovimiento = productos
      .filter(p => !productosConVentas.has(p._id.toString()) && ((p.stockLocal || 0) + (p.stockDeposito || 0)) > 0)
      .slice(0, 5)
      .map(p => ({
        _id: p._id,
        codigo: p.codigo,
        nombre: p.nombre,
        stock: (p.stockLocal || 0) + (p.stockDeposito || 0),
        valorRetenido: (((p.stockLocal || 0) + (p.stockDeposito || 0)) * p.precioCompra).toFixed(2),
        categoria: p.categoria?.nombre || 'Sin categoría'
      }));

    // ── Distribución por categoría ───────────────────────────────────────────
    const distMap = {};
    productos.forEach(p => {
      const cat = p.categoria?.nombre || 'Sin categoría';
      if (!distMap[cat]) distMap[cat] = { cantidad: 0, valor: 0, productos: 0 };
      distMap[cat].cantidad += (p.stockLocal || 0) + (p.stockDeposito || 0);
      distMap[cat].valor    += ((p.stockLocal || 0) + (p.stockDeposito || 0)) * p.precioCompra;
      distMap[cat].productos += 1;
    });

    const distribucionCategoria = Object.entries(distMap).map(([nombre, d]) => ({
      categoria: nombre,
      ...d,
      valor: d.valor.toFixed(2)
    }));

    // ── Alertas ──────────────────────────────────────────────────────────────
    const alertasLocal = [
      ...localCritico.map(p => ({
        tipo: 'CRITICO', ubicacion: 'local',
        producto: { nombre: p.nombre, codigo: p.codigo, stockMinimo: p.stockMinimoLocal },
        mensaje: `Stock local crítico: ${p.stockLocal} unid. (mín ${p.stockMinimoLocal})`
      })),
      ...localSinStock.map(p => ({
        tipo: 'SIN_STOCK', ubicacion: 'local',
        producto: { nombre: p.nombre, codigo: p.codigo, stockMinimo: p.stockMinimoLocal },
        mensaje: `Sin stock en local`
      }))
    ].slice(0, 10);

    const alertasDeposito = [
      ...depositoCritico.map(p => ({
        tipo: 'CRITICO', ubicacion: 'deposito',
        producto: { nombre: p.nombre, codigo: p.codigo, stockMinimo: p.stockMinimoDeposito },
        mensaje: `Stock depósito crítico: ${p.stockDeposito} unid. (mín ${p.stockMinimoDeposito})`
      })),
      ...depositoSinStock.map(p => ({
        tipo: 'SIN_STOCK', ubicacion: 'deposito',
        producto: { nombre: p.nombre, codigo: p.codigo, stockMinimo: p.stockMinimoDeposito },
        mensaje: `Sin stock en depósito`
      }))
    ].slice(0, 10);

    res.json({
      kpis: {
        rotacionInventario: parseFloat(rotacionInventario),
        valorInventario: valorInventario.toFixed(2),
        diasInventarioDisponible: diasInventario,
        movimientosHoy,
        entradasHoy: entradasRes[0]?.total || 0,
        salidasHoy:  salidasRes[0]?.total  || 0,
        tasaDesabastecimientoLocal:    parseFloat(tasaDesabastecimientoLocal),
        tasaDesabastecimientoDeposito: parseFloat(tasaDesabastecimientoDeposito)
      },
      estadoStockLocal: {
        total:       productos.length,
        stockNormal: localNormal.length,
        stockBajo:   localBajo.length,
        stockCritico: localCritico.length,
        sinStock:    localSinStock.length
      },
      estadoStockDeposito: {
        total:       productos.length,
        stockNormal: depositoNormal.length,
        stockBajo:   depositoBajo.length,
        stockCritico: depositoCritico.length,
        sinStock:    depositoSinStock.length
      },
      topProductos,
      productosLentoMovimiento,
      distribucionCategoria,
      alertasLocal,
      alertasDeposito
    });

  } catch (error) {
    console.error('Error al obtener KPIs de monitoreo:', error);
    res.status(500).json({ message: 'Error al obtener datos de monitoreo', error: error.message });
  }
};

exports.getProductsByStockStatus = async (req, res) => {
  try {
    const { status, ubicacion = 'local' } = req.query;
    const productos = await Product.find({ activo: true }).populate('categoria');

    const stockField  = ubicacion === 'deposito' ? 'stockDeposito'  : 'stockLocal';
    const minimoField = ubicacion === 'deposito' ? 'stockMinimoDeposito' : 'stockMinimoLocal';

    let filtrados;
    switch (status) {
      case 'critico':
        filtrados = productos.filter(p => (p[stockField] || 0) > 0 && (p[stockField] || 0) < (p[minimoField] || 5));
        break;
      case 'bajo':
        filtrados = productos.filter(p => (p[stockField] || 0) >= (p[minimoField] || 5) && (p[stockField] || 0) <= (p[minimoField] || 5) * 2);
        break;
      case 'sin-stock':
        filtrados = productos.filter(p => (p[stockField] || 0) === 0);
        break;
      case 'normal':
        filtrados = productos.filter(p => (p[stockField] || 0) > (p[minimoField] || 5) * 2);
        break;
      default:
        filtrados = productos;
    }

    res.json(filtrados);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener productos', error: error.message });
  }
};

exports.getProductStockTrend = async (req, res) => {
  try {
    const { productId } = req.params;
    const { dias = 30 } = req.query;
    const fechaInicio = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

    const movimientos = await InventoryMovement.find({
      producto: productId,
      createdAt: { $gte: fechaInicio },
      cancelado: false
    }).sort({ createdAt: 1 });

    const producto = await Product.findById(productId).populate('categoria');

    res.json({
      producto,
      tendencia: movimientos.map(mov => ({
        fecha: mov.createdAt,
        tipo: mov.tipo,
        cantidad: mov.cantidad,
        stockAnterior: mov.stockAnterior,
        stockNuevo: mov.stockNuevo,
        motivo: mov.motivo
      })),
      analisis: {
        totalEntradas: movimientos.filter(m => m.tipo.includes('ENTRADA')).reduce((s, m) => s + m.cantidad, 0),
        totalSalidas:  movimientos.filter(m => m.tipo.includes('SALIDA')).reduce((s, m)  => s + m.cantidad, 0),
        movimientoPromedioDiario: (movimientos.length / dias).toFixed(2),
        stockLocal:    producto?.stockLocal    || 0,
        stockDeposito: producto?.stockDeposito || 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener tendencia', error: error.message });
  }
};
