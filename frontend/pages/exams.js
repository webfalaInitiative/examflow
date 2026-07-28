import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import RequireAuth from '../components/RequireAuth';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import Link from 'next/link';

export default function ExamsPage() {
  const { user } = useAuth();
  const [exams, setExams] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [students, setStudents] = useState([]);
  
  // Modals state
  const [showExamModal, setShowExamModal] = useState(false);
  const [showManageQuestionsModal, setShowManageQuestionsModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  
  const [currentExam, setCurrentExam] = useState(null);
  const [examForm, setExamForm] = useState({ title: '', description: '', duration: '' });
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // New Question state
  const [questionMode, setQuestionMode] = useState('select'); // 'select' | 'create'
  const [questionForm, setQuestionForm] = useState({ 
    title: '', 
    type: 'mcq', 
    body: '', 
    options: ['', '', '', ''], 
    correctIndex: 0 
  });

  const isAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';

  useEffect(() => {
    if (!user) return;
    loadExams();
    if (isAdmin) {
      loadQuestions();
      loadStudents();
    }
  }, [user]);

  const loadExams = async () => {
    try {
      const r = await api.get('/exams');
      setExams(r.data);
    } catch (err) {}
  };

  const loadQuestions = async () => {
    try {
      const r = await api.get('/questions');
      setQuestions(r.data);
    } catch (err) {}
  };

  const loadStudents = async () => {
    try {
      const r = await api.get('/users');
      setStudents(r.data.filter(u => u.role === 'STUDENT'));
    } catch (err) {}
  };

  const handleCreateOrUpdateExam = async (e) => {
    e.preventDefault();
    if (!examForm.title.trim()) return setError('Title is required');
    setSaving(true);
    try {
      if (currentExam) {
        await api.put(`/exams/${currentExam.id}`, examForm);
      } else {
        await api.post('/exams', examForm);
      }
      setShowExamModal(false);
      loadExams();
      setExamForm({ title: '', description: '', duration: '' });
      setCurrentExam(null);
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Failed to save exam';
      setError(message);
    }
    setSaving(false);
  };

  const openManageQuestions = async (exam) => {
    try {
      const r = await api.get(`/exams/${exam.id}`);
      setCurrentExam(r.data);
      setSelectedQuestions(r.data.questions.map(q => q.questionId));
      setShowManageQuestionsModal(true);
    } catch (err) {
      alert('Failed to load exam details');
    }
  };

  const handleUpdateQuestions = async () => {
    setSaving(true);
    try {
      await api.post(`/exams/${currentExam.id}/questions`, { questionIds: selectedQuestions });
      setShowManageQuestionsModal(false);
      loadExams();
    } catch (err) {
      alert('Failed to update questions');
    }
    setSaving(false);
  };

  const handleCreateQuestionInExam = async (e) => {
    e.preventDefault();
    setError('');
    if (!questionForm.title.trim()) return setError('Question title is required');
    
    setSaving(true);
    try {
      const payload = {
        title: questionForm.title,
        type: questionForm.type,
        body: questionForm.body || null,
        options: questionForm.type === 'mcq' ? questionForm.options.filter(o => o.trim()) : null,
        correct: questionForm.type === 'mcq' ? questionForm.correctIndex : null,
      };
      
      await api.post(`/exams/${currentExam.id}/questions/new`, payload);
      
      loadExams();
      loadQuestions();
      setQuestionMode('select');
      setQuestionForm({ title: '', type: 'mcq', body: '', options: ['', '', '', ''], correctIndex: 0 });
      setShowManageQuestionsModal(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create question');
    }
    setSaving(false);
  };

  const openAssign = async (exam) => {
    try {
      const r = await api.get(`/exams/${exam.id}`);
      setCurrentExam(r.data);
      setSelectedStudents(r.data.assignments.map(a => a.userId));
      setShowAssignModal(true);
    } catch (err) {
      alert('Failed to load assignment details');
    }
  };

  const handleUpdateAssignments = async () => {
    setSaving(true);
    try {
      await api.post(`/exams/${currentExam.id}/assign`, { userIds: selectedStudents });
      setShowAssignModal(false);
      loadExams();
    } catch (err) {
      alert('Failed to update assignments');
    }
    setSaving(false);
  };

  const deleteExam = async (id) => {
    if (!confirm('Are you sure you want to delete this folder?')) return;
    try {
      await api.delete(`/exams/${id}`);
      loadExams();
    } catch (err) {
      alert('Delete failed');
    }
  };

  return (
    <RequireAuth>
    <DashboardLayout>
      <div className="page-header flex-header">
        <div>
          <h1>{isAdmin ? 'Exam Folders' : 'My Exams'}</h1>
          <p>{isAdmin ? 'Create grouped question sets and assign them to specific students.' : 'All exams assigned to you.'}</p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={() => { setExamForm({ title: '', description: '', duration: '' }); setCurrentExam(null); setShowExamModal(true); }}>
            + Create Folder
          </button>
        )}
      </div>

      <div className="exams-grid">
        {exams.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📁</div>
            <p>No exams found.</p>
          </div>
        ) : (
          exams.map(exam => (
            <div key={exam.id} className="exam-card panel">
              <div className="exam-card-content">
                <div className="exam-card-icon">📁</div>
                <div className="exam-card-info">
                  <h3>{exam.title}</h3>
                  <p>{exam.description || 'No description'}</p>
                  <div className="exam-stats">
                    <span>{exam._count?.questions ?? 0} Questions</span>
                    {exam.duration && <span>• {exam.duration} Min</span>}
                    {isAdmin && <span>• {(exam._count?.assignments ?? exam.assignments?.length) ?? 0} Assigned</span>}
                    {!isAdmin && exam.resultsPublished === false && (
                      <span> • <span className="badge orange" style={{ fontSize: '0.75rem' }}>Results when published</span></span>
                    )}
                  </div>
                </div>
              </div>
              <div className="exam-card-footer">
                {isAdmin ? (
                  <div className="btn-group">
                    <button className="btn-sm btn-outline" onClick={() => openManageQuestions(exam)}>Questions</button>
                    <button className="btn-sm btn-outline" onClick={() => openAssign(exam)}>Assign</button>
                    <Link href={`/exams/${exam.id}/grading`} className="btn-sm btn-outline">Grading / publish</Link>
                    <button className="btn-sm btn-outline" onClick={() => { setExamForm({ title: exam.title, description: exam.description, duration: exam.duration || '' }); setCurrentExam(exam); setShowExamModal(true); }}>Edit</button>
                    <button className="btn-sm btn-danger" onClick={() => deleteExam(exam.id)}>Delete</button>
                  </div>
                ) : (
                  <Link href={`/exam?examId=${exam.id}`} className="btn-sm btn-primary">
                    Start Exam
                  </Link>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Folder Modal */}
      {showExamModal && (
        <div className="modal-overlay" onClick={() => setShowExamModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{currentExam ? 'Edit Folder' : 'New Folder'}</h2>
            <form onSubmit={handleCreateOrUpdateExam}>
              <div className="form-row">
                <label>Folder Title</label>
                <input type="text" value={examForm.title} onChange={e => setExamForm({ ...examForm, title: e.target.value })} placeholder="e.g. Midterm Physics" />
              </div>
              <div className="form-row">
                <label>Description</label>
                <textarea value={examForm.description} onChange={e => setExamForm({ ...examForm, description: e.target.value })} placeholder="Short description..." />
              </div>
              <div className="form-row">
                <label>Duration (Minutes)</label>
                <input type="number" value={examForm.duration} onChange={e => setExamForm({ ...examForm, duration: e.target.value })} placeholder="Leave empty for unlimited time" />
              </div>
              {error && <p className="error">{error}</p>}
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setShowExamModal(false)}>Cancel</button>
                <button type="submit" disabled={saving}>{saving ? 'Saving...' : (currentExam ? 'Update' : 'Create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Questions Modal */}
      {showManageQuestionsModal && (
        <div className="modal-overlay" onClick={() => setShowManageQuestionsModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header-tabs">
              <button 
                className={`tab-btn ${questionMode === 'select' ? 'active' : ''}`}
                onClick={() => setQuestionMode('select')}
              >
                Select Questions
              </button>
              <button 
                className={`tab-btn ${questionMode === 'create' ? 'active' : ''}`}
                onClick={() => setQuestionMode('create')}
              >
                Create New Question
              </button>
            </div>

            {questionMode === 'select' ? (
              <>
                <p>Select the questions you want to include in <strong>{currentExam?.title}</strong>.</p>
                <div className="selection-list">
                  {questions.length === 0 ? (
                    <p className="empty-sm">No questions available. Create one first!</p>
                  ) : questions.map(q => (
                    <label key={q.id} className={`selection-item ${selectedQuestions.includes(q.id) ? 'selected' : ''}`}>
                      <input 
                        type="checkbox" 
                        checked={selectedQuestions.includes(q.id)} 
                        onChange={(e) => {
                          if (e.target.checked) setSelectedQuestions([...selectedQuestions, q.id]);
                          else setSelectedQuestions(selectedQuestions.filter(id => id !== q.id));
                        }}
                      />
                      <div className="selection-info">
                        <span className="selection-title">{q.title}</span>
                        <span className="badge gray">{q.type.toUpperCase()}</span>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="modal-actions">
                  <button className="secondary" onClick={() => setShowManageQuestionsModal(false)}>Cancel</button>
                  <button onClick={handleUpdateQuestions} disabled={saving}>{saving ? 'Saving...' : 'Save Selection'}</button>
                </div>
              </>
            ) : (
              <form onSubmit={handleCreateQuestionInExam} className="direct-q-form">
                <p>Add a new question directly to <strong>{currentExam?.title}</strong>.</p>
                
                <div className="form-row">
                  <label>Question Title</label>
                  <input 
                    type="text" 
                    value={questionForm.title} 
                    onChange={e => setQuestionForm({...questionForm, title: e.target.value})}
                    placeholder="e.g. What is the capital of France?"
                  />
                </div>

                <div className="form-row">
                  <label>Type</label>
                  <select 
                    value={questionForm.type} 
                    onChange={e => setQuestionForm({...questionForm, type: e.target.value})}
                  >
                    <option value="mcq">Multiple Choice (MCQ)</option>
                    <option value="theory">Theory</option>
                  </select>
                </div>

                <div className="form-row">
                  <label>Body / Description</label>
                  <textarea 
                    value={questionForm.body} 
                    onChange={e => setQuestionForm({...questionForm, body: e.target.value})}
                    placeholder="Additional details..."
                  />
                </div>

                {questionForm.type === 'mcq' && (
                  <div className="form-row">
                    <label>Options (select the correct one)</label>
                    {questionForm.options.map((opt, i) => (
                      <div key={i} className="option-row">
                        <input
                          type="radio"
                          name="correct-exam"
                          checked={questionForm.correctIndex === i}
                          onChange={() => setQuestionForm({ ...questionForm, correctIndex: i })}
                        />
                        <input
                          type="text"
                          value={opt}
                          onChange={e => {
                            const opts = [...questionForm.options];
                            opts[i] = e.target.value;
                            setQuestionForm({ ...questionForm, options: opts });
                          }}
                          placeholder={`Option ${i + 1}`}
                        />
                      </div>
                    ))}
                    {questionForm.options.length < 6 && (
                      <button type="button" className="add-option-btn" onClick={() => setQuestionForm({ ...questionForm, options: [...questionForm.options, ''] })}>
                        + Add option
                      </button>
                    )}
                  </div>
                )}

                {error && <p className="error">{error}</p>}

                <div className="modal-actions">
                  <button type="button" className="secondary" onClick={() => setQuestionMode('select')}>Back to Select</button>
                  <button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create & Add'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Assign Students Modal */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <h2>Assign {currentExam?.title} to Students</h2>
            <p>Only selected students will be able to see and take this exam folder.</p>
            <div className="selection-list">
              {students.length === 0 ? <p>No students found.</p> : students.map(s => (
                <label key={s.id} className={`selection-item ${selectedStudents.includes(s.id) ? 'selected' : ''}`}>
                  <input 
                    type="checkbox" 
                    checked={selectedStudents.includes(s.id)} 
                    onChange={(e) => {
                      if (e.target.checked) setSelectedStudents([...selectedStudents, s.id]);
                      else setSelectedStudents(selectedStudents.filter(id => id !== s.id));
                    }}
                  />
                  <div className="selection-info">
                    <span className="selection-title">{s.name || s.email}</span>
                    <span className="selection-sub">{s.email}</span>
                  </div>
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setShowAssignModal(false)}>Cancel</button>
              <button onClick={handleUpdateAssignments} disabled={saving}>{saving ? 'Saving...' : 'Save Assignments'}</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .exams-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }
        .exam-card {
          padding: 20px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .exam-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        }
        .exam-card-content {
          display: flex;
          gap: 15px;
          margin-bottom: 20px;
        }
        .exam-card-icon {
          font-size: 2rem;
          background: #f0f7ff;
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
        }
        .exam-card-info h3 {
          margin: 0 0 5px 0;
          font-size: 1.1rem;
        }
        .exam-card-info p {
          margin: 0;
          color: #666;
          font-size: 0.9rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .exam-stats {
          margin-top: 10px;
          font-size: 0.8rem;
          color: #888;
          display: flex;
          gap: 10px;
        }
        .exam-card-footer {
          border-top: 1px solid #eee;
          padding-top: 15px;
          display: flex;
          justify-content: flex-end;
        }
        .modal-lg {
          max-width: 600px;
          width: 90%;
        }
        .selection-list {
          max-height: 400px;
          overflow-y: auto;
          margin: 20px 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding-right: 5px;
        }
        .selection-item {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 12px;
          border: 1px solid #eee;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .selection-item:hover {
          background: #f9f9f9;
        }
        .selection-item.selected {
          border-color: #0070f3;
          background: #f0f7ff;
        }
        .selection-info {
          display: flex;
          flex-direction: column;
          flex: 1;
        }
        .selection-title {
          font-weight: 500;
        }
        .selection-sub {
          font-size: 0.8rem;
          color: #666;
        }
        .btn-group {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
        }
        .modal-header-tabs {
          display: flex;
          gap: 10px;
          border-bottom: 1px solid #eee;
          margin-bottom: 20px;
          position: sticky;
          top: -28px;
          background: #fff;
          z-index: 10;
          padding-bottom: 5px;
        }
        .tab-btn {
          background: none;
          border: none;
          padding: 10px 20px;
          cursor: pointer;
          font-weight: 500;
          color: #666;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }
        .tab-btn:hover {
          color: #333;
        }
        .tab-btn.active {
          color: #0070f3;
          border-bottom-color: #0070f3;
        }
        .direct-q-form {
          animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .option-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
        }
        .option-row input[type="text"] {
          margin: 0;
        }
        .add-option-btn {
          background: #f0f7ff;
          color: #0070f3;
          border: 1px dashed #0070f3;
          width: 100%;
          padding: 8px;
          margin-top: 5px;
        }
        .empty-sm {
          text-align: center;
          color: #888;
          padding: 20px;
          font-style: italic;
        }
      `}</style>
    </DashboardLayout>
    </RequireAuth>
  );
}
