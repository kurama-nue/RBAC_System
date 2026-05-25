const mongoose = require('mongoose');

/**
 * @schema TaskSchema
 * Represents a task owned by a user.
 *
 * Key design decisions:
 *  - `owner`      : Required ObjectId ref — Users only access their own tasks (RBAC).
 *  - `assignedTo` : Optional — allows Admins to delegate tasks.
 *  - `isDeleted`  : Soft-delete flag — preserves history in ActivityLogs.
 *  - Compound index on (owner, isDeleted) for efficient user-task queries.
 */
const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: ['todo', 'in-progress', 'done'],
        message: 'Status must be todo, in-progress, or done',
      },
      default: 'todo',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },

    // ── Ownership (RBAC) ─────────────────────────────────────────────────────
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Task must have an owner'],
      index: true,
    },

    // ── Optional Admin Assignment ────────────────────────────────────────────
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // ── Soft Delete ──────────────────────────────────────────────────────────
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },

    // ── Optional Due Date ────────────────────────────────────────────────────
    dueDate: {
      type: Date,
      default: null,
    },

    // ── Voyage AI Embedding (voyage-large-2, 1024-dim) ───────────────────────
    // Stores the semantic embedding of (title + description + status + priority).
    // Used for MongoDB Atlas Vector Search in the RAG pipeline.
    // Set embeddingUpdatedAt to null to signal that re-embedding is needed.
    embedding: {
      type: [Number],
      default: undefined,
      select: false,        // Excluded from regular queries to keep payloads small
    },
    embeddingUpdatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ── Compound Indexes ─────────────────────────────────────────────────────────
taskSchema.index({ owner: 1, isDeleted: 1 });
taskSchema.index({ owner: 1, status: 1 });

// ── Query Middleware: Automatically filter soft-deleted tasks ─────────────────
// Applied to all find-based queries so controllers don't need to add this manually
taskSchema.pre(/^find/, function (next) {
  // Only apply the filter if not explicitly bypassed
  if (this.getOptions().includeSoftDeleted !== true) {
    this.where({ isDeleted: false });
  }
  next();
});

module.exports = mongoose.model('Task', taskSchema);
