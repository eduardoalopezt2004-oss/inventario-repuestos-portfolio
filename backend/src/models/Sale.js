const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  producto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  cantidad: {
    type: Number,
    required: true,
    min: 1
  },
  precioUnitario: {
    type: Number,
    required: true,
    min: 0
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  // Equivalentes en Bs al momento del registro (fijos, no se recalculan)
  precioUnitarioBs: { type: Number, min: 0 },
  subtotalBs: { type: Number, min: 0 }
});

const saleSchema = new mongoose.Schema({
  numeroVenta: {
    type: String,
    unique: true
  },
  items: [saleItemSchema],
  total: {
    type: Number,
    required: true,
    min: 0
  },
  vendedor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cliente: {
    nombre: {
      type: String,
      trim: true
    },
    cedula: {
      type: String,
      trim: true
    },
    telefono: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true
    }
  },
  metodoPago: {
    type: String,
    enum: ['efectivo', 'tarjeta', 'transferencia', 'pago_movil', 'divisa', 'otro'],
    default: 'efectivo'
  },
  tasaBs: {
    type: Number,
    min: 0
  },
  totalBs: {
    type: Number,
    min: 0
  },
  estado: {
    type: String,
    enum: ['completada', 'cancelada', 'pendiente'],
    default: 'completada'
  },
  esCredito: { type: Boolean, default: false },
  abonoInicial: { type: Number, default: 0, min: 0 },
  // Tasa de cambio y total en Bs al momento del registro (fijos)
  tasaBs: { type: Number, min: 0 },
  totalBs: { type: Number, min: 0 }
}, {
  timestamps: true
});

// Auto-generar número de venta
saleSchema.pre('save', async function(next) {
  if (!this.numeroVenta) {
    const count = await mongoose.model('Sale').countDocuments();
    this.numeroVenta = `VTA-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Sale', saleSchema);
