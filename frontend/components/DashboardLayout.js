import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import WebfalaLogo from './WebfalaLogo';

export default function DashboardLayout({ children }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
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

  const isAdmin = user.role === 'OWNER' || user.role === 'ADMIN';
  const currentPath = router.pathname;

  const adminLinks = [
    { href: '/', label: 'Dashboard', icon: '📊' },
    { href: '/exams', label: 'Exam Folders', icon: '📁' },
    { href: '/questions', label: 'Questions', icon: '📝' },
    { href: '/grading', label: 'Grading / Publish', icon: '📊' },
    { href: '/users', label: 'Users', icon: '👥' },
    { href: '/profile', label: 'My Profile', icon: '👤' },
    ...(user.role === 'OWNER' ? [{ href: '/superadmin', label: 'Superadmin', icon: '🛡️' }] : []),
  ];

  const roleLabel = user.role === 'OWNER' ? 'Superadmin' : user.role === 'ADMIN' ? 'Admin' : 'Student';

  const studentLinks = [
    { href: '/', label: 'Dashboard', icon: '📊' },
    { href: '/exams', label: 'My Exams', icon: '📁' },
    { href: '/exam', label: 'Take Exam', icon: '✏️' },
    { href: '/my-results', label: 'My Results', icon: '📈' },
    { href: '/profile', label: 'My Profile', icon: '👤' },
  ];

  const links = isAdmin ? adminLinks : studentLinks;

  const initialLetter = ((user.name || user.email || 'U').charAt(0) || 'U').toUpperCase();

  return (
    <div className="dashboard-layout">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <WebfalaLogo variant="compact" />
          <span className="sidebar-title">Exam Flow</span>
        </div>

        <nav className="sidebar-nav">
          {links.map((link) => {
            const isActive =
              currentPath === link.href ||
              (link.href === '/grading' && (currentPath === '/grading' || currentPath.includes('/grading')));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="sidebar-icon">{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <Link href="/profile" className="user-badge" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="user-avatar" style={{ overflow: 'hidden' }}>
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                initialLetter
              )}
            </div>
            <div className="user-info">
              <span className="user-name">{user.name || user.email || 'User'}</span>
              <span className="user-role">{roleLabel}</span>
            </div>
          </Link>
          <button className="logout-btn" onClick={logout} title="Logout">
            ↪
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-area">
        <header className="topbar">
          <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle menu">
            ☰
          </button>
          <div className="topbar-right">
            <Link href="/profile" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent, #6366f1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', overflow: 'hidden' }}>
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  initialLetter
                )}
              </div>
              <span className="role-pill">{roleLabel}</span>
              <span className="topbar-name">{user.name || user.email}</span>
            </Link>
          </div>
        </header>

        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
