require('dotenv').config();
const mongoose = require('mongoose');

console.log('=================================');
console.log('VERIFICACIÓN DEL SISTEMA');
console.log('=================================\n');

// 1. Verificar variables de entorno
console.log('1. Variables de Entorno:');
console.log(`   PORT: ${process.env.PORT || 'NO CONFIGURADO'}`);
console.log(`   MONGODB_URI: ${process.env.MONGODB_URI || 'NO CONFIGURADO'}`);
console.log(`   JWT_SECRET: ${process.env.JWT_SECRET ? 'CONFIGURADO' : 'NO CONFIGURADO'}`);
console.log('');

// 2. Verificar conexión a MongoDB
console.log('2. Intentando conectar a MongoDB...');

const testConnection = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });

    console.log('   ✓ MongoDB conectado correctamente');
    console.log(`   Host: ${mongoose.connection.host}`);
    console.log(`   Base de datos: ${mongoose.connection.name}`);

    // 3. Verificar colecciones
    console.log('\n3. Colecciones en la base de datos:');
    const collections = await mongoose.connection.db.listCollections().toArray();
    if (collections.length === 0) {
      console.log('   No hay colecciones creadas aún');
    } else {
      collections.forEach(col => {
        console.log(`   - ${col.name}`);
      });
    }

    // 4. Verificar usuarios
    console.log('\n4. Verificando usuarios:');
    const User = require('./src/models/User');
    const users = await User.find();
    console.log(`   Total de usuarios: ${users.length}`);

    if (users.length > 0) {
      console.log('\n   Usuarios registrados:');
      users.forEach(user => {
        console.log(`   - ${user.email} (${user.rol}) - Activo: ${user.activo}`);
      });
    } else {
      console.log('   ⚠ No hay usuarios registrados. Ejecuta: node src/scripts/createAdmin.js');
    }

    // 5. Verificar categorías
    console.log('\n5. Verificando categorías:');
    const Category = require('./src/models/Category');
    const categories = await Category.find();
    console.log(`   Total de categorías: ${categories.length}`);

    if (categories.length > 0) {
      console.log('\n   Categorías registradas:');
      categories.forEach(cat => {
        console.log(`   - ${cat.nombre} (${cat.activo ? 'Activa' : 'Inactiva'})`);
      });
    }

    console.log('\n=================================');
    console.log('VERIFICACIÓN COMPLETADA');
    console.log('=================================');

    process.exit(0);
  } catch (error) {
    console.error('\n   ✗ Error al conectar a MongoDB:');
    console.error(`   ${error.message}`);
    console.log('\n   Posibles soluciones:');
    console.log('   1. Verificar que MongoDB esté instalado');
    console.log('   2. Iniciar el servicio de MongoDB');
    console.log('      - Windows: Abrir "Servicios" y buscar "MongoDB"');
    console.log('      - Linux/Mac: sudo systemctl start mongod');
    console.log('   3. Verificar la URI de conexión en .env');
    console.log('   4. Instalar MongoDB si no está instalado:');
    console.log('      https://www.mongodb.com/try/download/community');

    console.log('\n=================================');
    console.log('VERIFICACIÓN FALLIDA');
    console.log('=================================');

    process.exit(1);
  }
};

testConnection();
