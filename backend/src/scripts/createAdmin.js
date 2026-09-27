require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const createAdminUser = async () => {
  try {
    console.log('Conectando a MongoDB...');
    console.log('URI:', process.env.MONGODB_URI || 'mongodb://localhost:27017/inventario_repuestos');

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/inventario_repuestos');

    console.log('✓ Conectado a MongoDB exitosamente');

    // Verificar si ya existe un admin
    const adminExists = await User.findOne({ email: 'admin@repuestos.com' });

    if (adminExists) {
      console.log('\n✓ El usuario administrador ya existe');
      console.log('Email: admin@repuestos.com');
      console.log('\nSi olvidaste la contraseña, elimina el usuario de la base de datos y vuelve a ejecutar este script.');
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log('\nCreando usuario administrador...');

    // Crear usuario administrador
    const admin = await User.create({
      nombre: 'Administrador',
      email: 'admin@repuestos.com',
      password: 'admin123',
      rol: 'admin'
    });

    console.log('\n========================================');
    console.log('✓ Usuario administrador creado exitosamente');
    console.log('========================================');
    console.log('Email: admin@repuestos.com');
    console.log('Password: admin123');
    console.log('\n⚠️  IMPORTANTE: Cambia la contraseña después del primer inicio de sesión');
    console.log('========================================\n');

    await mongoose.connection.close();

    process.exit(0);
  } catch (error) {
    console.error('Error al crear usuario administrador:', error.message);
    process.exit(1);
  }
};

createAdminUser();
