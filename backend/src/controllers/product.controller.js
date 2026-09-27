const Product = require('../models/Product');
const ProductChangeLog = require('../models/ProductChangeLog');
const sendServerError = require('../utils/sendServerError');

const CAMPOS_AUDITABLES = [
  'codigo', 'nombre', 'descripcion', 'marca', 'modelo', 'categoria',
  'precioCompra', 'precioVenta', 'stockDeposito', 'stockLocal',
  'stockMinimoLocal', 'stockMinimoDeposito', 'stockMaximo', 'ubicacion', 'activo'
];

// @desc    Obtener todos los productos
// @route   GET /api/products
// @access  Private
exports.getProducts = async (req, res) => {
  try {
    const { search, categoria, activo } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { codigo: { $regex: search, $options: 'i' } },
        { nombre: { $regex: search, $options: 'i' } },
        { marca: { $regex: search, $options: 'i' } }
      ];
    }

    if (categoria) {
      query.categoria = categoria;
    }

    if (activo !== undefined) {
      query.activo = activo === 'true';
    }

    const products = await Product.find(query)
      .populate('categoria', 'nombre')
      .sort('-createdAt');

    res.json(products);
  } catch (error) {
    sendServerError(res, error);
  }
};

// @desc    Obtener un producto por ID
// @route   GET /api/products/:id
// @access  Private
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('categoria');

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json(product);
  } catch (error) {
    sendServerError(res, error);
  }
};

// @desc    Crear producto
// @route   POST /api/products
// @access  Private (Admin)
exports.createProduct = async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'El código del producto ya existe' });
    }
    sendServerError(res, error);
  }
};

// @desc    Actualizar producto
// @route   PUT /api/products/:id
// @access  Private (Admin)
exports.updateProduct = async (req, res) => {
  try {
    const productoAnterior = await Product.findById(req.params.id);

    if (!productoAnterior) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'codigo') && !String(req.body.codigo || '').trim()) {
      req.body.codigo = await Product.generarCodigoAutomatico();
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    try {
      const cambios = [];
      CAMPOS_AUDITABLES.forEach((campo) => {
        if (!Object.prototype.hasOwnProperty.call(req.body, campo)) {
          return;
        }

        const valorAnterior = productoAnterior[campo];
        const valorNuevo = req.body[campo];

        const difieren = campo === 'categoria'
          ? String(valorAnterior ?? '') !== String(valorNuevo ?? '')
          : valorAnterior !== valorNuevo;

        if (difieren) {
          cambios.push({ campo, valorAnterior, valorNuevo });
        }
      });

      if (cambios.length > 0) {
        await ProductChangeLog.create({
          producto: req.params.id,
          usuario: req.user._id,
          cambios
        });
      }
    } catch (logError) {
      console.error('Error al registrar historial de cambios de producto:', logError.message);
    }

    res.json(product);
  } catch (error) {
    sendServerError(res, error);
  }
};

// @desc    Eliminar producto (hard delete)
// @route   DELETE /api/products/:id
// @access  Private (Admin)
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json({ message: 'Producto eliminado exitosamente' });
  } catch (error) {
    sendServerError(res, error);
  }
};

// @desc    Obtener productos con stock bajo
// @route   GET /api/products/low-stock
// @access  Private
exports.getLowStockProducts = async (req, res) => {
  try {
    const products = await Product.find({
      $expr: { $lte: ['$stock', '$stockMinimo'] },
      activo: true
    }).populate('categoria', 'nombre');

    res.json(products);
  } catch (error) {
    sendServerError(res, error);
  }
};

// @desc    Obtener historial de cambios de un producto
// @route   GET /api/products/:id/historial
// @access  Private
exports.getProductHistorial = async (req, res) => {
  try {
    const { limite } = req.query;

    let query = ProductChangeLog.find({ producto: req.params.id })
      .populate('usuario', 'nombre')
      .sort('-createdAt');

    if (limite) {
      query = query.limit(parseInt(limite));
    }

    const historial = await query;

    res.json(historial);
  } catch (error) {
    sendServerError(res, error);
  }
};

// @desc    Obtener historial de cambios de todos los productos (paginado y filtrable)
// @route   GET /api/products/historial
// @access  Private
exports.getHistorialGlobal = async (req, res) => {
  try {
    const {
      producto,
      campo,
      search,
      fechaDesde,
      fechaHasta,
      orden = 'desc',
      page = 1,
      limit = 20
    } = req.query;

    const query = {};

    if (producto) {
      query.producto = producto;
    } else if (search) {
      const productosCoincidentes = await Product.find({
        $or: [
          { codigo: { $regex: search, $options: 'i' } },
          { nombre: { $regex: search, $options: 'i' } },
          { marca: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');

      query.producto = { $in: productosCoincidentes.map((p) => p._id) };
    }

    if (campo) {
      query['cambios.campo'] = campo;
    }

    if (fechaDesde || fechaHasta) {
      query.createdAt = {};
      if (fechaDesde) query.createdAt.$gte = new Date(fechaDesde);
      if (fechaHasta) query.createdAt.$lte = new Date(fechaHasta);
    }

    const skip = (page - 1) * limit;

    const [historial, total] = await Promise.all([
      ProductChangeLog.find(query)
        .populate('producto', 'codigo nombre marca')
        .populate('usuario', 'nombre')
        .sort({ createdAt: orden === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      ProductChangeLog.countDocuments(query)
    ]);

    res.json({
      historial,
      paginacion: {
        total,
        pagina: parseInt(page),
        limite: parseInt(limit),
        paginas: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    sendServerError(res, error);
  }
};
