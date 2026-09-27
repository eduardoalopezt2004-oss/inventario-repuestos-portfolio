// Script para iniciar el servidor con MongoDB en memoria
// Útil para desarrollo sin necesidad de instalar MongoDB

require('dotenv').config();
const { MongoMemoryServer } = require('mongodb-memory-server');
const { spawn } = require('child_process');

async function startWithMemoryDB() {
  try {
    console.log('========================================');
    console.log('  Iniciando MongoDB en Memoria...');
    console.log('========================================\n');

    // Crear instancia de MongoDB en memoria
    const mongod = await MongoMemoryServer.create({
      instance: {
        port: 27017,
        dbName: 'inventario_repuestos'
      }
    });

    const uri = mongod.getUri();
    console.log('✓ MongoDB en memoria iniciado');
    console.log('✓ URI:', uri);
    console.log('\n========================================');
    console.log('  Iniciando Servidor Backend...');
    console.log('========================================\n');

    // Establecer la URI en el ambiente
    process.env.MONGODB_URI = uri;

    // Iniciar el servidor
    const server = spawn('node', ['src/server.js'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        MONGODB_URI: uri
      }
    });

    // Manejar cierre
    process.on('SIGINT', async () => {
      console.log('\n\nCerrando servidor...');
      server.kill();
      await mongod.stop();
      process.exit(0);
    });

    console.log('\n✓ Sistema iniciado con MongoDB en memoria');
    console.log('✓ Backend: http://localhost:5000');
    console.log('✓ Frontend: Inicia con "npm start" en la carpeta frontend');
    console.log('\nPresiona Ctrl+C para detener\n');

  } catch (error) {
    console.error('Error al iniciar:', error);
    process.exit(1);
  }
}

startWithMemoryDB();
