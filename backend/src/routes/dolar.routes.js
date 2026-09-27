const express = require('express');
const router = express.Router();
const { getTasa } = require('../controllers/dolar.controller');
const { protect } = require('../middleware/auth');

router.get('/tasa', protect, getTasa);

module.exports = router;
