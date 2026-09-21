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
  
  // Draft score states per user
  const [theoryDraft, setTheoryDraft] = useState({});
  const [mcqDraft, setMcqDraft] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [savingAll, setSavingAll] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const isStaff = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([api.get(`/exams/${id}`), api.get(`/exams/${id}/scoreboard`)])
      .then(([e, s]) => {
        setExam(e.data);
        setScoreboard(s.data);
        const tDraft = {};
        const mDraft = {};
        s.data.rows.forEach((row) => {
          const tVal = row.assignment?.manualTheoryPercent ?? row.theoryPercent;
          tDraft[row.user.id] = tVal != null && !Number.isNaN(tVal) ? String(Math.round(tVal * 10) / 10) : '';

          const mVal = row.assignment?.manualMcqPercent ?? (e.data?.isManual ? row.mcqPercent : null);
          mDraft[row.user.id] = mVal != null && !Number.isNaN(mVal) ? String(Math.round(mVal * 10) / 10) : '';
        });
        setTheoryDraft(tDraft);
        setMcqDraft(mDraft);
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

  const saveStudentScores = async (userId) => {
    setSavingId(userId);
    setMsg('');
    try {
      const rawMcq = mcqDraft[userId];
      const rawTheory = theoryDraft[userId];

      const parseScore = (v) => {
        if (v === '' || v === undefined || v === null) return null;
        const num = parseFloat(v);
        if (Number.isNaN(num) || num < 0 || num > 100) throw new Error('Score must be between 0 and 100');
        return num;
      };

      const body = {
        manualMcqPercent: parseScore(rawMcq),
        manualTheoryPercent: parseScore(rawTheory),
      };

      await api.patch(`/exams/${id}/assignments/${userId}/manual-scores`, body);
      const s = await api.get(`/exams/${id}/scoreboard`);
      setScoreboard(s.data);
      setMsg('Scores saved successfully.');
    } catch (e) {
      setMsg(e.response?.data?.error || e.message || 'Save failed');
    }
    setSavingId(null);
  };

  const saveAllScores = async () => {
    if (!scoreboard || !scoreboard.rows || scoreboard.rows.length === 0) return;
    setSavingAll(true);
    setMsg('');
    try {
      const parseScore = (v) => {
        if (v === '' || v === undefined || v === null) return null;
        const num = parseFloat(v);
        if (Number.isNaN(num) || num < 0 || num > 100) return null;
        return num;
      };

      const scores = scoreboard.rows.map((row) => ({
        userId: row.user.id,
        manualMcqPercent: parseScore(mcqDraft[row.user.id]),
        manualTheoryPercent: parseScore(theoryDraft[row.user.id]),
      }));

      await api.patch(`/exams/${id}/assignments/batch-scores`, { scores });
      const s = await api.get(`/exams/${id}/scoreboard`);
      setScoreboard(s.data);
      setMsg('All student scores saved successfully.');
    } catch (e) {
      setMsg(e.response?.data?.error || 'Failed to save all scores');
    } finally {
      setSavingAll(false);
    }
  };

  const assignAllStudents = async () => {
    if (!window.confirm('Add all registered active candidates to this folder?')) return;
    setAssigning(true);
    try {
      await api.post(`/exams/${id}/assign-all-students`);
      load();
      setMsg('All active candidates added to this folder.');
    } catch (e) {
      setMsg(e.response?.data?.error || 'Failed to add candidates');
    } finally {
      setAssigning(false);
    }
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
    if (!window.confirm('Publish results for all candidates in this folder? They will see scores and receive notification emails.')) return;
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
    if (!window.confirm('Unpublish results for this folder? Students will no longer see scores until republished.')) return;
    setPublishing(true);
    setMsg('');
    try {
      const r = await api.post(`/exams/${id}/unpublish-results`);
      setExam(r.data);
      await load();
      setMsg('Results unpublished.');
    } catch (e) {
      setMsg(e.response?.data?.error || 'Unpublish failed');
    }
    setPublishing(false);
  };

  const exportCSV = () => {
    if (!scoreboard || !scoreboard.rows || scoreboard.rows.length === 0) return;

    const maxScale = exam?.maxScale || 100;
    const headers = ['Student Name', 'Matric Number', 'Email', 'MCQ Score (%)', 'Theory Score (%)', 'Final Raw (%)', `Scaled Score (out of ${maxScale}%)`, 'Status'];
    const csvLines = [headers.join(',')];

    scoreboard.rows.forEach((row) => {
      const line = [
        `"${row.user.name || ''}"`,
        `"${row.user.matricNumber || '—'}"`,
        `"${row.user.email || ''}"`,
        row.mcqPercent != null ? `${row.mcqPercent.toFixed(1)}%` : '—',
        row.theoryPercent != null ? `${row.theoryPercent.toFixed(1)}%` : '—',
        row.finalPercent != null ? `${row.finalPercent.toFixed(1)}%` : '—',
        row.scaledScore != null ? `${row.scaledScore.toFixed(1)} / ${maxScale}%` : '—',
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

  const updateFolderScale = async (newCategory, newMaxScale) => {
    try {
      const res = await api.patch(`/exams/${id}`, { category: newCategory, maxScale: parseFloat(newMaxScale) || 100 });
      setExam(res.data);
      load();
      setMsg(`Target Scale updated to ${res.data.maxScale}% (${res.data.category}).`);
    } catch {
      setMsg('Failed to update scale settings.');
    }
  };

  // Live score calculation preview helper
  const getLiveScores = (userId, row) => {
    const rawM = mcqDraft[userId];
    const rawT = theoryDraft[userId];

    const m = rawM !== '' && rawM !== undefined ? parseFloat(rawM) : (exam?.isManual ? null : row.mcqPercent);
    const t = rawT !== '' && rawT !== undefined ? parseFloat(rawT) : (exam?.isManual ? null : row.theoryPercent);

    if (m == null && t == null) {
      return { finalPercent: row.finalPercent, scaledScore: row.scaledScore };
    }

    let final = null;
    if (m != null && t != null) {
      final = (m + t) / 2;
    } else if (m != null) {
      final = m;
    } else if (t != null) {
      final = t;
    }

    const maxScale = exam?.maxScale || 100;
    const scaled = final != null ? Math.round(((final / 100) * maxScale) * 10) / 10 : null;
    return { finalPercent: final, scaledScore: scaled };
  };

  const isManualFolder = Boolean(exam?.isManual);

  return (
    <RequireAuth>
      <DashboardLayout>
        <div className="page-header flex-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0 }}>{exam ? `Grading / Publish: ${exam.title}` : 'Grading'}</h1>
              {isManualFolder && (
                <span className="badge blue" style={{ fontSize: '0.8rem', padding: '4px 10px', fontWeight: 700 }}>
                  📝 Manual Score Entry Folder
                </span>
              )}
            </div>
            <p style={{ marginTop: 8 }}>
              {isManualFolder
                ? `Enter candidate MCQ (%) and Theory (%) marks manually. The system averages them and scales to the folder target (${exam?.maxScale || 100}%).`
                : `Theory marks are optional 0–100. If set, they average with MCQ %. Target Scale / Max Score (e.g. 30% for Test or 70% for Exam) converts final raw % to the target folder percentage.`}
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
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              marginBottom: 16,
              background: msg.toLowerCase().includes('failed') || msg.toLowerCase().includes('error') ? '#fef2f2' : '#ecfdf5',
              color: msg.toLowerCase().includes('failed') || msg.toLowerCase().includes('error') ? '#b91c1c' : '#047857',
              border: `1px solid ${msg.toLowerCase().includes('failed') || msg.toLowerCase().includes('error') ? '#fca5a5' : '#a7f3d0'}`,
              fontWeight: 500,
            }}
          >
            {msg}
          </div>
        )}

        {loading ? (
          <p className="helper">Loading…</p>
        ) : (
          scoreboard && (
            <div className="panel">
              <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h2>Scoreboard ({scoreboard.rows.length} candidates)</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, color: '#4b5563', fontWeight: 600 }}>Folder Target Scale:</span>
                    <select
                      value={exam?.category || 'TEST'}
                      onChange={(e) => {
                        const cat = e.target.value;
                        const scale = cat === 'TEST' ? 30 : cat === 'EXAM' ? 70 : 100;
                        updateFolderScale(cat, scale);
                      }}
                      style={{ padding: '4px 8px', borderRadius: 6, fontSize: 13, border: '1px solid #cbd5e1' }}
                    >
                      <option value="TEST">Test (30% scale)</option>
                      <option value="EXAM">Exam (70% scale)</option>
                      <option value="GENERAL">General (100% scale)</option>
                    </select>
                    <span style={{ fontSize: 13, color: '#4b5563' }}>Max Score: <strong>{exam?.maxScale || 100}%</strong></span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn-sm btn-outline"
                    onClick={assignAllStudents}
                    disabled={assigning || exam?.resultsPublished}
                  >
                    {assigning ? 'Adding…' : '👥 Add All Active Students'}
                  </button>

                  <button
                    type="button"
                    className="btn-sm btn-primary"
                    style={{ background: '#027a48' }}
                    onClick={saveAllScores}
                    disabled={savingAll || exam?.resultsPublished}
                  >
                    {savingAll ? 'Saving…' : '💾 Save All Changes'}
                  </button>

                  <button type="button" className="btn-sm btn-outline" onClick={exportCSV}>
                    📥 Export to CSV
                  </button>
                </div>
              </div>

              <div className="panel-body no-pad" style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 160 }}>Candidate</th>
                      <th>Matric No.</th>
                      <th style={{ minWidth: 120 }}>{isManualFolder ? 'MCQ Score (%)' : 'MCQ %'}</th>
                      <th style={{ minWidth: 120 }}>Theory (0–100)</th>
                      <th>Raw %</th>
                      <th>Scaled ({exam?.maxScale || 100}%)</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scoreboard.rows.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '32px 16px', color: '#6b7280' }}>
                          No candidates assigned yet. Click <strong>"Add All Active Students"</strong> above to populate the scoreboard.
                        </td>
                      </tr>
                    ) : (
                      scoreboard.rows.map((row) => {
                        const { finalPercent, scaledScore } = getLiveScores(row.user.id, row);
                        const isReady = row.gradingComplete || (finalPercent != null);

                        return (
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

                            {/* MCQ Column */}
                            <td>
                              {isManualFolder ? (
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={0.5}
                                  style={{ width: 88, padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                                  value={mcqDraft[row.user.id] ?? ''}
                                  onChange={(e) =>
                                    setMcqDraft((d) => ({
                                      ...d,
                                      [row.user.id]: e.target.value,
                                    }))
                                  }
                                  disabled={exam?.resultsPublished}
                                  placeholder="0–100"
                                />
                              ) : (
                                <span>{row.mcqPercent != null ? `${row.mcqPercent.toFixed(0)}%` : '—'}</span>
                              )}
                            </td>

                            {/* Theory Column */}
                            <td>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                style={{ width: 88, padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
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
                            </td>

                            {/* Raw Final % */}
                            <td>
                              <span style={{ fontWeight: 600 }}>
                                {finalPercent != null ? `${finalPercent.toFixed(1)}%` : '—'}
                              </span>
                            </td>

                            {/* Scaled Score */}
                            <td>
                              <strong style={{ color: 'var(--primary, #4338ca)', fontSize: 15 }}>
                                {scaledScore != null ? `${scaledScore.toFixed(1)} / ${exam?.maxScale || 100}%` : '—'}
                              </strong>
                            </td>

                            {/* Status */}
                            <td>
                              <span className={`badge ${isReady ? 'green' : 'orange'}`}>
                                {isReady ? 'Ready to publish' : 'Pending scores'}
                              </span>
                            </td>

                            {/* Actions */}
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="btn-sm btn-outline"
                                disabled={savingId === row.user.id || exam?.resultsPublished}
                                onClick={() => saveStudentScores(row.user.id)}
                              >
                                {savingId === row.user.id ? 'Saving…' : 'Save'}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

                <div style={{ padding: '16px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                  <p className="helper" style={{ margin: 0 }}>
                    💡 <strong>Grading Rule:</strong> If both MCQ % and Theory % are entered, they are averaged equally (50% / 50%). If only one component is entered, that component forms 100% of the raw score. The Raw Final % is automatically scaled to the folder target ({exam?.maxScale || 100}%).
                  </p>
                </div>
              </div>
            </div>
          )
        )}
      </DashboardLayout>
    </RequireAuth>
  );
}
