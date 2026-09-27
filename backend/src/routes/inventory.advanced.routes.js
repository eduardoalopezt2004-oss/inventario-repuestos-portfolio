const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.advanced.controller');
const { protect } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Inventory Advanced
 *   description: Sistema avanzado de gestión de inventario con sincronización y reportes
 */

/**
 * @swagger
 * /api/inventory-advanced/update-stock:
 *   post:
 *     summary: Actualizar stock de un producto
 *     tags: [Inventory Advanced]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productoId
 *               - cantidad
 *               - tipoTransaccion
 *             properties:
 *               productoId:
 *                 type: string
 *               cantidad:
 *                 type: number
 *               tipoTransaccion:
 *                 type: string
 *                 enum: [entrada, salida, ajuste_positivo, ajuste_negativo, transferencia, merma, inicial]
 *               motivo:
 *                 type: string
 *               referenciaVenta:
 *                 type: string
 *               referenciaCompra:
 *                 type: string
 *               costoUnitario:
 *                 type: number
 *               ubicacionOrigen:
 *                 type: string
 *               ubicacionDestino:
 *                 type: string
 *     responses:
 *       200:
 *         description: Stock actualizado exitosamente
 *       400:
 *         description: Error en la solicitud
 */
router.post('/update-stock', protect, inventoryController.actualizarStock);

/**
 * @swagger
 * /api/inventory-advanced/adjust:
 *   post:
 *     summary: Ajustar stock (corrección de inventario)
 *     tags: [Inventory Advanced]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productoId
 *               - stockReal
 *             properties:
 *               productoId:
 *                 type: string
 *               stockReal:
 *                 type: number
 *               motivo:
 *                 type: string
 *     responses:
 *       200:
 *         description: Stock ajustado exitosamente
 */
router.post('/adjust', protect, inventoryController.ajustarStock);

/**
 * @swagger
 * /api/inventory-advanced/merma:
 *   post:
 *     summary: Registrar merma de producto
 *     tags: [Inventory Advanced]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productoId
 *               - cantidad
 *             properties:
 *               productoId:
 *                 type: string
 *               cantidad:
 *                 type: number
 *               motivo:
 *                 type: string
 *     responses:
 *       200:
 *         description: Merma registrada exitosamente
 */
router.post('/merma', protect, inventoryController.registrarMerma);

/**
 * @swagger
 * /api/inventory-advanced/transfer:
 *   post:
 *     summary: Transferir stock entre ubicaciones
 *     tags: [Inventory Advanced]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productoId
 *               - cantidad
 *               - ubicacionOrigen
 *               - ubicacionDestino
 *             properties:
 *               productoId:
 *                 type: string
 *               cantidad:
 *                 type: number
 *               ubicacionOrigen:
 *                 type: string
 *               ubicacionDestino:
 *                 type: string
 *               motivo:
 *                 type: string
 *     responses:
 *       200:
 *         description: Stock transferido exitosamente
 */
router.post('/transfer', protect, inventoryController.transferirStock);

/**
 * @swagger
 * /api/inventory-advanced/history/{productoId}:
 *   get:
 *     summary: Obtener historial de movimientos de un producto
 *     tags: [Inventory Advanced]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productoId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: fechaInicio
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: fechaFin
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: tipoTransaccion
 *         schema:
 *           type: string
 *       - in: query
 *         name: limite
 *         schema:
 *           type: number
 *       - in: query
 *         name: pagina
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Historial obtenido exitosamente
 */
router.get('/history/:productoId', protect, inventoryController.obtenerHistorial);

/**
 * @swagger
 * /api/inventory-advanced/transactions:
 *   get:
 *     summary: Obtener todas las transacciones con filtros
 *     tags: [Inventory Advanced]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fechaInicio
 *         schema:
 *           type: string
 *       - in: query
 *         name: fechaFin
 *         schema:
 *           type: string
 *       - in: query
 *         name: tipoTransaccion
 *         schema:
 *           type: string
 *       - in: query
 *         name: usuarioId
 *         schema:
 *           type: string
 *       - in: query
 *         name: productoId
 *         schema:
 *           type: string
 *       - in: query
 *         name: limite
 *         schema:
 *           type: number
 *       - in: query
 *         name: pagina
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Transacciones obtenidas exitosamente
 */
router.get('/transactions', protect, inventoryController.obtenerTransacciones);

/**
 * @swagger
 * /api/inventory-advanced/critical-stock:
 *   get:
 *     summary: Obtener productos con stock crítico
 *     tags: [Inventory Advanced]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stock crítico obtenido exitosamente
 */
router.get('/critical-stock', protect, inventoryController.obtenerStockCritico);

/**
 * @swagger
 * /api/inventory-advanced/sync:
 *   get:
 *     summary: Sincronizar stock global (validación de integridad)
 *     tags: [Inventory Advanced]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sincronización completada
 */
router.get('/sync', protect, inventoryController.sincronizarStock);

/**
 * @swagger
 * /api/inventory-advanced/summary:
 *   get:
 *     summary: Obtener resumen de movimientos por período
 *     tags: [Inventory Advanced]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fechaInicio
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: fechaFin
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Resumen obtenido exitosamente
 */
router.get('/summary', protect, inventoryController.obtenerResumen);

/**
 * @swagger
 * /api/inventory-advanced/stats:
 *   get:
 *     summary: Obtener estadísticas generales de inventario
 *     tags: [Inventory Advanced]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas exitosamente
 */
router.get('/stats', protect, inventoryController.obtenerEstadisticas);

/**
 * @swagger
 * /api/inventory-advanced/report:
 *   post:
 *     summary: Generar reporte consolidado de inventario
 *     tags: [Inventory Advanced]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fechaInicio:
 *                 type: string
 *               fechaFin:
 *                 type: string
 *               incluirTransacciones:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Reporte generado exitosamente
 */
router.post('/report', protect, inventoryController.generarReporte);

/**
 * @swagger
 * /api/inventory-advanced/revert/{transaccionId}:
 *   post:
 *     summary: Revertir una transacción
 *     tags: [Inventory Advanced]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transaccionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               motivo:
 *                 type: string
 *     responses:
 *       200:
 *         description: Transacción revertida exitosamente
 */
router.post('/revert/:transaccionId', protect, inventoryController.revertirTransaccion);

module.exports = router;
