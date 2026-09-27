const Product = require('../models/Product');
const InventoryMovement = require('../models/InventoryMovement');
const Sale = require('../models/Sale');
const validationService = require('../services/inventoryValidation.service');
const inventoryService = require('../services/inventory.service');
const sendServerError = require('../utils/sendServerError');

/**
 * @desc    Registrar entrada de productos al inventario
 * @route   POST /api/inventory/entrada
 * @access  Private
 */
exports.registrarEntrada = async (req, res) => {
  try {
    const {
      producto,
      categoria,
      cantidad,
      precioUnitario,
      precioVenta,
      motivo,
      numeroDocumento,
      proveedor,
      observaciones,
      tasaBs,
      ubicacion = 'local'
    } = req.body;

    const productoId = producto || categoria;
    const cantidadNum = parseInt(cantidad, 10);
    const precioUnitarioNum = parseFloat(precioUnitario);
    const tasaCambio = tasaBs && parseFloat(tasaBs) > 0 ? parseFloat(tasaBs) : null;
    const ubicacionValida = ubicacion === 'deposito' ? 'deposito' : 'local';

    const validacion = await validationService.validarEntrada(
      { producto: productoId, cantidad: cantidadNum, precioUnitario: precioUnitarioNum, motivo, numeroDocumento, proveedor },
      req.user
    );

    if (!validacion.valido) {
      return res.status(400).json({ message: validacion.error });
    }

    const productoDoc = validacion.producto;
    const campoStock = ubicacionValida === 'deposito' ? 'stockDeposito' : 'stockLocal';
    const stockAnterior = productoDoc[campoStock] || 0;
    const stockNuevo = stockAnterior + cantidadNum;

    const movimientoData = {
      producto: productoId,
      tipo: 'ENTRADA',
      cantidad: cantidadNum,
      precioUnitario: precioUnitarioNum,
      stockAnterior,
      stockNuevo,
      motivo,
      numeroDocumento,
      proveedor,
      observaciones,
      usuario: req.user._id,
      aprobado: true,
      ubicacion: ubicacionValida
    };

    if (tasaCambio) {
      movimientoData.tasaBs = tasaCambio;
      movimientoData.precioUnitarioBs = parseFloat((precioUnitarioNum * tasaCambio).toFixed(2));
      movimientoData.costoTotalBs = parseFloat((precioUnitarioNum * cantidadNum * tasaCambio).toFixed(2));
    }

    const movimiento = await InventoryMovement.create(movimientoData);

    productoDoc[campoStock] = stockNuevo;

    if (Math.abs(productoDoc.precioCompra - precioUnitarioNum) > 0.01) {
      productoDoc.precioCompra = precioUnitarioNum;
    }

    const precioVentaNum = precioVenta && parseFloat(precioVenta) > 0 ? parseFloat(precioVenta) : null;
    if (precioVentaNum && Math.abs((productoDoc.precioVenta || 0) - precioVentaNum) > 0.01) {
      productoDoc.precioVenta = precioVentaNum;
    }

    await productoDoc.save();

    res.status(201).json({
      message: 'Entrada registrada exitosamente',
      movimiento,
      ubicacion: ubicacionValida,
      stockAnterior,
      stockNuevo,
      stockDeposito: productoDoc.stockDeposito,
      stockLocal: productoDoc.stockLocal,
      advertencias: validacion.advertencias
    });
  } catch (error) {
    console.error('Error en registrarEntrada:', error);
    sendServerError(res, error);
  }
};

/**
 * @desc    Registrar salida de productos del inventario
 * @route   POST /api/inventory/salida
 * @access  Private
 */
exports.registrarSalida = async (req, res) => {
  try {
    const { producto, categoria, cantidad, motivo, metodoPago, observaciones, numeroDocumento, tasaBs } = req.body;

    // Aceptar tanto 'producto' como 'categoria' para compatibilidad
    const productoId = producto || categoria;

    // Asegurar tipos numéricos correctos
    const cantidadNum = parseInt(cantidad, 10);
    const tasaCambio = tasaBs && parseFloat(tasaBs) > 0 ? parseFloat(tasaBs) : null;

    // Validar salida completa
    const validacion = await validationService.validarSalida(
      { producto: productoId, cantidad: cantidadNum, motivo },
      req.user
    );

    if (!validacion.valido) {
      return res.status(400).json({ message: validacion.error });
    }

    const productoDoc = validacion.producto;
    // Las salidas siempre descuentan del local
    const stockAnterior = productoDoc.stockLocal || 0;
    const stockNuevo = stockAnterior - cantidadNum;

    const movimientoData = {
      producto: productoId,
      tipo: 'SALIDA',
      cantidad: cantidadNum,
      stockAnterior,
      stockNuevo,
      motivo,
      numeroDocumento,
      observaciones,
      usuario: req.user._id,
      aprobado: true,
      ubicacion: 'local'
    };

    if (tasaCambio && productoDoc.precioVenta) {
      movimientoData.tasaBs = tasaCambio;
      movimientoData.precioUnitarioBs = parseFloat((productoDoc.precioVenta * tasaCambio).toFixed(2));
      movimientoData.costoTotalBs = parseFloat((productoDoc.precioVenta * cantidadNum * tasaCambio).toFixed(2));
    }

    const movimiento = await InventoryMovement.create(movimientoData);

    productoDoc.stockLocal = stockNuevo;
    await productoDoc.save();

    // Si el motivo es venta a cliente, registrar automáticamente como venta
    let ventaCreada = null;
    let errorVenta = null;
    const motivoVenta = (motivo || '').trim().toLowerCase();

    if (motivoVenta === 'venta a cliente') {
      try {
        const precioUnitario = productoDoc.precioVenta || 0;
        const ventaItemData = {
          producto: productoId,
          cantidad: cantidadNum,
          precioUnitario,
          subtotal: cantidadNum * precioUnitario
        };
        const metodosValidos = ['efectivo', 'tarjeta', 'transferencia', 'pago_movil', 'divisa', 'otro'];
        const ventaData = {
          items: [ventaItemData],
          total: cantidadNum * precioUnitario,
          vendedor: req.user._id,
          estado: 'completada',
          metodoPago: metodosValidos.includes(metodoPago) ? metodoPago : 'efectivo'
        };

        if (tasaCambio) {
          ventaItemData.precioUnitarioBs = parseFloat((precioUnitario * tasaCambio).toFixed(2));
          ventaItemData.subtotalBs = parseFloat((cantidadNum * precioUnitario * tasaCambio).toFixed(2));
          ventaData.tasaBs = tasaCambio;
          ventaData.totalBs = parseFloat((cantidadNum * precioUnitario * tasaCambio).toFixed(2));
        }

        ventaCreada = await Sale.create(ventaData);
        console.log(`Venta automática creada: ${ventaCreada.numeroVenta}`);
      } catch (ventaError) {
        console.error('Error al crear venta automática:', ventaError.message);
        errorVenta = ventaError.message;
      }
    }

    res.status(201).json({
      message: 'Salida registrada exitosamente',
      movimiento,
      stockAnterior,
      stockNuevo,
      advertencias: validacion.advertencias,
      ...(ventaCreada && { ventaGenerada: ventaCreada.numeroVenta }),
      ...(errorVenta && { errorVenta })
    });
  } catch (error) {
    console.error('Error en registrarSalida:', error);

    // Intentar revertir si hubo error
    try {
      if (error.movimiento) {
        await InventoryMovement.findByIdAndDelete(error.movimiento._id);
      }
    } catch (revertError) {
      console.error('Error al revertir:', revertError);
    }

    sendServerError(res, error);
  }
};

/**
 * @desc    Registrar ajuste de inventario (requiere aprobación)
 * @route   POST /api/inventory/ajuste
 * @access  Private (Admin)
 */
exports.registrarAjuste = async (req, res) => {
  try {
    const { producto, cantidad, tipo, motivo, observaciones } = req.body;

    // Validar ajuste
    const validacion = await validationService.validarAjuste(
      { producto, cantidad, tipo, motivo },
      req.user
    );

    if (!validacion.valido) {
      return res.status(400).json({ message: validacion.error });
    }

    const productoDoc = validacion.producto;
    const stockAnterior = productoDoc.stock;
    let stockNuevo;

    if (tipo === 'AJUSTE_ENTRADA') {
      stockNuevo = stockAnterior + cantidad;
    } else if (tipo === 'AJUSTE_SALIDA') {
      stockNuevo = stockAnterior - cantidad;
    } else {
      throw new Error('Tipo de ajuste no válido');
    }

    // Crear movimiento de inventario (requiere aprobación)
    const movimiento = await InventoryMovement.create({
      producto,
      tipo,
      cantidad,
      stockAnterior,
      stockNuevo,
      motivo,
      observaciones,
      usuario: req.user._id,
      aprobado: false // Los ajustes requieren aprobación
    });

    // NO actualizar el stock aún (se actualizará al aprobar)

    res.status(201).json({
      message: 'Ajuste registrado. Pendiente de aprobación',
      movimiento,
      stockAnterior,
      stockPropuesto: stockNuevo,
      requiereAprobacion: true,
      advertencias: validacion.advertencias
    });
  } catch (error) {
    console.error('Error en registrarAjuste:', error);
    sendServerError(res, error);
  }
};

/**
 * @desc    Aprobar ajuste de inventario
 * @route   PUT /api/inventory/ajuste/:id/aprobar
 * @access  Private (Admin)
 */
exports.aprobarAjuste = async (req, res) => {
  try {
    const movimiento = await InventoryMovement.findById(req.params.id);

    if (!movimiento) {
      return res.status(404).json({ message: 'Ajuste no encontrado' });
    }

    if (movimiento.aprobado) {
      return res.status(400).json({ message: 'El ajuste ya está aprobado' });
    }

    if (movimiento.cancelado) {
      return res.status(400).json({ message: 'No se puede aprobar un ajuste cancelado' });
    }

    const producto = await Product.findById(movimiento.producto);
    if (!producto) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    const campoStock = movimiento.ubicacion === 'deposito' ? 'stockDeposito' : 'stockLocal';
    producto[campoStock] = movimiento.stockNuevo;
    await producto.save();

    movimiento.aprobado = true;
    movimiento.aprobadoPor = req.user._id;
    movimiento.fechaAprobacion = new Date();
    await movimiento.save();

    res.json({
      message: 'Ajuste aprobado exitosamente',
      movimiento,
      stockDeposito: producto.stockDeposito,
      stockLocal: producto.stockLocal
    });
  } catch (error) {
    console.error('Error en aprobarAjuste:', error);
    sendServerError(res, error);
  }
};

/**
 * @desc    Cancelar movimiento de inventario
 * @route   PUT /api/inventory/movimiento/:id/cancelar
 * @access  Private (Admin)
 */
exports.cancelarMovimiento = async (req, res) => {
  try {
    const { motivoCancelacion } = req.body;

    if (!motivoCancelacion || motivoCancelacion.trim().length < 10) {
      return res.status(400).json({
        message: 'Debe proporcionar un motivo de cancelación detallado (mínimo 10 caracteres)'
      });
    }

    const movimiento = await InventoryMovement.findById(req.params.id);

    if (!movimiento) {
      return res.status(404).json({ message: 'Movimiento no encontrado' });
    }

    // Verificar si puede cancelarse
    const puedeCancelar = movimiento.puedeCancelar();
    if (!puedeCancelar.puede) {
      return res.status(400).json({ message: puedeCancelar.razon });
    }

    const producto = await Product.findById(movimiento.producto);
    if (!producto) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    const campoStockCancel = movimiento.ubicacion === 'deposito' ? 'stockDeposito' : 'stockLocal';
    producto[campoStockCancel] = movimiento.stockAnterior;
    await producto.save();

    // Marcar como cancelado
    movimiento.cancelado = true;
    movimiento.motivoCancelacion = motivoCancelacion;
    movimiento.fechaCancelacion = new Date();
    await movimiento.save();

    res.json({
      message: 'Movimiento cancelado exitosamente',
      movimiento,
      stockRevertido: producto.stock
    });
  } catch (error) {
    console.error('Error en cancelarMovimiento:', error);
    sendServerError(res, error);
  }
};

/**
 * @desc    Obtener historial de movimientos
 * @route   GET /api/inventory/movimientos
 * @access  Private
 */
exports.obtenerMovimientos = async (req, res) => {
  try {
    const {
      producto,
      tipo,
      fechaDesde,
      fechaHasta,
      aprobado,
      cancelado,
      page = 1,
      limit = 50
    } = req.query;

    const query = {};

    if (producto) query.producto = producto;
    if (tipo) query.tipo = tipo;
    if (aprobado !== undefined) query.aprobado = aprobado === 'true';
    if (cancelado !== undefined) query.cancelado = cancelado === 'true';

    if (fechaDesde || fechaHasta) {
      query.createdAt = {};
      if (fechaDesde) query.createdAt.$gte = new Date(fechaDesde);
      if (fechaHasta) query.createdAt.$lte = new Date(fechaHasta);
    }

    const skip = (page - 1) * limit;

    const [movimientos, total] = await Promise.all([
      InventoryMovement.find(query)
        .populate('producto', 'codigo nombre marca stock')
        .populate('usuario', 'nombre email')
        .populate('aprobadoPor', 'nombre email')
        .sort('-createdAt')
        .skip(skip)
        .limit(parseInt(limit)),
      InventoryMovement.countDocuments(query)
    ]);

    res.json({
      movimientos,
      paginacion: {
        total,
        pagina: parseInt(page),
        limite: parseInt(limit),
        paginas: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error en obtenerMovimientos:', error);
    sendServerError(res, error);
  }
};

/**
 * @desc    Obtener historial de un producto específico
 * @route   GET /api/inventory/producto/:id/historial
 * @access  Private
 */
exports.obtenerHistorialProducto = async (req, res) => {
  try {
    const { limite = 100 } = req.query;

    const movimientos = await InventoryMovement.obtenerHistorial(req.params.id, {
      limite: parseInt(limite)
    });

    res.json(movimientos);
  } catch (error) {
    console.error('Error en obtenerHistorialProducto:', error);
    sendServerError(res, error);
  }
};

/**
 * @desc    Obtener ajustes pendientes de aprobación
 * @route   GET /api/inventory/ajustes-pendientes
 * @access  Private (Admin)
 */
exports.obtenerAjustesPendientes = async (req, res) => {
  try {
    const ajustesPendientes = await InventoryMovement.find({
      tipo: { $in: ['AJUSTE_ENTRADA', 'AJUSTE_SALIDA'] },
      aprobado: false,
      cancelado: false
    })
      .populate('producto', 'codigo nombre marca stock')
      .populate('usuario', 'nombre email')
      .sort('-createdAt');

    res.json(ajustesPendientes);
  } catch (error) {
    console.error('Error en obtenerAjustesPendientes:', error);
    sendServerError(res, error);
  }
};

/**
 * @desc    Transferir múltiples productos de depósito a local
 * @route   POST /api/inventory/transferencia
 * @access  Private
 */
exports.transferirStockMultiple = async (req, res) => {
  try {
    const { items, motivo } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Debe proporcionar al menos un producto para transferir' });
    }

    for (const item of items) {
      if (!item.productoId || !item.cantidad || item.cantidad <= 0) {
        return res.status(400).json({ message: 'Cada item debe tener productoId y cantidad válida' });
      }
    }

    const resultado = await inventoryService.transferirStockMultiple(
      items,
      req.user._id,
      motivo || 'Reposición depósito → local'
    );

    res.status(201).json({
      message: `Transferencia completada. ${resultado.totalTransferidos} producto(s) transferido(s)`,
      ...resultado
    });
  } catch (error) {
    console.error('Error en transferirStockMultiple:', error);
    sendServerError(res, error);
  }
};

/**
 * @desc    Obtener estadísticas de movimientos
 * @route   GET /api/inventory/estadisticas
 * @access  Private
 */
exports.obtenerEstadisticas = async (req, res) => {
  try {
    const { fechaDesde, fechaHasta } = req.query;
    const filtroFecha = {};

    if (fechaDesde || fechaHasta) {
      filtroFecha.createdAt = {};
      if (fechaDesde) filtroFecha.createdAt.$gte = new Date(fechaDesde);
      if (fechaHasta) filtroFecha.createdAt.$lte = new Date(fechaHasta);
    }

    const estadisticas = await InventoryMovement.aggregate([
      { $match: { cancelado: false, ...filtroFecha } },
      {
        $group: {
          _id: '$tipo',
          total: { $sum: 1 },
          cantidadTotal: { $sum: '$cantidad' },
          costoTotal: { $sum: '$costoTotal' }
        }
      }
    ]);

    res.json(estadisticas);
  } catch (error) {
    console.error('Error en obtenerEstadisticas:', error);
    sendServerError(res, error);
  }
};
