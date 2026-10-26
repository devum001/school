import type { StudentField, StudentFieldErrors } from './studentFormValidation';
import './student-fields.css';
import { PickerInput } from '../../components/ui/Primitives';
import { orderedClasses, sectionLabel } from '../../lib/schoolLabels';
import type { StudentInput } from '../../lib/management';
import type { SchoolClass, Section } from '../../types/domain';
export default function StudentFields({
  draft,
  setDraft,
  classes,
  sections,
  locked,
  today,
  admissionLimit = 100,
  addressLimit = 500,
  errors = {},
}: {
  draft: StudentInput;
  setDraft: (value: StudentInput) => void;
  classes: SchoolClass[];
  sections: Section[];
  locked: boolean;
  today: string;
  admissionLimit?: number;
  addressLimit?: number;
  errors?: StudentFieldErrors;
}) {
  const field = (key: keyof StudentInput, value: string | number) =>
    setDraft({ ...draft, [key]: value });
  const attrs = (key: StudentField) => ({
    'aria-label': {
      name: 'Student name',
      admissionNumber: 'Admission number',
      birthDate: 'Date of birth',
      guardianName: 'Guardian name',
      guardianRelation: 'Relationship',
      guardianPhone: 'Parent mobile',
      address: 'Address (optional)',
      classId: 'Student class',
      sectionId: 'Student section',
      rollNumber: 'Roll number',
      status: 'Enrollment status',
    }[key],
    'aria-invalid': !!errors[key],
    'aria-describedby': errors[key] ? `student-error-${key}` : undefined,
  });
  const message = (key: StudentField) =>
    errors[key] ? (
      <span className="field-error" id={`student-error-${key}`}>
        {errors[key]}
      </span>
    ) : null;
  return (
    <>
      {' '}
      <h3 className="management-form-title">Student details</h3>
      <div className="form-grid">
        <label className="field">
          Student name
          <input
            required
            maxLength={100}
            {...attrs('name')}
            value={draft.name}
            onChange={(e) => field('name', e.target.value)}
          />
          {message('name')}
        </label>
        <label className="field">
          Admission number
          <input
            required
            maxLength={admissionLimit}
            {...attrs('admissionNumber')}
            value={draft.admissionNumber}
            onChange={(e) => field('admissionNumber', e.target.value)}
          />
          {message('admissionNumber')}
        </label>
        <label className="field">
          Date of birth
          <PickerInput
            required
            type="date"
            max={today}
            {...attrs('birthDate')}
            value={draft.birthDate}
            onChange={(e) => field('birthDate', e.target.value)}
          />
          {message('birthDate')}
        </label>
        <label className="field">
          Enrollment status
          <select
            {...attrs('status')}
            value={draft.status}
            onChange={(e) => field('status', e.target.value)}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          {message('status')}
        </label>
        <label className="field">
          Student class
          <select
            disabled={locked}
            {...attrs('classId')}
            value={draft.classId}
            onChange={(e) => {
              const sectionId = sections.find((s) => s.classId === e.target.value)?.id ?? '';
              setDraft({
                ...draft,
                classId: e.target.value,
                sectionId,
              });
            }}
          >
            {orderedClasses(classes).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {message('classId')}
        </label>
        <label className="field">
          Student section
          <select
            disabled={locked}
            {...attrs('sectionId')}
            value={draft.sectionId}
            onChange={(e) =>
              setDraft({
                ...draft,
                sectionId: e.target.value,
              })
            }
          >
            {!sections.some((s) => s.classId === draft.classId) && (
              <option value="">No section — whole class</option>
            )}
            {sections
              .filter((s) => s.classId === draft.classId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {sectionLabel(s.name)}
                </option>
              ))}
          </select>
          {message('sectionId')}
        </label>
        <label className="field">
          Roll number
          <input
            required
            type="text"
            maxLength={40}
            placeholder="12 or SH-12"
            {...attrs('rollNumber')}
            value={draft.rollNumber || ''}
            onChange={(e) => field('rollNumber', e.target.value)}
          />
          {message('rollNumber')}
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
            {...attrs('guardianName')}
            value={draft.guardian.name}
            onChange={(e) =>
              setDraft({ ...draft, guardian: { ...draft.guardian, name: e.target.value } })
            }
          />
          {message('guardianName')}
        </label>
        <label className="field">
          Relationship
          <input
            required
            maxLength={100}
            {...attrs('guardianRelation')}
            value={draft.guardian.relation}
            onChange={(e) =>
              setDraft({ ...draft, guardian: { ...draft.guardian, relation: e.target.value } })
            }
          />
          {message('guardianRelation')}
        </label>
        <label className="field span-two">
          Parent mobile (optional)
          <input
            type="tel"
            {...attrs('guardianPhone')}
            value={draft.guardian.contact ?? ''}
            placeholder="10-digit mobile or + country code"
            onChange={(e) =>
              setDraft({
                ...draft,
                guardian: { ...draft.guardian, contact: e.target.value.trim() || null },
              })
            }
          />
          {message('guardianPhone')}
        </label>
        <label className="field span-two">
          Address (optional)
          <textarea
            rows={2}
            maxLength={addressLimit}
            {...attrs('address')}
            value={draft.address}
            onChange={(e) => field('address', e.target.value)}
          />
          {message('address')}
        </label>
      </div>
    </>
  );
}
