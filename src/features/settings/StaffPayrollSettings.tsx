import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { documentTemplatesFor } from '../../lib/documentData';
import { TEMPLATE_LABELS } from '../../lib/documentRendering';
import { Clock3, Pencil, Wallet, type LucideIcon } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { Badge, Button, Panel } from '../../components/ui/Primitives';
import { repository } from '../../lib/repository';
import { defaultStaffPayroll } from '../../lib/settings';
import StaffPayrollDialog, { type StaffSettingsGroup } from './StaffPayrollDialog';
import StaffDepartments from './StaffDepartments';

function formatTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return `${String(hours % 12 || 12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
}
function SetupSection({
  title,
  subtitle,
  Icon,
  onEdit,
  children,
}: {
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <Panel className="settings-policy-section">
      <div className="settings-policy-header">
        <span className="settings-policy-icon">
          <Icon size={21} />
        </span>
        <div>
          <div className="settings-policy-heading">
            <h2>{title}</h2>
          </div>
          <p>{subtitle}</p>
        </div>
        <Button
          variant="secondary"
          className="settings-edit"
          aria-label={`Edit ${title}`}
          onClick={onEdit}
        >
          <Pencil size={14} />
          Edit Details
        </Button>
      </div>
      {children}
    </Panel>
  );
}
function Rule({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
function AutoRule({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="staff-auto-rule">
      <div>
        <strong>{label}</strong>
        <span className={`settings-toggle-status${checked ? '' : ' off'}`}>
          <Badge tone={checked ? 'green' : 'neutral'}>{checked ? 'Active' : 'Off'}</Badge>
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={checked}
        className="settings-switch"
        onClick={onToggle}
      >
        <span />
      </button>
    </div>
  );
}
export default function StaffPayrollSettings() {
  const state = useSchool();
  const config = state.staffPayroll ?? defaultStaffPayroll;
  const notify = useFeedback();
  const [editing, setEditing] = useState<StaffSettingsGroup | null>(null);
  const [error, setError] = useState('');
  function toggle(group: 'work' | 'payroll') {
    const next =
      group === 'work'
        ? {
            ...config,
            work: {
              ...config.work,
              autoLeaveDeduction: !config.work.autoLeaveDeduction,
            },
          }
        : {
            ...config,
            payroll: {
              ...config.payroll,
              autoCalculation: !config.payroll.autoCalculation,
            },
          };
    try {
      repository.saveStaffPayroll(next);
      setError('');
      notify('Staff preference saved.');
    } catch {
      setError('Browser storage is unavailable. Your changes could not be saved.');
    }
  }
  const { work, payroll } = config;
  return (
    <div className="settings-attendance-stack staff-settings-stack">
      <StaffDepartments />
      <SetupSection
        title="Work & Leave Rules"
        subtitle="Set default work timing and simple leave rules."
        Icon={Clock3}
        onEdit={() => setEditing('work')}
      >
        <div className="settings-policy-grid">
          <div className="settings-policy-card">
            <div className="settings-policy-card-title">
              <h3>Default Work Rules</h3>
            </div>
            <dl className="staff-rule-list">
              <Rule label="Default Work Timing">
                {formatTime(work.start)} – {formatTime(work.end)}
              </Rule>
              <Rule label="Weekly Off">{work.weeklyOff}</Rule>
              <Rule label="Late After">{formatTime(work.lateAfter)}</Rule>
              <Rule label="Half Day Rule">
                Minimum {Math.floor(work.halfDayMinutes / 60)}h {work.halfDayMinutes % 60}m
              </Rule>
            </dl>
          </div>
          <div className="settings-policy-card">
            <div className="settings-policy-card-title">
              <h3>Leave Types & Limits</h3>
            </div>
            <p className="staff-rule-caption">Days per academic year</p>
            <dl className="staff-rule-list">
              {(
                [
                  ['casual', 'Casual'],
                  ['sick', 'Sick'],
                  ['paid', 'Paid'],
                  ['unpaid', 'Unpaid'],
                ] as const
              ).map(([key, label]) => (
                <Rule key={key} label={label}>
                  {work.leaveLimits[key] === null ? 'No limit' : `${work.leaveLimits[key]} days`}
                </Rule>
              ))}
            </dl>
          </div>
          <div className="settings-policy-card">
            <div className="settings-policy-card-title">
              <h3>Unpaid Leave Deduction</h3>
            </div>
            <p className="staff-rule-description">One day’s salary per unpaid leave day.</p>
            <AutoRule
              label="Automatic Leave Deduction"
              checked={work.autoLeaveDeduction}
              onToggle={() => toggle('work')}
            />
          </div>
        </div>
      </SetupSection>
      <SetupSection
        title="Payroll Settings"
        subtitle="Configure the monthly salary cycle and components."
        Icon={Wallet}
        onEdit={() => setEditing('payroll')}
      >
        <div className="settings-policy-grid">
          <div className="settings-policy-card">
            <div className="settings-policy-card-title">
              <h3>Salary Cycle & Components</h3>
            </div>
            <dl className="staff-rule-list">
              <Rule label="Salary Cycle">{payroll.salaryCycle}</Rule>
              <Rule label="Salary Payment Date">Day {payroll.paymentDay} of every month</Rule>
            </dl>
            <h4 className="staff-rule-caption">Salary Components</h4>
            <ul className="staff-component-list">
              {payroll.components.map((component) => (
                <li key={component}>{component}</li>
              ))}
            </ul>
          </div>
          <div className="settings-policy-card">
            <div className="settings-policy-card-title">
              <h3>Deduction Rules</h3>
            </div>
            <dl className="staff-rule-list">
              <Rule label="Unpaid Leave Deduction">
                {work.autoLeaveDeduction ? 'One day’s salary per unpaid day' : 'Off'}
              </Rule>
            </dl>
            <p className="settings-policy-note">
              Unpaid leave uses the rule configured in Work & Leave Rules.
            </p>
          </div>
          <div className="settings-policy-card">
            <div className="settings-policy-card-title">
              <h3>Calculation & Salary Slip</h3>
            </div>
            <AutoRule
              label="Auto Calculation"
              checked={payroll.autoCalculation}
              onToggle={() => toggle('payroll')}
            />
            <dl className="staff-rule-list">
              <Rule label="Salary Slip Template">
                <Link className="text-link" to="/settings?tab=Templates">
                  {TEMPLATE_LABELS[documentTemplatesFor(state).salarySlip.templateId]}
                </Link>
              </Rule>
            </dl>
            <p className="settings-policy-note">
              School name, staff details, earnings, deductions, and net salary.
            </p>
          </div>
        </div>
      </SetupSection>
      <p className="settings-demo-note">
        Full-day absences and half-days in Staff attendance automatically update leave counts and
        salary deductions. Late arrivals do not reduce salary.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {editing && (
        <StaffPayrollDialog key={editing} group={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
