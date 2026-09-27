/**
 * Script de migración: stock global → stockDeposito / stockLocal
 *
 * Ejecutar una sola vez:
 *   node src/scripts/migrateStockLocations.js
 *
 * Asume que todo el stock existente estaba en el local.
 * stockMinimo existente → stockMinimoLocal; stockMinimoDeposito toma el mismo valor.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/administracion_inventario';

async function migrate() {
  await mongoose.connect(MONGO_URI);
  console.log('Conectado a MongoDB');

  const db = mongoose.connection.db;
  const collection = db.collection('products');

  const productos = await collection.find({}).toArray();
  console.log(`Productos encontrados: ${productos.length}`);

  let actualizados = 0;
  let omitidos = 0;

  for (const p of productos) {
    // Si ya tiene los nuevos campos, omitir
    if (p.stockLocal !== undefined || p.stockDeposito !== undefined) {
      omitidos++;
      continue;
    }

    const stockActual = typeof p.stock === 'number' ? p.stock : 0;
    const stockMinimoActual = typeof p.stockMinimo === 'number' ? p.stockMinimo : 5;

    await collection.updateOne(
      { _id: p._id },
      {
        $set: {
          stockLocal: stockActual,
          stockDeposito: 0,
          stockMinimoLocal: stockMinimoActual,
          stockMinimoDeposito: stockMinimoActual
        },
        $unset: { stock: '', stockMinimo: '' }
      }
    );

    actualizados++;
  }

  console.log(`Migración completa: ${actualizados} actualizados, ${omitidos} omitidos (ya migrados)`);
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Error en migración:', err);
  process.exit(1);
});
