function sendSuccess(res, message, data = null, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}

function sendError(res, message, code = 'INTERNAL_ERROR', statusCode = 500, details = null) {
  const response = {
    success: false,
    message,
    code
  };

  if (details) {
    response.details = details;
  }

  return res.status(statusCode).json(response);
}

module.exports = {
  sendSuccess,
  sendError
};