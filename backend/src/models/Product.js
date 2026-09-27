const mongoose = require('mongoose');
const { getStockIndicator } = require('../utils/stockIndicator');

const productSchema = new mongoose.Schema({
  codigo: {
    type: String,
    required: [true, 'El código es requerido'],
    unique: true,
    trim: true
  },
  nombre: {
    type: String,
    required: [true, 'El nombre es requerido'],
    trim: true
  },
  descripcion: {
    type: String,
    trim: true
  },
  categoria: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  marca: {
    type: String,
    trim: true,
    minlength: [2, 'La marca debe tener al menos 2 caracteres']
  },
  modelo: {
    type: String,
    trim: true
  },
  precioCompra: {
    type: Number,
    required: [true, 'El precio de compra es requerido'],
    min: 0
  },
  precioVenta: {
    type: Number,
    required: [true, 'El precio de venta es requerido'],
    min: 0
  },
  stockDeposito: {
    type: Number,
    min: 0,
    default: 0
  },
  stockLocal: {
    type: Number,
    min: 0,
    default: 0
  },
  stockMinimoLocal: {
    type: Number,
    default: 5,
    min: 0
  },
  stockMinimoDeposito: {
    type: Number,
    default: 5,
    min: 0
  },
  stockMaximo: {
    type: Number,
    min: 0
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
productSchema.index({ codigo: 1, nombre: 1 });

// Genera el siguiente código correlativo para productos sin código de barras propio
productSchema.statics.generarCodigoAutomatico = async function() {
  const ultimo = await this.findOne({ codigo: /^AUTO-\d+$/ }).sort({ codigo: -1 });
  const siguiente = ultimo ? parseInt(ultimo.codigo.replace('AUTO-', ''), 10) + 1 : 1;
  return `AUTO-${String(siguiente).padStart(6, '0')}`;
};

// Auto-generar código cuando el producto no maneja código de barras propio
productSchema.pre('validate', async function(next) {
  if (!this.codigo || !this.codigo.trim()) {
    this.codigo = await this.constructor.generarCodigoAutomatico();
  }
  next();
});

// Virtual: stock total (suma depósito + local) para compatibilidad con código existente
productSchema.virtual('stock').get(function() {
  return (this.stockDeposito || 0) + (this.stockLocal || 0);
});

// Virtual: stockMinimo apunta a stockMinimoLocal para compatibilidad
productSchema.virtual('stockMinimo').get(function() {
  return this.stockMinimoLocal;
});

// Virtual: indicador del local (lo que se vende)
productSchema.virtual('indicadorStockLocal').get(function() {
  try {
    return getStockIndicator(this.stockLocal || 0, this.stockMinimoLocal || 5, this.stockMaximo || null);
  } catch {
    return { status: 'verde', requiereAtencion: false, esUrgente: false };
  }
});

// Virtual: indicador del depósito
productSchema.virtual('indicadorStockDeposito').get(function() {
  try {
    return getStockIndicator(this.stockDeposito || 0, this.stockMinimoDeposito || 5, null);
  } catch {
    return { status: 'verde', requiereAtencion: false, esUrgente: false };
  }
});

// Virtual legacy: usa local como referencia principal (lo que se vende)
productSchema.virtual('indicadorStock').get(function() {
  return this.indicadorStockLocal;
});

// Método de instancia para obtener el indicador de stock
productSchema.methods.getIndicadorStock = function() {
  return this.indicadorStockLocal;
};

// Método estático para obtener productos por estado de stock
productSchema.statics.findByStockStatus = function(status) {
  const { getStockStatus } = require('../utils/stockIndicator');

  return this.find({ activo: true }).then(productos => {
    return productos.filter(producto => {
      const stockStatus = getStockStatus(
        producto.stockLocal || 0,
        producto.stockMinimoLocal || 5,
        producto.stockMaximo
      );
      return stockStatus === status;
    });
  });
};

// Método estático para obtener productos que requieren atención
productSchema.statics.findRequiringAttention = async function() {
  const productos = await this.find({ activo: true });
  return productos.filter(producto => {
    const indicadorLocal = producto.indicadorStockLocal;
    const indicadorDeposito = producto.indicadorStockDeposito;
    return indicadorLocal.requiereAtencion || indicadorDeposito.requiereAtencion;
  });
};

// Configurar toJSON para incluir virtuals - DESHABILITADO TEMPORALMENTE
// productSchema.set('toJSON', { virtuals: true });
// productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
