import { useState, type ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { Badge, Button, Modal, Panel } from '../../components/ui/Primitives';
import { repository } from '../../lib/repository';
import { attendancePolicySchema, defaultAttendancePolicy } from '../../lib/settings';
import type { AttendancePolicy } from '../../types/domain';
import '../../styles/student-timings.css';

const editGroups = {
  eligibility: {
    title: 'Academic Eligibility Criteria',
    fields: ['minimumAttendance', 'warningAttendance', 'medicalExemption'],
  },
  alerts: { title: 'Absence Notification Rules', fields: ['absenceTime', 'consecutiveAbsences'] },
} as const;
const fieldLabels: Partial<Record<keyof AttendancePolicy, string>> = {
  minimumAttendance: 'Minimum attendance (%)',
  warningAttendance: 'Early warning threshold (%)',
  medicalExemption: 'Medical exemption cap (%)',
  absenceTime: 'Daily Absence Trigger Time',
  consecutiveAbsences: 'Consecutive absence days',
};
function formatTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return `${String(hours % 12 || 12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
}
function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`settings-toggle-status${active ? '' : ' off'}`}>
      <Badge tone={active ? 'green' : 'neutral'}>{active ? 'Active' : 'Off'}</Badge>
    </span>
  );
}
function RuleValues({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="attendance-rule-values">
      {items.map(({ label, value }) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      className="settings-switch"
      onClick={onChange}
    >
      <span />
    </button>
  );
}
export default function AttendanceSettings() {
  const state = useSchool();
  const policy = state.attendancePolicy ?? defaultAttendancePolicy;
  const notify = useFeedback();
  const [editing, setEditing] = useState<keyof typeof editGroups | null>(null);
  const [draft, setDraft] = useState(policy);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState('');
  function toggle(key: 'absenceAlerts' | 'enforceEligibility') {
    try {
      repository.saveAttendancePolicy({ ...policy, [key]: !policy[key] });
      setSaveError('');
      notify('Attendance preference saved.');
    } catch {
      setSaveError('Browser storage is unavailable. Your changes could not be saved.');
    }
  }
  function sectionHeader(
    group: keyof typeof editGroups,
    flag: 'enforceEligibility' | 'absenceAlerts',
    switchLabel: string,
  ) {
    return (
      <div className="attendance-rule-header">
        <div className="attendance-rule-heading">
          <h2>{editGroups[group].title}</h2>
          <StatusBadge active={policy[flag]} />
        </div>
        <div className="attendance-rule-actions">
          <Button
            variant="ghost"
            className="attendance-edit"
            aria-label={`Edit ${editGroups[group].title}`}
            onClick={() => {
              setDraft({ ...policy });
              setErrors({});
              setEditing(group);
            }}
          >
            <Pencil size={14} />
            Edit
          </Button>
          <Switch label={switchLabel} checked={policy[flag]} onChange={() => toggle(flag)} />
        </div>
      </div>
    );
  }
  return (
    <div className="attendance-settings">
      <Panel className="attendance-rules-panel">
        <section className="attendance-rule-section">
          {sectionHeader(
            'eligibility',
            'enforceEligibility',
            'Enforce Academic Eligibility Criteria',
          )}
          <RuleValues
            items={[
              { label: 'Minimum Attendance', value: `${policy.minimumAttendance}%` },
              { label: 'Early Warning Threshold', value: `${policy.warningAttendance}%` },
              { label: 'Medical Exemption Cap', value: `Up to ${policy.medicalExemption}%` },
            ]}
          />
          <p className="attendance-rule-note">Medical exemptions need principal approval.</p>
        </section>
        <section className="attendance-rule-section">
          {sectionHeader('alerts', 'absenceAlerts', 'Enable Absence Notifications')}
          <RuleValues
            items={[
              {
                label: 'Daily Absence Trigger Time',
                value: formatTime(policy.absenceTime),
              },
              {
                label: 'Consecutive Absence Escalation',
                value: `${policy.consecutiveAbsences} days absent`,
              },
            ]}
          />
          <p className="attendance-rule-note">
            Prepare repeat-absence follow-up for the counselor and class coordinator.
          </p>
        </section>
      </Panel>
      <p className="attendance-rules-footnote">
        Demo preferences only. Attendance and eligibility are not changed automatically. No messages
        are sent.
      </p>
      {saveError && (
        <p className="form-error" role="alert">
          {saveError}
        </p>
      )}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editGroups[editing].title}` : 'Edit attendance settings'}
        description="Save policy preferences for this demo workspace. Automatic rule processing is not connected."
      >
        {editing && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const result = attendancePolicySchema.safeParse(draft);
              if (!result.success) {
                setErrors(
                  Object.fromEntries(
                    result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
                  ),
                );
                return;
              }
              try {
                repository.saveAttendancePolicy(result.data);
                setEditing(null);
                notify('Attendance settings saved.');
              } catch (error) {
                setErrors({
                  form:
                    error instanceof Error && !(error instanceof DOMException)
                      ? error.message
                      : 'Browser storage is unavailable. Your changes could not be saved.',
                });
              }
            }}
          >
            <div className="settings-form-grid">
              {editGroups[editing].fields.map((key) => (
                <label className="settings-field" key={key}>
                  {fieldLabels[key]}
                  <input
                    type={typeof draft[key] === 'number' ? 'number' : 'time'}
                    step={typeof draft[key] === 'number' ? 1 : undefined}
                    value={draft[key]}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        [key]:
                          typeof draft[key] === 'number'
                            ? event.target.valueAsNumber
                            : event.target.value,
                      })
                    }
                    aria-invalid={!!errors[key]}
                    aria-describedby={errors[key] ? `policy-${key}-error` : undefined}
                  />
                  {errors[key] && (
                    <span className="form-error" id={`policy-${key}-error`}>
                      {errors[key]}
                    </span>
                  )}
                </label>
              ))}
            </div>
            {errors.form && (
              <p className="form-error" role="alert">
                {errors.form}
              </p>
            )}
            <div className="modal-actions">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit">Save details</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
