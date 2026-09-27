const dolarService = require('../services/dolar.service');

/**
 * @desc    Obtener tasa de cambio USD → Bs actual
 * @route   GET /api/dolar/tasa
 * @access  Private
 */
exports.getTasa = async (req, res) => {
  try {
    const resultado = await dolarService.obtenerTasa();
    res.json(resultado);
  } catch (error) {
    console.error('[Dólar] Error al obtener tasa:', error.message);
    res.status(503).json({
      message: 'No se pudo obtener la tasa de cambio. Intente nuevamente.',
      error: error.message
    });
  }
};
