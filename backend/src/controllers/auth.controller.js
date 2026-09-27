const User = require('../models/User');
const jwt = require('jsonwebtoken');
const sendServerError = require('../utils/sendServerError');

// Generar JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
};

// @desc    Registrar usuario
// @route   POST /api/auth/register
// @access  Public (solo admin puede crear usuarios)
exports.register = async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;

    // Verificar si el usuario ya existe
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'El usuario ya existe' });
    }

    // Crear usuario
    const user = await User.create({
      nombre,
      email,
      password,
      rol
    });

    res.status(201).json({
      _id: user._id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      token: generateToken(user._id)
    });
  } catch (error) {
    sendServerError(res, error);
  }
};

// @desc    Login de usuario
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const identificador = (email || '').trim();

    // Validar email y password
    if (!identificador || !password) {
      return res.status(400).json({ message: 'Por favor ingrese email y contraseña' });
    }

    // Verificar si el usuario existe, ya sea por email o por nombre completo
    const escapado = identificador.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const user = await User.findOne({
      $or: [
        { email: identificador.toLowerCase() },
        { nombre: new RegExp(`^${escapado}$`, 'i') }
      ]
    });
    if (!user || !user.activo) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // Verificar contraseña
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    res.json({
      _id: user._id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      token: generateToken(user._id)
    });
  } catch (error) {
    sendServerError(res, error);
  }
};

// @desc    Obtener usuario actual
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    sendServerError(res, error);
  }
};

// @desc    Obtener todos los usuarios
// @route   GET /api/auth/users
// @access  Private/Admin
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    sendServerError(res, error);
  }
};

// @desc    Obtener usuario por ID
// @route   GET /api/auth/users/:id
// @access  Private/Admin
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.json(user);
  } catch (error) {
    sendServerError(res, error);
  }
};

// @desc    Actualizar usuario
// @route   PUT /api/auth/users/:id
// @access  Private/Admin
exports.updateUser = async (req, res) => {
  try {
    const { nombre, email, password, rol, activo } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Verificar si el email ya existe en otro usuario
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ message: 'El email ya está en uso' });
      }
    }

    user.nombre = nombre || user.nombre;
    user.email = email || user.email;
    user.rol = rol || user.rol;
    user.activo = activo !== undefined ? activo : user.activo;

    // Solo actualizar contraseña si se proporciona
    if (password) {
      user.password = password;
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      nombre: updatedUser.nombre,
      email: updatedUser.email,
      rol: updatedUser.rol,
      activo: updatedUser.activo
    });
  } catch (error) {
    sendServerError(res, error);
  }
};

// @desc    Eliminar usuario
// @route   DELETE /api/auth/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // No permitir eliminar el último admin
    if (user.rol === 'admin') {
      const adminCount = await User.countDocuments({ rol: 'admin', activo: true });
      if (adminCount <= 1) {
        return res.status(400).json({ message: 'No se puede eliminar el último administrador' });
      }
    }

    await user.deleteOne();
    res.json({ message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    sendServerError(res, error);
  }
};
