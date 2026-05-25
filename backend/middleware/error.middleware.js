/**
 * @module error.middleware
 * Centralized error handling middleware for Express.
 * Must be the LAST middleware registered in server.js.
 *
 * Handles:
 *  - Operational errors (AppError instances) → send clean JSON response
 *  - Mongoose validation errors → 400 with field details
 *  - Mongoose duplicate key errors → 409 Conflict
 *  - JWT errors → 401 Unauthorized
 *  - Programming errors in production → generic 500 (never leak internals)
 */

// ─── Specific error handlers ─────────────────────────────────────────────────

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return { statusCode: 400, message };
};

const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `Duplicate value for field '${field}': "${value}". Please use a different value.`;
  return { statusCode: 409, message };
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Validation failed: ${errors.join('. ')}`;
  return { statusCode: 400, message };
};

const handleJWTError = () => ({
  statusCode: 401,
  message: 'Invalid token. Please log in again.',
});

const handleJWTExpiredError = () => ({
  statusCode: 401,
  message: 'Your session has expired. Please log in again.',
});

// ─── Send Error Responses ────────────────────────────────────────────────────

const sendErrorDev = (err, res) => {
  res.status(err.statusCode || 500).json({
    success: false,
    status: err.statusCode || 500,
    message: err.message,
    stack: err.stack,
    error: err,
  });
};

const sendErrorProd = (err, res) => {
  // Operational errors: send safe message to client
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      status: err.statusCode,
      message: err.message,
    });
  }
  // Programming or unknown errors: don't leak error details
  console.error('💥 UNHANDLED ERROR:', err);
  res.status(500).json({
    success: false,
    status: 500,
    message: 'Something went wrong on our end. Please try again later.',
  });
};

// ─── Main Error Handler ───────────────────────────────────────────────────────

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;

  if (process.env.NODE_ENV === 'development') {
    return sendErrorDev(err, res);
  }

  // Transform known Mongoose/JWT errors into operational AppErrors
  let error = { ...err, message: err.message, isOperational: err.isOperational };

  if (err.name === 'CastError') {
    const { statusCode, message } = handleCastErrorDB(err);
    error = { statusCode, message, isOperational: true };
  }
  if (err.code === 11000) {
    const { statusCode, message } = handleDuplicateFieldsDB(err);
    error = { statusCode, message, isOperational: true };
  }
  if (err.name === 'ValidationError') {
    const { statusCode, message } = handleValidationErrorDB(err);
    error = { statusCode, message, isOperational: true };
  }
  if (err.name === 'JsonWebTokenError') {
    const { statusCode, message } = handleJWTError();
    error = { statusCode, message, isOperational: true };
  }
  if (err.name === 'TokenExpiredError') {
    const { statusCode, message } = handleJWTExpiredError();
    error = { statusCode, message, isOperational: true };
  }

  sendErrorProd(error, res);
};

// ─── 404 Handler (must be registered before errorHandler) ────────────────────
const notFound = (req, res, next) => {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.statusCode = 404;
  err.isOperational = true;
  next(err);
};

module.exports = { errorHandler, notFound };
