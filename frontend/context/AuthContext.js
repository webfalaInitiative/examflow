import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import api from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      // Check expiry
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('token');
        setLoading(false);
        return;
      }
      // Fetch full profile
      api.get('/users/me').then((res) => {
        setUser(res.data);
        setLoading(false);
      }).catch((err) => {
        // Only clear token on a genuine 401 (token is truly invalid/expired)
        // For network errors or server issues (e.g. Render cold-start), keep the
        // token and use the JWT payload so the user isn't kicked out needlessly
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          setLoading(false);
        } else {
          // Fallback: use the JWT payload directly so the session survives
          setUser({ id: payload.sub, role: payload.role });
          setLoading(false);
        }
      });
    } catch {
      localStorage.removeItem('token');
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const register = async (name, email, password) => {
    await api.post('/auth/register', { email, password, name });
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
