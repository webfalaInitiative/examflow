import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '../components/DashboardLayout';
import RequireAuth from '../components/RequireAuth';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

export default function MyResultsPage() {
  const { user } = useAuth();
  const [examResults, setExamResults] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      api.get('/exams/my-results'),
      api.get('/submissions')
    ])
      .then(([resExams, resSubs]) => {
        setExamResults(resExams.data);
        setSubmissions(resSubs.data);
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
