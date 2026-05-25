/**
 * @module task.routes
 * @description Task CRUD routes — all require authentication.
 * Ownership enforcement is handled inside the controller.
 *
 * @baseRoute /api/tasks
 *
 * GET    /api/tasks        → Get current user's tasks
 * POST   /api/tasks        → Create a new task
 * GET    /api/tasks/:id    → Get a single task (owner only)
 * PATCH  /api/tasks/:id    → Update a task (owner only)
 * DELETE /api/tasks/:id    → Soft-delete a task (owner only)
 */

const express = require('express');
const router = express.Router();

const { getTasks, createTask, getTask, updateTask, deleteTask } = require('../controllers/task.controller');
const { protect } = require('../middleware/auth.middleware');

// Apply protect to ALL task routes — no public task endpoints
router.use(protect);

router.route('/').get(getTasks).post(createTask);
router.route('/:id').get(getTask).patch(updateTask).delete(deleteTask);

module.exports = router;
