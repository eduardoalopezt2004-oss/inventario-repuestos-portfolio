const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getSalesByMonth,
  getStockMovements,
  getStockDistribution,
  getCriticalProducts,
  getStockTrend
} = require('../controllers/dashboard.controller');
const { protect, authorize } = require('../middleware/auth');

router.get('/stats', protect, authorize('admin', 'vendedor'), getDashboardStats);
router.get('/sales-by-month', protect, authorize('admin', 'vendedor'), getSalesByMonth);
router.get('/stock-movements', protect, authorize('admin', 'vendedor'), getStockMovements);
router.get('/stock-distribution', protect, authorize('admin', 'vendedor'), getStockDistribution);
router.get('/critical-products', protect, authorize('admin', 'vendedor'), getCriticalProducts);
router.get('/stock-trend', protect, authorize('admin', 'vendedor'), getStockTrend);

module.exports = router;
