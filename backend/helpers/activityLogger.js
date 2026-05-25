/**
 * @module activityLogger
 * @description Reusable, fire-and-forget async helper for creating audit log entries.
 *
 * Design principles:
 *  - NEVER throws or rejects — log failures must not break the main request flow.
 *  - All actor fields are snapshotted at call time (denormalized).
 *  - Accepts an optional Express `req` object for IP/UserAgent extraction.
 *  - Exported as a single async function for clean import across all controllers.
 *
 * Usage:
 *   const { logActivity } = require('../helpers/activityLogger');
 *
 *   // Inside a controller (after performing the action):
 *   await logActivity({
 *     req,
 *     actor: req.user,
 *     action: 'TASK_CREATED',
 *     resourceType: 'Task',
 *     resourceId: newTask._id,
 *     metadata: { after: newTask.toObject() },
 *   });
 */

const ActivityLog = require('../models/ActivityLog');

/**
 * @typedef {Object} LogActivityOptions
 * @property {Object}        req          - Express request object (for IP/UA extraction).
 * @property {Object|null}   actor        - The authenticated user object (req.user). Null for anonymous events.
 * @property {string}        action       - The action enum value from ActivityLog schema.
 * @property {string}        resourceType - 'User' | 'Task' | 'Auth' | 'System'
 * @property {ObjectId|null} [resourceId] - The _id of the affected document.
 * @property {Object}        [metadata]   - Optional { before, after } diff objects.
 * @property {'success'|'failure'} [status] - Outcome of the action. Defaults to 'success'.
 * @property {string}        [errorMessage] - Error details when status is 'failure'.
 */

/**
 * Creates an ActivityLog document asynchronously.
 * Silently swallows all errors to avoid disrupting the main request lifecycle.
 *
 * @param {LogActivityOptions} options
 * @returns {Promise<void>}
 */
const logActivity = async ({
  req = null,
  actor = null,
  action,
  resourceType,
  resourceId = null,
  metadata = {},
  status = 'success',
  errorMessage = null,
}) => {
  try {
    // ── Sanitize metadata to strip sensitive fields ─────────────────────────
    const sanitize = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      const safe = { ...obj };
      // Never log raw passwords, even if accidentally passed in
      delete safe.password;
      delete safe.passwordHash;
      delete safe.__v;
      return safe;
    };

    // ── Extract network context from request ────────────────────────────────
    const ipAddress = req
      ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null)
      : null;
    const userAgent = req ? (req.headers['user-agent'] || null) : null;

    // ── Build actor snapshot (denormalized) ─────────────────────────────────
    const actorSnapshot = actor
      ? {
          userId: actor._id || actor.id || null,
          email: actor.email || 'unknown',
          role: actor.role || 'unknown',
        }
      : {
          userId: null,
          email: 'anonymous',
          role: 'none',
        };

    // ── Write the log entry ─────────────────────────────────────────────────
    await ActivityLog.create({
      actor: actorSnapshot,
      action,
      resource: {
        type: resourceType,
        resourceId,
      },
      metadata: {
        before: sanitize(metadata.before) ?? null,
        after: sanitize(metadata.after) ?? null,
        ipAddress,
        userAgent,
      },
      status,
      errorMessage,
    });
  } catch (logError) {
    // Log to server console only — never propagate to the caller
    console.error(`⚠️  ActivityLogger failed for action [${action}]:`, logError.message);
  }
};

/**
 * Convenience wrapper for logging failed/unauthorized actions.
 *
 * @param {Object} options - Same as logActivity but status defaults to 'failure'
 */
const logFailure = (options) =>
  logActivity({ ...options, status: 'failure' });

module.exports = { logActivity, logFailure };
