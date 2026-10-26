import { identifierKey, rollKey } from '../../lib/studentIdentifiers';
import {
  focusStudentError,
  validateStudentForm,
  type StudentFieldErrors,
} from './studentFormValidation';
import StudentFields from './StudentFields';
import { useState } from 'react';
import { useSchool } from '../../app/useSchool';
import { useToday } from '../../app/useToday';
import { useFeedback } from '../../app/useFeedback';
import { Button, Modal } from '../../components/ui/Primitives';
import { repository } from '../../lib/repository';
import { studentRecordCounts, type StudentInput } from '../../lib/management';
import { orderedClasses } from '../../lib/schoolLabels';
import { useDraftGuard } from '../academics/useDraftGuard';
import '../../styles/management.css';
import { currentFeePlan } from '../../lib/feePlans';
import FeePlanEditor from './FeePlanEditor';
import { feePlanDraft, feePlanInput } from '../../lib/feePlanDraft';
import { communicationError } from '../../lib/communication';
export default function StudentDialog({
  studentId,
  initialSectionId,
  initialClassId,
  presentation = 'dialog',
  onClose,
}: {
  studentId?: string;
  initialSectionId?: string;
  initialClassId?: string;
  presentation?: 'dialog' | 'page';
  onClose: () => void;
}) {
  const state = useSchool();
  const today = useToday();
  const notify = useFeedback();
  const student = state.students.find((s) => s.id === studentId);
  const enrollment = state.enrollments.find(
    (e) => e.studentId === studentId && e.academicYearId === state.academicYear.id,
  );
  const requestedSection = state.sections.find(
    (section) => section.schoolId === state.school.id && section.id === initialSectionId,
  );
  const startingClass =
    state.classes.find(
      (item) =>
        item.schoolId === state.school.id &&
        item.id === (requestedSection?.classId ?? initialClassId),
    ) ?? orderedClasses(state.classes.filter((item) => item.schoolId === state.school.id))[0];
  const startingSection =
    requestedSection ??
    state.sections.find(
      (section) => section.schoolId === state.school.id && section.classId === startingClass?.id,
    );
  const [initial] = useState<StudentInput>(() => ({
    name: student?.name ?? '',
    admissionNumber: student?.admissionNumber ?? '',
    status: student?.status ?? 'active',
    birthDate: student?.birthDate ?? '',
    address: student?.address ?? '',
    guardian: student?.guardian ?? { name: '', relation: 'Parent', contact: null },
    classId: enrollment?.classId ?? startingClass?.id ?? '',
    sectionId: enrollment?.sectionId ?? startingSection?.id ?? '',
    rollNumber: enrollment?.rollNumber ?? 0,
  }));
  const [draft, setDraft] = useState(initial);
  const [initialFees] = useState(() =>
    feePlanDraft(enrollment ? currentFeePlan(state, enrollment.id) : undefined),
  );
  const [fees, setFees] = useState(initialFees);
  const feesChanged = JSON.stringify(fees) !== JSON.stringify(initialFees);
  const [errors, setErrors] = useState<StudentFieldErrors>({});
  const [error, setError] = useState('');
  const locked = Boolean(
    student && Object.values(studentRecordCounts(state, student.id)).some(Boolean),
  );
  const guard = useDraftGuard(
    JSON.stringify(initial) !== JSON.stringify(draft) || feesChanged,
    onClose,
  );
  return (
    <Modal
      open
      wide
      presentation={presentation}
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
            const issues = validateStudentForm(draft, today, 500, 100);
            if (
              state.students.some(
                (s) =>
                  s.schoolId === state.school.id &&
                  s.id !== studentId &&
                  identifierKey(s.admissionNumber) === identifierKey(draft.admissionNumber),
              )
            )
              issues.admissionNumber =
                'This admission number numeric part is already used in your school.';
            if (
              state.enrollments.some(
                (e) =>
                  e.studentId !== studentId &&
                  e.academicYearId === state.academicYear.id &&
                  e.classId === draft.classId &&
                  e.sectionId === draft.sectionId &&
                  rollKey(e.rollNumber) === rollKey(draft.rollNumber),
              )
            )
              issues.rollNumber =
                'This roll number numeric part is already used in this class and section.';
            setErrors(issues);
            if (Object.keys(issues).length) {
              focusStudentError(event.currentTarget);
              return;
            }
            try {
              repository.saveStudent(
                {
                  ...draft,
                  feePlan: !student || feesChanged ? feePlanInput(fees) : undefined,
                },
                studentId,
              );
              notify(student ? 'Student updated.' : 'Student added to the directory.');
              guard.complete();
            } catch (err) {
              setError(communicationError(err));
            }
          }}
        >
          <StudentFields
            errors={errors}
            draft={draft}
            setDraft={setDraft}
            classes={state.classes}
            sections={state.sections}
            locked={locked}
            today={today}
          />
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
