const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/credito.controller');

router.get('/', protect, ctrl.getCreditos);
router.get('/alertas', protect, ctrl.getAlertas);
router.get('/:id', protect, ctrl.getCreditoById);
router.post('/:id/pago', protect, authorize('admin', 'vendedor'), ctrl.registrarPago);
router.put('/:id/prorroga', protect, authorize('admin'), ctrl.registrarProrroga);

module.exports = router;
