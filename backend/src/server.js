require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const connectDB = require('./config/database');
const swaggerSpec = require('./config/swagger');

// Importar rutas
const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const categoryRoutes = require('./routes/category.routes');
const saleRoutes = require('./routes/sale.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const inventoryAdvancedRoutes = require('./routes/inventory.advanced.routes');
const monitoringRoutes = require('./routes/monitoring.routes');
const importRoutes = require('./routes/import.routes');
const dolarRoutes = require('./routes/dolar.routes');
const exportRoutes = require('./routes/export.routes');
const creditoRoutes = require('./routes/credito.routes');
const clienteRoutes = require('./routes/cliente.routes');

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// Conectar a la base de datos
connectDB();

// ── Seguridad de cabeceras HTTP ──
// CSP desactivado: este backend solo sirve JSON (el frontend real es la SPA
// en Vercel), la única página HTML que sirve es Swagger, que se desactiva
// en producción más abajo — así evitamos que un CSP por defecto rompa esa
// página sin ganar nada, ya que no hay contenido HTML propio que proteger.
app.use(helmet({ contentSecurityPolicy: false }));

// ── CORS restringido a los orígenes conocidos del frontend ──
const ORIGENES_PERMITIDOS = [
  'http://localhost:3000',
  'https://inventario-lubrieduarcars.vercel.app'
];
// Despliegues de vista previa de Vercel para este mismo proyecto (opcional).
const ORIGEN_VERCEL_PREVIEW = /^https:\/\/inventario-lubrieduarcars(-[a-z0-9-]+)?\.vercel\.app$/;

app.use(cors({
  origin(origin, callback) {
    // Sin header Origin (curl, apps móviles, servidor a servidor): permitir.
    if (!origin) return callback(null, true);
    const permitido = ORIGENES_PERMITIDOS.includes(origin) || ORIGEN_VERCEL_PREVIEW.test(origin);
    // false (no un error) = simplemente no se añaden las cabeceras CORS para
    // ese origen; el navegador bloqueará la lectura de la respuesta, pero la
    // petición no se corta con un 500 para clientes que no sean el navegador.
    callback(null, permitido);
  }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sanea el body/params contra inyección NoSQL (claves como "$gt", "$where", etc.)
app.use(mongoSanitize());

// ── Límite general de peticiones (defensa contra abuso/scripts) ──
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiadas solicitudes, intenta de nuevo en unos minutos' }
}));

// Documentación Swagger — solo fuera de producción (evita exponer el mapa
// completo de la API públicamente).
if (!isProd) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'API Inventario - Documentación'
  }));
}

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({
    message: 'API Sistema de Inventario de Repuestos',
    version: '1.0.0',
    documentation: isProd ? undefined : '/api-docs'
  });
});

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/inventory-advanced', inventoryAdvancedRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/import', importRoutes);
app.use('/api/dolar', dolarRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/creditos', creditoRoutes);
app.use('/api/clientes', clienteRoutes);

// Manejo de errores — el detalle completo solo se loguea en el servidor;
// al cliente, en producción, se le devuelve un mensaje genérico para no
// filtrar detalles internos (nombres de campos, mensajes de Mongoose, etc.).
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: 'Error del servidor',
    ...(isProd ? {} : { error: err.message })
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
