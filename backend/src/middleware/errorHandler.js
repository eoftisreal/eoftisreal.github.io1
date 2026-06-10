function notFound(_req, _res, next) {
  const error = new Error('Resource not found');
  error.statusCode = 404;
  next(error);
}

function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      message: 'Validation failed',
      details: { fieldErrors: { body: errors } }
    });
  }

  if (err.name === 'MongoServerError' && err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`
    });
  }

  res.status(statusCode).json({
    message: err.message || 'Internal server error',
    details: err.details || undefined,
  });
}

module.exports = { notFound, errorHandler };
