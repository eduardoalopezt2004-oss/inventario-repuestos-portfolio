const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getLowStockProducts,
  getProductHistorial,
  getHistorialGlobal
} = require('../controllers/product.controller');
const { protect, authorize } = require('../middleware/auth');

router.route('/')
  .get(protect, getProducts)
  .post(protect, authorize('admin', 'vendedor'), createProduct);

router.get('/low-stock', protect, getLowStockProducts);
router.get('/historial', protect, getHistorialGlobal);

router.route('/:id')
  .get(protect, getProductById)
  .put(protect, authorize('admin', 'vendedor'), updateProduct)
  .delete(protect, authorize('admin'), deleteProduct);

router.get('/:id/historial', protect, getProductHistorial);

module.exports = router;
