import { useEffect, useState } from 'react';
import { AlertCircle, CalendarX2 } from 'lucide-react';
import '../../styles/ledgers.css';
import AttendanceTabs from '../../components/shared/AttendanceTabs';
import { attendanceSummary } from '../../lib/selectors';
import { displayDate } from '../../lib/config';
import { Link, useSearchParams } from 'react-router-dom';
import { useSchool } from '../../app/useSchool';
import { useToday } from '../../app/useToday';
import { useFeedback } from '../../app/useFeedback';
import {
  PickerInput,
  Avatar,
  Badge,
  Button,
  EmptyState,
  Modal,
  PageHeading,
  Panel,
  AppIcon,
  StatCard,
} from '../../components/ui/Primitives';
import { useDraftGuard } from '../academics/useDraftGuard';
import { defaultStaffPayroll } from '../../lib/settings';
import { staffDirectory, staffLabel } from '../../lib/staffStructure';
import { staffStatusFor } from '../../lib/staffAttendance';
import { repository } from '../../lib/repository';
import { STATUS_LABELS } from '../../lib/config';
import { configuredSchoolHours } from '../../lib/schoolHours';
import { isDateHoliday } from '../../lib/indianHolidays';
import type { AttendanceStatus } from '../../types/domain';
const statuses: AttendanceStatus[] = ['present', 'absent', 'half-day', 'late', 'unmarked'];
export default function StaffAttendancePage({ embedded = false }: { embedded?: boolean }) {
  const [params] = useSearchParams();
  return <StaffRegister key={params.toString()} embedded={embedded} />;
}
function StaffRegister({ embedded }: { embedded: boolean }) {
  const state = useSchool(),
    today = useToday(),
    notify = useFeedback();
  const [params, setParams] = useSearchParams();
  const config = state.staffPayroll ?? defaultStaffPayroll;
  const requested = params.get('date');
  const date =
    requested &&
    /^\d{4}-\d{2}-\d{2}$/.test(requested) &&
    requested <= today &&
    requested >= state.academicYear.start
      ? requested
      : today;
  const department = params.get('department') ?? '';
  const [, setHolidayRevision] = useState(0);
  useEffect(() => {
    const handleHolidayChange = () => setHolidayRevision((v) => v + 1);
    window.addEventListener('schoolwell_holidays_changed', handleHolidayChange);
    return () => window.removeEventListener('schoolwell_holidays_changed', handleHolidayChange);
  }, []);

  const holidayInfo = isDateHoliday(date, state.holidays);
  const weekdayName = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
  const hours = configuredSchoolHours(state);
  const isWeeklyOff =
    hours && hours.days.length > 0
      ? !hours.days.includes(weekdayName as any)
      : config.work.weeklyOff === weekdayName;
  const isDateLocked = holidayInfo.isHoliday || isWeeklyOff;

  const members = staffDirectory(state, config).filter(
    (member) =>
      member.status === 'active' &&
      member.joinedOn <= date &&
      (!department || member.departmentId === department) &&
      (!params.get('staff') || member.id === params.get('staff')),
  );
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({}),
    [error, setError] = useState('');
  const handleStaffAttendanceKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    rowIndex: number,
    statusIndex: number,
    memberId: string,
  ) => {
    if (e.altKey || e.ctrlKey || e.metaKey || isDateLocked) return;
    const table = e.currentTarget.closest('table');
    if (!table) return;
    const tableRows = Array.from(table.querySelectorAll('tbody tr'));

    const focusButton = (rIdx: number, sIdx: number) => {
      const targetRow = tableRows[rIdx];
      if (!targetRow) return;
      const buttons = targetRow.querySelectorAll<HTMLButtonElement>('.status-options button');
      const targetBtn = buttons[sIdx];
      if (targetBtn) {
        targetBtn.focus();
        targetBtn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    };

    const key = e.key.toLowerCase();
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      focusButton(rowIndex + 1, statusIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusButton(rowIndex - 1, statusIndex);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusButton(rowIndex, Math.max(0, statusIndex - 1));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusButton(rowIndex, Math.min(statuses.length - 1, statusIndex + 1));
    } else if (key === 'p') {
      e.preventDefault();
      setDraft((prev) => ({ ...prev, [memberId]: 'present' }));
      focusButton(rowIndex + 1, statuses.indexOf('present'));
    } else if (key === 'a') {
      e.preventDefault();
      setDraft((prev) => ({ ...prev, [memberId]: 'absent' }));
      focusButton(rowIndex + 1, statuses.indexOf('absent'));
    } else if (key === 'l') {
      e.preventDefault();
      setDraft((prev) => ({ ...prev, [memberId]: 'late' }));
      focusButton(rowIndex + 1, statuses.indexOf('late'));
    } else if (key === 'h') {
      e.preventDefault();
      setDraft((prev) => ({ ...prev, [memberId]: 'half-day' }));
      focusButton(rowIndex + 1, statuses.indexOf('half-day'));
    } else if (key === 'u') {
      e.preventDefault();
      setDraft((prev) => ({ ...prev, [memberId]: 'unmarked' }));
      focusButton(rowIndex + 1, statuses.indexOf('unmarked'));
    }
  };

  const dirty = Object.entries(draft).some(
    ([id, status]) => staffStatusFor(state, id, date) !== status,
  );
  const guard = useDraftGuard(dirty, () => setDraft({}));
  const summary = attendanceSummary(
    members.map((member) => draft[member.id] ?? staffStatusFor(state, member.id, date)),
  );
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { flushSync: true });
  };
  const save = () => {
    if (isDateLocked) {
      notify(holidayInfo.isHoliday ? `Cannot record attendance on school holiday (${holidayInfo.reason}).` : 'Cannot record attendance on a weekly off day.');
      return;
    }
    try {
      repository.saveStaffAttendance(
        date,
        Object.fromEntries(
          members.map((member) => [
            member.id,
            draft[member.id] ?? staffStatusFor(state, member.id, date),
          ]),
        ),
      );
      setDraft({});
      setError('');
      notify('Staff attendance saved. Leave counts and salary totals updated.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save staff attendance.');
    }
  };
  return (
    <>
      {!embedded && (
        <PageHeading
          title="Attendance register"
          actions={
            <>
              <Link className="button secondary" to="/fees?tab=Salary+Expenses">
                <AppIcon name="wallet" size={15} />
                Open Salary
              </Link>
            </>
          }
        />
      )}
      {!embedded && <AttendanceTabs date={date} />}
      <div id="attendance-register-content">
        {holidayInfo.isHoliday ? (
          <div
            className="attendance-lock-banner holiday-lock"
            role="alert"
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: '#991b1b',
              margin: '12px 0 16px 0',
            }}
          >
            <CalendarX2 size={20} />
            <div>
              <strong style={{ display: 'block', fontSize: '15px' }}>
                School Holiday: {holidayInfo.reason}
              </strong>
              <span style={{ fontSize: '13px', color: '#b91c1c' }}>
                Staff attendance is locked on official school holidays and festival leaves.
              </span>
            </div>
          </div>
        ) : isWeeklyOff ? (
          <div
            className="attendance-lock-banner weekend-lock"
            role="alert"
            style={{
              background: '#fef3c7',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: '#92400e',
              margin: '12px 0 16px 0',
            }}
          >
            <AlertCircle size={20} />
            <div>
              <strong style={{ display: 'block', fontSize: '15px' }}>Weekly Off ({weekdayName})</strong>
              <span style={{ fontSize: '13px', color: '#b45309' }}>
                School is closed for weekly off. Staff attendance recording is disabled.
              </span>
            </div>
          </div>
        ) : null}
        <Panel>
          <div className="toolbar attendance-toolbar staff-register-toolbar">
            <label className="filter-label">
              Staff attendance date
              <PickerInput
                type="date"
                required
                min={state.academicYear.start}
                max={today}
                value={date}
                onChange={(event) => {
                  if (event.target.value) update('date', event.target.value);
                }}
              />
            </label>
            <label className="filter-label">
              Department
              <select
                value={department}
                onChange={(event) => update('department', event.target.value)}
              >
                <option value="">All departments</option>
                {config.setup.departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="register-context">
              <AppIcon name="attendance" size={20} />
              <span>
                <strong>{state.academicYear.name}</strong>
                <small>Academic year</small>
              </span>
            </div>
          </div>
        </Panel>
        <div className="attendance-summary stats-grid">
          <StatCard
            label="Total Staff"
            value={summary.total}
            detail="Active staff members"
            tone="blue"
          />
          <StatCard
            label="Present"
            value={summary.present + summary.late}
            detail={summary.total ? `${Math.round(((summary.present + summary.late) / summary.total) * 100)}% on duty` : '0%'}
            tone="green"
          />
          <StatCard
            label="Absent"
            value={summary.absent}
            detail={summary.absent > 0 ? `${summary.absent} absent today` : 'No absentees'}
            tone="red"
          />
          <StatCard
            label="Late / Half day"
            value={`${summary.late} / ${summary['half-day']}`}
            detail={`${summary.late} late · ${summary['half-day']} half-day`}
            tone="amber"
          />
          <StatCard
            label="Not Marked"
            value={summary.unmarked}
            detail={summary.unmarked > 0 ? 'Pending punch / mark' : 'All recorded'}
            tone="neutral"
          />
        </div>
        <Panel
          title="Staff attendance"
          subtitle={`${members.length} active staff · ${displayDate(date)}`}
          action={
            <Button
              variant="secondary"
              disabled={!members.length || isDateLocked}
              onClick={() =>
                setDraft(Object.fromEntries(members.map((member) => [member.id, 'present'])))
              }
            >
              <AppIcon name="user-check" size={16} />
              Mark all present
            </Button>
          }
        >
          {members.length ? (
            <div
              className="table-wrap"
              role="region"
              aria-label="Staff attendance register"
              tabIndex={0}
            >
              <table className="attendance-table">
                <thead>
                  <tr>
                    <th scope="col">No.</th>
                    <th scope="col">Staff</th>
                    <th scope="col">Department</th>
                    <th scope="col">Attendance</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member, index) => {
                    const status = draft[member.id] ?? staffStatusFor(state, member.id, date);
                    return (
                      <tr key={member.id}>
                        <td className="mono">{index + 1}</td>
                        <th scope="row">
                          <div className="person-cell">
                            <Avatar name={member.name} />
                            <strong>{staffLabel(member, config)}</strong>
                          </div>
                        </th>
                        <td>
                          {config.setup.departments.find((d) => d.id === member.departmentId)
                            ?.name ?? '—'}
                        </td>
                        <td>
                          <div
                            className="status-options"
                            role="group"
                            aria-label={`${member.name} attendance`}
                          >
                            {statuses.map((value, statusIndex) => (
                              <button
                                type="button"
                                key={value}
                                aria-pressed={status === value}
                                className={status === value ? `selected ${value}` : ''}
                                onClick={() => setDraft((prev) => ({ ...prev, [member.id]: value }))}
                                onKeyDown={(e) => handleStaffAttendanceKeyDown(e, index, statusIndex, member.id)}
                              >
                                {STATUS_LABELS[value]}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td>
                          <Badge tone={status}>{STATUS_LABELS[status]}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No staff available"
              description="Choose another department or date, or add staff in School Settings."
            />
          )}
          <div className="save-bar">
            <div>
              <span className={`status-dot ${dirty ? 'pending' : 'active'}`} />
              <strong>{dirty ? 'Unsaved changes' : 'Register up to date'}</strong>
              <small>
                {summary.attended} attending / {summary.total} total · {summary.percentage}%
                attendance
              </small>
            </div>
            <Button disabled={!members.length || isDateLocked} onClick={save}>
              <AppIcon name="save" size={16} />
              Save staff attendance
            </Button>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </Panel>
      </div>
      <Modal
        open={guard.confirming}
        onClose={guard.keepEditing}
        title="Leave unsaved staff attendance?"
        description="Your attendance changes have not been saved."
      >
        <div className="modal-actions">
          <Button variant="secondary" onClick={guard.keepEditing}>
            Keep editing
          </Button>
          <Button variant="danger" onClick={guard.discard}>
            Discard changes
          </Button>
        </div>
      </Modal>
    </>
  );
}
