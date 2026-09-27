const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { analyzeFile, confirmImport } = require('../controllers/import.controller');

router.post('/analyze', protect, authorize('admin'), upload.single('archivo'), analyzeFile);
router.post('/confirm', protect, authorize('admin'), confirmImport);

module.exports = router;
