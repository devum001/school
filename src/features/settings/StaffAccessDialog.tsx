import { useState } from 'react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { Button, Modal } from '../../components/ui/Primitives';
import {
  accessStaff,
  staffAccessFor,
  scopedStaffStudents,
  staffPermission,
  saveStaffLoginAccess,
  ACCESS_MODULES,
} from '../../lib/staffAccess';
import { communicationError } from '../../lib/communication';
import { repository } from '../../lib/repository';
import { useDraftGuard } from '../academics/useDraftGuard';

export default function StaffAccessDialog({
  staffId,
  onClose,
}: {
  staffId: string;
  onClose: () => void;
}) {
  const state = useSchool(),
    notify = useFeedback(),
    access = staffAccessFor(state);
  const member = accessStaff(state).find((item) => item.id === staffId)!;
  const [initial] = useState(() =>
    structuredClone(access.staff.find((item) => item.staffId === staffId)!),
  );
  const [draft, setDraft] = useState(initial),
    [error, setError] = useState('');
  const role = access.roles.find((item) => item.id === draft.roleId);
  const guard = useDraftGuard(JSON.stringify(draft) !== JSON.stringify(initial), onClose);
  let preview = state;
  try {
    preview = saveStaffLoginAccess(state, draft);
  } catch {
    /* Invalid drafts show no preview until saved. */
  }
  const previewValid = preview !== state;
  const students = previewValid ? scopedStaffStudents(preview, staffId) : [];
  return (
    <Modal
      open
      wide
      onClose={guard.confirming ? guard.keepEditing : guard.requestClose}
      title={guard.confirming ? 'Discard access changes?' : `${member.name} — Staff Access`}
      description="Assign a staff role and decide whether login is allowed."
    >
      {guard.confirming ? (
        <div className="modal-actions">
          <Button variant="secondary" onClick={guard.keepEditing}>
            Keep editing
          </Button>
          <Button variant="danger" onClick={guard.discard}>
            Discard changes
          </Button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              repository.saveStaffLoginAccess(draft);
              notify('Staff access saved.');
              onClose();
            } catch (cause) {
              setError(communicationError(cause));
            }
          }}
        >
          <div className="form-grid">
            <label className="field">
              Staff role
              <select
                aria-label="Staff role"
                value={draft.roleId}
                onChange={(e) => setDraft({ ...draft, roleId: e.target.value })}
              >
                {access.roles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="access-login-field">
              <input
                type="checkbox"
                checked={draft.loginAllowed}
                disabled={member.status !== 'active'}
                onChange={(e) => setDraft({ ...draft, loginAllowed: e.target.checked })}
              />{' '}
              Login allowed
            </label>
          </div>
          {member.status !== 'active' && (
            <p className="access-note">Activate the staff record before allowing login.</p>
          )}
          {role?.scope === 'assigned' && (
            <fieldset className="access-section-list">
              <legend>Assigned classes / sections only</legend>
              {state.sections
                .filter((section) => section.schoolId === state.school.id)
                .map((section) => (
                  <label key={section.id}>
                    <input
                      type="checkbox"
                      checked={draft.sectionIds.includes(section.id)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          sectionIds: e.target.checked
                            ? [...draft.sectionIds, section.id]
                            : draft.sectionIds.filter((id) => id !== section.id),
                        })
                      }
                    />{' '}
                    {state.classes.find((item) => item.id === section.classId)?.name} ·{' '}
                    {section.name}
                  </label>
                ))}
            </fieldset>
          )}
          <div className="access-preview" role="region" aria-label="Staff access preview">
            <h3>Access preview</h3>
            {!draft.loginAllowed ? (
              <p>Login disabled.</p>
            ) : !previewValid ? (
              <p>Complete the assigned sections to preview access.</p>
            ) : (
              <>
                <dl>
                  {ACCESS_MODULES.map((module) => (
                    <div key={module}>
                      <dt>{module}</dt>
                      <dd>{staffPermission(preview, staffId, module)}</dd>
                    </div>
                  ))}
                </dl>
                <p>
                  {students.length} accessible student records
                  {role?.scope === 'assigned' ? ' in assigned sections' : ''}.
                </p>
                <ul>
                  {students.slice(0, 5).map((row) => (
                    <li key={row.enrollment.id}>
                      {row.student.name} · {row.className} {row.sectionName}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={guard.requestClose}>
              Cancel
            </Button>
            <Button type="submit">Save staff access</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
