import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import { BRAND_ICONS } from '../brands';
import { buildShareText } from '../report';

const OPTIONS = [
  { key: 'level', label: 'Risk level (low / moderate / high)' },
  { key: 'percent', label: 'Risk percentage' },
  { key: 'trend', label: 'Change since my first check' },
  { key: 'bmi', label: 'BMI' },
];

const enc = encodeURIComponent;

// Each network's public share link. Facebook and LinkedIn only take a URL,
// so the text is copied to the clipboard first for the user to paste.
const TARGETS = [
  { id: 'x', label: 'X', href: (t, u) => `https://x.com/intent/tweet?text=${enc(t)}&url=${enc(u)}` },
  { id: 'facebook', label: 'Facebook', copyFirst: true, href: (t, u) => `https://www.facebook.com/sharer/sharer.php?u=${enc(u)}` },
  { id: 'linkedin', label: 'LinkedIn', copyFirst: true, href: (t, u) => `https://www.linkedin.com/sharing/share-offsite/?url=${enc(u)}` },
  { id: 'whatsapp', label: 'WhatsApp', href: (t, u) => `https://wa.me/?text=${enc(`${t} ${u}`)}` },
  {
    id: 'gmail',
    label: 'Gmail',
    href: (t, u) => `https://mail.google.com/mail/?view=cm&fs=1&su=${enc('My Cardio Sense heart health summary')}&body=${enc(`${t}\n\n${u}`)}`,
  },
  { id: 'email', label: 'Email', href: (t, u) => `mailto:?subject=${enc('My Cardio Sense heart health summary')}&body=${enc(`${t}\n\n${u}`)}` },
];

/**
 * Share a short summary. Health data is personal, so nothing beyond the risk
 * level is included unless the user ticks it, and the text stays editable.
 */
export default function ShareDialog({ open, onClose, profile, records, reportFile, notify }) {
  const latest = records.at(-1);
  const [include, setInclude] = useState({ level: true, percent: false, trend: false, bmi: false });
  const generated = useMemo(
    () => buildShareText(profile, latest, { ...include, records }),
    [profile, latest, include, records],
  );
  const [text, setText] = useState(generated);
  useEffect(() => setText(generated), [generated]);
  const url = `${window.location.origin}/`;

  const copy = async (message = 'Copied to clipboard.') => {
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      notify(message);
      return true;
    } catch {
      notify("Couldn't copy. Select the text and copy it yourself.", 'error');
      return false;
    }
  };

  const canShareFile = useMemo(() => {
    try {
      return Boolean(reportFile && navigator.canShare?.({ files: [reportFile()] }));
    } catch {
      return false;
    }
  }, [reportFile]);

  const nativeShare = async () => {
    const data = { title: 'My Cardio Sense summary', text, url };
    if (canShareFile) data.files = [reportFile()];
    try {
      await navigator.share(data);
    } catch (err) {
      if (err?.name !== 'AbortError') notify("This device couldn't open its share sheet.", 'error');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Share your health summary" subtitle="Choose what to include. You can edit the text before sharing.">
      <div className="pc-p-share">
        <fieldset className="pc-p-checks">
          <legend className="pc-p-eyebrow">Include</legend>
          {OPTIONS.map((o) => (
            <label key={o.key}>
              <input
                type="checkbox"
                checked={include[o.key]}
                onChange={(e) => setInclude((v) => ({ ...v, [o.key]: e.target.checked }))}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </fieldset>

        <label className="pc-p-label" htmlFor="share-text">
          Post text
        </label>
        <textarea id="share-text" className="pc-p-input pc-p-textarea" rows={3} value={text} maxLength={260} onChange={(e) => setText(e.target.value)} />
        <p className="pc-p-hint">
          {text.length}/260 · Your name, lab values and contacts are never added. Posts are public on most networks.
        </p>

        <ul className="pc-p-share-grid">
          {TARGETS.map((t) => (
            <li key={t.id}>
              <a
                className={`pc-p-share-btn is-${t.id}`}
                href={t.href(text, url)}
                target={t.id === 'email' ? undefined : '_blank'}
                rel="noopener noreferrer"
                onClick={() => {
                  if (t.copyFirst) copy(`Text copied. Paste it into your ${t.label} post.`);
                }}
              >
                <span className="pc-p-share-icon">{BRAND_ICONS[t.id]}</span>
                {t.label}
              </a>
            </li>
          ))}
          <li>
            <button type="button" className="pc-p-share-btn is-copy" onClick={() => copy()}>
              <span className="pc-p-share-icon">{BRAND_ICONS.copy}</span>
              Copy text
            </button>
          </li>
          {typeof navigator !== 'undefined' && navigator.share && (
            <li>
              <button type="button" className="pc-p-share-btn is-device" onClick={nativeShare}>
                <span className="pc-p-share-icon">{BRAND_ICONS.device}</span>
                {canShareFile ? 'More (with report)' : 'More…'}
              </button>
            </li>
          )}
        </ul>
      </div>
    </Modal>
  );
}
