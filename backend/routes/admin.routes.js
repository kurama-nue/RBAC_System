/**
 * @module admin.routes
 * @description Admin-only API routes.
 * Every route in this file is gated by: protect + restrictTo('admin')
 * Non-admin users receive a 403 Forbidden response.
 *
 * @baseRoute /api/admin
 *
 * GET    /api/admin/analytics           → Dashboard analytics aggregates
 * GET    /api/admin/users               → List all users (paginated)
 * GET    /api/admin/users/:id           → Get single user
 * PATCH  /api/admin/users/:id/status    → Activate or deactivate user
 * PATCH  /api/admin/users/:id/role      → Change user's role
 * DELETE /api/admin/users/:id           → Soft-delete user
 * GET    /api/admin/tasks               → View all tasks
 * GET    /api/admin/logs                → View activity logs
 */

const express = require('express');
const router = express.Router();

const {
  getAllUsers,
  getUserById,
  updateUserStatus,
  updateUserRole,
  deleteUser,
  getAllTasks,
  getActivityLogs,
  getAnalytics,
} = require('../controllers/admin.controller');

const { protect, restrictTo } = require('../middleware/auth.middleware');

// ── Apply auth + admin-role gate to ALL admin routes ─────────────────────────
router.use(protect);
router.use(restrictTo('admin'));

// ── Analytics ─────────────────────────────────────────────────────────────────
// @route   GET /api/admin/analytics
// @desc    Aggregated metrics for the admin dashboard
router.get('/analytics', getAnalytics);

// ── User Management ───────────────────────────────────────────────────────────
// @route   GET /api/admin/users
// @desc    List all users with optional filter + pagination
router.get('/users', getAllUsers);

// @route   GET /api/admin/users/:id
// @desc    Get a specific user's full profile
router.get('/users/:id', getUserById);

// @route   PATCH /api/admin/users/:id/status
// @desc    Toggle user active status (activate/deactivate)
router.patch('/users/:id/status', updateUserStatus);

// @route   PATCH /api/admin/users/:id/role
// @desc    Promote or demote a user's role
router.patch('/users/:id/role', updateUserRole);

// @route   DELETE /api/admin/users/:id
// @desc    Soft-delete (deactivate) a user account
router.delete('/users/:id', deleteUser);

// ── Task Management ───────────────────────────────────────────────────────────
// @route   GET /api/admin/tasks
// @desc    View all tasks across all users
router.get('/tasks', getAllTasks);

// ── Activity Logs ─────────────────────────────────────────────────────────────
// @route   GET /api/admin/logs
// @desc    View filtered and paginated audit log
router.get('/logs', getActivityLogs);

module.exports = router;
