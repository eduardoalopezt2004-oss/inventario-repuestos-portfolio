const express = require('express');
const router = express.Router();
const {
  getSales,
  getSaleById,
  createSale,
  cancelSale
} = require('../controllers/sale.controller');
const { protect, authorize } = require('../middleware/auth');

router.route('/')
  .get(protect, getSales)
  .post(protect, authorize('admin', 'vendedor'), createSale);

router.get('/:id', protect, getSaleById);
router.put('/:id/cancel', protect, authorize('admin'), cancelSale);

module.exports = router;
