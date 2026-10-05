import { useState } from 'react';
import SetDoctorPassword, { PasswordFields } from './DoctorPassword';
import { passwordProblem } from '../labels';
import { isPhoto } from '../../Profile/photo';
import { admin } from '../../../api/adminApi';
import {
  Avatar, Badge, ConfirmDialog, DataTable, Drawer, ErrorNote, Facts, Icon, Loading, PageHeader, Pagination, SearchBox,
  Select, Skeleton, Toolbar, fmtAgo, fmtDateTime, useDebounced, useLoad, useToast,
} from '../ui';

const TEXT_FIELDS = [
  ['specialty', 'Specialty', 80],
  ['organization', 'Hospital / organization', 120],
  ['registration_number', 'Professional registration number', 40],
  ['phone', 'Phone', 20],
];

function Field({ label, children, hint }) {
  return (
    <label className="cx-field">
      <span>{label}</span>
      {children}
      {hint && <small className="cx-muted">{hint}</small>}
    </label>
  );
}

/** A new doctor account. The temporary password is hashed by the server and never shown again. */
function NewDoctor({ onClose, onCreated }) {
  const notify = useToast();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', specialty: '', organization: '', registration_number: '', phone: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { confirm: _confirm, ...body } = form;
      const d = await admin.createDoctor(body);
      notify(`Doctor account ${d.doctor_id} created. Give the doctor their temporary password in person; they must change it at first sign-in.`);
      onCreated(d);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <Drawer
      open
      onClose={onClose}
      title="Add a doctor"
      subtitle="Creates a new doctor account (a new email, not an existing patient account)."
      footer={
        <>
          <button type="button" className="cx-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="cx-new-doctor" className="cx-btn is-primary" disabled={busy || !form.name || !form.email || Boolean(passwordProblem(form.password, form.confirm))}>
            {busy ? 'Creating…' : 'Create doctor account'}
          </button>
        </>
      }
    >
      <form id="cx-new-doctor" onSubmit={create} noValidate>
        <Field label="Full name">
          <input value={form.name} maxLength={80} onChange={set('name')} required />
        </Field>
        <Field label="Email (used to sign in)">
          <input type="email" value={form.email} onChange={set('email')} required autoComplete="off" />
        </Field>
        <PasswordFields
          label="Temporary password"
          value={form.password}
          confirm={form.confirm}
          onChange={(password, confirm) => setForm((f) => ({ ...f, password, confirm }))}
        />
        {TEXT_FIELDS.map(([k, label, max]) => (
          <Field key={k} label={label} hint={k === 'registration_number' ? 'Enter only the number the doctor’s medical council issued. Verify it before marking the doctor verified.' : undefined}>
            <input value={form[k]} maxLength={max} onChange={set(k)} />
          </Field>
        ))}
        {error && (
          <div className="cx-callout is-warn" role="alert" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
      </form>
    </Drawer>
  );
}

function DoctorDetail({ id, onClose, onChanged }) {
  const notify = useToast();
  const { data: d, error, loading, reload } = useLoad(() => admin.doctor(id), [id]);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'deactivate' | 'verify'

  const act = async (fn, message) => {
    setBusy(true);
    try {
      const res = await fn();
      notify(res?.detail || message);
      reload();
      onChanged();
      return true;
    } catch (err) {
      notify(err.message, 'error');
      return false;
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const values = edit ?? (d && { name: d.name, ...Object.fromEntries(TEXT_FIELDS.map(([k]) => [k, d[k] ?? ''])) });
  const changed = d && edit && Object.entries(edit).some(([k, v]) => v !== (d[k] ?? ''));

  return (
    <Drawer
      open
      onClose={onClose}
      title="Doctor details"
      subtitle={d ? `${d.doctor_id} · ${d.email}` : ''}
      footer={
        d && (
          <>
            {d.status === 'active' ? (
              <button type="button" className="cx-btn is-danger" disabled={busy} onClick={() => setConfirm('deactivate')}>
                Deactivate
              </button>
            ) : (
              <button type="button" className="cx-btn" disabled={busy} onClick={() => act(() => admin.updateDoctor(d.id, { status: 'active' }), 'Doctor activated.')}>
                Activate
              </button>
            )}
          </>
        )
      }
    >
      {loading && !d && <Loading />}
      <ErrorNote error={error} onRetry={reload} />
      {d && (
        <>
          <div className="cx-profile-card">
            {isPhoto(d.photo) ? (
              <img src={d.photo} alt="" width="52" height="52" style={{ borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <Avatar name={d.name} email={d.email} size={52} />
            )}
            <div>
              <strong>{d.name}</strong>
              <span className="cx-muted">
                {d.doctor_id}
                {d.specialty ? ` · ${d.specialty}` : ''}
              </span>
              <span className="cx-muted">Added {fmtDateTime(d.created_at)}</span>
            </div>
          </div>
          <div className="cx-chips">
            <Badge tone={d.status === 'active' ? 'ok' : 'danger'}>{d.status === 'active' ? 'Active' : 'Inactive'}</Badge>
            <Badge tone={d.verified ? 'ok' : 'warn'}>{d.verified ? '✓ Verified' : 'Not verified'}</Badge>
            <Badge>{d.is_available ? 'Available' : 'Unavailable'}</Badge>
            {d.must_change_password && <Badge tone="warn">Temporary password</Badge>}
          </div>

          <h3 className="cx-h3">Verification</h3>
          <p className="cx-muted" style={{ marginTop: 0 }}>
            Mark a doctor verified only after checking their registration with the issuing medical council. Patients see “Verified” and the registration
            number on their reports.
          </p>
          <Facts
            items={[
              ['Registration', d.registration_number || 'not provided'],
              ['Verified', d.verified ? `${fmtDateTime(d.verified_at)} by ${d.verified_by}` : 'no'],
            ]}
          />
          <div className="cx-actions-row">
            {d.verified ? (
              <button type="button" className="cx-btn" disabled={busy} onClick={() => act(() => admin.updateDoctor(d.id, { is_verified: false }), 'Verification removed.')}>
                Remove verification
              </button>
            ) : (
              <button type="button" className="cx-btn is-primary" disabled={busy || !d.registration_number} onClick={() => setConfirm('verify')}>
                Verify doctor
              </button>
            )}
            <button
              type="button"
              className="cx-btn"
              disabled={busy || d.status !== 'active'}
              onClick={() => act(() => admin.updateDoctor(d.id, { is_available: !d.is_available }), d.is_available ? 'Set unavailable.' : 'Set available.')}
            >
              {d.is_available ? 'Set unavailable' : 'Set available'}
            </button>
          </div>

          <h3 className="cx-h3">Password</h3>
          <Facts items={[['Status', d.must_change_password ? 'Temporary: must be changed at next sign-in' : 'Set by the doctor']]} />
          <SetDoctorPassword
            doctor={d}
            onDone={() => {
              reload();
              onChanged();
            }}
          />

          <h3 className="cx-h3">Workload</h3>
          <Facts
            items={[
              ['Active reviews', d.active_reviews],
              ['Completed reviews', d.completed_reviews],
              ['Last sign-in', d.last_login ? `${fmtDateTime(d.last_login)} (${fmtAgo(d.last_login)})` : 'never'],
            ]}
          />

          <h3 className="cx-h3">Profile</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              act(() => admin.updateDoctor(d.id, edit), 'Doctor details saved.').then((ok) => ok && setEdit(null));
            }}
          >
            <Field label="Full name">
              <input value={values.name} maxLength={80} onChange={(e) => setEdit({ ...values, name: e.target.value })} />
            </Field>
            {TEXT_FIELDS.map(([k, label, max]) => (
              <Field key={k} label={label} hint={k === 'registration_number' && d.verified ? 'Changing it removes the verification.' : undefined}>
                <input value={values[k]} maxLength={max} onChange={(e) => setEdit({ ...values, [k]: e.target.value })} />
              </Field>
            ))}
            <div className="cx-actions-row" style={{ marginTop: 12 }}>
              <button type="submit" className="cx-btn is-primary is-small" disabled={busy || !changed}>
                Save details
              </button>
            </div>
          </form>

          {d.recent_reviews?.length > 0 && (
            <>
              <h3 className="cx-h3">Recent reviews</h3>
              <Facts items={d.recent_reviews.map((r) => [`${r.assessment} · ${r.id}`, `${r.status_label}${r.decision_label ? ` · ${r.decision_label}` : ''}`])} />
            </>
          )}

          <ConfirmDialog
            open={confirm === 'deactivate'}
            title={`Deactivate ${d.name}?`}
            body={<p>They’re signed out and can no longer see patient assessments or accept reviews. Reviews they already submitted stay on patients’ records.</p>}
            confirmLabel="Deactivate"
            busy={busy}
            onCancel={() => setConfirm(null)}
            onConfirm={() => act(() => admin.updateDoctor(d.id, { status: 'inactive' }), 'Doctor deactivated.')}
          />
          <ConfirmDialog
            open={confirm === 'verify'}
            title="Mark this doctor verified?"
            tone="primary"
            body={<p>Confirm you have checked registration {d.registration_number} with the issuing medical council. The verification is recorded under your account.</p>}
            confirmLabel="Verify"
            busy={busy}
            onCancel={() => setConfirm(null)}
            onConfirm={() => act(() => admin.updateDoctor(d.id, { is_verified: true }), 'Doctor verified.')}
          />
        </>
      )}
    </Drawer>
  );
}

/** Admin console → Doctors: create, verify, activate and reset doctor accounts. */
export default function Doctors() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [verified, setVerified] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const search = useDebounced(q);
  const { data, error, loading, reload } = useLoad(() => admin.doctors({ q: search, status, verified, page }), [search, status, verified, page]);
  const filter = (fn) => (v) => {
    setPage(1);
    fn(v);
  };

  return (
    <>
      <PageHeader
        title="Doctors"
        subtitle="Clinical reviewers. Only accounts created here can use the Doctor Panel."
        actions={
          <button type="button" className="cx-btn is-primary" onClick={() => setAdding(true)}>
            <Icon name="plus" size={16} /> Add doctor
          </button>
        }
      />
      <Toolbar>
        <SearchBox value={q} onChange={filter(setQ)} placeholder="Name, email, specialty or DR-0001" />
        <Select label="Status" value={status} onChange={filter(setStatus)} options={[['', 'Any'], ['active', 'Active'], ['inactive', 'Inactive']]} />
        <Select label="Verification" value={verified} onChange={filter(setVerified)} options={[['', 'Any'], ['1', 'Verified'], ['0', 'Not verified']]} />
      </Toolbar>
      <ErrorNote error={error} onRetry={reload} />
      {loading && !data ? (
        <Skeleton rows={1} />
      ) : (
        <div className="cx-card-table">
          <DataTable
            rows={data?.results}
            onRowClick={(r) => setSelected(r.id)}
            empty="No doctors yet. Add one to start reviewing patient assessments."
            columns={[
              {
                key: 'name',
                label: 'Doctor',
                render: (r) => (
                  <div className="cx-user-cell">
                    <Avatar name={r.name} email={r.email} size={32} />
                    <div className="cx-cell-main">
                      <strong>{r.name}</strong>
                      <span className="cx-muted">{r.email}</span>
                    </div>
                  </div>
                ),
              },
              { key: 'doctor_id', label: 'Doctor ID' },
              { key: 'specialty', label: 'Specialty', render: (r) => r.specialty || <span className="cx-muted">—</span> },
              { key: 'verified', label: 'Verification', render: (r) => <Badge tone={r.verified ? 'ok' : 'warn'}>{r.verified ? '✓ Verified' : 'Not verified'}</Badge> },
              { key: 'status', label: 'Account', render: (r) => <Badge tone={r.status === 'active' ? 'ok' : 'danger'} dot>{r.status === 'active' ? 'Active' : 'Inactive'}</Badge> },
              { key: 'available', label: 'Availability', render: (r) => (r.is_available ? 'Available' : <span className="cx-muted">Unavailable</span>) },
              { key: 'active_reviews', label: 'Active', align: 'right' },
              { key: 'completed_reviews', label: 'Completed', align: 'right' },
              { key: 'last_login', label: 'Last active', render: (r) => <span title={fmtDateTime(r.last_login)}>{r.last_login ? fmtAgo(r.last_login) : 'never'}</span> },
            ]}
          />
          {data && <Pagination page={data.page} pages={data.pages} count={data.count} onPage={setPage} />}
        </div>
      )}
      {adding && (
        <NewDoctor
          onClose={() => setAdding(false)}
          onCreated={(d) => {
            setAdding(false);
            reload();
            setSelected(d.id);
          }}
        />
      )}
      {selected !== null && <DoctorDetail id={selected} onClose={() => setSelected(null)} onChanged={reload} />}
    </>
  );
}
