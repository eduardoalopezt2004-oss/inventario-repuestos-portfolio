const mongoose = require('mongoose');

const pagoSchema = new mongoose.Schema({
  fecha: { type: Date, default: Date.now },
  monto: { type: Number, required: true, min: 0 },
  montoBs: { type: Number, min: 0 },
  tasaBs: { type: Number, min: 0 },
  registradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const prorrogaSchema = new mongoose.Schema({
  fechaAnterior: { type: Date, required: true },
  fechaNueva: { type: Date, required: true },
  motivo: { type: String, trim: true, maxlength: 500 },
  otorgadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  fecha: { type: Date, default: Date.now }
});

const creditoSchema = new mongoose.Schema({
  venta: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', required: true },
  cliente: {
    nombre: { type: String, required: true, trim: true },
    cedula: { type: String, trim: true },
    telefono: { type: String, trim: true }
  },
  montoTotal: { type: Number, required: true, min: 0 },
  montoTotalBs: { type: Number, min: 0 },
  montoPagado: { type: Number, default: 0, min: 0 },
  montoPagadoBs: { type: Number, default: 0, min: 0 },
  tasaBs: { type: Number, min: 0 },
  pagos: [pagoSchema],
  estadoCredito: {
    type: String,
    enum: ['pendiente', 'parcial', 'cancelado', 'vencido'],
    default: 'pendiente'
  },
  fechaVencimiento: { type: Date, required: true },
  prorrogas: [prorrogaSchema]
}, { timestamps: true });

creditoSchema.virtual('montoPendiente').get(function () {
  return Math.max(0, this.montoTotal - this.montoPagado);
});

creditoSchema.virtual('montoPendienteBs').get(function () {
  return Math.max(0, this.montoTotalBs - this.montoPagadoBs);
});

creditoSchema.index({ 'cliente.cedula': 1 });
creditoSchema.index({ 'cliente.nombre': 'text' });
creditoSchema.index({ estadoCredito: 1 });
creditoSchema.index({ fechaVencimiento: 1 });

creditoSchema.set('toJSON', { virtuals: true });
creditoSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Credito', creditoSchema);
