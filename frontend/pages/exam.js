import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../components/DashboardLayout';
import RequireAuth from '../components/RequireAuth';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

export default function ExamPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { examId } = router.query;
  
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState({});
  const [results, setResults] = useState({});
  const [error, setError] = useState('');
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState(null);
  const [isTimeUp, setIsTimeUp] = useState(false);

  useEffect(() => {
    if (!user || !router.isReady) return;

    const fetchData = async () => {
      try {
        let qData = [];
        let examData = null;
        if (examId) {
          const res = await api.get(`/exams/${examId}`);
          examData = res.data;
          setExam(examData);
          qData = res.data.questions.map(eq => eq.question);
        } else {
          const res = await api.get('/questions');
          qData = res.data;
        }
        
        const sRes = await api.get('/submissions');
        
        setQuestions(qData);
        // Filter submissions for this specific exam if examId exists
        const relevantSubmissions = examId 
          ? sRes.data.filter(s => s.examId === parseInt(examId)) 
          : sRes.data.filter(s => s.examId === null);
          
        setSubmissions(relevantSubmissions);

        // Initialize Timer logic
        if (examData && examData.duration) {
          const storageKey = `exam_start_${user.id}_${examId}`;
          let startTime = localStorage.getItem(storageKey);
          
          if (!startTime) {
            startTime = Date.now().toString();
            localStorage.setItem(storageKey, startTime);
          }

          const durationMs = examData.duration * 60 * 1000;
          const elapsed = Date.now() - parseInt(startTime);
          const remaining = Math.max(0, durationMs - elapsed);
          
          setTimeLeft(Math.floor(remaining / 1000));
          if (remaining <= 0) setIsTimeUp(true);
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load exam');
      }
    };

    fetchData();
  }, [user, examId, router.isReady]);

  // Timer Effect
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || isTimeUp) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsTimeUp(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isTimeUp]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const answeredIds = new Set(submissions.map(s => s.questionId));
  const available = questions.filter(q => !answeredIds.has(q.id));

  const submitAnswer = async (questionId) => {
    if (isTimeUp) return;
    const answer = answers[questionId];
    if (answer === undefined || answer === '') return;

    setSubmitting(prev => ({ ...prev, [questionId]: true }));
    try {
      const res = await api.post('/submissions', { 
        questionId, 
        answer, 
        examId: examId ? parseInt(examId) : null 
      });
      setResults(prev => ({ ...prev, [questionId]: res.data }));
      setSubmissions(prev => [...prev, res.data]);
    } catch (err) {
      alert(err.response?.data?.error || 'Submission failed');
    }
    setSubmitting(prev => ({ ...prev, [questionId]: false }));
  };

  return (
    <RequireAuth>
    <DashboardLayout>
      {/* Timer Display */}
      {timeLeft !== null && (
        <div className={`countdown-bar ${timeLeft < 60 ? 'urgent' : ''}`}>
          <div className="countdown-info">
            <span className="timer-icon">⏱️</span>
            <span className="timer-label">Time Remaining:</span>
            <span className="timer-value">{formatTime(timeLeft)}</span>
          </div>
        </div>
      )}

      <div className="page-header">
        <h1>{exam ? exam.title : 'Take Exam ✏️'}</h1>
        {exam && exam.resultsPublished === false && (
          <p className="helper" style={{ marginBottom: 8, padding: '8px 12px', background: 'var(--warning-50)', borderRadius: 'var(--radius-sm)' }}>
            Detailed scores for this folder stay hidden until an instructor publishes results. You will be emailed when they are ready.
          </p>
        )}
        <p>{exam ? (exam.description || 'No description') : `${available.length} question${available.length !== 1 ? 's' : ''} available`}</p>
        <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
          {exam && <span className="stat-pill">📋 {available.length} questions left</span>}
          {exam && exam.duration && <span className="stat-pill">⏳ {exam.duration} mins total</span>}
        </div>
      </div>

      {isTimeUp && (
        <div className="time-up-overlay">
          <div className="time-up-card">
            <h2>⏰ Time is Up!</h2>
            <p>You can no longer submit answers for this exam. Any submissions already made have been saved.</p>
            <a href="/my-results" className="btn-primary">View My Results</a>
          </div>
        </div>
      )}

      {available.length === 0 && !isTimeUp && Object.keys(results).length === 0 && (
        <div className="panel">
          <div className="panel-body">
            <div className="empty-state">
              <div className="empty-icon">🎉</div>
              <p>You've completed all available questions! Check your results.</p>
              <a href="/my-results" className="small-link" style={{ marginTop: 12 }}>View Results →</a>
            </div>
          </div>
        </div>
      )}

      <div className={`exam-container ${isTimeUp ? 'locked' : ''}`}>
        {available.map((q, index) => {
          const result = results[q.id];
          const isDone = !!result;
          const opts = q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : [];

          return (
            <div key={q.id} className="exam-card" style={{ animationDelay: `${index * 0.05}s` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                <h3 style={{ margin: 0 }}>{q.title}</h3>
                <span className={`badge ${q.type === 'mcq' ? 'blue' : 'gray'}`} style={{ flexShrink: 0 }}>
                  {q.type.toUpperCase()}
                </span>
              </div>

              {q.body && <div className="q-body">{q.body}</div>}

              {!isDone && q.type === 'mcq' && (
                <div className="options-container">
                  {opts.map((opt, i) => (
                    <label key={i} className={`mcq-option ${answers[q.id] === i ? 'selected' : ''} ${isTimeUp ? 'disabled' : ''}`}>
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        checked={answers[q.id] === i}
                        disabled={isTimeUp}
                        onChange={() => setAnswers(prev => ({ ...prev, [q.id]: i }))}
                      />
                      <span>{typeof opt === 'string' ? opt : JSON.stringify(opt)}</span>
                    </label>
                  ))}
                </div>
              )}

              {!isDone && q.type === 'theory' && (
                <div className="theory-container">
                  <textarea
                    placeholder={isTimeUp ? "Time is up." : "Type your answer here..."}
                    value={answers[q.id] || ''}
                    disabled={isTimeUp}
                    onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                    rows={4}
                  />
                </div>
              )}

              {!isDone && (
                <button
                  className="submit-answer-btn"
                  onClick={() => submitAnswer(q.id)}
                  disabled={isTimeUp || submitting[q.id] || answers[q.id] === undefined || answers[q.id] === ''}
                >
                  {submitting[q.id] ? 'Submitting…' : 'Submit Answer'}
                </button>
              )}

              {isDone && (
                <div className={`result-inline ${result.resultsPending ? 'pending' : result.graded ? (result.score >= 0.5 ? 'correct' : 'incorrect') : 'pending'}`}>
                  {result.resultsPending
                    ? '✅ Submitted — your score will appear on My Results after your instructor publishes results.'
                    : result.graded
                      ? (result.score >= 0.5 ? '✅ Correct!' : '❌ Incorrect')
                      : '⏳ Submitted — awaiting grading'}
                  {!result.resultsPending && result.score != null && ` — Score: ${(result.score * 100).toFixed(0)}%`}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .countdown-bar {
          position: sticky;
          top: 70px;
          z-index: 100;
          background: #fff;
          border: 1px solid #eee;
          border-radius: 12px;
          padding: 12px 20px;
          margin-bottom: 20px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          display: flex;
          justify-content: center;
          transition: all 0.3s ease;
        }
        .countdown-bar.urgent {
          background: #fff5f5;
          border-color: #feb2b2;
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(245, 101, 101, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(245, 101, 101, 0); }
          100% { box-shadow: 0 0 0 0 rgba(245, 101, 101, 0); }
        }
        .countdown-info {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
        }
        .timer-value {
          font-family: monospace;
          font-size: 1.4rem;
          color: #0070f3;
        }
        .urgent .timer-value {
          color: #e53e3e;
        }
        .time-up-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(255,255,255,0.8);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.4s ease;
        }
        .time-up-card {
          background: #fff;
          padding: 40px;
          border-radius: 20px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.1);
          text-align: center;
          max-width: 400px;
        }
        .time-up-card h2 {
          color: #e53e3e;
          margin-bottom: 15px;
        }
        .time-up-card p {
          color: #666;
          margin-bottom: 25px;
        }
        .stat-pill {
          background: #f0f7ff;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
          color: #0070f3;
        }
        .exam-container.locked {
          opacity: 0.6;
          pointer-events: none;
        }
        .mcq-option.disabled {
          cursor: not-allowed;
          opacity: 0.8;
        }
      `}</style>
    </DashboardLayout>
    </RequireAuth>
  );
}
