import { useToday } from '../../app/useToday';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  UserCheck,
  CalendarDays,
  ArrowUpRight,
  ArrowRight,
  CheckCheck,
  BookOpen,
  GraduationCap,
} from 'lucide-react';
import { AttendanceTrend } from './AttendanceTrend';
import { useSchool } from '../../app/useSchool';
import { attendanceSummary, roster, statusFor } from '../../lib/selectors';
import { displayDate } from '../../lib/config';
import { Avatar, Badge, PageHeading, Panel, StatCard } from '../../components/ui/Primitives';
import { staffDirectory } from '../../lib/staffStructure';
import { staffStatusFor } from '../../lib/staffAttendance';
import { defaultStaffPayroll } from '../../lib/settings';
import { prolongedAbsences } from '../../lib/attendanceFollowup';
import '../../styles/admin-settings.css';
export default function DashboardPage() {
  const state = useSchool();
  const today = useToday();
  const [selectedDate, setDate] = useState<string | null>(null);
  const date = selectedDate ?? today;
  const rows = roster(state);
  const attendance = attendanceSummary(rows.map((r) => statusFor(state, r.enrollment.id, date)));
  const config = state.staffPayroll ?? defaultStaffPayroll;
  const staff = staffDirectory(state, config).filter(
    (member) => member.status === 'active' && member.joinedOn <= date,
  );
  const staffAttendance = attendanceSummary(
    staff.map((member) => staffStatusFor(state, member.id, date)),
  );
  const followup = prolongedAbsences(state, date);
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
        eyebrow="YOUR SCHOOL, AT A GLANCE"
        title="A good day starts with clarity."
        description={`Welcome back, Dr. Rao. Here’s what’s happening at ${state.school.name}.`}
        actions={
          <>
            <label className="date-control">
              <CalendarDays size={16} />
              <input
                aria-label="Dashboard date"
                type="date"
                value={date}
                min={state.academicYear.start}
                max={today}
                onChange={(e) => {
                  if (e.target.value) setDate(e.target.value);
                }}
              />
            </label>
            <Link className="button primary" to={`/attendance?date=${date}`}>
              <CheckCheck size={17} />
              Mark attendance
            </Link>
          </>
        }
      />
      <div className="stats-grid">
        <StatCard
          label="Enrolled students"
          value={rows.length}
          detail={
            <>
              <span>Across {state.sections.length} sections</span>
            </>
          }
          icon={<Users size={19} />}
          href="/students?status=active"
        />
        <StatCard
          label="Teaching team"
          value={state.teachers.filter((t) => t.status === 'active').length}
          detail="Active teaching staff"
          icon={<GraduationCap size={19} />}
          href="/teachers"
        />
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
              <span className="text-green">{attendance.percentage}% of marked</span>
              <span> · {attendance.unmarked} unmarked</span>
            </>
          }
          icon={<UserCheck size={19} />}
          tone="green"
          href={`/attendance?date=${date}`}
        />
        <StatCard
          label="Staff attending today"
          value={
            <>
              {staffAttendance.attended}
              <small> / {staffAttendance.total}</small>
            </>
          }
          detail={`${staffAttendance.percentage}% of marked · ${staffAttendance.unmarked} unmarked`}
          icon={<UserCheck size={19} />}
          tone="green"
          href={`/attendance/staff?date=${date}`}
        />
      </div>
      <div className="dashboard-main">
        <AttendanceTrend attendance={attendance} trend={trend} />
        <Panel
          title="Today’s attendance"
          subtitle="A clear picture of your classrooms"
          action={<CalendarDays size={18} className="muted" />}
        >
          <div
            className="attendance-donut"
            style={{
              background: `conic-gradient(#2c816e 0 ${(attendance.attended / attendance.total) * 100}%, #dca865 ${(attendance.attended / attendance.total) * 100}% ${((attendance.attended + attendance.absent) / attendance.total) * 100}%, #e8edf2 0)`,
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
            <Link to={`/notifications?date=${date}&event=Student+Absent&focus=pending`}>
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
          title="Classroom pulse"
          subtitle="Attendance by class · selected day"
          action={
            <Link className="text-link" to="/classes">
              All classes <ArrowUpRight size={14} />
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
                    {summary.attended}/{summary.marked}
                  </span>
                  <b>{summary.percentage}%</b>
                </Link>
              );
            })}
          </div>
          <div className="panel-note">
            Attending / marked · Unmarked students are excluded from the rate.
          </div>
        </Panel>
      </div>
      <Panel
        className="dashboard-followup"
        title="Leave follow-up"
        subtitle="Absent for more than 3 consecutive working days. Weekly offs are skipped; unmarked days are not counted."
      >
        <div className="leave-followup-grid">
          <section aria-label="Students on prolonged leave">
            <h3>Students ({followup.students.length})</h3>
            {followup.students.length ? (
              followup.students.map(({ row, count, first }) => (
                <Link
                  key={row.enrollment.id}
                  className="followup-person"
                  to={`/students/${row.student.id}?tab=attendance`}
                >
                  <strong>{row.student.name}</strong>
                  <span>
                    {row.className} · {row.sectionName}
                  </span>
                  <small>
                    {count} days · since {displayDate(first)}
                  </small>
                </Link>
              ))
            ) : (
              <p>No students absent for more than 3 working days.</p>
            )}
          </section>
          <section aria-label="Teachers on prolonged leave">
            <h3>Teachers ({followup.teachers.length})</h3>
            {followup.teachers.length ? (
              followup.teachers.map(({ member, count, first }) => (
                <Link
                  key={member.id}
                  className="followup-person"
                  to={`/staff?tab=Attendance&staff=${member.id}&date=${date}`}
                >
                  <strong>{member.name}</strong>
                  <small>
                    {count} days · since {displayDate(first)}
                  </small>
                </Link>
              ))
            ) : (
              <p>No teachers absent for more than 3 working days.</p>
            )}
          </section>
        </div>
      </Panel>
      <div className="dashboard-absence">
        <Panel
          title="A little attention goes a long way"
          subtitle={`${absent.length} absent students · ${displayDate(date)}`}
          action={
            <Link
              className="text-link"
              to={`/notifications?date=${date}&event=Student+Absent&focus=pending`}
            >
              Notify parents <ArrowUpRight size={14} />
            </Link>
          }
        >
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
                      <Link className="person" to={`/students/${r.student.id}`}>
                        <Avatar name={r.student.name} />
                        <span>
                          <strong>{r.student.name}</strong>
                          <small>{r.student.admissionNumber}</small>
                        </span>
                      </Link>
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
                      <Link aria-label={`View ${r.student.name}`} to={`/students/${r.student.id}`}>
                        <ArrowUpRight size={17} />
                      </Link>
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
            to={`/notifications?date=${date}&event=Student+Absent&focus=pending`}
          >
            View all absent students <ArrowRight size={16} />
          </Link>
        </Panel>
      </div>
    </>
  );
}
