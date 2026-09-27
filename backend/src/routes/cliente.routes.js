const express = require('express');
const router = express.Router();
const { searchClientes } = require('../controllers/cliente.controller');
const { protect } = require('../middleware/auth');

router.get('/search', protect, searchClientes);

module.exports = router;
