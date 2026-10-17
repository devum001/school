import { useState } from 'react';
import { useSchool } from '../../app/useSchool';
import { useToday } from '../../app/useToday';
import { useFeedback } from '../../app/useFeedback';
import { Button, Modal } from '../../components/ui/Primitives';
import { repository } from '../../lib/repository';
import { studentRecordCounts, type StudentInput } from '../../lib/management';
import { orderedClasses, sectionLabel } from '../../lib/schoolLabels';
import { useDraftGuard } from '../academics/useDraftGuard';
import '../../styles/management.css';
import { currentFeePlan } from '../../lib/feePlans';
import FeePlanEditor from './FeePlanEditor';
import { feePlanDraft, feePlanInput } from '../../lib/feePlanDraft';
import { nextAdmissionNumber, studentRollPreview } from '../../lib/studentNumbering';
import { communicationError } from '../../lib/communication';
export default function StudentDialog({
  studentId,
  initialSectionId,
  onClose,
}: {
  studentId?: string;
  initialSectionId?: string;
  onClose: () => void;
}) {
  const state = useSchool();
  const today = useToday();
  const notify = useFeedback();
  const student = state.students.find((s) => s.id === studentId);
  const enrollment = state.enrollments.find(
    (e) => e.studentId === studentId && e.academicYearId === state.academicYear.id,
  );
  const [initial] = useState<StudentInput>(() => ({
    name: student?.name ?? '',
    admissionNumber: student?.admissionNumber ?? '',
    status: student?.status ?? 'active',
    birthDate: student?.birthDate ?? '',
    address: student?.address ?? '',
    guardian: student?.guardian ?? { name: '', relation: 'Parent', contact: null },
    classId:
      enrollment?.classId ??
      state.sections.find((s) => s.id === initialSectionId)?.classId ??
      state.classes[0]?.id ??
      '',
    sectionId: enrollment?.sectionId ?? initialSectionId ?? state.sections[0]?.id ?? '',
    rollNumber: enrollment?.rollNumber ?? 1,
  }));
  const [draft, setDraft] = useState(initial);
  const admission = student?.admissionNumber ?? nextAdmissionNumber(state);
  const roll = studentRollPreview(state, { ...draft, id: studentId, admissionNumber: admission });
  const [initialFees] = useState(() =>
    feePlanDraft(enrollment ? currentFeePlan(state, enrollment.id) : undefined),
  );
  const [fees, setFees] = useState(initialFees);
  const feesChanged = JSON.stringify(fees) !== JSON.stringify(initialFees);
  const [error, setError] = useState('');
  const locked = Boolean(
    student && Object.values(studentRecordCounts(state, student.id)).some(Boolean),
  );
  const guard = useDraftGuard(
    JSON.stringify(initial) !== JSON.stringify(draft) || feesChanged,
    onClose,
  );
  const field = (key: keyof StudentInput, value: string | number) =>
    setDraft({ ...draft, [key]: value });
  return (
    <Modal
      open
      wide
      onClose={guard.confirming ? guard.keepEditing : guard.requestClose}
      title={
        guard.confirming ? 'Discard student changes?' : student ? 'Edit student' : 'Add student'
      }
      description={
        guard.confirming
          ? 'Your changes have not been saved.'
          : 'Keep student details, guardian contact and enrollment together.'
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
              repository.saveStudent(
                {
                  ...draft,
                  admissionNumber: student?.admissionNumber ?? '',
                  rollNumber: roll,
                  feePlan: !student || feesChanged ? feePlanInput(fees) : undefined,
                },
                studentId,
              );
              notify(student ? 'Student updated.' : 'Student added to the directory.');
              onClose();
            } catch (err) {
              setError(communicationError(err));
            }
          }}
        >
          <h3 className="management-form-title">Student details</h3>
          <div className="form-grid">
            <label className="field">
              Student name
              <input
                required
                maxLength={100}
                value={draft.name}
                onChange={(e) => field('name', e.target.value)}
              />
            </label>
            <label className="field">
              Admission number
              <input readOnly value={admission} />
            </label>
            <label className="field">
              Date of birth
              <input
                required
                type="date"
                max={today}
                value={draft.birthDate}
                onChange={(e) => field('birthDate', e.target.value)}
              />
            </label>
            <label className="field">
              Enrollment status
              <select
                aria-label="Enrollment status"
                value={draft.status}
                onChange={(e) => field('status', e.target.value)}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="field">
              Student class
              <select
                aria-label="Student class"
                disabled={locked}
                value={draft.classId}
                onChange={(e) => {
                  const sectionId =
                    state.sections.find((s) => s.classId === e.target.value)?.id ?? '';
                  setDraft({
                    ...draft,
                    classId: e.target.value,
                    sectionId,
                  });
                }}
              >
                {orderedClasses(state.classes).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Student section
              <select
                aria-label="Student section"
                disabled={locked}
                value={draft.sectionId}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    sectionId: e.target.value,
                  })
                }
              >
                {!state.sections.some((s) => s.classId === draft.classId) && (
                  <option value="">Add a section in School Settings first</option>
                )}
                {state.sections
                  .filter((s) => s.classId === draft.classId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {sectionLabel(s.name)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              Roll number
              <input readOnly value={draft.name.trim() ? roll : 'Assigned by name'} />
            </label>
          </div>
          {locked && (
            <p className="panel-note">
              Class and section are fixed for this enrollment because it has saved records. Name,
              contact and status can still be updated.
            </p>
          )}
          <h3 className="management-form-title">Parent / guardian</h3>
          <div className="form-grid">
            <label className="field">
              Guardian name
              <input
                required
                maxLength={100}
                value={draft.guardian.name}
                onChange={(e) =>
                  setDraft({ ...draft, guardian: { ...draft.guardian, name: e.target.value } })
                }
              />
            </label>
            <label className="field">
              Relationship
              <input
                required
                maxLength={100}
                value={draft.guardian.relation}
                onChange={(e) =>
                  setDraft({ ...draft, guardian: { ...draft.guardian, relation: e.target.value } })
                }
              />
            </label>
            <label className="field span-two">
              Parent mobile (optional)
              <input
                type="tel"
                value={draft.guardian.contact ?? ''}
                placeholder="10-digit mobile or + country code"
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    guardian: { ...draft.guardian, contact: e.target.value.trim() || null },
                  })
                }
              />
            </label>
            <label className="field span-two">
              Address (optional)
              <textarea
                aria-label="Address (optional)"
                rows={2}
                maxLength={500}
                value={draft.address}
                onChange={(e) => field('address', e.target.value)}
              />
            </label>
          </div>
          <p className="panel-note">
            Inactive students retain their records and leave active attendance and test registers.
          </p>
          <FeePlanEditor
            value={fees}
            onChange={setFees}
            required={!student || !!initialFees.totalFee || feesChanged}
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={guard.requestClose}>
              Cancel
            </Button>
            <Button type="submit">Save student</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
