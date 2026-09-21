import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '../components/DashboardLayout';
import RequireAuth from '../components/RequireAuth';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

export default function GradingPublishOverviewPage() {
  const { user } = useAuth();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Manual folder creation modal state
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    title: '',
    subject: '',
    category: 'TEST',
    maxScale: 30,
    description: '',
    autoAssignAll: true,
  });
  const [savingManual, setSavingManual] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!user) return;
    loadExams();
  }, [user]);

  const loadExams = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/exams');
      setExams(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load exam folders');
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const handleCreateManualFolder = async (e) => {
    e.preventDefault();
    if (!manualForm.title.trim()) {
      setFormError('Folder Title is required');
      return;
    }

    setSavingManual(true);
    setFormError('');
    try {
      const payload = {
        title: manualForm.title.trim(),
        subject: manualForm.subject.trim() || null,
        category: manualForm.category,
        maxScale: parseFloat(manualForm.maxScale) || 100,
        description: manualForm.description.trim() || null,
        isManual: true,
        autoAssignAll: manualForm.autoAssignAll,
      };

      await api.post('/exams', payload);
      setShowManualModal(false);
      setManualForm({
        title: '',
        subject: '',
        category: 'TEST',
        maxScale: 30,
        description: '',
        autoAssignAll: true,
      });
      setSuccessMsg(`Manual score entry folder "${payload.title}" created successfully!`);
      setTimeout(() => setSuccessMsg(''), 6000);
      loadExams();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to create manual exam folder');
    } finally {
      setSavingManual(false);
    }
  };

  const downloadExamCSV = async (examId, examTitle) => {
    try {
      const res = await api.get(`/exams/${examId}/scoreboard`);
      const scoreboard = res.data;
      if (!scoreboard || !scoreboard.rows || scoreboard.rows.length === 0) {
        alert('No student results available for this exam folder yet.');
        return;
      }

      const maxScale = scoreboard.exam?.maxScale || scoreboard.maxScale || 100;
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
      const safeTitle = (examTitle || 'Exam').replace(/[^a-z0-9]/gi, '_');
      link.setAttribute('download', `${safeTitle}_Results_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert('Failed to download exam CSV');
    }
  };

  return (
    <RequireAuth>
      <DashboardLayout>
        <div className="page-header flex-header">
          <div>
            <h1>Grading / Publish</h1>
            <p>Manage student grades, manual MCQ & theory scores, publish results, and merge multi-folder assessments.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {isAdmin && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => { setFormError(''); setShowManualModal(true); }}
                style={{
                  background: 'linear-gradient(135deg, #4338ca, #6366f1)',
                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>➕</span> Create Manual Score Folder
              </button>
            )}
            <Link href="/grading/combine" className="btn-primary" style={{ background: 'linear-gradient(135deg, #027a48, #12b76a)' }}>
              🔗 Combine / Merge Exam Results
            </Link>
            <Link href="/exams" className="btn-outline">
              📁 View All Folders
            </Link>
          </div>
        </div>

        {successMsg && (
          <div style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontWeight: 500 }}>
            {successMsg}
          </div>
        )}

        {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}

        {loading ? (
          <div className="loading-screen" style={{ minHeight: '300px' }}>
            <div className="loading-spinner" />
            <p>Loading exam folders…</p>
          </div>
        ) : (
          <div className="exams-grid">
            {exams.length === 0 ? (
              <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                <div className="empty-icon">📁</div>
                <p>No exam folders found</p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 12 }}>
                  <button type="button" className="btn-primary" onClick={() => setShowManualModal(true)}>
                    + Create Manual Entry Folder
                  </button>
                  <Link href="/exams" className="btn-outline">
                    Create Online Exam
                  </Link>
                </div>
              </div>
            ) : (
              exams.map((exam) => {
                const isManual = Boolean(exam.isManual);
                const questionCount = exam._count?.questions ?? exam.questions?.length ?? 0;
                const assignedCount = (exam._count?.assignments ?? exam.assignments?.length) ?? 0;
                const isPublished = exam.resultsPublished;
                const isRequested = exam.publishRequested;

                return (
                  <div key={exam.id} className="exam-card panel">
                    <div className="exam-card-content">
                      <div className="exam-card-icon">{isManual ? '📝' : '📊'}</div>
                      <div className="exam-card-info">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                          <h3 style={{ margin: 0 }}>{exam.title}</h3>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {isManual && (
                              <span className="badge blue" style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px' }}>
                                📝 Manual Entry
                              </span>
                            )}
                            <span className={`badge ${isPublished ? 'green' : isRequested ? 'orange' : 'gray'}`} style={{ whiteSpace: 'nowrap' }}>
                              {isPublished ? 'Published' : isRequested ? '⏳ Publish Requested' : 'Draft'}
                            </span>
                          </div>
                        </div>

                        {exam.subject && (
                          <div style={{ fontSize: 13, color: '#4f46e5', fontWeight: 600, marginTop: 4 }}>
                            Course: {exam.subject}
                          </div>
                        )}

                        <p style={{ marginTop: 6, color: '#6b7280', fontSize: 14 }}>{exam.description || 'No description provided'}</p>

                        <div className="exam-stats" style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {isManual ? (
                            <span style={{ fontWeight: 600, color: '#047857' }}>
                              🎯 Target Scale: {exam.maxScale || 100}% ({exam.category || 'TEST'})
                            </span>
                          ) : (
                            <>
                              <span>{questionCount} Questions</span>
                              {exam.duration && <span>• {exam.duration} Min</span>}
                              <span>• Target Scale: {exam.maxScale || 100}%</span>
                            </>
                          )}
                          {isAdmin && <span>• {assignedCount} Assigned Students</span>}
                        </div>
                      </div>
                    </div>

                    <div className="exam-card-footer" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingTop: 12 }}>
                      <Link
                        href={`/exams/${exam.id}/grading`}
                        className="btn-primary"
                        style={{
                          background: 'linear-gradient(135deg, #1d55ea, #3373f5)',
                          color: '#ffffff',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          fontWeight: 600,
                          fontSize: '13px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 6px rgba(29, 85, 234, 0.25)',
                        }}
                      >
                        {isManual ? 'Input Scores / Publish →' : 'Grading / publish →'}
                      </Link>
                      <button
                        type="button"
                        className="btn-sm btn-outline"
                        onClick={() => downloadExamCSV(exam.id, exam.title)}
                        style={{ fontSize: 12, padding: '6px 10px' }}
                      >
                        📥 Export CSV
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Create Manual Entry Folder Modal */}
        {showManualModal && (
          <div className="modal-overlay" onClick={() => setShowManualModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 20 }}>📝 Create Manual Score Entry Folder</h2>
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}
                >
                  ✕
                </button>
              </div>

              <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
                Create an exam folder where instructors manually enter both <strong>MCQ and Theory scores (0–100%)</strong> for candidates (e.g. offline tests, paper exams, or practicals). This folder can be published and merged into combined assessment reports.
              </p>

              <form onSubmit={handleCreateManualFolder}>
                <div className="form-row">
                  <label>Folder Title *</label>
                  <input
                    type="text"
                    required
                    value={manualForm.title}
                    onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
                    placeholder="e.g. First Term Mathematics Test (Paper)"
                  />
                </div>

                <div className="form-row">
                  <label>Subject / Course Name (Optional)</label>
                  <input
                    type="text"
                    value={manualForm.subject}
                    onChange={(e) => setManualForm({ ...manualForm, subject: e.target.value })}
                    placeholder="e.g. Mathematics or English Language"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-row">
                    <label>Folder Type</label>
                    <select
                      value={manualForm.category}
                      onChange={(e) => {
                        const cat = e.target.value;
                        const scale = cat === 'TEST' ? 30 : cat === 'EXAM' ? 70 : 100;
                        setManualForm({ ...manualForm, category: cat, maxScale: scale });
                      }}
                      style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #d1d5db' }}
                    >
                      <option value="TEST">Test (30% scale)</option>
                      <option value="EXAM">Exam (70% scale)</option>
                      <option value="GENERAL">General Assessment (100%)</option>
                    </select>
                  </div>
                  <div className="form-row">
                    <label>Target Scale / Max Score (%)</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={manualForm.maxScale}
                      onChange={(e) => setManualForm({ ...manualForm, maxScale: parseFloat(e.target.value) || 100 })}
                      placeholder="e.g. 30, 70, 100"
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <label>Description (Optional)</label>
                  <textarea
                    rows={2}
                    value={manualForm.description}
                    onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                    placeholder="e.g. In-person assessment conducted on October 15"
                  />
                </div>

                <div className="form-row" style={{ marginTop: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 500 }}>
                    <input
                      type="checkbox"
                      checked={manualForm.autoAssignAll}
                      onChange={(e) => setManualForm({ ...manualForm, autoAssignAll: e.target.checked })}
                      style={{ width: 18, height: 18 }}
                    />
                    <span>Automatically populate all active candidates to this folder</span>
                  </label>
                  <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 26, display: 'block' }}>
                    All active students will immediately appear on the scoreboard so you can input their scores directly.
                  </span>
                </div>

                {formError && <p className="error" style={{ marginTop: 12 }}>{formError}</p>}

                <div className="modal-actions" style={{ marginTop: 24 }}>
                  <button type="button" className="secondary" onClick={() => setShowManualModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" disabled={savingManual} className="btn-primary">
                    {savingManual ? 'Creating Folder…' : 'Create Manual Entry Folder'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </DashboardLayout>
    </RequireAuth>
  );
}
