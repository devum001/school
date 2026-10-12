import { useToday } from '../../app/useToday';
import { useState } from 'react';
import { CalendarCheck, CircleAlert, UserCheck } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { Badge, EmptyState, Panel, StatCard } from '../../components/ui/Primitives';
import { attendanceSummary } from '../../lib/selectors';
import { displayDate, STATUS_LABELS } from '../../lib/config';
export function StudentAttendance({ enrollmentId }: { enrollmentId: string }) {
  const state = useSchool();
  const today = useToday();
  const [selectedMonth, setMonth] = useState<string | null>(null);
  const month = selectedMonth ?? today.slice(0, 7);
  const records = state.attendance
    .filter((r) => r.enrollmentId === enrollmentId && r.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));
  const summary = attendanceSummary(records.map((r) => r.status));
  return (
    <>
      <div className="toolbar standalone">
        <label className="filter-label">
          <span>Attendance month</span>
          <input
            aria-label="Attendance month"
            type="month"
            value={month}
            min={state.academicYear.start.slice(0, 7)}
            max={today.slice(0, 7)}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <span className="muted">Select a month to review recorded attendance.</span>
      </div>
      <div className="stats-grid three">
        <StatCard
          label="Present days"
          value={summary.present}
          detail={`${summary.late} late · ${summary['half-day']} half days`}
          icon={<UserCheck size={18} />}
          tone="green"
        />
        <StatCard
          label="Absent days"
          value={summary.absent}
          detail={`${summary.unmarked} explicitly unmarked days`}
          icon={<CircleAlert size={18} />}
          tone="amber"
        />
        <StatCard
          label="Attendance rate"
          value={`${summary.percentage}%`}
          detail={`${summary.attended} attending / ${summary.marked} marked days`}
          icon={<CalendarCheck size={18} />}
        />
      </div>
      <Panel
        title="Monthly attendance"
        subtitle="Only recorded school days appear below. Missing days are not counted as absences."
      >
        <div className="attendance-calendar">
          {[...records].reverse().map((r) => (
            <div key={r.date} className={`calendar-day ${r.status}`}>
              <span>
                {new Date(`${r.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}
              </span>
              <strong>{Number(r.date.slice(8))}</strong>
              <small>{STATUS_LABELS[r.status]}</small>
            </div>
          ))}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Attendance status</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.date}>
                  <td>{displayDate(r.date)}</td>
                  <td>
                    <Badge tone={r.status}>{STATUS_LABELS[r.status]}</Badge>
                  </td>
                  <td className="muted">School attendance register</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!records.length && (
          <EmptyState
            title="No attendance records this month"
            description="Choose another month or mark attendance in the class register."
          />
        )}
      </Panel>
    </>
  );
}
