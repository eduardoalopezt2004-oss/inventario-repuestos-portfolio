const express = require('express');
const router = express.Router();
const monitoringController = require('../controllers/monitoring.controller');
const { protect } = require('../middleware/auth');

/**
 * @swagger
 * /api/monitoring/kpis:
 *   get:
 *     summary: Obtener KPIs de monitoreo de stock en tiempo real
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: KPIs obtenidos exitosamente
 */
router.get('/kpis', protect, monitoringController.getStockMonitoringKPIs);

/**
 * @swagger
 * /api/monitoring/products-by-status:
 *   get:
 *     summary: Obtener productos filtrados por estado de stock
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [normal, bajo, critico, sin-stock]
 *         description: Estado de stock a filtrar
 *     responses:
 *       200:
 *         description: Productos obtenidos exitosamente
 */
router.get('/products-by-status', protect, monitoringController.getProductsByStockStatus);

/**
 * @swagger
 * /api/monitoring/product-trend/{productId}:
 *   get:
 *     summary: Obtener tendencia de stock de un producto específico
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del producto
 *       - in: query
 *         name: dias
 *         schema:
 *           type: number
 *           default: 30
 *         description: Número de días hacia atrás para analizar
 *     responses:
 *       200:
 *         description: Tendencia obtenida exitosamente
 */
router.get('/product-trend/:productId', protect, monitoringController.getProductStockTrend);

module.exports = router;
