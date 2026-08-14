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

  const downloadExamCSV = async (examId, examTitle) => {
    try {
      const res = await api.get(`/exams/${examId}/scoreboard`);
      const scoreboard = res.data;
      if (!scoreboard || !scoreboard.rows || scoreboard.rows.length === 0) {
        alert('No student results available for this exam folder yet.');
        return;
      }

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
            <p>Select an exam folder below to manage student grades, theory scores, and publish results.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/grading/combine" className="btn-primary" style={{ background: 'linear-gradient(135deg, #027a48, #12b76a)' }}>
              🔗 Combine / Merge Exam Results
            </Link>
            <Link href="/exams" className="btn-outline">
              📁 View All Folders
            </Link>
          </div>
        </div>

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
                <Link href="/exams" className="btn-primary" style={{ marginTop: 12 }}>
                  Create Exam Folder
                </Link>
              </div>
            ) : (
              exams.map((exam) => {
                const questionCount = exam._count?.questions ?? exam.questions?.length ?? 0;
                const assignedCount = (exam._count?.assignments ?? exam.assignments?.length) ?? 0;
                const isPublished = exam.resultsPublished;
                const isRequested = exam.publishRequested;

                return (
                  <div key={exam.id} className="exam-card panel">
                    <div className="exam-card-content">
                      <div className="exam-card-icon">📊</div>
                      <div className="exam-card-info">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <h3>{exam.title}</h3>
                          <span className={`badge ${isPublished ? 'green' : isRequested ? 'orange' : 'gray'}`} style={{ whiteSpace: 'nowrap' }}>
                            {isPublished ? 'Published' : isRequested ? '⏳ Publish Requested' : 'Draft'}
                          </span>
                        </div>
                        <p>{exam.description || 'No description provided'}</p>
                        <div className="exam-stats" style={{ marginTop: 12 }}>
                          <span>{questionCount} Questions</span>
                          {exam.duration && <span>• {exam.duration} Min</span>}
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
                        Grading / publish →
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
      </DashboardLayout>
    </RequireAuth>
  );
}
