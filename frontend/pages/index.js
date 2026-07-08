import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import RequireAuth from '../components/RequireAuth';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

export default function Dashboard() {
  return (
    <RequireAuth>
      <DashboardHome />
    </RequireAuth>
  );
}

function DashboardHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    const isAdmin = user.role === 'OWNER' || user.role === 'ADMIN';

    if (isAdmin) {
      api.get('/submissions/stats').then(r => setStats(r.data)).catch(() => {});
      api.get('/submissions').then(r => setRecentSubmissions(r.data.slice(0, 5))).catch(() => {});
    } else {
      api.get('/submissions').then(r => setRecentSubmissions(r.data)).catch(() => {});
      api.get('/questions').then(r => setQuestions(r.data)).catch(() => {});
    }
  }, [user]);

  const isAdmin = user.role === 'OWNER' || user.role === 'ADMIN';

  return (
    <DashboardLayout>
      <div className="page-header">
        <h1>Welcome back, {user.name || 'User'} 👋</h1>
        <p>{isAdmin ? 'Here\'s an overview of your exam platform.' : 'Ready to take your next assessment?'}</p>
      </div>

      {isAdmin ? <AdminDashboard stats={stats} recentSubmissions={recentSubmissions} /> : <StudentDashboard user={user} submissions={recentSubmissions} questions={questions} />}
    </DashboardLayout>
  );
}

function AdminDashboard({ stats, recentSubmissions }) {
  return (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">👥</div>
          <div>
            <div className="stat-label">Total Users</div>
            <div className="stat-value">{stats?.totalUsers ?? '–'}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">📝</div>
          <div>
            <div className="stat-label">Questions</div>
            <div className="stat-value">{stats?.totalQuestions ?? '–'}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange">📋</div>
          <div>
            <div className="stat-label">Submissions</div>
            <div className="stat-value">{stats?.totalSubmissions ?? '–'}</div>
            <div className="stat-sub">{stats?.gradedSubmissions ?? 0} graded</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red">📈</div>
          <div>
            <div className="stat-label">Avg Score</div>
            <div className="stat-value">{stats?.averageScore != null ? (stats.averageScore * 100).toFixed(0) + '%' : '–'}</div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>Recent Submissions</h2>
          <a href="/submissions" className="small-link">View all →</a>
        </div>
        <div className="panel-body no-pad">
          {recentSubmissions.length === 0 ? (
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
                  <th>Score</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentSubmissions.map(s => (
                  <tr key={s.id}>
                    <td>{s.user?.name || s.user?.email || '—'}</td>
                    <td>{s.question?.title || '—'}</td>
                    <td>{s.score != null ? (s.score * 100).toFixed(0) + '%' : '—'}</td>
                    <td>
                      <span className={`badge ${s.graded ? 'green' : 'orange'}`}>
                        {s.graded ? 'Graded' : 'Pending'}
                      </span>
                    </td>
                    <td>{new Date(s.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

function StudentDashboard({ user, submissions, questions }) {
  const [assignedExams, setAssignedExams] = useState([]);
  
  useEffect(() => {
    api.get('/exams').then(r => setAssignedExams(r.data)).catch(() => {});
  }, []);

  const answeredIds = new Set(submissions.map(s => s.questionId));
  const unanswered = questions.filter(q => !answeredIds.has(q.id));
  const totalScore = submissions.filter(s => s.graded && s.score != null);
  const avgScore = totalScore.length > 0
    ? totalScore.reduce((acc, s) => acc + s.score, 0) / totalScore.length
    : null;

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">📁</div>
          <div>
            <div className="stat-label">Assigned Exams</div>
            <div className="stat-value">{assignedExams.length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">✅</div>
          <div>
            <div className="stat-label">Completed Tasks</div>
            <div className="stat-value">{submissions.length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange">📈</div>
          <div>
            <div className="stat-label">Avg Score</div>
            <div className="stat-value">{avgScore != null ? (avgScore * 100).toFixed(0) + '%' : '–'}</div>
          </div>
        </div>
      </div>

      {assignedExams.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <h2>Your Exam Folders</h2>
            <a href="/exams" className="small-link">View all →</a>
          </div>
          <div className="panel-body no-pad">
            <table className="data-table">
              <thead>
                <tr><th>Exam Folder</th><th>Questions</th><th>Action</th></tr>
              </thead>
              <tbody>
                {assignedExams.slice(0, 5).map(exam => (
                  <tr key={exam.id}>
                    <td><strong>{exam.title}</strong></td>
                    <td>{exam._count?.questions ?? 0}</td>
                    <td>
                      <a href={`/exam?examId=${exam.id}`} className="btn-sm btn-primary">Start</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
