import { useCallback, useState } from 'react';
import { Button, LoadingOverlay, Modal, Panel } from '../../components/ui/Primitives';
import {
  schoolAccessService as api,
  canAssign,
  accessError,
  type Member,
  type Role,
  type SchoolAccess,
} from '../../services/schoolAccessService';
import { useRemote } from './useRemote';
export default function LiveMembers({
  access,
  refreshAccess,
}: {
  access: SchoolAccess;
  refreshAccess: () => void;
}) {
  const [cursor, setCursor] = useState<string>();
  const viewRoles = access.permissions.includes('roles.view');
  const load = useCallback(
    async (signal: AbortSignal) => {
      const [members, roles] = await Promise.all([
        api.members(access.schoolId, signal, cursor),
        viewRoles ? api.allRoles(access.schoolId, signal) : Promise.resolve([]),
      ]);
      return { members, roles };
    },
    [access.schoolId, cursor, viewRoles],
  );
  // A separate page instance prevents stale rows from being shown while a cursor changes.
  return (
    <MemberPage
      key={cursor ?? 'first'}
      load={load}
      access={access}
      refreshAccess={refreshAccess}
      cursor={cursor}
      setCursor={setCursor}
    />
  );
}
function MemberPage({
  load,
  access,
  refreshAccess,
  cursor,
  setCursor,
}: {
  load: (
    signal: AbortSignal,
  ) => Promise<{ members: { items: Member[]; nextCursor: string | null }; roles: Role[] }>;
  access: SchoolAccess;
  refreshAccess: () => void;
  cursor?: string;
  setCursor: (cursor?: string) => void;
}) {
  const state = useRemote(load);
  const [editing, setEditing] = useState<Member | 'new' | null>(null);
  const [suspending, setSuspending] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const manage = access.permissions.includes('memberships.manage');
  const choices = state.data?.roles.filter((role) => canAssign(access, role)) ?? [];
  const editable = (member: Member) => choices.some((role) => role.id === member.roleId);
  const changed = (message: string) => {
    setNotice(message);
    state.reload();
    refreshAccess();
  };
  return (
    <LoadingOverlay
      loading={state.loading}
      size="xl"
      label="Loading school members…"
      message="Loading school members…"
    >
      <Panel
        title="School members"
        subtitle="Add existing accounts and manage their access to this school."
        action={
          manage && (
            <Button disabled={!choices.length} onClick={() => setEditing('new')}>
              Add member
            </Button>
          )
        }
      >
        <div className="live-content">
          <p>
            Create and link staff accounts using Enable login in Teachers or Staff & HR. Use this area
            to manage school access for existing accounts. Adding a member does not send an
            invitation.
          </p>
          {manage && !access.permissions.includes('roles.view') && (
            <p>
              Viewing roles is required to choose and manage member roles here. Ask your administrator
              for access.
            </p>
          )}
          {notice && <p role="status">{notice}</p>}
          {state.error && (
            <p role="alert">
              {state.error}{' '}
              <Button variant="secondary" onClick={state.reload}>
                Retry members
              </Button>
            </p>
          )}
          {!state.error && (
            <>
              <div className="live-table-wrap">
                <table className="live-table">
                  <caption className="sr-only">School memberships</caption>
                  <thead>
                    <tr>
                      <th scope="col">Member</th>
                      <th scope="col">Role</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(state.data?.members.items ?? []).map((member) => (
                      <tr key={member.id}>
                        <th scope="row">
                          {member.user?.name ?? 'Account details unavailable'}
                          <small>
                            {member.user?.email}
                            {member.id === access.membershipId ? ' · You' : ''}
                          </small>
                        </th>
                        <td>
                          {member.roleName ??
                            state.data?.roles.find((role) => role.id === member.roleId)?.name ??
                            'Role unavailable'}
                        </td>
                        <td>{member.status === 'active' ? 'Active' : 'Suspended'}</td>
                        <td>
                          {manage && editable(member) ? (
                            <div className="live-actions">
                              <Button variant="secondary" onClick={() => setEditing(member)}>
                                Edit <span className="sr-only">{member.user?.name ?? 'member'}</span>
                              </Button>
                              {member.status === 'active' && (
                                <Button
                                  variant="danger"
                                  onClick={() => {
                                    setError('');
                                    setSuspending(member);
                                  }}
                                >
                                  Suspend{' '}
                                  <span className="sr-only">{member.user?.name ?? 'member'}</span>
                                </Button>
                              )}
                            </div>
                          ) : (
                            'Read only'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {state.data && state.data.members.items.length === 0 && <p>No members on this page.</p>}
              {state.data && (
                <div className="live-actions">
                  {cursor && (
                    <Button variant="secondary" onClick={() => setCursor(undefined)}>
                      First page
                    </Button>
                  )}
                  {state.data.members.nextCursor && (
                    <Button
                      variant="secondary"
                      onClick={() => setCursor(state.data!.members.nextCursor!)}
                    >
                      Next members
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      {editing && (
        <MemberEditor
          member={editing === 'new' ? undefined : editing}
          roles={choices}
          schoolId={access.schoolId}
          close={() => setEditing(null)}
          saved={() => {
            setEditing(null);
            changed('Membership saved.');
          }}
        />
      )}
      <Modal
        open={!!suspending}
        onClose={() => {
          if (!busy) setSuspending(null);
        }}
        title="Suspend school access?"
        description="This removes access to this school. The account and membership record are retained."
      >
        <div className="live-content">
          <p>
            Suspend {suspending?.user?.name ?? 'this member'}? The last active owner cannot be
            suspended.
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="live-actions">
            <Button variant="secondary" disabled={busy} onClick={() => setSuspending(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                if (!suspending) return;
                setBusy(true);
                setError('');
                try {
                  await api.suspendMember(access.schoolId, suspending.id);
                  setSuspending(null);
                  changed('School access suspended.');
                } catch (cause) {
                  setError(accessError(cause, 'member'));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Suspending…' : 'Confirm suspension'}
            </Button>
          </div>
        </div>
      </Modal>
      </Panel>
    </LoadingOverlay>
  );
}
function MemberEditor({
  member,
  roles,
  schoolId,
  close,
  saved,
}: {
  member?: Member;
  roles: Role[];
  schoolId: string;
  close: () => void;
  saved: () => void;
}) {
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState(member?.roleId ?? '');
  const [status, setStatus] = useState<'active' | 'suspended'>(member?.status ?? 'active');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Modal
      open
      onClose={() => {
        if (!busy) close();
      }}
      title={member ? 'Edit school membership' : 'Add school member'}
      description={
        member
          ? 'Changes take effect on the next backend request, including your own access.'
          : 'Enter the email of an existing active account and choose its role.'
      }
    >
      <form
        className="live-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || !roleId) return;
          setBusy(true);
          setError('');
          try {
            if (member) await api.updateMember(schoolId, member.id, { roleId, status });
            else await api.addMember(schoolId, email.trim().toLowerCase(), roleId);
            saved();
          } catch (cause) {
            setError(accessError(cause, 'member'));
          } finally {
            setBusy(false);
          }
        }}
      >
        {member ? (
          <p>
            {member.user?.name} · {member.user?.email}
          </p>
        ) : (
          <label>
            Account email
            <input
              type="email"
              autoComplete="off"
              required
              value={email}
              disabled={busy}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
        )}
        <label>
          Assigned role
          <select
            required
            value={roleId}
            disabled={busy}
            onChange={(event) => setRoleId(event.target.value)}
          >
            <option value="">Choose a role</option>
            {roles.map((role) => (
              <option value={role.id} key={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
        {member && (
          <label>
            Membership status
            <select
              value={status}
              disabled={busy}
              onChange={(event) => setStatus(event.target.value as 'active' | 'suspended')}
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="live-actions">
          <Button type="button" variant="secondary" disabled={busy} onClick={close}>
            Cancel
          </Button>
          <Button disabled={busy || !roleId}>{busy ? 'Saving…' : 'Save membership'}</Button>
        </div>
      </form>
    </Modal>
  );
}
