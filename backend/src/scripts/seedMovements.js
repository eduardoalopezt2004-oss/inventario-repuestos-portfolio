require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const InventoryMovement = require('../models/InventoryMovement');

const seedMovements = async () => {
  try {
    console.log('Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventario_repuestos');
    console.log('✓ Conectado\n');

    // Buscar usuario admin
    let adminUser = await User.findOne({ rol: 'admin' });
    if (!adminUser) {
      console.log('Creando usuario administrador...');
      adminUser = await User.create({
        nombre: 'Administrador',
        email: 'admin@repuestos.com',
        password: 'admin123',
        rol: 'admin'
      });
      console.log('✓ Admin creado: admin@repuestos.com / admin123');
    }

    // Buscar productos
    const productos = await Product.find({ activo: true });
    if (productos.length === 0) {
      console.error('No se encontraron productos. Ejecuta seedData.js primero.');
      process.exit(1);
    }
    console.log(`✓ ${productos.length} productos encontrados`);

    // Eliminar movimientos existentes
    const existingCount = await InventoryMovement.countDocuments();
    if (existingCount > 0) {
      await InventoryMovement.deleteMany({});
      console.log(`✓ ${existingCount} movimientos anteriores eliminados`);
    }

    const movimientos = [];
    const now = new Date();
    let docCounter = 1000;

    for (const producto of productos) {
      // 4-6 entradas distribuidas en los últimos 30 días
      const numEntradas = Math.floor(Math.random() * 3) + 4;
      for (let i = 0; i < numEntradas; i++) {
        const diasAtras = Math.floor(Math.random() * 29) + 1;
        const fecha = new Date(now.getTime() - diasAtras * 24 * 60 * 60 * 1000);
        const cantidad = Math.floor(Math.random() * 15) + 5;

        movimientos.push({
          _id: new mongoose.Types.ObjectId(),
          producto: producto._id,
          tipo: 'ENTRADA',
          cantidad,
          precioUnitario: producto.precioCompra,
          costoTotal: producto.precioCompra * cantidad,
          stockAnterior: Math.max(0, producto.stock - cantidad),
          stockNuevo: producto.stock,
          motivo: 'Reposición de inventario',
          numeroDocumento: `FAC-${String(docCounter++).padStart(6, '0')}`,
          proveedor: producto.marca || 'Proveedor General',
          usuario: adminUser._id,
          aprobado: true,
          cancelado: false,
          createdAt: fecha,
          updatedAt: fecha
        });
      }

      // 2-4 salidas en los últimos 20 días
      const numSalidas = Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < numSalidas; i++) {
        const diasAtras = Math.floor(Math.random() * 19) + 1;
        const fecha = new Date(now.getTime() - diasAtras * 24 * 60 * 60 * 1000);
        const cantidad = Math.floor(Math.random() * 4) + 1;

        movimientos.push({
          _id: new mongoose.Types.ObjectId(),
          producto: producto._id,
          tipo: 'SALIDA',
          cantidad,
          stockAnterior: producto.stock + cantidad,
          stockNuevo: producto.stock,
          motivo: 'Venta a cliente',
          usuario: adminUser._id,
          aprobado: true,
          cancelado: false,
          createdAt: fecha,
          updatedAt: fecha
        });
      }
    }

    // Insertar directamente en la colección para respetar las fechas personalizadas
    await InventoryMovement.collection.insertMany(movimientos);

    const entradas = movimientos.filter(m => m.tipo === 'ENTRADA').length;
    const salidas = movimientos.filter(m => m.tipo === 'SALIDA').length;

    console.log('\n========================================');
    console.log('✓ Movimientos de inventario creados');
    console.log('========================================');
    console.log(`  Total:   ${movimientos.length}`);
    console.log(`  Entradas: ${entradas}`);
    console.log(`  Salidas:  ${salidas}`);
    console.log('========================================');
    console.log('\nLos gráficos del dashboard ahora mostrarán datos.');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

seedMovements();
