import { useState } from 'react';
import { useSchool } from '../../app/useSchool';
import { useToday } from '../../app/useToday';
import { useFeedback } from '../../app/useFeedback';
import { PickerInput, Button, Modal } from '../../components/ui/Primitives';
import { repository } from '../../lib/repository';
import type { TeacherInput } from '../../lib/management';
import { useDraftGuard } from '../academics/useDraftGuard';
export default function TeacherDialog({
  teacherId,
  onClose,
}: {
  teacherId?: string;
  onClose: () => void;
}) {
  const state = useSchool();
  const today = useToday();
  const notify = useFeedback();
  const teacher = state.teachers.find((t) => t.id === teacherId);
  const [initial] = useState<TeacherInput>(() => ({
    name: teacher?.name ?? '',
    staffId: teacher?.staffId ?? '',
    subject: teacher?.subject ?? '',
    status: teacher?.status ?? 'active',
    email: teacher?.email ?? '',
    phone: teacher?.phone ?? '',
    qualification: teacher?.qualification ?? '',
    joinedOn: teacher?.joinedOn ?? today,
    sectionIds: state.sections.filter((s) => s.teacherId === teacherId).map((s) => s.id),
  }));
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState('');
  const guard = useDraftGuard(JSON.stringify(initial) !== JSON.stringify(draft), onClose);
  const field = (key: keyof TeacherInput, value: string) => setDraft({ ...draft, [key]: value });
  const replacements = state.sections.filter(
    (s) => draft.sectionIds.includes(s.id) && s.teacherId && s.teacherId !== teacherId,
  );
  return (
    <Modal
      open
      wide
      onClose={guard.confirming ? guard.keepEditing : guard.requestClose}
      title={
        guard.confirming ? 'Discard teacher changes?' : teacher ? 'Edit teacher' : 'Add teacher'
      }
      description={
        guard.confirming
          ? 'Your changes have not been saved.'
          : 'Manage staff details, contact information and class-teacher responsibilities.'
      }
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
          onSubmit={(event) => {
            event.preventDefault();
            try {
              repository.saveTeacher(draft, teacherId);
              notify(teacher ? 'Teacher and class assignments updated.' : 'Teacher added.');
              onClose();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Unable to save teacher.');
            }
          }}
        >
          <h3 className="management-form-title">Staff profile</h3>
          <div className="form-grid">
            <label className="field">
              Teacher name
              <input
                required
                maxLength={100}
                value={draft.name}
                onChange={(e) => field('name', e.target.value)}
              />
            </label>
            <label className="field">
              Staff ID
              <input
                required
                maxLength={100}
                value={draft.staffId}
                onChange={(e) => field('staffId', e.target.value)}
              />
            </label>
            <label className="field">
              Teaching subject
              <input
                required
                maxLength={100}
                value={draft.subject}
                placeholder="e.g. Mathematics"
                onChange={(e) => field('subject', e.target.value)}
              />
            </label>
            <label className="field">
              Teacher status
              <select
                aria-label="Teacher status"
                value={draft.status}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    status: e.target.value as TeacherInput['status'],
                    sectionIds: e.target.value === 'inactive' ? [] : draft.sectionIds,
                  })
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="field">
              Email (optional)
              <input
                type="email"
                value={draft.email}
                onChange={(e) => field('email', e.target.value.trim())}
              />
            </label>
            <label className="field">
              Mobile (optional)
              <input
                type="tel"
                value={draft.phone}
                placeholder="10-digit mobile or + country code"
                onChange={(e) => field('phone', e.target.value)}
              />
            </label>
            <label className="field">
              Qualification (optional)
              <input
                maxLength={150}
                value={draft.qualification}
                onChange={(e) => field('qualification', e.target.value)}
              />
            </label>
            <label className="field">
              Joining date
              <PickerInput
                required
                type="date"
                max={today}
                value={draft.joinedOn}
                onChange={(e) => field('joinedOn', e.target.value)}
              />
            </label>
          </div>
          <h3 className="management-form-title">Class-teacher assignments</h3>
          <p className="panel-note">
            Each section has one class teacher. Selecting a section replaces its current class
            teacher; subject timetables are managed separately.
          </p>
          {draft.status === 'inactive' && (
            <p className="info-banner">
              Saving an inactive teacher releases all their class-teacher assignments.
            </p>
          )}
          <div className="teacher-assignment-grid">
            {state.sections.map((section) => {
              const label = `${state.classes.find((c) => c.id === section.classId)?.name} · Section ${section.name}`;
              const assigned = state.teachers.find((t) => t.id === section.teacherId);
              return (
                <label key={section.id}>
                  <input
                    type="checkbox"
                    aria-label={`Assign ${label}`}
                    checked={draft.sectionIds.includes(section.id)}
                    disabled={draft.status === 'inactive'}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        sectionIds: e.target.checked
                          ? [...draft.sectionIds, section.id]
                          : draft.sectionIds.filter((id) => id !== section.id),
                      })
                    }
                  />
                  <span>
                    {label}
                    <small>{assigned ? `Current: ${assigned.name}` : 'Unassigned'}</small>
                  </span>
                </label>
              );
            })}
          </div>
          {replacements.length > 0 && (
            <p className="info-banner">
              Saving will replace the current class teacher in {replacements.length} selected{' '}
              {replacements.length === 1 ? 'section' : 'sections'}.
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={guard.requestClose}>
              Cancel
            </Button>
            <Button type="submit">Save teacher</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
