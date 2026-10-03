import { useEffect, useState } from 'react';
import { admin, download } from '../../../api/adminApi';
import { useAuth } from '../../../auth/AuthContext';
import { ActivityList } from './Overview';
import {
  Avatar, Badge, ConfirmDialog, DataTable, Drawer, ErrorNote, Facts, Icon, Loading, PageHeader, Pagination, RiskBadge,
  SearchBox, Select, Skeleton, Toolbar, fmtAgo, fmtDateTime, fmtNumber, fmtPct, useDebounced, useLoad, useToast,
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
      title="User details"
      subtitle={u ? `Account #${u.id}${u.username && u.username !== u.email ? ` · ${u.username}` : ''}` : ''}
      footer={
        u && (
          <>
            <button type="button" className="cx-btn" disabled={busy || !u.is_active || !u.email} onClick={() => act(() => admin.sendReset(u.id), 'Reset link sent.')}>
              Send password reset
            </button>
            <button type="button" className="cx-btn" disabled={busy || !u.sessions} onClick={() => act(() => admin.signOutUser(u.id), 'Signed out.')}>
              Sign out everywhere
            </button>
            <button type="button" className="cx-btn is-danger" disabled={busy || isMe} onClick={() => setConfirm('delete')}>
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
          <div className="cx-profile-card">
            <Avatar name={u.name} email={u.email} size={52} />
            <div>
              <strong>{u.name}</strong>
              <span className="cx-muted">{u.email || 'no email'}</span>
              <span className="cx-muted">Member since {fmtDateTime(u.date_joined)}</span>
            </div>
          </div>
          <div className="cx-mini-stats">
            <div><span>Assessments</span><strong>{u.assessments}</strong></div>
            <div><span>Sessions</span><strong>{u.sessions}</strong></div>
            <div><span>Last seen</span><strong>{fmtAgo(u.last_login)}</strong></div>
          </div>
          <div className="cx-chips">
            <Badge tone={u.is_active ? 'ok' : 'danger'}>{u.is_active ? 'Active' : 'Deactivated'}</Badge>
            {u.is_superuser && <Badge tone="violet">Superuser</Badge>}
            {u.is_staff && !u.is_superuser && <Badge tone="violet">Staff</Badge>}
            {u.sign_in_with.length > 0 && <Badge>{providers(u.sign_in_with)} sign-in</Badge>}
            {!u.has_password && <Badge tone="warn">No password</Badge>}
            {isMe && <Badge>You</Badge>}
          </div>

          <h3 className="cx-h3">Account</h3>
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
            className="cx-inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              act(() => admin.updateUser(u.id, { name: name ?? u.name }), 'Name saved.');
            }}
          >
            <label className="cx-field">
              <span>Display name</span>
              <input value={name ?? u.name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            </label>
            <button type="submit" className="cx-btn is-small" disabled={busy || (name ?? u.name) === u.name}>
              Save
            </button>
          </form>

          <h3 className="cx-h3">Access</h3>
          <div className="cx-actions-row">
            {u.is_active ? (
              <button type="button" className="cx-btn" disabled={busy || isMe} onClick={() => setConfirm('deactivate')}>
                Deactivate
              </button>
            ) : (
              <button type="button" className="cx-btn" disabled={busy} onClick={() => act(() => admin.updateUser(u.id, { is_active: true }), 'Account activated.')}>
                Activate
              </button>
            )}
            {me?.is_superuser &&
              (u.is_staff ? (
                <button type="button" className="cx-btn" disabled={busy || isMe} onClick={() => setConfirm('staff-off')}>
                  Remove staff access
                </button>
              ) : (
                <button type="button" className="cx-btn" disabled={busy} onClick={() => act(() => admin.updateUser(u.id, { is_staff: true }), 'Staff access granted.')}>
                  Make staff
                </button>
              ))}
          </div>
          {isMe && <p className="cx-muted">You can’t deactivate, demote or delete your own account.</p>}

          {u.profile && (
            <>
              <h3 className="cx-h3">Profile</h3>
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

          <h3 className="cx-h3">Recent assessments</h3>
          {u.assessments_recent.length ? (
            <ul className="cx-mini-list">
              {u.assessments_recent.map((a) => (
                <li key={a.id}>
                  <button type="button" className="cx-link-btn" onClick={() => openAssessment(a.id)}>
                    {a.id}
                  </button>
                  <span className="cx-muted">{fmtDateTime(a.created_at)}</span>
                  <span>{fmtPct(a.probability)}</span>
                  <RiskBadge level={a.risk_level} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="cx-muted">No assessments.</p>
          )}

          <h3 className="cx-h3">Activity</h3>
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

const TABS = [
  ['all', 'All', {}],
  ['active', 'Active', { status: 'active' }],
  ['inactive', 'Deactivated', { status: 'inactive' }],
  ['staff', 'Staff', { role: 'staff' }],
];

const BULK = {
  activate: { label: 'Activate', done: 'activated' },
  deactivate: { label: 'Deactivate', done: 'deactivated', confirm: true },
  sign_out: { label: 'Sign out everywhere', done: 'signed out', confirm: true },
};

export default function Users({ openAssessment, initialUser, onOpened }) {
  const notify = useToast();
  const { user: me } = useAuth();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('all');
  const [sort, setSort] = useState('-date_joined');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(initialUser ?? null);
  const [picked, setPicked] = useState(() => new Set());
  const [bulk, setBulk] = useState(null); // action waiting for confirmation
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (initialUser) {
      setSelected(initialUser);
      onOpened?.();
    }
  }, [initialUser, onOpened]);
  const search = useDebounced(q);
  const { status = '', role = '' } = TABS.find((t) => t[0] === tab)[2];
  const params = { q: search, status, role, sort, page };
  const { data, error, loading, reload } = useLoad(() => admin.users(params), [search, status, role, sort, page]);

  const filter = (setter) => (v) => {
    setter(v);
    setPage(1);
  };

  const runBulk = async (action) => {
    setBusy(true);
    try {
      const res = await admin.bulkUsers([...picked], action);
      notify(res.detail, res.skipped?.length ? 'error' : 'ok');
      res.skipped?.forEach((s) => notify(`${s.email}: ${s.reason}`, 'error'));
      setPicked(new Set());
      reload();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
      setBulk(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Users"
        subtitle={data ? `${fmtNumber(data.count)} ${data.count === 1 ? 'account' : 'accounts'} · access, sign-in and sessions` : 'Accounts, access and sign-in'}
        actions={
          <button
            type="button"
            className="cx-btn"
            onClick={() => download('/admin/users/export/', { q: search, status, role }, 'users.csv').catch((e) => notify(e.message, 'error'))}
          >
            <Icon name="download" size={15} />
            Export CSV
          </button>
        }
      />
      <div className="cx-tabs" role="tablist" aria-label="Filter users">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : undefined} onClick={() => { filter(setTab)(id); setPicked(new Set()); }}>
            {label}
          </button>
        ))}
      </div>
      <Toolbar>
        <SearchBox value={q} onChange={filter(setQ)} placeholder="Search name or email" />
        <Select
          label="Sort"
          value={sort}
          onChange={filter(setSort)}
          options={[['-date_joined', 'Newest'], ['date_joined', 'Oldest'], ['-last_login', 'Last login'], ['-n_assessments', 'Most assessments'], ['email', 'Email A–Z']]}
        />
      </Toolbar>
      <ErrorNote error={error} onRetry={reload} />
      {loading && !data ? (
        <Skeleton rows={1} />
      ) : (
        <div className="cx-card-table">
          <DataTable
            rows={data?.results}
            onRowClick={(r) => setSelected(r.id)}
            empty="No users match these filters."
            selected={picked}
            onSelect={setPicked}
            isSelectable={(r) => r.email !== me?.email}
            sort={sort}
            onSort={filter(setSort)}
            columns={[
              {
                key: 'name',
                label: 'User',
                sortKey: 'email',
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
              {
                key: 'role',
                label: 'Role',
                render: (r) => (r.is_superuser ? <Badge tone="violet">Superuser</Badge> : r.is_staff ? <Badge tone="violet">Staff</Badge> : <span className="cx-muted">User</span>),
              },
              { key: 'status', label: 'Status', render: (r) => <Badge tone={r.is_active ? 'ok' : 'danger'} dot>{r.is_active ? 'Active' : 'Deactivated'}</Badge> },
              { key: 'signin', label: 'Sign-in', render: (r) => (r.sign_in_with.length ? providers(r.sign_in_with) : <span className="cx-muted">Password</span>) },
              { key: 'assessments', label: 'Assessments', align: 'right', sortKey: 'n_assessments' },
              { key: 'last_login', label: 'Last seen', sortKey: 'last_login', render: (r) => <span title={fmtDateTime(r.last_login)}>{fmtAgo(r.last_login)}</span> },
              { key: 'joined', label: 'Joined', sortKey: 'date_joined', render: (r) => <span title={fmtDateTime(r.date_joined)}>{fmtAgo(r.date_joined)}</span> },
            ]}
          />
          {data && <Pagination page={data.page} pages={data.pages} count={data.count} onPage={setPage} />}
        </div>
      )}

      {picked.size > 0 && (
        <div className="cx-bulkbar" role="region" aria-label="Bulk actions">
          <span className="cx-bulk-count">{picked.size} selected</span>
          <span className="cx-bulk-sep" aria-hidden="true" />
          {Object.entries(BULK).map(([action, b]) => (
            <button key={action} type="button" className="cx-bulk-btn" disabled={busy} onClick={() => (b.confirm ? setBulk(action) : runBulk(action))}>
              {b.label}
            </button>
          ))}
          <button type="button" className="cx-bulk-btn is-icon" aria-label="Clear selection" onClick={() => setPicked(new Set())}>
            <Icon name="x" size={15} />
          </button>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(bulk)}
        title={`${BULK[bulk]?.label} ${picked.size} ${picked.size === 1 ? 'account' : 'accounts'}?`}
        body={
          <p>
            {bulk === 'deactivate'
              ? 'They’ll be signed out everywhere and can’t log in until reactivated. Their data is kept. Accounts you can’t change are skipped.'
              : 'Every open session of these accounts ends now; they can sign in again.'}
          </p>
        }
        confirmLabel={BULK[bulk]?.label}
        busy={busy}
        onCancel={() => setBulk(null)}
        onConfirm={() => runBulk(bulk)}
      />

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
