import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, ArrowLeft } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { Button, EmptyState, Panel } from '../../components/ui/Primitives';
import DeleteDialog from '../../components/shared/DeleteDialog';
import { defaultStaffPayroll } from '../../lib/settings';
import { staffDirectory, staffLabel } from '../../lib/staffStructure';
import { repository } from '../../lib/repository';
import StaffStructureDialog from './StaffStructureDialog';
import StaffDialog from '../teachers/StaffDialog';
import { useToday } from '../../app/useToday';
import { salaryForMonth, salaryNet } from '../../lib/staffSalary';
import { money } from '../../lib/config';
import '../../styles/staff-structure.css';

export default function StaffDepartments() {
  const state = useSchool(),
    notify = useFeedback();
  const config = state.staffPayroll ?? defaultStaffPayroll,
    departments = config.setup.departments;
  const members = staffDirectory(state, config);
  const month = useToday().slice(0, 7);
  const [editingStaff, setEditingStaff] = useState<string | null>(null);
  const [selected, setSelected] = useState('');
  const department = departments.find((d) => d.id === selected);
  const [editing, setEditing] = useState<{
    kind: 'Department' | 'Designation';
    id?: string;
    name?: string;
  } | null>(null);
  const [deleting, setDeleting] = useState<{
    kind: 'Department' | 'Designation';
    id: string;
    name: string;
    departmentId?: string;
  } | null>(null);
  return (
    <Panel
      className="staff-departments-panel"
      title="Departments & Staff"
      subtitle="Select a department to add staff and manage their salary details."
      action={
        <Button variant="secondary" onClick={() => setEditing({ kind: 'Department' })}>
          <Plus size={15} />
          Add Department
        </Button>
      }
    >
      {department ? (
        <div className="staff-department-detail">
          <Button variant="ghost" onClick={() => setSelected('')}>
            <ArrowLeft size={14} />
            All departments
          </Button>
          <div className="staff-department-heading">
            <div>
              <h3>{department.name}</h3>
              <p>{members.filter((m) => m.departmentId === department.id).length} staff</p>
            </div>
            <Button
              variant="ghost"
              aria-label={`Edit department ${department.name}`}
              onClick={() =>
                setEditing({ kind: 'Department', id: department.id, name: department.name })
              }
            >
              <Pencil size={14} />
              Edit
            </Button>
            <Button
              variant="ghost"
              aria-label={`Delete department ${department.name}`}
              onClick={() =>
                setDeleting({ kind: 'Department', id: department.id, name: department.name })
              }
            >
              <Trash2 size={14} />
            </Button>
          </div>
          <div className="staff-designation-heading">
            <h4>Staff</h4>
            <Button variant="secondary" onClick={() => setEditingStaff('')}>
              <Plus size={14} />
              Add Staff
            </Button>
          </div>
          {members.some((member) => member.departmentId === department.id) ? (
            <ul className="department-staff-list">
              {members
                .filter((member) => member.departmentId === department.id)
                .map((member) => {
                  const salary = salaryForMonth(member, month);
                  return (
                    <li key={member.id}>
                      <div>
                        <strong>{staffLabel(member, config)}</strong>
                        <p>
                          {salary
                            ? `${money(salaryNet(salary))} / month`
                            : 'Salary not set for this month'}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        aria-label={`Edit staff ${member.name}`}
                        onClick={() => setEditingStaff(member.id)}
                      >
                        <Pencil size={14} />
                      </Button>
                    </li>
                  );
                })}
            </ul>
          ) : (
            <EmptyState
              title="No staff in this department"
              description="Add a staff member with their name, designation and salary."
            />
          )}
          <Link className="text-link" to={`/staff?department=${department.id}`}>
            View this department's staff
          </Link>
        </div>
      ) : departments.length ? (
        <div
          className="staff-department-table"
          role="region"
          aria-label="Department list"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Department</th>
                <th scope="col">Staff</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id}>
                  <th scope="row">
                    <button
                      type="button"
                      className="staff-department-link"
                      onClick={() => setSelected(d.id)}
                    >
                      {d.name}
                    </button>
                  </th>
                  <td>{members.filter((m) => m.departmentId === d.id).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="Add your first department"
          description="Create a department, then add your staff."
        />
      )}
      {editing && (
        <StaffStructureDialog
          key={`${editing.kind}-${editing.id ?? 'new'}`}
          kind={editing.kind}
          id={editing.id}
          initialName={editing.name}
          departmentId={department?.id}
          onClose={() => setEditing(null)}
        />
      )}
      {editingStaff !== null && department && (
        <StaffDialog
          key={editingStaff || department.id}
          staffId={editingStaff || undefined}
          departmentId={department.id}
          onClose={() => setEditingStaff(null)}
        />
      )}
      {deleting && (
        <DeleteDialog
          title={`Delete ${deleting.name}?`}
          description={
            deleting.kind === 'Department'
              ? 'This removes the department and its designations. Departments with staff must be reassigned first.'
              : 'This designation can be removed only when no staff member uses it.'
          }
          onClose={() => setDeleting(null)}
          onDelete={() => {
            if (deleting.kind === 'Department') repository.deleteStaffDepartment(deleting.id);
            else repository.deleteStaffDesignation(deleting.departmentId ?? '', deleting.id);
            notify(`${deleting.kind} removed.`);
          }}
        />
      )}
    </Panel>
  );
}
