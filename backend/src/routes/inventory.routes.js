const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const inventoryController = require('../controllers/inventory.controller');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

/**
 * @swagger
 * components:
 *   schemas:
 *     InventoryMovement:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         producto:
 *           type: string
 *         tipo:
 *           type: string
 *           enum: [ENTRADA, SALIDA, AJUSTE_ENTRADA, AJUSTE_SALIDA, DEVOLUCION]
 *         cantidad:
 *           type: integer
 *         precioUnitario:
 *           type: number
 *         costoTotal:
 *           type: number
 *         stockAnterior:
 *           type: integer
 *         stockNuevo:
 *           type: integer
 *         motivo:
 *           type: string
 *         numeroDocumento:
 *           type: string
 *         proveedor:
 *           type: string
 *         observaciones:
 *           type: string
 *         aprobado:
 *           type: boolean
 *         cancelado:
 *           type: boolean
 */

// Validaciones
const transferenciaValidation = [
  body('items').isArray({ min: 1 }).withMessage('Debe proporcionar al menos un producto'),
  body('items.*.productoId').isMongoId().withMessage('ID de producto inválido'),
  body('items.*.cantidad').isInt({ min: 1 }).withMessage('La cantidad debe ser un entero positivo').toInt(),
  body('motivo').optional().trim().isLength({ max: 500 })
];

const entradaValidation = [
  body('producto').isMongoId().withMessage('ID de producto inválido'),
  body('cantidad').isInt({ min: 1 }).withMessage('La cantidad debe ser un entero positivo').toInt(),
  body('precioUnitario').isFloat({ min: 0.01 }).withMessage('El precio debe ser mayor a 0').toFloat(),
  body('motivo').trim().isLength({ min: 5, max: 500 }).withMessage('El motivo debe tener entre 5 y 500 caracteres'),
  body('numeroDocumento').trim().notEmpty().withMessage('El número de documento es requerido'),
  body('proveedor').trim().isLength({ min: 3 }).withMessage('El proveedor debe tener al menos 3 caracteres'),
  body('observaciones').optional().trim().isLength({ max: 1000 }).withMessage('Las observaciones no pueden exceder 1000 caracteres')
];

const salidaValidation = [
  body('producto').isMongoId().withMessage('ID de producto inválido'),
  body('cantidad').isInt({ min: 1 }).withMessage('La cantidad debe ser un entero positivo').toInt(),
  body('motivo').trim().isLength({ min: 5, max: 500 }).withMessage('El motivo debe tener entre 5 y 500 caracteres'),
  body('numeroDocumento').optional().trim(),
  body('observaciones').optional().trim().isLength({ max: 1000 }).withMessage('Las observaciones no pueden exceder 1000 caracteres')
];

const ajusteValidation = [
  body('producto').isMongoId().withMessage('ID de producto inválido'),
  body('cantidad').isInt({ min: 1 }).withMessage('La cantidad debe ser un entero positivo').toInt(),
  body('tipo').isIn(['AJUSTE_ENTRADA', 'AJUSTE_SALIDA']).withMessage('Tipo de ajuste inválido'),
  body('motivo').trim().isLength({ min: 20, max: 500 }).withMessage('El motivo debe tener entre 20 y 500 caracteres'),
  body('observaciones').optional().trim().isLength({ max: 1000 }).withMessage('Las observaciones no pueden exceder 1000 caracteres')
];

const cancelacionValidation = [
  body('motivoCancelacion').trim().isLength({ min: 10, max: 500 }).withMessage('El motivo de cancelación debe tener entre 10 y 500 caracteres')
];

/**
 * @swagger
 * /api/inventory/entrada:
 *   post:
 *     summary: Registrar entrada de productos
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - producto
 *               - cantidad
 *               - precioUnitario
 *               - motivo
 *               - numeroDocumento
 *               - proveedor
 *             properties:
 *               producto:
 *                 type: string
 *               cantidad:
 *                 type: integer
 *               precioUnitario:
 *                 type: number
 *               motivo:
 *                 type: string
 *               numeroDocumento:
 *                 type: string
 *               proveedor:
 *                 type: string
 *               observaciones:
 *                 type: string
 *     responses:
 *       201:
 *         description: Entrada registrada exitosamente
 *       400:
 *         description: Error de validación
 */
router.post(
  '/entrada',
  protect,
  authorize('admin', 'vendedor'),
  entradaValidation,
  validate,
  inventoryController.registrarEntrada
);

/**
 * @swagger
 * /api/inventory/salida:
 *   post:
 *     summary: Registrar salida de productos
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - producto
 *               - cantidad
 *               - motivo
 *             properties:
 *               producto:
 *                 type: string
 *               cantidad:
 *                 type: integer
 *               motivo:
 *                 type: string
 *               numeroDocumento:
 *                 type: string
 *               observaciones:
 *                 type: string
 *     responses:
 *       201:
 *         description: Salida registrada exitosamente
 *       400:
 *         description: Error de validación o stock insuficiente
 */
router.post(
  '/salida',
  protect,
  authorize('admin', 'vendedor'),
  salidaValidation,
  validate,
  inventoryController.registrarSalida
);

/**
 * @swagger
 * /api/inventory/ajuste:
 *   post:
 *     summary: Registrar ajuste de inventario (requiere aprobación)
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - producto
 *               - cantidad
 *               - tipo
 *               - motivo
 *             properties:
 *               producto:
 *                 type: string
 *               cantidad:
 *                 type: integer
 *               tipo:
 *                 type: string
 *                 enum: [AJUSTE_ENTRADA, AJUSTE_SALIDA]
 *               motivo:
 *                 type: string
 *               observaciones:
 *                 type: string
 *     responses:
 *       201:
 *         description: Ajuste registrado, pendiente de aprobación
 *       400:
 *         description: Error de validación
 *       403:
 *         description: No autorizado (solo administradores)
 */
router.post(
  '/ajuste',
  protect,
  authorize('admin'),
  ajusteValidation,
  validate,
  inventoryController.registrarAjuste
);

/**
 * @swagger
 * /api/inventory/ajuste/{id}/aprobar:
 *   put:
 *     summary: Aprobar ajuste de inventario
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ajuste aprobado exitosamente
 *       404:
 *         description: Ajuste no encontrado
 *       403:
 *         description: No autorizado
 */
router.put(
  '/ajuste/:id/aprobar',
  protect,
  authorize('admin'),
  inventoryController.aprobarAjuste
);

/**
 * @swagger
 * /api/inventory/movimiento/{id}/cancelar:
 *   put:
 *     summary: Cancelar movimiento de inventario
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - motivoCancelacion
 *             properties:
 *               motivoCancelacion:
 *                 type: string
 *     responses:
 *       200:
 *         description: Movimiento cancelado exitosamente
 *       400:
 *         description: No se puede cancelar el movimiento
 *       404:
 *         description: Movimiento no encontrado
 */
router.put(
  '/movimiento/:id/cancelar',
  protect,
  authorize('admin'),
  cancelacionValidation,
  validate,
  inventoryController.cancelarMovimiento
);

/**
 * @swagger
 * /api/inventory/movimientos:
 *   get:
 *     summary: Obtener historial de movimientos
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: producto
 *         schema:
 *           type: string
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *       - in: query
 *         name: fechaDesde
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: fechaHasta
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de movimientos
 */
router.get('/movimientos', protect, inventoryController.obtenerMovimientos);

/**
 * @swagger
 * /api/inventory/producto/{id}/historial:
 *   get:
 *     summary: Obtener historial de un producto específico
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Historial del producto
 */
router.get(
  '/producto/:id/historial',
  protect,
  inventoryController.obtenerHistorialProducto
);

/**
 * @swagger
 * /api/inventory/ajustes-pendientes:
 *   get:
 *     summary: Obtener ajustes pendientes de aprobación
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de ajustes pendientes
 */
router.get(
  '/ajustes-pendientes',
  protect,
  authorize('admin'),
  inventoryController.obtenerAjustesPendientes
);

/**
 * @swagger
 * /api/inventory/estadisticas:
 *   get:
 *     summary: Obtener estadísticas de movimientos
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fechaDesde
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: fechaHasta
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Estadísticas de movimientos
 */
router.get('/estadisticas', protect, inventoryController.obtenerEstadisticas);

router.post(
  '/transferencia',
  protect,
  authorize('admin', 'vendedor'),
  transferenciaValidation,
  validate,
  inventoryController.transferirStockMultiple
);

module.exports = router;
