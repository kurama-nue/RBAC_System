const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ─────────────────────────────────────────────────────────────────────────────
// AppError: Lightweight operational error class
// ─────────────────────────────────────────────────────────────────────────────
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// protect
// Verifies the JWT token and attaches the authenticated user to req.user.
// Must be applied BEFORE any route handler that needs identity.
//
// Token is expected in: Authorization: Bearer <token>
// ─────────────────────────────────────────────────────────────────────────────
const protect = async (req, res, next) => {
  try {
    // 1. Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('You are not logged in. Please log in to access this resource.', 401));
    }

    const token = authHeader.split(' ')[1];

    // 2. Verify token signature and expiry
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new AppError('Your session has expired. Please log in again.', 401));
      }
      return next(new AppError('Invalid token. Please log in again.', 401));
    }

    // 3. Confirm the user still exists (not soft-deleted or hard-deleted)
    const currentUser = await User.findById(decoded.id).select('+passwordChangedAt');
    if (!currentUser) {
      return next(new AppError('The account associated with this token no longer exists.', 401));
    }

    // 4. Check if account has been deactivated by an admin
    if (!currentUser.isActive) {
      return next(new AppError('Your account has been deactivated. Please contact support.', 403));
    }

    // 5. Check if password was changed after the token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return next(new AppError('Password was recently changed. Please log in again.', 401));
    }

    // 6. Attach the verified user and token to the request for downstream use
    req.user = currentUser;
    req.token = token;
    next();
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// restrictTo
// Role-based authorization gate. Must be used AFTER protect().
// Returns 403 if the authenticated user's role is not in the allowed list.
//
// Usage:
//   router.get('/admin/users', protect, restrictTo('admin'), handler)
//   router.get('/resource',    protect, restrictTo('admin', 'moderator'), handler)
// ─────────────────────────────────────────────────────────────────────────────
const restrictTo = (...allowedRoles) => {
  return (req, res, next) => {
    // req.user is guaranteed to exist here because protect() ran first
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Access denied. This resource requires one of the following roles: [${allowedRoles.join(', ')}].`,
          403
        )
      );
    }
    next();
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// optionalAuth
// Attaches req.user if a valid token is present, but does NOT block the request
// if the token is missing or invalid. Useful for public routes with optional
// personalization.
// ─────────────────────────────────────────────────────────────────────────────
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (user && user.isActive) {
      req.user = user;
    }
  } catch {
    // Silently ignore errors — this middleware never blocks the request
  }
  next();
};

module.exports = { protect, restrictTo, optionalAuth, AppError };
