const { sendError } = require('../utils/response');

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'Something went wrong';
  const details = process.env.NODE_ENV === 'development' ? err.details || null : null;

  return sendError(res, message, code, statusCode, details);
}

module.exports = errorHandler;