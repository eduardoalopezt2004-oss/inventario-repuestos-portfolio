require('dotenv').config();
const mongoose = require('mongoose');

const Sale = require('../models/Sale');
const Credito = require('../models/Credito');
const InventoryMovement = require('../models/InventoryMovement');
const InventoryTransaction = require('../models/InventoryTransaction');
const Product = require('../models/Product');
const Category = require('../models/Category');
const User = require('../models/User');

const clearData = async () => {
  try {
    console.log('Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventario_repuestos');
    console.log('✓ Conectado\n');

    console.log('Eliminando ventas...');
    const ventas = await Sale.deleteMany({});
    console.log(`  ✓ ${ventas.deletedCount} ventas eliminadas`);

    console.log('Eliminando créditos...');
    const creditos = await Credito.deleteMany({});
    console.log(`  ✓ ${creditos.deletedCount} créditos eliminados`);

    console.log('Eliminando movimientos de inventario...');
    const movimientos = await InventoryMovement.deleteMany({});
    console.log(`  ✓ ${movimientos.deletedCount} movimientos eliminados`);

    console.log('Eliminando transacciones de inventario...');
    const transacciones = await InventoryTransaction.deleteMany({});
    console.log(`  ✓ ${transacciones.deletedCount} transacciones eliminadas`);

    console.log('Eliminando productos...');
    const productos = await Product.deleteMany({});
    console.log(`  ✓ ${productos.deletedCount} productos eliminados`);

    console.log('Eliminando categorías...');
    const categorias = await Category.deleteMany({});
    console.log(`  ✓ ${categorias.deletedCount} categorías eliminadas`);

    console.log('Eliminando usuarios de prueba (conservando admin)...');
    const usuarios = await User.deleteMany({ email: { $ne: 'admin@repuestos.com' } });
    console.log(`  ✓ ${usuarios.deletedCount} usuarios eliminados`);

    console.log('\n========================================');
    console.log('✓ Base de datos limpiada exitosamente');
    console.log('  El usuario admin@repuestos.com fue conservado.');
    console.log('  El sistema está listo para datos reales.');
    console.log('========================================\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error al limpiar datos:', error.message);
    process.exit(1);
  }
};

clearData();
