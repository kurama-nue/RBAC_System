const mongoose = require('mongoose');

/**
 * @schema ActivityLogSchema
 * Immutable audit trail for all significant system events.
 *
 * Key design decisions:
 *  - `actor` fields are DENORMALIZED (email, role copied at event time).
 *    This ensures the log remains accurate even if the user is later deleted or
 *    their role changes — critical for forensic audit trails.
 *  - `metadata.before` / `metadata.after` capture state diffs for UPDATE events.
 *  - `status` captures whether the action succeeded or failed (e.g., failed login).
 *  - TTL index (commented out) can be enabled to auto-purge old logs after N days.
 *  - This collection should be WRITE-ONLY from the app — never update or delete logs.
 */
const activityLogSchema = new mongoose.Schema(
  {
    // ── WHO performed the action ────────────────────────────────────────────
    actor: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
        default: null, // null for unauthenticated events (e.g., failed login)
      },
      email: {
        type: String,
        default: 'anonymous',
      },
      role: {
        type: String,
        default: 'unknown',
      },
    },

    // ── WHAT happened ───────────────────────────────────────────────────────
    action: {
      type: String,
      required: [true, 'Action is required'],
      enum: [
        // Auth events
        'USER_REGISTER',
        'USER_LOGIN',
        'USER_LOGIN_FAILED',
        'USER_LOGOUT',
        // User management (Admin actions)
        'USER_CREATED',
        'USER_UPDATED',
        'USER_DELETED',
        'USER_ACTIVATED',
        'USER_DEACTIVATED',
        'ROLE_CHANGED',
        // Task events
        'TASK_CREATED',
        'TASK_UPDATED',
        'TASK_STATUS_CHANGED',
        'TASK_DELETED',
        'TASK_RESTORED',
        // Admin views (optional — for detailed audit)
        'ADMIN_VIEWED_USERS',
        'ADMIN_VIEWED_LOGS',
        'ADMIN_VIEWED_ALL_TASKS',
      ],
      index: true,
    },

    // ── ON WHAT resource ────────────────────────────────────────────────────
    resource: {
      type: {
        type: String,
        enum: ['User', 'Task', 'Auth', 'System'],
        required: true,
      },
      resourceId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null, // null for Auth events
      },
    },

    // ── CONTEXT & DIFF ──────────────────────────────────────────────────────
    metadata: {
      // State snapshots for UPDATE events (omit sensitive fields like passwords)
      before: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
      after: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
      // Network context
      ipAddress: {
        type: String,
        default: null,
      },
      userAgent: {
        type: String,
        default: null,
      },
    },

    // ── OUTCOME ──────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['success', 'failure'],
      default: 'success',
      index: true,
    },
    errorMessage: {
      type: String,
      default: null, // Populated on failure status
    },
  },
  {
    timestamps: true,
    // ActivityLogs are immutable — disable update operations at schema level
    strict: true,
  }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
activityLogSchema.index({ createdAt: -1 }); // Default sort: newest first
activityLogSchema.index({ 'actor.userId': 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ 'resource.resourceId': 1 });

// ── Optional TTL Index: auto-purge logs older than 90 days ──────────────────
// Uncomment to enable:
// activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
