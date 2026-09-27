require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Product = require('../models/Product');

const seedData = async () => {
  try {
    console.log('Conectando a MongoDB...');

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventario_repuestos');

    console.log('✓ Conectado a MongoDB exitosamente\n');

    // Crear categorías
    console.log('Creando categorías...');
    const categorias = await Category.create([
      {
        codigo: 'FLT',
        nombre: 'Filtros',
        descripcion: 'Filtros de aceite, aire y combustible',
        activo: true
      },
      {
        codigo: 'FRN',
        nombre: 'Frenos',
        descripcion: 'Pastillas, discos y componentes de freno',
        activo: true
      },
      {
        codigo: 'SUS',
        nombre: 'Suspensión',
        descripcion: 'Amortiguadores, resortes y componentes',
        activo: true
      },
      {
        codigo: 'MOT',
        nombre: 'Motor',
        descripcion: 'Repuestos y componentes de motor',
        activo: true
      },
      {
        codigo: 'TRN',
        nombre: 'Transmisión',
        descripcion: 'Componentes de transmisión y embrague',
        activo: true
      }
    ]);

    console.log(`✓ ${categorias.length} categorías creadas\n`);

    // Crear productos
    console.log('Creando productos...');
    const productos = await Product.create([
      {
        codigo: 'FLT-001',
        nombre: 'Filtro de Aceite Mann W719/30',
        descripcion: 'Filtro de aceite de alta calidad para motores gasolina',
        categoria: categorias[0]._id,
        marca: 'Mann Filter',
        modelo: 'W719/30',
        precioCompra: 8.50,
        precioVenta: 15.00,
        stock: 25,
        stockMinimo: 10,
        stockMaximo: 50,
        ubicacion: 'Estante A1',
        activo: true
      },
      {
        codigo: 'FLT-002',
        nombre: 'Filtro de Aire K&N 33-2304',
        descripcion: 'Filtro de aire deportivo reutilizable',
        categoria: categorias[0]._id,
        marca: 'K&N',
        modelo: '33-2304',
        precioCompra: 35.00,
        precioVenta: 65.00,
        stock: 8,
        stockMinimo: 5,
        stockMaximo: 20,
        ubicacion: 'Estante A2',
        activo: true
      },
      {
        codigo: 'FRN-001',
        nombre: 'Pastillas de Freno Delanteras Brembo P85073',
        descripcion: 'Pastillas de freno cerámicas de alto rendimiento',
        categoria: categorias[1]._id,
        marca: 'Brembo',
        modelo: 'P85073',
        precioCompra: 45.00,
        precioVenta: 85.00,
        stock: 12,
        stockMinimo: 8,
        stockMaximo: 30,
        ubicacion: 'Estante B1',
        activo: true
      },
      {
        codigo: 'FRN-002',
        nombre: 'Disco de Freno Delantero ATE 24.0122-0174.1',
        descripcion: 'Disco de freno ventilado 280mm',
        categoria: categorias[1]._id,
        marca: 'ATE',
        modelo: '24.0122-0174.1',
        precioCompra: 55.00,
        precioVenta: 95.00,
        stock: 6,
        stockMinimo: 4,
        stockMaximo: 15,
        ubicacion: 'Estante B2',
        activo: true
      },
      {
        codigo: 'SUS-001',
        nombre: 'Amortiguador Delantero Bilstein B4',
        descripcion: 'Amortiguador de gas presurizado',
        categoria: categorias[2]._id,
        marca: 'Bilstein',
        modelo: 'B4 22-112632',
        precioCompra: 75.00,
        precioVenta: 135.00,
        stock: 4,
        stockMinimo: 4,
        stockMaximo: 12,
        ubicacion: 'Estante C1',
        activo: true
      },
      {
        codigo: 'SUS-002',
        nombre: 'Resorte de Suspensión Eibach Pro-Kit',
        descripcion: 'Kit de resortes deportivos -25mm',
        categoria: categorias[2]._id,
        marca: 'Eibach',
        modelo: 'E10-15-021-02-22',
        precioCompra: 180.00,
        precioVenta: 320.00,
        stock: 3,
        stockMinimo: 2,
        stockMaximo: 8,
        ubicacion: 'Estante C2',
        activo: true
      },
      {
        codigo: 'MOT-001',
        nombre: 'Bujía NGK Iridium IX',
        descripcion: 'Bujía iridium de larga duración',
        categoria: categorias[3]._id,
        marca: 'NGK',
        modelo: 'BKR6EIX',
        precioCompra: 8.00,
        precioVenta: 14.50,
        stock: 40,
        stockMinimo: 20,
        stockMaximo: 80,
        ubicacion: 'Estante D1',
        activo: true
      },
      {
        codigo: 'MOT-002',
        nombre: 'Correa de Distribución Gates',
        descripcion: 'Correa de distribución reforzada',
        categoria: categorias[3]._id,
        marca: 'Gates',
        modelo: '5569XS',
        precioCompra: 25.00,
        precioVenta: 45.00,
        stock: 15,
        stockMinimo: 8,
        stockMaximo: 30,
        ubicacion: 'Estante D2',
        activo: true
      },
      {
        codigo: 'TRN-001',
        nombre: 'Kit de Embrague LuK',
        descripcion: 'Kit completo de embrague con disco, plato y cojinete',
        categoria: categorias[4]._id,
        marca: 'LuK',
        modelo: '623 3089 00',
        precioCompra: 145.00,
        precioVenta: 265.00,
        stock: 5,
        stockMinimo: 3,
        stockMaximo: 10,
        ubicacion: 'Estante E1',
        activo: true
      },
      {
        codigo: 'TRN-002',
        nombre: 'Aceite de Transmisión Motul Gear 300',
        descripcion: 'Aceite sintético para transmisiones manuales 75W90',
        categoria: categorias[4]._id,
        marca: 'Motul',
        modelo: 'Gear 300 75W90',
        precioCompra: 18.00,
        precioVenta: 32.00,
        stock: 20,
        stockMinimo: 10,
        stockMaximo: 40,
        ubicacion: 'Estante E2',
        activo: true
      },
      {
        codigo: 'FRN-003',
        nombre: 'Líquido de Frenos DOT 4 Bosch',
        descripcion: 'Líquido de frenos sintético de alto rendimiento 1L',
        categoria: categorias[1]._id,
        marca: 'Bosch',
        modelo: 'DOT 4 ESI',
        precioCompra: 6.50,
        precioVenta: 12.00,
        stock: 30,
        stockMinimo: 15,
        stockMaximo: 50,
        ubicacion: 'Estante B3',
        activo: true
      },
      {
        codigo: 'MOT-003',
        nombre: 'Aceite Motor Castrol Edge 5W30',
        descripcion: 'Aceite sintético de motor 5W30 4L',
        categoria: categorias[3]._id,
        marca: 'Castrol',
        modelo: 'Edge 5W30',
        precioCompra: 32.00,
        precioVenta: 58.00,
        stock: 18,
        stockMinimo: 10,
        stockMaximo: 40,
        ubicacion: 'Estante D3',
        activo: true
      }
    ]);

    console.log(`✓ ${productos.length} productos creados\n`);

    console.log('========================================');
    console.log('✓ Datos de prueba creados exitosamente');
    console.log('========================================');
    console.log(`Categorías: ${categorias.length}`);
    console.log(`Productos: ${productos.length}`);
    console.log('========================================\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error al crear datos de prueba:', error.message);
    process.exit(1);
  }
};

seedData();
