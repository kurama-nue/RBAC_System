/**
 * @module auth.controller
 * @description Handles user registration and login.
 * Every auth event is written to the ActivityLog via logActivity().
 *
 * @routes
 *  POST /api/auth/register  — Public
 *  POST /api/auth/login     — Public
 *  GET  /api/auth/me        — Protected (any role)
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logActivity, logFailure } = require('../helpers/activityLogger');
const { AppError } = require('../middleware/auth.middleware');

// ─── Utility: sign JWT ────────────────────────────────────────────────────────
const signToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role, // Role in payload avoids a DB call on every middleware check
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

// ─── Utility: send token response ────────────────────────────────────────────
const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user);
  const userObj = user.toJSON ? user.toJSON() : user;

  res.status(statusCode).json({
    success: true,
    token,
    data: { user: userObj },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check for existing user first to provide a better error than the DB duplicate key
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return next(new AppError('An account with this email already exists.', 409));
    }

    const user = await User.create({ name, email, password });

    // ── Log: USER_REGISTER ─────────────────────────────────────────────────
    await logActivity({
      req,
      actor: user,
      action: 'USER_REGISTER',
      resourceType: 'User',
      resourceId: user._id,
      metadata: { after: { name: user.name, email: user.email, role: user.role } },
    });

    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Login user and return JWT
// @route   POST /api/auth/login
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new AppError('Email and password are required.', 400));
    }

    // Fetch user WITH password (excluded by default in schema)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    // ── Failed login: user not found or wrong password ─────────────────────
    if (!user || !(await user.comparePassword(password))) {
      await logFailure({
        req,
        actor: null,
        action: 'USER_LOGIN_FAILED',
        resourceType: 'Auth',
        metadata: { after: { attemptedEmail: email } },
        errorMessage: 'Invalid credentials',
      });
      // Vague error message to prevent email enumeration attacks
      return next(new AppError('Invalid email or password.', 401));
    }

    if (!user.isActive) {
      return next(new AppError('Your account is deactivated. Contact support.', 403));
    }

    // ── Update security metadata ───────────────────────────────────────────
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress;
    user.lastLoginAt = new Date();
    user.lastLoginIP = ip;
    await user.save({ validateModifiedOnly: true });

    // ── Log: USER_LOGIN ────────────────────────────────────────────────────
    await logActivity({
      req,
      actor: user,
      action: 'USER_LOGIN',
      resourceType: 'Auth',
      metadata: { after: { loginAt: user.lastLoginAt, ip } },
    });

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get current authenticated user's profile
// @route   GET /api/auth/me
// @access  Protected (any role)
// ─────────────────────────────────────────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    // req.user is already populated by the protect middleware
    const user = await User.findById(req.user._id);

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe };
