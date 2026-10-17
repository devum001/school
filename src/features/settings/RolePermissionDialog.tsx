import { useState } from 'react';
import { useFeedback } from '../../app/useFeedback';
import { Button, Modal } from '../../components/ui/Primitives';
import { ACCESS_MODULES, PERMISSION_LEVELS } from '../../lib/staffAccess';
import { communicationError } from '../../lib/communication';
import { repository } from '../../lib/repository';
import type { StaffRole } from '../../types/staffAccess';
import { useDraftGuard } from '../academics/useDraftGuard';

export default function RolePermissionDialog({
  role,
  onClose,
  onSaved,
}: {
  role?: StaffRole;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const notify = useFeedback();
  const [initial] = useState<StaffRole>(
    () =>
      role ?? {
        id: crypto.randomUUID(),
        name: '',
        kind: 'custom',
        scope: 'school',
        permissions: Object.fromEntries(
          ACCESS_MODULES.map((module) => [module, 'No Access']),
        ) as StaffRole['permissions'],
      },
  );
  const [draft, setDraft] = useState(initial),
    [error, setError] = useState('');
  const guard = useDraftGuard(JSON.stringify(draft) !== JSON.stringify(initial), onClose);
  return (
    <Modal
      open
      onClose={guard.confirming ? guard.keepEditing : guard.requestClose}
      title={
        guard.confirming ? 'Discard role changes?' : role ? `Edit ${role.name}` : 'Add Custom Role'
      }
      description="Choose No Access, View or Manage for each module."
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
              repository.saveStaffRole(draft);
              onSaved(draft.id);
              notify('Role permissions saved.');
              onClose();
            } catch (cause) {
              setError(communicationError(cause));
            }
          }}
        >
          <label className="field">
            Role name
            <input
              required
              minLength={2}
              maxLength={60}
              value={draft.name}
              disabled={draft.kind !== 'custom'}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          {draft.kind === 'custom' ? (
            <label className="field">
              Access scope
              <select
                aria-label="Access scope"
                value={draft.scope}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    scope: e.target.value === 'assigned' ? 'assigned' : 'school',
                  })
                }
              >
                <option value="school">All school</option>
                <option value="assigned">Assigned classes / sections only</option>
              </select>
            </label>
          ) : (
            draft.kind === 'teacher' && (
              <p className="access-note">
                Assigned classes / sections only. Staff access is limited to the teacher’s own
                record.
              </p>
            )
          )}
          <div className="access-permission-fields">
            {ACCESS_MODULES.map((module) => (
              <label className="field" key={module}>
                {module}
                <select
                  aria-label={`${module} permission`}
                  value={draft.permissions[module]}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      permissions: {
                        ...draft.permissions,
                        [module]: PERMISSION_LEVELS.find((level) => level === e.target.value)!,
                      },
                    })
                  }
                >
                  {PERMISSION_LEVELS.map((level) => (
                    <option key={level}>{level}</option>
                  ))}
                </select>
              </label>
            ))}
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
            <Button type="submit">Save role</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
