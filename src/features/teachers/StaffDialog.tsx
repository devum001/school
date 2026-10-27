import StaffContactFields from './StaffContactFields';
import { useState } from 'react';
import { ZodError } from 'zod';
import { useSchool } from '../../app/useSchool';
import { useToday } from '../../app/useToday';
import { useFeedback } from '../../app/useFeedback';
import { PickerInput, Button, Modal } from '../../components/ui/Primitives';
import { repository } from '../../lib/repository';
import { defaultStaffPayroll } from '../../lib/settings';
import { staffDirectory, staffDesignation, type StaffInput } from '../../lib/staffStructure';
import { money } from '../../lib/config';
import { salaryNet } from '../../lib/staffSalary';
import { autoCapitalizeName } from '../../lib/displayFormat';
import { useDraftGuard } from '../academics/useDraftGuard';
import { readProfileImage } from '../../lib/fileUploads';
import '../../styles/ledgers.css';

export default function StaffDialog({
  staffId,
  departmentId,
  onClose,
  teaching = false,
}: {
  staffId?: string;
  departmentId?: string;
  onClose: () => void;
  teaching?: boolean;
}) {
  const state = useSchool(),
    today = useToday(),
    notify = useFeedback();
  const config = state.staffPayroll ?? defaultStaffPayroll;
  const departments = config.setup.departments;
  const existing = staffDirectory(state, config).find((member) => member.id === staffId);
  const [initial] = useState<StaffInput>(() => ({
    name: existing?.name ?? '',
    staffId: existing?.staffId ?? '',
    departmentId:
      existing?.departmentId ??
      departments.find((d) => d.id === departmentId)?.id ??
      departments[0]?.id ??
      '',
    designationId: existing?.designationId ?? '',
    designation: existing ? staffDesignation(existing, config) : '',
    status: existing?.status ?? 'active',
    email: existing?.email ?? '',
    phone: existing?.phone ?? '',
    joinedOn: existing?.joinedOn ?? today,
    qualification: existing?.qualification ?? '',
    photoDataUrl: existing?.photoDataUrl,
    isTeachingStaff: Boolean(existing?.teacherId || existing?.isTeachingStaff || teaching),
  }));
  const [draft, setDraft] = useState(initial),
    [error, setError] = useState('');
  const [readingPhoto, setReadingPhoto] = useState(false);
  const [initialSalary] = useState(() => ({
    effectiveFrom: existing?.salary?.effectiveFrom ?? today.slice(0, 7),
    basic: existing?.salary ? String(existing.salary.basic / 100) : '',
    allowance: String((existing?.salary?.allowance ?? 0) / 100),
    bonus: String((existing?.salary?.bonus ?? 0) / 100),
    deduction: String((existing?.salary?.deduction ?? 0) / 100),
  }));
  const [salary, setSalary] = useState(initialSalary);
  const parsedSalary = {
    effectiveFrom: salary.effectiveFrom,
    basic: Math.round(Number(salary.basic) * 100),
    allowance: Math.round(Number(salary.allowance) * 100),
    bonus: Math.round(Number(salary.bonus) * 100),
    deduction: Math.round(Number(salary.deduction) * 100),
  };
  const department = departments.find((d) => d.id === draft.departmentId);
  const guard = useDraftGuard(
    JSON.stringify(initial) !== JSON.stringify(draft) ||
      JSON.stringify(initialSalary) !== JSON.stringify(salary),
    onClose,
  );
  return (
    <Modal
      open
      wide
      onClose={guard.confirming ? guard.keepEditing : guard.requestClose}
      title={guard.confirming ? 'Discard staff changes?' : existing ? 'Edit staff' : 'Add Staff'}
      description={
        guard.confirming
          ? 'Your changes have not been saved.'
          : 'Enter the staff name, designation and monthly salary details.'
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
              repository.saveStaffMember({ ...draft, salary: parsedSalary }, staffId);
              notify('Staff details saved.');
              onClose();
            } catch (cause) {
              setError(
                cause instanceof ZodError
                  ? (cause.issues[0]?.message ?? 'Complete the staff details.')
                  : cause instanceof Error
                    ? cause.message
                    : 'Unable to save staff.',
              );
            }
          }}
        >
          <div className="profile-image-editor">
            {draft.photoDataUrl && <img src={draft.photoDataUrl} alt="Staff photo" />}
            <label className="button secondary document-upload-control">
              {readingPhoto ? 'Preparing photo…' : 'Choose photo'}
              <input
                aria-label="Staff photo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={readingPhoto}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  setReadingPhoto(true);
                  try {
                    const photoDataUrl = await readProfileImage(file);
                    setDraft((current) => ({ ...current, photoDataUrl }));
                    setError('');
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : 'Unable to read photo.');
                  } finally {
                    setReadingPhoto(false);
                  }
                }}
              />
            </label>
            {draft.photoDataUrl && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDraft({ ...draft, photoDataUrl: undefined })}
              >
                Remove photo
              </Button>
            )}
          </div>
          <div className="form-grid">
            <label className="field">
              Department
              <select
                aria-label="Department"
                required
                value={draft.departmentId}
                onChange={(event) => {
                  setDraft({
                    ...draft,
                    departmentId: event.target.value,
                    designationId: undefined,
                  });
                  setError('');
                }}
              >
                <option value="">Choose department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Staff name
              <input
                required
                maxLength={80}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: autoCapitalizeName(event.target.value) })}
              />
            </label>
            <label className="field">
              Designation
              <input
                required
                maxLength={80}
                value={draft.designation ?? ''}
                placeholder="For example, Physics Teacher or Driver"
                onChange={(event) => setDraft({ ...draft, designation: autoCapitalizeName(event.target.value) })}
              />
            </label>
            <label className="field">
              Staff status
              <select
                aria-label="Staff status"
                value={draft.status}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    status: event.target.value === 'inactive' ? 'inactive' : 'active',
                  })
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>
          <label className="access-login-field">
            <input
              type="checkbox"
              checked={draft.isTeachingStaff ?? false}
              disabled={!!existing?.teacherId}
              onChange={(e) => setDraft({ ...draft, isTeachingStaff: e.target.checked })}
            />{' '}
            Teaching staff — show in Teachers directory
          </label>
          <StaffContactFields
            value={draft}
            onChange={(value) => setDraft({ ...draft, ...value })}
            today={today}
          />
          <h3 className="management-form-title">Monthly salary</h3>
          <div className="form-grid">
            <label className="field">
              Salary effective from
              <PickerInput
                required
                type="month"
                value={salary.effectiveFrom}
                onChange={(event) => setSalary({ ...salary, effectiveFrom: event.target.value })}
              />
            </label>
            {(['basic', 'allowance', 'bonus', 'deduction'] as const).map((key) => (
              <label className="field" key={key}>
                {
                  {
                    basic: 'Basic Salary (₹)',
                    allowance: 'Allowance (₹)',
                    bonus: 'Bonus (₹)',
                    deduction: 'Deduction (₹)',
                  }[key]
                }
                <input
                  required
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]+([.][0-9]{1,2})?"

                  value={salary[key]}
                  onChange={(event) => setSalary({ ...salary, [key]: event.target.value })}
                />
              </label>
            ))}
          </div>
          <div className="staff-salary-preview">
            <span>Net monthly salary</span>
            <strong>{money(salaryNet(parsedSalary))}</strong>
          </div>
          <p className="panel-note">
            Basic + allowance + bonus − deduction. These monthly amounts apply from the selected
            month until changed.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={guard.requestClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!department || readingPhoto}>
              Save staff
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
