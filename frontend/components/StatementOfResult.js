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
  issueDate = null,
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
    window.print();
  };

  return (
    <div className="statement-of-result-wrapper">
      {showActions && (
        <div className="statement-actions no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, width: '100%', maxWidth: 800, marginBottom: 18 }}>
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
      <div className="statement-sheet">
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
                    return (
                      <tr key={index}>
                        <td className="skill-name-cell">{skill.name}</td>
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
            {/* Left Signature: Executive Director */}
            <div className="signature-col left-sig">
              <div className="signature-rule" />
              <div className="signer-name">{directorName}</div>
              <div className="signer-title">{directorTitle}</div>
            </div>

            {/* Right Signature: Date (Editable and Fixed) */}
            <div className="signature-col right-sig">
              <input
                type="text"
                className="issue-date-input"
                value={currentDate}
                onChange={(e) => setCurrentDate(e.target.value)}
                placeholder="e.g. 9th September, 2025"
                title="Click to edit issued date"
              />
              <div className="signature-rule" />
              <div className="date-label">Date</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
