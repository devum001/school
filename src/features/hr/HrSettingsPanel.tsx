import { SetupSection, Rule } from '../settings/StaffPolicySection';
import { Link } from 'react-router-dom';
import '../../styles/staff-structure.css';
import { formatCalendarDate, parseCalendarDate, titleCase } from '../../lib/displayFormat';
import { lazy, Suspense, useState } from 'react';
import { Button, Panel, EmptyState } from '../../components/ui/Primitives';
import type { HrAdapter, HrSettings, HrStaff } from '../../services/hrService';
import { HrForm, TextField, SelectField } from './HrForms';
const CampusLocationPicker = lazy(() => import('./CampusLocationPicker'));
export default function HrSettingsPanel({
  settings,
  staff = [],
  section,
  adapter,
  saved,
}: {
  settings: HrSettings;
  staff?: HrStaff[];
  section: string;
  adapter: HrAdapter;
  saved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState('');
  const [departmentAction, setDepartmentAction] = useState<{
    action: 'add' | 'rename' | 'delete';
    name: string;
  } | null>(null);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const edit = () => setEditing(true);
  return (
    <div className="settings-attendance-stack staff-settings-stack">
      {section === 'departments' ? (
        <Panel
          className="staff-departments-panel"
          title="Departments & Staff"
          subtitle="Organise your staff by department, then set up their salary and attendance."
          action={
            <Button
              variant="secondary"
              onClick={() => setDepartmentAction({ action: 'add', name: '' })}
            >
              Add Department
            </Button>
          }
        >
          {selected ? (
            <div className="staff-department-detail">
              <Button variant="ghost" onClick={() => setSelected('')}>
                ← All departments
              </Button>
              <div className="staff-department-heading">
                <div>
                  <h3>{titleCase(selected)}</h3>
                  <p>
                    {
                      staff.filter(
                        (p) => p.department?.trim().toLowerCase() === selected.trim().toLowerCase(),
                      ).length
                    }{' '}
                    staff members
                  </p>
                </div>
              </div>
              <ul className="department-staff-list">
                {staff
                  .filter(
                    (p) => p.department?.trim().toLowerCase() === selected.trim().toLowerCase(),
                  )
                  .map((p) => (
                    <li key={p.id}>
                      <div>
                        <strong>{titleCase(p.name)}</strong>
                        <p>
                          {titleCase(p.designation || 'Staff')} · {p.code}
                        </p>
                      </div>
                    </li>
                  ))}
              </ul>
              {!staff.some(
                (p) => p.department?.trim().toLowerCase() === selected.trim().toLowerCase(),
              ) && (
                <EmptyState
                  title="No staff in this department"
                  description="Choose this department when adding or editing a staff member."
                />
              )}
              <Link className="text-link" to="/staff">
                Open staff directory →
              </Link>
            </div>
          ) : settings.departments.length ? (
            <div
              className="staff-department-table"
              role="region"
              aria-label="Department list"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Staff</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {settings.departments.map((d) => (
                    <tr key={d}>
                      <th scope="row">
                        <button className="staff-department-link" onClick={() => setSelected(d)}>
                          {titleCase(d)}
                        </button>
                      </th>
                      <td>
                        {
                          staff.filter(
                            (p) => p.department?.trim().toLowerCase() === d.trim().toLowerCase(),
                          ).length
                        }
                      </td>
                      <td>
                        <div className="hr-actions">
                          <Button
                            variant="ghost"
                            aria-label={`Edit department ${titleCase(d)}`}
                            onClick={() => setDepartmentAction({ action: 'rename', name: d })}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            aria-label={`Delete department ${titleCase(d)}`}
                            onClick={() => setDepartmentAction({ action: 'delete', name: d })}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Add your first department"
              description="Create departments, then assign staff from the staff directory."
            />
          )}
        </Panel>
      ) : section === 'work' ? (
        <SetupSection
          title="Work & Leave Rules"
          subtitle="School timings, leave approval and teacher punch locations."
          icon="attendance"
          onEdit={edit}
        >
          <div className="settings-policy-grid">
            <div className="settings-policy-card">
              <div className="settings-policy-card-title">
                <h3>Default Work Rules</h3>
              </div>
              <dl className="staff-rule-list">
                <Rule label="Work timing">
                  {settings.start} – {settings.end}
                </Rule>
                <Rule label="Working days">
                  {settings.workingDays.map((d) => days[d]).join(', ')}
                </Rule>
                <Rule label="Late after">{settings.lateAfter}</Rule>
                <Rule label="Half day after">{settings.halfDayAfter || 'Not enabled'}</Rule>
                <Rule label="Full-day minimum">{settings.halfDayMinutes} minutes</Rule>
              </dl>
            </div>
            <div className="settings-policy-card">
              <div className="settings-policy-card-title">
                <h3>Leave & Salary Decisions</h3>
              </div>
              <dl className="staff-rule-list">
                <Rule label="Paid leave">{settings.paidLeaveDays} days / calendar year</Rule>
                <Rule label="Approval">Administrator review required</Rule>
                <Rule label="Holidays">{settings.holidays.length} configured</Rule>
              </dl>
              <p className="settings-policy-note">
                The administrator decides paid or unpaid leave. Missing punches need review before
                salary approval.
              </p>
            </div>
            <div className="settings-policy-card">
              <div className="settings-policy-card-title">
                <h3>Teacher Punch Locations</h3>
              </div>
              {settings.locations.length ? (
                <dl className="staff-rule-list">
                  {settings.locations.map((l, i) => (
                    <Rule key={i} label={titleCase(l.name)}>
                      {l.radius} m radius
                    </Rule>
                  ))}
                  <Rule label="GPS uncertainty">Up to {settings.maxAccuracy} m</Rule>
                </dl>
              ) : (
                <p className="staff-rule-description">
                  Add your school campus before enabling teacher punching.
                </p>
              )}
              <p className="settings-policy-note">
                Location is checked only at punch in/out. Browser location cannot prevent GPS
                spoofing.
              </p>
            </div>
          </div>
        </SetupSection>
      ) : (
        <SetupSection
          title="Payroll Settings"
          subtitle="Monthly salary calculation, review and payment records."
          icon="wallet"
          onEdit={edit}
        >
          <div className="settings-policy-grid">
            <div className="settings-policy-card">
              <div className="settings-policy-card-title">
                <h3>Salary Cycle & Components</h3>
              </div>
              <dl className="staff-rule-list">
                <Rule label="Salary cycle">Calendar month</Rule>
                <Rule label="Payment due">Day {settings.paymentDay} of next month</Rule>
              </dl>
              <ul className="staff-component-list">
                {['Basic salary', 'Allowances', 'Bonus', 'Regular deduction'].map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <div className="settings-policy-card">
              <div className="settings-policy-card-title">
                <h3>Deduction Rules</h3>
              </div>
              <dl className="staff-rule-list">
                <Rule label="Daily salary basis">
                  {settings.deductionBasis === 'basic' ? 'Basic salary' : 'Gross salary'}
                </Rule>
                <Rule label="Divide by">
                  {settings.divisor === '30'
                    ? '30 days'
                    : settings.divisor === 'calendar'
                      ? 'Calendar days'
                      : 'Working days'}
                </Rule>
              </dl>
              <p className="settings-policy-note">
                Only reviewed unpaid attendance contributes to attendance deductions.
              </p>
            </div>
            <div className="settings-policy-card">
              <div className="settings-policy-card-title">
                <h3>Approval & Payments</h3>
              </div>
              <dl className="staff-rule-list">
                <Rule label="Approve payroll">After the salary month ends</Rule>
                <Rule label="Payments">Partial or full, recorded separately</Rule>
                <Rule label="Salary statement">Print or save as PDF</Rule>
              </dl>
              <p className="settings-policy-note">
                The due date never marks a salary paid. Record a payment only after money is
                actually paid.
              </p>
            </div>
          </div>
        </SetupSection>
      )}
      {departmentAction && (
        <DepartmentEditor
          settings={settings}
          adapter={adapter}
          action={departmentAction.action}
          originalName={departmentAction.name}
          close={() => setDepartmentAction(null)}
          saved={() => {
            setSelected('');
            saved();
          }}
        />
      )}
      {editing && (
        <SettingsEditor
          settings={settings}
          section={section}
          adapter={adapter}
          close={() => setEditing(false)}
          saved={saved}
        />
      )}
    </div>
  );
}

function SettingsEditor({
  settings,
  section,
  adapter,
  close,
  saved,
}: {
  settings: HrSettings;
  section: string;
  adapter: HrAdapter;
  close: () => void;
  saved: () => void;
}) {
  const [draft, setDraft] = useState(settings),
    [holidays, setHolidays] = useState(settings.holidays.map(formatCalendarDate).join('\n'));
  return (
    <HrForm
      title="Staff & Payroll settings"
      description="Each school has its own attendance areas, work rules and payment schedule."
      close={close}
      submit={async () => {
        const { id, schoolId, ...body } = draft;
        void id;
        void schoolId;
        await adapter.save(
          '/settings',
          {
            ...body,
            holidays: holidays
              .split('\n')
              .map((v) => v.trim())
              .filter(Boolean)
              .map((v) => {
                const date = parseCalendarDate(v);
                if (!date) throw new Error('Use DD-MM-YYYY for holidays.');
                return date;
              }),
          },
          'PUT',
        );
        saved();
      }}
    >
      {section === 'payroll' ? (
        <div className="form-grid">
          <label className="field">
            Payment due day (next month)
            <input
              type="number"
              min={1}
              max={31}
              value={draft.paymentDay}
              onChange={(e) => setDraft({ ...draft, paymentDay: Number(e.target.value) })}
            />
          </label>
          <SelectField
            label="Attendance deduction basis"
            value={draft.deductionBasis}
            options={['basic', 'gross']}
            onChange={(v) => setDraft({ ...draft, deductionBasis: v as 'basic' | 'gross' })}
          />
          <SelectField
            label="Daily rate divisor"
            value={draft.divisor}
            options={['calendar', 'working', '30']}
            onChange={(v) => setDraft({ ...draft, divisor: v as typeof draft.divisor })}
          />
        </div>
      ) : (
        <>
          <div className="form-grid">
            {(['start', 'end', 'lateAfter'] as const).map((k) => (
              <TextField
                key={k}
                label={{ start: 'Start time', end: 'End time', lateAfter: 'Late after' }[k]}
                type="time"
                value={draft[k]}
                onChange={(v) => setDraft({ ...draft, [k]: v })}
              />
            ))}
            <TextField
              label="Half day after (optional)"
              type="time"
              required={false}
              value={draft.halfDayAfter ?? ''}
              onChange={(halfDayAfter) => setDraft({ ...draft, halfDayAfter })}
            />
            {(['halfDayMinutes', 'paidLeaveDays', 'maxAccuracy'] as const).map((k) => (
              <label className="field" key={k}>
                {
                  {
                    halfDayMinutes: 'Minimum minutes for a full day',
                    paidLeaveDays: 'Annual paid leave days',
                    maxAccuracy: 'Maximum GPS uncertainty (metres)',
                  }[k]
                }
                <input
                  required
                  type="number"
                  min={k === 'paidLeaveDays' ? 0 : 1}
                  value={draft[k]}
                  onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })}
                />
              </label>
            ))}
          </div>
          <p>
            Arriving after the half-day cutoff counts as half-day, even when minimum working hours
            are met. Leave it empty to use working hours only. Changes apply to new punches.
          </p>
          <fieldset className="hr-workdays">
            <legend>Working days</legend>
            <div className="toolbar">
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(
                (day, i) => (
                  <label key={day}>
                    <input
                      type="checkbox"
                      checked={draft.workingDays.includes(i)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          workingDays: e.target.checked
                            ? [...draft.workingDays, i]
                            : draft.workingDays.filter((d) => d !== i),
                        })
                      }
                    />
                    {day}
                  </label>
                ),
              )}
            </div>
          </fieldset>
          <label className="field">
            Holidays — one DD-MM-YYYY date per line
            <textarea value={holidays} onChange={(e) => setHolidays(e.target.value)} rows={3} />
          </label>
          <h3>Permitted punch locations</h3>
          {draft.locations.map((location, i) => (
            <div className="hr-location form-grid" key={i}>
              <TextField
                label="Location name"
                value={location.name}
                onChange={(name) =>
                  setDraft({
                    ...draft,
                    locations: draft.locations.map((l, j) => (j === i ? { ...l, name } : l)),
                  })
                }
              />
              <Suspense fallback={<p role="status">Loading campus map…</p>}>
                <CampusLocationPicker
                  value={location}
                  onChange={(next) =>
                    setDraft((previous) => ({
                      ...previous,
                      locations: previous.locations.map((item, index) =>
                        index === i ? next : item,
                      ),
                    }))
                  }
                />
              </Suspense>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setDraft({ ...draft, locations: draft.locations.filter((_, j) => j !== i) })
                }
              >
                Remove location
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={draft.locations.length >= 10}
            onClick={() =>
              setDraft({
                ...draft,
                locations: [
                  ...draft.locations,
                  { name: 'School campus', latitude: 0, longitude: 0, radius: 100 },
                ],
              })
            }
          >
            Add school location
          </Button>
          <p>
            Choose the campus centre on the map. Radius must be 25–1,000 metres; the device’s
            uncertainty must fit inside it.
          </p>
        </>
      )}
    </HrForm>
  );
}

function DepartmentEditor({
  settings,
  adapter,
  action,
  originalName,
  close,
  saved,
}: {
  settings: HrSettings;
  adapter: HrAdapter;
  action: 'add' | 'rename' | 'delete';
  originalName: string;
  close: () => void;
  saved: () => void;
}) {
  const [name, setName] = useState(originalName);
  return (
    <HrForm
      submitLabel={action === 'delete' ? 'Delete department' : 'Save department'}
      title={
        action === 'add'
          ? 'Add Department'
          : action === 'rename'
            ? 'Edit Department'
            : 'Delete Department'
      }
      description={
        action === 'rename'
          ? 'Staff assigned to this department will move to its new name. Approved salary history stays unchanged.'
          : action === 'delete'
            ? 'Departments with assigned staff cannot be deleted. Reassign those staff first.'
            : 'Create a department for your school staff.'
      }
      close={close}
      submit={async () => {
        await adapter.save(
          '/departments',
          { revision: settings.revision, action, name: name.trim(), previousName: originalName },
          'PUT',
        );
        saved();
      }}
    >
      {action === 'delete' ? (
        <p>
          Delete <strong>{titleCase(originalName)}</strong>?
        </p>
      ) : (
        <TextField label="Department name" value={name} onChange={setName} />
      )}
    </HrForm>
  );
}
