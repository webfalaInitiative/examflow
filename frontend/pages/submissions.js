import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import RequireAuth from '../components/RequireAuth';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

export default function SubmissionsPage() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [gradeModal, setGradeModal] = useState(null);
  const [score, setScore] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadSubmissions();
  }, [user]);

  const loadSubmissions = () => {
    api.get('/submissions').then(r => setSubmissions(r.data)).catch(() => {});
  };

  const openGrade = (sub) => {
    setGradeModal(sub);
    setScore(sub.score != null ? (sub.score * 100).toString() : '');
  };

  const handleGrade = async (e) => {
    e.preventDefault();
    const scoreVal = parseFloat(score) / 100;
    if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 1) return;
    setSaving(true);
    try {
      await api.patch(`/submissions/${gradeModal.id}/grade`, { score: scoreVal });
      setGradeModal(null);
      loadSubmissions();
    } catch (err) {
      alert(err.response?.data?.error || 'Grading failed');
    }
    setSaving(false);
  };

  return (
    <RequireAuth>
    <DashboardLayout>
      <div className="page-header">
        <h1>Submissions</h1>
        <p>Review and grade student submissions</p>
      </div>

      {/* Grade Modal */}
      {gradeModal && (
        <div className="modal-overlay" onClick={() => setGradeModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Grade Submission</h2>
            <p style={{ color: 'var(--gray-500)', fontSize: 14, marginBottom: 8 }}>
              <strong>{gradeModal.user?.name}</strong> — {gradeModal.question?.title}
            </p>
            <div style={{ background: 'var(--gray-50)', padding: 14, borderRadius: 'var(--radius-sm)', marginBottom: 14, fontSize: 14 }}>
              <strong>Answer:</strong>
              <div style={{ marginTop: 6 }}>
                {typeof gradeModal.answer === 'object'
                  ? JSON.stringify(gradeModal.answer, null, 2)
                  : String(gradeModal.answer)}
              </div>
            </div>
            <form onSubmit={handleGrade}>
              <label>Score (0 – 100%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={score}
                onChange={e => setScore(e.target.value)}
                placeholder="Enter percentage"
              />
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setGradeModal(null)}>Cancel</button>
                <button type="submit" className="btn-success" disabled={saving}>{saving ? 'Saving…' : 'Save Grade'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-body no-pad">
          {submissions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <p>No submissions yet</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Question</th>
                  <th>Type</th>
                  <th>Score</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map(s => (
                  <tr key={s.id}>
                    <td>{s.user?.name || s.user?.email || '—'}</td>
                    <td>{s.question?.title || '—'}</td>
                    <td><span className={`badge ${s.question?.type === 'mcq' ? 'blue' : 'gray'}`}>{s.question?.type?.toUpperCase() || '—'}</span></td>
                    <td>{s.score != null ? (s.score * 100).toFixed(0) + '%' : '—'}</td>
                    <td><span className={`badge ${s.graded ? 'green' : 'orange'}`}>{s.graded ? 'Graded' : 'Pending'}</span></td>
                    <td>{new Date(s.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button className="btn-sm btn-outline" onClick={() => openGrade(s)}>
                        {s.graded ? 'Re-grade' : 'Grade'}
                      </button>
                    </td>
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
