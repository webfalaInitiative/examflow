import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

import WebfalaLogo from '../components/WebfalaLogo';

export default function Login() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const demoAccounts = [
    { label: 'Superadmin (OWNER)', email: 'owner@example.com', password: 'ChangeMe123!' },
    { label: 'Admin', email: 'admin@example.com', password: 'AdminPass123!' },
    { label: 'Student', email: 'student@example.com', password: 'Student123!' },
  ];

  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [loading, user, router]);

  useEffect(() => {
    if (router.query.pending === 'approval') {
      setNotice('Your account was created. A superadmin must approve it before you can sign in. You will receive access once approved.');
    } else {
      setNotice('');
    }
  }, [router.query.pending]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return setError('Please enter a valid email');
    if (!password || password.length < 6) return setError('Password must be at least 6 characters');
    setSubmitting(true);
    try {
      await login(email, password);
      router.push('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
      setSubmitting(false);
    }
  };

  const loginDemo = async (eMail, pwd) => {
    setError('');
    setSubmitting(true);
    try {
      await login(eMail, pwd);
      router.push('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
      setSubmitting(false);
    }
  };

  if (loading || user) return null;

  return (
    <div className="auth-container">
      <div className="auth-card" role="main" aria-labelledby="login-title">
        <WebfalaLogo />
        <p className="auth-app-name">Exam Flow</p>
        <h1 id="login-title" className="visually-hidden">
          Sign in
        </h1>

        <p className="helper">Sign in to access your assessments and dashboard.</p>

        {notice && (
          <p className="helper" style={{ background: 'var(--primary-50)', padding: 12, borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
            {notice}
          </p>
        )}

        <form onSubmit={submit} aria-describedby="login-help">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />

          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />

          {error && <p className="error" role="alert">{error}</p>}

          <div className="form-actions">
            <button type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
            <a className="small-link" href="/register">Register</a>
          </div>
        </form>

        <div className="center-small">
          <span className="helper">Need help?</span>
          <a className="small-link" href="#">Contact support</a>
        </div>

        <div style={{ marginTop: 14 }}>
          <button type="button" className="demo-toggle" onClick={() => setDemoOpen(!demoOpen)} aria-expanded={demoOpen} aria-controls="demo-panel">
            {demoOpen ? 'Hide demo accounts' : 'Show demo accounts'}
          </button>
          {demoOpen && (
            <div id="demo-panel" className="demo-panel" role="region" aria-label="Demo accounts">
              <p className="helper">Use these demo accounts for quick testing.</p>
              {demoAccounts.map((a) => (
                <div key={a.email} className="demo-account">
                  <div>
                    <strong>{a.label}</strong>
                    <div className="helper">{a.email}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="secondary btn-sm" onClick={() => { setEmail(a.email); setPassword(a.password); }}>
                      Autofill
                    </button>
                    <button type="button" className="btn-sm" onClick={() => loginDemo(a.email, a.password)} disabled={submitting}>
                      Sign in
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
