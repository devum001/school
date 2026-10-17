import { useState, type FormEvent, type ReactNode } from 'react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { Button, Modal } from '../../components/ui/Primitives';
import { repository } from '../../lib/repository';
import { defaultStaffPayroll, staffPayrollSchema } from '../../lib/settings';
import type { StaffPayrollConfig } from '../../types/domain';

export type StaffSettingsGroup = 'work' | 'payroll';
const titles: Record<StaffSettingsGroup, string> = {
  work: 'Work & Leave Rules',
  payroll: 'Payroll Settings',
};
const weekdays: StaffPayrollConfig['work']['weeklyOff'][] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
const components: StaffPayrollConfig['payroll']['components'] = [
  'Basic',
  'Allowance',
  'Bonus',
  'Deduction',
];

function Field({
  label,
  name,
  error,
  hint,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children: (id: string, describedBy?: string) => ReactNode;
}) {
  const id = `staff-${name.replaceAll('.', '-')}`;
  const describedBy = error || hint ? `${id}-help` : undefined;
  return (
    <div className="settings-field">
      <label htmlFor={id}>{label}</label>
      {children(id, describedBy)}
      {(error || hint) && (
        <span id={`${id}-help`} className={error ? 'form-error' : 'staff-field-hint'}>
          {error || hint}
        </span>
      )}
    </div>
  );
}
export default function StaffPayrollDialog({
  group,
  onClose,
}: {
  group: StaffSettingsGroup;
  onClose: () => void;
}) {
  const state = useSchool();
  const notify = useFeedback();
  const [draft, setDraft] = useState(() =>
    structuredClone(state.staffPayroll ?? defaultStaffPayroll),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  function setWork<K extends keyof StaffPayrollConfig['work']>(
    key: K,
    value: StaffPayrollConfig['work'][K],
  ) {
    setDraft((previous) => ({ ...previous, work: { ...previous.work, [key]: value } }));
  }
  function setPayroll<K extends keyof StaffPayrollConfig['payroll']>(
    key: K,
    value: StaffPayrollConfig['payroll'][K],
  ) {
    setDraft((previous) => ({ ...previous, payroll: { ...previous.payroll, [key]: value } }));
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = staffPayrollSchema.safeParse(draft);
    if (!result.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const path =
          issue.path[0] === 'setup' ? issue.path.slice(0, 2).join('.') : issue.path.join('.');
        nextErrors[path] ??= issue.message;
      }
      setErrors(nextErrors);
      return;
    }
    try {
      repository.saveStaffPayroll(result.data);
      onClose();
      notify(`${titles[group]} saved.`);
    } catch {
      setErrors({ form: 'Browser storage is unavailable. Your changes could not be saved.' });
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${titles[group]}`}
      description="Set the default rules for your school workspace."
      wide
    >
      <form onSubmit={submit}>
        <div className="settings-form-grid">
          {group === 'work' && (
            <>
              {(
                [
                  ['start', 'Work Start'],
                  ['end', 'Work End'],
                  ['lateAfter', 'Late After'],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} name={`work.${key}`} label={label} error={errors[`work.${key}`]}>
                  {(id, describedBy) => (
                    <input
                      id={id}
                      type="time"
                      required
                      value={draft.work[key]}
                      aria-describedby={describedBy}
                      aria-invalid={!!errors[`work.${key}`]}
                      onChange={(event) => setWork(key, event.target.value)}
                    />
                  )}
                </Field>
              ))}
              <Field name="work.weeklyOff" label="Weekly Off" error={errors['work.weeklyOff']}>
                {(id) => (
                  <select
                    id={id}
                    value={draft.work.weeklyOff}
                    onChange={(event) => {
                      const day = weekdays.find((value) => value === event.target.value);
                      if (day) setWork('weeklyOff', day);
                    }}
                  >
                    {weekdays.map((day) => (
                      <option key={day}>{day}</option>
                    ))}
                  </select>
                )}
              </Field>
              <Field
                name="work.halfDayMinutes"
                label="Half Day Rule (minimum minutes)"
                error={errors['work.halfDayMinutes']}
              >
                {(id, describedBy) => (
                  <input
                    id={id}
                    type="number"
                    required
                    min={1}
                    max={720}
                    value={draft.work.halfDayMinutes}
                    aria-describedby={describedBy}
                    aria-invalid={!!errors['work.halfDayMinutes']}
                    onChange={(event) => setWork('halfDayMinutes', Number(event.target.value))}
                  />
                )}
              </Field>
              {(
                [
                  ['casual', 'Casual'],
                  ['sick', 'Sick'],
                  ['paid', 'Paid'],
                  ['unpaid', 'Unpaid'],
                ] as const
              ).map(([key, label]) => (
                <Field
                  key={key}
                  name={`work.leaveLimits.${key}`}
                  label={`${label} Leave Limit (days)`}
                  hint={key === 'unpaid' ? 'Leave blank for no limit.' : 'Days per academic year.'}
                  error={errors[`work.leaveLimits.${key}`]}
                >
                  {(id, describedBy) => (
                    <input
                      id={id}
                      type="number"
                      min={0}
                      max={366}
                      required={key !== 'unpaid'}
                      value={draft.work.leaveLimits[key] ?? ''}
                      aria-describedby={describedBy}
                      aria-invalid={!!errors[`work.leaveLimits.${key}`]}
                      onChange={(event) =>
                        setWork('leaveLimits', {
                          ...draft.work.leaveLimits,
                          [key]:
                            key === 'unpaid' && event.target.value === ''
                              ? null
                              : Number(event.target.value),
                        })
                      }
                    />
                  )}
                </Field>
              ))}
            </>
          )}
          {group === 'payroll' && (
            <>
              <Field name="payroll.salaryCycle" label="Salary Cycle">
                {(id) => <input id={id} value="Monthly" readOnly />}
              </Field>
              <Field
                name="payroll.paymentDay"
                label="Salary Payment Date (day of month)"
                error={errors['payroll.paymentDay']}
              >
                {(id, describedBy) => (
                  <input
                    id={id}
                    type="number"
                    required
                    min={1}
                    max={31}
                    value={draft.payroll.paymentDay}
                    aria-describedby={describedBy}
                    aria-invalid={!!errors['payroll.paymentDay']}
                    onChange={(event) => setPayroll('paymentDay', Number(event.target.value))}
                  />
                )}
              </Field>
              <fieldset className="staff-component-fields">
                <legend>Salary Components</legend>
                {components.map((component) => (
                  <label key={component}>
                    <input
                      type="checkbox"
                      checked={draft.payroll.components.includes(component)}
                      disabled={component === 'Basic'}
                      onChange={(event) =>
                        setPayroll(
                          'components',
                          event.target.checked
                            ? [...draft.payroll.components, component]
                            : draft.payroll.components.filter((item) => item !== component),
                        )
                      }
                    />
                    {component}
                    {component === 'Basic' && <small>Required</small>}
                  </label>
                ))}
                {errors['payroll.components'] && (
                  <p className="form-error" role="alert">
                    {errors['payroll.components']}
                  </p>
                )}
              </fieldset>
            </>
          )}
        </div>
        {errors.form && (
          <p className="form-error" role="alert">
            {errors.form}
          </p>
        )}
        <div className="modal-actions">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save settings</Button>
        </div>
      </form>
    </Modal>
  );
}
