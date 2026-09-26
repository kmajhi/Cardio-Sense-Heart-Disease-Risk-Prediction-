import { useEffect, useRef } from 'react';

/**
 * A native <dialog> opened with showModal(): focus is trapped, Escape and the
 * backdrop close it, and the page behind is inert. Content only mounts while
 * open, so the title id is never duplicated.
 */
export default function Modal({ open, onClose, title, subtitle, children, size = 'md', tone }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const onCancel = (e) => {
    e.preventDefault(); // keep React in charge of `open`
    onClose();
  };

  // A click on the ::backdrop lands on the dialog element itself.
  const onClick = (e) => {
    if (e.target === ref.current) onClose();
  };

  return (
    <dialog
      ref={ref}
      className={`pc-p-modal pc-p-modal--${size}${tone ? ` is-${tone}` : ''}`}
      aria-labelledby="pc-p-modal-title"
      onCancel={onCancel}
      onClick={onClick}
    >
      {open && (
        <div className="pc-p-modal-body">
          <header className="pc-p-modal-head">
            <div>
              <h2 id="pc-p-modal-title">{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
            <button type="button" className="pc-p-icon-btn" onClick={onClose} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
              </svg>
            </button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  );
}
