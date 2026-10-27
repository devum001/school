import SectionNavigation from '../../components/shared/SectionNavigation';
import { displayTimestamp } from '../../lib/displayFormat';
import OwnerRecovery from './OwnerRecovery';
import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, LoadingOverlay, Modal, PageHeading, Panel } from '../../components/ui/Primitives';
import {
  platformService as api,
  platformError,
  type PlatformSchool,
  type PlatformUser,
} from '../../services/platformService';
import { useRemote } from '../live/useRemote';
import LiveAccount from '../live/LiveAccount';
import { SchoolForm, UserForm, PasswordReset } from './PlatformForms';

type Confirmation = { title: string; description: string; action: () => Promise<unknown> };
export default function PlatformDashboard() {
  const [params] = useSearchParams();
  const tab = params.get('tab') || 'Schools';
  return (
    <div className="school-settings">
      <PageHeading
        title="Platform administration"
        description="Manage school registrations and accounts. Each school manages its own operations."
      />
      <SectionNavigation
        label="Platform sections"
        value={tab}
        items={[
          { id: 'Schools', label: 'Schools', icon: 'overview-grid', to: '/platform?tab=Schools' },
          { id: 'Accounts', label: 'Accounts', icon: 'users', to: '/platform?tab=Accounts' },
          { id: 'Activity', label: 'Activity', icon: 'security', to: '/platform?tab=Activity' },
          { id: 'My account', label: 'My account', icon: 'user-check', to: '/platform?tab=My%20account' },
        ]}
      />
      {tab === 'Schools' ? (
        <PlatformSchools />
      ) : tab === 'Accounts' ? (
        <PlatformUsers />
      ) : tab === 'Activity' ? (
        <PlatformActivity />
      ) : tab === 'My account' ? (
        <LiveAccount />
      ) : (
        <Panel>
          <div className="live-content">
            <h2>Section unavailable</h2>
            <Link to="/platform">Open schools</Link>
          </div>
        </Panel>
      )}
    </div>
  );
}
function ConfirmAction({
  value,
  close,
  saved,
}: {
  value: Confirmation;
  close: () => void;
  saved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Modal
      open
      title={value.title}
      description={value.description}
      onClose={() => {
        if (!busy) close();
      }}
    >
      <div className="live-content">
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="live-actions">
          <Button variant="secondary" disabled={busy} onClick={close}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                await value.action();
                saved();
              } catch (cause) {
                setError(platformError(cause));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Applying…' : 'Confirm change'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
function Pagination({
  cursor,
  next,
  onChange,
}: {
  cursor?: string;
  next: string | null;
  onChange: (value?: string) => void;
}) {
  return (
    <div className="live-actions">
      {cursor && (
        <Button variant="secondary" onClick={() => onChange(undefined)}>
          First page
        </Button>
      )}
      {next && (
        <Button variant="secondary" onClick={() => onChange(next)}>
          Next page
        </Button>
      )}
    </div>
  );
}
function PlatformSchools() {
  const [cursor, setCursor] = useState<string>();
  return <SchoolPage key={cursor ?? 'first'} cursor={cursor} setCursor={setCursor} />;
}
function SchoolPage({
  cursor,
  setCursor,
}: {
  cursor?: string;
  setCursor: (value?: string) => void;
}) {
  const load = useCallback((signal: AbortSignal) => api.schools(signal, cursor), [cursor]);
  const state = useRemote(load);
  const [editing, setEditing] = useState<PlatformSchool | 'new' | null>(null);
  const [recovering, setRecovering] = useState<PlatformSchool | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [notice, setNotice] = useState('');
  const saved = () => {
    setEditing(null);
    setConfirmation(null);
    setNotice('School registration saved.');
    state.reload();
  };
  const change = (school: PlatformSchool, status: 'active' | 'suspended') =>
    setConfirmation({
      title: status === 'active' ? 'Restore school access?' : 'Suspend school access?',
      description: `${school.name}: ${status === 'active' ? 'active members will regain access to this school.' : 'all members will lose access to this school until it is reactivated. Records will be retained.'}`,
      action: () => api.updateSchool(school.id, { status }),
    });
  return (
    <LoadingOverlay
      loading={state.loading}
      size="xl"
      label="Loading schools…"
      message="Loading schools…"
    >
      <Panel
        title="Registered schools"
        subtitle="All schools, including suspended and archived registrations."
        action={<Button onClick={() => setEditing('new')}>Create school</Button>}
      >
        <div className="live-content">
          {notice && <p role="status">{notice}</p>}
          {state.error && (
            <p role="alert">
              {state.error} <Button onClick={state.reload}>Retry schools</Button>
            </p>
          )}
          {!state.error && (
            <>
              <div className="live-table-wrap">
                <table className="live-table">
                  <caption className="sr-only">Platform school registrations</caption>
                  <thead>
                    <tr>
                      <th scope="col">School</th>
                      <th scope="col">Timezone</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(state.data?.items ?? []).map((school) => (
                      <tr key={school.id}>
                        <th scope="row">
                          {school.name}
                          <small>
                            {school.slug}
                            {school.code ? ` · ${school.code}` : ''}
                          </small>
                        </th>
                        <td>{school.timezone}</td>
                        <td>
                          {school.status === 'archived'
                            ? 'Archived'
                            : school.status === 'suspended'
                              ? 'Suspended'
                              : 'Active'}
                        </td>
                        <td>
                          <div className="live-actions">
                            <Button variant="secondary" onClick={() => setRecovering(school)}>
                              Recover owner <span className="sr-only">{school.name}</span>
                            </Button>
                            <Button variant="secondary" onClick={() => setEditing(school)}>
                              Edit <span className="sr-only">{school.name}</span>
                            </Button>
                            {school.status === 'active' ? (
                              <Button variant="secondary" onClick={() => change(school, 'suspended')}>
                                Suspend <span className="sr-only">{school.name}</span>
                              </Button>
                            ) : (
                              <Button variant="secondary" onClick={() => change(school, 'active')}>
                                Restore <span className="sr-only">{school.name}</span>
                              </Button>
                            )}
                            {school.status !== 'archived' && (
                              <Button
                                variant="danger"
                                onClick={() =>
                                  setConfirmation({
                                    title: 'Remove school registration?',
                                    description: `${school.name} will be archived and all school access blocked. School records are retained; you can restore access later.`,
                                    action: () => api.archiveSchool(school.id),
                                  })
                                }
                              >
                                Remove <span className="sr-only">{school.name}</span>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {state.data && !state.data.items.length && (
                <p>
                  No schools have been registered. Create a school and assign its owner to get
                  started.
                </p>
              )}
              {state.data && (
                <Pagination cursor={cursor} next={state.data.nextCursor} onChange={setCursor} />
              )}
            </>
          )}
          <Button variant="secondary" disabled={state.loading} onClick={state.reload}>
            Refresh schools
          </Button>
        </div>
        {recovering && (
          <OwnerRecovery school={recovering} close={() => setRecovering(null)} saved={saved} />
        )}
        {editing && (
          <SchoolForm
            school={editing === 'new' ? undefined : editing}
            close={() => setEditing(null)}
            saved={saved}
          />
        )}
        {confirmation && (
          <ConfirmAction value={confirmation} close={() => setConfirmation(null)} saved={saved} />
        )}
      </Panel>
    </LoadingOverlay>
  );
}
function PlatformUsers() {
  const [cursor, setCursor] = useState<string>();
  const [search, setSearch] = useState('');
  const [email, setEmail] = useState('');
  return (
    <>
      <form
        className="platform-search"
        onSubmit={(event) => {
          event.preventDefault();
          setCursor(undefined);
          setEmail(search.trim().toLowerCase());
        }}
      >
        <label>
          Find account by email
          <input
            type="email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Exact email address"
          />
        </label>
        <Button variant="secondary">Find account</Button>
        {email && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearch('');
              setEmail('');
              setCursor(undefined);
            }}
          >
            Clear search
          </Button>
        )}
      </form>
      <UserPage
        key={`${cursor ?? 'first'}:${email}`}
        cursor={cursor}
        email={email}
        setCursor={setCursor}
      />
    </>
  );
}
function UserPage({
  cursor,
  email,
  setCursor,
}: {
  cursor?: string;
  email: string;
  setCursor: (value?: string) => void;
}) {
  const load = useCallback(
    (signal: AbortSignal) => api.users(signal, cursor, email),
    [cursor, email],
  );
  const state = useRemote(load);
  const [editing, setEditing] = useState<PlatformUser | 'new' | null>(null);
  const [reset, setReset] = useState<PlatformUser | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [notice, setNotice] = useState('');
  const saved = () => {
    setEditing(null);
    setReset(null);
    setConfirmation(null);
    setNotice('Account change saved.');
    state.reload();
  };
  return (
    <LoadingOverlay
      loading={state.loading}
      size="xl"
      label="Loading accounts…"
      message="Loading accounts…"
    >
      <Panel
        title="Platform accounts"
        subtitle="Create and maintain accounts. School owners assign school-specific roles and memberships."
        action={<Button onClick={() => setEditing('new')}>Create account</Button>}
      >
        <div className="live-content">
          {notice && <p role="status">{notice}</p>}
          {state.error && (
            <p role="alert">
              {state.error} <Button onClick={state.reload}>Retry accounts</Button>
            </p>
          )}
          {!state.error && (
            <>
              <div className="live-table-wrap">
                <table className="live-table">
                  <caption className="sr-only">Platform user accounts</caption>
                  <thead>
                    <tr>
                      <th scope="col">Account</th>
                      <th scope="col">Access</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(state.data?.items ?? []).map((user) => (
                      <tr key={user.id}>
                        <th scope="row">
                          {user.name}
                          <small>{user.email}</small>
                        </th>
                        <td>
                          {user.platformRole === 'super_admin' ? 'Super Admin' : 'School account'}
                        </td>
                        <td>{user.status === 'active' ? 'Active' : 'Disabled'}</td>
                        <td>
                          {user.platformRole === 'super_admin' ? (
                            <span>Protected platform identity</span>
                          ) : (
                            <div className="live-actions">
                              <Button variant="secondary" onClick={() => setEditing(user)}>
                                Edit <span className="sr-only">{user.name}</span>
                              </Button>
                              <Button variant="secondary" onClick={() => setReset(user)}>
                                Reset password <span className="sr-only">{user.name}</span>
                              </Button>
                              {user.status === 'active' ? (
                                <Button
                                  variant="danger"
                                  onClick={() =>
                                    setConfirmation({
                                      title: 'Remove account access?',
                                      description: `${user.email} will be disabled across all schools and signed out of all devices. Its records are retained.`,
                                      action: () => api.disableUser(user.id),
                                    })
                                  }
                                >
                                  Remove access <span className="sr-only">{user.name}</span>
                                </Button>
                              ) : (
                                <Button
                                  variant="secondary"
                                  onClick={() =>
                                    setConfirmation({
                                      title: 'Reactivate account?',
                                      description: `${user.email} can sign in again with its current password. Existing school memberships will apply. Revoked sessions stay signed out.`,
                                      action: () => api.updateUser(user.id, { status: 'active' }),
                                    })
                                  }
                                >
                                  Reactivate <span className="sr-only">{user.name}</span>
                                </Button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {state.data && !state.data.items.length && (
                <p>No accounts match this page or email.</p>
              )}
              {state.data && (
                <Pagination cursor={cursor} next={state.data.nextCursor} onChange={setCursor} />
              )}
            </>
          )}
          <Button variant="secondary" disabled={state.loading} onClick={state.reload}>
            Refresh accounts
          </Button>
        </div>
        {editing && (
          <UserForm
            user={editing === 'new' ? undefined : editing}
            close={() => setEditing(null)}
            saved={saved}
          />
        )}
        {reset && <PasswordReset user={reset} close={() => setReset(null)} saved={saved} />}
        {confirmation && (
          <ConfirmAction value={confirmation} close={() => setConfirmation(null)} saved={saved} />
        )}
      </Panel>
    </LoadingOverlay>
  );
}
const eventNames: Record<string, string> = {
  'platform.super_admin.bootstrapped': 'First Super Admin created',
  'platform.school.owner_recovered': 'School owner recovered',
  'platform.school.created': 'School registered',
  'platform.school.updated': 'School registration updated',
  'platform.school.suspended': 'School suspended',
  'platform.school.reactivated': 'School access restored',
  'platform.school.archived': 'School archived',
  'platform.user.created': 'Account created',
  'platform.user.updated': 'Account updated',
  'platform.user.disabled': 'Account disabled',
  'platform.user.reactivated': 'Account reactivated',
  'platform.user.password_reset': 'Account password reset',
};
function PlatformActivity() {
  const [cursor, setCursor] = useState<string>();
  return <ActivityPage key={cursor ?? 'first'} cursor={cursor} setCursor={setCursor} />;
}
function ActivityPage({
  cursor,
  setCursor,
}: {
  cursor?: string;
  setCursor: (value?: string) => void;
}) {
  const load = useCallback((signal: AbortSignal) => api.events(signal, cursor), [cursor]);
  const state = useRemote(load);
  return (
    <LoadingOverlay
      loading={state.loading}
      size="xl"
      label="Loading platform activity…"
      message="Loading platform activity…"
    >
      <Panel
        title="Platform activity"
        subtitle="Platform administration changes, oldest first."
        action={
          <Button variant="secondary" disabled={state.loading} onClick={state.reload}>
            Refresh activity
          </Button>
        }
      >
        <div className="live-content">
          {state.error && (
            <p role="alert">
              {state.error} <Button onClick={state.reload}>Retry activity</Button>
            </p>
          )}
          {!state.error && (
            <>
              <div className="live-table-wrap">
                <table className="live-table">
                  <caption className="sr-only">Platform audit events</caption>
                  <thead>
                    <tr>
                      <th scope="col">Change</th>
                      <th scope="col">When</th>
                      <th scope="col">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(state.data?.items ?? []).map((event) => (
                      <tr key={event.id}>
                        <th scope="row">{eventNames[event.action] ?? event.action}</th>
                        <td>
                          <time dateTime={event.createdAt}>
                            {displayTimestamp(event.createdAt)}
                          </time>
                        </td>
                        <td>
                          <details>
                            <summary>Event references</summary>
                            <dl>
                              <dt>Actor</dt>
                              <dd>{event.actorUserId ?? 'Trusted setup'}</dd>
                              <dt>Record</dt>
                              <dd>{event.targetId ?? '—'}</dd>
                              <>
                                {event.reason && (
                                  <>
                                    <dt>Recovery reason</dt>
                                    <dd>{event.reason}</dd>
                                  </>
                                )}
                              </>
                              <dt>Support request</dt>
                              <dd>{event.requestId}</dd>
                            </dl>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {state.data && !state.data.items.length && <p>No recorded platform changes.</p>}
              {state.data && (
                <Pagination cursor={cursor} next={state.data.nextCursor} onChange={setCursor} />
              )}
            </>
          )}
        </div>
      </Panel>
    </LoadingOverlay>
  );
}
