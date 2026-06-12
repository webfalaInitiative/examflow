import { useEffect, useState, useCallback, useMemo } from 'react';
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
  const [orderedQuestions, setOrderedQuestions] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState({});
  const [results, setResults] = useState({});
  const [error, setError] = useState('');

  const [step, setStep] = useState(0);
  const [examComplete, setExamComplete] = useState(false);
  const [showCongrats, setShowCongrats] = useState(false);

  const [timeLeft, setTimeLeft] = useState(null);
  const [isTimeUp, setIsTimeUp] = useState(false);

  const isExamMode = Boolean(examId && router.isReady);

  const allQuestionsAnswered = useMemo(() => {
    if (!orderedQuestions.length) return false;
    const answered = new Set(submissions.map((s) => s.questionId));
    return orderedQuestions.every((q) => answered.has(q.id));
  }, [orderedQuestions, submissions]);

  const freezeTimer = isTimeUp || examComplete || (isExamMode && allQuestionsAnswered);

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
          const ordered = (examData.questions || [])
            .map((eq) => eq.question)
            .filter(Boolean);
          setOrderedQuestions(ordered);
          qData = ordered;
        } else {
          const res = await api.get('/questions');
          qData = res.data;
          setOrderedQuestions([]);
        }

        const sRes = await api.get('/submissions');
        const relevantSubmissions = examId
          ? sRes.data.filter((s) => s.examId === parseInt(examId, 10))
          : sRes.data.filter((s) => s.examId === null);

        setQuestions(qData);
        setSubmissions(relevantSubmissions);

        if (examData && examData.duration) {
          const storageKey = `exam_start_${user.id}_${examId}`;
          let startTime = localStorage.getItem(storageKey);
          if (!startTime) {
            startTime = Date.now().toString();
            localStorage.setItem(storageKey, startTime);
          }
          const durationMs = examData.duration * 60 * 1000;
          const elapsed = Date.now() - parseInt(startTime, 10);
          const remaining = Math.max(0, durationMs - elapsed);
          setTimeLeft(Math.floor(remaining / 1000));
          if (remaining <= 0) setIsTimeUp(true);
        } else {
          setTimeLeft(null);
        }

        if (examId && qData.length) {
          const answered = new Set(relevantSubmissions.map((s) => s.questionId));
          const done = qData.every((q) => answered.has(q.id));
          setExamComplete(done);
        } else if (!examId) {
          setExamComplete(false);
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load exam');
      }
    };

    fetchData();
  }, [user, examId, router.isReady]);

  useEffect(() => {
    setStep(0);
  }, [examId, orderedQuestions.length]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || freezeTimer) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev == null || prev <= 1) {
          clearInterval(timer);
          setIsTimeUp(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, freezeTimer]);

  useEffect(() => {
    if (!showCongrats || !examComplete || isTimeUp) return;
    const t = setTimeout(() => {
      router.push('/');
    }, 3500);
    return () => clearTimeout(t);
  }, [showCongrats, examComplete, isTimeUp, router]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const answeredIds = new Set(submissions.map((s) => s.questionId));
  const available = questions.filter((q) => !answeredIds.has(q.id));

  const submitAnswer = async (questionId) => {
    if (isTimeUp) return;
    const answer = answers[questionId];
    if (answer === undefined || answer === '') return;

    setSubmitting((prev) => ({ ...prev, [questionId]: true }));
    try {
      const res = await api.post('/submissions', {
        questionId,
        answer,
        examId: examId ? parseInt(examId, 10) : null,
      });
      setResults((prev) => ({ ...prev, [questionId]: res.data }));
      setSubmissions((prev) => [...prev, res.data]);

      // Advance to next unanswered question (so Next becomes available)
      if (examId && orderedQuestions.length) {
        const nextSubs = [...submissions, res.data];
        const answered = new Set(nextSubs.map((s) => s.questionId));
        const nextIndex = orderedQuestions.findIndex((q) => !answered.has(q.id));
        if (nextIndex !== -1) {
          setStep(nextIndex);
        }
      }

      if (examId && orderedQuestions.length) {
        const nextSubs = [...submissions, res.data];
        const answered = new Set(nextSubs.map((s) => s.questionId));
        const done = orderedQuestions.every((q) => answered.has(q.id));
        if (done) {
          setExamComplete(true);
          setShowCongrats(true);
        }
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Submission failed');
    }
    setSubmitting((prev) => ({ ...prev, [questionId]: false }));
  };

  const goPrev = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const goNext = useCallback(() => {
    setStep((s) => Math.min(s + 1, Math.max(orderedQuestions.length - 1, 0)));
  }, [orderedQuestions.length]);

  const currentQ = isExamMode && orderedQuestions.length ? orderedQuestions[step] : null;
  const currentSubmitted = currentQ ? submissions.find((s) => s.questionId === currentQ.id) : null;
  const currentResult = currentQ ? results[currentQ.id] || currentSubmitted : null;

  return (
    <RequireAuth>
      <DashboardLayout>
        {timeLeft !== null && !freezeTimer && (
          <div className={`countdown-bar ${timeLeft < 60 ? 'urgent' : ''}`}>
            <div className="countdown-info">
              <span className="timer-icon">⏱️</span>
              <span className="timer-label">Time Remaining:</span>
              <span className="timer-value">{formatTime(timeLeft)}</span>
            </div>
          </div>
        )}

        {freezeTimer && exam?.duration && timeLeft !== null && (
          <div className="countdown-bar countdown-bar--stopped">
            <div className="countdown-info">
              <span className="timer-icon">⏱️</span>
              <span className="timer-label">
                {examComplete && !isTimeUp ? 'Timer stopped — exam finished' : 'Time remaining'}
              </span>
              <span className="timer-value">{isTimeUp ? '0:00' : formatTime(timeLeft)}</span>
            </div>
          </div>
        )}

        <div className="page-header">
          <h1>{exam ? exam.title : 'Take Exam ✏️'}</h1>
          {exam && exam.resultsPublished === false && (
            <p
              className="helper"
              style={{
                marginBottom: 8,
                padding: '8px 12px',
                background: 'var(--warning-50)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              Detailed scores for this folder stay hidden until an instructor publishes results. You will be
              emailed when they are ready.
            </p>
          )}
          <p>
            {exam
              ? exam.description || 'No description'
              : `${available.length} question${available.length !== 1 ? 's' : ''} available`}
          </p>
          <div style={{ display: 'flex', gap: '15px', marginTop: '10px', flexWrap: 'wrap' }}>
            {exam && <span className="stat-pill">📋 {available.length} unanswered</span>}
            {exam && exam.duration && <span className="stat-pill">⏳ {exam.duration} mins total</span>}
            {isExamMode && orderedQuestions.length > 0 && (
              <span className="stat-pill">
                Question {Math.min(step + 1, orderedQuestions.length)} / {orderedQuestions.length}
              </span>
            )}
          </div>
        </div>

        {examComplete && isExamMode && !showCongrats && (
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-body">
              <p style={{ marginBottom: 12 }}>You have already submitted all answers for this exam.</p>
              <a href="/" className="btn-primary">
                Back to Dashboard
              </a>
            </div>
          </div>
        )}

        {showCongrats && examComplete && !isTimeUp && (
          <div className="time-up-overlay">
            <div className="time-up-card congrats-card">
              <div className="empty-icon">🎉</div>
              <h2>Congratulations!</h2>
              <p>You have finished your exam. Your results will be published soon — you will be notified when you can view them on your dashboard.</p>
              <p className="helper" style={{ marginTop: 8 }}>
                Taking you to your dashboard…
              </p>
            </div>
          </div>
        )}

        {isTimeUp && (
          <div className="time-up-overlay">
            <div className="time-up-card">
              <h2>⏰ Time is Up!</h2>
              <p>You can no longer submit answers for this exam. Any submissions already made have been saved.</p>
              <a href="/" className="btn-primary">
                Back to Dashboard
              </a>
            </div>
          </div>
        )}

        {!isExamMode && available.length === 0 && !isTimeUp && Object.keys(results).length === 0 && (
          <div className="panel">
            <div className="panel-body">
              <div className="empty-state">
                <div className="empty-icon">🎉</div>
                <p>You&apos;ve completed all available questions! Check your results.</p>
                <a href="/my-results" className="small-link" style={{ marginTop: 12 }}>
                  View Results →
                </a>
              </div>
            </div>
          </div>
        )}

        {!(examComplete && isExamMode && !showCongrats) && isExamMode && orderedQuestions.length > 0 && currentQ && !isTimeUp && (
          <div className="exam-nav exam-nav--bar">
            <button type="button" className="secondary btn-sm" onClick={goPrev} disabled={step <= 0 || examComplete}>
              ← Previous
            </button>
            <button
              type="button"
              className="secondary btn-sm"
              onClick={goNext}
              disabled={step >= orderedQuestions.length - 1 || examComplete}
            >
              Next →
            </button>
          </div>
        )}

        {!(examComplete && isExamMode && !showCongrats) && (
        <div className={`exam-container ${isTimeUp || examComplete ? 'locked' : ''}`}>
          {isExamMode && orderedQuestions.length > 0 && currentQ && !isTimeUp ? (
            <ExamQuestionCard
              q={currentQ}
              result={currentResult}
              isDone={!!currentSubmitted}
              answers={answers}
              setAnswers={setAnswers}
              submitting={submitting}
              submitAnswer={submitAnswer}
              isTimeUp={isTimeUp}
              examComplete={examComplete}
            />
          ) : (
            !isExamMode &&
            available.map((q, index) => (
              <ExamQuestionCard
                key={q.id}
                q={q}
                result={results[q.id]}
                isDone={!!results[q.id]}
                answers={answers}
                setAnswers={setAnswers}
                submitting={submitting}
                submitAnswer={submitAnswer}
                isTimeUp={isTimeUp}
                examComplete={false}
                styleDelay={index * 0.05}
              />
            ))
          )}
        </div>
        )}

        {error && <p className="error">{error}</p>}

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
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            display: flex;
            justify-content: center;
            transition: all 0.3s ease;
          }
          .countdown-bar--stopped {
            background: #ecfdf3;
            border-color: #a7f3d0;
          }
          .countdown-bar.urgent {
            background: #fff5f5;
            border-color: #feb2b2;
            animation: pulse 1.5s infinite;
          }
          @keyframes pulse {
            0% {
              box-shadow: 0 0 0 0 rgba(245, 101, 101, 0.4);
            }
            70% {
              box-shadow: 0 0 0 10px rgba(245, 101, 101, 0);
            }
            100% {
              box-shadow: 0 0 0 0 rgba(245, 101, 101, 0);
            }
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
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.88);
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
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.1);
            text-align: center;
            max-width: 440px;
          }
          .congrats-card h2 {
            color: #027a48;
            margin: 12px 0;
          }
          .time-up-card h2 {
            color: #e53e3e;
            margin-bottom: 15px;
          }
          .congrats-card h2 {
            color: #027a48;
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
            opacity: 0.55;
            pointer-events: none;
          }
          .exam-nav--bar {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 16px;
            flex-wrap: wrap;
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

function ExamQuestionCard({
  q,
  result,
  isDone,
  answers,
  setAnswers,
  submitting,
  submitAnswer,
  isTimeUp,
  examComplete,
  styleDelay = 0,
}) {
  const opts = q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : [];

  return (
    <div className="exam-card" style={{ animationDelay: `${styleDelay}s` }}>
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
            <label
              key={i}
              className={`mcq-option ${answers[q.id] === i ? 'selected' : ''} ${isTimeUp || examComplete ? 'disabled' : ''}`}
            >
              <input
                type="radio"
                name={`q-${q.id}`}
                checked={answers[q.id] === i}
                disabled={isTimeUp || examComplete}
                onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: i }))}
              />
              <span>{typeof opt === 'string' ? opt : JSON.stringify(opt)}</span>
            </label>
          ))}
        </div>
      )}

      {!isDone && q.type === 'theory' && (
        <div className="theory-container">
          <textarea
            placeholder={isTimeUp || examComplete ? 'Submitted or closed.' : 'Type your answer here...'}
            value={answers[q.id] || ''}
            disabled={isTimeUp || examComplete}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
            rows={4}
          />
        </div>
      )}

      {!isDone && (
        <button
          className="submit-answer-btn"
          onClick={() => submitAnswer(q.id)}
          disabled={
            isTimeUp || examComplete || submitting[q.id] || answers[q.id] === undefined || answers[q.id] === ''
          }
        >
          {submitting[q.id] ? 'Submitting…' : 'Submit Answer'}
        </button>
      )}

      {isDone && result && (
        <div
          className={`result-inline ${
            result.resultsPending ? 'pending' : result.graded ? (result.score >= 0.5 ? 'correct' : 'incorrect') : 'pending'
          }`}
        >
          {result.resultsPending
            ? '✅ Submitted — your score will appear on My Results after your instructor publishes results.'
            : result.graded
              ? result.score >= 0.5
                ? '✅ Correct!'
                : '❌ Incorrect'
              : '⏳ Submitted — awaiting grading'}
          {!result.resultsPending && result.score != null && ` — Score: ${(result.score * 100).toFixed(0)}%`}
        </div>
      )}
    </div>
  );
}
