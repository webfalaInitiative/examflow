import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
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
  const [theoryDraft, setTheoryDraft] = useState({});
  const [savingId, setSavingId] = useState(null);

  const isStaff = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([api.get(`/exams/${id}`), api.get(`/exams/${id}/scoreboard`)])
      .then(([e, s]) => {
        setExam(e.data);
        setScoreboard(s.data);
        const draft = {};
        s.data.rows.forEach((row) => {
          const v = row.assignment?.manualTheoryPercent;
          draft[row.user.id] = v != null && !Number.isNaN(v) ? String(Math.round(v * 10) / 10) : '';
        });
        setTheoryDraft(draft);
      })
      .catch(() => setMsg('Failed to load exam'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!router.isReady || !user || !isStaff || !id) return;
    load();
  }, [router.isReady, user, id, isStaff, load]);

  useEffect(() => {
    if (user && !isStaff) router.replace('/');
  }, [user, isStaff, router]);

  const saveTheory = async (userId) => {
    setSavingId(userId);
    setMsg('');
    try {
      const raw = theoryDraft[userId];
      const body =
        raw === '' || raw === undefined ? { manualTheoryPercent: null } : { manualTheoryPercent: parseFloat(raw) };
      if (body.manualTheoryPercent != null && (Number.isNaN(body.manualTheoryPercent) || body.manualTheoryPercent < 0 || body.manualTheoryPercent > 100)) {
        setMsg('Theory score must be between 0 and 100');
        setSavingId(null);
        return;
      }
      await api.patch(`/exams/${id}/assignments/${userId}/theory-score`, body);
      const s = await api.get(`/exams/${id}/scoreboard`);
      setScoreboard(s.data);
      setMsg('Theory score saved.');
    } catch (e) {
      setMsg(e.response?.data?.error || 'Save failed');
    }
    setSavingId(null);
  };

  const publish = async () => {
    if (!window.confirm('Publish results for all students in this exam? They will see scores and receive an email.')) return;
    setPublishing(true);
    setMsg('');
    try {
      const r = await api.post(`/exams/${id}/publish-results`);
      setExam(r.data);
      await load();
      setMsg('Results published. Students were emailed (if SMTP is configured).');
    } catch (e) {
      setMsg(e.response?.data?.error || 'Publish failed');
    }
    setPublishing(false);
  };

  const unpublish = async () => {
    if (!window.confirm('Unpublish results for this exam? Students will no longer see their scores or feedback.')) return;
    setPublishing(true);
    setMsg('');
    try {
      const r = await api.post(`/exams/${id}/unpublish-results`);
      setExam(r.data);
      await load();
      setMsg('Results unpublished. You can now make changes and publish again.');
    } catch (e) {
      setMsg(e.response?.data?.error || 'Unpublish failed');
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
            <p>
              Objective (MCQ) scores are graded automatically. Use <strong>Theory (0–100)</strong> for typed theory exams, or for <strong>MCQ-only</strong> exams to
              enter an external theory paper mark; it blends with MCQ as one extra weighted part. <strong>Final / 100</strong> updates here; publish when ready.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/submissions" className="btn-sm btn-outline">
              Open submissions list
            </Link>
            <Link href="/exams" className="btn-sm btn-outline">
              ← Exam folders
            </Link>
            {exam && !exam.resultsPublished && (
              <button type="button" className="btn-primary" disabled={publishing} onClick={publish}>
                {publishing ? 'Publishing…' : 'Publish results & notify students'}
              </button>
            )}
            {exam?.resultsPublished && (
              <>
                <span className="badge green">Results published</span>
                <button type="button" className="btn-sm btn-danger" disabled={publishing} onClick={unpublish}>
                  {publishing ? 'Unpublishing…' : 'Unpublish results'}
                </button>
              </>
            )}
          </div>
        </div>

        {msg && (
          <p
            className={
              msg === 'Theory score saved.' || msg.startsWith('Results published') || msg.startsWith('Results unpublished') ? 'helper' : 'error'
            }
            style={{ marginBottom: 12 }}
          >
            {msg}
          </p>
        )}

        {loading ? (
          <p className="helper">Loading…</p>
        ) : (
          scoreboard && (
            <div className="panel">
              <div className="panel-header">
                <h2>Scoreboard (per student)</h2>
              </div>
              <div className="panel-body no-pad">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>MCQ %</th>
                      <th>Theory (0–100)</th>
                      <th>Final / 100</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scoreboard.rows.map((row) => (
                      <tr key={row.user.id}>
                        <td>{row.user.name || row.user.email}</td>
                        <td>{row.mcqPercent != null ? row.mcqPercent.toFixed(0) + '%' : '—'}</td>
                        <td>
                          {row.nMcq > 0 || row.nTheory > 0 ? (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                style={{ width: 88, padding: '6px 8px' }}
                                value={theoryDraft[row.user.id] ?? ''}
                                onChange={(e) =>
                                  setTheoryDraft((d) => ({
                                    ...d,
                                    [row.user.id]: e.target.value,
                                  }))
                                }
                                disabled={exam?.resultsPublished}
                                placeholder="0–100"
                              />
                              <button
                                type="button"
                                className="btn-sm btn-outline"
                                disabled={savingId === row.user.id || exam?.resultsPublished}
                                onClick={() => saveTheory(row.user.id)}
                              >
                                {savingId === row.user.id ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          ) : (
                            <span className="helper">—</span>
                          )}
                        </td>
                        <td>
                          <strong>{row.finalPercent != null ? row.finalPercent.toFixed(1) : '—'}</strong>
                        </td>
                        <td>
                          <span className={`badge ${row.gradingComplete ? 'green' : 'orange'}`}>
                            {row.gradingComplete ? 'Ready to publish' : 'MCQ or theory incomplete'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="helper" style={{ padding: 12 }}>
                  Final uses question weights: (MCQ% × number of MCQs + theory% × theory parts) ÷ total parts. For exams with <strong>no theory questions</strong>,
                  a saved theory mark counts as <strong>one</strong> part alongside MCQs. Theory % uses your scoreboard input when set; otherwise averaged grades from
                  theory submissions.
                </p>
              </div>
            </div>
          )
        )}
      </DashboardLayout>
    </RequireAuth>
  );
}
