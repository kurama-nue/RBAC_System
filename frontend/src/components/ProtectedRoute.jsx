import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * @component ProtectedRoute
 * Guards routes by authentication status and optional role requirement.
 *
 * Behaviors:
 *  1. While auth is loading (rehydrating from localStorage) → show spinner
 *  2. If not authenticated → redirect to /login (preserving intended destination)
 *  3. If authenticated but wrong role → redirect to their default dashboard
 *  4. If authenticated with correct role (or no role required) → render children
 *
 * @prop {React.ReactNode} children   - The component to render if access is granted
 * @prop {string[]}        [allowedRoles] - If provided, user.role must be in this list
 *
 * Usage:
 *   <ProtectedRoute>                        // Any authenticated user
 *   <ProtectedRoute allowedRoles={['admin']}> // Admin only
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();

  // ── 1. Loading state: avoid flash of redirect ─────────────────────────────
  if (isLoading) {
    return (
      <div className="spinner-container" style={{ minHeight: '100vh' }}>
        <div className="spinner" aria-label="Verifying authentication..." />
      </div>
    );
  }

  // ── 2. Not authenticated: redirect to login, preserve intended URL ─────────
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // ── 3. Authenticated but insufficient role ────────────────────────────────
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // Redirect to the user's appropriate dashboard instead of a generic 403 page
    const fallback = user?.role === 'admin' ? '/admin' : '/dashboard';
    return <Navigate to={fallback} replace />;
  }

  // ── 4. Access granted ─────────────────────────────────────────────────────
  return children;
};

export default ProtectedRoute;
