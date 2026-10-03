import { Component, lazy } from 'react';

// ---------- Stale code after a redeploy ----------
//
// Pages are downloaded the first time they're opened (lazy chunks with hashed
// names). A tab opened before a redeploy still asks for the old names, which no
// longer exist, so the page would fail silently. One automatic reload fetches
// the new version; the flag stops a reload loop if the failure is something else.
const RELOADED_KEY = 'cardio-sense:reloaded-for-new-version';

const isChunkError = (err) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|ChunkLoadError/i.test(
    String(err?.message ?? err),
  );

function reloadOnce() {
  try {
    if (sessionStorage.getItem(RELOADED_KEY)) return false;
    sessionStorage.setItem(RELOADED_KEY, String(Date.now()));
  } catch {
    return false; // storage blocked: show the error screen instead of risking a loop
  }
  window.location.reload();
  return true;
}

// Vite fires this when a page's code or CSS can't be loaded.
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadOnce()) event.preventDefault();
  });
  // A page that loaded fine clears the flag, so a later redeploy can reload again.
  window.addEventListener('load', () => {
    setTimeout(() => {
      try {
        sessionStorage.removeItem(RELOADED_KEY);
      } catch {
        /* ignore */
      }
    }, 10_000);
  });
}

/** React.lazy that reloads once onto the new version when its chunk is gone. */
export function lazyPage(load) {
  return lazy(() =>
    load().catch((err) => {
      if (isChunkError(err) && reloadOnce()) return new Promise(() => {}); // the reload takes over
      throw err;
    }),
  );
}

// ---------- Anything else that breaks while drawing a page ----------

const box = {
  maxWidth: 460,
  margin: '12vh auto',
  padding: '28px 28px 24px',
  borderRadius: 20,
  background: '#fff',
  color: '#1c1633',
  boxShadow: '0 24px 60px -24px rgba(28,22,51,.4)',
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  lineHeight: 1.5,
};
const button = {
  padding: '10px 18px',
  border: 0,
  borderRadius: 999,
  background: '#1c1633',
  color: '#fff',
  font: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
};

/**
 * Shows what went wrong, with a way out, instead of a blank page. Inline styles
 * on purpose: it must work even when the page's own stylesheet failed to load.
 * Give it a `resetKey` (the URL path) so moving to another page clears it.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Cardio Sense: a page failed to render.', error, info?.componentStack);
    if (isChunkError(error)) reloadOnce();
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const stale = isChunkError(error);
    return (
      <div role="alert" style={{ minHeight: '100vh', padding: 16, background: '#f5f4f9' }}>
        <div style={box}>
          <h1 style={{ margin: '0 0 8px', fontSize: 22 }}>{stale ? 'A newer version is available' : 'This page couldn’t be shown'}</h1>
          <p style={{ margin: '0 0 18px', color: 'rgba(28,22,51,.72)', fontSize: 15 }}>
            {stale
              ? 'Cardio Sense was updated while this tab was open. Reload to get the latest version.'
              : 'Something went wrong while drawing this page. Reloading usually fixes it; if it keeps happening, tell the site’s administrator what you were doing.'}
          </p>
          {!stale && (
            <pre
              style={{
                margin: '0 0 18px',
                padding: '10px 12px',
                borderRadius: 10,
                background: '#f5f4f9',
                color: '#ad1f52',
                fontSize: 12.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {String(error?.message ?? error)}
            </pre>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" style={button} onClick={() => window.location.reload()}>
              Reload page
            </button>
            <button
              type="button"
              style={{ ...button, background: 'transparent', color: '#1c1633', boxShadow: 'inset 0 0 0 1px rgba(28,22,51,.2)' }}
              onClick={() => window.location.assign('/')}
            >
              Go to the homepage
            </button>
          </div>
        </div>
      </div>
    );
  }
}
