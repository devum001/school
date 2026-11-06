import { matchesStaffAttendance } from '../../lib/staffAttendanceSummary';
import { useCallback, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Avatar,
  Badge,
  Button,
  LoadingOverlay,
  Panel,
  StatCard,
} from '../../components/ui/Primitives';
import SectionNavigation from '../../components/shared/SectionNavigation';
import ContactPhone from '../../components/shared/ContactPhone';
import AttendanceStatus from '../../components/shared/AttendanceStatus';
import { useToday } from '../../app/useToday';
import { useLiveSchool } from '../live/schoolContext';
import { useRemote } from '../live/useRemote';
import {
  liveHrAdapter,
  loadStaffAttendanceProfile,
  payrollStatus,
  rupees,
  type HrWorkspace,
} from '../../services/hrService';
import { personSchema } from '../../services/onboardingService';
import { formatCalendarDate, titleCase } from '../../lib/displayFormat';
import { getSavedHolidays } from '../../lib/indianHolidays';
import AttendanceCalendar from '../hr/AttendanceCalendar';
import { PunchChips } from '../hr/StaffAttendancePanel';
import { LeaveDialog, Payslip } from '../hr/HrActions';
import EmploymentDialog from '../hr/EmploymentDialog';
import StaffLoginDialog from '../hr/StaffLoginDialog';
import PeopleRelations from '../setup/PeopleRelations';
import { StaffEditor } from './LiveStaff';
import '../hr/staff-attendance.css';

const DAY_MAP: Record<string, number> = {
  Sunday: 0,
  Sun: 0,
  Monday: 1,
  Mon: 1,
  Tuesday: 2,
  Tue: 2,
  Wednesday: 3,
  Wed: 3,
  Thursday: 4,
  Thu: 4,
  Friday: 5,
  Fri: 5,
  Saturday: 6,
  Sat: 6,
};

export default function LiveStaffProfile() {
  const { schoolId, access, status, profile } = useLiveSchool(),
    { teacherId, staffId } = useParams();
  const personId = teacherId ?? staffId ?? '',
    today = useToday(),
    [params, setParams] = useSearchParams();
  const requested = params.get('month') ?? '',
    month = /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : today.slice(0, 7);
  const can = (p: string) => access.permissions.includes(p);
  const load = useCallback(
    (signal: AbortSignal) => loadStaffAttendanceProfile(schoolId, personId, month, signal),
    [schoolId, personId, month],
  );
  const state = useRemote(load),
    adapter = useMemo(() => liveHrAdapter(schoolId), [schoolId]);
  const [action, setAction] = useState(''),
    [leave, setLeave] = useState<HrWorkspace['leaves'][number]>(),
    [slip, setSlip] = useState<HrWorkspace['payroll'][number]>(),
    [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const close = () => {
      setAction('');
      setLeave(undefined);
      setSlip(undefined);
    },
    saved = () => {
      close();
      state.reload();
    };
  const person = state.data?.staff,
    rawData = state.data?.workspace;

  const data = useMemo(() => {
    if (!rawData) return undefined;
    const baseSettings = rawData.settings;
    const schoolHoursDays = profile?.school?.hours?.days;
    const workingDays =
      schoolHoursDays && schoolHoursDays.length > 0
        ? schoolHoursDays.map((d) => DAY_MAP[d]).filter((n): n is number => n !== undefined)
        : baseSettings?.workingDays;
    const localSaved = getSavedHolidays();
    const holidays = Array.from(new Set([...(baseSettings?.holidays || []), ...localSaved]));
    return {
      ...rawData,
      settings: {
        ...baseSettings,
        workingDays: workingDays ?? baseSettings?.workingDays,
        holidays,
      },
    };
  }, [rawData, profile?.school?.hours?.days]);
  const tabs = [
    'Overview',
    ...(state.data?.attendance ? ['Attendance'] : []),
    ...(person?.teaching && can('assignments.view') ? ['Assignments'] : []),
    ...(data &&
    (can('attendance.view') ||
      can('attendance.manage') ||
      can('leave.approve') ||
      can('leave.reject'))
      ? ['Leave']
      : []),
    ...(data && can('payroll.view') ? ['Salary'] : []),
    ...(can('memberships.view') ? ['Account'] : []),
  ];
  const tab = tabs.includes(params.get('tab') || '') ? params.get('tab')! : 'Overview';
  const day = data?.attendance.find((d) => d.date === data.today);
  return (
    <LoadingOverlay loading={state.loading} label="Loading staff profile…">
      <div className="ledger-stack">
        <Link to={teacherId ? '/teachers' : '/staff'}>
          ← Back to {teacherId ? 'teachers' : 'staff'}
        </Link>
        {state.error && (
          <Panel title="Staff profile unavailable">
            <p role="alert">{state.error}</p>
            <Button onClick={state.reload}>Retry</Button>
          </Panel>
        )}
        {person && (
          <>
            <Panel className="staff-profile-card">
              <div className="staff-profile-hero">
                {person.photoDataUrl ? (
                  <img className="avatar" src={person.photoDataUrl} alt={person.name} />
                ) : (
                  <Avatar name={person.name} />
                )}
                <div className="staff-profile-identity">
                  <h2>{person.name}</h2>
                  <p>
                    {titleCase(person.designation)} · {titleCase(person.department)}
                  </p>
                  <Badge tone={person.status === 'active' ? 'green' : 'neutral'}>
                    {titleCase(person.status)}
                  </Badge>
                </div>
                <ContactPhone phone={person.phone} name={person.name} />
                {(can('staff.edit') || can('staff.manage')) && (
                  <Button variant="secondary" onClick={() => setAction('edit')}>
                    Edit profile
                  </Button>
                )}
              </div>
            </Panel>
            <SectionNavigation
              label="Staff profile"
              value={tab}
              onChange={(tab) =>
                setParams((p) => {
                  const next = new URLSearchParams(p);
                  next.set('tab', tab);
                  return next;
                })
              }
              items={tabs.map((id) => ({
                id,
                label: id,
                icon: id === 'Attendance' ? 'attendance' : id === 'Salary' ? 'wallet' : 'staff',
              }))}
            />
            {tab === 'Overview' && (
              <Panel title="Overview" className="staff-profile-overview">
                <dl className="staff-profile-details">
                  {[
                    ['Employee ID', person.code],
                    ['Email', person.email],
                    ['Joined on', formatCalendarDate(person.joinedOn)],
                    ['Qualification', person.qualification],
                    [
                      'Account setup',
                      person.userId ? 'Linked to school account' : 'Account not created',
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value || '—'}</dd>
                    </div>
                  ))}
                </dl>
                {state.data?.attendance && (
                  <div className="staff-attendance-tools">
                    <AttendanceStatus status={day?.status} />
                    <PunchChips day={day} timezone={data?.timezone} />
                  </div>
                )}
                {!person.userId &&
                  person.teaching &&
                  can('staff.manage') &&
                  can('memberships.manage') &&
                  can('roles.view') && (
                    <Button variant="secondary" onClick={() => setAction('login')}>
                      Create login
                    </Button>
                  )}
                <p className="panel-note">
                  Teachers use their linked school account to punch in and out, following school
                  work rules and location settings.
                </p>
              </Panel>
            )}
            {tab === 'Attendance' && data && (
              <>
                <div className="staff-profile-stats">
                  {['present', 'late', 'absent', 'half-day'].map((s) => (
                    <StatCard
                      key={s}
                      label={titleCase(s.replaceAll('-', ' '))}
                      value={
                        data.attendance.filter((d) => matchesStaffAttendance(d.status, s)).length
                      }
                      detail={
                        s === 'present'
                          ? 'Includes late arrivals and half days'
                          : ['late', 'half-day'].includes(s)
                            ? 'Also counted in Present'
                            : ''
                      }
                    />
                  ))}
                </div>
                <Panel>
                  <AttendanceCalendar
                    data={data}
                    month={month}
                    onMonthChange={(newMonth) => setParams({ tab, month: newMonth })}
                    label={`${person.name} attendance`}
                  />
                </Panel>
                {can('attendance.manage') && (
                  <Link
                    className="button secondary"
                    to={`/attendance/staff?staff=${person.id}&month=${month}`}
                  >
                    Open register and corrections
                  </Link>
                )}
              </>
            )}
            {tab === 'Assignments' && (
              <PeopleRelations
                access={access}
                yearId={status.currentAcademicYearId}
                kind="teaching-assignments"
                staffId={person.id}
              />
            )}
            {tab === 'Leave' && data && (
              <Panel
                title="Leave requests"
                subtitle={`Annual paid allowance: ${data.settings.paidLeaveDays} days · Used: ${data.leaveUsage?.find((l) => l.staffId === person.id)?.used || 0} days · Absence days included: ${data.leaveUsage?.find((l) => l.staffId === person.id)?.absenceDays || 0}`}
              >
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Dates</th>
                        <th>Reason</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.leaves.map((l) => (
                        <tr key={l.id}>
                          <td>
                            {formatCalendarDate(l.start)} – {formatCalendarDate(l.end)}
                          </td>
                          <td>{l.reason}</td>
                          <td>{titleCase(l.status)}</td>
                          <td>
                            {l.status === 'pending' &&
                              (can('leave.approve') ||
                                can('leave.reject') ||
                                can('attendance.manage')) && (
                                <Button variant="secondary" onClick={() => setLeave(l)}>
                                  Review
                                </Button>
                              )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!data.leaves.length && (
                    <p className="panel-note">No leave requests in this period.</p>
                  )}
                </div>
              </Panel>
            )}
            {tab === 'Salary' && data && (
              <Panel
                title="Salary & payments"
                action={
                  can('payroll.manage') && (
                    <Button onClick={() => setAction('salary')}>Salary setup</Button>
                  )
                }
              >
                <label className="field">
                  Salary month
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => {
                      if (e.target.value) setParams({ tab, month: e.target.value });
                    }}
                  />
                </label>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Net salary</th>
                        <th>Payment status</th>
                        <th>Statement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.payroll.map((p) => (
                        <tr key={p.id}>
                          <td>{p.month}</td>
                          <td>{rupees(p.net)}</td>
                          <td>{payrollStatus(p, data)}</td>
                          <td>
                            <Button variant="ghost" onClick={() => setSlip(p)}>
                              View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!data.payroll.length && (
                    <div style={{ padding: '16px 0' }}>
                      {data.employment?.[0]?.salaries?.slice(-1)[0]?.basic > 0 ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '16px',
                            background: 'var(--surface-sunken, #f8fafc)',
                            padding: '12px 16px',
                            borderRadius: '8px',
                          }}
                        >
                          <p className="panel-note" style={{ margin: 0 }}>
                            Salary is configured (
                            {rupees(
                              (data.employment[0].salaries.slice(-1)[0].basic || 0) +
                                (data.employment[0].salaries.slice(-1)[0].allowance || 0) +
                                (data.employment[0].salaries.slice(-1)[0].bonus || 0) -
                                (data.employment[0].salaries.slice(-1)[0].deduction || 0),
                            )}
                            /mo), but payroll draft has not been generated for {month} yet.
                          </p>
                          {can('payroll.manage') && (
                            <Button
                              disabled={isGeneratingDraft}
                              onClick={async () => {
                                try {
                                  setIsGeneratingDraft(true);
                                  await adapter.save(`/staff/${person.id}/payroll`, {
                                    month,
                                    revision: 0,
                                    adjustment: 0,
                                    advanceRecovery: 0,
                                    note: 'Draft generated from profile',
                                  });
                                  state.reload();
                                } catch (e) {
                                  console.error(e);
                                } finally {
                                  setIsGeneratingDraft(false);
                                }
                              }}
                            >
                              {isGeneratingDraft ? 'Generating draft…' : 'Generate salary draft'}
                            </Button>
                          )}
                        </div>
                      ) : (
                        <p className="panel-note">Payroll has not been generated for this month.</p>
                      )}
                    </div>
                  )}
                </div>
                <Link
                  className="button secondary"
                  to={`/fees?tab=Salary+Expenses&staff=${person.id}&month=${month}`}
                >
                  Open salary processing
                </Link>
              </Panel>
            )}
            {tab === 'Account' && (
              <Panel title="School account">
                <p>
                  {state.data?.account
                    ? `${titleCase(state.data.account.status)} · ${state.data.account.role}`
                    : person.userId
                      ? 'Account unavailable'
                      : 'No login account linked'}
                </p>
                {!person.userId &&
                  can('staff.manage') &&
                  can('memberships.manage') &&
                  can('roles.view') && (
                    <Button onClick={() => setAction('login')}>Create login</Button>
                  )}
                {person.userId && can('memberships.manage') && (
                  <Link
                    className="button secondary"
                    to="/settings?tab=Roles+%26+Permissions&section=members"
                  >
                    Manage account and role
                  </Link>
                )}
              </Panel>
            )}
            {action === 'salary' && data && (
              <EmploymentDialog
                adapter={adapter}
                staff={person}
                employment={data.employment[0]}
                month={month}
                close={close}
                saved={saved}
                canLink={can('memberships.manage') && can('memberships.view')}
              />
            )}
            {action === 'login' && (
              <StaffLoginDialog
                schoolId={schoolId}
                staff={person}
                permissions={access.permissions}
                close={close}
                saved={saved}
              />
            )}
            {action === 'edit' && (
              <StaffEditor
                schoolId={schoolId}
                person={personSchema.parse(person)}
                teaching={person.teaching}
                close={close}
                saved={saved}
              />
            )}
            {leave && data && (
              <LeaveDialog
                adapter={adapter}
                data={data}
                leave={leave}
                close={close}
                saved={saved}
                decisions={[
                  ...(can('leave.approve') || can('attendance.manage') ? ['approved'] : []),
                  ...(can('leave.reject') || can('attendance.manage') ? ['rejected'] : []),
                ]}
              />
            )}
            {slip && data && <Payslip item={slip} data={data} close={close} />}
          </>
        )}
      </div>
    </LoadingOverlay>
  );
}
