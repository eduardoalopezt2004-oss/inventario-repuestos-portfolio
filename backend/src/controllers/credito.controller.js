const Credito = require('../models/Credito');
const sendServerError = require('../utils/sendServerError');

const marcarVencidos = async () => {
  await Credito.updateMany(
    { estadoCredito: { $in: ['pendiente', 'parcial'] }, fechaVencimiento: { $lt: new Date() } },
    { estadoCredito: 'vencido' }
  );
};

exports.getCreditos = async (req, res) => {
  try {
    await marcarVencidos();
    const { estado, q } = req.query;
    const filtro = {};
    if (estado) filtro.estadoCredito = estado;
    if (q) {
      const regex = new RegExp(q, 'i');
      filtro.$or = [{ 'cliente.nombre': regex }, { 'cliente.cedula': regex }];
    }
    const creditos = await Credito.find(filtro)
      .populate('venta', 'numeroVenta createdAt')
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });
    res.json(creditos);
  } catch (error) {
    sendServerError(res, error);
  }
};

exports.getCreditoById = async (req, res) => {
  try {
    await marcarVencidos();
    const credito = await Credito.findById(req.params.id)
      .populate('venta', 'numeroVenta createdAt items total totalBs metodoPago')
      .populate('pagos.registradoPor', 'nombre')
      .populate('prorrogas.otorgadoPor', 'nombre')
      .lean({ virtuals: true });
    if (!credito) return res.status(404).json({ message: 'Crédito no encontrado' });
    res.json(credito);
  } catch (error) {
    sendServerError(res, error);
  }
};

exports.getAlertas = async (req, res) => {
  try {
    await marcarVencidos();
    const vencidos = await Credito.countDocuments({ estadoCredito: 'vencido' });
    const hoy = new Date();
    const en3Dias = new Date();
    en3Dias.setDate(en3Dias.getDate() + 3);
    const porVencer = await Credito.countDocuments({
      estadoCredito: { $in: ['pendiente', 'parcial'] },
      fechaVencimiento: { $gte: hoy, $lte: en3Dias }
    });
    res.json({ vencidos, porVencer });
  } catch (error) {
    sendServerError(res, error);
  }
};

exports.registrarPago = async (req, res) => {
  try {
    const { monto, montoBs, tasaBs } = req.body;
    if (!monto || monto <= 0) return res.status(400).json({ message: 'El monto debe ser mayor a 0' });

    const credito = await Credito.findById(req.params.id);
    if (!credito) return res.status(404).json({ message: 'Crédito no encontrado' });
    if (credito.estadoCredito === 'cancelado') return res.status(400).json({ message: 'Este crédito ya está cancelado' });

    const pendiente = credito.montoTotal - credito.montoPagado;
    if (monto > pendiente + 0.001) return res.status(400).json({ message: `El monto supera el saldo pendiente ($${pendiente.toFixed(2)})` });

    credito.pagos.push({ monto, montoBs: montoBs || 0, tasaBs: tasaBs || 0, registradoPor: req.user._id, fecha: new Date() });
    credito.montoPagado = parseFloat((credito.montoPagado + monto).toFixed(2));
    credito.montoPagadoBs = parseFloat((credito.montoPagadoBs + (montoBs || 0)).toFixed(2));

    if (credito.montoPagado >= credito.montoTotal - 0.001) {
      credito.estadoCredito = 'cancelado';
    } else {
      credito.estadoCredito = credito.fechaVencimiento < new Date() ? 'vencido' : 'parcial';
    }

    await credito.save();
    res.json({ message: 'Pago registrado', credito });
  } catch (error) {
    sendServerError(res, error);
  }
};

exports.registrarProrroga = async (req, res) => {
  try {
    const { fechaNueva, motivo } = req.body;
    if (!fechaNueva) return res.status(400).json({ message: 'La nueva fecha es requerida' });

    const credito = await Credito.findById(req.params.id);
    if (!credito) return res.status(404).json({ message: 'Crédito no encontrado' });
    if (credito.estadoCredito === 'cancelado') return res.status(400).json({ message: 'No se puede prorrogar un crédito cancelado' });

    credito.prorrogas.push({
      fechaAnterior: credito.fechaVencimiento,
      fechaNueva: new Date(fechaNueva),
      motivo: motivo || '',
      otorgadoPor: req.user._id
    });
    credito.fechaVencimiento = new Date(fechaNueva);
    if (['vencido', 'pendiente', 'parcial'].includes(credito.estadoCredito)) {
      credito.estadoCredito = credito.montoPagado > 0 ? 'parcial' : 'pendiente';
    }

    await credito.save();
    res.json({ message: 'Prórroga registrada', credito });
  } catch (error) {
    sendServerError(res, error);
  }
};
