import { useToday } from '../../app/useToday';
import { useState } from 'react';
import { useSchool } from '../../app/useSchool';
import { AppIcon, PickerInput, Panel, StatCard } from '../../components/ui/Primitives';
import { recordedAttendanceSummary } from '../../lib/selectors';
import { STATUS_LABELS } from '../../lib/config';
export function StudentAttendance({ enrollmentId }: { enrollmentId: string }) {
  const state = useSchool();
  const today = useToday();
  const [selectedMonth, setMonth] = useState<string | null>(null);
  const month =
    selectedMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(selectedMonth)
      ? selectedMonth
      : today.slice(0, 7);
  const records = state.attendance
    .filter((r) => r.enrollmentId === enrollmentId && r.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));
  const [year, monthNumber] = month.split('-').map(Number);
  const days = Array.from({ length: new Date(year, monthNumber, 0).getDate() }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, '0')}`;
    return { date, status: records.find((record) => record.date === date)?.status ?? 'unmarked' };
  });
  const summary = recordedAttendanceSummary(
    days.filter((day) => day.date <= today).map((day) => day.status),
  );
  return (
    <>
      <div className="toolbar standalone">
        <label className="filter-label">
          <span>Attendance month</span>
          <PickerInput
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
          icon={<AppIcon name="user-check" size={24} />}
          tone="green"
        />
        <StatCard
          label="Absent days"
          value={summary.absent}
          detail={`${summary.unmarked} not marked days`}
          icon={<AppIcon name="verified" size={24} />}
          tone="amber"
        />
        <StatCard
          label="Attendance rate"
          value={`${summary.percentage}%`}
          detail={`${summary.attended} attending / ${summary.marked} marked days`}
          icon={<AppIcon name="attendance" size={24} />}
        />
      </div>
      <Panel title="Monthly attendance">
        <div className="attendance-calendar">
          {days.map((r) => (
            <div
              key={r.date}
              className={`calendar-day ${r.date > today ? 'upcoming' : r.status}`}
              aria-label={`${r.date}: ${r.date > today ? 'Upcoming' : STATUS_LABELS[r.status]}`}
            >
              <span>
                {new Date(`${r.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}
              </span>
              <strong>{Number(r.date.slice(8))}</strong>
              <small>{r.date > today ? 'Upcoming' : STATUS_LABELS[r.status]}</small>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
