const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const {
  register,
  login,
  getMe,
  getUsers,
  getUserById,
  updateUser,
  deleteUser
} = require('../controllers/auth.controller');
const { protect, authorize } = require('../middleware/auth');

// Límite estricto de intentos de login por IP, para dificultar fuerza bruta
// y credential stuffing. No afecta el login normal (10 intentos cada 15 min
// es de sobra para un error de tipeo).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en unos minutos.' }
});

// Rutas públicas
router.post('/login', loginLimiter, login);

// Rutas protegidas
router.get('/me', protect, getMe);

// Rutas de administración (solo admin)
router.post('/register', protect, authorize('admin'), register);
router.get('/users', protect, authorize('admin'), getUsers);
router.get('/users/:id', protect, authorize('admin'), getUserById);
router.put('/users/:id', protect, authorize('admin'), updateUser);
router.delete('/users/:id', protect, authorize('admin'), deleteUser);

module.exports = router;
