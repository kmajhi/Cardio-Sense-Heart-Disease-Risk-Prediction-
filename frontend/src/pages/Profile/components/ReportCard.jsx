const dayFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const LEVELS = { low: 'Low risk', moderate: 'Moderate risk', high: 'High risk' };

/** "Health report": a mini preview of the report sheet, with download, print and share. */
export default function ReportCard({ profile, latest, onDownload, onPrint, onShare }) {
  const pct = latest ? Math.round(latest.result.probability * 100) : null;

  return (
    <section className="pc-p-card pc-p-report pc-enter" style={{ '--d': '480ms' }} aria-labelledby="p-report-title">
      <div className="pc-p-report-text">
        <h2 id="p-report-title" className="pc-p-tile-title">
          Health report
        </h2>
        <p className="pc-p-muted">
          Your profile, latest risk estimate and its history on one page. Download it, save it as a PDF, or share a
          summary.
        </p>

        <div className="pc-p-report-actions">
          <button type="button" className="pc-p-btn pc-p-btn--primary" onClick={onDownload}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Download report
          </button>
          <button type="button" className="pc-p-btn pc-p-btn--soft" onClick={onPrint}>
            Save as PDF
          </button>
          <button type="button" className="pc-p-btn pc-p-btn--soft" onClick={onShare}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="18" cy="5" r="2.5" />
              <circle cx="6" cy="12" r="2.5" />
              <circle cx="18" cy="19" r="2.5" />
              <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
            </svg>
            Share
          </button>
        </div>
      </div>

      {/* A tiny paper version of the report; it lifts and tilts on hover. */}
      <div className="pc-p-sheet" aria-hidden="true">
        <span className="pc-p-sheet-brand">Cardio Sense</span>
        <span className="pc-p-sheet-title">
          Health <b>report</b>
        </span>
        <span className="pc-p-sheet-name">{profile.full_name}</span>
        <span className="pc-p-sheet-score">
          {pct === null ? '—' : `${pct}%`}
          <small>{latest ? LEVELS[latest.result.risk_level] : 'No estimate yet'}</small>
        </span>
        <span className="pc-p-sheet-lines">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="pc-p-sheet-date">{dayFmt.format(new Date())}</span>
      </div>
    </section>
  );
}
