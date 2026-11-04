import React, { useState, useEffect } from 'react';

/**
 * Helper to convert numerical score to Grade label according to the official scale:
 * 70 - 100 = Distinction
 * 60 - 69 = Credit
 * 50 - 59 = Pass
 * 0 - 49 = Fail
 */
export function getStatementGrade(score) {
  if (score == null || Number.isNaN(Number(score))) return '—';
  const num = Number(score);
  if (num >= 70) return 'Distinction';
  if (num >= 60) return 'Credit';
  if (num >= 50) return 'Pass';
  return 'Fail';
}

/**
 * Format date like "9th September, 2025"
 */
export function formatStatementDate(dateInput) {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return String(dateInput);

  const day = date.getDate();
  const month = date.toLocaleString('en-US', { month: 'long' });
  const year = date.getFullYear();

  const getOrdinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  return `${getOrdinal(day)} ${month}, ${year}`;
}

export default function StatementOfResult({
  student = {},
  programName = 'Women in AI Fellowship 2025',
  skillSets = [],
  cumulativeAverage = null,
  overallGrade = null,
  directorName = 'Bakare Nafisat Opeyemi',
  directorTitle = 'Executive Director',
  stampSignatureUrl = '/images/director-stamp-signature.png',
  issueDate = null,
  canEditDate = false,
  onClose = null,
  showActions = true,
}) {
  const studentName = (student?.name || student?.email || 'STUDENT NAME').toUpperCase();
  const matricNo = student?.matricNumber;

  const getInitialDate = (dateVal) => {
    if (!dateVal) return '9th September, 2025';
    if (typeof dateVal === 'string' && (dateVal.includes(' ') || dateVal.includes(','))) {
      return dateVal;
    }
    return formatStatementDate(dateVal) || '9th September, 2025';
  };

  const [currentDate, setCurrentDate] = useState(() => getInitialDate(issueDate));

  useEffect(() => {
    if (issueDate) {
      setCurrentDate(getInitialDate(issueDate));
    }
  }, [issueDate]);
  
  // Calculate average if not explicitly passed
  let computedAverage = cumulativeAverage;
  if (computedAverage == null && skillSets.length > 0) {
    const validScores = skillSets.filter((s) => s.score != null && !Number.isNaN(Number(s.score)));
    if (validScores.length > 0) {
      const sum = validScores.reduce((acc, curr) => acc + Number(curr.score), 0);
      computedAverage = sum / validScores.length;
    }
  }

  const finalGrade = overallGrade || (computedAverage != null ? getStatementGrade(computedAverage) : 'Distinction');

  const handlePrint = () => {
    const sheetEl = document.getElementById('statement-sheet-to-print');
    if (!sheetEl) {
      window.print();
      return;
    }

    // Remove any previously created print iframe
    const existingFrame = document.getElementById('statement-print-iframe');
    if (existingFrame && existingFrame.parentNode) {
      existingFrame.parentNode.removeChild(existingFrame);
    }

    const printFrame = document.createElement('iframe');
    printFrame.id = 'statement-print-iframe';
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    printFrame.style.visibility = 'hidden';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow.document;
    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Statement of Result - ${studentName}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm 10mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              width: 100%;
              background: #ffffff;
              color: #111827;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            }
            .statement-sheet {
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              border: none !important;
              box-shadow: none !important;
            }
            .statement-frame {
              border: 2px solid #0f172a !important;
              padding: 16px 20px !important;
              box-sizing: border-box !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              page-break-after: avoid !important;
              break-after: avoid !important;
              min-height: auto !important;
              height: auto !important;
            }
            .statement-brand-row {
              display: flex !important;
              justify-content: center !important;
              align-items: center !important;
              margin-bottom: 8px !important;
            }
            .statement-logo-box {
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              text-align: center !important;
            }
            .statement-logo-img {
              height: 52px !important;
              width: auto !important;
              max-width: 250px !important;
              object-fit: contain !important;
              display: block !important;
            }
            .statement-divider-thick {
              height: 2.5px !important;
              background: #0f172a !important;
              margin: 8px 0 6px !important;
              width: 100% !important;
            }
            .statement-divider-thin {
              height: 1.5px !important;
              background: #0f172a !important;
              margin: 6px 0 4px !important;
              width: 100% !important;
            }
            .statement-contact-bar {
              display: flex !important;
              justify-content: space-between !important;
              align-items: center !important;
              flex-wrap: wrap !important;
              gap: 6px !important;
              font-size: 10.5px !important;
              color: #1f2937 !important;
              padding: 0 !important;
            }
            .contact-item {
              display: inline-flex !important;
              gap: 4px !important;
            }
            .contact-label {
              font-weight: 700 !important;
            }
            .statement-address-block {
              text-align: right !important;
              font-size: 10px !important;
              color: #1f2937 !important;
              line-height: 1.3 !important;
              margin-top: 2px !important;
              margin-bottom: 8px !important;
            }
            .address-label {
              font-weight: 700 !important;
              display: block !important;
            }
            .statement-title-section {
              text-align: center !important;
              margin: 6px 0 8px !important;
            }
            .statement-main-title {
              font-size: 22px !important;
              font-weight: 900 !important;
              letter-spacing: 0.5px !important;
              color: #0f172a !important;
              margin: 0 0 3px !important;
              text-transform: uppercase !important;
            }
            .statement-certify-sub {
              font-size: 12.5px !important;
              color: #374151 !important;
              margin: 0 0 3px !important;
            }
            .statement-student-name {
              font-size: 18px !important;
              font-weight: 800 !important;
              color: #0f172a !important;
              letter-spacing: 0.8px !important;
              margin: 0 0 2px !important;
              text-transform: uppercase !important;
            }
            .statement-matric-sub {
              font-size: 11px !important;
              font-weight: 700 !important;
              color: #4b5563 !important;
              margin-bottom: 4px !important;
            }
            .statement-intro-paragraph {
              font-size: 11.5px !important;
              color: #1f2937 !important;
              max-width: 600px !important;
              margin: 4px auto !important;
              line-height: 1.35 !important;
            }
            .statement-results-lead {
              font-size: 11.5px !important;
              color: #1f2937 !important;
              margin: 4px 0 6px !important;
            }
            .statement-table-wrapper {
              margin: 6px auto 8px !important;
              width: 100% !important;
              max-width: 560px !important;
            }
            .statement-results-table {
              width: 100% !important;
              border-collapse: collapse !important;
              border: 1.5px solid #000000 !important;
              font-size: 11.5px !important;
            }
            .statement-results-table th,
            .statement-results-table td {
              border: 1.5px solid #000000 !important;
              padding: 5px 8px !important;
            }
            .statement-results-table th {
              background: #f3f4f6 !important;
              font-weight: 700 !important;
              color: #0f172a !important;
            }
            .statement-results-table .skill-name-cell {
              font-weight: 600 !important;
              color: #111827 !important;
            }
            .statement-results-table .score-cell {
              text-align: center !important;
              font-weight: 600 !important;
            }
            .statement-results-table .grade-cell {
              text-align: left !important;
              font-weight: 600 !important;
              color: #111827 !important;
            }
            .statement-results-table .cumulative-row td {
              font-weight: 800 !important;
              background: #f9fafb !important;
              padding: 6px 8px !important;
            }
            .statement-results-table .cumulative-label-cell {
              text-align: right !important;
              font-size: 12px !important;
              color: #0f172a !important;
            }
            .statement-results-table .cumulative-value-cell {
              text-align: center !important;
              font-size: 12.5px !important;
              color: #0f172a !important;
            }
            .statement-grading-scale {
              text-align: center !important;
              margin: 6px 0 8px !important;
              font-size: 10.5px !important;
              color: #1f2937 !important;
              line-height: 1.3 !important;
            }
            .grading-scale-heading {
              font-weight: 700 !important;
              font-size: 11px !important;
              margin-bottom: 2px !important;
            }
            .grading-scale-line {
              font-weight: 500 !important;
            }
            .statement-declaration-box {
              margin-top: 4px !important;
              text-align: left !important;
            }
            .statement-declaration-text {
              font-size: 10.5px !important;
              color: #1f2937 !important;
              line-height: 1.3 !important;
              margin: 0 !important;
            }
            .statement-signatures-section {
              display: flex !important;
              justify-content: space-between !important;
              align-items: flex-end !important;
              margin-top: 10px !important;
              padding-bottom: 0 !important;
            }
            .signature-col {
              text-align: center !important;
              min-width: 200px !important;
            }
            .signature-stamp-box {
              display: flex !important;
              align-items: flex-end !important;
              justify-content: center !important;
              min-height: 48px !important;
              margin-bottom: 2px !important;
            }
            .director-stamp-img {
              max-height: 50px !important;
              max-width: 145px !important;
              width: auto !important;
              height: auto !important;
              object-fit: contain !important;
              display: block !important;
            }
            .signature-date-spacer {
              display: flex !important;
              align-items: flex-end !important;
              justify-content: center !important;
              min-height: 48px !important;
              margin-bottom: 2px !important;
            }
            .signature-rule {
              width: 100% !important;
              border-bottom: 1.5px solid #111827 !important;
              margin-bottom: 4px !important;
            }
            .signer-name {
              font-size: 12px !important;
              font-weight: 800 !important;
              color: #0f172a !important;
            }
            .signer-title {
              font-size: 11px !important;
              color: #4b5563 !important;
            }
            .issue-date-text {
              font-size: 12px !important;
              font-weight: 700 !important;
              color: #0f172a !important;
              margin-bottom: 4px !important;
            }
            .date-label {
              font-size: 12px !important;
              font-weight: 800 !important;
              color: #0f172a !important;
            }
            .no-print {
              display: none !important;
            }
            .print-only {
              display: block !important;
            }
          </style>
        </head>
        <body>
          ${sheetEl.outerHTML}
        </body>
      </html>
    `);
    frameDoc.close();

    const triggerPrint = () => {
      setTimeout(() => {
        try {
          printFrame.contentWindow.focus();
          printFrame.contentWindow.print();
        } catch (err) {
          console.error('Print iframe error, fallback to window.print():', err);
          window.print();
        }
      }, 150);
    };

    const imgs = frameDoc.images;
    if (!imgs || imgs.length === 0) {
      triggerPrint();
    } else {
      let loaded = 0;
      const total = imgs.length;
      for (let i = 0; i < total; i++) {
        if (imgs[i].complete) {
          loaded++;
          if (loaded === total) triggerPrint();
        } else {
          imgs[i].onload = () => {
            loaded++;
            if (loaded === total) triggerPrint();
          };
          imgs[i].onerror = () => {
            loaded++;
            if (loaded === total) triggerPrint();
          };
        }
      }
    }
  };

  return (
    <div className="statement-of-result-wrapper">
      {showActions && (
        <div className="statement-actions no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, width: '100%', maxWidth: 800, marginBottom: 18 }}>
          {canEditDate ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>
                📅 Issued Date:
              </label>
              <input
                type="text"
                value={currentDate}
                onChange={(e) => setCurrentDate(e.target.value)}
                placeholder="e.g. 9th September, 2025"
                style={{
                  padding: '6px 10px',
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: '1px solid #d1d5db',
                  width: 190,
                  background: '#ffffff',
                }}
                title="Edit the fixed date that appears on the Statement of Result"
              />
            </div>
          ) : (
            <div style={{ fontSize: 13, fontWeight: 600, color: '#4b5563' }}>
              📅 Issued Date: <strong style={{ color: '#0f172a' }}>{currentDate}</strong>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: 700,
                background: '#0f172a',
                borderColor: '#0f172a',
                color: '#ffffff',
                borderRadius: 8,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(15,23,42,0.15)',
              }}
            >
              🖨️ Download / Print PDF
            </button>
            {onClose && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={onClose}
                style={{
                  padding: '10px 16px',
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                ✕ Close
              </button>
            )}
          </div>
        </div>
      )}

      {/* Printable Sheet Container */}
      <div className="statement-sheet" id="statement-sheet-to-print">
        {/* Document Outer Border Frame */}
        <div className="statement-frame">
          {/* Header Section */}
          <div className="statement-header">
            {/* Top Logo / Brand */}
            <div className="statement-brand-row">
              <div className="statement-logo-box">
                <img
                  src="/images/webfala-logo.png"
                  alt="Webfala Digital Skills for All Initiative"
                  className="statement-logo-img"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div className="statement-fallback-logo" style={{ display: 'none' }}>
                  <div className="fallback-logo-brand">
                    <span className="logo-badge-dark">wds</span>
                    <span className="logo-badge-light">fai</span>
                  </div>
                  <div className="logo-text-sub">WEBFALA DIGITAL SKILLS FOR ALL INITIATIVE</div>
                </div>
              </div>
            </div>

            {/* Horizontal Divider 1 */}
            <div className="statement-divider-thick" />

            {/* Contact Information Bar */}
            <div className="statement-contact-bar">
              <div className="contact-item">
                <span className="contact-label">Email:</span> info@webfalainitiative.org
              </div>
              <div className="contact-item">
                <span className="contact-label">Phone Number:</span> (+234)9067774136
              </div>
              <div className="contact-item">
                <span className="contact-label">Website:</span> www.webfalainitiative.org
              </div>
            </div>

            {/* Address Block (Right Aligned) */}
            <div className="statement-address-block">
              <span className="address-label">Address:</span>
              <div>No 4, Abidoye Laye, Flower Garden,</div>
              <div>Ilorin, Kwara State.</div>
            </div>
          </div>

          {/* Statement Main Title */}
          <div className="statement-title-section">
            <h1 className="statement-main-title">STATEMENT OF RESULT</h1>
            <p className="statement-certify-sub">This is to certify that</p>
            <h2 className="statement-student-name">{studentName}</h2>
            {matricNo && (
              <div className="statement-matric-sub">Matric No: {matricNo}</div>
            )}
            <p className="statement-intro-paragraph">
              a participant of the <strong>{programName}</strong>, has been duly assessed and examined
              in the underlisted skill sets, and has graduated with <strong>{finalGrade}</strong>.
            </p>
            <p className="statement-results-lead">Her results are recorded as follows:</p>
          </div>

          {/* Skill Sets Results Table */}
          <div className="statement-table-wrapper">
            <table className="statement-results-table">
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Skill Set</th>
                  <th style={{ width: '30%', textAlign: 'center' }}>Score (100)</th>
                  <th style={{ width: '30%', textAlign: 'left' }}>Grade</th>
                </tr>
              </thead>
              <tbody>
                {skillSets.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '24px', color: '#6b7280' }}>
                      No assessment results recorded for this participant.
                    </td>
                  </tr>
                ) : (
                  skillSets.map((skill, index) => {
                    const scoreNum = skill.score != null ? Number(skill.score) : null;
                    const displayScore = scoreNum != null ? (Number.isInteger(scoreNum) ? scoreNum : scoreNum.toFixed(1)) : '—';
                    const gradeText = skill.grade || (scoreNum != null ? getStatementGrade(scoreNum) : '—');
                    const cleanName = String(skill.name || '')
                      .replace(/^\s*\.\s*\((.*?)\)\s*$/, '$1')
                      .replace(/^\s*\.\s*/, '')
                      .trim();
                    return (
                      <tr key={index}>
                        <td className="skill-name-cell">{cleanName}</td>
                        <td className="score-cell">{displayScore}</td>
                        <td className="grade-cell">{gradeText}</td>
                      </tr>
                    );
                  })
                )}
                {/* Cumulative Average Row */}
                <tr className="cumulative-row">
                  <td className="cumulative-label-cell">Cumulative Average:</td>
                  <td colSpan={2} className="cumulative-value-cell">
                    {computedAverage != null
                      ? `${Number.isInteger(Number(computedAverage)) ? Number(computedAverage) : Number(computedAverage).toFixed(2)}%`
                      : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Grading Scale Legend */}
          <div className="statement-grading-scale">
            <div className="grading-scale-heading">Grading Scale</div>
            <div className="grading-scale-line">70 – 100 = Distinction</div>
            <div className="grading-scale-line">60 – 69 = Credit</div>
            <div className="grading-scale-line">50 – 59 = Pass</div>
            <div className="grading-scale-line">0 – 49 = Fail</div>
          </div>

          {/* Certification Bottom Declaration */}
          <div className="statement-declaration-box">
            <div className="statement-divider-thin" />
            <p className="statement-declaration-text">
              This Statement of Result is issued as a true record of her performance in the {programName}.
            </p>
          </div>

          {/* Signatures & Issue Date Footer */}
          <div className="statement-signatures-section">
            {/* Left Signature: Executive Director (Official Stamp & Signature) */}
            <div className="signature-col left-sig">
              <div className="signature-stamp-box">
                <img
                  src={stampSignatureUrl || '/images/director-stamp-signature.png'}
                  alt="Executive Director Stamp & Signature"
                  className="director-stamp-img"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
              <div className="signature-rule" />
              <div className="signer-name">{directorName}</div>
              <div className="signer-title">{directorTitle}</div>
            </div>

            {/* Right Signature: Date */}
            <div className="signature-col right-sig">
              <div className="signature-date-spacer">
                {canEditDate ? (
                  <>
                    <input
                      type="text"
                      className="issue-date-input no-print"
                      value={currentDate}
                      onChange={(e) => setCurrentDate(e.target.value)}
                      placeholder="e.g. 9th September, 2025"
                      title="Click to edit issued date"
                    />
                    <div className="issue-date-text print-only" style={{ display: 'none' }}>
                      {currentDate}
                    </div>
                  </>
                ) : (
                  <div className="issue-date-text">{currentDate}</div>
                )}
              </div>
              <div className="signature-rule" />
              <div className="date-label">Date</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
