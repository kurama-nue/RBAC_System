/**
 * @module auth.routes
 * @description Public authentication routes.
 *
 * @baseRoute /api/auth
 *
 * POST /api/auth/register  → Register new user
 * POST /api/auth/login     → Login and receive JWT
 * GET  /api/auth/me        → Get current user profile (protected)
 */

const express = require('express');
const router = express.Router();

const { register, login, getMe } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', register);

// @route   POST /api/auth/login
// @desc    Login user, return JWT
// @access  Public
router.post('/login', login);

// @route   GET /api/auth/me
// @desc    Get authenticated user's profile
// @access  Protected (any authenticated role)
router.get('/me', protect, getMe);

module.exports = router;
