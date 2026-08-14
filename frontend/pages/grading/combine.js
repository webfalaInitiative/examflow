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
  const [reportTitle, setReportTitle] = useState('Combined Assessment Report');
  const [publishing, setPublishing] = useState(false);
  const [publishedNotice, setPublishedNotice] = useState('');

  const isStaff = user?.role === 'OWNER' || user?.role === 'ADMIN';

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
  }, [user, isStaff]);

  const totalWeight = useMemo(() => {
    return items.reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0);
  }, [items]);

  const publishCombinedReport = async () => {
    if (!report || !report.folders || report.folders.length < 2) return;
    setPublishing(true);
    setPublishedNotice('');
    setError('');

    try {
      const validItems = items.filter((i) => i.examId !== '' && !Number.isNaN(parseInt(i.examId)));
      const itemsPayload = validItems.map((item) => {
        const folder = report.folders.find((f) => String(f.id) === String(item.examId));
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

      setPublishedNotice('✅ Combined report published successfully! Students can now view their combined result on their dashboard.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to publish combined report.');
    } finally {
      setPublishing(false);
    }
  };

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
    setReport(null);

    const validItems = items.filter((i) => i.examId !== '' && !Number.isNaN(parseInt(i.examId)));
    if (validItems.length < 2) {
      setError('Please select at least 2 exam folders.');
      return;
    }

    const examIds = validItems.map((i) => i.examId);
    if (new Set(examIds).size < validItems.length) {
      setError('Please select different exam folders. You have selected the same exam folder more than once.');
      return;
    }

    if (totalWeight !== 100) {
      setError(`The total weight must equal 100%. Current total: ${totalWeight}%`);
      return;
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
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate combined report');
    } finally {
      setLoadingReport(false);
    }
  };

  const exportCSV = () => {
    if (!report || !report.rows || report.rows.length === 0) return;

    const headers = ['Student Name', 'Email'];
    report.folders.forEach((f) => {
      headers.push(`${f.title} (${f.weight}%)`);
      headers.push(`${f.title} (Weighted Pts)`);
    });
    headers.push('Total Combined Score (%)', 'Grade', 'Status');

    const csvLines = [headers.join(',')];

    report.rows.forEach((row) => {
      const line = [
        `"${row.user.name || ''}"`,
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
              Merge student assessment scores across multiple exam folders (e.g. <strong>Midterm Test (30%)</strong> + <strong>Final Examination (70%)</strong>) with custom weightings.
            </p>
          </div>
          <Link href="/grading" className="btn-outline">
            ← Back to Grading Dashboard
          </Link>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}

        <div className="panel" style={{ marginBottom: 24 }}>
          <div className="panel-header">
            <h2>Select Folders & Assign Weights (%)</h2>
          </div>
          <div className="panel-body">
            {loadingExams ? (
              <p className="helper">Loading exam folders…</p>
            ) : (
              <form onSubmit={generateReport}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
                  {items.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        background: 'var(--gray-50)',
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--gray-200)',
                      }}
                    >
                      <span style={{ fontWeight: 700, minWidth: 80 }}>Folder #{index + 1}:</span>
                      <select
                        style={{ flex: 1, minWidth: 200, padding: '10px' }}
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
                          style={{ width: 80, padding: '8px 10px' }}
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

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <button type="button" className="btn-sm btn-outline" onClick={addItem}>
                      + Add Another Folder
                    </button>
                    <span
                      style={{
                        fontWeight: 700,
                        color: totalWeight === 100 ? 'var(--success-700)' : 'var(--error-700)',
                      }}
                    >
                      Total Weight: {totalWeight}% {totalWeight !== 100 && '(Must equal 100%)'}
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={loadingReport || totalWeight !== 100}
                  >
                    {loadingReport ? 'Calculating Scores…' : 'Generate Combined Report 📊'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {publishedNotice && (
          <div className="alert alert-success" style={{ marginBottom: 20, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
            {publishedNotice}
          </div>
        )}

        {report && (
          <div className="panel">
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2>Combined Assessment Scoreboard ({report.rows.length} Students)</h2>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {user?.role === 'OWNER' && (
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ background: '#10b981', borderColor: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    onClick={publishCombinedReport}
                    disabled={publishing}
                  >
                    {publishing ? 'Publishing…' : '📢 Publish Combined Report to Students'}
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
                      <td colSpan={report.folders.length + 4} style={{ textAlign: 'center', padding: 24, color: 'var(--gray-500)' }}>
                        No students assigned to the selected exam folders.
                      </td>
                    </tr>
                  ) : (
                    report.rows.map((row) => (
                      <tr key={row.user.id}>
                        <td>
                          <strong>{row.user.name || row.user.email}</strong>
                          {row.user.name && <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{row.user.email}</div>}
                        </td>
                        {report.folders.map((f) => {
                          const s = row.folderScores[f.id];
                          return (
                            <td key={f.id}>
                              {s && s.percent != null ? (
                                <div>
                                  <strong>{s.percent.toFixed(1)}%</strong>
                                  <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                                    +{(s.weightedScore).toFixed(1)} pts
                                  </div>
                                </div>
                              ) : (
                                <span className="helper">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td>
                          <strong style={{ fontSize: 16, color: row.totalCombined != null ? 'var(--primary-700)' : 'inherit' }}>
                            {row.totalCombined != null ? `${row.totalCombined.toFixed(1)}%` : '—'}
                          </strong>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              row.gradeLetter === 'A' || row.gradeLetter === 'B'
                                ? 'green'
                                : row.gradeLetter === 'C' || row.gradeLetter === 'D'
                                ? 'blue'
                                : 'orange'
                            }`}
                          >
                            {row.gradeLetter}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${row.status === 'Passed' ? 'green' : row.status === 'Failed' ? 'red' : 'orange'}`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div style={{ padding: 16, background: 'var(--gray-25)', borderTop: '1px solid var(--gray-200)' }}>
                <p className="helper">
                  💡 <strong>Weighted Formula:</strong> Total Score = Sum of <code>(Folder Score % × Folder Weight / 100)</code> across all selected exam folders.
                </p>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </RequireAuth>
  );
}
