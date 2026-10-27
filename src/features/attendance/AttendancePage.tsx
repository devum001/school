import { useToday } from '../../app/useToday';
import { useEffect, useState } from 'react';
import { Link, useBlocker, useSearchParams } from 'react-router-dom';
import { CircleAlert } from 'lucide-react';
import StudentRecordLink from '../../components/shared/StudentRecordLink';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import {
  PickerInput,
  Avatar,
  Badge,
  Button,
  Modal,
  PageHeading,
  Panel,
  AppIcon,
} from '../../components/ui/Primitives';
import { ClassFilters } from '../../components/shared/ClassFilters';
import { attendanceSummary, roster, statusFor } from '../../lib/selectors';
import { STATUS_LABELS, displayDate } from '../../lib/config';
import { useSchoolFeature } from '../../app/schoolFeatureContext';
import { repository } from '../../lib/repository';
import type { AttendanceStatus } from '../../types/domain';
import { formatSchoolTime, studentLateCutoff } from '../../lib/studentTimings';
import { configuredSchoolHours, schoolHoursForDate } from '../../lib/schoolHours';
import { defaultAttendancePolicy } from '../../lib/settings';
import AttendanceTabs from '../../components/shared/AttendanceTabs';
import LiveHrWorkspace from '../hr/HrWorkspace';
import StaffAttendancePage from './StaffAttendancePage';
import '../../styles/student-timings.css';
const statuses = Object.keys(STATUS_LABELS) as AttendanceStatus[];
export default function AttendancePage() {
  const [params] = useSearchParams();
  return <AttendanceRegister key={params.toString()} />;
}
function AttendanceRegister() {
  const state = useSchool();
  const feature = useSchoolFeature(),
    data = feature ?? repository,
    canManage = feature?.canManage ?? true;
  const [saving, setSaving] = useState(false);
  const today = useToday();
  const notify = useFeedback();
  const [params, setParams] = useSearchParams();
  const register = params.get('register') === 'staff' ? 'staff' : 'student';
  const requested = params.get('class');
  const classId = state.classes.some((c) => c.id === requested)
    ? requested!
    : (state.classes[0]?.id ?? '');
  const sections = state.sections.filter((s) => s.classId === classId);
  const sectionId = sections.some((s) => s.id === params.get('section'))
    ? params.get('section')!
    : (sections[0]?.id ?? '');
  const [openedDate] = useState(today);
  const requestedDate = params.get('date') ?? openedDate;
  const date =
    /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) &&
    requestedDate <= today &&
    requestedDate >= state.academicYear.start
      ? requestedDate
      : today;
  const rows = roster(state).filter(
    (r) => r.enrollment.classId === classId && r.enrollment.sectionId === sectionId,
  );
  const timing = schoolHoursForDate(state, date);
  const hasAssignedTiming = !!configuredSchoolHours(state);
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});
  const [error, setError] = useState('');
  const handleAttendanceKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    rowIndex: number,
    statusIndex: number,
    enrollmentId: string,
  ) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
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
      setDraft((prev) => ({ ...prev, [enrollmentId]: 'present' }));
      focusButton(rowIndex + 1, statuses.indexOf('present'));
    } else if (key === 'a') {
      e.preventDefault();
      setDraft((prev) => ({ ...prev, [enrollmentId]: 'absent' }));
      focusButton(rowIndex + 1, statuses.indexOf('absent'));
    } else if (key === 'l') {
      e.preventDefault();
      setDraft((prev) => ({ ...prev, [enrollmentId]: 'late' }));
      focusButton(rowIndex + 1, statuses.indexOf('late'));
    } else if (key === 'h') {
      e.preventDefault();
      setDraft((prev) => ({ ...prev, [enrollmentId]: 'half-day' }));
      focusButton(rowIndex + 1, statuses.indexOf('half-day'));
    } else if (key === 'u') {
      e.preventDefault();
      setDraft((prev) => ({ ...prev, [enrollmentId]: 'unmarked' }));
      focusButton(rowIndex + 1, statuses.indexOf('unmarked'));
    }
  };

  const dirty = Object.entries(draft).some(([id, status]) => statusFor(state, id, date) !== status);
  const summary = attendanceSummary(
    rows.map((r) => draft[r.enrollment.id] ?? statusFor(state, r.enrollment.id, date)),
  );
  const blocker = useBlocker(dirty);
  useEffect(() => {
    const handle = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handle);
    return () => window.removeEventListener('beforeunload', handle);
  }, [dirty]);
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    if (key === 'class') next.delete('section');
    setParams(next, { flushSync: true });
  };
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await data.saveAttendance(
        date,
        sectionId,
        Object.fromEntries(
          rows.map((r) => [
            r.enrollment.id,
            draft[r.enrollment.id] ?? statusFor(state, r.enrollment.id, date),
          ]),
        ),
        classId,
      );
      setDraft({});
      setError('');
      notify('Attendance saved. Dashboard and student profiles are up to date.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save attendance.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <PageHeading
        title="Attendance register"
        actions={
          <>
            {!feature && (
              <Link
                className="button secondary"
                to={`/notifications?date=${date}&class=${classId}&section=${sectionId}&event=Student+Absent&focus=pending`}
              >
                <AppIcon name="send" size={16} />
                Review notifications
              </Link>
            )}
          </>
        }
      />
      <AttendanceTabs
        date={date}
        value={register}
        onChange={(val) => {
          setParams((prev) => {
            const next = new URLSearchParams(prev);
            if (val === 'staff') {
              next.set('register', 'staff');
            } else {
              next.delete('register');
            }
            return next;
          });
        }}
      />
      {register === 'staff' ? (
        feature ? (
          <LiveHrWorkspace section="attendance" hideNavigation />
        ) : (
          <StaffAttendancePage embedded />
        )
      ) : (
        <>
          {feature && !state.classes.length && (
            <p className="panel-note">
              No classes are assigned to you yet. Your school administrator can assign classes and
              subjects in Teachers → Teaching assignments.
            </p>
          )}
      <div id="attendance-register-content">
        <Panel>
          <div className="toolbar attendance-toolbar">
            <label className="filter-label">
              <span>Attendance date</span>
              <PickerInput
                aria-label="Attendance date"
                type="date"
                value={date}
                min={state.academicYear.start}
                max={today}
                onChange={(e) => {
                  if (e.target.value) update('date', e.target.value);
                }}
              />
            </label>
            <ClassFilters
              classId={classId}
              sectionId={sectionId}
              onClassChange={(v) => update('class', v)}
              onSectionChange={(v) => update('section', v)}
              allowAll={false}
            />
            <div className="register-context">
              <AppIcon name="attendance" size={20} />
              <span>
                <strong>{state.academicYear.name}</strong>
                <small>Academic year</small>
              </span>
            </div>
          </div>
          <div className="attendance-school-timing">
            {timing ? (
              <>
                <span>
                  School hours: {formatSchoolTime(timing.start)} – {formatSchoolTime(timing.end)}
                </span>
                <strong>
                  Late cutoff:{' '}
                  {studentLateCutoff(
                    timing,
                    (state.attendancePolicy ?? defaultAttendancePolicy).graceMinutes,
                  )}
                </strong>
              </>
            ) : hasAssignedTiming ? (
              <span>Not a school working day.</span>
            ) : (
              <Link className="student-timing-link" to="/settings?section=timing">
                Set school timing
              </Link>
            )}
          </div>
        </Panel>
        <div className="attendance-summary">
          {[
            { label: 'Students', value: summary.total, tone: '' },
            { label: 'Present', value: summary.present, tone: 'green' },
            { label: 'Absent', value: summary.absent, tone: 'red' },
            {
              label: 'Late / half day',
              value: `${summary.late} / ${summary['half-day']}`,
              tone: 'amber',
            },
            { label: 'Not marked', value: summary.unmarked, tone: 'neutral' },
          ].map((s) => (
            <div className="panel" key={s.label}>
              <span>{s.label}</span>
              <strong className={`text-${s.tone}`}>{s.value}</strong>
            </div>
          ))}
        </div>
        <Panel
          title={`${state.classes.find((c) => c.id === classId)?.name} · Section ${sections.find((s) => s.id === sectionId)?.name}`}
          subtitle={`${rows.length} active students · ${displayDate(date)}`}
          action={
            <Button
              variant="secondary"
              onClick={() =>
                setDraft(Object.fromEntries(rows.map((r) => [r.enrollment.id, 'present'])))
              }
            >
              <AppIcon name="user-check" size={16} />
              Mark all present
            </Button>
          }
        >
          <div className="info-banner inline">
            <CircleAlert size={16} />
            Not marked is a separate status. It is never counted as absent.
          </div>
          <div className="table-wrap">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th>Roll no.</th>
                  <th>Student</th>
                  <th>Admission number</th>
                  <th>Attendance status</th>
                  <th>Record</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, rowIndex) => {
                  const status = draft[r.enrollment.id] ?? statusFor(state, r.enrollment.id, date);
                  return (
                    <tr key={r.enrollment.id}>
                      <td className="mono">{r.enrollment.rollNumber}</td>
                      <td>
                        <StudentRecordLink className="person" to={`/students/${r.student.id}`}>
                          <Avatar name={r.student.name} />
                          <strong>{r.student.name}</strong>
                        </StudentRecordLink>
                      </td>
                      <td className="mono muted">{r.student.admissionNumber}</td>
                      <td>
                        <div
                          className="status-options"
                          role="group"
                          aria-label={`${r.student.name} attendance`}
                        >
                          {statuses.map((s, statusIndex) => (
                            <button
                              key={s}
                              type="button"
                              disabled={!canManage || saving}
                              aria-pressed={status === s}
                              className={status === s ? `selected ${s}` : ''}
                              onClick={() => setDraft((prev) => ({ ...prev, [r.enrollment.id]: s }))}
                              onKeyDown={(e) => handleAttendanceKeyDown(e, rowIndex, statusIndex, r.enrollment.id)}
                            >
                              {STATUS_LABELS[s]}
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
          <div className="save-bar">
            <div>
              <span className={`status-dot ${dirty ? 'pending' : 'active'}`} />
              <strong>{dirty ? 'Unsaved changes' : 'Register up to date'}</strong>
              <small>
                {summary.attended} attending / {summary.total} total · {summary.percentage}%
                attendance
              </small>
            </div>
            <Button
              disabled={!canManage || saving || !classId || !rows.length}
              onClick={() => void save()}
            >
              <AppIcon name="save" size={16} />
              Save attendance
            </Button>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </Panel>
        <div className="panel-note">
          Choose a date to review attendance. Save changes to update student profiles and the
          dashboard.
        </div>
      </div>
      <Modal
        open={blocker.state === 'blocked'}
        onClose={() => blocker.state === 'blocked' && blocker.reset()}
        title="Leave unsaved attendance?"
        description="Your attendance changes have not been saved. Stay to save them, or discard this draft."
      >
        <div className="modal-actions">
          <Button
            variant="secondary"
            onClick={() => blocker.state === 'blocked' && blocker.reset()}
          >
            Keep editing
          </Button>
          <Button variant="danger" onClick={() => blocker.state === 'blocked' && blocker.proceed()}>
            Discard and leave
          </Button>
        </div>
      </Modal>
        </>
      )}
    </>
  );
}
