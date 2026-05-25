/**
 * @module task.controller
 * @description CRUD for Tasks with ownership-based access control.
 *
 * RBAC Rules:
 *  - Users can only Create/Read/Update/Delete their OWN tasks.
 *  - Admins can see ALL tasks (handled in admin.controller).
 *
 * Every mutation triggers a logActivity() call.
 *
 * @routes (all protected)
 *  GET    /api/tasks          — Get current user's tasks
 *  POST   /api/tasks          — Create a task
 *  GET    /api/tasks/:id      — Get a single task (owner only)
 *  PATCH  /api/tasks/:id      — Update a task (owner only)
 *  DELETE /api/tasks/:id      — Soft-delete a task (owner only)
 */

const Task = require('../models/Task');
const { logActivity } = require('../helpers/activityLogger');
const { AppError } = require('../middleware/auth.middleware');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all tasks for the logged-in user
// @route   GET /api/tasks
// @access  Protected
// ─────────────────────────────────────────────────────────────────────────────
const getTasks = async (req, res, next) => {
  try {
    const { status, priority, page = 1, limit = 20 } = req.query;
    const filter = { owner: req.user._id };

    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [tasks, total] = await Promise.all([
      Task.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Task.countDocuments(filter),
    ]);

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
// @desc    Create a new task
// @route   POST /api/tasks
// @access  Protected
// ─────────────────────────────────────────────────────────────────────────────
const createTask = async (req, res, next) => {
  try {
    const { title, description, status, priority, dueDate } = req.body;

    const task = await Task.create({
      title,
      description,
      status,
      priority,
      dueDate,
      owner: req.user._id, // Always set from authenticated user — never from body
    });

    // ── Log: TASK_CREATED ─────────────────────────────────────────────────
    await logActivity({
      req,
      actor: req.user,
      action: 'TASK_CREATED',
      resourceType: 'Task',
      resourceId: task._id,
      metadata: { after: task.toObject() },
    });

    res.status(201).json({ success: true, data: { task } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get a single task by ID (owner only)
// @route   GET /api/tasks/:id
// @access  Protected
// ─────────────────────────────────────────────────────────────────────────────
const getTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) return next(new AppError('Task not found.', 404));

    // Ownership check — Users can only read their own tasks
    if (task.owner.toString() !== req.user._id.toString()) {
      return next(new AppError('You do not have permission to view this task.', 403));
    }

    res.status(200).json({ success: true, data: { task } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update a task (owner only)
// @route   PATCH /api/tasks/:id
// @access  Protected
// ─────────────────────────────────────────────────────────────────────────────
const updateTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) return next(new AppError('Task not found.', 404));

    if (task.owner.toString() !== req.user._id.toString()) {
      return next(new AppError('You do not have permission to update this task.', 403));
    }

    // Capture state BEFORE update for the audit log diff
    const beforeSnapshot = task.toObject();

    const allowedFields = ['title', 'description', 'status', 'priority', 'dueDate'];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) task[field] = req.body[field];
    });

    const updatedTask = await task.save();

    // ── Determine if this was a status change for finer-grained logging ───
    const actionType =
      beforeSnapshot.status !== updatedTask.status ? 'TASK_STATUS_CHANGED' : 'TASK_UPDATED';

    await logActivity({
      req,
      actor: req.user,
      action: actionType,
      resourceType: 'Task',
      resourceId: updatedTask._id,
      metadata: { before: beforeSnapshot, after: updatedTask.toObject() },
    });

    res.status(200).json({ success: true, data: { task: updatedTask } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Soft-delete a task (owner only)
// @route   DELETE /api/tasks/:id
// @access  Protected
// ─────────────────────────────────────────────────────────────────────────────
const deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) return next(new AppError('Task not found.', 404));

    if (task.owner.toString() !== req.user._id.toString()) {
      return next(new AppError('You do not have permission to delete this task.', 403));
    }

    task.isDeleted = true;
    task.deletedAt = new Date();
    await task.save();

    await logActivity({
      req,
      actor: req.user,
      action: 'TASK_DELETED',
      resourceType: 'Task',
      resourceId: task._id,
      metadata: { before: { title: task.title, status: task.status } },
    });

    res.status(200).json({ success: true, message: 'Task deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getTasks, createTask, getTask, updateTask, deleteTask };
