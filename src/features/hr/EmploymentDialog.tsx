import StaffAccountPicker from './StaffAccountPicker';
import { useState } from 'react';
import type { HrAdapter, HrEmployment, HrStaff } from '../../services/hrService';
import { AmountField, HrForm, SelectField, TextField } from './HrForms';
export default function EmploymentDialog({
  adapter,
  staff,
  employment,
  month,
  close,
  saved,
  canLink,
}: {
  adapter: HrAdapter;
  staff: HrStaff;
  employment?: HrEmployment;
  month: string;
  close: () => void;
  saved: () => void;
  canLink: boolean;
}) {
  const salaryForMonth = employment?.salaries.filter((s) => s.effectiveMonth <= month).at(-1);
  const attendanceMode = employment?.policies?.length
    ? (employment.policies.filter((p) => p.effectiveMonth <= month).at(-1)?.attendanceMode ??
      'none')
    : (employment?.attendanceMode ?? (staff.teaching ? 'punch' : 'none'));
  const [draft, setDraft] = useState(() => ({
    revision: employment?.revision ?? 0,
    attendanceMode,
    endedOn: employment?.endedOn ?? '',
    userId: staff.userId ?? '',
    effectiveMonth: month,
    basic: salaryForMonth?.basic ?? 0,
    allowance: salaryForMonth?.allowance ?? 0,
    bonus: salaryForMonth?.bonus ?? 0,
    deduction: salaryForMonth?.deduction ?? 0,
    reason: '',
  }));
  return (
    <HrForm
      title={`Salary & attendance · ${staff.name}`}
      description="Salary changes take effect from the selected month. Approved payroll history remains unchanged."
      close={close}
      submit={async () => {
        await adapter.save(
          `/staff/${staff.id}/employment`,
          { ...draft, userId: draft.userId || undefined },
          'PUT',
        );
        saved();
      }}
    >
      <div className="form-grid">
        <TextField
          label="Effective salary month"
          type="month"
          value={draft.effectiveMonth}
          onChange={(effectiveMonth) => setDraft({ ...draft, effectiveMonth })}
        />
        <SelectField
          label="Attendance method"
          value={draft.attendanceMode}
          options={staff.teaching ? ['none', 'manual', 'punch'] : ['none', 'manual']}
          onChange={(v) => setDraft({ ...draft, attendanceMode: v as typeof draft.attendanceMode })}
        />
        {canLink && (
          <StaffAccountPicker
            schoolId={staff.schoolId}
            value={draft.userId}
            onChange={(userId) => setDraft({ ...draft, userId })}
          />
        )}
        <TextField
          label="Employment end date (optional)"
          type="date"
          required={false}
          value={draft.endedOn}
          onChange={(endedOn) => setDraft({ ...draft, endedOn })}
        />
        {(['basic', 'allowance', 'bonus', 'deduction'] as const).map((key) => (
          <AmountField
            key={key}
            label={
              {
                basic: 'Basic salary',
                allowance: 'Monthly allowances',
                bonus: 'Monthly bonus',
                deduction: 'Regular deduction',
              }[key]
            }
            value={draft[key]}
            onChange={(v) => setDraft({ ...draft, [key]: v })}
          />
        ))}
        <TextField
          label="Reason for salary setup/change"
          value={draft.reason}
          onChange={(reason) => setDraft({ ...draft, reason })}
        />
      </div>
      <p className="panel-note">
        None: salary-only staff. Manual: an administrator marks attendance. Punch: a linked teacher
        uses their device location at school. Use Enable login in the staff directory to create and
        link a school account.
      </p>
    </HrForm>
  );
}
