const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  codigo: {
    type: String,
    required: [true, 'El código es requerido'],
    unique: true,
    trim: true,
    uppercase: true
  },
  nombre: {
    type: String,
    required: [true, 'El nombre de la categoría es requerido'],
    unique: true,
    trim: true
  },
  descripcion: {
    type: String,
    trim: true
  },
  marca: {
    type: String,
    trim: true
  },
  modelo: {
    type: String,
    trim: true
  },
  precioCompra: {
    type: Number,
    default: 0,
    min: 0
  },
  precioVenta: {
    type: Number,
    default: 0,
    min: 0
  },
  stock: {
    type: Number,
    default: 0,
    min: 0
  },
  stockMinimo: {
    type: Number,
    default: 5,
    min: 0
  },
  stockMaximo: {
    type: Number,
    min: 0,
    default: null
  },
  ubicacion: {
    type: String,
    trim: true
  },
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Índice para búsquedas rápidas
categorySchema.index({ codigo: 1, nombre: 1 });

module.exports = mongoose.model('Category', categorySchema);
