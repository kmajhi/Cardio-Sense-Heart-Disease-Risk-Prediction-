import { useRef, useState } from 'react';
import { REPORTS_AVAILABLE, downloadReport } from '../api/reportApi';
import { useNotifications } from '../notifications/NotificationsContext';
import './ReportButton.css';

/**
 * "Download PDF Health Report" for one saved assessment ({ id, inputs, result }).
 * One request at a time; says when it's working, done, or what went wrong.
 * The profile personalises the recommendations, as on the Guidance page.
 */
export default function ReportButton({ record, className = '' }) {
  const ctx = useNotifications();
  const [state, setState] = useState({ status: 'idle', message: '' });
  const busy = useRef(false);

  if (!record?.id) return null;

  const run = async () => {
    if (busy.current) return; // a double click never starts a second report
    busy.current = true;
    setState({ status: 'loading', message: '' });
    try {
      const { name, handedOff } = await downloadReport(record, ctx?.profile ?? null);
      setState({
        status: 'done',
        message: handedOff
          ? `${name} is downloading. If a download manager opens, save the file from there.`
          : `Downloaded ${name}.`,
      });
    } catch (err) {
      setState({ status: 'error', message: err?.message || 'The report couldn’t be created. Try again.' });
    } finally {
      busy.current = false;
    }
  };

  const loading = state.status === 'loading';
  return (
    <div className={`pc-report ${className}`}>
      <button
        type="button"
        className="pc-report-btn"
        onClick={run}
        disabled={loading || !REPORTS_AVAILABLE}
        aria-busy={loading}
        title={REPORTS_AVAILABLE ? undefined : 'Needs the Cardio Sense server (not available in demo mode)'}
      >
        {loading ? (
          <span className="pc-report-spin" aria-hidden="true" />
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" strokeLinejoin="round" />
            <path d="M14 3v5h5M12 11v6m0 0-2.5-2.5M12 17l2.5-2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {loading ? 'Preparing your report…' : 'Download PDF Health Report'}
      </button>
      <p className={`pc-report-msg is-${state.status}`} role={state.status === 'error' ? 'alert' : 'status'}>
        {!REPORTS_AVAILABLE
          ? 'PDF reports need the Cardio Sense server; they aren’t available in demo mode.'
          : state.message}
      </p>
    </div>
  );
}
