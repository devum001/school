import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge, Button } from '../../components/ui/Primitives';
import type { HrAdapter, HrStaff, HrWorkspace } from '../../services/hrService';
import AttendanceRequests from './AttendanceRequests';
import { titleCase } from '../../lib/displayFormat';
import './staff-attendance.css';
import { wasLate } from './attendanceDisplay';
export function PunchChips({
  day,
  timezone,
}: {
  day?: HrWorkspace['attendance'][number];
  timezone?: string;
}) {
  const time = (value: string) =>
    new Intl.DateTimeFormat('en-IN', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(value));
  return (
    <div className="staff-punch-chips">
      <span className={day?.punchIn ? 'punch-chip in' : 'punch-chip'}>
        In · {day?.punchIn ? time(day.punchIn) : '—'}
      </span>
      <span className={day?.punchOut ? 'punch-chip out' : 'punch-chip'}>
        Out · {day?.punchOut ? time(day.punchOut) : day?.attendanceClosed ? 'ARS' : '—'}
      </span>
    </div>
  );
}
export default function StaffAttendancePanel({
  data,
  staff,
  date,
  adapter,
  saved,
  correct,
  calendar,
  live,
  canViewProfile,
}: {
  data: HrWorkspace;
  staff: HrStaff[];
  date: string;
  adapter: HrAdapter;
  saved: () => void;
  correct: (staff: HrStaff) => void;
  calendar: (staff: HrStaff) => void;
  live: boolean;
  canViewProfile: boolean;
}) {
  const [params] = useSearchParams();
  const [view, setView] = useState(params.get('view') === 'requests' ? 'requests' : 'register'),
    [filter, setFilter] = useState('all');
  const requests = (data.attendanceRequests ?? []).filter((r) =>
    staff.some((s) => s.id === r.staffId),
  );
  const pending = requests.filter((r) => r.status === 'pending').length;
  const rows = staff
    .map((person) => ({
      person,
      day: data.attendance.find((d) => d.staffId === person.id && d.date === date),
    }))
    .filter(
      ({ day }) =>
        filter === 'all' ||
        (filter === 'late'
          ? !!day && wasLate(day)
          : filter === 'on-duty'
            ? day?.inProgress
            : (day?.status ?? 'unmarked') === filter),
    );
  return (
    <>
      <div className="staff-attendance-tools">
        <div className="staff-attendance-views">
          <Button variant="secondary" onClick={saved}>
            Refresh attendance
          </Button>
          <Button
            variant={view === 'register' ? 'primary' : 'secondary'}
            onClick={() => setView('register')}
          >
            Daily register
          </Button>
          {live && (
            <Button
              variant={view === 'requests' ? 'primary' : 'secondary'}
              onClick={() => setView('requests')}
            >
              Attendance requests{pending ? ` (${pending})` : ''}
            </Button>
          )}
        </div>
        {view === 'register' && (
          <label className="field">
            Attendance filter
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All staff</option>
              <option value="on-duty">On duty</option>
              <option value="late">Late arrivals</option>
              <option value="half-day">Half day</option>
              <option value="absent">Absent</option>
              <option value="invalid">Invalid / missed punch</option>
              <option value="unmarked">Not marked</option>
            </select>
          </label>
        )}
      </div>
      {view === 'requests' ? (
        <AttendanceRequests
          requests={requests}
          staff={staff}
          self={false}
          adapter={adapter}
          saved={saved}
          today={data.today}
        />
      ) : (
        <div className="table-wrap">
          <table className="staff-attendance-register">
            <thead>
              <tr>
                <th>Staff member</th>
                <th>Attendance</th>
                <th>Punch times</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ person, day }) => (
                <tr key={person.id}>
                  <td>
                    {live && canViewProfile ? (
                      <Link
                        to={`/${person.teaching ? 'teachers' : 'staff'}/${person.id}?month=${date.slice(0, 7)}`}
                      >
                        <strong>{person.name}</strong>
                      </Link>
                    ) : (
                      <strong>{person.name}</strong>
                    )}
                    <small className="attendance-request-sub">
                      {person.department} · {person.designation}
                    </small>
                  </td>
                  <td>
                    <div className="staff-attendance-badges">
                      <Badge
                        tone={
                          day?.status === 'invalid'
                            ? 'red'
                            : day?.status === 'absent'
                              ? 'red'
                              : ['half-day', 'late'].includes(day?.status ?? '')
                                ? 'amber'
                                : day?.status === 'present'
                                  ? 'green'
                                  : 'neutral'
                        }
                      >
                        {titleCase(
                          day?.status === 'present'
                            ? day.inProgress
                              ? 'Present'
                              : 'Full day'
                            : (day?.status ?? 'Unmarked'),
                        )}
                      </Badge>
                      {day && wasLate(day) && day.status !== 'late' && (
                        <Badge tone="amber">Late</Badge>
                      )}
                      {day?.inProgress && <Badge tone="neutral">On duty</Badge>}
                    </div>
                    {day?.missedPunchOut && (
                      <small className="attendance-request-sub">
                        Missed punch-out · request needed
                      </small>
                    )}
                    {day?.status === 'invalid' && !day.missedPunchOut && (
                      <small className="attendance-request-sub">Awaiting correction</small>
                    )}
                  </td>
                  <td>
                    <PunchChips day={day} timezone={data.timezone} />
                  </td>
                  <td>
                    <Button variant="ghost" onClick={() => calendar(person)}>
                      Calendar
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => correct(person)}
                      disabled={requests.some(
                        (r) => r.date === date && r.staffId === person.id && r.status === 'pending',
                      )}
                    >
                      Correct attendance
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="panel-note">No staff match this attendance filter.</p>}
        </div>
      )}
    </>
  );
}
