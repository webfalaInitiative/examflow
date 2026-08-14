import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import DashboardLayout from '../../components/DashboardLayout';
import RequireAuth from '../../components/RequireAuth';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';

export default function CombineResultsPage() {
  const { user } = useAuth();
  const [exams, setExams] = useState([]);
  const [loadingExams, setLoadingExams] = useState(true);

  // Selected folder items: [{ examId: '', weight: 30 }, { examId: '', weight: 70 }]
  const [items, setItems] = useState([
    { examId: '', weight: 30 },
    { examId: '', weight: 70 },
  ]);

  const [report, setReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState('');
  const [reportTitle, setReportTitle] = useState('First Term Combined Assessment Report');
  const [publishing, setPublishing] = useState(false);
  const [publishedNotice, setPublishedNotice] = useState('');
  const [publishedReports, setPublishedReports] = useState([]);
  const [loadingPublished, setLoadingPublished] = useState(false);

  const isStaff = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const fetchPublishedReports = async () => {
    setLoadingPublished(true);
    try {
      const res = await api.get('/exams/combine-results/published');
      setPublishedReports(res.data);
    } catch {
    } finally {
      setLoadingPublished(false);
    }
  };

  useEffect(() => {
    if (!user || !isStaff) return;
    setLoadingExams(true);
    api
      .get('/exams')
      .then((res) => {
        setExams(res.data);
        if (res.data.length >= 2) {
          setItems([
            { examId: String(res.data[0].id), weight: 30 },
            { examId: String(res.data[1].id), weight: 70 },
          ]);
        }
      })
      .catch(() => setError('Failed to load exam folders'))
      .finally(() => setLoadingExams(false));

    fetchPublishedReports();
  }, [user, isStaff]);

  const totalWeight = useMemo(() => {
    return items.reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0);
  }, [items]);

  const updateItem = (index, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addItem = () => {
    setItems((prev) => [...prev, { examId: '', weight: 0 }]);
  };

  const removeItem = (index) => {
    if (items.length <= 2) {
      alert('At least 2 exam folders are required to combine results.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const generateReport = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setPublishedNotice('');
    setReport(null);

    const validItems = items.filter((i) => i.examId !== '' && !Number.isNaN(parseInt(i.examId)));
    if (validItems.length < 2) {
      setError('Please select at least 2 exam folders.');
      return null;
    }

    const examIds = validItems.map((i) => i.examId);
    if (new Set(examIds).size < validItems.length) {
      setError('Please select different exam folders. You have selected the same exam folder more than once.');
      return null;
    }

    if (totalWeight !== 100) {
      setError(`The total weight must equal 100%. Current total: ${totalWeight}%`);
      return null;
    }

    setLoadingReport(true);
    try {
      const payload = {
        items: validItems.map((i) => ({
          examId: parseInt(i.examId),
          weight: parseFloat(i.weight) || 0,
        })),
      };
      const res = await api.post('/exams/combine-results', payload);
      setReport(res.data);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate combined report');
      return null;
    } finally {
      setLoadingReport(false);
    }
  };

  const generateAndPublish = async () => {
    setError('');
    setPublishedNotice('');

    const generated = await generateReport();
    if (!generated || !generated.folders) return;

    setPublishing(true);
    try {
      const validItems = items.filter((i) => i.examId !== '' && !Number.isNaN(parseInt(i.examId)));
      const itemsPayload = validItems.map((item) => {
        const folder = generated.folders.find((f) => String(f.id) === String(item.examId));
        return {
          examId: item.examId,
          weight: item.weight,
          title: folder ? folder.title : `Folder ${item.examId}`,
        };
      });

      await api.post('/exams/combine-results/publish', {
        title: reportTitle.trim() || 'Combined Assessment Report',
        description: `Combined score report for ${validItems.length} exam folders`,
        items: itemsPayload,
      });

      setPublishedNotice(`✅ Combined report "${reportTitle.trim()}" published successfully! Students can now view their combined results and download official PDF transcripts on their dashboard.`);
      fetchPublishedReports();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to publish combined report.');
    } finally {
      setPublishing(false);
    }
  };

  const deletePublishedReport = async (id, title) => {
    if (!confirm(`Are you sure you want to unpublish "${title}"? Students will no longer see this combined report on their dashboard.`)) {
      return;
    }
    try {
      await api.delete(`/exams/combine-results/published/${id}`);
      setPublishedNotice(`Report "${title}" unpublished successfully.`);
      fetchPublishedReports();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to unpublish report.');
    }
  };

  const exportCSV = () => {
    if (!report || !report.rows || report.rows.length === 0) return;

    const headers = ['Student Name', 'Matric Number', 'Email'];
    report.folders.forEach((f) => {
      headers.push(`${f.title} (${f.weight}%)`);
      headers.push(`${f.title} (Weighted Pts)`);
    });
    headers.push('Total Combined Score (%)', 'Grade', 'Status');

    const csvLines = [headers.join(',')];

    report.rows.forEach((row) => {
      const line = [
        `"${row.user.name || ''}"`,
        `"${row.user.matricNumber || '—'}"`,
        `"${row.user.email || ''}"`,
      ];
      report.folders.forEach((f) => {
        const scoreObj = row.folderScores[f.id];
        if (scoreObj && scoreObj.percent != null) {
          line.push(`${scoreObj.percent.toFixed(1)}%`);
          line.push(`${scoreObj.weightedScore.toFixed(1)}`);
        } else {
          line.push('—', '—');
        }
      });
      line.push(
        row.totalCombined != null ? `${row.totalCombined.toFixed(1)}%` : '—',
        `"${row.gradeLetter || '—'}"`,
        `"${row.status}"`
      );
      csvLines.push(line.join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvLines.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `Combined_Exam_Results_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <RequireAuth>
      <DashboardLayout>
        <div className="page-header flex-header">
          <div>
            <h1>🔗 Combine & Merge Exam Results</h1>
            <p>
              Merge student assessment scores across multiple exam folders (e.g. <strong>Midterm Test (30%)</strong> + <strong>Final Examination (70%)</strong>) with custom weightings and publish to student dashboards.
            </p>
          </div>
          <Link href="/grading" className="btn-outline">
            ← Back to Grading Dashboard
          </Link>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}
        {publishedNotice && (
          <div className="alert alert-success" style={{ marginBottom: 20, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: 16, borderRadius: 8, fontSize: 15, fontWeight: 500 }}>
            {publishedNotice}
          </div>
        )}

        <div className="panel" style={{ marginBottom: 24 }}>
          <div className="panel-header">
            <h2>Select Folders, Assign Weights & Publish</h2>
          </div>
          <div className="panel-body">
            {loadingExams ? (
              <p className="helper">Loading exam folders…</p>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); generateReport(); }}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
                    Report Title (visible on student dashboard & PDF transcript):
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                    placeholder="e.g. First Term Combined Assessment Report"
                    required
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15 }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                  {items.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        background: 'var(--gray-50)',
                        padding: '14px 16px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--gray-200)',
                      }}
                    >
                      <span style={{ fontWeight: 700, minWidth: 80 }}>Folder #{index + 1}:</span>
                      <select
                        style={{ flex: 1, minWidth: 200, padding: '10px', borderRadius: 6, border: '1px solid #d1d5db' }}
                        value={item.examId}
                        onChange={(e) => updateItem(index, 'examId', e.target.value)}
                        required
                      >
                        <option value="">-- Select Exam Folder --</option>
                        {exams.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.title} ({e._count?.questions ?? 0} Questions, {e._count?.assignments ?? 0} Students)
                          </option>
                        ))}
                      </select>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <label style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Weight %:</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          style={{ width: 80, padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}
                          value={item.weight}
                          onChange={(e) => updateItem(index, 'weight', e.target.value)}
                          required
                        />
                        <span>%</span>
                      </div>

                      {items.length > 2 && (
                        <button
                          type="button"
                          className="btn-sm btn-danger"
                          onClick={() => removeItem(index)}
                          style={{ marginLeft: 'auto' }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <button type="button" className="btn-sm btn-outline" onClick={addItem}>
                      + Add Another Folder
                    </button>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 15,
                        color: totalWeight === 100 ? 'var(--success-700)' : 'var(--error-700)',
                      }}
                    >
                      Total Weight: {totalWeight}% {totalWeight !== 100 && '(Must equal 100%)'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="submit"
                      className="btn-outline"
                      disabled={loadingReport || totalWeight !== 100}
                      style={{ padding: '10px 18px', fontWeight: 600 }}
                    >
                      {loadingReport ? 'Calculating…' : 'Generate Scoreboard Preview 📊'}
                    </button>

                    {user?.role === 'OWNER' && (
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ background: '#10b981', borderColor: '#10b981', padding: '10px 20px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 8 }}
                        disabled={publishing || loadingReport || totalWeight !== 100}
                        onClick={generateAndPublish}
                      >
                        {publishing ? 'Publishing…' : '📢 Publish Combined Results to Students'}
                      </button>
                    )}
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Combined Scoreboard Preview */}
        {report && (
          <div className="panel" style={{ marginBottom: 32 }}>
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2>Combined Assessment Scoreboard ({report.rows.length} Students)</h2>
                <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>Title: "{reportTitle}"</span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {user?.role === 'OWNER' && (
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ background: '#10b981', borderColor: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    onClick={generateAndPublish}
                    disabled={publishing}
                  >
                    {publishing ? 'Publishing…' : '📢 Publish Report to Students'}
                  </button>
                )}
                <button type="button" className="btn-sm btn-outline" onClick={exportCSV}>
                  📥 Export Report to CSV
                </button>
              </div>
            </div>
            <div className="panel-body no-pad">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Matric No.</th>
                    {report.folders.map((f) => (
                      <th key={f.id}>
                        {f.title}
                        <br />
                        <span style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 500 }}>
                          Weight: {f.weight}%
                        </span>
                      </th>
                    ))}
                    <th>Total Combined Score</th>
                    <th>Grade</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.length === 0 ? (
                    <tr>
                      <td colSpan={report.folders.length + 5} style={{ textAlign: 'center', padding: 24, color: 'var(--gray-500)' }}>
                        No students assigned to the selected exam folders.
                      </td>
                    </tr>
                  ) : (
                    report.rows.map((row) => (
                      <tr key={row.user.id}>
                        <td>
                          <strong>{row.user.name || row.user.email}</strong>
                          <br />
                          <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{row.user.email}</span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: 'var(--gray-700)' }}>
                            {row.user.matricNumber || '—'}
                          </span>
                        </td>
                        {report.folders.map((f) => {
                          const scoreObj = row.folderScores[f.id];
                          return (
                            <td key={f.id}>
                              {scoreObj && scoreObj.percent != null ? (
                                <div>
                                  <strong>{scoreObj.percent.toFixed(1)}%</strong>
                                  <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                                    +{scoreObj.weightedScore.toFixed(1)} pts
                                  </div>
                                </div>
                              ) : (
                                <span style={{ color: 'var(--gray-400)' }}>—</span>
                              )}
                            </td>
                          );
                        })}
                        <td>
                          {row.totalCombined != null ? (
                            <strong
                              style={{
                                color: row.totalCombined >= 50 ? 'var(--success-700)' : 'var(--error-700)',
                                fontSize: 15,
                              }}
                            >
                              {row.totalCombined.toFixed(1)}%
                            </strong>
                          ) : (
                            <span style={{ color: 'var(--gray-400)' }}>—</span>
                          )}
                        </td>
                        <td>
                          <span className="badge blue">{row.gradeLetter || '—'}</span>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              row.status === 'Passed' ? 'green' : row.status === 'Failed' ? 'red' : 'orange'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Currently Published Combined Reports List */}
        <div className="panel">
          <div className="panel-header">
            <h2>📢 Currently Published Combined Assessment Reports ({publishedReports.length})</h2>
          </div>
          <div className="panel-body no-pad">
            {loadingPublished ? (
              <p className="helper" style={{ padding: 20 }}>Loading published reports…</p>
            ) : publishedReports.length === 0 ? (
              <p className="helper" style={{ padding: 20 }}>No combined assessment reports have been published yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Report Title</th>
                    <th>Folders Combined & Weights</th>
                    <th>Published By</th>
                    <th>Published Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {publishedReports.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.title}</strong>
                        {p.description && <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{p.description}</div>}
                      </td>
                      <td>
                        {Array.isArray(p.items)
                          ? p.items.map((item) => `${item.title || `Folder ${item.examId}`} (${item.weight}%)`).join(' + ')
                          : '—'}
                      </td>
                      <td>{p.creator?.name || p.creator?.email || 'Superadmin'}</td>
                      <td>{new Date(p.publishedAt).toLocaleDateString()}</td>
                      <td>
                        {user?.role === 'OWNER' && (
                          <button
                            type="button"
                            className="btn-sm btn-danger"
                            onClick={() => deletePublishedReport(p.id, p.title)}
                          >
                            Unpublish / Delete
                          </button>
                        )}
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
