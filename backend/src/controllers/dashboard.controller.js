const Sale = require('../models/Sale');
const Product = require('../models/Product');
const User = require('../models/User');
const InventoryMovement = require('../models/InventoryMovement');
const { getStockStatistics, getStockIndicator } = require('../utils/stockIndicator');
const sendServerError = require('../utils/sendServerError');

// @desc    Obtener estadísticas del dashboard
// @route   GET /api/dashboard/stats
// @access  Private
exports.getDashboardStats = async (req, res) => {
  try {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const inicioAnio = new Date(hoy.getFullYear(), 0, 1);

    // Ventas del día
    const ventasHoy = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(hoy.setHours(0, 0, 0, 0)) },
          estado: 'completada'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' },
          cantidad: { $sum: 1 }
        }
      }
    ]);

    // Ventas del mes
    const ventasMes = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: inicioMes },
          estado: 'completada'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' },
          cantidad: { $sum: 1 }
        }
      }
    ]);

    // Ventas del año
    const ventasAnio = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: inicioAnio },
          estado: 'completada'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' },
          cantidad: { $sum: 1 }
        }
      }
    ]);

    // Productos con local bajo el mínimo (requieren reposición del depósito)
    const productosStockBajo = await Product.countDocuments({
      $expr: { $lte: ['$stockLocal', '$stockMinimoLocal'] },
      activo: true
    });

    // Productos con depósito bajo el mínimo (requieren compra a proveedor)
    const productosDepositoBajo = await Product.countDocuments({
      $expr: { $lte: ['$stockDeposito', '$stockMinimoDeposito'] },
      activo: true
    });

    // Total de productos activos
    const totalProductos = await Product.countDocuments({ activo: true });

    // Valor total del inventario
    const valorInventario = await Product.aggregate([
      {
        $match: { activo: true }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $multiply: ['$stock', '$precioVenta'] } }
        }
      }
    ]);

    // Productos más vendidos (top 5)
    const productosMasVendidos = await Sale.aggregate([
      { $match: { estado: 'completada' } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.producto',
          totalVendido: { $sum: '$items.cantidad' },
          ingresos: { $sum: '$items.subtotal' }
        }
      },
      { $sort: { totalVendido: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'producto'
        }
      },
      { $unwind: '$producto' }
    ]);

    res.json({
      ventasHoy: ventasHoy[0] || { total: 0, cantidad: 0 },
      ventasMes: ventasMes[0] || { total: 0, cantidad: 0 },
      ventasAnio: ventasAnio[0] || { total: 0, cantidad: 0 },
      productosStockBajo,
      productosDepositoBajo,
      totalProductos,
      valorInventario: valorInventario[0]?.total || 0,
      productosMasVendidos
    });
  } catch (error) {
    sendServerError(res, error);
  }
};

// @desc    Obtener ventas por mes (últimos 12 meses)
// @route   GET /api/dashboard/sales-by-month
// @access  Private
exports.getSalesByMonth = async (req, res) => {
  try {
    const hace12Meses = new Date();
    hace12Meses.setMonth(hace12Meses.getMonth() - 12);

    const ventasPorMes = await Sale.aggregate([
      {
        $match: {
          createdAt: { $gte: hace12Meses },
          estado: 'completada'
        }
      },
      {
        $group: {
          _id: {
            año: { $year: '$createdAt' },
            mes: { $month: '$createdAt' }
          },
          total: { $sum: '$total' },
          cantidad: { $sum: 1 }
        }
      },
      { $sort: { '_id.año': 1, '_id.mes': 1 } }
    ]);

    res.json(ventasPorMes);
  } catch (error) {
    sendServerError(res, error);
  }
};

// @desc    Obtener estadísticas de movimientos de stock
// @route   GET /api/dashboard/stock-movements
// @access  Private
exports.getStockMovements = async (req, res) => {
  try {
    const { periodo = '30' } = req.query; // días
    const diasAtras = parseInt(periodo);
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - diasAtras);

    // Movimientos por tipo en el período
    const movimientosPorTipo = await InventoryMovement.aggregate([
      {
        $match: {
          createdAt: { $gte: fechaInicio },
          cancelado: false,
          aprobado: true
        }
      },
      {
        $group: {
          _id: '$tipo',
          total: { $sum: 1 },
          cantidadTotal: { $sum: '$cantidad' }
        }
      }
    ]);

    // Movimientos por día
    const movimientosPorDia = await InventoryMovement.aggregate([
      {
        $match: {
          createdAt: { $gte: fechaInicio },
          cancelado: false,
          aprobado: true
        }
      },
      {
        $group: {
          _id: {
            año: { $year: '$createdAt' },
            mes: { $month: '$createdAt' },
            dia: { $dayOfMonth: '$createdAt' },
            tipo: '$tipo'
          },
          cantidad: { $sum: '$cantidad' }
        }
      },
      {
        $sort: { '_id.año': 1, '_id.mes': 1, '_id.dia': 1 }
      }
    ]);

    res.json({
      movimientosPorTipo,
      movimientosPorDia,
      periodo: diasAtras
    });
  } catch (error) {
    sendServerError(res, error);
  }
};

// @desc    Obtener distribución de productos por estado de stock
// @route   GET /api/dashboard/stock-distribution
// @access  Private
exports.getStockDistribution = async (req, res) => {
  try {
    const productos = await Product.find({ activo: true })
      .select('nombre stock stockMinimo stockMaximo');

    const estadisticas = getStockStatistics(productos);

    res.json({
      distribucion: {
        sin_stock: estadisticas.sin_stock,
        rojo: estadisticas.rojo,
        amarillo: estadisticas.amarillo,
        verde: estadisticas.verde
      },
      total: estadisticas.total,
      requierenAtencion: estadisticas.requierenAtencion,
      porcentajes: estadisticas.porcentajes
    });
  } catch (error) {
    sendServerError(res, error);
  }
};

// @desc    Obtener productos críticos (sin stock o rojos)
// @route   GET /api/dashboard/critical-products
// @access  Private
exports.getCriticalProducts = async (req, res) => {
  try {
    const productos = await Product.find({ activo: true })
      .select('codigo nombre stock stockMinimo stockMaximo precioVenta')
      .lean();

    const productosCriticos = productos
      .map(p => {
        try {
          return {
            ...p,
            indicador: getStockIndicator(p.stock, p.stockMinimo, p.stockMaximo || null)
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .filter(p => p.indicador.status === 'sin_stock' || p.indicador.status === 'rojo')
      .sort((a, b) => a.indicador.prioridad - b.indicador.prioridad)
      .slice(0, 10); // Top 10 más críticos

    res.json(productosCriticos);
  } catch (error) {
    sendServerError(res, error);
  }
};

// @desc    Obtener tendencia de entradas y salidas
// @route   GET /api/dashboard/stock-trend
// @access  Private
exports.getStockTrend = async (req, res) => {
  try {
    const { dias = '30' } = req.query;
    const diasAtras = parseInt(dias);
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - diasAtras);

    const tendencia = await InventoryMovement.aggregate([
      {
        $match: {
          createdAt: { $gte: fechaInicio },
          cancelado: false,
          aprobado: true
        }
      },
      {
        $group: {
          _id: {
            año: { $year: '$createdAt' },
            mes: { $month: '$createdAt' },
            dia: { $dayOfMonth: '$createdAt' }
          },
          entradas: {
            $sum: {
              $cond: [
                { $in: ['$tipo', ['ENTRADA', 'AJUSTE_ENTRADA']] },
                '$cantidad',
                0
              ]
            }
          },
          salidas: {
            $sum: {
              $cond: [
                { $in: ['$tipo', ['SALIDA', 'AJUSTE_SALIDA']] },
                '$cantidad',
                0
              ]
            }
          }
        }
      },
      {
        $sort: { '_id.año': 1, '_id.mes': 1, '_id.dia': 1 }
      },
      {
        $project: {
          _id: 0,
          fecha: {
            $dateFromParts: {
              year: '$_id.año',
              month: '$_id.mes',
              day: '$_id.dia'
            }
          },
          entradas: 1,
          salidas: 1
        }
      }
    ]);

    res.json(tendencia);
  } catch (error) {
    sendServerError(res, error);
  }
};
