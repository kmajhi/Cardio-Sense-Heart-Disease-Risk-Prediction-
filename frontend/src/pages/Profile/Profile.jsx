import { useCallback, useEffect, useRef, useState } from 'react';
import NavBar from '../Dashboard/components/NavBar';
import { historyMock } from '../History/historyMock';
import { deleteProfile, getProfile, saveProfile } from '../../api/profileApi';
import IdentityCard from './components/IdentityCard';
import HealthTiles from './components/HealthTiles';
import ProfileForm from './components/ProfileForm';
import ReportCard from './components/ReportCard';
import ConnectionsCard, { SERVICES } from './components/ConnectionsCard';
import ShareDialog from './components/ShareDialog';
import Modal from './components/Modal';
import Toast from './components/Toast';
import PhotoCropper from './components/PhotoCropper';
import { EMPTY_PROFILE, clean, validate } from './profileFields';
import { buildReportHtml, reportFileName } from './report';
import '../Dashboard/Dashboard.css'; // shared tokens, nav, load sequence, page wipe
import './Profile.css';

const updatedFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Cardio Sense — Profile page: basic health information (create, edit,
 * delete), the downloadable health report, sharing, and linked accounts.
 *
 * Props
 * - records:         assessments for the report, oldest first (History's shape).
 *                    Defaults to historyMock.js until the API exists.
 * - onProfileChange: called with the saved profile (or null) so the app can
 *                    update the name in the nav.
 * - user, hasNotifications, LinkComponent, activePath: same as <Dashboard />.
 */
export default function Profile({
  records = historyMock,
  onProfileChange = () => {},
  user = { name: 'Demo User' },
  hasNotifications = false,
  LinkComponent = 'a',
  activePath = '/profile',
}) {
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [profile, setProfile] = useState(null);
  const [mode, setMode] = useState('view'); // view | edit
  const [draft, setDraft] = useState(EMPTY_PROFILE);
  const [errors, setErrors] = useState({});
  const [triedSave, setTriedSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [toast, setToast] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const boardRef = useRef(null);

  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const notify = useCallback((text, tone, action) => setToast({ id: Date.now(), text, tone, action }), []);
  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    let alive = true;
    getProfile()
      .then((p) => {
        if (!alive) return;
        setProfile(p ? { ...EMPTY_PROFILE, ...p } : null);
        setStatus('ready');
      })
      .catch(() => alive && setStatus('error'));
    return () => {
      alive = false;
    };
  }, []);

  // Re-check while typing once a save has been tried, so errors clear as they're fixed.
  useEffect(() => {
    if (triedSave) setErrors(validate(draft));
  }, [draft, triedSave]);

  const commit = async (next, message) => {
    const saved = await saveProfile(next);
    const merged = { ...EMPTY_PROFILE, ...saved };
    setProfile(merged);
    onProfileChange(merged);
    if (message) notify(message, 'ok');
    return merged;
  };

  const startEdit = () => {
    setDraft(profile ?? EMPTY_PROFILE);
    setErrors({});
    setTriedSave(false);
    setMode('edit');
    requestAnimationFrame(() => {
      boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('pf-full_name')?.focus({ preventScroll: true });
    });
  };

  const cancelEdit = () => {
    setMode('view');
    setErrors({});
  };

  const submit = async (e) => {
    e.preventDefault();
    setTriedSave(true);
    const found = validate(draft);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(`pf-${first}`)?.focus();
      return;
    }
    setSaving(true);
    try {
      await commit(clean(draft), profile ? 'Profile updated.' : 'Profile created.');
      setMode('view');
    } catch (err) {
      notify(err.message || "Couldn't save. Try again.", 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeProfile = async () => {
    const backup = profile;
    setConfirmDelete(false);
    try {
      await deleteProfile();
      setProfile(null);
      onProfileChange(null);
      setMode('view');
      notify('Profile deleted.', 'error', {
        label: 'Undo',
        run: () => commit(backup, 'Profile restored.').catch(() => notify("Couldn't restore it.", 'error')),
      });
    } catch (err) {
      notify(err.message || "Couldn't delete. Try again.", 'error');
    }
  };

  const setConnection = async (id, link) => {
    const connections = { ...profile.connections };
    if (link) connections[id] = link;
    else delete connections[id];
    const name = SERVICES.find((s) => s.id === id)?.name;
    try {
      await commit({ ...profile, connections }, link ? `${name} connected.` : `${name} disconnected.`);
    } catch (err) {
      notify(err.message || "Couldn't update the connection.", 'error');
    }
  };

  // The camera button on the ID card: frame the new image, then save right away.
  const [cropSource, setCropSource] = useState(null);
  const onCropError = useCallback((message) => {
    setCropSource(null);
    notify(message, 'error');
  }, [notify]);

  const applyPhoto = async (photo) => {
    setCropSource(null);
    setPhotoBusy(true);
    try {
      await commit({ ...profile, photo }, profile.photo ? 'Photo updated.' : 'Photo added.');
    } catch (err) {
      notify(err.message || "Couldn't update the photo.", 'error');
    } finally {
      setPhotoBusy(false);
    }
  };

  const reportHtml = () => buildReportHtml(profile, records);
  const reportFile = useCallback(
    () => new File([buildReportHtml(profile, records)], reportFileName(), { type: 'text/html' }),
    [profile, records],
  );

  const download = () => {
    const url = URL.createObjectURL(new Blob([reportHtml()], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = reportFileName();
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Report downloaded.', 'ok');
  };

  const printPdf = () => {
    const win = window.open('', '_blank');
    if (!win) {
      notify('Allow pop-ups for this site to save the report as a PDF.', 'error');
      return;
    }
    win.document.write(reportHtml());
    win.document.close();
    let printed = false;
    const print = () => {
      if (printed || win.closed) return;
      printed = true;
      win.focus();
      win.print();
    };
    win.addEventListener('load', print, { once: true });
    setTimeout(print, 600); // some browsers never fire load for document.write
  };

  const editing = mode === 'edit';
  const shown = editing ? draft : profile ?? EMPTY_PROFILE;

  return (
    <div className={`pc-dash pc-profile${ready ? ' is-ready' : ''}`}>
      <NavBar user={user} hasNotifications={hasNotifications} activePath={activePath} LinkComponent={LinkComponent} />

      <main className="pc-p-main">
        <header className="pc-p-head">
          <div>
            <h1 className="pc-p-title">
              <span className="pc-wipe pc-thin" style={{ '--d': '120ms' }}>
                Your
              </span>{' '}
              <span className="pc-wipe pc-bold" style={{ '--d': '300ms' }}>
                profile
              </span>
            </h1>
            <p className="pc-p-sub pc-enter" style={{ '--d': '200ms' }}>
              Basic health information for your reports and predictions.
              {profile?.updated_at && ` Last updated ${updatedFmt.format(new Date(profile.updated_at))}.`}
            </p>
          </div>
          {profile && !editing && (
            <div className="pc-p-head-actions pc-enter" style={{ '--d': '260ms' }}>
              <button type="button" className="pc-p-btn pc-p-btn--glass" onClick={download}>
                Download report
              </button>
              <button type="button" className="pc-p-btn pc-p-btn--glass" onClick={() => setSharing(true)}>
                Share
              </button>
            </div>
          )}
        </header>

        {status === 'loading' && <div className="pc-p-board pc-p-skeleton" aria-busy="true" aria-label="Loading profile" />}

        {status === 'error' && (
          <p className="pc-p-empty-note" role="alert">
            Couldn't load your profile. Refresh the page to try again.
          </p>
        )}

        {status === 'ready' && (
          <section className="pc-p-board" ref={boardRef} aria-label="Profile">
            <IdentityCard
              profile={shown}
              ready={ready}
              editing={editing || !profile}
              onEdit={startEdit}
              onDelete={() => setConfirmDelete(true)}
              onPhoto={profile ? (file) => file && setCropSource(file) : undefined}
              photoBusy={photoBusy}
            />

            {/* Keyed on the mode so every switch glides the new content in. */}
            <div className="pc-p-swap" key={editing ? 'edit' : profile ? 'view' : 'empty'}>
              {editing ? (
                <ProfileForm
                  draft={draft}
                  setDraft={setDraft}
                  errors={errors}
                  saving={saving}
                  isNew={!profile}
                  onSubmit={submit}
                  onCancel={cancelEdit}
                />
              ) : profile ? (
                <HealthTiles profile={profile} />
              ) : (
                <div className="pc-p-welcome pc-enter" style={{ '--d': '260ms' }}>
                  <span className="pc-p-welcome-badge">New</span>
                  <h2>Set up your health profile</h2>
                  <p className="pc-p-muted">
                    Keep your basics in one place. They fill your health report and can prefill predictions later.
                  </p>
                  <ul className="pc-p-welcome-list">
                    <li>Personal details, height, weight and blood group</li>
                    <li>Medical history, lifestyle, medications and allergies</li>
                    <li>A downloadable report you can share or print</li>
                  </ul>
                  <button type="button" className="pc-p-btn pc-p-btn--primary" onClick={startEdit}>
                    Create profile
                    <span className="pc-hero-cta-arrow" aria-hidden="true">
                      →
                    </span>
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {status === 'ready' && profile && !editing && (
          <div className="pc-p-row">
            <ReportCard
              profile={profile}
              latest={records.at(-1)}
              onDownload={download}
              onPrint={printPdf}
              onShare={() => setSharing(true)}
            />
            <ConnectionsCard
              connections={profile.connections}
              onConnect={setConnection}
              onDisconnect={(id) => setConnection(id, null)}
            />
          </div>
        )}

        <p className="pc-p-privacy pc-enter" style={{ '--d': '600ms' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Z" strokeLinejoin="round" />
          </svg>
          Research prototype. Your profile is stored only in this browser until accounts are available. Risk figures are
          model estimates, not diagnoses.
        </p>
      </main>

      {profile && (
        <ShareDialog
          open={sharing}
          onClose={() => setSharing(false)}
          profile={profile}
          records={records}
          reportFile={reportFile}
          notify={notify}
        />
      )}

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete your profile?"
        subtitle="Your details, medications and connected accounts will be removed from this device."
        size="sm"
        tone="danger"
      >
        <div className="pc-p-modal-foot">
          <button type="button" className="pc-p-btn pc-p-btn--soft" onClick={() => setConfirmDelete(false)}>
            Keep profile
          </button>
          <button type="button" className="pc-p-btn pc-p-btn--danger" onClick={removeProfile}>
            Delete profile
          </button>
        </div>
      </Modal>

      <PhotoCropper source={cropSource} onApply={applyPhoto} onCancel={() => setCropSource(null)} onError={onCropError} />

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
