import { useEffect } from 'react';

/** One short status message at the bottom of the screen, with an optional action (e.g. Undo). */
export default function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(onDismiss, toast.action ? 7000 : 3500);
    return () => clearTimeout(id);
  }, [toast, onDismiss]);

  return (
    <div className="pc-p-toast-region" role="status" aria-live="polite">
      {toast && (
        <div className={`pc-p-toast${toast.tone ? ` is-${toast.tone}` : ''}`} key={toast.id}>
          <span className="pc-p-toast-dot" aria-hidden="true" />
          <span>{toast.text}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action.run();
                onDismiss();
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
