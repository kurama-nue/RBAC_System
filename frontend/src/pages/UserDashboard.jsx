import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import AnalyticsCard from '../components/AnalyticsCard';
import axiosInstance from '../api/axiosInstance';
import { useAuth } from '../context/AuthContext';

/**
 * @page UserDashboard
 * Authenticated user's personal task management view.
 * Shows only the user's own tasks — enforced by the backend via owner field.
 * Analytics show personal task metrics.
 */

const STATUS_OPTIONS = ['todo', 'in-progress', 'done'];
const STATUS_LABELS  = { todo: 'To Do', 'in-progress': 'In Progress', done: 'Done' };

const UserDashboard = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' });
  const [formLoading, setFormLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const { data } = await axiosInstance.get(`/tasks${params}`);
      setTasks(data.data.tasks);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, [statusFilter]);

  // ── Task analytics (computed from local state) ────────────────────────────
  const allTasks  = tasks;
  const done      = allTasks.filter((t) => t.status === 'done').length;
  const pending   = allTasks.filter((t) => t.status !== 'done').length;
  const inProgress = allTasks.filter((t) => t.status === 'in-progress').length;

  // ── Create task ───────────────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setFormLoading(true);
    try {
      const { data } = await axiosInstance.post('/tasks', form);
      setTasks((prev) => [data.data.task, ...prev]);
      setForm({ title: '', description: '', priority: 'medium' });
      setShowForm(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create task.');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Update task status ────────────────────────────────────────────────────
  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await axiosInstance.patch(`/tasks/${taskId}`, { status: newStatus });
      setTasks((prev) =>
        prev.map((t) => t._id === taskId ? { ...t, status: newStatus } : t)
      );
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update task.');
    }
  };

  // ── Delete (soft) task ────────────────────────────────────────────────────
  const handleDelete = async (taskId) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await axiosInstance.delete(`/tasks/${taskId}`);
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete task.');
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-main">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="page-header flex items-center justify-between">
          <div>
            <h1>My Dashboard</h1>
            <p>Welcome back, {user?.name}! Here are your tasks.</p>
          </div>
          <button
            id="btn-new-task"
            className="btn btn-primary"
            onClick={() => setShowForm((prev) => !prev)}
          >
            {showForm ? '✕ Cancel' : '＋ New Task'}
          </button>
        </div>

        {/* ── Stat Cards ───────────────────────────────────────────────────── */}
        <div className="analytics-grid">
          <AnalyticsCard
            label="Total Tasks"
            value={allTasks.length}
            icon="📋"
            accentColor="rgba(99,102,241,0.5)"
            accentBg="rgba(99,102,241,0.12)"
            accentBorder="rgba(99,102,241,0.2)"
          />
          <AnalyticsCard
            label="Completed"
            value={done}
            icon="✅"
            trend={allTasks.length ? `${Math.round((done / allTasks.length) * 100)}% done` : undefined}
            accentColor="rgba(16,185,129,0.5)"
            accentBg="rgba(16,185,129,0.12)"
            accentBorder="rgba(16,185,129,0.2)"
          />
          <AnalyticsCard
            label="In Progress"
            value={inProgress}
            icon="🔄"
            accentColor="rgba(245,158,11,0.5)"
            accentBg="rgba(245,158,11,0.12)"
            accentBorder="rgba(245,158,11,0.2)"
          />
          <AnalyticsCard
            label="Pending"
            value={pending}
            icon="⏳"
            trendUp={false}
            accentColor="rgba(248,113,113,0.5)"
            accentBg="rgba(248,113,113,0.12)"
            accentBorder="rgba(248,113,113,0.2)"
          />
        </div>

        {/* ── New Task Form ─────────────────────────────────────────────────── */}
        {showForm && (
          <div className="panel mb-6 animate-in">
            <div className="panel-header">
              <span className="panel-title">Create New Task</span>
            </div>
            <div className="panel-body">
              <form onSubmit={handleCreate} id="create-task-form">
                <div className="grid-2">
                  <div className="form-group">
                    <label htmlFor="task-title" className="form-label">Title *</label>
                    <input
                      id="task-title"
                      className="form-input"
                      placeholder="Task title"
                      value={form.title}
                      onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="task-priority" className="form-label">Priority</label>
                    <select
                      id="task-priority"
                      className="form-input"
                      value={form.priority}
                      onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="task-description" className="form-label">Description</label>
                  <textarea
                    id="task-description"
                    className="form-input"
                    placeholder="Optional description..."
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    style={{ resize: 'vertical' }}
                  />
                </div>
                <button
                  id="btn-create-task-submit"
                  type="submit"
                  className="btn btn-primary"
                  disabled={formLoading}
                >
                  {formLoading ? 'Creating...' : '＋ Create Task'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── Filter Bar ───────────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-4">
          <button
            id="filter-all"
            className={`btn btn-sm ${!statusFilter ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setStatusFilter('')}
          >
            All
          </button>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              id={`filter-${s}`}
              className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setStatusFilter(s)}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* ── Tasks List ───────────────────────────────────────────────────── */}
        {loading ? (
          <div className="spinner-container"><div className="spinner" /></div>
        ) : tasks.length === 0 ? (
          <div className="panel">
            <div className="panel-body" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
              <p>No tasks found. Create your first one!</p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tasks.map((task) => (
              <div key={task._id} id={`task-card-${task._id}`} className="panel animate-in"
                style={{ borderLeft: `3px solid ${task.priority === 'high' ? 'var(--danger-400)' : task.priority === 'medium' ? 'var(--warn-400)' : 'var(--text-muted)'}` }}
              >
                <div className="panel-body" style={{ padding: '16px 20px' }}>
                  <div className="flex items-center justify-between">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center gap-2 mb-4">
                        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                          {task.title}
                        </span>
                        <span className={`badge badge-${task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'warning' : 'user'}`}>
                          {task.priority}
                        </span>
                      </div>
                      {task.description && (
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <select
                          id={`task-status-${task._id}`}
                          className="form-input"
                          style={{ padding: '4px 8px', fontSize: 12, width: 'auto' }}
                          value={task.status}
                          onChange={(e) => handleStatusChange(task._id, e.target.value)}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {new Date(task.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <button
                      id={`btn-delete-task-${task._id}`}
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(task._id)}
                      style={{ marginLeft: 12 }}
                      aria-label={`Delete task ${task.title}`}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default UserDashboard;
