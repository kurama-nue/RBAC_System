import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * @component Sidebar
 * Navigation sidebar with conditional menu items based on user role.
 *
 * Admin users see: Dashboard, Users, Tasks, Activity Logs
 * Regular users see: Dashboard, My Tasks
 *
 * The active route is automatically highlighted via NavLink's isActive prop.
 */

// ─── Nav item definitions ─────────────────────────────────────────────────────
const NAV_ITEMS = [
  // Visible to all authenticated users
  {
    label: 'Dashboard',
    icon: '⚡',
    to: (role) => (role === 'admin' ? '/admin' : '/dashboard'),
    roles: ['admin', 'user'],
    section: 'main',
  },
  {
    label: 'My Tasks',
    icon: '✅',
    to: () => '/dashboard/tasks',
    roles: ['user'],
    section: 'main',
  },
  // Admin-only items
  {
    label: 'All Users',
    icon: '👥',
    to: () => '/admin/users',
    roles: ['admin'],
    section: 'admin',
  },
  {
    label: 'All Tasks',
    icon: '📋',
    to: () => '/admin/tasks',
    roles: ['admin'],
    section: 'admin',
  },
  {
    label: 'Activity Logs',
    icon: '📊',
    to: () => '/admin/logs',
    roles: ['admin'],
    section: 'admin',
  },
];

const Sidebar = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Filter nav items for the current user's role
  const mainItems  = NAV_ITEMS.filter((item) => item.section === 'main'  && item.roles.includes(user?.role));
  const adminItems = NAV_ITEMS.filter((item) => item.section === 'admin' && item.roles.includes(user?.role));

  return (
    <aside className="sidebar" role="navigation" aria-label="Main navigation">
      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon" aria-hidden="true">🛡️</div>
        <span className="sidebar-logo-text">RBAC System</span>
      </div>

      {/* ── Navigation ──────────────────────────────────────────────────────── */}
      <nav className="sidebar-nav">
        {/* Main section */}
        <span className="sidebar-section-label">Main</span>
        {mainItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.to(user?.role)}
            end={item.label === 'Dashboard'}
            className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
            id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <span className="sidebar-item-icon" aria-hidden="true">{item.icon}</span>
            <span className="sidebar-item-text">{item.label}</span>
          </NavLink>
        ))}

        {/* Admin section — only rendered for admins */}
        {isAdmin() && adminItems.length > 0 && (
          <>
            <span className="sidebar-section-label" style={{ marginTop: '20px' }}>
              Admin
            </span>
            {adminItems.map((item) => (
              <NavLink
                key={item.label}
                to={item.to(user?.role)}
                className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
                id={`nav-admin-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <span className="sidebar-item-icon" aria-hidden="true">{item.icon}</span>
                <span className="sidebar-item-text">{item.label}</span>
                {item.badge && <span className="sidebar-item-badge">{item.badge}</span>}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* ── User Profile + Logout ───────────────────────────────────────────── */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar" aria-hidden="true">
            {user?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sidebar-user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name ?? 'Unknown'}
            </div>
            <div className="sidebar-user-role">{user?.role ?? '—'}</div>
          </div>
        </div>
        <button
          id="btn-logout"
          className="btn btn-ghost w-full"
          onClick={handleLogout}
          style={{ marginTop: '8px', justifyContent: 'center' }}
          aria-label="Logout"
        >
          🚪 Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
