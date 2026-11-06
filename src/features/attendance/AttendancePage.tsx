import { useToday } from '../../app/useToday';
import { useEffect, useState } from 'react';
import { Link, useBlocker, useSearchParams, useNavigate } from 'react-router-dom';
import { AlertCircle, CalendarX2, CircleAlert, Clock } from 'lucide-react';
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
  StatCard,
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
import { isDateHoliday } from '../../lib/indianHolidays';
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
  const navigate = useNavigate();
  const state = useSchool();
  const feature = useSchoolFeature(),
    data = feature ?? repository,
    isTeacherOnLeave = Boolean(feature?.attendanceGate?.onLeave),
    canManage = (feature?.canManage ?? true) && !isTeacherOnLeave;
  const [saving, setSaving] = useState(false);
  const today = useToday();
  const notify = useFeedback();
  const [params, setParams] = useSearchParams();
  const isTeacher = Boolean(feature?.teacherScoped);
  const registerParam = params.get('register');
  const register: 'student' | 'staff' | 'self' | 'ars' =
    registerParam === 'ars'
      ? 'ars'
      : registerParam === 'staff' && !isTeacher
        ? 'staff'
        : isTeacher && registerParam === 'self'
          ? 'self'
          : 'student';
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
  const [, setHolidayRevision] = useState(0);
  useEffect(() => {
    const handleHolidayChange = () => setHolidayRevision((v) => v + 1);
    window.addEventListener('schoolwell_holidays_changed', handleHolidayChange);
    return () => window.removeEventListener('schoolwell_holidays_changed', handleHolidayChange);
  }, []);

  const holidayInfo = isDateHoliday(date, state.holidays);
  const isNonWorkingDay = !timing && hasAssignedTiming;
  const isDateLocked = holidayInfo.isHoliday || isNonWorkingDay;
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});
  const [error, setError] = useState('');
  const handleAttendanceKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    rowIndex: number,
    statusIndex: number,
    enrollmentId: string,
  ) => {
    if (e.altKey || e.ctrlKey || e.metaKey || isTeacherOnLeave || !canManage || isDateLocked) return;
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
    if (saving || isDateLocked) {
      if (isDateLocked) {
        notify(
          holidayInfo.isHoliday
            ? `Cannot record attendance on school holiday (${holidayInfo.reason}).`
            : 'Cannot record attendance on a non-working day.',
        );
      }
      return;
    }
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {timing ? (
              <div className="attendance-header-timing">
                <span className="timing-chip">
                  <Clock size={15} style={{ color: '#2c816e' }} />
                  <span>
                    School hours: <strong>{formatSchoolTime(timing.start)} – {formatSchoolTime(timing.end)}</strong>
                  </span>
                </span>
                <span className="timing-divider" />
                <span className="timing-chip cutoff">
                  <span>
                    Late cutoff:{' '}
                    <strong>
                      {studentLateCutoff(
                        timing,
                        (state.attendancePolicy ?? defaultAttendancePolicy).graceMinutes,
                      )}
                    </strong>
                  </span>
                </span>
              </div>
            ) : hasAssignedTiming ? (
              <div className="attendance-header-timing">
                <span className="timing-chip">Not a school working day</span>
              </div>
            ) : feature?.teacherScoped ? (
              <div className="attendance-header-timing">
                <span className="timing-chip">School timing not configured</span>
              </div>
            ) : (
              <Link className="button secondary" to="/settings?section=timing">
                Set school timing
              </Link>
            )}
            {(!feature || feature.routeAllowed?.('/notifications')) && register === 'student' && (
              <Link
                className="button secondary"
                to={`/notifications?date=${date}&class=${classId}&section=${sectionId}&event=Student+Absent&focus=pending`}
              >
                <AppIcon name="send" size={16} />
                Review notifications
              </Link>
            )}
          </div>
        }
      />
      <AttendanceTabs
        date={date}
        value={register}
        onChange={(val) => {
          if (feature && val === 'staff') {
            navigate(`/attendance/staff?date=${date}`);
            return;
          }
          setParams((prev) => {
            const next = new URLSearchParams(prev);
            if (val === 'staff') {
              next.set('register', 'staff');
              next.delete('view');
            } else if (val === 'self') {
              next.set('register', 'self');
              next.set('view', 'attendance');
            } else if (val === 'ars') {
              next.set('register', 'ars');
              next.set('view', 'requests');
            } else {
              next.delete('register');
              next.delete('view');
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
      ) : register === 'ars' ? (
        <LiveHrWorkspace section={isTeacher ? 'self' : 'ars'} hideNavigation />
      ) : register === 'self' ? (
        <LiveHrWorkspace section="self" hideNavigation />
      ) : (
        <>
          {isTeacherOnLeave ? (
            <Panel title="On approved leave today">
              <div
                className="info-banner"
                style={{
                  borderLeft: '4px solid #e11d48',
                  background: '#fff1f2',
                  color: '#9f1239',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <CircleAlert size={18} style={{ color: '#e11d48', flexShrink: 0 }} />
                <span>
                  <strong>You are on approved leave today.</strong> Student attendance marking and
                  editing are disabled for your account while on leave.
                </span>
              </div>
            </Panel>
          ) : null}
          {feature && !state.classes.length && (
            <p className="panel-note">
              No classes are assigned to you yet. Your school administrator can assign classes and
              subjects in Staff & HR → Staff assignments.
            </p>
          )}
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
                    Attendance cannot be marked or edited on designated school holidays and festivals.
                  </span>
                </div>
              </div>
            ) : isNonWorkingDay ? (
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
                  <strong style={{ display: 'block', fontSize: '15px' }}>Non-Working Day</strong>
                  <span style={{ fontSize: '13px', color: '#b45309' }}>
                    School is closed on this day. Attendance recording is disabled.
                  </span>
                </div>
              </div>
            ) : null}
            <div className="attendance-summary stats-grid">
              <StatCard
                label="Total Students"
                value={summary.total}
                detail="Enrolled in section"
                tone="blue"
              />
              <StatCard
                label="Present"
                value={summary.present}
                detail={
                  summary.total
                    ? `${Math.round((summary.present / summary.total) * 100)}% present`
                    : '0%'
                }
                tone="green"
              />
              <StatCard
                label="Absent"
                value={summary.absent}
                detail={summary.absent > 0 ? `${summary.absent} absent` : 'No absentees'}
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
                detail={summary.unmarked > 0 ? 'Pending recording' : 'All recorded'}
                tone="neutral"
              />
            </div>
            <Panel
              className="attendance-register-panel"
              title={`${state.classes.find((c) => c.id === classId)?.name ?? 'Class'}${sectionId ? ` · Section ${sections.find((s) => s.id === sectionId)?.name}` : ' · Whole class'}`}
              subtitle={`${rows.length} active students · ${displayDate(date)}`}
              action={
                <div className="attendance-register-controls">
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
                  <Button
                    variant="secondary"
                    disabled={!canManage || saving || !rows.length || isDateLocked}
                    onClick={() =>
                      setDraft(Object.fromEntries(rows.map((r) => [r.enrollment.id, 'present'])))
                    }
                  >
                    <AppIcon name="user-check" size={16} />
                    Mark all present
                  </Button>
                </div>
              }
            >
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
                      const status =
                        draft[r.enrollment.id] ?? statusFor(state, r.enrollment.id, date);
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
                                  disabled={!canManage || saving || isDateLocked}
                                  aria-pressed={status === s}
                                  className={status === s ? `selected ${s}` : ''}
                                  onClick={() =>
                                    setDraft((prev) => ({ ...prev, [r.enrollment.id]: s }))
                                  }
                                  onKeyDown={(e) =>
                                    handleAttendanceKeyDown(
                                      e,
                                      rowIndex,
                                      statusIndex,
                                      r.enrollment.id,
                                    )
                                  }
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
                  disabled={!canManage || saving || !classId || !rows.length || isDateLocked}
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
              <Button
                variant="danger"
                onClick={() => blocker.state === 'blocked' && blocker.proceed()}
              >
                Discard and leave
              </Button>
            </div>
          </Modal>
        </>
      )}
    </>
  );
}
