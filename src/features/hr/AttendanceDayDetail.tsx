import { ArrowRight, Clock3, LogIn, LogOut } from 'lucide-react';
import { formatCalendarDate, titleCase } from '../../lib/displayFormat';
import type { HrWorkspace } from '../../services/hrService';
export type AttendanceDay = Partial<HrWorkspace['attendance'][number]> & { date: string };
function attendanceTime(value?: string, timezone?: string) {
  return value
    ? new Intl.DateTimeFormat('en-IN', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(value))
    : 'Not available';
}
export default function AttendanceDayDetail({
  date,
  day,
  status,
  timezone,
}: {
  date: string;
  day?: AttendanceDay;
  status: string;
  timezone?: string;
}) {
  const minutes =
    day?.workingMinutes ??
    (day?.punchIn && day.punchOut
      ? Math.floor((Date.parse(day.punchOut) - Date.parse(day.punchIn)) / 60000)
      : null);
  return (
    <section className="attendance-day-card" aria-label="Selected day details">
      <div className="attendance-day-card-heading">
        <div>
          <span>Attendance details</span>
          <h3>{formatCalendarDate(date)}</h3>
        </div>
        <span className={`attendance-day-pill hr-day-status-${status}`}>
          {titleCase(
            status === 'off' ? 'Weekly holiday' : status === 'half-day-leave' ? 'Half day' : status,
          )}
        </span>
      </div>
      <div className="attendance-day-punches">
        <div>
          <span>
            <LogIn size={15} /> Punch in
          </span>
          <strong>{attendanceTime(day?.punchIn, timezone)}</strong>
        </div>
        <ArrowRight className="attendance-day-arrow" size={22} aria-hidden="true" />
        <div>
          <span>
            <LogOut size={15} /> Punch out
          </span>
          <strong>{attendanceTime(day?.punchOut, timezone)}</strong>
        </div>
      </div>
      <div className="attendance-day-duration">
        <Clock3 size={22} />
        <div>
          <span>{day?.attendanceSource ? 'Approved working hours' : 'Working hours'}</span>
          <strong>
            {minutes === null ? 'Not available' : `${Math.floor(minutes / 60)}h ${minutes % 60}m`}
          </strong>
        </div>
      </div>
      {day?.attendanceSource && (
        <p className="attendance-day-source">
          {day.attendanceSource === 'ars'
            ? 'Updated through an approved ARS.'
            : 'Times corrected by your administrator.'}
        </p>
      )}
      {status === 'holiday' && <p className="attendance-day-source">School holiday</p>}
    </section>
  );
}
