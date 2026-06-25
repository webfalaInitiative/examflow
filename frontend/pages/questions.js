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
  const [form, setForm] = useState({ title: '', type: 'mcq', body: '', options: ['', '', '', ''], correctIndex: 0, correctText: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState('');

  useEffect(() => {
    if (!user) return;
    loadQuestions();
  }, [user]);

  const loadQuestions = () => {
    api.get('/questions').then(r => setQuestions(r.data)).catch(() => {});
  };

  const resetForm = () => {
    setForm({ title: '', type: 'mcq', body: '', options: ['', '', '', ''], correctIndex: 0, correctText: '' });
    setEditId(null);
    setError('');
  };

  const openCreate = () => { resetForm(); setShowForm(true); };

  const openEdit = (q) => {
    const opts = q.type === 'mcq' && q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : ['', '', '', ''];
    let correctIdx = 0;
    let correctTxt = '';
    if (q.type === 'mcq' && q.correct != null) {
      const correct = typeof q.correct === 'string' ? q.correct : JSON.stringify(q.correct);
      correctIdx = opts.findIndex((o, i) => JSON.stringify(i) === correct || JSON.stringify(o) === correct) || 0;
      if (correctIdx < 0) correctIdx = typeof q.correct === 'number' ? q.correct : 0;
    } else if (q.type === 'theory' && q.correct != null) {
      correctTxt = typeof q.correct === 'string' ? q.correct : String(q.correct);
    }
    setForm({ title: q.title, type: q.type, body: q.body || '', options: opts, correctIndex: correctIdx, correctText: correctTxt });
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
        correct: form.type === 'mcq' ? form.correctIndex : (form.correctText || null),
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

  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error('CSV must contain a header row and at least one data row');

    const parseLine = (line) => {
      const result = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += char;
        }
      }
      result.push(cur.trim());
      return result;
    };

    const headers = parseLine(lines[0]).map(h => h.toLowerCase());
    const titleIdx = headers.indexOf('title');
    const typeIdx = headers.indexOf('type');
    const bodyIdx = headers.indexOf('body');
    const optionsIdx = headers.indexOf('options');
    const correctIdx = headers.indexOf('correct');

    if (titleIdx === -1 || typeIdx === -1) {
      throw new Error('CSV header must contain at least "title" and "type" columns');
    }

    const parsed = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = parseLine(lines[i]);
      if (cells.length < 2) continue;
      
      const title = cells[titleIdx];
      const type = cells[typeIdx]?.toLowerCase();
      const body = bodyIdx !== -1 ? cells[bodyIdx] : '';
      
      if (!title || !type) continue;
      
      let options = null;
      let correct = null;
      
      if (type === 'mcq') {
        const rawOptions = optionsIdx !== -1 ? cells[optionsIdx] : '';
        options = rawOptions.split(/[;|]/).map(o => o.trim()).filter(Boolean);
        const rawCorrect = correctIdx !== -1 ? cells[correctIdx] : '0';
        correct = parseInt(rawCorrect, 10);
        if (isNaN(correct)) correct = 0;
      } else {
        correct = correctIdx !== -1 ? cells[correctIdx] : '';
      }

      parsed.push({ title, type, body, options, correct });
    }
    return parsed;
  };

  const handleImport = async (e) => {
    e.preventDefault();
    setImportError('');
    setImporting(true);

    try {
      let questionsList = [];
      if (importFile) {
        const fileText = await importFile.text();
        if (importFile.name.endsWith('.json')) {
          questionsList = JSON.parse(fileText);
        } else if (importFile.name.endsWith('.csv')) {
          questionsList = parseCSV(fileText);
        } else {
          throw new Error('Unsupported file format. Please upload .json or .csv');
        }
      } else if (importText.trim()) {
        questionsList = JSON.parse(importText);
      } else {
        throw new Error('Please select a file or paste JSON questions');
      }

      if (!Array.isArray(questionsList)) {
        throw new Error('Import data must be a list (array) of questions');
      }

      const res = await api.post('/questions/bulk', { questions: questionsList });
      setShowImport(false);
      setImportText('');
      setImportFile(null);
      setImportSuccess(`✅ Successfully imported ${res.data.count} question${res.data.count !== 1 ? 's' : ''}.`);
      setTimeout(() => setImportSuccess(''), 5000);
      loadQuestions();
    } catch (err) {
      setImportError(err.response?.data?.error || err.message || 'Import failed');
    }
    setImporting(false);
  };

  return (
    <RequireAuth>
    <DashboardLayout>
      <div className="page-header flex-header">
        <div>
          <h1>Questions</h1>
          <p>Create and manage exam questions</p>
        </div>
        {isStaff && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setShowImport(true)} className="secondary">↑ Import Questions</button>
            <button type="button" onClick={openCreate}>+ New Question</button>
          </div>
        )}
      </div>

      {importSuccess && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 16, color: '#047857', fontWeight: 500 }}>
          {importSuccess}
        </div>
      )}

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

              {form.type === 'theory' && (
                <div className="form-row">
                  <label>Expected Answer / Rubric</label>
                  <textarea
                    value={form.correctText}
                    onChange={e => setForm({ ...form, correctText: e.target.value })}
                    placeholder="Describe the expected correct answer or keyword list to assist grading"
                    rows={3}
                  />
                </div>
              )}

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

      {/* Import Modal */}
      {showImport && (
        <div className="modal-overlay" onClick={() => { setShowImport(false); setImportError(''); setImportFile(null); setImportText(''); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Import Questions</h2>
            <p style={{ color: 'var(--gray-500)', fontSize: 13, marginBottom: 16 }}>
              Upload a <strong>.json</strong> or <strong>.csv</strong> file, or paste raw JSON questions list below.
            </p>
            <form onSubmit={handleImport}>
              <div className="form-row">
                <label>Select JSON/CSV File</label>
                <input
                  type="file"
                  accept=".json,.csv"
                  onChange={e => {
                    const file = e.target.files[0];
                    setImportFile(file);
                  }}
                  style={{ padding: '8px 0' }}
                />
              </div>

              <div style={{ textAlign: 'center', margin: '12px 0', color: 'var(--gray-400)', fontSize: 12 }}>
                — OR —
              </div>

              <div className="form-row">
                <label>Paste Raw JSON</label>
                <textarea
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  placeholder={`[
  {
    "title": "Who is the originator of Python?",
    "type": "theory",
    "correct": "Guido van Rossum"
  }
]`}
                  rows={8}
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                  disabled={!!importFile}
                />
              </div>

              {importError && <p className="error">{importError}</p>}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setShowImport(false);
                    setImportError('');
                    setImportFile(null);
                    setImportText('');
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-success" disabled={importing}>
                  {importing ? 'Importing…' : 'Import'}
                </button>
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
