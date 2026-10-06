import { useCallback, useEffect, useId, useState } from 'react';
import NavBar from '../../components/NavBar';
import SiteFooter from '../../components/SiteFooter';
import { linkProps } from '../../components/link';
import { timeAgo } from '../../notifications/time';
import { useNotifications } from '../../notifications/NotificationsContext';
import { RISK, pctText } from '../../clinical/risk';
import { REVIEWS_LIVE, listReviews, requestReview, withdrawReview } from '../../api/reviewApi';
import { REPORTS_AVAILABLE, downloadReport } from '../../api/reportApi';
import { MAX_QUESTION, TOPICS, reviewSteps } from './requests';
import { isPhoto } from '../Profile/photo';
import '../Dashboard/Dashboard.css'; // shared tokens, nav, load sequence
import './AskDoctor.css';

const ICONS = {
  doctor: 'M6 3v6a5 5 0 0 0 10 0V3M11 14v2a5 5 0 0 0 10 0v-2M21 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  warn: 'M12 3 3 19h18L12 3ZM12 10v4M12 17h.01',
  send: 'M4 12 20 4l-6 16-3-7-7-1Z',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  check: 'M5 12l5 5 9-10',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
};

function Icon({ name, size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d={ICONS[name]} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const dateText = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeText = (iso) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const drName = (name = '') => (/^dr\.?\s/i.test(name) ? name : `Dr. ${name}`);

const STEPS = [
  ['Choose an assessment', 'Pick the estimate you want a doctor to look at. Its test values go with your request.'],
  ['Ask your question (optional)', 'Say what you’d like to understand: the result, a value, your diet or your medicines. Or just send the report.'],
  ['A doctor reviews it', 'A registered doctor reviews the assessment. Their remarks appear here and in your updated PDF report.'],
];

const OPEN = new Set(['pending', 'under_review']);

function ReviewTimeline({ request, assessmentDate }) {
  const steps = reviewSteps(request, assessmentDate);
  return (
    <ol className="pc-ask-timeline" aria-label="Review progress">
      {steps.map((s) => (
        <li key={s.label} className={s.when ? 'is-done' : undefined}>
          <span className="pc-ask-tl-dot" aria-hidden="true" />
          <span className="pc-ask-tl-label">
            {s.label}
            <span className="pc-ask-sr">{s.when ? ' (done)' : ' (not yet)'}</span>
          </span>
          {s.when && (
            <time className="pc-ask-tl-time" dateTime={s.when}>
              {dateTimeText(s.when)}
            </time>
          )}
        </li>
      ))}
    </ol>
  );
}

function RequestItem({ r, record, onWithdraw, onDownload, busy }) {
  const [showSummary, setShowSummary] = useState(false);
  const status =
    r.status === 'completed'
      ? { cls: 'is-done', icon: 'check', text: r.status_label }
      : r.status === 'under_review'
        ? { cls: 'is-active', icon: 'eye', text: 'Currently Under Review' }
        : { cls: '', icon: 'clock', text: 'Pending Doctor Review' };
  const doctor = r.review?.doctor ?? r.doctor;
  const latest = r.reports?.at(-1);
  return (
    <li className="pc-ask-item">
      <div className="pc-ask-item-head">
        <span className={`pc-ask-status ${status.cls}`}>
          <Icon name={status.icon} size={14} />
          {status.text}
        </span>
        <span className="pc-ask-meta">
          {TOPICS.find((t) => t.id === r.topic)?.label ?? 'Question'} · Assessment {r.assessment} ·{' '}
          <time dateTime={r.requested_at} title={new Date(r.requested_at).toLocaleString()}>
            {timeAgo(r.requested_at)}
          </time>
        </span>
      </div>
      {r.question && <p className="pc-ask-question">{r.question}</p>}

      {r.status === 'pending' && <p className="pc-ask-note">Your assessment has been submitted for clinical review.</p>}
      {r.status === 'under_review' && doctor && (
        <p className="pc-ask-note pc-ask-doc">
          {isPhoto(doctor.photo) && <img className="pc-ask-doc-photo" src={doctor.photo} alt="" width="28" height="28" />}
          Reviewed by <b>{drName(doctor.name)}</b>
          {doctor.specialty ? ` · ${doctor.specialty}` : ''}
        </p>
      )}
      {r.status === 'completed' && r.review && (
        <div className="pc-ask-done">
          <p className="pc-ask-done-title">
            {r.review.decision === 'needs_more_information' ? 'Your doctor needs more information' : 'Your clinical review is ready.'}
          </p>
          <p className="pc-ask-note">
            {isPhoto(doctor?.photo) && <img className="pc-ask-doc-photo" src={doctor.photo} alt="" width="28" height="28" />}
            Reviewed by <b>{drName(doctor?.name ?? '')}</b>
            {doctor?.specialty ? ` · ${doctor.specialty}` : ''} · {dateText(r.review.submitted_at)}
            <br />
            Decision: <b>{r.review.decision_label}</b>
          </p>
          {showSummary && (
            <div className="pc-ask-summary" id={`summary-${r.id}`}>
              <h3>Doctor’s remarks</h3>
              <p>{r.review.remarks}</p>
              <h3>Clinical action plan</h3>
              <p>{r.review.action_plan || 'No further action recorded.'}</p>
              <p className="pc-ask-fine">
                These are the reviewing doctor’s own words. The risk estimate and the app’s automated guidance are unchanged by the review.
              </p>
            </div>
          )}
        </div>
      )}

      <details className="pc-ask-progress">
        <summary>Review progress</summary>
        <ReviewTimeline request={r} assessmentDate={record?.created_at} />
      </details>

      <div className="pc-ask-row">
        {r.status === 'completed' && r.review && (
          <>
            <button type="button" className="pc-ask-btn pc-ask-btn--soft pc-ask-btn--sm" aria-expanded={showSummary} aria-controls={`summary-${r.id}`} onClick={() => setShowSummary((v) => !v)}>
              {showSummary ? 'Hide Clinical Summary' : 'View Clinical Summary'}
            </button>
            {REPORTS_AVAILABLE && record && latest?.reviewed && (
              <button type="button" className="pc-ask-btn pc-ask-btn--primary pc-ask-btn--sm" disabled={busy} onClick={() => onDownload(record)}>
                <Icon name="download" size={15} />
                {busy ? 'Preparing…' : 'Download Updated Report'}
              </button>
            )}
          </>
        )}
        {r.status === 'pending' && (
          <button type="button" className="pc-ask-btn pc-ask-btn--soft pc-ask-btn--sm" onClick={() => onWithdraw(r.id)}>
            Withdraw
          </button>
        )}
      </div>
    </li>
  );
}

/**
 * Cardio Sense — Ask a Doctor: send one of your assessments to a doctor with a
 * question, follow the review, and read the doctor's clinical summary.
 *
 * With the server, requests go to the doctors' review queue (api/reviewApi.js).
 * In demo mode they stay in this browser and stay pending.
 *
 * Props
 * - records:  the user's assessments, oldest first (same as <History />).
 * - account:  the signed-in email, so each account keeps its own (demo) requests.
 * - loadError, user, hasNotifications, LinkComponent, activePath: same as <History />.
 */
export default function AskDoctor({
  records = [],
  account = '',
  loadError = '',
  user = { name: 'Demo User' },
  hasNotifications = false,
  LinkComponent = 'a',
  activePath = '/ask-a-doctor',
}) {
  const L = LinkComponent;
  const ctx = useNotifications();
  const ids = { assessment: useId(), question: useId(), consent: useId() };
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const newestFirst = [...records].reverse();
  const [requests, setRequests] = useState(null);
  const [listError, setListError] = useState('');
  const [assessment, setAssessment] = useState(newestFirst[0]?.id ?? '');
  const [topic, setTopic] = useState(TOPICS[0].id);
  const [question, setQuestion] = useState('');
  const [consent, setConsent] = useState(false);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');

  const load = useCallback(
    () =>
      listReviews(account)
        .then((list) => {
          setRequests(list);
          setListError('');
        })
        .catch((err) => {
          setRequests((cur) => cur ?? []);
          setListError(err.message);
        }),
    [account],
  );
  useEffect(() => {
    load();
  }, [load]);

  // Records arrive after the first render on a slow connection.
  const newestId = records.at(-1)?.id;
  useEffect(() => {
    if (!assessment && newestId) setAssessment(newestId);
  }, [assessment, newestId]);

  const chosen = records.find((r) => r.id === assessment);
  const openForChosen = (requests ?? []).find((r) => r.assessment === assessment && OPEN.has(r.status));
  // The question is optional: a request can be just the report.
  const canSend = Boolean(chosen) && consent && !openForChosen && !sending;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSend) return;
    setSending(true);
    setError('');
    try {
      await requestReview(account, chosen, { topic, question }, ctx?.profile ?? null);
      setQuestion('');
      setConsent(false);
      setSent(true);
      await load();
    } catch (err) {
      setError(err.message || 'We couldn’t send your request. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const withdraw = async (id) => {
    try {
      await withdrawReview(account, id);
    } catch (err) {
      setListError(err.message);
    }
    load();
  };

  const download = async (record) => {
    setDownloading(record.id);
    try {
      await downloadReport(record, ctx?.profile ?? null);
    } catch (err) {
      setListError(err.message);
    } finally {
      setDownloading('');
    }
  };

  return (
    <div className={`pc-dash pc-ask${ready ? ' is-ready' : ''}`}>
      <NavBar user={user} hasNotifications={hasNotifications} activePath={activePath} LinkComponent={LinkComponent} />

      <main className="pc-ask-main">
        <header className="pc-ask-head">
          <h1 className="pc-ask-title">
            <span className="pc-wipe pc-thin" style={{ '--d': '120ms' }}>
              Ask a
            </span>{' '}
            <span className="pc-wipe pc-bold" style={{ '--d': '300ms' }}>
              doctor
            </span>
          </h1>
          <p className="pc-ask-sub pc-enter" style={{ '--d': '200ms' }}>
            Send one of your assessments to a doctor with a question, and get a professional opinion on your result.
          </p>
        </header>

        <p className="pc-ask-urgent pc-enter" style={{ '--d': '240ms' }} role="note">
          <Icon name="warn" />
          <span>
            <b>Chest pain, breathlessness or fainting right now?</b> Don’t wait for a reply here. Call your local
            emergency number or go to the nearest hospital.
          </span>
        </p>

        <div className="pc-ask-grid">
          <section className="pc-ask-card pc-enter" style={{ '--d': '280ms' }} aria-labelledby="ask-form">
            <h2 id="ask-form" className="pc-ask-card-title">
              Request a doctor review
            </h2>

            {newestFirst.length === 0 ? (
              <div className="pc-ask-empty" role={loadError ? 'alert' : undefined}>
                <p>
                  {loadError
                    ? `Couldn't load your assessments. Check that the API server is running, then reload. (${loadError})`
                    : 'A doctor needs an assessment to review. Run a prediction first, then come back to ask about it.'}
                </p>
                {!loadError && (
                  <L {...linkProps(L, '/prediction')} className="pc-ask-btn pc-ask-btn--primary">
                    Run a prediction
                  </L>
                )}
              </div>
            ) : (
              <form className="pc-ask-form" onSubmit={submit} noValidate>
                <label className="pc-ask-label" htmlFor={ids.assessment}>
                  Assessment
                </label>
                <select
                  id={ids.assessment}
                  className="pc-ask-input"
                  value={assessment}
                  onChange={(e) => {
                    setAssessment(e.target.value);
                    setSent(false);
                  }}
                >
                  {newestFirst.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} · {dateText(r.created_at)} · {pctText(r.result.probability)}% {RISK[r.result.risk_level]?.label ?? ''}
                    </option>
                  ))}
                </select>
                {chosen && (
                  <p className="pc-ask-chosen">
                    <span className={`pc-badge is-${chosen.result.risk_level}`}>{RISK[chosen.result.risk_level]?.label}</span>
                    {chosen.result.top_factors?.length > 0 && (
                      <span>Main factors: {chosen.result.top_factors.slice(0, 3).map((f) => f.name).join(', ')}</span>
                    )}
                  </p>
                )}
                {openForChosen && (
                  <p className="pc-ask-note" role="status">
                    This assessment already has a doctor review in progress ({openForChosen.status_label.toLowerCase()}).
                  </p>
                )}

                <fieldset className="pc-ask-topics">
                  <legend className="pc-ask-label">Topic</legend>
                  {TOPICS.map((t) => (
                    <label key={t.id} className={`pc-ask-chip${topic === t.id ? ' is-on' : ''}`}>
                      <input type="radio" name="topic" value={t.id} checked={topic === t.id} onChange={() => setTopic(t.id)} />
                      {t.label}
                    </label>
                  ))}
                </fieldset>

                <label className="pc-ask-label" htmlFor={ids.question}>
                  Your question <span className="pc-ask-optional">(optional)</span>
                </label>
                <textarea
                  id={ids.question}
                  className="pc-ask-input pc-ask-textarea"
                  rows={5}
                  maxLength={MAX_QUESTION}
                  placeholder="Optional. e.g. My LDL is high. Is that the main reason for my risk, and what should I change first?"
                  value={question}
                  onChange={(e) => {
                    setQuestion(e.target.value);
                    setSent(false);
                  }}
                />
                <p className="pc-ask-count">
                  {question.length}/{MAX_QUESTION}
                </p>

                <label className="pc-ask-consent" htmlFor={ids.consent}>
                  <input id={ids.consent} type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  <span>I understand this is not emergency care and a reply can take a few days.</span>
                </label>

                <div className="pc-ask-actions">
                  <button type="submit" className="pc-ask-btn pc-ask-btn--primary" disabled={!canSend}>
                    <Icon name="send" />
                    {sending ? 'Sending…' : 'Request Doctor Review'}
                  </button>
                  {sent && (
                    <p className="pc-ask-sent" role="status">
                      <Icon name="check" size={16} />
                      Request sent. Your assessment has been submitted for clinical review.
                    </p>
                  )}
                  {error && (
                    <p className="pc-ask-error" role="alert">
                      {error}
                    </p>
                  )}
                </div>
              </form>
            )}
          </section>

          <aside className="pc-ask-card pc-ask-how pc-enter" style={{ '--d': '320ms' }} aria-labelledby="ask-how">
            <h2 id="ask-how" className="pc-ask-card-title">
              How it works
            </h2>
            <ol className="pc-ask-steps">
              {STEPS.map(([title, text], i) => (
                <li key={title}>
                  <span className="pc-ask-step-n">{i + 1}</span>
                  <div>
                    <p className="pc-ask-step-title">{title}</p>
                    <p className="pc-ask-step-text">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
            {!REVIEWS_LIVE && (
              <p className="pc-ask-demo">
                <b>Demo version.</b> Doctor review needs the Cardio Sense server: here, requests are saved in this
                browser only and stay pending.
              </p>
            )}
          </aside>
        </div>

        <section className="pc-ask-card pc-enter" style={{ '--d': '360ms' }} aria-labelledby="ask-list">
          <h2 id="ask-list" className="pc-ask-card-title">
            Your requests
          </h2>
          {listError && (
            <p className="pc-ask-error" role="alert">
              {listError}
            </p>
          )}
          {requests === null ? (
            <p className="pc-ask-none">Loading your requests…</p>
          ) : requests.length === 0 ? (
            <p className="pc-ask-none">No review requests yet. The ones you send will show here with the doctor’s review.</p>
          ) : (
            <ul className="pc-ask-list">
              {requests.map((r) => (
                <RequestItem
                  key={r.id}
                  r={r}
                  record={records.find((x) => x.id === r.assessment)}
                  onWithdraw={withdraw}
                  onDownload={download}
                  busy={downloading === r.assessment}
                />
              ))}
            </ul>
          )}
        </section>

        <p className="pc-ask-disclaimer pc-enter" style={{ '--d': '400ms' }}>
          <Icon name="doctor" size={16} />
          Research prototype. A doctor’s review is based on the values you entered. It doesn’t replace an in-person
          consultation, and the risk figure is a model estimate, not a diagnosis.
        </p>
      </main>
      <SiteFooter LinkComponent={LinkComponent} activePath={activePath} />
    </div>
  );
}
