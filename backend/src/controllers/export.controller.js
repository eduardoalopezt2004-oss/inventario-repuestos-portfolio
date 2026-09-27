const Product = require('../models/Product');
const Category = require('../models/Category');
const Sale = require('../models/Sale');
const InventoryMovement = require('../models/InventoryMovement');
const User = require('../models/User');
const sendServerError = require('../utils/sendServerError');

/**
 * @desc  Exportar todos los datos del sistema como JSON descargable
 * @route GET /api/export
 * @access Private (admin)
 */
exports.exportarDatos = async (req, res) => {
  try {
    const [products, categories, sales, movements, users] = await Promise.all([
      Product.find({}).lean(),
      Category.find({}).lean(),
      Sale.find({}).lean(),
      InventoryMovement.find({}).lean(),
      User.find({}).select('-__v').lean()
    ]);

    const payload = {
      _meta: {
        version: '1.0',
        exportadoEn: new Date().toISOString(),
        exportadoPor: req.user?.nombre || req.user?.email || 'desconocido',
        totales: {
          products: products.length,
          categories: categories.length,
          sales: sales.length,
          movements: movements.length,
          users: users.length
        }
      },
      products,
      categories,
      sales,
      movements,
      users
    };

    const filename = `backup_${new Date().toISOString().slice(0, 10)}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(payload);
  } catch (error) {
    console.error('Error al exportar:', error);
    sendServerError(res, error);
  }
};

/**
 * @desc  Importar datos desde un JSON exportado previamente (upsert por _id)
 * @route POST /api/export/import
 * @access Private (admin)
 */
exports.importarDatos = async (req, res) => {
  try {
    const { products, categories, sales, movements, users } = req.body;

    if (!products && !categories && !sales && !movements && !users) {
      return res.status(400).json({ message: 'El archivo no contiene datos reconocibles' });
    }

    const resultados = {};

    const upsertColeccion = async (Model, docs, nombre) => {
      if (!Array.isArray(docs) || docs.length === 0) {
        resultados[nombre] = { insertados: 0, actualizados: 0 };
        return;
      }

      const ops = docs.map(doc => ({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: doc },
          upsert: true
        }
      }));

      const result = await Model.bulkWrite(ops, { ordered: false });
      resultados[nombre] = {
        insertados: result.upsertedCount,
        actualizados: result.modifiedCount
      };
    };

    await Promise.all([
      upsertColeccion(Product, products, 'products'),
      upsertColeccion(Category, categories, 'categories'),
      upsertColeccion(Sale, sales, 'sales'),
      upsertColeccion(InventoryMovement, movements, 'movements'),
      upsertColeccion(User, users, 'users')
    ]);

    res.json({
      message: 'Importación completada exitosamente',
      resultados
    });
  } catch (error) {
    console.error('Error al importar:', error);
    sendServerError(res, error);
  }
};
