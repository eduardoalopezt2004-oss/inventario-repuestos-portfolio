const { validationResult } = require('express-validator');

/**
 * Middleware para manejar errores de validación de express-validator
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg
    }));

    return res.status(400).json({
      message: 'Errores de validación',
      errors: errorMessages
    });
  }

  next();
};

module.exports = validate;
