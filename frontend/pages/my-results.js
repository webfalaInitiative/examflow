import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import RequireAuth from '../components/RequireAuth';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

export default function MyResultsPage() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    if (!user) return;
    api.get('/submissions').then(r => setSubmissions(r.data)).catch(() => {});
  }, [user]);

  const visible = submissions.filter((s) => !s.resultsPending);
  const graded = visible.filter((s) => s.graded && s.score != null);
  const pending = submissions.filter((s) => !s.graded || s.resultsPending);
  const avgScore = graded.length > 0
    ? graded.reduce((acc, s) => acc + (s.score || 0), 0) / graded.length
    : null;

  return (
    <RequireAuth>
    <DashboardLayout>
      <div className="page-header">
        <h1>My Results 📈</h1>
        <p>Track your exam performance</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon green">✅</div>
          <div>
            <div className="stat-label">Total Submitted</div>
            <div className="stat-value">{submissions.length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue">📊</div>
          <div>
            <div className="stat-label">Average Score</div>
            <div className="stat-value">{avgScore != null ? (avgScore * 100).toFixed(0) + '%' : '–'}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange">⏳</div>
          <div>
            <div className="stat-label">Pending Grading</div>
            <div className="stat-value">{pending.length}</div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>All Submissions</h2>
        </div>
        <div className="panel-body no-pad">
          {submissions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <p>No submissions yet. Go take an exam!</p>
              <a href="/exam" className="small-link" style={{ marginTop: 12 }}>Take Exam →</a>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Folder</th>
                  <th>Type</th>
                  <th>Score</th>
                  <th>Status</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map(s => (
                  <tr key={s.id}>
                    <td><strong>{s.question?.title || '—'}</strong></td>
                    <td>{s.exam?.title || <span className="text-muted">General</span>}</td>
                    <td>
                      <span className={`badge ${s.question?.type === 'mcq' ? 'blue' : 'gray'}`}>
                        {s.question?.type?.toUpperCase() || '—'}
                      </span>
                    </td>
                    <td>
                      {s.resultsPending ? (
                        <span className="helper" style={{ fontWeight: 600 }}>Awaiting release</span>
                      ) : s.score != null ? (
                        <span style={{ fontWeight: 700, color: s.score >= 0.5 ? 'var(--success-700)' : 'var(--error-700)' }}>
                          {(s.score * 100).toFixed(0)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <span className={`badge ${s.resultsPending ? 'orange' : s.graded ? (s.score >= 0.5 ? 'green' : 'red') : 'orange'}`}>
                        {s.resultsPending ? 'Results pending' : s.graded ? (s.score >= 0.5 ? 'Passed' : 'Failed') : 'Pending'}
                      </span>
                    </td>
                    <td>{new Date(s.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
    </RequireAuth>
  );
}
