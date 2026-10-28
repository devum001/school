import { useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Avatar, Badge, LoadingOverlay, Panel, StatCard } from '../../components/ui/Primitives';
import { useToday } from '../../app/useToday';
import { useLiveSchool } from '../live/schoolContext';
import { useRemote } from '../live/useRemote';
import { loadStaffAttendanceProfile, type HrWorkspace } from '../../services/hrService';
import { formatCalendarDate, titleCase } from '../../lib/displayFormat';
import AttendanceCalendar from '../hr/AttendanceCalendar';
import { PunchChips } from '../hr/StaffAttendancePanel';
import { wasLate } from '../hr/attendanceDisplay';
import '../hr/staff-attendance.css';
export default function LiveStaffProfile() {
  const { schoolId } = useLiveSchool(),
    { teacherId, staffId } = useParams();
  const personId = teacherId ?? staffId ?? '';
  const today = useToday(),
    [params, setParams] = useSearchParams();
  const requested = params.get('month') ?? '';
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : today.slice(0, 7);
  const load = useCallback(
    (signal: AbortSignal) => loadStaffAttendanceProfile(schoolId, personId, month, signal),
    [schoolId, personId, month],
  );
  const state = useRemote(load);
  if (state.error)
    return (
      <Panel title="Staff profile unavailable">
        <p role="alert">{state.error}</p>
        <button onClick={state.reload}>Retry</button>
      </Panel>
    );
  const person = state.data?.staff,
    attendance = state.data?.attendance;
  const calendar: HrWorkspace | undefined =
    attendance && person
      ? { ...attendance, staff: [person], employment: [], payroll: [], payments: [], advances: [] }
      : undefined;
  return (
    <LoadingOverlay loading={state.loading} label="Loading staff profile…">
      <div className="ledger-stack">
        <Link to={teacherId ? '/teachers' : '/staff'}>
          ← Back to {teacherId ? 'teachers' : 'staff'}
        </Link>
        {person && (
          <Panel className="staff-profile-card">
            <div className="staff-profile-hero">
              <Avatar name={person.name} />
              <div>
                <h2>{person.name}</h2>
                <p>
                  {person.designation} · {person.department}
                </p>
                <Badge tone={person.status === 'active' ? 'green' : 'neutral'}>
                  {titleCase(person.status)}
                </Badge>
              </div>
            </div>
            <dl className="staff-profile-details">
              {[
                ['Staff code', person.code],
                ['Email', person.email],
                ['Phone', person.phone],
                ['Joined on', formatCalendarDate(person.joinedOn)],
                ['Qualification', person.qualification],
                ['Login', person.userId ? 'Linked to school account' : 'Not linked'],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value || '—'}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        )}
        {calendar && (
          <>
            <div className="staff-attendance-tools">
              <h3>Attendance history</h3>
              <label className="field">
                Attendance month
                <input
                  type="month"
                  value={month}
                  onChange={(e) => {
                    if (e.target.value) setParams({ month: e.target.value });
                  }}
                />
              </label>
            </div>
            <div className="staff-profile-stats">
              {[
                [
                  'Full days',
                  calendar.attendance.filter(
                    (d) => ['present', 'late'].includes(d.status) && !d.inProgress,
                  ).length,
                ],
                ['Late arrivals', calendar.attendance.filter(wasLate).length],
                ['Half days', calendar.attendance.filter((d) => d.status === 'half-day').length],
                ['Invalid days', calendar.attendance.filter((d) => d.status === 'invalid').length],
              ].map(([label, count]) => (
                <StatCard key={label} label={String(label)} value={count} detail="Selected month" />
              ))}
            </div>
            <Panel>
              <AttendanceCalendar
                data={calendar}
                month={month}
                label={`${person!.name} attendance`}
              />
            </Panel>
            <Panel title="Daily records">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Attendance</th>
                      <th>Punch times</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...calendar.attendance]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((day) => (
                        <tr key={day.id}>
                          <td>{formatCalendarDate(day.date)}</td>
                          <td>
                            {titleCase(day.status)}
                            {wasLate(day) && day.status !== 'late' && ' · Late'}
                            {day.inProgress && ' · On duty'}
                          </td>
                          <td>
                            <PunchChips day={day} timezone={calendar.timezone} />
                          </td>
                          <td>{day.reason || '—'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!calendar.attendance.length && (
                  <p className="panel-note">No recorded attendance for this month.</p>
                )}
              </div>
            </Panel>
          </>
        )}
      </div>
    </LoadingOverlay>
  );
}
