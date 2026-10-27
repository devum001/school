import { useState } from 'react';
import type { HrAdapter, HrWorkspace } from '../../services/hrService';
import { formatCalendarDate, titleCase } from '../../lib/displayFormat';
import { attendanceLabel, canRequestArs, pendingLeaveOn } from './attendanceCalendarModel';
import CancelLeaveDialog from './CancelLeaveDialog';
import AttendanceDayDetail from './AttendanceDayDetail';
import ArsRequestDialog from './ArsRequestDialog';
import './hr-personal-calendar.css';
const legends = [
  ['late', 'Late'],
  ['leave', 'On leave'],
  ['absent', 'Absent'],
  ['half-day', 'Half day'],
  ['holiday', 'School holiday'],
  ['invalid', 'Invalid'],
];
export default function AttendanceCalendar({
  data,
  month,
  label = 'My attendance',
  ars,
}: {
  data: HrWorkspace;
  month: string;
  label?: string;
  ars?: { adapter: HrAdapter; saved: () => void };
}) {
  const [selected, setSelected] = useState(
    data.today.startsWith(month) ? data.today : `${month}-01`,
  );
  const [requestDate, setRequestDate] = useState<string>();
  const [cancelLeave, setCancelLeave] = useState<HrWorkspace['leaves'][number]>();
  const [year, m] = month.split('-').map(Number);
  const count = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(year, m - 1, 1)).getUTCDay() + 6) % 7;
  const date = selected.startsWith(month) ? selected : `${month}-01`;
  const day = data.attendance.find((d) => d.date === date);
  const status = attendanceLabel(date, data.today, day, data.leaves, data.settings);
  const requests = data.attendanceRequests ?? [];
  const pending = requests.some((r) => r.date === date && r.status === 'pending');
  const requestDay = data.attendance.find((d) => d.date === requestDate);
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
          const value = `${month}-${String(i + 1).padStart(2, '0')}`;
          const record = data.attendance.find((d) => d.date === value);
          const state = attendanceLabel(value, data.today, record, data.leaves, data.settings);
          const pendingLeave = pendingLeaveOn(value, data.today, data.leaves);
          return (
            <button
              type="button"
              key={value}
              className={`hr-calendar-day hr-day-status-${state}`}
              aria-label={`${formatCalendarDate(value)}: ${titleCase(state)}${pendingLeave ? ', leave requested' : ''}`}
              aria-pressed={date === value}
              aria-current={value === data.today ? 'date' : undefined}
              onClick={() => {
                setSelected(value);
                if (ars && pendingLeave) setCancelLeave(pendingLeave);
                else if (ars && canRequestArs(record, data.today, requests)) setRequestDate(value);
              }}
            >
              <strong>{i + 1}</strong>
              {pendingLeave && <span className="hr-pending-leave-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <div className="hr-calendar-legend" aria-label="Attendance legend">
        {legends.map(([state, name]) => (
          <span key={state}>
            <i className={`hr-day-status-${state}`} aria-hidden="true" />
            {name}
          </span>
        ))}
      </div>
      {ars && (
        <p className="attendance-calendar-hint">
          Tap a half-day or invalid date to request a correction.
        </p>
      )}
      <AttendanceDayDetail date={date} day={day} status={status} timezone={data.timezone} />
      {pending && <p className="ars-pending-note">ARS pending · awaiting administrator approval</p>}
      {ars && pendingLeaveOn(date, data.today, data.leaves) && (
        <p className="ars-pending-note">
          Leave requested · select this date to cancel the pending request.
        </p>
      )}
      {ars && cancelLeave && (
        <CancelLeaveDialog
          leave={cancelLeave}
          adapter={ars.adapter}
          close={() => setCancelLeave(undefined)}
          saved={ars.saved}
        />
      )}
      {ars && requestDay && (
        <ArsRequestDialog
          key={requestDay.date}
          day={requestDay}
          timezone={data.timezone}
          adapter={ars.adapter}
          close={() => setRequestDate(undefined)}
          saved={ars.saved}
        />
      )}
    </section>
  );
}
