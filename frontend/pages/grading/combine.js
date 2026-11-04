import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import DashboardLayout from '../../components/DashboardLayout';
import RequireAuth from '../../components/RequireAuth';
import StatementOfResult, { getStatementGrade, formatStatementDate } from '../../components/StatementOfResult';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';

export default function CombineResultsPage() {
  const { user } = useAuth();
  const [exams, setExams] = useState([]);
  const [loadingExams, setLoadingExams] = useState(true);

  // Active top tab: 'combine' (Step 1) or 'publish' (Step 2)
  const [activeTab, setActiveTab] = useState('combine');

  // ==========================================
  // STEP 1: COMBINE FOLDERS INTO FINAL SUBJECT
  // ==========================================
  const [subjectName, setSubjectName] = useState('');
  const [finalTitle, setFinalTitle] = useState('');
  const [combineItems, setCombineItems] = useState([
    { examId: '', weight: 30 },
    { examId: '', weight: 70 },
  ]);
  const [combinePreview, setCombinePreview] = useState(null);
  const [loadingCombinePreview, setLoadingCombinePreview] = useState(false);
  const [savingConsolidate, setSavingConsolidate] = useState(false);
  const [consolidateError, setConsolidateError] = useState('');
  const [consolidateSuccess, setConsolidateSuccess] = useState('');
  const [deletingFolderId, setDeletingFolderId] = useState(null);

  // ==========================================
  // STEP 2: PUBLISH RESULTS / RESULT SLIP
  // ==========================================
  const [reportTitle, setReportTitle] = useState('Women in AI Fellowship 2025');
  const [directorName, setDirectorName] = useState('Bakare Nafisat Opeyemi');
  const [issueDate, setIssueDate] = useState('9th September, 2025');
  const [weightMode, setWeightMode] = useState('equal'); // 'equal' | 'custom'

  // Selected final folders to include on the result slip: [{ examId: '', weight: 50 }, ...]
  const [publishItems, setPublishItems] = useState([]);
  const [report, setReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishedNotice, setPublishedNotice] = useState('');
  const [publishedReports, setPublishedReports] = useState([]);
  const [loadingPublished, setLoadingPublished] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [selectedStudentForStatement, setSelectedStudentForStatement] = useState(null);

  const isStaff = user?.role === 'OWNER' || user?.role === 'ADMIN';
  const isOwner = user?.role === 'OWNER';

  const loadExams = async () => {
    setLoadingExams(true);
    try {
      const res = await api.get('/exams');
      setExams(res.data);
      return res.data;
    } catch {
      setError('Failed to load exam folders');
      return [];
    } finally {
      setLoadingExams(false);
    }
  };

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

  const fetchPendingRequests = async () => {
    setLoadingPending(true);
    try {
      const res = await api.get('/exams/combine-results/pending-requests');
      setPendingRequests(res.data);
    } catch {
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    if (!user || !isStaff) return;
    loadExams().then((loadedExams) => {
      if (loadedExams && loadedExams.length >= 2) {
        setCombineItems([
          { examId: String(loadedExams[0].id), weight: 30 },
          { examId: String(loadedExams[1].id), weight: 70 },
        ]);
      }
      // Initialize publish items with any final folders if present, or first folders
      const finals = (loadedExams || []).filter((e) => e.category === 'FINAL');
      if (finals.length > 0) {
        const equalW = Math.round((100 / finals.length) * 10) / 10;
        setPublishItems(finals.map((f) => ({ examId: String(f.id), weight: equalW })));
      } else if (loadedExams && loadedExams.length >= 2) {
        setPublishItems([
          { examId: String(loadedExams[0].id), weight: 50 },
          { examId: String(loadedExams[1].id), weight: 50 },
        ]);
      }
    });
    fetchPublishedReports();
    fetchPendingRequests();
  }, [user, isStaff]);

  // Derived: final subject folders already created
  const finalFolders = useMemo(() => {
    return exams.filter((e) => e.category === 'FINAL' || (e.title && e.title.toLowerCase().includes('final score')));
  }, [exams]);

  // Regular non-final folders for Step 1 combination
  const sourceFolders = useMemo(() => {
    return exams.filter((e) => e.category !== 'FINAL');
  }, [exams]);

  // Total weight for Step 1 Combine
  const totalCombineWeight = useMemo(() => {
    return combineItems.reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0);
  }, [combineItems]);

  // Total weight for Step 2 Publish
  const totalPublishWeight = useMemo(() => {
    return publishItems.reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0);
  }, [publishItems]);

  // Handle subject name input to automatically suggest final folder title
  const handleSubjectChange = (val) => {
    setSubjectName(val);
    if (!finalTitle || finalTitle.includes('Final Score')) {
      setFinalTitle(val ? `${val.trim()} Final Score` : '');
    }
  };

  // Step 1: Combine Items handlers
  const updateCombineItem = (index, field, value) => {
    setCombineItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addCombineItem = () => {
    setCombineItems((prev) => [...prev, { examId: '', weight: 0 }]);
  };

  const removeCombineItem = (index) => {
    if (combineItems.length <= 2) {
      alert('At least 2 exam folders are required to combine.');
      return;
    }
    setCombineItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Preview consolidated scores in Step 1
  const handlePreviewConsolidate = async (e) => {
    if (e) e.preventDefault();
    setConsolidateError('');
    setConsolidateSuccess('');
    setCombinePreview(null);

    const valid = combineItems.filter((i) => i.examId && !Number.isNaN(parseInt(i.examId)));
    if (valid.length < 2) {
      setConsolidateError('Please select at least 2 folders to combine.');
      return;
    }

    const examIds = valid.map((i) => i.examId);
    if (new Set(examIds).size < valid.length) {
      setConsolidateError('Please select different folders. The same folder was selected multiple times.');
      return;
    }

    if (Math.abs(totalCombineWeight - 100) > 0.1) {
      setConsolidateError(`The total weight must equal 100%. Current total: ${totalCombineWeight}%`);
      return;
    }

    setLoadingCombinePreview(true);
    try {
      const res = await api.post('/exams/combine-results', {
        items: valid.map((i) => ({
          examId: parseInt(i.examId),
          weight: parseFloat(i.weight) || 0,
        })),
      });
      setCombinePreview(res.data);
    } catch (err) {
      setConsolidateError(err.response?.data?.error || 'Failed to preview consolidated scores.');
    } finally {
      setLoadingCombinePreview(false);
    }
  };

  // Step 1: Save as New Final Subject Folder
  const handleSaveConsolidatedFolder = async (e) => {
    if (e) e.preventDefault();
    setConsolidateError('');
    setConsolidateSuccess('');

    const titleToUse = finalTitle.trim() || (subjectName.trim() ? `${subjectName.trim()} Final Score` : '');
    if (!titleToUse) {
      setConsolidateError('Please provide a title for the new Final Subject Folder (e.g. Physics Final Score).');
      return;
    }

    const valid = combineItems.filter((i) => i.examId && !Number.isNaN(parseInt(i.examId)));
    if (valid.length < 2) {
      setConsolidateError('Please select at least 2 folders to combine.');
      return;
    }

    const examIds = valid.map((i) => i.examId);
    if (new Set(examIds).size < valid.length) {
      setConsolidateError('Please select different folders. Duplicate folders selected.');
      return;
    }

    if (Math.abs(totalCombineWeight - 100) > 0.1) {
      setConsolidateError(`Total weight must equal 100%. Current total: ${totalCombineWeight}%`);
      return;
    }

    setSavingConsolidate(true);
    try {
      const payload = {
        title: titleToUse,
        subject: subjectName.trim() || null,
        items: valid.map((i) => ({
          examId: parseInt(i.examId),
          weight: parseFloat(i.weight) || 0,
        })),
      };

      const res = await api.post('/exams/consolidate-folder', payload);
      const createdExam = res.data.exam;

      setConsolidateSuccess(
        `✅ Successfully created final folder "${createdExam.title}"! Consolidated scores for ${res.data.scoredCount || res.data.studentCount} students. Original folders remain preserved.`
      );
      setCombinePreview(null);
      setFinalTitle('');
      setSubjectName('');

      // Reload exams and update publish items list with the new final folder
      const updatedExams = await loadExams();
      if (updatedExams) {
        const finals = updatedExams.filter((e) => e.category === 'FINAL');
        const equalW = finals.length > 0 ? Math.round((100 / finals.length) * 10) / 10 : 100;
        setPublishItems(finals.map((f) => ({ examId: String(f.id), weight: equalW })));
      }
    } catch (err) {
      setConsolidateError(err.response?.data?.error || 'Failed to create consolidated final subject folder.');
    } finally {
      setSavingConsolidate(false);
    }
  };

  // Delete an existing consolidated final folder
  const handleDeleteFinalFolder = async (examId, title) => {
    if (!confirm(`Are you sure you want to delete final folder "${title}"? Original test & exam folders will not be affected.`)) {
      return;
    }
    setDeletingFolderId(examId);
    try {
      await api.delete(`/exams/${examId}`);
      setConsolidateSuccess(`Final folder "${title}" deleted.`);
      const updatedExams = await loadExams();
      if (updatedExams) {
        const finals = updatedExams.filter((e) => e.category === 'FINAL');
        const equalW = finals.length > 0 ? Math.round((100 / finals.length) * 10) / 10 : 100;
        setPublishItems(finals.map((f) => ({ examId: String(f.id), weight: equalW })));
      }
    } catch (err) {
      setConsolidateError(err.response?.data?.error || 'Failed to delete final folder.');
    } finally {
      setDeletingFolderId(null);
    }
  };

  // ==========================================
  // STEP 2: PUBLISH RESULTS HANDLERS
  // ==========================================
  const toggleFinalFolderSelection = (examIdStr) => {
    setPublishItems((prev) => {
      const exists = prev.some((i) => i.examId === examIdStr);
      let next;
      if (exists) {
        next = prev.filter((i) => i.examId !== examIdStr);
      } else {
        next = [...prev, { examId: examIdStr, weight: 0 }];
      }

      // If in equal weight mode, distribute equally
      if (weightMode === 'equal' && next.length > 0) {
        const equalW = Math.round((100 / next.length) * 10) / 10;
        next = next.map((it) => ({ ...it, weight: equalW }));
      }
      return next;
    });
  };

  const selectAllFinalFolders = () => {
    if (finalFolders.length === 0) return;
    const equalW = Math.round((100 / finalFolders.length) * 10) / 10;
    setPublishItems(finalFolders.map((f) => ({ examId: String(f.id), weight: equalW })));
    setWeightMode('equal');
  };

  const deselectAllPublishFolders = () => {
    setPublishItems([]);
  };

  const updatePublishItemWeight = (index, value) => {
    setPublishItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], weight: value };
      return next;
    });
  };

  const addCustomPublishFolder = () => {
    setPublishItems((prev) => [...prev, { examId: '', weight: 0 }]);
  };

  const removePublishItem = (index) => {
    setPublishItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (weightMode === 'equal' && next.length > 0) {
        const equalW = Math.round((100 / next.length) * 10) / 10;
        return next.map((it) => ({ ...it, weight: equalW }));
      }
      return next;
    });
  };

  // Generate Scoreboard Preview for Step 2
  const generatePublishReport = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setPublishedNotice('');
    setReport(null);

    const validItems = publishItems.filter((i) => i.examId !== '' && !Number.isNaN(parseInt(i.examId)));
    if (validItems.length < 1) {
      setError('Please select at least 1 final subject folder to include on the result slip.');
      return null;
    }

    const examIds = validItems.map((i) => i.examId);
    if (new Set(examIds).size < validItems.length) {
      setError('Please select distinct folders. A folder is selected more than once.');
      return null;
    }

    // Ensure weights sum to 100%
    let itemsToSubmit = validItems;
    if (weightMode === 'equal') {
      const equalW = 100 / validItems.length;
      itemsToSubmit = validItems.map((i) => ({ ...i, weight: equalW }));
    } else {
      if (Math.abs(totalPublishWeight - 100) > 0.1) {
        setError(`The total weight must equal 100%. Current total: ${totalPublishWeight}%`);
        return null;
      }
    }

    setLoadingReport(true);
    try {
      const payload = {
        items: itemsToSubmit.map((i) => ({
          examId: parseInt(i.examId),
          weight: parseFloat(i.weight) || 0,
        })),
      };
      const res = await api.post('/exams/combine-results', payload);
      setReport(res.data);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate scoreboard preview');
      return null;
    } finally {
      setLoadingReport(false);
    }
  };

  // Publish / Request Publish Combined Results to Students
  const generateAndPublish = async () => {
    setError('');
    setPublishedNotice('');

    const generated = await generatePublishReport();
    if (!generated || !generated.folders) return;

    setPublishing(true);
    try {
      const validItems = publishItems.filter((i) => i.examId !== '' && !Number.isNaN(parseInt(i.examId)));
      const itemsPayload = validItems.map((item) => {
        const folder = generated.folders.find((f) => String(f.id) === String(item.examId));
        return {
          examId: item.examId,
          weight: weightMode === 'equal' ? Math.round((100 / validItems.length) * 10) / 10 : item.weight,
          title: folder ? folder.title : `Folder ${item.examId}`,
          subject: folder?.subject || null,
        };
      });

      const payload = {
        title: reportTitle.trim() || 'Combined Assessment Report',
        description: `Official Statement of Result for ${validItems.length} subjects`,
        items: itemsPayload,
        issueDate: issueDate.trim() || '9th September, 2025',
        directorName: directorName.trim() || 'Bakare Nafisat Opeyemi',
      };

      if (isOwner) {
        await api.post('/exams/combine-results/publish', payload);
        setPublishedNotice(
          `✅ Results for "${reportTitle.trim()}" published successfully! Students can now view their official Statement of Result with fixed date "${issueDate.trim()}" on their dashboard.`
        );
      } else {
        await api.post('/exams/combine-results/request-publish', payload);
        setPublishedNotice(
          `📩 Publish request for "${reportTitle.trim()}" submitted to Superadmin for approval! Once approved, results will be published to students.`
        );
      }

      fetchPublishedReports();
      fetchPendingRequests();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit combined report.');
    } finally {
      setPublishing(false);
    }
  };

  const approvePendingRequest = async (id, title) => {
    if (!confirm(`Approve and publish results for "${title}"? All assigned students will immediately receive access to their Statements of Result.`)) {
      return;
    }
    try {
      await api.post(`/exams/combine-results/${id}/approve`);
      setPublishedNotice(`🎉 Report "${title}" approved and officially published to students!`);
      fetchPublishedReports();
      fetchPendingRequests();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve report.');
    }
  };

  const rejectPendingRequest = async (id, title) => {
    if (!confirm(`Cancel / reject publish request for "${title}"?`)) {
      return;
    }
    try {
      await api.post(`/exams/combine-results/${id}/reject`);
      setPublishedNotice(`Publish request for "${title}" removed.`);
      fetchPendingRequests();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove publish request.');
    }
  };

  const deletePublishedReport = async (id, title) => {
    if (!isOwner) {
      alert('Only the Superadmin can unpublish or delete an officially published result report.');
      return;
    }
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
      headers.push(`${f.title} (${f.weight != null ? Number(f.weight).toFixed(1) : ''}%)`);
    });
    headers.push('Cumulative Average (%)', 'Overall Grade', 'Status');

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
        } else {
          line.push('—');
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
    link.setAttribute('download', `Result_Slip_Scoreboard_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <RequireAuth>
      <DashboardLayout>
        {/* Page Header */}
        <div className="page-header flex-header">
          <div>
            <h1>🔗 Combine & Merge Exam Results</h1>
            <p>
              Consolidate Test & Exam scores into final subject folders, and select final subject folders to publish official <strong>Statements of Result</strong>.
            </p>
          </div>
          <Link href="/grading" className="btn-outline">
            ← Back to Grading Dashboard
          </Link>
        </div>

        {/* Workflow Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            marginBottom: 24,
            borderBottom: '2px solid #e2e8f0',
            paddingBottom: 0,
            overflowX: 'auto',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('combine')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'combine' ? '3px solid #4f46e5' : '3px solid transparent',
              padding: '12px 18px',
              fontWeight: 700,
              fontSize: 15,
              color: activeTab === 'combine' ? '#4f46e5' : '#64748b',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s',
            }}
          >
            <span>🔀</span>
            <span>Step 1: Combine Folders into Final Subject</span>
            {finalFolders.length > 0 && (
              <span
                style={{
                  background: activeTab === 'combine' ? '#e0e7ff' : '#f1f5f9',
                  color: activeTab === 'combine' ? '#4338ca' : '#475569',
                  padding: '2px 8px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {finalFolders.length} Created
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('publish')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'publish' ? '3px solid #059669' : '3px solid transparent',
              padding: '12px 18px',
              fontWeight: 700,
              fontSize: 15,
              color: activeTab === 'publish' ? '#059669' : '#64748b',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s',
            }}
          >
            <span>🎓</span>
            <span>Step 2: Publish Results & Result Slips</span>
            {publishedReports.length > 0 && (
              <span
                style={{
                  background: activeTab === 'publish' ? '#d1fae5' : '#f1f5f9',
                  color: activeTab === 'publish' ? '#047857' : '#475569',
                  padding: '2px 8px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {publishedReports.length} Published
              </span>
            )}
          </button>
        </div>

        {/* Global Notices */}
        {consolidateSuccess && (
          <div
            style={{
              background: '#ecfdf5',
              color: '#047857',
              border: '1px solid #a7f3d0',
              padding: '14px 18px',
              borderRadius: 8,
              marginBottom: 20,
              fontWeight: 600,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div>{consolidateSuccess}</div>
            {activeTab === 'combine' && finalFolders.length > 0 && (
              <button
                type="button"
                className="btn-sm btn-primary"
                onClick={() => setActiveTab('publish')}
                style={{ background: '#059669', borderColor: '#059669' }}
              >
                Proceed to Step 2: Publish Result Slips ➔
              </button>
            )}
          </div>
        )}

        {consolidateError && (
          <div className="alert alert-error" style={{ marginBottom: 20 }}>
            {consolidateError}
          </div>
        )}

        {publishedNotice && (
          <div
            className="alert alert-success"
            style={{
              marginBottom: 20,
              background: '#ecfdf5',
              color: '#047857',
              border: '1px solid #a7f3d0',
              padding: 16,
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 500,
            }}
          >
            {publishedNotice}
          </div>
        )}

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: STEP 1: COMBINE FOLDERS INTO A NEW FINAL SUBJECT FOLDER */}
        {/* ========================================================================= */}
        {activeTab === 'combine' && (
          <div>
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                padding: '16px 20px',
                borderRadius: 10,
                marginBottom: 24,
                display: 'flex',
                gap: 14,
                alignItems: 'flex-start',
              }}
            >
              <div style={{ fontSize: 24 }}>💡</div>
              <div style={{ fontSize: 14, color: '#334155', lineHeight: 1.6 }}>
                <strong>How Combining Folders Works:</strong>
                <br />
                Select two folders for a subject (e.g., <strong>Physics Test (30%)</strong> and <strong>Physics Exam (70%)</strong>) to create a consolidated <strong>Physics Final Score</strong> folder containing each student's combined score.
                <br />
                Repeat this process for other subjects such as <strong>Chemistry</strong>, <strong>Biology</strong>, and <strong>Mathematics</strong>. The original folders and scores remain preserved.
              </div>
            </div>

            <div className="panel" style={{ marginBottom: 24 }}>
              <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>🔀 Combine Folders into New Final Subject Folder</h2>
                <span className="badge blue" style={{ fontSize: 12 }}>
                  Scale: 100%
                </span>
              </div>

              <div className="panel-body">
                {loadingExams ? (
                  <p className="helper">Loading exam folders…</p>
                ) : (
                  <form onSubmit={handlePreviewConsolidate}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 20 }}>
                      <div>
                        <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
                          Subject / Course Name:
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          value={subjectName}
                          onChange={(e) => handleSubjectChange(e.target.value)}
                          placeholder="e.g. Physics, Chemistry, Mathematics"
                          required
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15 }}
                        />
                        <span style={{ fontSize: 12, color: '#64748b' }}>The academic subject or skill name</span>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
                          New Final Subject Folder Title:
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          value={finalTitle}
                          onChange={(e) => setFinalTitle(e.target.value)}
                          placeholder="e.g. Physics Final Score"
                          required
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, fontWeight: 600 }}
                        />
                        <span style={{ fontSize: 12, color: '#64748b' }}>The name of the new folder that stores the combined scores</span>
                      </div>
                    </div>

                    <div style={{ marginBottom: 16, fontWeight: 700, fontSize: 14, color: '#1e293b' }}>
                      Select Folders to Combine & Assign Percentage Weights:
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                      {combineItems.map((item, index) => (
                        <div
                          key={index}
                          style={{
                            display: 'flex',
                            gap: 12,
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            background: '#f8fafc',
                            padding: '14px 16px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <span style={{ fontWeight: 700, minWidth: 80, color: '#334155' }}>Folder #{index + 1}:</span>
                          <select
                            style={{ flex: 1, minWidth: 240, padding: '10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }}
                            value={item.examId}
                            onChange={(e) => updateCombineItem(index, 'examId', e.target.value)}
                            required
                          >
                            <option value="">-- Select Exam / Test Folder --</option>
                            {exams.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.category === 'FINAL' ? '🎯 [FINAL] ' : e.isManual ? '📝 [Manual] ' : '📁 '}
                                {e.title} {e.subject ? `[${e.subject}]` : ''} ({e.isManual ? `Scale: ${e.maxScale || 100}%` : `${e._count?.questions ?? 0} Qs`})
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
                              style={{ width: 80, padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', textAlign: 'center', fontWeight: 700 }}
                              value={item.weight}
                              onChange={(e) => updateCombineItem(index, 'weight', e.target.value)}
                              required
                            />
                            <span style={{ fontWeight: 700 }}>%</span>
                          </div>

                          {combineItems.length > 2 && (
                            <button
                              type="button"
                              className="btn-sm btn-danger"
                              onClick={() => removeCombineItem(index)}
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
                        <button type="button" className="btn-sm btn-outline" onClick={addCombineItem}>
                          + Add Another Folder
                        </button>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 14,
                            padding: '6px 12px',
                            borderRadius: 6,
                            background: Math.abs(totalCombineWeight - 100) < 0.1 ? '#ecfdf5' : '#fef2f2',
                            color: Math.abs(totalCombineWeight - 100) < 0.1 ? '#047857' : '#b91c1c',
                          }}
                        >
                          Total Weight: {totalCombineWeight}% {Math.abs(totalCombineWeight - 100) >= 0.1 && '(Must equal 100%)'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="submit"
                          className="btn-outline"
                          disabled={loadingCombinePreview || Math.abs(totalCombineWeight - 100) >= 0.1}
                          style={{ padding: '10px 18px', fontWeight: 600 }}
                        >
                          {loadingCombinePreview ? 'Calculating…' : 'Preview Consolidated Scores 📊'}
                        </button>

                        <button
                          type="button"
                          className="btn-primary"
                          disabled={savingConsolidate || Math.abs(totalCombineWeight - 100) >= 0.1 || !finalTitle.trim()}
                          onClick={handleSaveConsolidatedFolder}
                          style={{
                            background: 'linear-gradient(135deg, #4338ca, #6366f1)',
                            padding: '10px 20px',
                            fontWeight: 700,
                            borderRadius: 8,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          {savingConsolidate ? 'Creating Folder…' : `💾 Create "${finalTitle.trim() || 'Final Subject'}" Folder`}
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Live Preview Table of Consolidated Scores */}
            {combinePreview && (
              <div className="panel" style={{ marginBottom: 28 }}>
                <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h2>Consolidated Scores Preview ({combinePreview.rows.length} Students)</h2>
                    <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                      Folder: "{finalTitle || subjectName || 'Consolidated Subject'}"
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={savingConsolidate || !finalTitle.trim()}
                    onClick={handleSaveConsolidatedFolder}
                    style={{ background: '#10b981', borderColor: '#10b981', fontWeight: 700 }}
                  >
                    {savingConsolidate ? 'Saving…' : `Confirm & Create "${finalTitle || 'Final'}" Folder`}
                  </button>
                </div>

                <div className="panel-body no-pad">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Matric No.</th>
                        {combinePreview.folders.map((f) => (
                          <th key={f.id}>
                            {f.title}
                            <br />
                            <span style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 500 }}>
                              Weight: {f.weight}%
                            </span>
                          </th>
                        ))}
                        <th>Consolidated Score</th>
                        <th>Grade</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {combinePreview.rows.length === 0 ? (
                        <tr>
                          <td colSpan={combinePreview.folders.length + 5} style={{ textAlign: 'center', padding: 24, color: 'var(--gray-500)' }}>
                            No student scores found in the selected folders.
                          </td>
                        </tr>
                      ) : (
                        combinePreview.rows.map((row) => (
                          <tr key={row.user.id}>
                            <td>
                              <strong>{row.user.name || row.user.email}</strong>
                              <br />
                              <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{row.user.email}</span>
                            </td>
                            <td>
                              <span style={{ fontWeight: 600 }}>{row.user.matricNumber || '—'}</span>
                            </td>
                            {combinePreview.folders.map((f) => {
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
                              <span className={`badge ${row.status === 'Passed' ? 'green' : row.status === 'Failed' ? 'red' : 'orange'}`}>
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

            {/* List of Already Created Final Subject Folders */}
            <div className="panel" style={{ marginBottom: 32 }}>
              <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h2>🎯 Consolidated Final Subject Folders ({finalFolders.length})</h2>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                    These consolidated folders store final subject scores for each student. Once created, select them in Step 2 to generate result slips.
                  </p>
                </div>
                {finalFolders.length > 0 && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setActiveTab('publish')}
                    style={{ background: '#059669', borderColor: '#059669', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <span>🎓</span> Proceed to Publish Result Slips
                  </button>
                )}
              </div>

              <div className="panel-body no-pad">
                {finalFolders.length === 0 ? (
                  <div style={{ padding: '32px 20px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                    <p style={{ margin: 0, fontWeight: 600 }}>No final subject folders have been created yet.</p>
                    <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                      Use the form above to combine folders (e.g. Physics Test + Exam) to create your first final subject folder.
                    </p>
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Final Folder Title</th>
                        <th>Subject</th>
                        <th>Description / Source</th>
                        <th>Target Scale</th>
                        <th>Assigned Students</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {finalFolders.map((f) => (
                        <tr key={f.id}>
                          <td>
                            <strong>{f.title}</strong>
                            <div style={{ fontSize: 12, color: '#6366f1', fontWeight: 600 }}>Folder ID: #{f.id}</div>
                          </td>
                          <td>
                            <span className="badge blue" style={{ fontWeight: 700 }}>
                              {f.subject || 'General'}
                            </span>
                          </td>
                          <td style={{ fontSize: 13, color: '#475569', maxWidth: 300 }}>
                            {f.description || 'Consolidated final score'}
                          </td>
                          <td>
                            <strong>{f.maxScale || 100}%</strong>
                          </td>
                          <td>{f._count?.assignments ?? f.assignments?.length ?? '—'} students</td>
                          <td>
                            <span className={`badge ${f.resultsPublished ? 'green' : 'gray'}`}>
                              {f.resultsPublished ? 'Published' : 'Draft'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <Link href={`/exams/${f.id}/grading`} className="btn-sm btn-outline">
                                View Scores
                              </Link>
                              <button
                                type="button"
                                className="btn-sm btn-danger"
                                disabled={deletingFolderId === f.id}
                                onClick={() => handleDeleteFinalFolder(f.id, f.title)}
                              >
                                {deletingFolderId === f.id ? 'Deleting…' : 'Delete'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: STEP 2: PUBLISH RESULTS / STATEMENT OF RESULTS */}
        {/* ========================================================================= */}
        {activeTab === 'publish' && (
          <div>
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                padding: '16px 20px',
                borderRadius: 10,
                marginBottom: 24,
                display: 'flex',
                gap: 14,
                alignItems: 'flex-start',
              }}
            >
              <div style={{ fontSize: 24 }}>🎓</div>
              <div style={{ fontSize: 14, color: '#166534', lineHeight: 1.6 }}>
                <strong>Step 2: Generate Official Statement of Result / Result Slip:</strong>
                <br />
                Select the final subject folders (e.g. <strong>Physics Final Score</strong>, <strong>Chemistry Final Score</strong>, <strong>Biology Final Score</strong>, <strong>Mathematics Final Score</strong>) to include on the official result slip.
                <br />
                The system retrieves each student's final scores from the selected folders and generates their official Statements of Result.
              </div>
            </div>

            <div className="panel" style={{ marginBottom: 24 }}>
              <div className="panel-header">
                <h2>Select Final Subject Folders & Configure Statement Details</h2>
              </div>
              <div className="panel-body">
                {loadingExams ? (
                  <p className="helper">Loading exam folders…</p>
                ) : (
                  <form onSubmit={generatePublishReport}>
                    {/* Program metadata */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
                      <div>
                        <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
                          Program / Fellowship Name:
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          value={reportTitle}
                          onChange={(e) => setReportTitle(e.target.value)}
                          placeholder="e.g. Women in AI Fellowship 2025"
                          required
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
                          Executive Director Name (Signature):
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          value={directorName}
                          onChange={(e) => setDirectorName(e.target.value)}
                          placeholder="e.g. Bakare Nafisat Opeyemi"
                          required
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
                          Issued Date (Fixed on Statement):
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          value={issueDate}
                          onChange={(e) => setIssueDate(e.target.value)}
                          placeholder="e.g. 9th September, 2025"
                          required
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15 }}
                          title="Editable fixed date that will appear on the printed Statement of Result"
                        />
                      </div>
                    </div>

                    {/* Final Subject Folders Selector */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                        <label style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>
                          Select Final Subject Folders to Include on Result Slip:
                        </label>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <button type="button" className="btn-sm btn-outline" onClick={selectAllFinalFolders}>
                            Select All Final Folders
                          </button>
                          <button type="button" className="btn-sm btn-outline" onClick={deselectAllPublishFolders}>
                            Deselect All
                          </button>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>Weighting:</span>
                            <button
                              type="button"
                              className={`btn-sm ${weightMode === 'equal' ? 'btn-primary' : 'btn-outline'}`}
                              onClick={() => {
                                setWeightMode('equal');
                                if (publishItems.length > 0) {
                                  const equalW = Math.round((100 / publishItems.length) * 10) / 10;
                                  setPublishItems((prev) => prev.map((i) => ({ ...i, weight: equalW })));
                                }
                              }}
                              style={weightMode === 'equal' ? { background: '#059669', borderColor: '#059669' } : {}}
                            >
                              Equal (Mean)
                            </button>
                            <button
                              type="button"
                              className={`btn-sm ${weightMode === 'custom' ? 'btn-primary' : 'btn-outline'}`}
                              onClick={() => setWeightMode('custom')}
                              style={weightMode === 'custom' ? { background: '#4338ca', borderColor: '#4338ca' } : {}}
                            >
                              Custom Weights
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Checkbox grid for final folders */}
                      {finalFolders.length > 0 ? (
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: 12,
                            padding: 16,
                            background: '#f8fafc',
                            borderRadius: 10,
                            border: '1px solid #e2e8f0',
                            marginBottom: 16,
                          }}
                        >
                          {finalFolders.map((f) => {
                            const isChecked = publishItems.some((i) => i.examId === String(f.id));
                            return (
                              <label
                                key={f.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10,
                                  background: isChecked ? '#eff6ff' : '#ffffff',
                                  border: isChecked ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                                  padding: '10px 14px',
                                  borderRadius: 8,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleFinalFolderSelection(String(f.id))}
                                  style={{ width: 18, height: 18, accentColor: '#3b82f6' }}
                                />
                                <div style={{ overflow: 'hidden' }}>
                                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {f.title}
                                  </div>
                                  <div style={{ fontSize: 12, color: '#6366f1', fontWeight: 600 }}>
                                    Subject: {f.subject || 'General'}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ padding: '14px 18px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 8, marginBottom: 16, color: '#b45309', fontSize: 14 }}>
                          ⚠️ No final subject folders created yet. You can combine folders in <strong>Step 1</strong>, or select from all available exam folders below.
                        </div>
                      )}

                      {/* Detailed selected items list with weights */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                        {publishItems.map((item, index) => {
                          const folder = exams.find((e) => String(e.id) === String(item.examId));
                          return (
                            <div
                              key={index}
                              style={{
                                display: 'flex',
                                gap: 12,
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                background: '#f8fafc',
                                padding: '12px 16px',
                                borderRadius: 8,
                                border: '1px solid #e2e8f0',
                              }}
                            >
                              <span style={{ fontWeight: 700, minWidth: 80, color: '#334155' }}>
                                Subject #{index + 1}:
                              </span>
                              <select
                                style={{ flex: 1, minWidth: 240, padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }}
                                value={item.examId}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPublishItems((prev) => {
                                    const next = [...prev];
                                    next[index] = { ...next[index], examId: val };
                                    return next;
                                  });
                                }}
                                required
                              >
                                <option value="">-- Select Folder --</option>
                                {exams.map((e) => (
                                  <option key={e.id} value={e.id}>
                                    {e.category === 'FINAL' ? '🎯 [FINAL] ' : e.isManual ? '📝 [Manual] ' : '📁 '}
                                    {e.title} {e.subject ? `[${e.subject}]` : ''}
                                  </option>
                                ))}
                              </select>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <label style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Weight %:</label>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={0.1}
                                  disabled={weightMode === 'equal'}
                                  style={{
                                    width: 80,
                                    padding: '6px 8px',
                                    borderRadius: 6,
                                    border: '1px solid #d1d5db',
                                    textAlign: 'center',
                                    fontWeight: 700,
                                    background: weightMode === 'equal' ? '#f1f5f9' : '#ffffff',
                                  }}
                                  value={item.weight}
                                  onChange={(e) => updatePublishItemWeight(index, parseFloat(e.target.value) || 0)}
                                  required
                                />
                                <span style={{ fontWeight: 700 }}>%</span>
                              </div>

                              <button
                                type="button"
                                className="btn-sm btn-danger"
                                onClick={() => removePublishItem(index)}
                                style={{ marginLeft: 'auto' }}
                              >
                                Remove
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <button type="button" className="btn-sm btn-outline" onClick={addCustomPublishFolder}>
                            + Add Another Folder
                          </button>
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: 14,
                              padding: '6px 12px',
                              borderRadius: 6,
                              background: Math.abs(totalPublishWeight - 100) < 0.2 ? '#ecfdf5' : '#fef2f2',
                              color: Math.abs(totalPublishWeight - 100) < 0.2 ? '#047857' : '#b91c1c',
                            }}
                          >
                            Total Weight: {Math.round(totalPublishWeight * 10) / 10}% {Math.abs(totalPublishWeight - 100) >= 0.2 && '(Must equal 100%)'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                          <button
                            type="submit"
                            className="btn-outline"
                            disabled={loadingReport || publishItems.length === 0}
                            style={{ padding: '10px 18px', fontWeight: 600 }}
                          >
                            {loadingReport ? 'Calculating…' : 'Generate Scoreboard Preview 📊'}
                          </button>

                          <button
                            type="button"
                            className="btn-primary"
                            style={{
                              background: isOwner ? '#10b981' : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                              borderColor: isOwner ? '#10b981' : '#4f46e5',
                              padding: '10px 20px',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                              borderRadius: 8,
                            }}
                            disabled={publishing || loadingReport || publishItems.length === 0}
                            onClick={generateAndPublish}
                          >
                            {publishing
                              ? isOwner
                                ? 'Publishing…'
                                : 'Sending Request…'
                              : isOwner
                              ? '📢 Publish Combined Results to Students'
                              : '📩 Request Superadmin to Publish Results'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Scoreboard Preview Table */}
            {report && (
              <div className="panel" style={{ marginBottom: 32 }}>
                <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h2>Combined Assessment Scoreboard ({report.rows.length} Students)</h2>
                    <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>Program: "{reportTitle}"</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{
                        background: isOwner ? '#10b981' : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                        borderColor: isOwner ? '#10b981' : '#4f46e5',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                      onClick={generateAndPublish}
                      disabled={publishing}
                    >
                      {publishing
                        ? isOwner
                          ? 'Publishing…'
                          : 'Sending Request…'
                        : isOwner
                        ? '📢 Publish Report to Students'
                        : '📩 Request Superadmin to Publish'}
                    </button>
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
                            {f.subject || f.title}
                            <br />
                            <span style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 500 }}>
                              {f.title} ({f.weight != null ? Number(f.weight).toFixed(1) : ''}%)
                            </span>
                          </th>
                        ))}
                        <th>Cumulative Average</th>
                        <th>Grade</th>
                        <th>Status</th>
                        <th>Statement of Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.length === 0 ? (
                        <tr>
                          <td colSpan={report.folders.length + 6} style={{ textAlign: 'center', padding: 24, color: 'var(--gray-500)' }}>
                            No students found in the selected folders.
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
                                      <strong style={{ fontSize: 14 }}>{scoreObj.percent.toFixed(1)}%</strong>
                                      <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                                        {getStatementGrade(scoreObj.percent)}
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
                            <td>
                              <button
                                type="button"
                                className="btn-sm btn-outline"
                                onClick={() => setSelectedStudentForStatement(row)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}
                              >
                                📄 View / Print Result Slip
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Official Statement of Result / Result Slip Modal */}
            {selectedStudentForStatement && report && (
              <div className="modal-overlay" onClick={() => setSelectedStudentForStatement(null)}>
                <div
                  className="modal modal-lg printable-modal-content"
                  onClick={(e) => e.stopPropagation()}
                  style={{ maxWidth: 860, background: '#ffffff', borderRadius: 12, padding: '24px 20px', maxHeight: '95vh', overflowY: 'auto' }}
                >
                  <StatementOfResult
                    student={selectedStudentForStatement.user}
                    programName={reportTitle || 'Women in AI Fellowship 2025'}
                    skillSets={report.folders.map((f) => {
                      const scoreObj = selectedStudentForStatement.folderScores[f.id];
                      const p = scoreObj && scoreObj.percent != null ? scoreObj.percent : null;
                      const rawSubject = (f.subject || '').trim();
                      const rawTitle = (f.title || '').trim();
                      let skillName = rawTitle;
                      if (rawSubject && rawSubject !== '.' && rawSubject !== '-') {
                        if (!rawTitle.toLowerCase().includes(rawSubject.toLowerCase())) {
                          skillName = `${rawSubject} — ${rawTitle}`;
                        }
                      }
                      return {
                        name: skillName,
                        score: p,
                        grade: getStatementGrade(p),
                      };
                    })}
                    cumulativeAverage={selectedStudentForStatement.totalCombined}
                    overallGrade={selectedStudentForStatement.totalCombined != null ? getStatementGrade(selectedStudentForStatement.totalCombined) : null}
                    directorName={directorName}
                    issueDate={issueDate}
                    canEditDate={true}
                    onClose={() => setSelectedStudentForStatement(null)}
                  />
                </div>
              </div>
            )}

            {/* Pending Publish Requests (Awaiting Superadmin Approval) */}
            <div className="panel" style={{ marginBottom: 28, border: '1px solid #fed7aa' }}>
              <div className="panel-header" style={{ background: '#fffbeb', borderBottom: '1px solid #fed7aa' }}>
                <h2 style={{ color: '#9a3412', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                  <span>⏳</span> Pending Publish Requests (Awaiting Superadmin Approval) ({pendingRequests.length})
                </h2>
              </div>
              <div className="panel-body no-pad">
                {loadingPending ? (
                  <p className="helper" style={{ padding: 20 }}>Loading pending publish requests…</p>
                ) : pendingRequests.length === 0 ? (
                  <p className="helper" style={{ padding: 20 }}>No pending publish requests at this time.</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Report Title</th>
                        <th>Subjects & Folders Combined</th>
                        <th>Requested By</th>
                        <th>Requested Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingRequests.map((req) => (
                        <tr key={req.id}>
                          <td>
                            <strong>{req.title}</strong>
                            {req.descriptionText && <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{req.descriptionText}</div>}
                          </td>
                          <td>
                            {Array.isArray(req.items)
                              ? req.items.map((item) => `${item.title || `Folder ${item.examId}`} (${item.weight}%)`).join(' + ')
                              : '—'}
                          </td>
                          <td>
                            <strong>{req.requesterName || req.creator?.name || req.creator?.email || 'Admin'}</strong>
                          </td>
                          <td>{new Date(req.requestedAt).toLocaleDateString()}</td>
                          <td>
                            <span className="badge orange">⏳ Pending Superadmin Approval</span>
                          </td>
                          <td>
                            <div className="btn-group" style={{ display: 'flex', gap: 6 }}>
                              {isOwner && (
                                <button
                                  type="button"
                                  className="btn-sm btn-success"
                                  onClick={() => approvePendingRequest(req.id, req.title)}
                                >
                                  ✅ Approve & Publish
                                </button>
                              )}
                              {(isOwner || req.createdBy === user?.id) && (
                                <button
                                  type="button"
                                  className="btn-sm btn-outline"
                                  onClick={() => rejectPendingRequest(req.id, req.title)}
                                >
                                  {isOwner ? '❌ Reject' : 'Cancel Request'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

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
                        <th>Subjects & Folders Combined</th>
                        <th>Statement Issue Date</th>
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
                          <td>
                            <span style={{ fontWeight: 600, color: '#312e81' }}>{p.issueDate || '9th September, 2025'}</span>
                          </td>
                          <td>{p.creator?.name || p.creator?.email || 'Superadmin'}</td>
                          <td>{new Date(p.publishedAt).toLocaleDateString()}</td>
                          <td>
                            {isOwner ? (
                              <button
                                type="button"
                                className="btn-sm btn-danger"
                                onClick={() => deletePublishedReport(p.id, p.title)}
                              >
                                Unpublish / Delete
                              </button>
                            ) : (
                              <span className="badge green">Published</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </RequireAuth>
  );
}
