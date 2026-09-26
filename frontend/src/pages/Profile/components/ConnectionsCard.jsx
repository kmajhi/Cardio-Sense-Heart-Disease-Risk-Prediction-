import { useEffect, useState } from 'react';
import Modal from './Modal';
import { BRAND_ICONS } from '../brands';
import { REAL_OAUTH, getProviders, startConnect } from '../../../api/connectApi';

export const SERVICES = [
  {
    id: 'gmail',
    name: 'Gmail',
    blurb: 'Link your Google account by its Gmail address.',
    handleLabel: 'Gmail address',
    placeholder: 'you@gmail.com',
    permissions: ['See your Gmail address'],
  },
  {
    id: 'x',
    name: 'X',
    blurb: 'Link your X account by its @username.',
    handleLabel: 'X username',
    placeholder: '@username',
    permissions: ['See your @username and public profile'],
  },
  {
    id: 'facebook',
    name: 'Facebook',
    blurb: 'Link your Facebook account by its name.',
    handleLabel: 'Facebook name',
    placeholder: 'Your name on Facebook',
    permissions: ['See your name and public profile'],
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    blurb: 'Link your LinkedIn account by its name.',
    handleLabel: 'LinkedIn name',
    placeholder: 'Your name on LinkedIn',
    permissions: ['See your name and email address'],
  },
];

const dayFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

/**
 * Linked accounts. With the Django API, Connect goes through the provider's
 * real sign-in and consent page (api/connectApi.js). Without it (mock mode,
 * static deploy) connecting is simulated and labelled as such.
 */
export default function ConnectionsCard({ connections, onConnect, onDisconnect }) {
  const [pending, setPending] = useState(null); // service being connected
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState({}); // which providers have keys on the server

  useEffect(() => {
    getProviders().then(setConfigured).catch(() => setConfigured({}));
  }, []);

  const available = (service) => !REAL_OAUTH || configured[service.id] === true;

  const start = (service) => {
    setPending(service);
    setHandle('');
    setBusy(false);
  };

  const confirm = async (e) => {
    e.preventDefault();
    setBusy(true);
    if (REAL_OAUTH) {
      startConnect(pending.id); // leaves the page; the server brings the user back to /profile
      return;
    }
    // Stands in for the provider's sign-in window and the token exchange.
    await new Promise((r) => setTimeout(r, 1100));
    await onConnect(pending.id, { handle: handle.trim(), connected_at: new Date().toISOString() });
    setPending(null);
  };

  const count = SERVICES.filter((s) => connections[s.id]).length;

  return (
    <section className="pc-p-card pc-p-connect pc-enter" style={{ '--d': '540ms' }} aria-labelledby="p-connect-title">
      <header className="pc-p-card-head">
        <h2 id="p-connect-title" className="pc-p-tile-title">
          Connected accounts
        </h2>
        <span className="pc-p-count">
          {count} of {SERVICES.length}
        </span>
      </header>

      <ul className="pc-p-services">
        {SERVICES.map((s, i) => {
          const link = connections[s.id];
          return (
            <li key={s.id} className={link ? 'is-on' : ''} style={{ '--i': i }}>
              <span className={`pc-p-brand is-${s.id}`}>{BRAND_ICONS[s.id]}</span>
              <span className="pc-p-service-text">
                <strong>{s.name}</strong>
                <span>
                  {link ? `${link.handle || 'Connected'} · since ${dayFmt.format(new Date(link.connected_at))}` : s.blurb}
                </span>
              </span>
              {link ? (
                <button type="button" className="pc-p-btn pc-p-btn--soft pc-p-btn--sm" onClick={() => onDisconnect(s.id)}>
                  Disconnect
                </button>
              ) : (
                <button type="button" className="pc-p-btn pc-p-btn--dark pc-p-btn--sm" onClick={() => start(s)}>
                  Connect
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="pc-p-hint">
        {REAL_OAUTH
          ? 'Connecting signs you in on the service’s own page. Only the account name is kept: nothing is posted or sent.'
          : 'Prototype: connections are simulated and stay in this browser. Nothing is sent to these services.'}
      </p>

      <Modal
        open={pending !== null}
        onClose={() => !busy && setPending(null)}
        title={pending ? `Connect ${pending.name}` : ''}
        subtitle="Cardio Sense will ask for:"
        size="sm"
      >
        {pending && (
          <form onSubmit={confirm} className="pc-p-connect-form">
            <span className={`pc-p-brand pc-p-brand--lg is-${pending.id}`}>{BRAND_ICONS[pending.id]}</span>
            <ul className="pc-p-perms">
              {pending.permissions.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            {REAL_OAUTH ? (
              <p className="pc-p-hint">
                {available(pending)
                  ? `You'll go to ${pending.name} to sign in and approve, then come back here. Cardio Sense never sees your password.`
                  : `${pending.name} sign-in isn't set up on this server yet. Add its app keys to backend/.env (see backend/README.md).`}
              </p>
            ) : (
              <>
                <label className="pc-p-label" htmlFor="connect-handle">
                  {pending.handleLabel} <span className="pc-p-muted">(optional)</span>
                </label>
                <input
                  id="connect-handle"
                  className="pc-p-input"
                  value={handle}
                  maxLength={80}
                  placeholder={pending.placeholder}
                  onChange={(e) => setHandle(e.target.value)}
                  disabled={busy}
                />
                <p className="pc-p-hint">Demo only: with the Django API this opens {pending.name}'s own sign-in page.</p>
              </>
            )}
            <div className="pc-p-modal-foot">
              <button type="button" className="pc-p-btn pc-p-btn--soft" onClick={() => setPending(null)} disabled={busy}>
                Cancel
              </button>
              <button
                type="submit"
                className={`pc-p-btn pc-p-btn--dark${busy ? ' is-busy' : ''}`}
                disabled={busy || !available(pending)}
              >
                {busy ? (REAL_OAUTH ? `Opening ${pending.name}…` : 'Connecting…') : `Continue with ${pending.name}`}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}
