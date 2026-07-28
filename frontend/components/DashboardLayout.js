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
    { href: '/submissions', label: 'Submissions', icon: '📋' },
    { href: '/users', label: 'Users', icon: '👥' },
    ...(user.role === 'OWNER' ? [{ href: '/superadmin', label: 'Superadmin', icon: '🛡️' }] : []),
  ];

  const roleLabel = user.role === 'OWNER' ? 'Superadmin' : user.role === 'ADMIN' ? 'Admin' : 'Student';

  const studentLinks = [
    { href: '/', label: 'Dashboard', icon: '📊' },
    { href: '/exams', label: 'My Exams', icon: '📁' },
    { href: '/exam', label: 'Take Exam', icon: '✏️' },
    { href: '/my-results', label: 'My Results', icon: '📈' },
  ];

  const links = isAdmin ? adminLinks : studentLinks;

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
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`sidebar-link ${currentPath === link.href ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="sidebar-icon">{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-badge">
            <div className="user-avatar">
              {((user.name || user.email || 'U').charAt(0) || 'U').toUpperCase()}
            </div>
            <div className="user-info">
              <span className="user-name">{user.name || user.email || 'User'}</span>
              <span className="user-role">{roleLabel}</span>
            </div>
          </div>
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
            <span className="role-pill">{roleLabel}</span>
            <span className="topbar-name">{user.name || user.email}</span>
          </div>
        </header>

        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
