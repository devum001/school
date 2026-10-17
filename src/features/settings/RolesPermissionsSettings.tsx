import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { Badge, Button, EmptyState, Modal, Panel } from '../../components/ui/Primitives';
import { ACCESS_MODULES, accessStaff, staffAccessFor } from '../../lib/staffAccess';
import { defaultStaffPayroll } from '../../lib/settings';
import { communicationError } from '../../lib/communication';
import { repository } from '../../lib/repository';
import type { StaffRole } from '../../types/staffAccess';
import RolePermissionDialog from './RolePermissionDialog';
import StaffAccessDialog from './StaffAccessDialog';
import './staff-access.css';

export default function RolesPermissionsSettings() {
  const state = useSchool(),
    notify = useFeedback(),
    access = staffAccessFor(state);
  const [selected, setSelected] = useState('owner'),
    [editingRole, setEditingRole] = useState<StaffRole | 'new' | null>(null),
    [editingStaff, setEditingStaff] = useState<string | null>(null),
    [deleting, setDeleting] = useState<StaffRole | null>(null),
    [query, setQuery] = useState(''),
    [departmentId, setDepartment] = useState(''),
    [error, setError] = useState('');
  const role = access.roles.find((item) => item.id === selected) ?? access.roles[0];
  const departments = (state.staffPayroll ?? defaultStaffPayroll).setup.departments;
  const members = accessStaff(state).filter(
    (member) =>
      member.name.toLowerCase().includes(query.toLowerCase()) &&
      (!departmentId || member.departmentId === departmentId),
  );
  const showOwner =
    !departmentId &&
    (!query || (state.school.principal ?? '').toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="staff-access-settings">
      <Panel
        title="Roles"
        subtitle="Staff permissions: No Access, View or Manage."
        action={
          <Button variant="secondary" onClick={() => setEditingRole('new')}>
            <Plus size={16} /> Add Custom Role
          </Button>
        }
      >
        <div className="panel-padding">
          <div className="access-role-toolbar">
            <label className="field">
              Role
              <select
                aria-label="Role"
                value={role.id}
                onChange={(e) => setSelected(e.target.value)}
              >
                {access.roles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="access-role-actions">
              {role.kind !== 'owner' && (
                <Button variant="secondary" onClick={() => setEditingRole(role)}>
                  <Pencil size={15} /> Edit permissions
                </Button>
              )}
              {role.kind === 'custom' && (
                <Button
                  variant="ghost"
                  aria-label={`Delete ${role.name} role`}
                  onClick={() => setDeleting(role)}
                >
                  <Trash2 size={16} />
                </Button>
              )}
            </div>
          </div>
          <p className="settings-copy">
            {role.kind === 'teacher'
              ? 'Assigned classes / sections only. Teachers see their own staff record.'
              : role.scope === 'assigned'
                ? 'Assigned classes / sections only.'
                : 'School-wide access to the permitted modules.'}
          </p>
          <div className="table-wrap" role="region" aria-label="Role permissions" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Module</th>
                  <th scope="col">Permission</th>
                  <th scope="col">Scope</th>
                </tr>
              </thead>
              <tbody>
                {ACCESS_MODULES.map((module) => (
                  <tr key={module}>
                    <th scope="row">{module}</th>
                    <td>{role.permissions[module]}</td>
                    <td>
                      {role.permissions[module] === 'No Access'
                        ? '—'
                        : role.kind === 'teacher' && module === 'Staff'
                          ? 'Own record'
                          : role.scope === 'assigned'
                            ? 'Assigned classes / sections'
                            : 'All school'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
      <Panel
        title="Staff Access"
        subtitle="Assign a role and allow or disable login for a staff member."
      >
        <div className="panel-padding">
          <div className="access-staff-filters">
            <label className="field">
              Search staff
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <label className="field">
              Department
              <select
                aria-label="Staff access department"
                value={departmentId}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="">All departments</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="table-wrap" role="region" aria-label="Staff login access" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Staff</th>
                  <th scope="col">Role</th>
                  <th scope="col">Access scope</th>
                  <th scope="col">Login allowed</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {showOwner && (
                  <tr>
                    <th scope="row">
                      {state.school.principal || 'School owner'}
                      <small className="access-cell-note">Current workspace owner</small>
                    </th>
                    <td>Principal / Owner</td>
                    <td>All school</td>
                    <td>
                      <Badge tone="green">Allowed</Badge>
                    </td>
                    <td>Protected</td>
                  </tr>
                )}
                {members.map((member) => {
                  const entry = access.staff.find((item) => item.staffId === member.id)!,
                    staffRole = access.roles.find((item) => item.id === entry.roleId);
                  return (
                    <tr key={member.id}>
                      <th scope="row">
                        {member.name}
                        {member.status !== 'active' && (
                          <small className="access-cell-note">Inactive staff</small>
                        )}
                      </th>
                      <td>{staffRole?.name ?? 'Role not assigned'}</td>
                      <td>
                        {staffRole?.scope === 'assigned'
                          ? `${entry.sectionIds.filter((id) => state.sections.some((section) => section.id === id && section.schoolId === state.school.id)).length} assigned sections`
                          : 'All school'}
                      </td>
                      <td>
                        <Badge
                          tone={
                            entry.loginAllowed && member.status === 'active' ? 'green' : 'neutral'
                          }
                        >
                          {entry.loginAllowed && member.status === 'active'
                            ? 'Allowed'
                            : 'Disabled'}
                        </Badge>
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          aria-label={`Edit access for ${member.name}`}
                          onClick={() => setEditingStaff(member.id)}
                        >
                          Edit access
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!members.length && !showOwner && (
            <EmptyState title="No matching staff" description="Try another name or department." />
          )}
          <p className="access-note">
            Access configuration preview. Student and guardian records have no login access.
          </p>
        </div>
      </Panel>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {editingRole && (
        <RolePermissionDialog
          role={editingRole === 'new' ? undefined : editingRole}
          onClose={() => setEditingRole(null)}
          onSaved={(id) => setSelected(id)}
        />
      )}
      {editingStaff && (
        <StaffAccessDialog staffId={editingStaff} onClose={() => setEditingStaff(null)} />
      )}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete custom role?"
        description={`Remove ${deleting?.name ?? 'this role'}. Roles assigned to staff must be reassigned first.`}
      >
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button
            variant="secondary"
            onClick={() => {
              setDeleting(null);
              setError('');
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              try {
                if (deleting) repository.deleteStaffRole(deleting.id);
                setDeleting(null);
                setError('');
                setSelected('owner');
                notify('Custom role deleted.');
              } catch (cause) {
                setError(communicationError(cause));
              }
            }}
          >
            Delete role
          </Button>
        </div>
      </Modal>
    </div>
  );
}
