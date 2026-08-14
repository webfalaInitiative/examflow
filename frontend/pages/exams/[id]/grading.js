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

  const [requesting, setRequesting] = useState(false);
  const isOwner = user?.role === 'OWNER';

  const requestPublish = async () => {
    if (!window.confirm('Request Superadmin (OWNER) to publish results for this exam? Superadmins will be notified.')) return;
    setRequesting(true);
    setMsg('');
    try {
      const r = await api.post(`/exams/${id}/request-publish`);
      setExam(r.data);
      await load();
      setMsg('Publish request sent to Superadmin successfully.');
    } catch (e) {
      setMsg(e.response?.data?.error || 'Request failed');
    }
    setRequesting(false);
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

  const exportCSV = () => {
    if (!scoreboard || !scoreboard.rows || scoreboard.rows.length === 0) return;

    const headers = ['Student Name', 'Matric Number', 'Email', 'MCQ Score (%)', 'Theory Score (%)', 'Final Score (%)', 'Status'];
    const csvLines = [headers.join(',')];

    scoreboard.rows.forEach((row) => {
      const line = [
        `"${row.user.name || ''}"`,
        `"${row.user.matricNumber || '—'}"`,
        `"${row.user.email || ''}"`,
        row.mcqPercent != null ? `${row.mcqPercent.toFixed(1)}%` : '—',
        row.theoryPercent != null ? `${row.theoryPercent.toFixed(1)}%` : '—',
        row.finalPercent != null ? `${row.finalPercent.toFixed(1)}%` : '—',
        `"${row.gradingComplete ? (row.finalPercent >= 40 ? 'Passed' : 'Failed') : 'Pending'}"`,
      ];
      csvLines.push(line.join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvLines.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    const safeTitle = (exam?.title || 'Exam').replace(/[^a-z0-9]/gi, '_');
    link.setAttribute('download', `${safeTitle}_Results_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <RequireAuth>
      <DashboardLayout>
        <div className="page-header flex-header">
          <div>
            <h1>{exam ? `Grading / Publish: ${exam.title}` : 'Grading'}</h1>
            <p>
              Theory marks are optional 0–100. If set, they average with MCQ %. Leave blank if unused. Or
              enter an external theory paper mark; it blends with MCQ as one extra weighted part. <strong>Final / 100</strong> updates here; superadmin publishes when ready.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Link href="/grading" className="btn-sm btn-outline">
              ← All Grading / Publish
            </Link>
            <Link href="/exams" className="btn-sm btn-outline">
              ← Exam folders
            </Link>
            {exam && !exam.resultsPublished && isOwner && (
              <button type="button" className="btn-primary" disabled={publishing} onClick={publish}>
                {publishing ? 'Publishing…' : exam.publishRequested ? '🔔 Publish results (Requested by Admin)' : 'Publish results & notify students'}
              </button>
            )}
            {exam && !exam.resultsPublished && !isOwner && (
              <>
                {exam.publishRequested ? (
                  <span className="badge orange">⏳ Publish Requested from Superadmin</span>
                ) : (
                  <button type="button" className="btn-primary" disabled={requesting} onClick={requestPublish}>
                    {requesting ? 'Sending Request…' : '📩 Request Superadmin to Publish'}
                  </button>
                )}
              </>
            )}
            {exam?.resultsPublished && isOwner && (
              <>
                <span className="badge green">Results published</span>
                <button type="button" className="btn-sm btn-danger" disabled={publishing} onClick={unpublish}>
                  {publishing ? 'Unpublishing…' : 'Unpublish results'}
                </button>
              </>
            )}
            {exam?.resultsPublished && !isOwner && (
              <span className="badge green">Results published</span>
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
              <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <h2>Scoreboard (per student)</h2>
                <button type="button" className="btn-sm btn-outline" onClick={exportCSV}>
                  📥 Export Exam Results to CSV
                </button>
              </div>
              <div className="panel-body no-pad">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Matric No.</th>
                      <th>MCQ %</th>
                      <th>Theory (0–100)</th>
                      <th>Final / 100</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scoreboard.rows.map((row) => (
                      <tr key={row.user.id}>
                        <td>
                          <strong>{row.user.name || row.user.email}</strong>
                          <br />
                          <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{row.user.email}</span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: 'var(--gray-700)' }}>
                            {row.user.matricNumber || '—'}
                          </span>
                        </td>
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
                  Final averages the two scores equally: MCQ % and theory % are both weighted as 100%. For exams with <strong>no theory questions</strong>,
                  an entered theory mark averages with MCQ. If an exam has no MCQ questions, final equals the theory score.
                </p>
              </div>
            </div>
          )
        )}
      </DashboardLayout>
    </RequireAuth>
  );
}
