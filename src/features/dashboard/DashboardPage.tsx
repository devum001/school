import { useToday } from '../../app/useToday';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  UserCheck,
  Wallet,
  CalendarDays,
  ArrowUpRight,
  ArrowRight,
  CheckCheck,
  Clock3,
  CircleAlert,
  BookOpen,
  GraduationCap,
} from 'lucide-react';
import { AttendanceTrend } from './AttendanceTrend';
import { useSchool } from '../../app/useSchool';
import { attendanceSummary, feeSummary, roster, statusFor } from '../../lib/selectors';
import { displayDate, shortMoney, money } from '../../lib/config';
import { Avatar, Badge, PageHeading, Panel, StatCard } from '../../components/ui/Primitives';
export default function DashboardPage() {
  const state = useSchool();
  const today = useToday();
  const [selectedDate, setDate] = useState<string | null>(null);
  const date = selectedDate ?? today;
  const rows = roster(state);
  const attendance = attendanceSummary(rows.map((r) => statusFor(state, r.enrollment.id, date)));
  const fees = feeSummary(state);
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
  const collected = fees.total ? Math.round((fees.paid / fees.total) * 100) : 0;
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
      <div className="context-strip">
        <span>
          <span className="live-dot" /> Academic year {state.academicYear.name}
        </span>
        <span>Attendance date · {displayDate(date)}</span>
        <Badge tone="blue">Principal’s workspace</Badge>
      </div>
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
          label="Attending today"
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
          label="Fees collected · this year"
          value={shortMoney(fees.paid)}
          detail={`${collected}% of annual obligations`}
          icon={<Wallet size={19} />}
          tone="amber"
          href="/fees"
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
            <Link to={`/notifications?date=${date}`}>
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
      <div className="dashboard-secondary">
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
        <Panel
          title="Fees, in focus"
          subtitle="Annual obligations · all enrolled records"
          action={<Wallet size={18} className="muted" />}
        >
          <div className="fee-focus">
            <span>Outstanding balance</span>
            <strong>{shortMoney(fees.outstanding)}</strong>
            <p>Includes future installments</p>
            <div className="progress thick">
              <span style={{ width: `${collected}%` }} />
            </div>
            <div className="split-line">
              <span>{collected}% collected</span>
              <span>{money(fees.total)} total</span>
            </div>
            <div className="fee-focus-bottom">
              <span>
                <i className="legend-dot green" />
                Collected <b>{shortMoney(fees.paid)}</b>
              </span>
              <span>
                <i className="legend-dot gray" />
                Outstanding <b>{shortMoney(fees.outstanding)}</b>
              </span>
            </div>
            <Link className="button secondary full-width" to="/fees">
              View fee management <ArrowRight size={16} />
            </Link>
          </div>
        </Panel>
      </div>
      <div className="dashboard-bottom">
        <Panel
          title="A little attention goes a long way"
          subtitle={`${absent.length} absent students · ${displayDate(date)}`}
          action={
            <Link className="text-link" to={`/notifications?date=${date}`}>
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
          <Link className="panel-bottom-link" to={`/notifications?date=${date}`}>
            View all absent students <ArrowRight size={16} />
          </Link>
        </Panel>
        <Panel title="Around the school" subtitle="Recent workspace activity">
          <div className="activity-list">
            {state.activities.slice(0, 4).map((a) => (
              <div className="activity-item" key={a.id}>
                <span className={`activity-icon ${a.kind === 'payment' ? 'green' : 'blue'}`}>
                  {a.kind === 'payment' ? (
                    <Wallet size={15} />
                  ) : a.kind === 'notification' ? (
                    <CircleAlert size={15} />
                  ) : (
                    <CheckCheck size={15} />
                  )}
                </span>
                <div>
                  <strong>{a.text}</strong>
                  <p>{a.detail}</p>
                  <small>
                    <Clock3 size={11} />
                    {displayDate(a.date)}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
