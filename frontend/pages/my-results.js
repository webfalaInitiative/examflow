import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '../components/DashboardLayout';
import RequireAuth from '../components/RequireAuth';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

export default function MyResultsPage() {
  const { user } = useAuth();
  const [examResults, setExamResults] = useState([]);
  const [combinedResults, setCombinedResults] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [selectedCombined, setSelectedCombined] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      api.get('/exams/my-results'),
      api.get('/submissions'),
      api.get('/exams/combine-results/my-summary')
    ])
      .then(([resExams, resSubs, resComb]) => {
        setExamResults(resExams.data);
        setSubmissions(resSubs.data);
        setCombinedResults(resComb.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const examsTaken = examResults.filter(e => e.examSubmittedAt !== null).length;
  const publishedExams = examResults.filter(e => e.resultsPublished && e.finalPercent !== null);
  const avgScore = publishedExams.length > 0
    ? publishedExams.reduce((acc, e) => acc + e.finalPercent, 0) / publishedExams.length
    : null;
  const pendingRelease = examResults.filter(e => e.examSubmittedAt !== null && !e.resultsPublished).length;

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Passed':
        return 'green';
      case 'Failed':
        return 'red';
      case 'Results pending':
      case 'Pending':
        return 'orange';
      default:
        return 'gray';
    }
  };

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
              <div className="stat-label">Exams Taken</div>
              <div className="stat-value">{examsTaken}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue">📊</div>
            <div>
              <div className="stat-label">Average Score</div>
              <div className="stat-value">{avgScore !== null ? avgScore.toFixed(0) + '%' : '–'}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon orange">⏳</div>
            <div>
              <div className="stat-label">Pending Release</div>
              <div className="stat-value">{pendingRelease}</div>
            </div>
          </div>
        </div>

        {/* Details Modal */}
        {selectedExam && (
          <div className="modal-overlay" onClick={() => setSelectedExam(null)}>
            <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 800 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <h2 style={{ position: 'static', padding: 0, margin: 0 }}>{selectedExam.title}</h2>
                  <p style={{ color: 'var(--gray-500)', fontSize: 14, marginTop: 4 }}>
                    MCQ Score: <strong>{selectedExam.mcqPercent !== null ? selectedExam.mcqPercent.toFixed(0) + '%' : '—'}</strong> | 
                    Theory Score: <strong>{selectedExam.theoryPercent !== null ? selectedExam.theoryPercent.toFixed(0) + '%' : '—'}</strong> | 
                    Final Grade: <strong style={{ color: selectedExam.finalPercent >= 50 ? 'var(--success-700)' : 'var(--error-700)' }}>
                      {selectedExam.finalPercent !== null ? selectedExam.finalPercent.toFixed(1) + '%' : '—'}
                    </strong>
                  </p>
                </div>
                <button 
                  type="button" 
                  className="btn-sm btn-outline" 
                  onClick={() => setSelectedExam(null)}
                >
                  ✕ Close
                </button>
              </div>

              <div style={{ maxHeight: '450px', overflowY: 'auto', marginTop: 14 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Question</th>
                      <th>Type</th>
                      <th>Your Answer</th>
                      <th>Score</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions
                      .filter((s) => s.examId === selectedExam.examId)
                      .map((s) => (
                        <tr key={s.id}>
                          <td>
                            <strong>{s.question?.title || '—'}</strong>
                            {s.question?.body && (
                              <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: 4, whiteSpace: 'pre-wrap' }}>
                                {s.question.body}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${s.question?.type === 'mcq' ? 'blue' : 'gray'}`}>
                              {s.question?.type?.toUpperCase() || '—'}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontSize: '0.85rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {typeof s.answer === 'object'
                                ? JSON.stringify(s.answer)
                                : String(s.answer)}
                            </div>
                          </td>
                          <td>
                            {s.score !== null ? (s.score * 100).toFixed(0) + '%' : '—'}
                          </td>
                          <td>
                            <span className={`badge ${s.graded ? 'green' : 'orange'}`}>
                              {s.graded ? 'Graded' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    {submissions.filter((s) => s.examId === selectedExam.examId).length === 0 && (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: 20, color: 'var(--gray-400)' }}>
                          No submission details found for this folder.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Combined Assessment Transcript Modal */}
        {selectedCombined && (
          <div className="modal-overlay" onClick={() => setSelectedCombined(null)}>
            <div
              className="modal modal-lg printable-transcript"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 750, background: '#fff', borderRadius: 12, padding: 32 }}
            >
              <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => window.print()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  📥 Download / Print Official PDF Transcript
                </button>
                <button type="button" className="btn-outline" onClick={() => setSelectedCombined(null)}>
                  ✕ Close
                </button>
              </div>

              {/* Printable Header */}
              <div style={{ textAlign: 'center', borderBottom: '2px solid #6366f1', paddingBottom: 16, marginBottom: 24 }}>
                <h1 style={{ fontSize: 24, color: '#1e1b4b', margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Official Academic Result Transcript
                </h1>
                <p style={{ color: '#4b5563', margin: '4px 0 0', fontSize: 14 }}>{selectedCombined.title}</p>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>
                  Issued on {new Date(selectedCombined.publishedAt).toLocaleDateString()}
                </span>
              </div>

              {/* Student Details Card */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  background: '#f8fafc',
                  padding: 16,
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    width: 70,
                    height: 70,
                    borderRadius: '50%',
                    background: '#6366f1',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 28,
                    fontWeight: 'bold',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  {selectedCombined.student?.avatarUrl ? (
                    <img
                      src={selectedCombined.student.avatarUrl}
                      alt="Student Avatar"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    ((selectedCombined.student?.name || user?.email || 'S').charAt(0) || 'S').toUpperCase()
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                    {selectedCombined.student?.name || user?.name || user?.email}
                  </h3>
                  <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: 14 }}>{user?.email}</p>
                  <span style={{ fontSize: 12, background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: 4, marginTop: 4, display: 'inline-block' }}>
                    Student ID: #{user?.id}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Final Combined Score</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: selectedCombined.totalCombined >= 50 ? '#15803d' : '#b91c1c' }}>
                    {selectedCombined.totalCombined != null ? `${selectedCombined.totalCombined.toFixed(1)}%` : '—'}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#4338ca' }}>
                    Grade: {selectedCombined.gradeLetter} ({selectedCombined.status})
                  </div>
                </div>
              </div>

              {/* Assessment Breakdown Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 32 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 13, fontWeight: 600 }}>Assessment Folder</th>
                    <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: 13, fontWeight: 600 }}>Assigned Weight</th>
                    <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: 13, fontWeight: 600 }}>Score Achieved</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 13, fontWeight: 600 }}>Weighted Points</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedCombined.folderBreakdown.map((item) => (
                    <tr key={item.examId} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '12px', fontWeight: 600 }}>{item.examTitle}</td>
                      <td style={{ textAlign: 'center', padding: '12px' }}>{item.weight}%</td>
                      <td style={{ textAlign: 'center', padding: '12px' }}>
                        {item.scorePercent != null ? `${item.scorePercent.toFixed(1)}%` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', padding: '12px', fontWeight: 700 }}>
                        {item.weightedScore != null ? `+${item.weightedScore.toFixed(1)} pts` : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: '#faf5ff', fontWeight: 700, borderTop: '2px solid #c084fc' }}>
                    <td style={{ padding: '12px' }}>Total Combined Weight & Result</td>
                    <td style={{ textAlign: 'center', padding: '12px' }}>100%</td>
                    <td style={{ textAlign: 'center', padding: '12px' }}>—</td>
                    <td style={{ textAlign: 'right', padding: '12px', fontSize: 16, color: '#6b21a8' }}>
                      {selectedCombined.totalCombined != null ? `${selectedCombined.totalCombined.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Transcript Footer Signatures */}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 24, borderTop: '1px dashed #cbd5e1' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ height: 35, borderBottom: '1px solid #94a3b8', width: 160, margin: '0 auto' }} />
                  <span style={{ fontSize: 11, color: '#64748b', display: 'block', marginTop: 4 }}>Academic Director</span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ height: 35, borderBottom: '1px solid #94a3b8', width: 160, margin: '0 auto' }} />
                  <span style={{ fontSize: 11, color: '#64748b', display: 'block', marginTop: 4 }}>Superadmin Verification</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="panel" style={{ marginBottom: 32 }}>
          <div className="panel-header">
            <h2>📢 Published Combined Assessment Reports</h2>
          </div>
          <div className="panel-body no-pad">
            {combinedResults.length === 0 ? (
              <p className="helper" style={{ padding: 20 }}>No published combined reports available yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Report Title</th>
                    <th>Folders Combined</th>
                    <th>My Score</th>
                    <th>Grade</th>
                    <th>Status</th>
                    <th>Published Date</th>
                    <th>Transcript</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedResults.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.title}</strong>
                        {c.description && <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{c.description}</div>}
                      </td>
                      <td>
                        {c.folderBreakdown.map((f) => `${f.examTitle} (${f.weight}%)`).join(' + ')}
                      </td>
                      <td>
                        {c.totalCombined != null ? (
                          <strong style={{ color: c.totalCombined >= 50 ? 'var(--success-700)' : 'var(--error-700)' }}>
                            {c.totalCombined.toFixed(1)}%
                          </strong>
                        ) : '—'}
                      </td>
                      <td>
                        <span className="badge blue">{c.gradeLetter}</span>
                      </td>
                      <td>
                        <span className={`badge ${c.status === 'Passed' ? 'green' : c.status === 'Failed' ? 'red' : 'orange'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td>{new Date(c.publishedAt).toLocaleDateString()}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-sm btn-primary"
                          onClick={() => setSelectedCombined(c)}
                        >
                          📄 View / Download PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>All Exam Folders</h2>
          </div>
          <div className="panel-body no-pad">
            {loading ? (
              <p className="helper" style={{ padding: 20 }}>Loading results…</p>
            ) : examResults.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📁</div>
                <p>No exams assigned or submitted yet.</p>
                <Link href="/exams" className="small-link" style={{ marginTop: 12 }}>View Assigned Exams →</Link>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Folder / Exam</th>
                    <th>Questions</th>
                    <th>MCQ %</th>
                    <th>Theory %</th>
                    <th>Final Score</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {examResults.map((r) => {
                    const isPublished = r.resultsPublished && r.examSubmittedAt !== null;
                    return (
                      <tr key={r.examId}>
                        <td>
                          <strong>{r.title}</strong>
                          {r.description && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: 2 }}>
                              {r.description}
                            </div>
                          )}
                        </td>
                        <td>{r.nQuestions}</td>
                        <td>
                          {isPublished && r.mcqPercent !== null ? r.mcqPercent.toFixed(0) + '%' : '—'}
                        </td>
                        <td>
                          {isPublished && r.theoryPercent !== null ? r.theoryPercent.toFixed(0) + '%' : '—'}
                        </td>
                        <td>
                          {isPublished && r.finalPercent !== null ? (
                            <strong style={{ color: r.finalPercent >= 50 ? 'var(--success-700)' : 'var(--error-700)' }}>
                              {r.finalPercent.toFixed(1)}%
                            </strong>
                          ) : '—'}
                        </td>
                        <td>
                          <span className={`badge ${getStatusBadgeClass(r.status)}`}>
                            {r.status}
                          </span>
                        </td>
                        <td>
                          {r.examSubmittedAt ? new Date(r.examSubmittedAt).toLocaleDateString() : 'Not submitted'}
                        </td>
                        <td>
                          <button
                            className="btn-sm btn-outline"
                            onClick={() => setSelectedExam(r)}
                            disabled={!isPublished}
                            style={{ opacity: isPublished ? 1 : 0.5, cursor: isPublished ? 'pointer' : 'not-allowed' }}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </DashboardLayout>
    </RequireAuth>
  );
}
