import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

/**
 * Ensures auth is resolved and redirects guests to /login.
 * Pages must not return null before mounting DashboardLayout — that caused a blank screen at /.
 */
export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Redirecting to sign in…</p>
      </div>
    );
  }

  return children;
}
