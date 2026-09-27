const Sale = require('../models/Sale');
const Product = require('../models/Product');
const InventoryMovement = require('../models/InventoryMovement');
const Credito = require('../models/Credito');
const { upsertCliente } = require('./cliente.controller');
const sendServerError = require('../utils/sendServerError');

// @desc    Obtener todas las ventas
// @route   GET /api/sales
// @access  Private
exports.getSales = async (req, res) => {
  try {
    const { desde, hasta, vendedor, estado } = req.query;
    let query = {};

    if (desde || hasta) {
      query.createdAt = {};
      if (desde) query.createdAt.$gte = new Date(desde);
      if (hasta) query.createdAt.$lte = new Date(hasta);
    }

    if (vendedor) {
      query.vendedor = vendedor;
    }

    if (estado) {
      query.estado = estado;
    }

    const limit = req.query.limit ? parseInt(req.query.limit) : 0;

    const sales = await Sale.find(query)
      .populate('vendedor', 'nombre email')
      .populate('items.producto', 'codigo nombre marca')
      .sort('-createdAt')
      .limit(limit);

    res.json(sales);
  } catch (error) {
    sendServerError(res, error);
  }
};

// @desc    Obtener una venta por ID
// @route   GET /api/sales/:id
// @access  Private
exports.getSaleById = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('vendedor', 'nombre email')
      .populate('items.producto', 'codigo nombre marca modelo');

    if (!sale) {
      return res.status(404).json({ message: 'Venta no encontrada' });
    }

    res.json(sale);
  } catch (error) {
    sendServerError(res, error);
  }
};

// @desc    Crear venta
// @route   POST /api/sales
// @access  Private
exports.createSale = async (req, res) => {
  try {
    const { items, cliente, metodoPago, tasaBs, esCredito, abonoInicial, fechaVencimientoCredito } = req.body;

    // Tasa de cambio fija para esta venta (enviada desde el frontend al momento del registro)
    const tasaCambio = tasaBs && tasaBs > 0 ? parseFloat(tasaBs) : null;

    // Validar stock y calcular totales
    let total = 0;
    const saleItems = [];
    const productosActualizados = [];

    // Fase 1: Validar todos los productos antes de hacer cambios
    for (const item of items) {
      const product = await Product.findById(item.producto);

      if (!product) {
        return res.status(404).json({
          message: `Producto ${item.producto} no encontrado`
        });
      }

      if (!product.activo) {
        return res.status(400).json({
          message: `El producto ${product.nombre} no está activo`
        });
      }

      if ((product.stockLocal || 0) < item.cantidad) {
        return res.status(400).json({
          message: `Stock insuficiente en local para ${product.nombre}. Disponible: ${product.stockLocal || 0}, Solicitado: ${item.cantidad}`
        });
      }

      const precioUnitario = item.precioUnitario && parseFloat(item.precioUnitario) > 0
        ? parseFloat(item.precioUnitario)
        : product.precioVenta;
      const subtotal = item.cantidad * precioUnitario;
      total += subtotal;

      const itemData = {
        producto: product._id,
        cantidad: item.cantidad,
        precioUnitario,
        subtotal
      };

      // Guardar equivalente en Bs al momento de la venta
      if (tasaCambio) {
        itemData.precioUnitarioBs = parseFloat((precioUnitario * tasaCambio).toFixed(2));
        itemData.subtotalBs = parseFloat((subtotal * tasaCambio).toFixed(2));
      }

      saleItems.push(itemData);

      productosActualizados.push({
        id: product._id,
        stockAnterior: product.stockLocal || 0,
        cantidad: item.cantidad
      });
    }

    // Fase 2: Crear la venta
    const abono = esCredito ? parseFloat(abonoInicial || 0) : 0;

    const saleData = {
      items: saleItems,
      total,
      vendedor: req.user._id,
      cliente,
      metodoPago,
      esCredito: !!esCredito,
      abonoInicial: abono,
      ...(tasaCambio && {
        tasaBs: tasaCambio,
        totalBs: parseFloat((total * tasaCambio).toFixed(2))
      })
    };

    const sale = await Sale.create(saleData);

    // Guardar/actualizar cliente en la colección de clientes
    upsertCliente(cliente || {}).catch(() => {});

    // Fase 3: Actualizar stockLocal (ventas siempre descuentan del local)
    try {
      for (const item of items) {
        const product = await Product.findById(item.producto);
        if (product) {
          product.stockLocal = Math.max(0, (product.stockLocal || 0) - item.cantidad);
          await product.save();
        }
      }
    } catch (stockError) {
      console.error('Error al actualizar stock:', stockError);
      // Si falla la actualización de stock, registrar pero no revertir la venta
      // Se puede manejar manualmente después
    }

    // Fase 4: Crear movimientos de inventario (salidas) por cada ítem de la venta
    try {
      for (const info of productosActualizados) {
        const saleItem = saleItems.find(s => s.producto.toString() === info.id.toString());
        if (saleItem) {
          await InventoryMovement.create({
            producto: info.id,
            tipo: 'SALIDA',
            cantidad: info.cantidad,
            stockAnterior: info.stockAnterior,
            stockNuevo: info.stockAnterior - info.cantidad,
            motivo: `Venta a cliente - ${sale.numeroVenta}`,
            numeroDocumento: sale.numeroVenta,
            usuario: req.user._id,
            aprobado: true,
            ubicacion: 'local'
          });
        }
      }
    } catch (movError) {
      console.error('Error al crear movimientos de inventario para la venta:', movError);
      // No se falla la venta si los movimientos no se crean
    }

    // Fase 5: Crear crédito si la venta es a crédito
    if (esCredito) {
      try {
        const fechaVenc = fechaVencimientoCredito
          ? new Date(fechaVencimientoCredito)
          : (() => { const d = new Date(); d.setDate(d.getDate() + 15); return d; })();

        const montoTotalBs = tasaCambio ? parseFloat((total * tasaCambio).toFixed(2)) : 0;
        const abonoBs = tasaCambio ? parseFloat((abono * tasaCambio).toFixed(2)) : 0;

        let estadoCredito = 'pendiente';
        if (abono >= total - 0.001) estadoCredito = 'cancelado';
        else if (abono > 0) estadoCredito = 'parcial';

        const creditoData = {
          venta: sale._id,
          cliente: {
            nombre: cliente?.nombre || '',
            cedula: cliente?.cedula || '',
            telefono: cliente?.telefono || ''
          },
          montoTotal: total,
          montoTotalBs,
          montoPagado: parseFloat(abono.toFixed(2)),
          montoPagadoBs: parseFloat(abonoBs.toFixed(2)),
          tasaBs: tasaCambio || 0,
          estadoCredito,
          fechaVencimiento: fechaVenc,
          pagos: abono > 0 ? [{
            monto: parseFloat(abono.toFixed(2)),
            montoBs: parseFloat(abonoBs.toFixed(2)),
            tasaBs: tasaCambio || 0,
            registradoPor: req.user._id,
            fecha: new Date()
          }] : []
        };

        await Credito.create(creditoData);
      } catch (creditoError) {
        console.error('Error al crear crédito:', creditoError);
      }
    }

    // Obtener venta con datos poblados
    const populatedSale = await Sale.findById(sale._id)
      .populate('vendedor', 'nombre email')
      .populate('items.producto', 'codigo nombre marca');

    res.status(201).json(populatedSale);
  } catch (error) {
    console.error('Error en createSale:', error);
    sendServerError(res, error);
  }
};

// @desc    Cancelar venta
// @route   PUT /api/sales/:id/cancel
// @access  Private (Admin)
exports.cancelSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({ message: 'Venta no encontrada' });
    }

    if (sale.estado === 'cancelada') {
      return res.status(400).json({ message: 'La venta ya está cancelada' });
    }

    // Verificar que la venta no sea muy antigua (máximo 30 días)
    const treintaDias = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - sale.createdAt.getTime() > treintaDias) {
      return res.status(400).json({
        message: 'No se pueden cancelar ventas con más de 30 días de antigüedad'
      });
    }

    // Devolver stock
    for (const item of sale.items) {
      const product = await Product.findById(item.producto);
      if (product) {
        product.stock += item.cantidad;
        await product.save();
      }
    }

    // Marcar venta como cancelada
    sale.estado = 'cancelada';
    sale.fechaCancelacion = new Date();
    sale.canceladoPor = req.user._id;
    await sale.save();

    res.json({
      message: 'Venta cancelada exitosamente',
      sale
    });
  } catch (error) {
    console.error('Error en cancelSale:', error);
    sendServerError(res, error);
  }
};

// @desc    Obtener estadísticas de ventas
// @route   GET /api/sales/stats
// @access  Private
exports.getSalesStats = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const matchCondition = { estado: { $ne: 'cancelada' } };

    if (desde || hasta) {
      matchCondition.createdAt = {};
      if (desde) matchCondition.createdAt.$gte = new Date(desde);
      if (hasta) matchCondition.createdAt.$lte = new Date(hasta);
    }

    const stats = await Sale.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: null,
          totalVentas: { $sum: 1 },
          montoTotal: { $sum: '$total' },
          promedioVenta: { $avg: '$total' }
        }
      }
    ]);

    res.json(stats[0] || {
      totalVentas: 0,
      montoTotal: 0,
      promedioVenta: 0
    });
  } catch (error) {
    console.error('Error en getSalesStats:', error);
    sendServerError(res, error);
  }
};
