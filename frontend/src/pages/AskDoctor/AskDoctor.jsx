import { useEffect, useId, useState } from 'react';
import NavBar from '../../components/NavBar';
import SiteFooter from '../../components/SiteFooter';
import { linkProps } from '../../components/link';
import { timeAgo } from '../../notifications/time';
import { RISK, pctText } from '../../clinical/risk';
import { MAX_QUESTION, TOPICS, addRequest, cancelRequest, loadRequests } from './requests';
import '../Dashboard/Dashboard.css'; // shared tokens, nav, load sequence
import './AskDoctor.css';

const ICONS = {
  doctor: 'M6 3v6a5 5 0 0 0 10 0V3M11 14v2a5 5 0 0 0 10 0v-2M21 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  warn: 'M12 3 3 19h18L12 3ZM12 10v4M12 17h.01',
  send: 'M4 12 20 4l-6 16-3-7-7-1Z',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  check: 'M5 12l5 5 9-10',
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

const STEPS = [
  ['Choose an assessment', 'Pick the estimate you want a doctor to look at. Its test values go with your question.'],
  ['Ask your question', 'Say what you’d like to understand: the result, a value, your diet or your medicines.'],
  ['A doctor reviews it', 'A qualified doctor reads the assessment and replies here, and in your PDF report.'],
];

/**
 * Cardio Sense — Ask a Doctor: send one of your assessments to a doctor with a question.
 *
 * Demo phase: requests are kept in this browser (requests.js) and stay pending,
 * since there is no doctor side yet.
 *
 * Props
 * - records:  the user's assessments, oldest first (same as <History />).
 * - account:  the signed-in email, so each account keeps its own requests.
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
  const ids = { assessment: useId(), question: useId(), consent: useId() };
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const newestFirst = [...records].reverse();
  const [requests, setRequests] = useState(() => loadRequests(account));
  const [assessment, setAssessment] = useState(newestFirst[0]?.id ?? '');
  const [topic, setTopic] = useState(TOPICS[0].id);
  const [question, setQuestion] = useState('');
  const [consent, setConsent] = useState(false);
  const [sent, setSent] = useState(false);

  // Records arrive after the first render on a slow connection.
  const newestId = records.at(-1)?.id;
  useEffect(() => {
    if (!assessment && newestId) setAssessment(newestId);
  }, [assessment, newestId]);

  const chosen = records.find((r) => r.id === assessment);
  const canSend = Boolean(chosen) && question.trim().length >= 10 && consent;

  const submit = (e) => {
    e.preventDefault();
    if (!canSend) return;
    setRequests(addRequest(account, { assessment, topic, question }));
    setQuestion('');
    setConsent(false);
    setSent(true);
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
              New question
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
                  onChange={(e) => setAssessment(e.target.value)}
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
                  Your question
                </label>
                <textarea
                  id={ids.question}
                  className="pc-ask-input pc-ask-textarea"
                  rows={5}
                  maxLength={MAX_QUESTION}
                  placeholder="e.g. My LDL is high. Is that the main reason for my risk, and what should I change first?"
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
                    Send to a doctor
                  </button>
                  {sent && (
                    <p className="pc-ask-sent" role="status">
                      <Icon name="check" size={16} />
                      Request sent. It’s waiting for a doctor’s review.
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
            <p className="pc-ask-demo">
              <b>Demo version.</b> Doctor review isn’t live yet: requests are saved in this browser only and stay
              pending.
            </p>
          </aside>
        </div>

        <section className="pc-ask-card pc-enter" style={{ '--d': '360ms' }} aria-labelledby="ask-list">
          <h2 id="ask-list" className="pc-ask-card-title">
            Your requests
          </h2>
          {requests.length === 0 ? (
            <p className="pc-ask-none">No questions yet. The ones you send will show here with the doctor’s reply.</p>
          ) : (
            <ul className="pc-ask-list">
              {requests.map((r) => (
                <li key={r.id} className="pc-ask-item">
                  <div className="pc-ask-item-head">
                    <span className="pc-ask-status">
                      <Icon name="clock" size={14} />
                      Pending review
                    </span>
                    <span className="pc-ask-meta">
                      {TOPICS.find((t) => t.id === r.topic)?.label ?? 'Question'} · Assessment {r.assessment} ·{' '}
                      <time dateTime={r.created_at} title={new Date(r.created_at).toLocaleString()}>
                        {timeAgo(r.created_at)}
                      </time>
                    </span>
                  </div>
                  <p className="pc-ask-question">{r.question}</p>
                  <button
                    type="button"
                    className="pc-ask-btn pc-ask-btn--soft pc-ask-btn--sm"
                    onClick={() => setRequests(cancelRequest(account, r.id))}
                  >
                    Withdraw
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="pc-ask-disclaimer pc-enter" style={{ '--d': '400ms' }}>
          <Icon name="doctor" size={16} />
          Research prototype. A doctor’s reply is general advice based on the values you entered. It doesn’t replace an
          in-person consultation, and the risk figure is a model estimate, not a diagnosis.
        </p>
      </main>
      <SiteFooter LinkComponent={LinkComponent} activePath={activePath} />
    </div>
  );
}
