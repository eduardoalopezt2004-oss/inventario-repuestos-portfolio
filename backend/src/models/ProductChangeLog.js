const mongoose = require('mongoose');

const productChangeLogSchema = new mongoose.Schema({
  producto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'El producto es requerido']
  },
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El usuario es requerido']
  },
  cambios: [{
    campo: { type: String, required: true },
    valorAnterior: { type: mongoose.Schema.Types.Mixed },
    valorNuevo: { type: mongoose.Schema.Types.Mixed }
  }]
}, {
  timestamps: true
});

productChangeLogSchema.index({ producto: 1, createdAt: -1 });

module.exports = mongoose.model('ProductChangeLog', productChangeLogSchema);
