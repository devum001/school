import { matchesStaffAttendance } from '../../lib/staffAttendanceSummary';
import ContactPhone from '../../components/shared/ContactPhone';
import AttendanceStatus from '../../components/shared/AttendanceStatus';
import { Link } from 'react-router-dom';
import { Badge, Button, StatCard } from '../../components/ui/Primitives';
import type { HrAdapter, HrStaff, HrWorkspace } from '../../services/hrService';
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
  adapter: _adapter,
  saved: _saved,
  correct,
  calendar,
  live,
  canViewProfile,
  canManage = true,
  filter: propFilter,
  search: propSearch = '',
}: {
  data: HrWorkspace;
  staff: HrStaff[];
  date: string;
  adapter?: HrAdapter;
  saved?: () => void;
  correct: (staff: HrStaff) => void;
  calendar: (staff: HrStaff) => void;
  live: boolean;
  canViewProfile: boolean;
  canManage?: boolean;
  filter?: string;
  onFilterChange?: (filter: string) => void;
  search?: string;
}) {
  const filter = propFilter ?? 'all';
  const search = propSearch;
  const requests = (data.attendanceRequests ?? []).filter((r) =>
    staff.some((s) => s.id === r.staffId),
  );
  const days = new Map(data.attendance.filter((d) => d.date === date).map((d) => [d.staffId, d]));
  const searched = staff
    .filter((p) =>
      `${p.name} ${p.code} ${p.phone || ''}`.toLowerCase().includes(search.toLowerCase()),
    )
    .map((person) => ({ person, day: days.get(person.id) }));
  const rows = searched.filter(({ day }) => matchesStaffAttendance(day?.status, filter));

  const countPresent = staff.filter((p) => {
    const s = days.get(p.id)?.status;
    return matchesStaffAttendance(s, 'present');
  }).length;
  const countAbsent = staff.filter((p) => {
    const s = days.get(p.id)?.status;
    return matchesStaffAttendance(s, 'absent');
  }).length;
  const countLate = staff.filter((p) => {
    const s = days.get(p.id)?.status;
    return matchesStaffAttendance(s, 'late');
  }).length;
  const countHalfDay = staff.filter((p) => {
    const s = days.get(p.id)?.status;
    return matchesStaffAttendance(s, 'half-day');
  }).length;
  const countUnmarked = staff.filter((p) => {
    const s = days.get(p.id)?.status;
    return matchesStaffAttendance(s, 'unmarked');
  }).length;

  return (
    <>
      <div className="attendance-summary stats-grid">
        <StatCard
          label="Total Staff"
          value={staff.length}
          detail="Active staff members"
          tone="blue"
        />
        <StatCard
          label="Present"
          value={countPresent}
          detail={
            staff.length
              ? `${Math.round((countPresent / staff.length) * 100)}% present`
              : '0%'
          }
          tone="green"
        />
        <StatCard
          label="Absent"
          value={countAbsent}
          detail={countAbsent > 0 ? `${countAbsent} absent` : 'No absentees'}
          tone="red"
        />
        <StatCard
          label="Late / Half day"
          value={`${countLate} / ${countHalfDay}`}
          detail={`${countLate} late · ${countHalfDay} half-day`}
          tone="amber"
        />
        <StatCard
          label="Not Marked"
          value={countUnmarked}
          detail={countUnmarked > 0 ? 'Pending recording' : 'All recorded'}
          tone="neutral"
        />
      </div>

      <div className="table-wrap">
        <table className="staff-attendance-register">
          <thead>
            <tr>
              <th>Staff member</th>
              <th>Attendance</th>
              <th>Punch times</th>
              <th>Actions</th>
              <th>Contact</th>
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
                    <AttendanceStatus status={day?.status} />
                    {day && wasLate(day) && day.status === 'present' && (
                      <Badge tone="amber">Late</Badge>
                    )}
                    {day?.inProgress && <Badge tone="neutral">On duty</Badge>}
                  </div>
                  {day?.attendanceExplanation && (
                    <small className="attendance-request-sub">{day.attendanceExplanation}</small>
                  )}
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
                  {canManage && (
                    <Button
                      variant="ghost"
                      onClick={() => correct(person)}
                      disabled={requests.some(
                        (r) =>
                          r.date === date && r.staffId === person.id && r.status === 'pending',
                      )}
                    >
                      Mark / correct
                    </Button>
                  )}
                </td>
                <td>
                  <ContactPhone phone={person.phone} name={person.name} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="panel-note">No staff match this attendance filter.</p>}
      </div>
    </>
  );
}
