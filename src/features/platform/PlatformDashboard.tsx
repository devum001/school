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
} from '../../services/platformService';
import { useRemote } from '../live/useRemote';
import LiveAccount from '../live/LiveAccount';
import { SchoolForm } from './PlatformForms';
import PlatformOverview from './PlatformOverview';
import PlatformAnnouncements from './PlatformAnnouncements';
import PlatformSystemHealth from './PlatformSystemHealth';
import PlatformMasterTemplates from './PlatformMasterTemplates';
import SubscriptionModal from './SubscriptionModal';

type Confirmation = { title: string; description: string; action: () => Promise<unknown> };
export default function PlatformDashboard() {
  const [params] = useSearchParams();
  const tab = params.get('tab') || 'Overview';
  return (
    <div className="school-settings">
      <PageHeading
        title="Platform administration"
        description="Manage school registrations, subscriptions, broadcasts, and system health."
      />
      <SectionNavigation
        label="Platform sections"
        value={tab}
        items={[
          { id: 'Overview', label: 'Overview', icon: 'overview', to: '/platform?tab=Overview' },
          { id: 'Schools', label: 'Schools', icon: 'overview-grid', to: '/platform?tab=Schools' },
          { id: 'Announcements', label: 'Announcements', icon: 'notifications', to: '/platform?tab=Announcements' },
          { id: 'System Health', label: 'System Health', icon: 'settings', to: '/platform?tab=System%20Health' },
          { id: 'Master Templates', label: 'Master Templates', icon: 'templates', to: '/platform?tab=Master%20Templates' },
          { id: 'Activity', label: 'Activity', icon: 'security', to: '/platform?tab=Activity' },
          { id: 'My account', label: 'My account', icon: 'user-check', to: '/platform?tab=My%20account' },
        ]}
      />
      {tab === 'Overview' ? (
        <PlatformOverview />
      ) : tab === 'Schools' ? (
        <PlatformSchools />
      ) : tab === 'Announcements' ? (
        <PlatformAnnouncements />
      ) : tab === 'System Health' ? (
        <PlatformSystemHealth />
      ) : tab === 'Master Templates' ? (
        <PlatformMasterTemplates />
      ) : tab === 'Activity' ? (
        <PlatformActivity />
      ) : tab === 'My account' ? (
        <LiveAccount />
      ) : (
        <Panel>
          <div className="live-content">
            <h2>Section unavailable</h2>
            <Link to="/platform?tab=Overview">Open overview</Link>
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
  const [subscribing, setSubscribing] = useState<PlatformSchool | null>(null);
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
                            <Button variant="secondary" onClick={() => setSubscribing(school)}>
                              Plan & Features <span className="sr-only">{school.name}</span>
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
        {subscribing && (
          <SubscriptionModal
            school={subscribing}
            onClose={() => setSubscribing(null)}
            onSaved={() => {
              setSubscribing(null);
              setNotice('School subscription updated.');
              state.reload();
            }}
          />
        )}
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
