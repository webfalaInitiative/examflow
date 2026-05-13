import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import WebfalaLogo from '../components/WebfalaLogo';

export default function Register() {
  const { user, loading, register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [loading, user, router]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name) return setError('Please enter your name');
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return setError('Please enter a valid email');
    if (!password || password.length < 6) return setError('Password must be at least 6 characters');
    setSubmitting(true);
    try {
      await register(name, email, password);
      router.push('/login?pending=approval');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
      setSubmitting(false);
    }
  };

  if (loading || user) return null;

  return (
    <div className="auth-container">
      <div className="auth-card" role="main" aria-labelledby="register-title">
        <WebfalaLogo />
        <p className="auth-app-name">Exam Flow</p>
        <h1 id="register-title" className="visually-hidden">
          Create an account
        </h1>

        <p className="helper">Create an account to start taking assessments.</p>

        <form onSubmit={submit}>
          <label htmlFor="name">Full name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />

          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />

          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a password" />

          {error && <p className="error" role="alert">{error}</p>}

          <div className="form-actions">
            <button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create account'}</button>
            <a className="small-link" href="/login">Already have an account?</a>
          </div>
        </form>
      </div>
    </div>
  );
}
