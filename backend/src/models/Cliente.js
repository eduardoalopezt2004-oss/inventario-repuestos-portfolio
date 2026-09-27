const mongoose = require('mongoose');

const clienteSchema = new mongoose.Schema({
  nombre:   { type: String, required: true, trim: true },
  cedula:   { type: String, trim: true, default: '' },
  telefono: { type: String, trim: true, default: '' }
}, { timestamps: true });

// Índice para búsqueda rápida por nombre o cédula
clienteSchema.index({ nombre: 1 });
clienteSchema.index({ cedula: 1 }, { sparse: true });

module.exports = mongoose.model('Cliente', clienteSchema);
