import TeacherAttendanceChart from './TeacherAttendanceChart';
import { useToday } from '../../app/useToday';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowRight, BookOpen } from 'lucide-react';
import { AttendanceTrend } from './AttendanceTrend';
import StudentRecordLink from '../../components/shared/StudentRecordLink';
import { useSchoolFeature } from '../../app/schoolFeatureContext';
import { useSchool } from '../../app/useSchool';
import { attendanceSummary, roster, statusFor } from '../../lib/selectors';
import {
  PickerInput,
  Avatar,
  Badge,
  PageHeading,
  Panel,
  StatCard,
  AppIcon,
} from '../../components/ui/Primitives';
import { staffDirectory } from '../../lib/staffStructure';
import { staffStatusFor } from '../../lib/staffAttendance';
import { defaultStaffPayroll } from '../../lib/settings';
import '../../styles/admin-settings.css';
export default function DashboardPage() {
  const state = useSchool();
  const feature = useSchoolFeature();
  const today = useToday();
  const teacherOnly = !!feature?.teacherScoped;
  const [selectedDate, setDate] = useState<string | null>(null);
  const notificationsUnavailable = feature?.unavailable.includes('notifications');
  const date = selectedDate ?? feature?.selectedDate ?? today;
  const rows = roster(state);
  const attendance = attendanceSummary(rows.map((r) => statusFor(state, r.enrollment.id, date)));
  const config = state.staffPayroll ?? defaultStaffPayroll;
  const staff = staffDirectory(state, config).filter(
    (member) => member.status === 'active' && member.joinedOn <= date,
  );
  const staffAttendance = attendanceSummary(
    staff.map((member) => staffStatusFor(state, member.id, date)),
  );
  const absent = rows.filter((r) => statusFor(state, r.enrollment.id, date) === 'absent');
  const trend = [...new Set(state.attendance.map((r) => r.date))]
    .filter((d) => d <= date)
    .sort()
    .slice(-7)
    .map((d) => ({
      date: new Date(`${d}T12:00:00`).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
      }),
      attendance: attendanceSummary(rows.map((r) => statusFor(state, r.enrollment.id, d)))
        .percentage,
    }));
  return (
    <>
      <PageHeading
        title="A good day starts with clarity."
        actions={
          <>
            <PickerInput
              className="date-control"
              aria-label="Dashboard date"
              type="date"
              value={date}
              min={state.academicYear.start}
              max={today}
              onChange={(e) => {
                if (e.target.value) {
                  setDate(e.target.value);
                  feature?.refreshDate?.(e.target.value);
                }
              }}
            />
            {(!feature || feature.routeAllowed?.('/attendance')) && (
              <Link className="button primary" to={`/attendance?date=${date}`}>
                <AppIcon name="attendance" size={17} />
                {feature && !feature.canMarkAttendance ? 'Open attendance' : 'Mark attendance'}
              </Link>
            )}
          </>
        }
      />
      {teacherOnly && (
        <p className="panel-note">
          Your assigned classes and sections only. Student totals and graphs reflect your current
          assignments.
        </p>
      )}
      <div className="stats-grid dashboard-stats" role="group" aria-label="School summary">
        <StatCard
          label="Enrolled students"
          value={rows.length}
          detail={
            <>
              <span>Across {state.sections.length} sections</span>
            </>
          }
          href={feature && !feature.canViewStudentProfiles ? '/classes' : '/students?status=active'}
        />
        {!teacherOnly && (
          <StatCard
            label="Teaching team"
            value={state.teachers.filter((t) => t.status === 'active').length}
            detail="Active teaching staff"
            href={feature && !feature.routeAllowed?.('/teachers') ? undefined : '/teachers'}
          />
        )}
        <StatCard
          label="Student attending today"
          value={
            <>
              {attendance.attended}
              <small> / {attendance.total}</small>
            </>
          }
          detail={
            <>
              <span className="text-green">{attendance.percentage}% of total</span>
              <span> · {attendance.unmarked} unmarked</span>
            </>
          }
          href={`/attendance?date=${date}`}
        />
        {!teacherOnly && (
          <StatCard
            label="Staff attending today"
            value={
              <>
                {feature?.unavailable.includes('staffAttendance') ? '—' : staffAttendance.attended}
                {!feature?.unavailable.includes('staffAttendance') && (
                  <small> / {staffAttendance.total}</small>
                )}
              </>
            }
            detail={
              feature?.unavailable.includes('staffAttendance')
                ? 'Staff attendance access is required'
                : feature?.staffAttendanceSummary
                  ? `${feature.staffAttendanceSummary.onDuty} on duty · ${feature.staffAttendanceSummary.late} late`
                  : `${staffAttendance.percentage}% attending`
            }
            href={
              feature && !feature.routeAllowed?.('/attendance/staff')
                ? undefined
                : `/attendance/staff?date=${date}`
            }
          />
        )}
      </div>
      {!teacherOnly && (!feature || feature.teacherAttendance) && (
        <TeacherAttendanceChart
          summary={
            feature
              ? feature.teacherAttendance!
              : {
                  date,
                  total: state.teachers.filter((t) => t.status === 'active' && t.joinedOn <= date)
                    .length,
                  counts: state.teachers
                    .filter((t) => t.status === 'active' && t.joinedOn <= date)
                    .reduce<Record<string, number>>((counts, t) => {
                      const status = staffStatusFor(state, t.id, date);
                      counts[status] = (counts[status] || 0) + 1;
                      return counts;
                    }, {}),
                }
          }
          registerUrl={
            !feature
              ? `/attendance?register=staff&date=${date}`
              : feature.routeAllowed?.('/attendance/staff')
                ? `/attendance/staff?date=${date}`
                : undefined
          }
        />
      )}
      <div className="dashboard-main">
        <AttendanceTrend attendance={attendance} trend={trend} />
        <Panel
          title="Today’s attendance"
          subtitle="A clear picture of your classrooms"
          action={<AppIcon name="attendance" size={22} />}
        >
          <div
            className="attendance-donut"
            style={{
              background: `conic-gradient(#2c816e 0 ${(attendance.attended / (attendance.total || 1)) * 100}%, #dca865 ${(attendance.attended / (attendance.total || 1)) * 100}% ${((attendance.attended + attendance.absent) / (attendance.total || 1)) * 100}%, #e8edf2 0)`,
            }}
          >
            <div>
              <strong>{attendance.attended}</strong>
              <span>students attending</span>
            </div>
          </div>
          <div className="attendance-legend">
            <Link to={`/attendance?date=${date}`}>
              <span>
                <i className="legend-dot green" />
                Present / late / half day
              </span>
              <strong>
                {attendance.present} / {attendance.late} / {attendance['half-day']}
              </strong>
            </Link>
            <Link
              to={
                notificationsUnavailable
                  ? '#'
                  : `/notifications?date=${date}&event=Student+Absent&focus=pending`
              }
              aria-disabled={notificationsUnavailable}
              onClick={(e) => {
                if (notificationsUnavailable) e.preventDefault();
              }}
              title={
                notificationsUnavailable
                  ? 'Notification delivery is not configured for live mode'
                  : undefined
              }
            >
              <span>
                <i className="legend-dot amber" />
                Absent
              </span>
              <strong>{attendance.absent}</strong>
            </Link>
            <Link to={`/attendance?date=${date}`}>
              <span>
                <i className="legend-dot gray" />
                Not marked
              </span>
              <strong>{attendance.unmarked}</strong>
            </Link>
          </div>
          <Link className="panel-bottom-link" to={`/attendance?date=${date}`}>
            Open attendance register <ArrowRight size={16} />
          </Link>
        </Panel>
      </div>
      <div className="dashboard-classroom">
        <Panel
          title="Attendance by class · selected day"
          action={
            <Link className="text-link" to="/classes">
              {teacherOnly ? 'My classes' : 'All classes'} <ArrowUpRight size={14} />
            </Link>
          }
        >
          <div className="class-pulse">
            {state.classes.map((c) => {
              const summary = attendanceSummary(
                rows
                  .filter((r) => r.enrollment.classId === c.id)
                  .map((r) => statusFor(state, r.enrollment.id, date)),
              );
              return (
                <Link
                  to={`/attendance?class=${c.id}&date=${date}`}
                  key={c.id}
                  className="pulse-row"
                >
                  <span className="class-icon">
                    <BookOpen size={16} />
                  </span>
                  <strong>{c.name}</strong>
                  <div className="progress">
                    <span style={{ width: `${summary.percentage}%` }} />
                  </div>
                  <span>
                    {summary.attended}/{summary.total}
                  </span>
                  <b>{summary.percentage}%</b>
                </Link>
              );
            })}
          </div>
          <div className="panel-note">
            Attending / total enrolled · Attendance rate is calculated out of total students.
          </div>
        </Panel>
      </div>
      <div className="dashboard-absence">
        <Panel
          title="Absent students · selected day"
          action={
            <Link
              className="text-link"
              to={
                notificationsUnavailable
                  ? '#'
                  : `/notifications?date=${date}&event=Student+Absent&focus=pending`
              }
              aria-disabled={notificationsUnavailable}
              onClick={(e) => {
                if (notificationsUnavailable) e.preventDefault();
              }}
              title={
                notificationsUnavailable
                  ? 'Notification delivery is not configured for live mode'
                  : undefined
              }
            >
              Notify parents <ArrowUpRight size={14} />
            </Link>
          }
        >
          {notificationsUnavailable && (
            <p className="panel-note">
              Notification delivery is not connected. Attendance records below are saved school
              data.
            </p>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Parent contact</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {absent.slice(0, 4).map((r) => (
                  <tr key={r.enrollment.id}>
                    <td>
                      <StudentRecordLink className="person" to={`/students/${r.student.id}`}>
                        <Avatar name={r.student.name} />
                        <span>
                          <strong>{r.student.name}</strong>
                          <small>{r.student.admissionNumber}</small>
                        </span>
                      </StudentRecordLink>
                    </td>
                    <td>
                      {r.className} · {r.sectionName}
                    </td>
                    <td>
                      <Badge tone={r.student.guardian.contact ? 'green' : 'amber'}>
                        {r.student.guardian.contact ? 'Contact available' : 'Contact missing'}
                      </Badge>
                    </td>
                    <td>
                      <StudentRecordLink
                        aria-label={`View ${r.student.name}`}
                        to={`/students/${r.student.id}`}
                      >
                        {(!feature || feature.canViewStudentProfiles) && <ArrowUpRight size={17} />}
                      </StudentRecordLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {absent.length === 0 && (
              <p className="panel-note">No students marked absent for this date.</p>
            )}
          </div>
          <Link
            className="panel-bottom-link"
            to={
              notificationsUnavailable
                ? '#'
                : `/notifications?date=${date}&event=Student+Absent&focus=pending`
            }
            aria-disabled={notificationsUnavailable}
            onClick={(e) => {
              if (notificationsUnavailable) e.preventDefault();
            }}
            title={
              notificationsUnavailable
                ? 'Notification delivery is not configured for live mode'
                : undefined
            }
          >
            View all absent students <ArrowRight size={16} />
          </Link>
        </Panel>
      </div>
    </>
  );
}
