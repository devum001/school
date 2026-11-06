import { Clock3, LogIn, LogOut } from 'lucide-react';
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
  ars = true,
  pending,
}: {
  date: string;
  day?: Partial<HrWorkspace['attendance'][number]> | undefined;
  status: string;
  timezone?: string;
  ars?: boolean;
  pending?: boolean;
}) {
  const minutes =
    day?.workingMinutes ??
    (day?.punchIn && day.punchOut
      ? Math.floor((Date.parse(day.punchOut) - Date.parse(day.punchIn)) / 60000)
      : null);

  const displayStatus =
    status === 'holiday'
      ? 'Holiday'
      : status === 'off'
        ? 'Weekly holiday'
        : status === 'half-day-leave'
          ? 'Half day'
          : status;

  return (
    <section className="attendance-day-card" aria-label="Selected day details">
      <div className="attendance-day-card-heading">
        <div>
          <span className="attendance-day-card-subtitle">Attendance details</span>
          <h3>{formatCalendarDate(date)}</h3>
        </div>
        <span className={`attendance-day-pill hr-day-status-${status}`}>
          {titleCase(displayStatus)}
        </span>
      </div>

      <div className="attendance-day-timeline">
        <div className="attendance-timeline-item">
          <div className="attendance-timeline-point">
            <LogIn size={15} />
          </div>
          <div className="attendance-timeline-content">
            <span className="attendance-timeline-label">Punch In</span>
            <strong>{attendanceTime(day?.punchIn, timezone)}</strong>
          </div>
        </div>
        <div className="attendance-timeline-line" />
        <div className="attendance-timeline-item">
          <div className="attendance-timeline-point">
            <LogOut size={15} />
          </div>
          <div className="attendance-timeline-content">
            <span className="attendance-timeline-label">Punch Out</span>
            <strong>{attendanceTime(day?.punchOut, timezone)}</strong>
          </div>
        </div>
      </div>

      <div className="attendance-day-duration">
        <Clock3 size={20} />
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
      {pending && (
        <p className="ars-pending-note">ARS pending · awaiting administrator approval</p>
      )}

      {ars && (
        <p className="attendance-calendar-hint">
          Tap an absent, half-day or invalid date to request a correction.
        </p>
      )}
    </section>
  );
}
