const mongoose = require('mongoose');

const inventoryMovementSchema = new mongoose.Schema({
  producto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'El producto es requerido']
  },
  tipo: {
    type: String,
    enum: {
      values: ['ENTRADA', 'SALIDA', 'AJUSTE_ENTRADA', 'AJUSTE_SALIDA', 'DEVOLUCION'],
      message: '{VALUE} no es un tipo de movimiento válido'
    },
    required: [true, 'El tipo de movimiento es requerido']
  },
  cantidad: {
    type: Number,
    required: [true, 'La cantidad es requerida'],
    min: [1, 'La cantidad debe ser mayor a 0'],
    validate: {
      validator: Number.isInteger,
      message: 'La cantidad debe ser un número entero'
    }
  },
  precioUnitario: {
    type: Number,
    required: function() {
      return this.tipo === 'ENTRADA';
    },
    min: [0, 'El precio unitario no puede ser negativo']
  },
  costoTotal: {
    type: Number,
    min: 0
  },
  // Equivalentes en Bs al momento del registro (fijos, no se recalculan)
  tasaBs: { type: Number, min: 0 },
  precioUnitarioBs: { type: Number, min: 0 },
  costoTotalBs: { type: Number, min: 0 },
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
  motivo: {
    type: String,
    required: [true, 'El motivo es requerido'],
    trim: true,
    minlength: [5, 'El motivo debe tener al menos 5 caracteres'],
    maxlength: [500, 'El motivo no puede exceder 500 caracteres']
  },
  numeroDocumento: {
    type: String,
    trim: true
  },
  proveedor: {
    type: String,
    trim: true,
    required: function() {
      return this.tipo === 'ENTRADA';
    }
  },
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El usuario es requerido']
  },
  observaciones: {
    type: String,
    trim: true,
    maxlength: [1000, 'Las observaciones no pueden exceder 1000 caracteres']
  },
  aprobado: {
    type: Boolean,
    default: function() {
      // Ajustes requieren aprobación, entradas/salidas no
      return !['AJUSTE_ENTRADA', 'AJUSTE_SALIDA'].includes(this.tipo);
    }
  },
  aprobadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  fechaAprobacion: {
    type: Date
  },
  tasaBs: {
    type: Number,
    min: 0
  },
  precioUnitarioBs: {
    type: Number,
    min: 0
  },
  costoTotalBs: {
    type: Number,
    min: 0
  },
  cancelado: {
    type: Boolean,
    default: false
  },
  motivoCancelacion: {
    type: String,
    trim: true
  },
  fechaCancelacion: {
    type: Date
  }
}, {
  timestamps: true
});

// Índices para búsquedas eficientes
inventoryMovementSchema.index({ producto: 1, createdAt: -1 });
inventoryMovementSchema.index({ tipo: 1, createdAt: -1 });
inventoryMovementSchema.index({ usuario: 1 });
inventoryMovementSchema.index({ numeroDocumento: 1 }, { sparse: true });
inventoryMovementSchema.index({ aprobado: 1, tipo: 1 });

// Middleware pre-save para calcular costo total
inventoryMovementSchema.pre('save', function(next) {
  if (this.precioUnitario && this.cantidad) {
    this.costoTotal = this.precioUnitario * this.cantidad;
  }
  next();
});

// Virtual para calcular diferencia
inventoryMovementSchema.virtual('diferencia').get(function() {
  return this.stockNuevo - this.stockAnterior;
});

// Método para verificar si un movimiento puede ser cancelado
inventoryMovementSchema.methods.puedeCancelar = function() {
  // No se puede cancelar si ya está cancelado
  if (this.cancelado) {
    return { puede: false, razon: 'El movimiento ya está cancelado' };
  }

  // No se puede cancelar movimientos muy antiguos (más de 30 días)
  const treintaDias = 30 * 24 * 60 * 60 * 1000;
  if (Date.now() - this.createdAt.getTime() > treintaDias) {
    return { puede: false, razon: 'No se pueden cancelar movimientos con más de 30 días' };
  }

  // Los ajustes deben estar aprobados para poder cancelarse
  if (['AJUSTE_ENTRADA', 'AJUSTE_SALIDA'].includes(this.tipo) && !this.aprobado) {
    return { puede: false, razon: 'No se puede cancelar un ajuste no aprobado' };
  }

  return { puede: true };
};

// Método estático para obtener movimientos por producto
inventoryMovementSchema.statics.obtenerHistorial = function(productoId, opciones = {}) {
  const query = { producto: productoId, cancelado: false };

  if (opciones.tipo) {
    query.tipo = opciones.tipo;
  }

  if (opciones.fechaDesde) {
    query.createdAt = { ...query.createdAt, $gte: new Date(opciones.fechaDesde) };
  }

  if (opciones.fechaHasta) {
    query.createdAt = { ...query.createdAt, $lte: new Date(opciones.fechaHasta) };
  }

  return this.find(query)
    .populate('producto', 'codigo nombre')
    .populate('usuario', 'nombre email')
    .populate('aprobadoPor', 'nombre email')
    .sort('-createdAt')
    .limit(opciones.limite || 100);
};

// Configurar toJSON para incluir virtuals
inventoryMovementSchema.set('toJSON', { virtuals: true });
inventoryMovementSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('InventoryMovement', inventoryMovementSchema);
