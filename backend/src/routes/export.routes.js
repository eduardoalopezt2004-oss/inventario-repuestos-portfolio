const express = require('express');
const router = express.Router();
const { exportarDatos, importarDatos } = require('../controllers/export.controller');
const { protect, authorize } = require('../middleware/auth');

// Exportar todos los datos
router.get('/', protect, authorize('admin'), exportarDatos);

// Importar datos desde JSON (límite 50mb para archivos grandes)
router.post(
  '/import',
  protect,
  authorize('admin'),
  express.json({ limit: '50mb' }),
  importarDatos
);

module.exports = router;
