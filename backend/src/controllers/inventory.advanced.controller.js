const inventoryService = require('../services/inventory.service');
const Product = require('../models/Product');
const InventoryTransaction = require('../models/InventoryTransaction');

/**
 * Controlador Avanzado de Gestión de Inventario
 * Incluye sincronización eficiente y reportes consolidados
 */
class InventoryAdvancedController {
  /**
   * Actualizar stock de un producto
   * POST /api/inventory-advanced/update-stock
   */
  async actualizarStock(req, res) {
    try {
      const {
        productoId,
        cantidad,
        tipoTransaccion,
        motivo,
        referenciaVenta,
        referenciaCompra,
        costoUnitario,
        ubicacionOrigen,
        ubicacionDestino
      } = req.body;

      // Validaciones
      if (!productoId || !cantidad || !tipoTransaccion) {
        return res.status(400).json({
          success: false,
          error: 'productoId, cantidad y tipoTransaccion son requeridos'
        });
      }

      const resultado = await inventoryService.actualizarStock({
        productoId,
        cantidad,
        tipoTransaccion,
        usuarioId: req.user._id,
        motivo,
        referenciaVenta,
        referenciaCompra,
        costoUnitario,
        ubicacionOrigen,
        ubicacionDestino
      });

      res.status(200).json(resultado);
    } catch (error) {
      console.error('Error al actualizar stock:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Ajustar stock (corrección de inventario)
   * POST /api/inventory-advanced/adjust
   */
  async ajustarStock(req, res) {
    try {
      const { productoId, stockReal, motivo } = req.body;

      if (!productoId || stockReal === undefined) {
        return res.status(400).json({
          success: false,
          error: 'productoId y stockReal son requeridos'
        });
      }

      const resultado = await inventoryService.ajustarStock(
        productoId,
        stockReal,
        req.user._id,
        motivo
      );

      res.status(200).json(resultado);
    } catch (error) {
      console.error('Error al ajustar stock:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Registrar merma de producto
   * POST /api/inventory-advanced/merma
   */
  async registrarMerma(req, res) {
    try {
      const { productoId, cantidad, motivo } = req.body;

      if (!productoId || !cantidad) {
        return res.status(400).json({
          success: false,
          error: 'productoId y cantidad son requeridos'
        });
      }

      const resultado = await inventoryService.registrarMerma(
        productoId,
        cantidad,
        req.user._id,
        motivo
      );

      res.status(200).json(resultado);
    } catch (error) {
      console.error('Error al registrar merma:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Transferir stock entre ubicaciones
   * POST /api/inventory-advanced/transfer
   */
  async transferirStock(req, res) {
    try {
      const { productoId, cantidad, ubicacionOrigen, ubicacionDestino, motivo } = req.body;

      if (!productoId || !cantidad || !ubicacionOrigen || !ubicacionDestino) {
        return res.status(400).json({
          success: false,
          error: 'productoId, cantidad, ubicacionOrigen y ubicacionDestino son requeridos'
        });
      }

      const resultado = await inventoryService.transferirStock(
        productoId,
        cantidad,
        ubicacionOrigen,
        ubicacionDestino,
        req.user._id,
        motivo
      );

      res.status(200).json(resultado);
    } catch (error) {
      console.error('Error al transferir stock:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Obtener historial de movimientos de un producto
   * GET /api/inventory-advanced/history/:productoId
   */
  async obtenerHistorial(req, res) {
    try {
      const { productoId } = req.params;
      const { fechaInicio, fechaFin, tipoTransaccion, limite, pagina } = req.query;

      const resultado = await inventoryService.obtenerHistorialProducto(productoId, {
        fechaInicio,
        fechaFin,
        tipoTransaccion,
        limite: parseInt(limite) || 50,
        pagina: parseInt(pagina) || 1
      });

      res.status(200).json(resultado);
    } catch (error) {
      console.error('Error al obtener historial:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Obtener todas las transacciones (con filtros)
   * GET /api/inventory-advanced/transactions
   */
  async obtenerTransacciones(req, res) {
    try {
      const {
        fechaInicio,
        fechaFin,
        tipoTransaccion,
        usuarioId,
        productoId,
        limite = 100,
        pagina = 1
      } = req.query;

      const query = { estado: { $ne: 'cancelada' } };

      // Aplicar filtros
      if (fechaInicio || fechaFin) {
        query.fechaEfectiva = {};
        if (fechaInicio) query.fechaEfectiva.$gte = new Date(fechaInicio);
        if (fechaFin) query.fechaEfectiva.$lte = new Date(fechaFin);
      }

      if (tipoTransaccion) query.tipoTransaccion = tipoTransaccion;
      if (usuarioId) query.usuario = usuarioId;
      if (productoId) query.producto = productoId;

      const transacciones = await InventoryTransaction.find(query)
        .populate('producto', 'codigo nombre')
        .populate('usuario', 'nombre email')
        .sort({ fechaEfectiva: -1 })
        .limit(parseInt(limite))
        .skip((parseInt(pagina) - 1) * parseInt(limite));

      const total = await InventoryTransaction.countDocuments(query);

      res.status(200).json({
        success: true,
        transacciones,
        paginacion: {
          total,
          pagina: parseInt(pagina),
          limite: parseInt(limite),
          totalPaginas: Math.ceil(total / parseInt(limite))
        }
      });
    } catch (error) {
      console.error('Error al obtener transacciones:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Obtener productos con stock crítico
   * GET /api/inventory-advanced/critical-stock
   */
  async obtenerStockCritico(req, res) {
    try {
      const resultado = await inventoryService.obtenerStockCritico();
      res.status(200).json({
        success: true,
        ...resultado
      });
    } catch (error) {
      console.error('Error al obtener stock crítico:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Sincronizar stock global (validación de integridad)
   * GET /api/inventory-advanced/sync
   */
  async sincronizarStock(req, res) {
    try {
      const resultado = await inventoryService.sincronizarStockGlobal();
      res.status(200).json({
        success: true,
        ...resultado
      });
    } catch (error) {
      console.error('Error al sincronizar stock:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Obtener resumen de movimientos por período
   * GET /api/inventory-advanced/summary
   */
  async obtenerResumen(req, res) {
    try {
      const { fechaInicio, fechaFin } = req.query;

      if (!fechaInicio || !fechaFin) {
        return res.status(400).json({
          success: false,
          error: 'fechaInicio y fechaFin son requeridos'
        });
      }

      const resumen = await inventoryService.obtenerResumenMovimientos(
        fechaInicio,
        fechaFin
      );

      res.status(200).json({
        success: true,
        resumen,
        periodo: {
          inicio: fechaInicio,
          fin: fechaFin
        }
      });
    } catch (error) {
      console.error('Error al obtener resumen:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Revertir una transacción
   * POST /api/inventory-advanced/revert/:transaccionId
   */
  async revertirTransaccion(req, res) {
    try {
      const { transaccionId } = req.params;
      const { motivo } = req.body;

      const resultado = await inventoryService.revertirTransaccion(
        transaccionId,
        req.user._id,
        motivo
      );

      res.status(200).json({
        success: true,
        mensaje: 'Transacción revertida exitosamente',
        transaccion: resultado
      });
    } catch (error) {
      console.error('Error al revertir transacción:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Obtener estadísticas generales de inventario
   * GET /api/inventory-advanced/stats
   */
  async obtenerEstadisticas(req, res) {
    try {
      const productos = await Product.find({ activo: true });

      const totalProductos = productos.length;
      const valorTotalInventario = productos.reduce((sum, p) =>
        sum + (p.stock * p.precioCompra), 0
      );
      const valorTotalVenta = productos.reduce((sum, p) =>
        sum + (p.stock * p.precioVenta), 0
      );

      const stockCritico = await inventoryService.obtenerStockCritico();

      // Transacciones del último mes
      const fechaInicio = new Date();
      fechaInicio.setMonth(fechaInicio.getMonth() - 1);

      const transaccionesRecientes = await InventoryTransaction.countDocuments({
        fechaEfectiva: { $gte: fechaInicio },
        estado: 'completada'
      });

      const resumenMovimientos = await inventoryService.obtenerResumenMovimientos(
        fechaInicio.toISOString(),
        new Date().toISOString()
      );

      res.status(200).json({
        success: true,
        estadisticas: {
          totalProductos,
          valorTotalInventario: Math.round(valorTotalInventario * 100) / 100,
          valorTotalVenta: Math.round(valorTotalVenta * 100) / 100,
          utilidadPotencial: Math.round((valorTotalVenta - valorTotalInventario) * 100) / 100,
          productosCriticos: stockCritico.criticos.length,
          productosAdvertencia: stockCritico.advertencia.length,
          transaccionesUltimoMes: transaccionesRecientes,
          resumenMovimientos
        }
      });
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Generar reporte consolidado de inventario
   * POST /api/inventory-advanced/report
   */
  async generarReporte(req, res) {
    try {
      const { fechaInicio, fechaFin, incluirTransacciones = true } = req.body;

      // Obtener todos los productos activos
      const productos = await Product.find({ activo: true })
        .populate('categoria', 'nombre')
        .sort({ nombre: 1 });

      const reporteProductos = productos.map(p => ({
        codigo: p.codigo,
        nombre: p.nombre,
        categoria: p.categoria?.nombre,
        marca: p.marca,
        stock: p.stock,
        stockMinimo: p.stockMinimo,
        stockMaximo: p.stockMaximo,
        precioCompra: p.precioCompra,
        precioVenta: p.precioVenta,
        valorStock: p.stock * p.precioCompra,
        valorVenta: p.stock * p.precioVenta,
        ubicacion: p.ubicacion,
        indicadorStock: p.getIndicadorStock()
      }));

      let reporteTransacciones = null;
      if (incluirTransacciones && fechaInicio && fechaFin) {
        const resumen = await inventoryService.obtenerResumenMovimientos(
          fechaInicio,
          fechaFin
        );

        reporteTransacciones = {
          periodo: { inicio: fechaInicio, fin: fechaFin },
          resumen
        };
      }

      const totales = {
        totalProductos: productos.length,
        valorTotalInventario: reporteProductos.reduce((sum, p) => sum + p.valorStock, 0),
        valorTotalVenta: reporteProductos.reduce((sum, p) => sum + p.valorVenta, 0),
        productosCriticos: reporteProductos.filter(p => p.indicadorStock.estado === 'critico').length,
        productosAdvertencia: reporteProductos.filter(p => p.indicadorStock.estado === 'advertencia').length,
        productosNormales: reporteProductos.filter(p => p.indicadorStock.estado === 'normal').length
      };

      res.status(200).json({
        success: true,
        reporte: {
          fechaGeneracion: new Date(),
          generadoPor: req.user.nombre,
          productos: reporteProductos,
          transacciones: reporteTransacciones,
          totales
        }
      });
    } catch (error) {
      console.error('Error al generar reporte:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new InventoryAdvancedController();
