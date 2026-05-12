import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import RequireAuth from '../components/RequireAuth';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/router';
import api from '../lib/api';

export default function SuperadminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState([]);
  const [pendingQuestions, setPendingQuestions] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [tab, setTab] = useState('history');
  const [err, setErr] = useState('');

  const loadAll = () => {
    setErr('');
    api.get('/moderation/logs').then((r) => setLogs(r.data)).catch(() => setErr('Failed to load history'));
    api.get('/moderation/questions/pending').then((r) => setPendingQuestions(r.data)).catch(() => {});
    api.get('/moderation/users/pending').then((r) => setPendingUsers(r.data)).catch(() => {});
  };

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'OWNER') {
      router.replace('/');
      return;
    }
    loadAll();
  }, [user, router]);

  const approveQ = async (id) => {
    await api.post(`/moderation/questions/${id}/approve`);
    loadAll();
  };
  const rejectQ = async (id) => {
    const reason = window.prompt('Rejection reason (optional)') || '';
    await api.post(`/moderation/questions/${id}/reject`, { reason });
    loadAll();
  };
  const approveU = async (id) => {
    await api.post(`/moderation/users/${id}/approve`);
    loadAll();
  };
  const rejectU = async (id) => {
    const reason = window.prompt('Rejection reason (optional)') || '';
    await api.post(`/moderation/users/${id}/reject`, { reason });
    loadAll();
  };

  return (
    <RequireAuth>
      <DashboardLayout>
        {user?.role !== 'OWNER' ? (
          <p className="helper">You do not have access to this page.</p>
        ) : (
          <>
            <div className="page-header">
              <h1>Superadmin</h1>
              <p>Approval history, pending questions, and pending student accounts (authority above admins).</p>
            </div>

            {err && <p className="error" role="alert">{err}</p>}

            <div className="panel" style={{ marginBottom: 16 }}>
              <div className="panel-body" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['history', 'questions', 'students'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={tab === t ? 'btn-primary' : 'secondary'}
                    onClick={() => setTab(t)}
                  >
                    {t === 'history' ? 'History' : t === 'questions' ? `Pending questions (${pendingQuestions.length})` : `Pending students (${pendingUsers.length})`}
                  </button>
                ))}
              </div>
            </div>

            {tab === 'history' && (
              <div className="panel">
                <div className="panel-header"><h2>Moderation history</h2></div>
                <div className="panel-body no-pad">
                  {logs.length === 0 ? (
                    <div className="empty-state"><p>No log entries yet.</p></div>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>When</th>
                          <th>Actor</th>
                          <th>Entity</th>
                          <th>Action</th>
                          <th>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((l) => (
                          <tr key={l.id}>
                            <td>{new Date(l.createdAt).toLocaleString()}</td>
                            <td>{l.actor?.email || '—'}</td>
                            <td>{l.entityType} #{l.entityId}</td>
                            <td><span className="badge blue">{l.action}</span></td>
                            <td style={{ fontSize: 13, color: 'var(--gray-600)' }}>
                              {l.details ? JSON.stringify(l.details) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {tab === 'questions' && (
              <div className="panel">
                <div className="panel-header"><h2>Questions awaiting approval</h2></div>
                <div className="panel-body no-pad">
                  {pendingQuestions.length === 0 ? (
                    <div className="empty-state"><p>No pending questions.</p></div>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr><th>Title</th><th>Type</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {pendingQuestions.map((q) => (
                          <tr key={q.id}>
                            <td><strong>{q.title}</strong></td>
                            <td><span className="badge gray">{q.type}</span></td>
                            <td>
                              <div className="btn-group">
                                <button type="button" className="btn-sm btn-success" onClick={() => approveQ(q.id)}>Approve</button>
                                <button type="button" className="btn-sm btn-danger" onClick={() => rejectQ(q.id)}>Reject</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {tab === 'students' && (
              <div className="panel">
                <div className="panel-header"><h2>Students awaiting account approval</h2></div>
                <div className="panel-body no-pad">
                  {pendingUsers.length === 0 ? (
                    <div className="empty-state"><p>No pending registrations.</p></div>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr><th>Name</th><th>Email</th><th>Registered</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {pendingUsers.map((u) => (
                          <tr key={u.id}>
                            <td>{u.name || '—'}</td>
                            <td>{u.email}</td>
                            <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                            <td>
                              <div className="btn-group">
                                <button type="button" className="btn-sm btn-success" onClick={() => approveU(u.id)}>Approve</button>
                                <button type="button" className="btn-sm btn-danger" onClick={() => rejectU(u.id)}>Reject</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </DashboardLayout>
    </RequireAuth>
  );
}
