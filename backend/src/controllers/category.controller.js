const Category = require('../models/Category');

// @desc    Obtener todas las categorías
// @route   GET /api/categories
// @access  Private
exports.getCategories = async (req, res) => {
  try {
    // Permitir filtrar por activo/inactivo
    const filter = {};
    if (req.query.activo !== undefined) {
      filter.activo = req.query.activo === 'true';
    } else {
      filter.activo = true; // Por defecto solo activas
    }

    const categories = await Category.find(filter).sort('nombre');

    res.json({
      success: true,
      count: categories.length,
      categories
    });
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener categorías',
      error: error.message
    });
  }
};

// @desc    Crear categoría
// @route   POST /api/categories
// @access  Private (Admin)
exports.createCategory = async (req, res) => {
  try {
    // Validar campos requeridos
    if (!req.body.nombre || req.body.nombre.trim() === '') {
      return res.status(400).json({ message: 'El nombre de la categoría es requerido' });
    }
    if (!req.body.codigo || req.body.codigo.trim() === '') {
      return res.status(400).json({ message: 'El código es requerido' });
    }

    // Preparar datos para crear
    const categoryData = {
      codigo: req.body.codigo.trim(),
      nombre: req.body.nombre.trim(),
      descripcion: req.body.descripcion ? req.body.descripcion.trim() : '',
      marca: req.body.marca ? req.body.marca.trim() : '',
      modelo: req.body.modelo ? req.body.modelo.trim() : '',
      precioCompra: req.body.precioCompra || 0,
      precioVenta: req.body.precioVenta || 0,
      stock: req.body.stock || 0,
      stockMinimo: req.body.stockMinimo || 5,
      stockMaximo: req.body.stockMaximo || null,
      ubicacion: req.body.ubicacion ? req.body.ubicacion.trim() : '',
      activo: req.body.activo !== undefined ? req.body.activo : true
    };

    // Crear categoría
    const category = await Category.create(categoryData);

    res.status(201).json({
      success: true,
      message: 'Categoría creada exitosamente',
      category
    });
  } catch (error) {
    console.error('Error al crear categoría:', error);

    // Error de duplicado
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe una categoría con ese código o nombre'
      });
    }

    // Error de validación
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    // Error genérico
    res.status(500).json({
      success: false,
      message: 'Error al crear la categoría',
      error: error.message
    });
  }
};

// @desc    Actualizar categoría
// @route   PUT /api/categories/:id
// @access  Private (Admin)
exports.updateCategory = async (req, res) => {
  try {
    // Validar que el ID sea válido
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'ID de categoría inválido'
      });
    }

    // Preparar datos para actualizar
    const updateData = {};
    if (req.body.codigo) updateData.codigo = req.body.codigo.trim();
    if (req.body.nombre) updateData.nombre = req.body.nombre.trim();
    if (req.body.descripcion !== undefined) updateData.descripcion = req.body.descripcion.trim();
    if (req.body.marca !== undefined) updateData.marca = req.body.marca.trim();
    if (req.body.modelo !== undefined) updateData.modelo = req.body.modelo.trim();
    if (req.body.precioCompra !== undefined) updateData.precioCompra = req.body.precioCompra;
    if (req.body.precioVenta !== undefined) updateData.precioVenta = req.body.precioVenta;
    if (req.body.stock !== undefined) updateData.stock = req.body.stock;
    if (req.body.stockMinimo !== undefined) updateData.stockMinimo = req.body.stockMinimo;
    if (req.body.stockMaximo !== undefined) updateData.stockMaximo = req.body.stockMaximo;
    if (req.body.ubicacion !== undefined) updateData.ubicacion = req.body.ubicacion.trim();
    if (req.body.activo !== undefined) updateData.activo = req.body.activo;

    // Actualizar categoría
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Categoría actualizada exitosamente',
      category
    });
  } catch (error) {
    console.error('Error al actualizar categoría:', error);

    // Error de código o nombre duplicado
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe una categoría con ese código o nombre'
      });
    }

    // Error de validación
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    // Error genérico
    res.status(500).json({
      success: false,
      message: 'Error al actualizar la categoría',
      error: error.message
    });
  }
};

// @desc    Eliminar categoría (desactivar)
// @route   DELETE /api/categories/:id
// @access  Private (Admin)
exports.deleteCategory = async (req, res) => {
  try {
    // Validar que el ID sea válido
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'ID de categoría inválido'
      });
    }

    // Buscar la categoría
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }

    // Desactivar la categoría
    category.activo = false;
    await category.save();

    res.json({
      success: true,
      message: 'Categoría desactivada exitosamente',
      category
    });
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar la categoría',
      error: error.message
    });
  }
};

// @desc    Obtener una categoría por ID
// @route   GET /api/categories/:id
// @access  Private
exports.getCategoryById = async (req, res) => {
  try {
    // Validar que el ID sea válido
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'ID de categoría inválido'
      });
    }

    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }

    res.json({
      success: true,
      category
    });
  } catch (error) {
    console.error('Error al obtener categoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la categoría',
      error: error.message
    });
  }
};
