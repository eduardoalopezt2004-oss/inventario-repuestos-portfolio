const mongoose = require('mongoose');
const Product = require('../models/Product');
const InventoryTransaction = require('../models/InventoryTransaction');

/**
 * Servicio de Gestión de Inventario
 * Maneja todas las operaciones de stock con sincronización eficiente
 * y registro de transacciones para auditoría completa
 */
class InventoryService {
  /**
   * Actualiza el stock de un producto con registro de transacción
   * Funciona con y sin replica set de MongoDB
   */
  async actualizarStock(data) {
    const {
      productoId,
      cantidad,
      tipoTransaccion,
      usuarioId,
      motivo,
      referenciaVenta,
      referenciaCompra,
      costoUnitario,
      ubicacionOrigen,
      ubicacionDestino,
      // 'deposito' | 'local' — indica qué campo de stock modificar
      ubicacion = 'local'
    } = data;

    // Intentar usar transacciones si están disponibles (replica set)
    let session = null;
    let useTransaction = false;

    try {
      session = await mongoose.startSession();
      await session.startTransaction();
      useTransaction = true;
    } catch (error) {
      // Si falla (standalone MongoDB), continuar sin transacción
      console.log('Transacciones no disponibles, usando modo standalone');
      session = null;
      useTransaction = false;
    }

    try {
      // Obtener producto (con o sin sesión)
      const producto = session
        ? await Product.findById(productoId).session(session)
        : await Product.findById(productoId);

      if (!producto) {
        throw new Error('Producto no encontrado');
      }

      // Determinar qué campo de stock modificar
      const campoStock = ubicacion === 'deposito' ? 'stockDeposito' : 'stockLocal';
      const stockAnterior = producto[campoStock] || 0;

      // Calcular delta según tipo de transacción
      let cantidadReal = cantidad;
      if (['salida', 'ajuste_negativo', 'merma'].includes(tipoTransaccion)) {
        cantidadReal = -Math.abs(cantidad);
      } else {
        cantidadReal = Math.abs(cantidad);
      }

      const stockNuevo = stockAnterior + cantidadReal;

      if (stockNuevo < 0) {
        throw new Error(`Stock insuficiente en ${ubicacion}. Disponible: ${stockAnterior}, Solicitado: ${Math.abs(cantidadReal)}`);
      }

      producto[campoStock] = stockNuevo;
      if (session) {
        await producto.save({ session });
      } else {
        await producto.save();
      }

      // stockTotal para el registro histórico
      const stockTotalNuevo = (producto.stockDeposito || 0) + (producto.stockLocal || 0);

      let transaccion;
      const txData = {
        producto: productoId,
        tipoTransaccion,
        cantidad: cantidadReal,
        stockAnterior,
        stockNuevo,
        usuario: usuarioId,
        motivo,
        referenciaVenta,
        referenciaCompra,
        costoUnitario: costoUnitario || producto.precioCompra,
        ubicacionOrigen: ubicacionOrigen || ubicacion,
        ubicacionDestino,
        estado: 'completada',
        fechaEfectiva: new Date()
      };

      if (session) {
        transaccion = await InventoryTransaction.create([txData], { session });
        transaccion = transaccion[0];
      } else {
        transaccion = await InventoryTransaction.create(txData);
      }

      if (useTransaction && session) {
        await session.commitTransaction();
      }

      return {
        success: true,
        producto: {
          id: producto._id,
          codigo: producto.codigo,
          nombre: producto.nombre,
          stockAnterior,
          stockNuevo: stockTotalNuevo,
          stockDeposito: producto.stockDeposito,
          stockLocal: producto.stockLocal
        },
        transaccion
      };

    } catch (error) {
      // Revertir transacción en caso de error (solo si está disponible)
      if (useTransaction && session) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }

  /**
   * Actualiza stock de múltiples productos (operación batch)
   * Útil para ventas con múltiples items
   * Funciona con y sin replica set de MongoDB
   */
  async actualizarStockMasivo(items, opciones = {}) {
    const { usuarioId, tipoTransaccion = 'salida', referenciaVenta } = opciones;

    const resultados = [];
    const errores = [];

    try {
      for (const item of items) {
        try {
          const resultado = await this.actualizarStock({
            productoId: item.productoId || item.producto,
            cantidad: item.cantidad,
            tipoTransaccion,
            usuarioId,
            motivo: opciones.motivo || `Venta #${referenciaVenta}`,
            referenciaVenta,
            costoUnitario: item.precioUnitario
          });

          resultados.push(resultado);
        } catch (error) {
          errores.push({
            productoId: item.productoId || item.producto,
            error: error.message
          });
          // En caso de error, detener el proceso
          throw new Error(`Error en producto ${item.productoId || item.producto}: ${error.message}`);
        }
      }

      return {
        success: true,
        resultados,
        totalActualizados: resultados.length
      };

    } catch (error) {
      // Si hubo errores, intentar revertir los cambios exitosos
      if (resultados.length > 0) {
        console.error('Revertiendo cambios por error en actualización masiva');
        // Nota: Sin transacciones, la reversión debe hacerse manualmente
      }
      throw error;
    }
  }

  /**
   * Ajusta el stock de un producto en una ubicación específica
   */
  async ajustarStock(productoId, stockReal, usuarioId, motivo, ubicacion = 'local') {
    const producto = await Product.findById(productoId);

    if (!producto) {
      throw new Error('Producto no encontrado');
    }

    const campoStock = ubicacion === 'deposito' ? 'stockDeposito' : 'stockLocal';
    const diferencia = stockReal - (producto[campoStock] || 0);

    if (diferencia === 0) {
      return { success: true, mensaje: 'No se requiere ajuste, el stock ya es correcto' };
    }

    const tipoTransaccion = diferencia > 0 ? 'ajuste_positivo' : 'ajuste_negativo';

    return this.actualizarStock({
      productoId,
      cantidad: Math.abs(diferencia),
      tipoTransaccion,
      usuarioId,
      ubicacion,
      motivo: motivo || 'Ajuste de inventario'
    });
  }

  /**
   * Registra una merma (pérdida de producto)
   */
  async registrarMerma(productoId, cantidad, usuarioId, motivo) {
    return this.actualizarStock({
      productoId,
      cantidad,
      tipoTransaccion: 'merma',
      usuarioId,
      motivo: motivo || 'Merma de inventario'
    });
  }

  /**
   * Transfiere stock de depósito a local
   */
  async transferirStock(productoId, cantidad, usuarioId, motivo) {
    let session = null;
    let useTransaction = false;

    try {
      session = await mongoose.startSession();
      await session.startTransaction();
      useTransaction = true;
    } catch {
      session = null;
    }

    try {
      const producto = session
        ? await Product.findById(productoId).session(session)
        : await Product.findById(productoId);

      if (!producto) throw new Error('Producto no encontrado');

      const cantNum = Math.abs(cantidad);
      if ((producto.stockDeposito || 0) < cantNum) {
        throw new Error(`Stock insuficiente en depósito. Disponible: ${producto.stockDeposito || 0}, Solicitado: ${cantNum}`);
      }

      const depositoAnterior = producto.stockDeposito || 0;
      const localAnterior = producto.stockLocal || 0;

      producto.stockDeposito = depositoAnterior - cantNum;
      producto.stockLocal = localAnterior + cantNum;

      if (session) {
        await producto.save({ session });
      } else {
        await producto.save();
      }

      const txData = {
        producto: productoId,
        tipoTransaccion: 'transferencia',
        cantidad: cantNum,
        stockAnterior: depositoAnterior,
        stockNuevo: producto.stockDeposito,
        usuario: usuarioId,
        motivo: motivo || 'Transferencia depósito → local',
        ubicacionOrigen: 'deposito',
        ubicacionDestino: 'local',
        estado: 'completada',
        fechaEfectiva: new Date()
      };

      let transaccion;
      if (session) {
        transaccion = await InventoryTransaction.create([txData], { session });
        transaccion = transaccion[0];
      } else {
        transaccion = await InventoryTransaction.create(txData);
      }

      if (useTransaction && session) await session.commitTransaction();

      return {
        success: true,
        producto: {
          id: producto._id,
          codigo: producto.codigo,
          nombre: producto.nombre,
          stockDeposito: producto.stockDeposito,
          stockLocal: producto.stockLocal
        },
        transaccion
      };
    } catch (error) {
      if (useTransaction && session) await session.abortTransaction();
      throw error;
    } finally {
      if (session) session.endSession();
    }
  }

  /**
   * Transfiere múltiples productos de depósito a local en una sola operación
   */
  async transferirStockMultiple(items, usuarioId, motivo) {
    const resultados = [];
    const errores = [];

    for (const item of items) {
      try {
        const resultado = await this.transferirStock(
          item.productoId,
          item.cantidad,
          usuarioId,
          motivo || 'Reposición depósito → local'
        );
        resultados.push(resultado);
      } catch (error) {
        errores.push({ productoId: item.productoId, error: error.message });
      }
    }

    if (errores.length > 0 && resultados.length === 0) {
      throw new Error(`Transferencia fallida: ${errores.map(e => e.error).join(', ')}`);
    }

    return { success: true, resultados, errores, totalTransferidos: resultados.length };
  }

  /**
   * Obtiene el historial de movimientos de un producto
   */
  async obtenerHistorialProducto(productoId, opciones = {}) {
    const {
      fechaInicio,
      fechaFin,
      tipoTransaccion,
      limite = 50,
      pagina = 1
    } = opciones;

    const historial = await InventoryTransaction.obtenerHistorial(productoId, {
      fechaInicio,
      fechaFin,
      tipoTransaccion,
      limite,
      pagina
    });

    const total = await InventoryTransaction.countDocuments({
      producto: productoId,
      estado: { $ne: 'cancelada' }
    });

    return {
      historial,
      paginacion: {
        total,
        pagina,
        limite,
        totalPaginas: Math.ceil(total / limite)
      }
    };
  }

  /**
   * Obtiene un resumen de movimientos por período
   */
  async obtenerResumenMovimientos(fechaInicio, fechaFin) {
    const resultado = await InventoryTransaction.aggregate([
      {
        $match: {
          fechaEfectiva: {
            $gte: new Date(fechaInicio),
            $lte: new Date(fechaFin)
          },
          estado: 'completada'
        }
      },
      {
        $group: {
          _id: '$tipoTransaccion',
          totalTransacciones: { $sum: 1 },
          cantidadTotal: { $sum: { $abs: '$cantidad' } },
          costoTotal: { $sum: '$costoTotal' }
        }
      },
      {
        $sort: { totalTransacciones: -1 }
      }
    ]);

    return resultado;
  }

  /**
   * Sincroniza stock de todos los productos con base en transacciones
   * Útil para validar integridad de datos
   */
  async sincronizarStockGlobal() {
    const productos = await Product.find({ activo: true });
    const resultados = [];
    const inconsistencias = [];

    for (const producto of productos) {
      // Calcular stock teórico basado en transacciones
      const transacciones = await InventoryTransaction.find({
        producto: producto._id,
        estado: 'completada'
      }).sort({ fechaEfectiva: 1 });

      let stockCalculado = 0;
      for (const trans of transacciones) {
        stockCalculado += trans.cantidad;
      }

      // Comparar con stock actual
      if (stockCalculado !== producto.stock) {
        inconsistencias.push({
          producto: {
            id: producto._id,
            codigo: producto.codigo,
            nombre: producto.nombre
          },
          stockActual: producto.stock,
          stockCalculado,
          diferencia: producto.stock - stockCalculado
        });
      }

      resultados.push({
        productoId: producto._id,
        stockActual: producto.stock,
        stockCalculado,
        esConsistente: stockCalculado === producto.stock
      });
    }

    return {
      totalProductos: productos.length,
      productosConsistentes: resultados.filter(r => r.esConsistente).length,
      productosInconsistentes: inconsistencias.length,
      inconsistencias,
      detalles: resultados
    };
  }

  /**
   * Obtiene productos con stock crítico, separado por ubicación
   */
  async obtenerStockCritico() {
    const productos = await Product.find({ activo: true });

    const localCriticos = productos.filter(p => (p.stockLocal || 0) <= (p.stockMinimoLocal || 5));
    const localAdvertencia = productos.filter(p =>
      (p.stockLocal || 0) > (p.stockMinimoLocal || 5) &&
      (p.stockLocal || 0) <= ((p.stockMinimoLocal || 5) * 1.5)
    );
    const depositoCriticos = productos.filter(p => (p.stockDeposito || 0) <= (p.stockMinimoDeposito || 5));

    const mapear = (p, tipo) => ({
      id: p._id,
      codigo: p.codigo,
      nombre: p.nombre,
      stockDeposito: p.stockDeposito || 0,
      stockLocal: p.stockLocal || 0,
      stockMinimoLocal: p.stockMinimoLocal || 5,
      stockMinimoDeposito: p.stockMinimoDeposito || 5,
      tipo
    });

    return {
      localCriticos: localCriticos.map(p => mapear(p, 'local_critico')),
      localAdvertencia: localAdvertencia.map(p => mapear(p, 'local_advertencia')),
      depositoCriticos: depositoCriticos.map(p => mapear(p, 'deposito_critico'))
    };
  }

  /**
   * Revertir una transacción de inventario
   */
  async revertirTransaccion(transaccionId, usuarioId, motivo) {
    return InventoryTransaction.revertirTransaccion(transaccionId, usuarioId, motivo);
  }
}

module.exports = new InventoryService();
