const mongoose = require('mongoose');

/**
 * Esquema para registrar todas las transacciones de inventario
 * Permite trazabilidad completa y auditoría de movimientos de stock
 */
const inventoryTransactionSchema = new mongoose.Schema({
  // Referencia al producto
  producto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'El producto es requerido'],
    index: true
  },

  // Tipo de transacción
  tipoTransaccion: {
    type: String,
    enum: [
      'entrada',        // Compra, devolución de cliente
      'salida',         // Venta, devolución a proveedor
      'ajuste_positivo', // Corrección de inventario (aumento)
      'ajuste_negativo', // Corrección de inventario (disminución)
      'transferencia',  // Movimiento entre ubicaciones
      'merma',          // Pérdida, robo, vencimiento
      'inicial'         // Stock inicial del sistema
    ],
    required: [true, 'El tipo de transacción es requerido'],
    index: true
  },

  // Cantidad (positiva para entradas, negativa para salidas)
  cantidad: {
    type: Number,
    required: [true, 'La cantidad es requerida'],
    validate: {
      validator: function(v) {
        return v !== 0;
      },
      message: 'La cantidad no puede ser cero'
    }
  },

  // Stock antes y después de la transacción (para auditoría)
  stockAnterior: {
    type: Number,
    required: true,
    min: 0
  },

  stockNuevo: {
    type: Number,
    required: true,
    min: 0
  },

  // Referencia a documentos relacionados
  referenciaVenta: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale'
  },

  referenciaCompra: {
    type: String, // ID de compra si existe módulo de compras
    trim: true
  },

  // Usuario que realizó la transacción
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El usuario es requerido']
  },

  // Motivo de la transacción
  motivo: {
    type: String,
    trim: true,
    maxlength: 500
  },

  // Ubicación (si hay movimiento entre almacenes)
  ubicacionOrigen: {
    type: String,
    trim: true
  },

  ubicacionDestino: {
    type: String,
    trim: true
  },

  // Costo unitario en el momento de la transacción
  costoUnitario: {
    type: Number,
    min: 0
  },

  // Costo total de la transacción
  costoTotal: {
    type: Number,
    min: 0
  },

  // Metadatos adicionales
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },

  // Estado de la transacción
  estado: {
    type: String,
    enum: ['completada', 'pendiente', 'cancelada', 'revertida'],
    default: 'completada'
  },

  // Fecha efectiva de la transacción (puede ser diferente a createdAt)
  fechaEfectiva: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true // Añade createdAt y updatedAt automáticamente
});

// Índices compuestos para consultas eficientes
inventoryTransactionSchema.index({ producto: 1, fechaEfectiva: -1 });
inventoryTransactionSchema.index({ tipoTransaccion: 1, fechaEfectiva: -1 });
inventoryTransactionSchema.index({ usuario: 1, fechaEfectiva: -1 });
inventoryTransactionSchema.index({ estado: 1, fechaEfectiva: -1 });

// Validación pre-save
inventoryTransactionSchema.pre('save', function(next) {
  // Calcular costo total si no está definido
  if (this.costoUnitario && !this.costoTotal) {
    this.costoTotal = Math.abs(this.cantidad) * this.costoUnitario;
  }

  // Validar coherencia de stock
  const cantidadAbsoluta = Math.abs(this.cantidad);
  const diferenciaStock = Math.abs(this.stockNuevo - this.stockAnterior);

  if (cantidadAbsoluta !== diferenciaStock) {
    return next(new Error('La diferencia de stock no coincide con la cantidad'));
  }

  next();
});

// Método estático para crear transacción de entrada
inventoryTransactionSchema.statics.crearEntrada = function(data) {
  return this.create({
    ...data,
    tipoTransaccion: 'entrada',
    cantidad: Math.abs(data.cantidad)
  });
};

// Método estático para crear transacción de salida
inventoryTransactionSchema.statics.crearSalida = function(data) {
  return this.create({
    ...data,
    tipoTransaccion: 'salida',
    cantidad: -Math.abs(data.cantidad)
  });
};

// Método estático para obtener historial de un producto
inventoryTransactionSchema.statics.obtenerHistorial = function(productoId, opciones = {}) {
  const {
    fechaInicio,
    fechaFin,
    tipoTransaccion,
    limite = 100,
    pagina = 1
  } = opciones;

  const query = { producto: productoId, estado: { $ne: 'cancelada' } };

  if (fechaInicio || fechaFin) {
    query.fechaEfectiva = {};
    if (fechaInicio) query.fechaEfectiva.$gte = new Date(fechaInicio);
    if (fechaFin) query.fechaEfectiva.$lte = new Date(fechaFin);
  }

  if (tipoTransaccion) {
    query.tipoTransaccion = tipoTransaccion;
  }

  return this.find(query)
    .populate('usuario', 'nombre email')
    .sort({ fechaEfectiva: -1 })
    .limit(limite)
    .skip((pagina - 1) * limite);
};

// Método estático para revertir una transacción
inventoryTransactionSchema.statics.revertirTransaccion = async function(transaccionId, usuarioId, motivo) {
  const transaccion = await this.findById(transaccionId);

  if (!transaccion) {
    throw new Error('Transacción no encontrada');
  }

  if (transaccion.estado === 'revertida' || transaccion.estado === 'cancelada') {
    throw new Error('La transacción ya fue revertida o cancelada');
  }

  // Crear transacción inversa
  const transaccionReversa = await this.create({
    producto: transaccion.producto,
    tipoTransaccion: transaccion.tipoTransaccion,
    cantidad: -transaccion.cantidad,
    stockAnterior: transaccion.stockNuevo,
    stockNuevo: transaccion.stockAnterior,
    usuario: usuarioId,
    motivo: `Reversión: ${motivo || 'Sin motivo especificado'}`,
    costoUnitario: transaccion.costoUnitario,
    estado: 'completada',
    metadata: {
      transaccionOriginal: transaccionId
    }
  });

  // Marcar transacción original como revertida
  transaccion.estado = 'revertida';
  await transaccion.save();

  return transaccionReversa;
};

// Configurar toJSON
inventoryTransactionSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('InventoryTransaction', inventoryTransactionSchema);
