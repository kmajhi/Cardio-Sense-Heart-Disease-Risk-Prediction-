// The console's command palette (Ctrl/⌘ K): jump to a section, find a user or an
// assessment, or run a common action, all from the keyboard.
import { useEffect, useMemo, useRef, useState } from 'react';
import { admin } from '../../api/adminApi';
import { Avatar, Icon, Kbd, RiskBadge, fmtPct, useDebounced } from './ui';

/** Lower-case words of `text` all start somewhere in `target`? (cheap fuzzy match) */
const matches = (text, target) => {
  const t = target.toLowerCase();
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => t.includes(w));
};

export default function CommandPalette({ open, onClose, sections, actions, onSection, onUser, onAssessment }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [found, setFound] = useState({ users: [], assessments: [] });
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const search = useDebounced(q.trim(), 180);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setFound({ users: [], assessments: [] });
    }
  }, [open]);

  useEffect(() => {
    if (!open || search.length < 2) {
      setFound({ users: [], assessments: [] });
      return undefined;
    }
    let alive = true;
    setSearching(true);
    admin
      .search(search)
      .then((r) => alive && setFound(r))
      .catch(() => alive && setFound({ users: [], assessments: [] }))
      .finally(() => alive && setSearching(false));
    return () => {
      alive = false;
    };
  }, [search, open]);

  // One flat list of items, grouped for display.
  const groups = useMemo(() => {
    const out = [];
    const nav = sections.filter((s) => !q || matches(q, `${s.label} ${s.group} go`));
    if (nav.length) out.push({ title: 'Go to', items: nav.map((s) => ({ id: `s-${s.id}`, icon: s.icon, label: s.label, hint: s.group, keys: s.keys, run: () => onSection(s.id) })) });
    const acts = actions.filter((a) => !q || matches(q, `${a.label} ${a.words ?? ''}`));
    if (acts.length) out.push({ title: 'Actions', items: acts.map((a) => ({ id: `a-${a.id}`, icon: a.icon, label: a.label, keys: a.keys, run: a.run })) });
    if (found.users.length)
      out.push({
        title: 'Users',
        items: found.users.map((u) => ({ id: `u-${u.id}`, avatar: u, label: u.name, hint: u.email, run: () => onUser(u.id) })),
      });
    if (found.assessments.length)
      out.push({
        title: 'Assessments',
        items: found.assessments.map((a) => ({
          id: `r-${a.id}`,
          icon: 'assessments',
          label: `${a.id} · ${fmtPct(a.probability)}`,
          hint: a.email || 'no account',
          badge: <RiskBadge level={a.risk_level} />,
          run: () => onAssessment(a.id),
        })),
      });
    return out;
  }, [q, sections, actions, found, onSection, onUser, onAssessment]);
  const flat = groups.flatMap((g) => g.items);

  useEffect(() => setActive(0), [q, found]);
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const choose = (item) => {
    onClose();
    item?.run();
  };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (flat.length ? (i + 1) % flat.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(flat[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let index = -1;
  return (
    <div className="cx-cmdk-layer">
      <button type="button" className="cx-drawer-scrim" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <div className="cx-cmdk" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="cx-cmdk-input">
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search users, assessments (A-0012), pages or actions…"
            role="combobox"
            aria-expanded="true"
            aria-controls="cx-cmdk-list"
            aria-activedescendant={flat[active] ? `cmdk-${flat[active].id}` : undefined}
          />
          {searching && <span className="cx-spinner" aria-hidden="true" />}
          <Kbd>Esc</Kbd>
        </div>
        <div className="cx-cmdk-list" id="cx-cmdk-list" role="listbox" ref={listRef}>
          {flat.length === 0 && <p className="cx-cmdk-empty">{search.length >= 2 && !searching ? `Nothing matches “${q}”.` : 'Type to search.'}</p>}
          {groups.map((g) => (
            <div key={g.title} className="cx-cmdk-group" role="group" aria-label={g.title}>
              <p className="cx-cmdk-title">{g.title}</p>
              {g.items.map((item) => {
                index += 1;
                const i = index;
                return (
                  <div
                    key={item.id}
                    id={`cmdk-${item.id}`}
                    role="option"
                    aria-selected={i === active}
                    data-active={i === active}
                    className="cx-cmdk-item"
                    onMouseMove={() => setActive(i)}
                    onClick={() => choose(item)}
                  >
                    {item.avatar ? <Avatar name={item.avatar.name} email={item.avatar.email} size={24} /> : <Icon name={item.icon} size={17} />}
                    <span className="cx-cmdk-label">{item.label}</span>
                    {item.hint && <span className="cx-cmdk-hint">{item.hint}</span>}
                    {item.badge}
                    {item.keys && (
                      <span className="cx-cmdk-keys">
                        {item.keys.map((k) => (
                          <Kbd key={k}>{k}</Kbd>
                        ))}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <footer className="cx-cmdk-foot">
          <span>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> to move
          </span>
          <span>
            <Kbd>Enter</Kbd> to open
          </span>
          <span>
            <Kbd>?</Kbd> all shortcuts
          </span>
        </footer>
      </div>
    </div>
  );
}

/** The keyboard shortcut sheet (press ?). */
export function ShortcutsDialog({ open, onClose, sections }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
  const general = [
    [[mod, 'K'], 'Open the command palette'],
    [['/'], 'Search'],
    [['['], 'Collapse or expand the sidebar'],
    [['Shift', 'D'], 'Switch light / dark theme'],
    [['?'], 'Show this list'],
    [['Esc'], 'Close a panel or dialog'],
  ];
  return (
    <div className="cx-modal-layer">
      <button type="button" className="cx-drawer-scrim" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <div className="cx-modal cx-shortcuts" role="dialog" aria-modal="true" aria-labelledby="cx-keys-title">
        <header className="cx-shortcuts-head">
          <h2 id="cx-keys-title">Keyboard shortcuts</h2>
          <button type="button" className="cx-icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </header>
        <div className="cx-shortcuts-cols">
          <section>
            <h3 className="cx-h3">General</h3>
            <ul>
              {general.map(([keys, label]) => (
                <li key={label}>
                  <span>{label}</span>
                  <span>
                    {keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="cx-h3">Go to</h3>
            <ul>
              {sections.map((s) => (
                <li key={s.id}>
                  <span>{s.label}</span>
                  <span>
                    {s.keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
