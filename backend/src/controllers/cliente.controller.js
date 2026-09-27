const Cliente = require('../models/Cliente');
const sendServerError = require('../utils/sendServerError');

// GET /api/clientes/search?q=<texto>
exports.searchClientes = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 1) return res.json([]);

    const regex = new RegExp(q.trim(), 'i');
    const clientes = await Cliente.find({
      $or: [{ nombre: regex }, { cedula: regex }]
    })
      .sort('nombre')
      .limit(8)
      .lean();

    res.json(clientes);
  } catch (error) {
    sendServerError(res, error);
  }
};

// Upsert interno — llamado desde sale.controller tras confirmar una venta
exports.upsertCliente = async ({ nombre, cedula, telefono }) => {
  if (!nombre) return;
  try {
    if (cedula) {
      // Si tiene cédula, es el identificador único
      await Cliente.findOneAndUpdate(
        { cedula },
        { $set: { nombre, ...(telefono && { telefono }) } },
        { upsert: true }
      );
    } else {
      // Sin cédula: crear sólo si no existe exactamente ese nombre
      const existe = await Cliente.findOne({ nombre: new RegExp(`^${nombre}$`, 'i') });
      if (!existe) {
        await Cliente.create({ nombre, telefono: telefono || '' });
      } else if (telefono && !existe.telefono) {
        existe.telefono = telefono;
        await existe.save();
      }
    }
  } catch (err) {
    console.error('Error al guardar cliente:', err.message);
  }
};
