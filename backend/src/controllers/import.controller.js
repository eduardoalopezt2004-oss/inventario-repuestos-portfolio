const Product = require('../models/Product');
const { parseFile } = require('../services/fileParser.service');
const sendServerError = require('../utils/sendServerError');

/**
 * POST /api/import/analyze
 * Recibe un archivo Excel/CSV y devuelve los productos extraídos.
 */
exports.analyzeFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se recibió ningún archivo.' });
    }

    const productos = parseFile(req.file);

    if (!productos || productos.length === 0) {
      return res.status(422).json({ message: 'No se encontraron productos en el archivo.' });
    }

    res.json({ productos, total: productos.length });
  } catch (error) {
    sendServerError(res, error);
  }
};

/**
 * POST /api/import/confirm
 * Recibe lista de productos con precioVenta y los inserta/actualiza (upsert por código).
 */
exports.confirmImport = async (req, res) => {
  try {
    const { productos } = req.body;

    if (!Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({ message: 'No se recibieron productos para importar.' });
    }

    let creados = 0;
    let actualizados = 0;
    const errores = [];

    for (const producto of productos) {
      try {
        if (!producto.codigo) {
          errores.push({ producto: producto.nombre || '(sin nombre)', error: 'Código vacío' });
          continue;
        }

        const data = {
          codigo: producto.codigo,
          nombre: producto.nombre || producto.codigo,
          descripcion: producto.descripcion || '',
          marca: producto.marca || '',
          modelo: producto.modelo || '',
          precioCompra: Number(producto.precioCompra) || 0,
          precioVenta: Number(producto.precioVenta) || 0,
          stock: Number(producto.stock) || 0
        };

        const result = await Product.findOneAndUpdate(
          { codigo: data.codigo },
          data,
          { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
        );

        // Si createdAt ≈ updatedAt es un producto recién creado
        const diff = Math.abs(result.updatedAt.getTime() - result.createdAt.getTime());
        if (diff < 1000) {
          creados++;
        } else {
          actualizados++;
        }
      } catch (err) {
        errores.push({
          producto: producto.nombre || producto.codigo || '(desconocido)',
          error: err.message
        });
      }
    }

    res.json({ creados, actualizados, errores });
  } catch (error) {
    sendServerError(res, error);
  }
};
