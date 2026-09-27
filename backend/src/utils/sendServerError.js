// Responde un error 500 de forma segura: el detalle completo (mensaje de
// Mongoose, nombres de campos/colecciones, etc.) solo se muestra en
// desarrollo. En producción se devuelve un mensaje genérico al cliente para
// no filtrar información interna a quien esté probando la API; el detalle
// completo siempre queda en el log del servidor.
function sendServerError(res, error) {
  console.error(error);
  res.status(500).json({
    message: process.env.NODE_ENV === 'production' ? 'Error del servidor' : error.message
  });
}

module.exports = sendServerError;
