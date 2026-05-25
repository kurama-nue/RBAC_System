import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import axiosInstance from '../api/axiosInstance';

/**
 * @context AuthContext
 * Global authentication state provider.
 *
 * Provides:
 *  - user       : Decoded user object { id, email, role } or null
 *  - token      : Raw JWT string or null
 *  - isLoading  : True while verifying persisted session on mount
 *  - login()    : Handles login, stores token, sets user state
 *  - logout()   : Clears state and localStorage
 *  - isAdmin()  : Convenience role check
 *  - isUser()   : Convenience role check
 */

const AuthContext = createContext(null);

// ─── Token validation helper ──────────────────────────────────────────────────
const isTokenValid = (token) => {
  if (!token) return false;
  try {
    const decoded = jwtDecode(token);
    // exp is in seconds; Date.now() is in milliseconds
    return decoded.exp * 1000 > Date.now();
  } catch {
    return false;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// AuthProvider
// ─────────────────────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── On mount: rehydrate from localStorage ─────────────────────────────────
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser  = localStorage.getItem('user');

    if (storedToken && isTokenValid(storedToken) && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {
        // Corrupted storage — clear and force re-login
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }

    setIsLoading(false);
  }, []);

  // ── login: called after successful API response ───────────────────────────
  const login = useCallback(({ token: newToken, data }) => {
    const { user: userData } = data;

    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));

    setToken(newToken);
    setUser(userData);
  }, []);

  // ── logout: clears all auth state ────────────────────────────────────────
  const logout = useCallback(async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  // ── Role helpers ──────────────────────────────────────────────────────────
  const isAdmin = useCallback(() => user?.role === 'admin', [user]);
  const isUser  = useCallback(() => user?.role === 'user',  [user]);

  const value = {
    user,
    token,
    isLoading,
    login,
    logout,
    isAdmin,
    isUser,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ─────────────────────────────────────────────────────────────────────────────
// useAuth: Custom hook for consuming the context
// ─────────────────────────────────────────────────────────────────────────────
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return context;
};

export default AuthContext;
