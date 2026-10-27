import { useEffect, useState } from 'react';
import { ApiError } from '../../services/apiService';
import {
  focusStudentError,
  validateStudentForm,
  type StudentFieldErrors,
} from './studentFormValidation';
import { Button, Modal } from '../../components/ui/Primitives';
import { useToday } from '../../app/useToday';
import { useFeedback } from '../../app/useFeedback';
import { productApi, type StudentRow } from '../../services/productService';
import type { onboardingApi } from '../../services/onboardingService';
import type { StudentInput } from '../../lib/management';
import {
  feeAgreementFromDraft,
  feePlanDraft,
  feePlanDraftFromLedger,
  previousYearOpeningRow,
  type FeePlanDraft,
} from '../../lib/feePlanDraft';
import { feeApi } from '../../services/feeService';
import { useDraftGuard } from '../academics/useDraftGuard';
import FeePlanEditor from './FeePlanEditor';
import StudentFields from './StudentFields';

export default function LiveStudentForm({
  schoolId,
  yearId,
  snapshot,
  initialClassId,
  initialSectionId,
  existing,
  presentation,
  close,
  saved,
}: {
  schoolId: string;
  yearId: string;
  snapshot: Awaited<ReturnType<typeof onboardingApi.structure>>;
  initialClassId?: string;
  initialSectionId?: string;
  existing?: StudentRow;
  presentation?: 'page' | 'dialog';
  close: () => void;
  saved: () => void;
}) {
  const today = useToday(),
    notify = useFeedback(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [errors, setErrors] = useState<StudentFieldErrors>({});
  const classes = snapshot.classes.filter((c) => c.status === 'active'),
    sections = snapshot.children
      .filter((c) => c.status === 'active')
      .map((s) => ({ ...s, teacherId: s.teacherId ?? '' }));
  const classId = existing?.classId || initialClassId || classes[0]?.id || '';
  const defaultDueDate =
    today < snapshot.year.start ? snapshot.year.start : today;

  const [initial] = useState<StudentInput>(() => ({
    name: existing?.student.name ?? '',
    admissionNumber: existing?.student.code ?? '',
    birthDate: existing?.student.birthDate ?? '',
    guardian: {
      name: existing?.student.guardianName ?? '',
      relation: existing?.student.guardianRelation ?? 'Parent',
      contact: existing?.student.guardianPhone || null,
    },
    address: existing?.student.address ?? '',
    status: existing?.status === 'withdrawn' ? 'inactive' : 'active',
    classId,
    sectionId: existing
      ? existing.sectionId
      : initialSectionId || sections.find((s) => s.classId === classId)?.id || '',
    rollNumber: existing?.rollNumber ?? 0,
  }));
  const [draft, setDraft] = useState(initial);
  const [initialFees, setInitialFees] = useState<FeePlanDraft>(() =>
    feePlanDraft(undefined, defaultDueDate),
  );
  const [fees, setFees] = useState<FeePlanDraft>(() =>
    feePlanDraft(undefined, defaultDueDate),
  );

  useEffect(() => {
    if (!existing?.student.id) return;
    const controller = new AbortController();
    feeApi
      .student(schoolId, existing.student.id, controller.signal)
      .then((ledger) => {
        if (controller.signal.aborted) return;
        const loaded = feePlanDraftFromLedger(ledger, yearId, defaultDueDate);
        setInitialFees(loaded);
        setFees(loaded);
      })
      .catch(() => {
        /* Keep default blank fee form if student fee ledger could not be fetched */
      });
    return () => controller.abort();
  }, [existing?.student.id, schoolId, yearId, defaultDueDate]);

  const feesChanged = JSON.stringify(fees) !== JSON.stringify(initialFees);
  const hasFeeAmount =
    Math.round(Number(fees.totalFee || 0) * 100) > 0 ||
    Math.round(Number(fees.tuitionFee || 0) * 100) > 0 ||
    (Boolean(fees.transportActive) && Math.round(Number(fees.transportFee || 0) * 100) > 0) ||
    (Boolean(fees.hostelActive) && Math.round(Number(fees.hostelFee || 0) * 100) > 0);

  const dirty =
    JSON.stringify(initial) !== JSON.stringify(draft) || feesChanged;
  const guard = useDraftGuard(dirty && !busy, close);

  return (
    <Modal
      open
      wide
      presentation={presentation ?? (existing ? 'dialog' : 'page')}
      onClose={() => {
        if (!busy) guard.requestClose();
      }}
      title={
        guard.confirming ? 'Discard student changes?' : existing ? 'Edit student' : 'Add student'
      }
      description="Keep student details, guardian contact, enrollment, and fee setup together."
    >
      {guard.confirming ? (
        <div className="modal-actions">
          <Button onClick={guard.keepEditing}>Keep editing</Button>
          <Button variant="danger" onClick={guard.discard}>
            Discard changes
          </Button>
        </div>
      ) : (
        <form
          noValidate
          data-unsaved={dirty}
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            const form = e.currentTarget;
            const issues = validateStudentForm(draft, today);
            const section = sections.find(
              (s) => s.id === draft.sectionId && s.classId === draft.classId,
            );
            if (draft.sectionId ? !section : sections.some((s) => s.classId === draft.classId))
              issues.sectionId = 'Choose an available section for this class.';
            setErrors(issues);
            if (Object.keys(issues).length) {
              focusStudentError(form);
              return;
            }
            setBusy(true);
            setError('');
            try {
              const savedPerson = await productApi.saveStudent(
                schoolId,
                yearId,
                draft.classId,
                [
                  draft.name,
                  draft.admissionNumber,
                  draft.birthDate,
                  draft.guardian.name,
                  draft.guardian.relation,
                  draft.guardian.contact ?? '',
                  draft.address,
                  String(draft.rollNumber),
                  section?.name ?? '',
                ],
                existing?.student,
                { status: draft.status, enrollmentRevision: existing?.revision },
              );

              if (!existing || feesChanged) {
                const agreement = feeAgreementFromDraft(
                  savedPerson.id,
                  fees,
                  defaultDueDate,
                );
                if (agreement) {
                  await feeApi.agreements(schoolId, yearId, [agreement]);
                }
                const oldDuePaise = Math.max(
                  0,
                  Math.round(Number(fees.previousDueAmount || 0) * 100),
                );
                if (!fees.hasExistingPreviousDue && oldDuePaise > 0) {
                  await feeApi.opening(schoolId, yearId, [
                    previousYearOpeningRow(
                      savedPerson.id,
                      oldDuePaise,
                      snapshot.year.start,
                      today,
                      fees.previousDueYearName,
                    ),
                  ]);
                }
              }

              guard.complete(saved);
              notify('Student saved.');
            } catch (cause) {
              if (cause instanceof ApiError && cause.fields) {
                setErrors(cause.fields);
                focusStudentError(form);
              }
              setError(cause instanceof Error ? cause.message : 'Unable to save student.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy} style={{ border: 0 }}>
            <StudentFields
              draft={draft}
              setDraft={(value) => {
                setDraft(value);
                setError('');
              }}
              errors={errors}
              classes={classes}
              sections={sections}
              locked={false}
              today={today}
              addressLimit={300}
              admissionLimit={40}
            />
            <p className="panel-note">
              Admission numbers are unique across the school. Roll numbers are unique within the
              selected class and section. The numeric part must be unique: SH-12 and AB-12 count as
              the same identifier.
            </p>
            <FeePlanEditor
              value={fees}
              onChange={(nextFees) => {
                setFees(nextFees);
                setError('');
              }}
              required={hasFeeAmount}
              defaultDueDate={defaultDueDate}
            />
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <Button type="button" variant="secondary" onClick={guard.requestClose}>
                Cancel
              </Button>
              <Button disabled={busy || !classes.length}>Save student</Button>
            </div>
          </fieldset>
        </form>
      )}
    </Modal>
  );
}
