import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import RequireAuth from '../components/RequireAuth';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

export default function QuestionsPage() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ title: '', type: 'mcq', body: '', options: ['', '', '', ''], correctIndex: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    loadQuestions();
  }, [user]);

  const loadQuestions = () => {
    api.get('/questions').then(r => setQuestions(r.data)).catch(() => {});
  };

  const resetForm = () => {
    setForm({ title: '', type: 'mcq', body: '', options: ['', '', '', ''], correctIndex: 0 });
    setEditId(null);
    setError('');
  };

  const openCreate = () => { resetForm(); setShowForm(true); };

  const openEdit = (q) => {
    const opts = q.type === 'mcq' && q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : ['', '', '', ''];
    let correctIdx = 0;
    if (q.type === 'mcq' && q.correct != null) {
      const correct = typeof q.correct === 'string' ? q.correct : JSON.stringify(q.correct);
      correctIdx = opts.findIndex((o, i) => JSON.stringify(i) === correct || JSON.stringify(o) === correct) || 0;
      if (correctIdx < 0) correctIdx = typeof q.correct === 'number' ? q.correct : 0;
    }
    setForm({ title: q.title, type: q.type, body: q.body || '', options: opts, correctIndex: correctIdx });
    setEditId(q.id);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) return setError('Title is required');
    if (form.type === 'mcq') {
      const validOpts = form.options.filter(o => o.trim());
      if (validOpts.length < 2) return setError('At least 2 options required');
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title,
        type: form.type,
        body: form.body || null,
        options: form.type === 'mcq' ? form.options.filter(o => o.trim()) : null,
        correct: form.type === 'mcq' ? form.correctIndex : null,
      };

      if (editId) {
        await api.put(`/questions/${editId}`, payload);
      } else {
        await api.post('/questions', payload);
      }
      setShowForm(false);
      resetForm();
      loadQuestions();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    }
    setSaving(false);
  };

  const isStaff = user?.role === 'OWNER' || user?.role === 'ADMIN';
  const canModerate = user?.role === 'OWNER';

  const approveQuestion = async (id) => {
    try {
      await api.post(`/moderation/questions/${id}/approve`);
      loadQuestions();
    } catch (err) {
      alert(err.response?.data?.error || 'Approve failed');
    }
  };

  const deleteQuestion = async (id) => {
    if (!confirm('Delete this question? All related submissions will also be deleted.')) return;
    try {
      await api.delete(`/questions/${id}`);
      loadQuestions();
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed');
    }
  };

  return (
    <RequireAuth>
    <DashboardLayout>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Questions</h1>
          <p>Create and manage exam questions</p>
        </div>
        {isStaff && (
          <button onClick={openCreate}>+ New Question</button>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); resetForm(); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editId ? 'Edit Question' : 'New Question'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <label>Title *</label>
                <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. What is polymorphism?" />
              </div>
              <div className="form-grid">
                <div className="form-row">
                  <label>Type</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                    <option value="mcq">Multiple Choice (MCQ)</option>
                    <option value="theory">Theory</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <label>Description / Body</label>
                <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="Question details (optional)" />
              </div>

              {form.type === 'mcq' && (
                <div className="form-row">
                  <label>Options (select the correct one)</label>
                  {form.options.map((opt, i) => (
                    <div key={i} className="option-row">
                      <input
                        type="radio"
                        name="correct"
                        checked={form.correctIndex === i}
                        onChange={() => setForm({ ...form, correctIndex: i })}
                      />
                      <input
                        type="text"
                        value={opt}
                        onChange={e => {
                          const opts = [...form.options];
                          opts[i] = e.target.value;
                          setForm({ ...form, options: opts });
                        }}
                        placeholder={`Option ${i + 1}`}
                      />
                      {form.options.length > 2 && (
                        <button type="button" className="option-remove" onClick={() => {
                          const opts = form.options.filter((_, j) => j !== i);
                          setForm({ ...form, options: opts, correctIndex: Math.min(form.correctIndex, opts.length - 1) });
                        }}>×</button>
                      )}
                    </div>
                  ))}
                  {form.options.length < 6 && (
                    <button type="button" className="add-option-btn" onClick={() => setForm({ ...form, options: [...form.options, ''] })}>
                      + Add option
                    </button>
                  )}
                </div>
              )}

              {error && <p className="error">{error}</p>}

              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</button>
                <button type="submit" disabled={saving}>{saving ? 'Saving…' : (editId ? 'Update' : 'Create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Questions Table */}
      <div className="panel">
        <div className="panel-body no-pad">
          {questions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📝</div>
              <p>No questions yet. Create your first question!</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Approval</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {questions.map(q => (
                  <tr key={q.id}>
                    <td><strong>{q.title}</strong></td>
                    <td><span className={`badge ${q.type === 'mcq' ? 'blue' : 'gray'}`}>{q.type.toUpperCase()}</span></td>
                    <td>
                      <span className={`badge ${q.approvalStatus === 'APPROVED' ? 'green' : q.approvalStatus === 'REJECTED' ? 'red' : 'orange'}`}>
                        {q.approvalStatus || 'APPROVED'}
                      </span>
                      {canModerate && q.approvalStatus === 'PENDING' && (
                        <div style={{ marginTop: 6 }}>
                          <button type="button" className="btn-sm btn-success" onClick={() => approveQuestion(q.id)}>Approve</button>
                        </div>
                      )}
                    </td>
                    <td>{new Date(q.createdAt).toLocaleDateString()}</td>
                    <td>
                      {isStaff ? (
                        <div className="btn-group">
                          <button className="btn-sm btn-outline" onClick={() => openEdit(q)}>Edit</button>
                          <button className="btn-sm btn-danger" onClick={() => deleteQuestion(q.id)}>Delete</button>
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
    </RequireAuth>
  );
}
