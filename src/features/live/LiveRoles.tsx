import { permissionGroup, permissionDependencies, togglePermission } from './permissionChoices';
import SectionNavigation from '../../components/shared/SectionNavigation';
import { titleCase } from '../../lib/displayFormat';
import { useCallback, useState } from 'react';
import { Button, Modal, Panel, LoadingOverlay } from '../../components/ui/Primitives';
import {
  schoolAccessService as api,
  canAssign,
  accessError,
  permissionLabel,
  type Role,
  type SchoolAccess,
  type PermissionCatalog,
} from '../../services/schoolAccessService';
import { useRemote } from './useRemote';
export default function LiveRoles({
  access,
  refreshAccess,
}: {
  access: SchoolAccess;
  refreshAccess: () => void;
}) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      const [roles, catalog] = await Promise.all([
        api.allRoles(access.schoolId, signal),
        api.catalog(signal),
      ]);
      return { roles, catalog };
    },
    [access.schoolId],
  );
  const state = useRemote(load);
  const [editing, setEditing] = useState<Role | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const manage = access.permissions.includes('roles.manage');
  const changed = (message: string) => {
    setNotice(message);
    state.reload();
    refreshAccess();
  };
  return (
    <Panel
      title="Roles and permissions"
      subtitle="Permissions apply only to the selected school."
      action={
        manage && (
          <Button disabled={!state.data} onClick={() => setEditing('new')}>
            Create role
          </Button>
        )
      }
    >
      <div className="live-content">
        {notice && <p role="status">{notice}</p>}
        {state.error && (
          <p role="alert">
            {state.error}{' '}
            <Button variant="secondary" onClick={state.reload}>
              Retry roles
            </Button>
          </p>
        )}
        <LoadingOverlay
          loading={state.loading}
          size="xl"
          label="Loading roles & permissions…"
          message="Loading roles & permissions…"
        >
          {state.data ? (
            <div className="live-table-wrap">
              <table className="live-table">
                <caption className="sr-only">School roles</caption>
                <thead>
                  <tr>
                    <th scope="col">Role</th>
                    <th scope="col">Permissions</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.roles.map((role) => (
                    <tr key={role.id}>
                      <th scope="row">
                        {titleCase(role.name)}
                        {role.description && <small>{role.description}</small>}
                        <small>{role.memberCount ?? 0} school members</small>
                        {role.builtinKey && <small>Protected owner role</small>}
                      </th>
                      <td>
                        {role.permissions.length
                          ? role.permissions.map(permissionLabel).join(', ')
                          : 'No permissions'}
                      </td>
                      <td>
                        {manage && !role.builtinKey && canAssign(access, role) ? (
                          <div className="live-actions">
                            <Button variant="secondary" onClick={() => setEditing(role)}>
                              Edit <span className="sr-only">{titleCase(role.name)}</span>
                            </Button>
                            <Button
                              variant="danger"
                              onClick={() => {
                                setError('');
                                setDeleting(role);
                              }}
                            >
                              Delete <span className="sr-only">{titleCase(role.name)}</span>
                            </Button>
                          </div>
                        ) : (
                          'Read only'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {state.data.roles.length === 0 && <p>No roles have been created.</p>}
            </div>
          ) : (
            <div style={{ minHeight: '260px' }} />
          )}
        </LoadingOverlay>
        {!manage && <p>You can view roles. Managing them requires additional permission.</p>}
      </div>
      {editing && state.data && (
        <RoleEditor
          key={editing === 'new' ? 'new' : editing.id}
          role={editing === 'new' ? undefined : editing}
          access={access}
          catalog={state.data.catalog}
          close={() => setEditing(null)}
          saved={() => {
            setEditing(null);
            changed('Role saved.');
          }}
        />
      )}
      <Modal
        open={!!deleting}
        onClose={() => {
          if (!busy) setDeleting(null);
        }}
        title="Delete role?"
        description="Only unassigned custom roles can be deleted. Suspended members still count as assigned."
      >
        <div className="live-content">
          <p>
            Delete {deleting?.name}? {deleting?.memberCount ?? 0} school members currently use this
            role.
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="live-actions">
            <Button variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                if (!deleting) return;
                setBusy(true);
                setError('');
                try {
                  await api.deleteRole(access.schoolId, deleting.id);
                  setDeleting(null);
                  changed('Role deleted.');
                } catch (cause) {
                  setError(accessError(cause, 'role'));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Deleting…' : 'Confirm delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </Panel>
  );
}
function RoleEditor({
  role,
  access,
  catalog,
  close,
  saved,
}: {
  role?: Role;
  access: SchoolAccess;
  catalog: PermissionCatalog;
  close: () => void;
  saved: () => void;
}) {
  const [permissionTab, setPermissionTab] = useState('view');
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description || '');
  const [permissions, setPermissions] = useState(role?.permissions ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Modal
      open
      onClose={() => {
        if (!busy) close();
      }}
      title={role ? 'Edit role' : 'Create role'}
      description="Grant only the access this role needs. You can grant permissions you hold yourself."
    >
      <form
        className="live-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!name.trim() || busy) return;
          setBusy(true);
          setError('');
          try {
            await api.saveRole(
              access.schoolId,
              { name: name.trim(), permissions, description },
              role?.id,
            );
            saved();
          } catch (cause) {
            setError(accessError(cause, 'role'));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Role name
          <input
            required
            maxLength={80}
            value={name}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          Description (optional)
          <textarea
            maxLength={300}
            value={description}
            disabled={busy}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <SectionNavigation
          label="Permission categories"
          value={permissionTab}
          onChange={setPermissionTab}
          items={[
            { id: 'view', label: 'View' },
            { id: 'manage', label: 'Manage' },
          ]}
        />
        <p>
          {permissions.length} permissions selected across both tabs. View allows reading; Manage
          allows changes. Salary approval and payment are separate choices.
        </p>
        <fieldset disabled={busy}>
          <legend>Permissions</legend>
          {catalog.permissions
            .filter((p) => permissionGroup(p) === permissionTab)
            .map((permission) => (
              <label className="live-check" key={permission}>
                <input
                  type="checkbox"
                  checked={permissions.includes(permission)}
                  disabled={
                    !permissionDependencies(permission, catalog.permissions).every((p) =>
                      access.permissions.includes(p),
                    )
                  }
                  onChange={(event) =>
                    setPermissions((current) =>
                      togglePermission(
                        current,
                        permission,
                        event.target.checked,
                        catalog.permissions,
                      ),
                    )
                  }
                />
                {permissionLabel(permission)}
              </label>
            ))}
        </fieldset>
        <p>Manage and view are separate permissions. These shortcuts select both when available.</p>
        <div className="live-actions">
          {Object.entries(catalog.presets).map(([name, preset]) => (
            <Button
              type="button"
              variant="secondary"
              key={name}
              disabled={
                busy ||
                !(permissionTab === 'view' ? preset.view : preset.manage).every((permission) =>
                  access.permissions.includes(permission),
                )
              }
              onClick={() =>
                setPermissions((current) => [
                  ...new Set([
                    ...current,
                    ...(permissionTab === 'view' ? preset.view : preset.manage),
                  ]),
                ])
              }
            >
              {permissionTab === 'view' ? 'View' : 'Manage'}{' '}
              {name === 'memberships' ? 'members' : name}
            </Button>
          ))}
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="live-actions">
          <Button type="button" variant="secondary" disabled={busy} onClick={close}>
            Cancel
          </Button>
          <Button disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Save role'}</Button>
        </div>
      </form>
    </Modal>
  );
}
