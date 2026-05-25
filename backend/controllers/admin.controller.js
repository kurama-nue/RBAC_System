/**
 * @module admin.controller
 * @description Admin-only operations: user management, all-task views, activity logs.
 * ALL routes in this controller are protected by: protect + restrictTo('admin')
 *
 * Every mutation and sensitive read is logged via logActivity().
 *
 * @routes (all require Admin role)
 *  GET    /api/admin/users              — List all users (paginated)
 *  GET    /api/admin/users/:id          — Get a single user
 *  PATCH  /api/admin/users/:id/status   — Activate/deactivate a user
 *  PATCH  /api/admin/users/:id/role     — Change a user's role
 *  DELETE /api/admin/users/:id          — Soft-delete (deactivate) a user
 *  GET    /api/admin/tasks              — List all tasks (paginated)
 *  GET    /api/admin/logs               — View activity logs (paginated + filtered)
 *  GET    /api/admin/analytics          — Aggregate analytics data
 */

const User = require('../models/User');
const Task = require('../models/Task');
const ActivityLog = require('../models/ActivityLog');
const { logActivity } = require('../helpers/activityLogger');
const { AppError } = require('../middleware/auth.middleware');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    List all users with pagination and optional role filter
// @route   GET /api/admin/users
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────
const getAllUsers = async (req, res, next) => {
  try {
    const { role, isActive, page = 1, limit = 20, search } = req.query;
    const filter = {};

    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      User.countDocuments(filter),
    ]);

    await logActivity({
      req,
      actor: req.user,
      action: 'ADMIN_VIEWED_USERS',
      resourceType: 'User',
      metadata: { after: { filter, page, limit } },
    });

    res.status(200).json({
      success: true,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
      data: { users },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get a single user by ID
// @route   GET /api/admin/users/:id
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return next(new AppError('User not found.', 404));

    res.status(200).json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update a user's active status (activate/deactivate)
// @route   PATCH /api/admin/users/:id/status
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────
const updateUserStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return next(new AppError('isActive must be a boolean value.', 400));
    }

    const user = await User.findById(req.params.id);
    if (!user) return next(new AppError('User not found.', 404));

    // Prevent admin from deactivating themselves
    if (user._id.toString() === req.user._id.toString()) {
      return next(new AppError('Admins cannot change their own status.', 400));
    }

    const beforeSnapshot = { isActive: user.isActive };
    user.isActive = isActive;
    await user.save({ validateModifiedOnly: true });

    await logActivity({
      req,
      actor: req.user,
      action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      resourceType: 'User',
      resourceId: user._id,
      metadata: {
        before: beforeSnapshot,
        after: { isActive: user.isActive, email: user.email },
      },
    });

    res.status(200).json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully.`,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Change a user's role
// @route   PATCH /api/admin/users/:id/role
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────
const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['admin', 'user'].includes(role)) {
      return next(new AppError('Role must be either admin or user.', 400));
    }

    const user = await User.findById(req.params.id);
    if (!user) return next(new AppError('User not found.', 404));

    // Prevent admin from downgrading themselves
    if (user._id.toString() === req.user._id.toString()) {
      return next(new AppError('Admins cannot change their own role.', 400));
    }

    const beforeRole = user.role;
    user.role = role;
    await user.save({ validateModifiedOnly: true });

    await logActivity({
      req,
      actor: req.user,
      action: 'ROLE_CHANGED',
      resourceType: 'User',
      resourceId: user._id,
      metadata: {
        before: { role: beforeRole, email: user.email },
        after: { role: user.role, email: user.email },
      },
    });

    res.status(200).json({ success: true, message: 'User role updated.', data: { user } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Soft-delete a user (deactivate instead of hard-delete)
// @route   DELETE /api/admin/users/:id
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return next(new AppError('User not found.', 404));

    if (user._id.toString() === req.user._id.toString()) {
      return next(new AppError('Admins cannot delete their own account.', 400));
    }

    const beforeSnapshot = { name: user.name, email: user.email, role: user.role, isActive: user.isActive };

    // Soft-delete: deactivate the account rather than destroying the record
    user.isActive = false;
    await user.save({ validateModifiedOnly: true });

    await logActivity({
      req,
      actor: req.user,
      action: 'USER_DELETED',
      resourceType: 'User',
      resourceId: user._id,
      metadata: { before: beforeSnapshot, after: { isActive: false } },
    });

    res.status(200).json({ success: true, message: 'User account deactivated successfully.' });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    List all tasks (across all users) with pagination
// @route   GET /api/admin/tasks
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────
const getAllTasks = async (req, res, next) => {
  try {
    const { status, priority, owner, page = 1, limit = 20 } = req.query;

    // Bypass the pre-find soft-delete filter using includeSoftDeleted option (Admin sees all)
    const query = Task.find().setOptions({ includeSoftDeleted: false });

    if (status) query.where('status').equals(status);
    if (priority) query.where('priority').equals(priority);
    if (owner) query.where('owner').equals(owner);

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const tasks = await query
      .populate('owner', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Task.countDocuments();

    await logActivity({
      req,
      actor: req.user,
      action: 'ADMIN_VIEWED_ALL_TASKS',
      resourceType: 'Task',
      metadata: { after: { filter: { status, priority, owner }, page, limit } },
    });

    res.status(200).json({
      success: true,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
      data: { tasks },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    View activity logs with filtering and pagination
// @route   GET /api/admin/logs
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────
const getActivityLogs = async (req, res, next) => {
  try {
    const { action, userId, resourceType, status, page = 1, limit = 50, from, to } = req.query;
    const filter = {};

    if (action) filter.action = action;
    if (status) filter.status = status;
    if (resourceType) filter['resource.type'] = resourceType;
    if (userId) filter['actor.userId'] = userId;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      ActivityLog.countDocuments(filter),
    ]);

    await logActivity({
      req,
      actor: req.user,
      action: 'ADMIN_VIEWED_LOGS',
      resourceType: 'System',
      metadata: { after: { filter } },
    });

    res.status(200).json({
      success: true,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
      data: { logs },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get analytics aggregates for the Admin Dashboard
// @route   GET /api/admin/analytics
// @access  Admin
// ─────────────────────────────────────────────────────────────────────────────
const getAnalytics = async (req, res, next) => {
  try {
    const [
      totalUsers,
      activeUsers,
      adminUsers,
      totalTasks,
      tasksByStatus,
      recentLogins,
      activityByAction,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ role: 'admin' }),
      Task.countDocuments(),
      Task.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      ActivityLog.countDocuments({
        action: 'USER_LOGIN',
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
      ActivityLog.aggregate([
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);

    // Normalize tasksByStatus into a flat object
    const tasksMap = tasksByStatus.reduce((acc, { _id, count }) => {
      acc[_id] = count;
      return acc;
    }, { todo: 0, 'in-progress': 0, done: 0 });

    res.status(200).json({
      success: true,
      data: {
        users: { total: totalUsers, active: activeUsers, inactive: totalUsers - activeUsers, admins: adminUsers },
        tasks: {
          total: totalTasks,
          todo: tasksMap.todo,
          inProgress: tasksMap['in-progress'],
          done: tasksMap.done,
        },
        activity: { loginsLast24h: recentLogins, topActions: activityByAction },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUserStatus,
  updateUserRole,
  deleteUser,
  getAllTasks,
  getActivityLogs,
  getAnalytics,
};
