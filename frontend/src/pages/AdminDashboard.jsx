import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import AnalyticsCard from '../components/AnalyticsCard';
import axiosInstance from '../api/axiosInstance';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from 'recharts';

/**
 * @page AdminDashboard
 * Full admin overview with:
 *  - Analytics stat cards (users, tasks by status, recent logins)
 *  - Task status pie chart
 *  - Top activity bar chart
 *  - Recent users table with inline role + status management
 *  - Activity log feed
 */

const COLORS = {
  todo:       '#64748b',
  inProgress: '#f59e0b',
  done:       '#10b981',
  brand:      '#6366f1',
};

const PIE_COLORS = [COLORS.todo, COLORS.inProgress, COLORS.done];

// ── Tooltip for recharts ───────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-muted)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
        fontSize: 13,
      }}>
        <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{label}</p>
        {payload.map((p) => (
          <p key={p.dataKey} style={{ color: p.fill || p.color }}>
            {p.name}: <strong>{p.value}</strong>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const AdminDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [actionLoading, setActionLoading] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, usersRes, logsRes] = await Promise.all([
        axiosInstance.get('/admin/analytics'),
        axiosInstance.get('/admin/users?limit=10'),
        axiosInstance.get('/admin/logs?limit=15'),
      ]);
      setAnalytics(analyticsRes.data.data);
      setUsers(usersRes.data.data.users);
      setLogs(logsRes.data.data.logs);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ── Toggle user active status ───────────────────────────────────────────────
  const handleToggleStatus = async (userId, currentStatus) => {
    setActionLoading(userId);
    try {
      await axiosInstance.patch(`/admin/users/${userId}/status`, { isActive: !currentStatus });
      setUsers((prev) =>
        prev.map((u) => u._id === userId ? { ...u, isActive: !currentStatus } : u)
      );
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status.');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Change user role ────────────────────────────────────────────────────────
  const handleRoleChange = async (userId, newRole) => {
    setActionLoading(userId);
    try {
      await axiosInstance.patch(`/admin/users/${userId}/role`, { role: newRole });
      setUsers((prev) =>
        prev.map((u) => u._id === userId ? { ...u, role: newRole } : u)
      );
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update role.');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Pie chart data ──────────────────────────────────────────────────────────
  const pieData = analytics ? [
    { name: 'To Do',       value: analytics.tasks.todo },
    { name: 'In Progress', value: analytics.tasks.inProgress },
    { name: 'Done',        value: analytics.tasks.done },
  ] : [];

  // ── Bar chart data (top actions) ────────────────────────────────────────────
  const barData = analytics?.activity?.topActions?.map(({ _id, count }) => ({
    action: _id.replace(/_/g, ' '),
    count,
  })) ?? [];

  if (loading) {
    return (
      <div className="dashboard-layout">
        <Sidebar />
        <main className="dashboard-main">
          <div className="spinner-container"><div className="spinner" /></div>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-main">
        {/* ── Page Header ──────────────────────────────────────────────────── */}
        <div className="page-header flex items-center justify-between">
          <div>
            <h1>Admin Dashboard</h1>
            <p>Monitor users, tasks, and system activity in real time.</p>
          </div>
          <button
            id="btn-refresh-dashboard"
            className="btn btn-ghost"
            onClick={fetchData}
            aria-label="Refresh dashboard data"
          >
            🔄 Refresh
          </button>
        </div>

        {/* ── Analytics Cards ───────────────────────────────────────────────── */}
        <div className="analytics-grid">
          <AnalyticsCard
            label="Total Users"
            value={analytics?.users?.total}
            icon="👥"
            trend={`${analytics?.users?.active} active`}
            accentColor="rgba(99, 102, 241, 0.5)"
            accentBg="rgba(99, 102, 241, 0.12)"
            accentBorder="rgba(99, 102, 241, 0.2)"
          />
          <AnalyticsCard
            label="Total Tasks"
            value={analytics?.tasks?.total}
            icon="📋"
            trend={`${analytics?.tasks?.done} completed`}
            accentColor="rgba(16, 185, 129, 0.5)"
            accentBg="rgba(16, 185, 129, 0.12)"
            accentBorder="rgba(16, 185, 129, 0.2)"
          />
          <AnalyticsCard
            label="Completed Tasks"
            value={analytics?.tasks?.done}
            icon="✅"
            trend="done"
            trendUp={true}
            accentColor="rgba(52, 211, 153, 0.5)"
            accentBg="rgba(52, 211, 153, 0.12)"
            accentBorder="rgba(52, 211, 153, 0.2)"
          />
          <AnalyticsCard
            label="Pending Tasks"
            value={(analytics?.tasks?.todo ?? 0) + (analytics?.tasks?.inProgress ?? 0)}
            icon="⏳"
            trend="todo + in-progress"
            trendUp={false}
            accentColor="rgba(245, 158, 11, 0.5)"
            accentBg="rgba(245, 158, 11, 0.12)"
            accentBorder="rgba(245, 158, 11, 0.2)"
          />
          <AnalyticsCard
            label="Logins (24h)"
            value={analytics?.activity?.loginsLast24h}
            icon="🔐"
            trend="last 24 hours"
            accentColor="rgba(99, 102, 241, 0.5)"
            accentBg="rgba(99, 102, 241, 0.12)"
            accentBorder="rgba(99, 102, 241, 0.2)"
          />
          <AnalyticsCard
            label="Admins"
            value={analytics?.users?.admins}
            icon="👑"
            trend="of total users"
            accentColor="rgba(251, 191, 36, 0.5)"
            accentBg="rgba(251, 191, 36, 0.12)"
            accentBorder="rgba(251, 191, 36, 0.2)"
          />
        </div>

        {/* ── Charts ───────────────────────────────────────────────────────── */}
        <div className="grid-2 mb-8">
          {/* Task Status Pie */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">📊 Task Status Breakdown</span>
            </div>
            <div className="panel-body chart-container">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(value) => (
                      <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Actions Bar Chart */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">📈 Top Activity Events</span>
            </div>
            <div className="panel-body chart-container">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={barData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="action"
                    width={120}
                    tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill={COLORS.brand} radius={[0, 4, 4, 0]} name="Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Tabs: Users | Logs ───────────────────────────────────────────── */}
        <div className="mb-4">
          <div className="flex gap-2">
            {['overview', 'logs'].map((tab) => (
              <button
                key={tab}
                id={`tab-${tab}`}
                className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'overview' ? '👥 Users' : '📋 Activity Log'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Users Table ──────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="panel animate-in">
            <div className="panel-header">
              <span className="panel-title">Recent Users</span>
              <a href="/admin/users" className="btn btn-ghost btn-sm">View All →</a>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" id="admin-users-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id} id={`user-row-${u._id}`}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        <div className="flex items-center gap-2">
                          <div className="sidebar-avatar" style={{ width: 28, height: 28, fontSize: 12 }}>
                            {u.name[0].toUpperCase()}
                          </div>
                          {u.name}
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <select
                          id={`role-select-${u._id}`}
                          className="form-input"
                          style={{ padding: '4px 8px', fontSize: 12, width: 'auto' }}
                          value={u.role}
                          onChange={(e) => handleRoleChange(u._id, e.target.value)}
                          disabled={actionLoading === u._id}
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td>
                        <span className={`badge ${u.isActive ? 'badge-success' : 'badge-danger'}`}>
                          {u.isActive ? '● Active' : '● Inactive'}
                        </span>
                      </td>
                      <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td>
                        <button
                          id={`btn-toggle-status-${u._id}`}
                          className={`btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-ghost'}`}
                          onClick={() => handleToggleStatus(u._id, u.isActive)}
                          disabled={actionLoading === u._id}
                        >
                          {actionLoading === u._id
                            ? '...'
                            : u.isActive ? 'Deactivate' : 'Activate'
                          }
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No users found.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Activity Log Feed ────────────────────────────────────────────── */}
        {activeTab === 'logs' && (
          <div className="panel animate-in">
            <div className="panel-header">
              <span className="panel-title">Recent Activity</span>
              <span className="text-sm text-muted">Last 15 events</span>
            </div>
            <div className="panel-body" style={{ padding: '12px 16px' }}>
              {logs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No activity logs yet.
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log._id} className="log-entry" id={`log-${log._id}`}>
                    <div className={`log-dot ${log.status}`} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="log-action">{log.action.replace(/_/g, ' ')}</div>
                      <div className="log-meta">
                        By <strong>{log.actor?.email ?? 'Unknown'}</strong>
                        {' · '}
                        <span className={`badge badge-${log.actor?.role === 'admin' ? 'admin' : 'user'}`} style={{ padding: '1px 6px', fontSize: 10 }}>
                          {log.actor?.role}
                        </span>
                        {' · '}
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <span className={`badge ${log.status === 'success' ? 'badge-success' : 'badge-danger'}`}>
                      {log.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
