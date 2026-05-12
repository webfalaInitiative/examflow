import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../../../components/DashboardLayout';
import RequireAuth from '../../../components/RequireAuth';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../lib/api';

export default function ExamGradingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  const [exam, setExam] = useState(null);
  const [scoreboard, setScoreboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg] = useState('');

  const isStaff = user?.role === 'OWNER' || user?.role === 'ADMIN';

  useEffect(() => {
    if (!router.isReady || !user || !isStaff || !id) return;
    setLoading(true);
    Promise.all([api.get(`/exams/${id}`), api.get(`/exams/${id}/scoreboard`)])
      .then(([e, s]) => {
        setExam(e.data);
        setScoreboard(s.data);
      })
      .catch(() => setMsg('Failed to load exam'))
      .finally(() => setLoading(false));
  }, [router.isReady, user, id, isStaff]);

  useEffect(() => {
    if (user && !isStaff) router.replace('/');
  }, [user, isStaff, router]);

  const publish = async () => {
    if (!window.confirm('Publish results for all students in this exam? They will see scores and receive an email.')) return;
    setPublishing(true);
    setMsg('');
    try {
      const r = await api.post(`/exams/${id}/publish-results`);
      setExam(r.data);
      const s = await api.get(`/exams/${id}/scoreboard`);
      setScoreboard(s.data);
      setMsg('Results published. Students were emailed (if SMTP is configured).');
    } catch (e) {
      setMsg(e.response?.data?.error || 'Publish failed');
    }
    setPublishing(false);
  };

  if (!user || !isStaff) return null;

  return (
    <RequireAuth>
      <DashboardLayout>
        <div className="page-header">
          <div>
            <h1>Exam grading — {exam?.title || '…'}</h1>
            <p>Enter theory marks under Submissions. Combined score (objective + theory) out of 100% appears below when every question is graded.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href="/submissions" className="btn-sm btn-outline">Grade submissions</a>
            <a href="/exams" className="btn-sm btn-outline">← Exam folders</a>
            {exam && !exam.resultsPublished && (
              <button type="button" className="btn-primary" disabled={publishing} onClick={publish}>
                {publishing ? 'Publishing…' : 'Publish results & notify students'}
              </button>
            )}
            {exam?.resultsPublished && <span className="badge green">Results published</span>}
          </div>
        </div>

        {msg && <p className={msg.includes('Failed') ? 'error' : 'helper'} style={{ marginBottom: 12 }}>{msg}</p>}

        {loading ? (
          <p className="helper">Loading…</p>
        ) : scoreboard && (
          <div className="panel">
            <div className="panel-header"><h2>Scoreboard (per student)</h2></div>
            <div className="panel-body no-pad">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>MCQ %</th>
                    <th>Theory %</th>
                    <th>Final / 100</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {scoreboard.rows.map((row) => (
                    <tr key={row.user.id}>
                      <td>{row.user.name || row.user.email}</td>
                      <td>{row.mcqPercent != null ? row.mcqPercent.toFixed(0) + '%' : '—'}</td>
                      <td>{row.theoryPercent != null ? row.theoryPercent.toFixed(0) + '%' : '—'}</td>
                      <td>
                        <strong>{row.finalPercent != null ? row.finalPercent.toFixed(1) : '—'}</strong>
                      </td>
                      <td>
                        <span className={`badge ${row.gradingComplete ? 'green' : 'orange'}`}>
                          {row.gradingComplete ? 'Complete' : 'Pending theory / missing answers'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="helper" style={{ padding: 12 }}>
                Final = average of all question scores (each MCQ auto-graded; each theory manually graded 0–100% in Submissions).
                Students only see scores after you publish results.
              </p>
            </div>
          </div>
        )}
      </DashboardLayout>
    </RequireAuth>
  );
}
