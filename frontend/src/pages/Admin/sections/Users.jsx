import { useState } from 'react';
import { admin, download } from '../../../api/adminApi';
import { useAuth } from '../../../auth/AuthContext';
import { ActivityList } from './Overview';
import {
  Badge, ConfirmDialog, DataTable, Drawer, ErrorNote, Facts, Loading, PageHeader, Pagination, RiskBadge,
  SearchBox, Select, Toolbar, fmtAgo, fmtDateTime, fmtPct, useDebounced, useLoad, useToast,
} from '../ui';

const providers = (ids) => ids.map((p) => (p === 'gmail' ? 'Google' : 'X')).join(', ');

function UserDetail({ id, onClose, onChanged, openAssessment }) {
  const notify = useToast();
  const { user: me } = useAuth();
  const { data: u, error, loading, reload } = useLoad(() => admin.user(id), [id]);
  const [confirm, setConfirm] = useState(null); // 'delete' | 'deactivate' | 'staff-off'
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(null);

  const act = async (fn, message) => {
    setBusy(true);
    try {
      const res = await fn();
      notify(res?.detail || message);
      reload();
      onChanged();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const isMe = u && me?.email === u.email;
  return (
    <Drawer
      open
      onClose={onClose}
      title={u ? u.name : 'User'}
      subtitle={u?.email}
      footer={
        u && (
          <>
            <button type="button" className="ad-btn" disabled={busy || !u.is_active || !u.email} onClick={() => act(() => admin.sendReset(u.id), 'Reset link sent.')}>
              Send password reset
            </button>
            <button type="button" className="ad-btn" disabled={busy || !u.sessions} onClick={() => act(() => admin.signOutUser(u.id), 'Signed out.')}>
              Sign out everywhere
            </button>
            <button type="button" className="ad-btn is-danger" disabled={busy || isMe} onClick={() => setConfirm('delete')}>
              Delete account
            </button>
          </>
        )
      }
    >
      {loading && !u && <Loading />}
      <ErrorNote error={error} onRetry={reload} />
      {u && (
        <>
          <div className="ad-chips">
            <Badge tone={u.is_active ? 'ok' : 'danger'}>{u.is_active ? 'Active' : 'Deactivated'}</Badge>
            {u.is_superuser && <Badge tone="violet">Superuser</Badge>}
            {u.is_staff && !u.is_superuser && <Badge tone="violet">Staff</Badge>}
            {u.sign_in_with.length > 0 && <Badge>{providers(u.sign_in_with)} sign-in</Badge>}
            {!u.has_password && <Badge tone="warn">No password</Badge>}
            {isMe && <Badge>You</Badge>}
          </div>

          <h3 className="ad-h3">Account</h3>
          <Facts
            items={[
              ['Joined', fmtDateTime(u.date_joined)],
              ['Last login', u.last_login ? `${fmtDateTime(u.last_login)} (${fmtAgo(u.last_login)})` : 'never'],
              ['Active sessions', u.sessions],
              ['Assessments', u.assessments],
              ['Profile', u.profile ? (u.profile_deleted ? 'deleted (undo window)' : 'yes') : 'none'],
            ]}
          />

          <form
            className="ad-inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              act(() => admin.updateUser(u.id, { name: name ?? u.name }), 'Name saved.');
            }}
          >
            <label className="ad-field">
              <span>Display name</span>
              <input value={name ?? u.name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            </label>
            <button type="submit" className="ad-btn is-small" disabled={busy || (name ?? u.name) === u.name}>
              Save
            </button>
          </form>

          <h3 className="ad-h3">Access</h3>
          <div className="ad-actions-row">
            {u.is_active ? (
              <button type="button" className="ad-btn" disabled={busy || isMe} onClick={() => setConfirm('deactivate')}>
                Deactivate
              </button>
            ) : (
              <button type="button" className="ad-btn" disabled={busy} onClick={() => act(() => admin.updateUser(u.id, { is_active: true }), 'Account activated.')}>
                Activate
              </button>
            )}
            {me?.is_superuser &&
              (u.is_staff ? (
                <button type="button" className="ad-btn" disabled={busy || isMe} onClick={() => setConfirm('staff-off')}>
                  Remove staff access
                </button>
              ) : (
                <button type="button" className="ad-btn" disabled={busy} onClick={() => act(() => admin.updateUser(u.id, { is_staff: true }), 'Staff access granted.')}>
                  Make staff
                </button>
              ))}
          </div>
          {isMe && <p className="ad-muted">You can’t deactivate, demote or delete your own account.</p>}

          {u.profile && (
            <>
              <h3 className="ad-h3">Profile</h3>
              <Facts
                items={[
                  ['Name on profile', u.profile.full_name],
                  ['Sex', u.profile.sex || '—'],
                  ['Date of birth', u.profile.date_of_birth || '—'],
                  ['Location', [u.profile.city, u.profile.country].filter(Boolean).join(', ') || '—'],
                  ['Phone', u.profile.phone || '—'],
                ]}
              />
            </>
          )}

          <h3 className="ad-h3">Recent assessments</h3>
          {u.assessments_recent.length ? (
            <ul className="ad-mini-list">
              {u.assessments_recent.map((a) => (
                <li key={a.id}>
                  <button type="button" className="ad-link-btn" onClick={() => openAssessment(a.id)}>
                    {a.id}
                  </button>
                  <span className="ad-muted">{fmtDateTime(a.created_at)}</span>
                  <span>{fmtPct(a.probability)}</span>
                  <RiskBadge level={a.risk_level} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="ad-muted">No assessments.</p>
          )}

          <h3 className="ad-h3">Activity</h3>
          <ActivityList events={u.activity} />
        </>
      )}

      <ConfirmDialog
        open={confirm === 'delete'}
        title="Delete this account?"
        body={<p>{u?.email}’s account, profile and all {u?.assessments} assessments will be permanently deleted. This can’t be undone.</p>}
        confirmLabel="Delete account"
        confirmText="DELETE"
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          act(async () => {
            await admin.deleteUser(u.id);
            onClose();
            return { detail: 'Account deleted.' };
          })
        }
      />
      <ConfirmDialog
        open={confirm === 'deactivate'}
        title="Deactivate this account?"
        body={<p>{u?.email} will be signed out everywhere and can’t log in until reactivated. Their data is kept.</p>}
        confirmLabel="Deactivate"
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => act(() => admin.updateUser(u.id, { is_active: false }), 'Account deactivated.')}
      />
      <ConfirmDialog
        open={confirm === 'staff-off'}
        title="Remove staff access?"
        body={<p>{u?.email} will lose access to this console.</p>}
        confirmLabel="Remove access"
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => act(() => admin.updateUser(u.id, { is_staff: false }), 'Staff access removed.')}
      />
    </Drawer>
  );
}

export default function Users({ openAssessment }) {
  const notify = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [sort, setSort] = useState('-date_joined');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const search = useDebounced(q);
  const params = { q: search, status, role, sort, page };
  const { data, error, loading, reload } = useLoad(() => admin.users(params), [search, status, role, sort, page]);

  const filter = (setter) => (v) => {
    setter(v);
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Accounts, access and sign-in"
        actions={
          <button
            type="button"
            className="ad-btn"
            onClick={() => download('/admin/users/export/', { q: search, status, role }, 'users.csv').catch((e) => notify(e.message, 'error'))}
          >
            Export CSV
          </button>
        }
      />
      <Toolbar>
        <SearchBox value={q} onChange={filter(setQ)} placeholder="Search name or email" />
        <Select label="Status" value={status} onChange={filter(setStatus)} options={[['', 'All'], ['active', 'Active'], ['inactive', 'Deactivated']]} />
        <Select label="Role" value={role} onChange={filter(setRole)} options={[['', 'All'], ['staff', 'Staff'], ['user', 'Users']]} />
        <Select
          label="Sort"
          value={sort}
          onChange={filter(setSort)}
          options={[['-date_joined', 'Newest'], ['date_joined', 'Oldest'], ['-last_login', 'Last login'], ['-n_assessments', 'Most assessments'], ['email', 'Email A–Z']]}
        />
      </Toolbar>
      <ErrorNote error={error} onRetry={reload} />
      {loading && !data ? (
        <Loading />
      ) : (
        <>
          <DataTable
            rows={data?.results}
            onRowClick={(r) => setSelected(r.id)}
            empty="No users match these filters."
            columns={[
              {
                key: 'name',
                label: 'User',
                render: (r) => (
                  <div className="ad-cell-main">
                    <strong>{r.name}</strong>
                    <span className="ad-muted">{r.email}</span>
                  </div>
                ),
              },
              {
                key: 'role',
                label: 'Role',
                render: (r) => (r.is_superuser ? <Badge tone="violet">Superuser</Badge> : r.is_staff ? <Badge tone="violet">Staff</Badge> : <span className="ad-muted">User</span>),
              },
              { key: 'status', label: 'Status', render: (r) => <Badge tone={r.is_active ? 'ok' : 'danger'}>{r.is_active ? 'Active' : 'Deactivated'}</Badge> },
              { key: 'signin', label: 'Sign-in', render: (r) => (r.sign_in_with.length ? providers(r.sign_in_with) : 'Password') },
              { key: 'assessments', label: 'Assessments', align: 'right' },
              { key: 'last_login', label: 'Last login', render: (r) => fmtAgo(r.last_login) },
              { key: 'joined', label: 'Joined', render: (r) => fmtAgo(r.date_joined) },
            ]}
          />
          {data && <Pagination page={data.page} pages={data.pages} count={data.count} onPage={setPage} />}
        </>
      )}
      {selected !== null && (
        <UserDetail
          id={selected}
          onClose={() => setSelected(null)}
          onChanged={reload}
          openAssessment={(ref) => {
            setSelected(null);
            openAssessment(ref);
          }}
        />
      )}
    </>
  );
}
