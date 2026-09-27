const mongoose = require('mongoose');

const tasaBCVSchema = new mongoose.Schema({
  _id: { type: String, default: 'singleton' },
  tasa: { type: Number, required: true },
  fechaActualizacion: { type: String },
  actualizadoEn: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TasaBCV', tasaBCVSchema);
