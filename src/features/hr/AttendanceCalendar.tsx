import { useState } from 'react';
import type { HrWorkspace } from '../../services/hrService';
import { formatCalendarDate, titleCase } from '../../lib/displayFormat';
import './hr-personal-calendar.css';
import { attendanceLabel } from './attendanceCalendarModel';
export default function AttendanceCalendar({
  data,
  month,
  label = 'My attendance',
}: {
  data: HrWorkspace;
  month: string;
  label?: string;
}) {
  const [selected, setSelected] = useState('');
  const [year, m] = month.split('-').map(Number);
  const count = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(year, m - 1, 1)).getUTCDay() + 6) % 7;
  const statuses = [
    'present',
    'late',
    'half-day',
    'absent',
    'review',
    'leave',
    'half-day-leave',
    'holiday',
    'off',
    'unmarked',
    'upcoming',
  ];
  const record = data.attendance.find((d) => d.date === selected);
  return (
    <section className="hr-personal-calendar" aria-label={`${label} calendar`}>
      <div className="hr-personal-calendar-heading">
        <h3>{label}</h3>
        <span>
          {new Intl.DateTimeFormat('en-IN', {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
          }).format(new Date(Date.UTC(year, m - 1, 1)))}
        </span>
      </div>
      <div className="hr-personal-calendar-grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <span className="hr-calendar-weekday" key={d}>
            {d}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span aria-hidden="true" key={'empty' + i} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, '0')}`;
          const status = attendanceLabel(
            date,
            data.today,
            data.attendance.find((d) => d.date === date),
            data.leaves,
            data.settings,
          );
          return (
            <button
              type="button"
              key={date}
              className={`hr-calendar-day hr-day-status-${status}`}
              aria-label={`${formatCalendarDate(date)}: ${titleCase(status)}`}
              aria-pressed={selected === date}
              aria-current={date === data.today ? 'date' : undefined}
              onClick={() => setSelected(date)}
            >
              <strong>{i + 1}</strong>
              <span>{titleCase(status)}</span>
            </button>
          );
        })}
      </div>
      <div className="hr-calendar-legend" aria-label="Attendance legend">
        {statuses.map((s) => (
          <span key={s}>
            <i className={`hr-day-status-${s}`} aria-hidden="true" />
            {titleCase(s)}
          </span>
        ))}
      </div>
      <p className="panel-note">
        Unmarked means no attendance record; it does not mean absent. Select a date for details.
      </p>
      {selected && (
        <div className="hr-calendar-day-detail" role="status">
          <strong>{formatCalendarDate(selected)}</strong>
          <p>
            {titleCase(attendanceLabel(selected, data.today, record, data.leaves, data.settings))}
          </p>
          {record && (
            <>
              <p>Salary decision: {titleCase(record.decision)}</p>
              <p>
                Punch in:{' '}
                {record.punchIn
                  ? new Date(record.punchIn).toLocaleTimeString('en-IN', {
                      timeZone: data.timezone,
                    })
                  : '—'}{' '}
                · Punch out:{' '}
                {record.punchOut
                  ? new Date(record.punchOut).toLocaleTimeString('en-IN', {
                      timeZone: data.timezone,
                    })
                  : '—'}
              </p>
              {record.reason && <p>{record.reason}</p>}
            </>
          )}
        </div>
      )}
    </section>
  );
}
