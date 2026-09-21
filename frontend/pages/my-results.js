import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '../components/DashboardLayout';
import RequireAuth from '../components/RequireAuth';
import StatementOfResult, { getStatementGrade } from '../components/StatementOfResult';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

export default function MyResultsPage() {
  const { user } = useAuth();
  const [examResults, setExamResults] = useState([]);
  const [combinedResults, setCombinedResults] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [selectedCombined, setSelectedCombined] = useState(null);
  const [showFullStatement, setShowFullStatement] = useState(false);
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

  // Group results into Subject Academic Breakdown (Test, Exam, Final, Grade)
  const getSubjectBreakdown = () => {
    if (examResults.length === 0) return [];
    const subjectMap = new Map();

    examResults.forEach((r) => {
      const rawTitle = r.subject || r.title || 'General Course';
      const subjectName = rawTitle.replace(/\s*-\s*(Test|Exam|Midterm|Final).*/i, '').trim() || rawTitle;
      if (!subjectMap.has(subjectName)) {
        subjectMap.set(subjectName, {
          subject: subjectName,
          testItem: null,
          examItem: null,
          combinedItem: null,
        });
      }

      const group = subjectMap.get(subjectName);
      const isTest = r.category === 'TEST' || (r.maxScale && r.maxScale <= 50) || r.title.toLowerCase().includes('test');
      if (isTest) {
        group.testItem = r;
      } else {
        group.examItem = r;
      }
    });

    // Match combined reports
    combinedResults.forEach((c) => {
      const title = (c.title || '').replace(/Combined Assessment Report|Report|Combined/gi, '').trim();
      for (const [key, group] of subjectMap.entries()) {
        if (title && (title.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(title.toLowerCase()))) {
          group.combinedItem = c;
        }
      }
    });

    return Array.from(subjectMap.values()).map((group) => {
      const testPub = group.testItem && group.testItem.resultsPublished && group.testItem.scaledScore != null;
      const examPub = group.examItem && group.examItem.resultsPublished && group.examItem.scaledScore != null;

      const testVal = testPub ? `${group.testItem.scaledScore.toFixed(1)}` : '—';
      const examVal = examPub ? `${group.examItem.scaledScore.toFixed(1)}` : '—';

      let finalVal = '—';
      let gradeVal = '—';

      if (group.combinedItem && group.combinedItem.totalCombined != null) {
        finalVal = `${group.combinedItem.totalCombined.toFixed(1)}%`;
        gradeVal = group.combinedItem.gradeLetter || '—';
      } else if (testPub && examPub) {
        const total = (group.testItem.scaledScore || 0) + (group.examItem.scaledScore || 0);
        finalVal = `${total.toFixed(1)}%`;
        gradeVal = getStatementGrade(total);
      }

      return {
        subject: group.subject,
        testVal,
        examVal,
        finalVal,
        gradeVal,
        isFullyPublished: (testPub && examPub) || Boolean(group.combinedItem),
      };
    });
  };

  const subjectRows = getSubjectBreakdown();

  // Prepare full program skill sets from completed subject rows
  const fullProgramSkillSets = subjectRows
    .filter((r) => r.finalVal !== '—')
    .map((r) => {
      const numScore = parseFloat(r.finalVal) || 0;
      return {
        name: r.subject,
        score: numScore,
        grade: getStatementGrade(numScore),
      };
    });

  return (
    <RequireAuth>
      <DashboardLayout>
        <div className="page-header flex-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1>My Results 📈</h1>
            <p>Track your academic test and exam performance & download official transcripts</p>
          </div>
          {fullProgramSkillSets.length > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowFullStatement(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: '#0f172a',
                borderColor: '#0f172a',
                color: '#fff',
                padding: '10px 18px',
                fontWeight: 700,
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(15,23,42,0.15)',
              }}
            >
              🎓 View Official Statement of Result
            </button>
          )}
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
            <div className="stat-icon orange">⏳</div>
            <div>
              <div className="stat-label">Pending Release</div>
              <div className="stat-value">{pendingRelease}</div>
            </div>
          </div>
        </div>

        {/* Structured Subject Breakdown Table (Test, Exam, Final, Grade) */}
        <div className="panel" style={{ marginBottom: 32 }}>
          <div className="panel-header" style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <h2 style={{ color: '#fff', margin: 0 }}>📊 Subject Academic Performance Breakdown</h2>
            {fullProgramSkillSets.length > 0 && (
              <button
                type="button"
                className="btn-sm"
                onClick={() => setShowFullStatement(true)}
                style={{ background: '#ffffff', color: '#1e1b4b', fontWeight: 700, border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}
              >
                📄 Generate Statement of Result
              </button>
            )}
          </div>
          <div className="panel-body no-pad">
            {loading ? (
              <p className="helper" style={{ padding: 20 }}>Loading subject performance…</p>
            ) : subjectRows.length === 0 ? (
              <p className="helper" style={{ padding: 20 }}>No subject results published yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th>Subject / Course</th>
                    <th>Test</th>
                    <th>Exam</th>
                    <th>Final</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectRows.map((row, idx) => (
                    <tr key={idx}>
                      <td>
                        <strong>{row.subject}</strong>
                      </td>
                      <td>
                        <span style={{ fontWeight: row.testVal !== '—' ? 700 : 400, color: row.testVal !== '—' ? '#0284c7' : '#9ca3af' }}>
                          {row.testVal}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: row.examVal !== '—' ? 700 : 400, color: row.examVal !== '—' ? '#4f46e5' : '#9ca3af' }}>
                          {row.examVal}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: row.finalVal !== '—' ? 800 : 400, fontSize: row.finalVal !== '—' ? 16 : 14, color: row.finalVal !== '—' ? '#15803d' : '#9ca3af' }}>
                          {row.finalVal}
                        </span>
                      </td>
                      <td>
                        {row.gradeVal !== '—' ? (
                          <span className="badge blue" style={{ fontWeight: 700, fontSize: 13 }}>
                            {row.gradeVal}
                          </span>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Details Modal for single exam */}
        {selectedExam && (
          <div className="modal-overlay" onClick={() => setSelectedExam(null)}>
            <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 800 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <h2 style={{ position: 'static', padding: 0, margin: 0 }}>{selectedExam.title}</h2>
                  <p style={{ color: 'var(--gray-600)', fontSize: 15, marginTop: 4, fontWeight: 600 }}>
                    Score:{' '}
                    <span style={{ color: '#4338ca', fontSize: 16, fontWeight: 800 }}>
                      {selectedExam.scaledScore != null ? selectedExam.scaledScore.toFixed(1) : selectedExam.finalPercent != null ? selectedExam.finalPercent.toFixed(1) : '—'}
                    </span>
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
                      <th>Mark</th>
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
                            {s.score !== null ? (s.score > 0 ? '1 pt' : '0 pt') : '—'}
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

        {/* Selected Published Combined Assessment - Official Statement of Result Modal */}
        {selectedCombined && (
          <div className="modal-overlay" onClick={() => setSelectedCombined(null)}>
            <div
              className="modal modal-lg printable-modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 860, background: '#ffffff', borderRadius: 12, padding: '24px 20px', maxHeight: '95vh', overflowY: 'auto' }}
            >
              <StatementOfResult
                student={selectedCombined.student || user}
                programName={selectedCombined.title || 'Women in AI Fellowship 2025'}
                skillSets={selectedCombined.folderBreakdown.map((item) => ({
                  name: item.examTitle,
                  score: item.scorePercent,
                  grade: getStatementGrade(item.scorePercent),
                }))}
                cumulativeAverage={selectedCombined.totalCombined}
                overallGrade={selectedCombined.totalCombined != null ? getStatementGrade(selectedCombined.totalCombined) : null}
                issueDate={selectedCombined.issueDate || '9th September, 2025'}
                directorName={selectedCombined.directorName || 'Bakare Nafisat Opeyemi'}
                onClose={() => setSelectedCombined(null)}
              />
            </div>
          </div>
        )}

        {/* Full Program Statement of Result Modal */}
        {showFullStatement && (
          <div className="modal-overlay" onClick={() => setShowFullStatement(false)}>
            <div
              className="modal modal-lg printable-modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 860, background: '#ffffff', borderRadius: 12, padding: '24px 20px', maxHeight: '95vh', overflowY: 'auto' }}
            >
              <StatementOfResult
                student={user}
                programName="Women in AI Fellowship 2025"
                skillSets={fullProgramSkillSets}
                onClose={() => setShowFullStatement(false)}
              />
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
                    <th>Statement of Result</th>
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
                          <strong style={{ color: c.totalCombined >= 40 ? 'var(--success-700)' : 'var(--error-700)' }}>
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
                          📄 Statement of Result (PDF)
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
                    <th>Score</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {examResults.map((r) => {
                    const isPublished = r.resultsPublished && r.examSubmittedAt !== null;
                    const displayScore = r.scaledScore != null ? r.scaledScore.toFixed(1) : (r.finalPercent != null ? r.finalPercent.toFixed(1) : '—');
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
                          {isPublished && displayScore !== '—' ? (
                            <strong style={{ color: '#4338ca', fontSize: 15 }}>
                              {displayScore}
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
