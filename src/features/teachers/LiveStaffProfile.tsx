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
import { LeaveDialog, PaymentDialog, Payslip } from '../hr/HrActions';
import EmploymentDialog from '../hr/EmploymentDialog';
import StaffLoginDialog from '../hr/StaffLoginDialog';
import PeopleRelations from '../setup/PeopleRelations';
import { StaffEditor } from './LiveStaff';
import SalaryAdvanceOverviewModal from '../hr/SalaryAdvanceOverviewModal';
import {
  Shield,
  KeyRound,
  Mail,
  Phone,
  User,
  Check,
  ArrowRight,
  UserPlus,
} from 'lucide-react';
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
            {tab === 'Salary' && data && (() => {
              const emp = data.employment?.find((e) => e.staffId === person.id) ?? data.employment?.[0];
              const sal = emp?.salaries?.filter((s) => s.effectiveMonth <= month)?.at(-1) ?? emp?.salaries?.slice(-1)[0];
              const basic = sal?.basic ?? 0;
              const allowance = sal?.allowance ?? 0;
              const bonus = sal?.bonus ?? 0;
              const deduction = sal?.deduction ?? 0;
              const totalGross = basic + allowance + bonus;

              const policy = emp?.policies?.filter((p) => p.effectiveMonth <= month)?.at(-1) ?? emp?.policies?.slice(-1)[0];
              const attendanceMode = policy?.attendanceMode ?? emp?.attendanceMode ?? (person.teaching ? 'punch' : 'manual');
              const attendanceModeLabel =
                attendanceMode === 'punch'
                  ? 'Teacher Punch (GPS)'
                  : attendanceMode === 'manual'
                  ? 'Admin Attendance'
                  : 'No Attendance Required';

              return (
                <div className="ledger-stack" style={{ gap: '20px' }}>
                  {/* Dedicated Configured Salary Structure Panel */}
                  <Panel
                    title="Staff Salary Structure (वेतन संरचना)"
                    subtitle={`Configured monthly salary and salary components for ${person.name}`}
                    action={
                      can('payroll.manage') && (
                        <Button variant="secondary" onClick={() => setAction('salary')}>
                          Edit salary setup
                        </Button>
                      )
                    }
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '16px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Total Monthly Salary
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: '#14532d', marginTop: '6px' }}>
                          {rupees(totalGross)}
                        </div>
                        <div style={{ fontSize: '12px', color: '#15803d', marginTop: '4px' }}>
                          ₹{(totalGross / 100).toLocaleString('en-IN')} / month
                        </div>
                      </div>

                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Basic Salary (मूल वेतन)
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
                          {rupees(basic)}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                          Base compensation
                        </div>
                      </div>

                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Allowances (भत्ते)
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
                          {rupees(allowance)}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                          Monthly allowances
                        </div>
                      </div>

                      {bonus > 0 && (
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Bonus (बोनस)
                          </div>
                          <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
                            {rupees(bonus)}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                            Monthly bonus
                          </div>
                        </div>
                      )}

                      {deduction > 0 && (
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '16px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Standard Deduction (कटौती)
                          </div>
                          <div style={{ fontSize: '20px', fontWeight: 700, color: '#b91c1c', marginTop: '6px' }}>
                            -{rupees(deduction)}
                          </div>
                          <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>
                            Monthly deduction
                          </div>
                        </div>
                      )}

                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Attendance Policy
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '8px' }}>
                          {attendanceModeLabel}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                          {sal?.effectiveMonth ? `Effective: ${sal.effectiveMonth}` : 'Current session'}
                        </div>
                      </div>
                    </div>

                    {totalGross === 0 && (
                      <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '12px 16px', color: '#b45309', fontSize: '13px' }}>
                        ⚠️ Salary has not been configured for this staff member yet. Click "Edit salary setup" to enter basic salary and allowances.
                      </div>
                    )}
                  </Panel>

                  {/* Monthly Payroll & Disbursals Section */}
              <Panel
                title="Salary & payments (Monthly Payroll Breakdown)"
                action={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--muted, #64748b)', whiteSpace: 'nowrap' }}>
                        Salary month
                      </span>
                      <input
                        type="month"
                        value={month}
                        style={{
                          height: '34px',
                          padding: '4px 10px',
                          fontSize: '13px',
                          fontWeight: 600,
                          borderRadius: '6px',
                          border: '1px solid var(--border, #d3ddda)',
                          background: 'var(--surface-panel, #fff)',
                          color: '#1e293b',
                        }}
                        onChange={(e) => {
                          if (e.target.value) setParams({ tab, month: e.target.value });
                        }}
                      />
                    </div>
                    {(() => {
                      const staffAdvance = data.advanceBalances?.find((a) => a.staffId === person.id);
                      const hasAdvance = (staffAdvance?.issued ?? 0) > 0 || (data.advances || []).some((a) => a.staffId === person.id);
                      if (!hasAdvance) return null;
                      return (
                        <button
                          type="button"
                          style={{
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            fontWeight: 600,
                            fontSize: '13px',
                            padding: '7px 14px',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                          }}
                          onClick={() => setAction('advanceOverview')}
                        >
                          Salary Advance Overview
                        </button>
                      );
                    })()}
                    {can('payroll.manage') && (
                      <Button onClick={() => setAction('salary')}>Salary setup</Button>
                    )}
                  </div>
                }
              >
                <div style={{ marginBottom: '16px' }}>
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
                  </div>
                  <Link
                    className="button secondary"
                    to={`/fees?tab=Salary+Expenses&staff=${person.id}&month=${month}`}
                  >
                    Open salary processing
                  </Link>
                </Panel>
              </div>
            );
          })()}
            {tab === 'Account' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {person.userId ? (
                  <>
                    {/* Card 1: School account & access */}
                    <div
                      style={{
                        background: '#ffffff',
                        border: '1px solid #eaecf0',
                        borderRadius: '16px',
                        padding: '24px 28px',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '16px',
                        }}
                      >
                        <div>
                          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#111827' }}>
                            School account & access
                          </h3>
                          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                            Manage portal login credentials, security roles, and system permissions.
                          </p>
                        </div>
                        <div>
                          {state.data?.account?.status === 'active' || (!state.data?.account && person.status === 'active') ? (
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: '#eaf5ee',
                                color: '#2e7d4d',
                                padding: '4px 12px',
                                borderRadius: '20px',
                                fontSize: '12px',
                                fontWeight: 500,
                              }}
                            >
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2e7d4d' }} />
                              Active account
                            </div>
                          ) : (
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: '#f1f5f9',
                                color: '#64748b',
                                padding: '4px 12px',
                                borderRadius: '20px',
                                fontSize: '12px',
                                fontWeight: 500,
                              }}
                            >
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#64748b' }} />
                              {state.data?.account ? titleCase(state.data.account.status) : 'Disabled'}
                            </div>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                          gap: '0',
                          marginTop: '28px',
                        }}
                      >
                        {/* Left Column: Login Identity */}
                        <div style={{ paddingRight: '28px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '16px' }}>
                            <Shield size={20} strokeWidth={1.5} color="#4b5563" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div>
                              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#111827' }}>
                                Login Identity
                              </h4>
                              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                                Credentials used to access Schoolwell
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '11px 16px',
                                background: '#f8fafc',
                                borderRadius: '8px',
                              }}
                            >
                              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
                                <Mail size={16} strokeWidth={1.5} /> Registered email
                              </span>
                              <strong style={{ fontSize: '13px', color: '#111827', fontWeight: 600 }}>
                                {person.email || 'dev@gmail.com'}
                              </strong>
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '11px 16px',
                                background: '#f8fafc',
                                borderRadius: '8px',
                              }}
                            >
                              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
                                <Phone size={16} strokeWidth={1.5} /> Phone number
                              </span>
                              <strong style={{ fontSize: '13px', color: '#111827', fontWeight: 600 }}>
                                {person.phone || '9125789641'}
                              </strong>
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '11px 16px',
                                background: '#f8fafc',
                                borderRadius: '8px',
                              }}
                            >
                              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
                                <User size={16} strokeWidth={1.5} /> Staff code
                              </span>
                              <strong style={{ fontSize: '13px', color: '#111827', fontWeight: 600 }}>
                                {person.code || '2121'}
                              </strong>
                            </div>
                          </div>
                        </div>

                        {/* Right Column: Role & Permissions */}
                        <div style={{ borderLeft: '1px solid #f1f5f9', paddingLeft: '28px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '16px' }}>
                            <KeyRound size={20} strokeWidth={1.5} color="#4b5563" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div>
                              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#111827' }}>
                                Role & Permissions
                              </h4>
                              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                                System authorization and privileges.
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '11px 16px',
                                background: '#f8fafc',
                                borderRadius: '8px',
                              }}
                            >
                              <span style={{ fontSize: '13px', color: '#64748b' }}>Assigned role</span>
                              <span
                                style={{
                                  fontSize: '12px',
                                  fontWeight: 500,
                                  padding: '3px 12px',
                                  borderRadius: '16px',
                                  background: '#e0f2fe',
                                  color: '#0284c7',
                                }}
                              >
                                {state.data?.account?.role || (person.teaching ? 'Teacher' : 'Staff')}
                              </span>
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '11px 16px',
                                background: '#f8fafc',
                                borderRadius: '8px',
                              }}
                            >
                              <span style={{ fontSize: '13px', color: '#64748b' }}>Department</span>
                              <strong style={{ fontSize: '13px', color: '#111827', fontWeight: 600 }}>
                                {person.department} · {person.designation}
                              </strong>
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '11px 16px',
                                background: '#f8fafc',
                                borderRadius: '8px',
                              }}
                            >
                              <span style={{ fontSize: '13px', color: '#64748b' }}>Portal access</span>
                              <span
                                style={{
                                  fontSize: '13px',
                                  color: '#16a34a',
                                  fontWeight: 600,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                }}
                              >
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }} />
                                Enabled
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Portal features enabled for this account */}
                    <div
                      style={{
                        background: '#ffffff',
                        border: '1px solid #eaecf0',
                        borderRadius: '16px',
                        padding: '24px 28px',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
                      }}
                    >
                      <h4 style={{ margin: '0 0 18px 0', fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                        Portal features enabled for this account
                      </h4>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                          gap: '24px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <Check size={16} strokeWidth={2} color="#475569" style={{ flexShrink: 0, marginTop: '2px' }} />
                          <div>
                            <strong style={{ fontSize: '13px', color: '#111827', fontWeight: 600, display: 'block' }}>
                              Teacher Punch (GPS)
                            </strong>
                            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#6b7280', lineHeight: 1.45 }}>
                              Daily secure punch in & out on school campus.
                            </p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <Check size={16} strokeWidth={2} color="#475569" style={{ flexShrink: 0, marginTop: '2px' }} />
                          <div>
                            <strong style={{ fontSize: '13px', color: '#111827', fontWeight: 600, display: 'block' }}>
                              Class Attendance
                            </strong>
                            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#6b7280', lineHeight: 1.45 }}>
                              Mark and manage student daily attendance.
                            </p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <Check size={16} strokeWidth={2} color="#475569" style={{ flexShrink: 0, marginTop: '2px' }} />
                          <div>
                            <strong style={{ fontSize: '13px', color: '#111827', fontWeight: 600, display: 'block' }}>
                              Salary & Payslips
                            </strong>
                            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#6b7280', lineHeight: 1.45 }}>
                              View salary breakdowns, advances & download clips.
                            </p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <Check size={16} strokeWidth={2} color="#475569" style={{ flexShrink: 0, marginTop: '2px' }} />
                          <div>
                            <strong style={{ fontSize: '13px', color: '#111827', fontWeight: 600, display: 'block' }}>
                              Tests & Results
                            </strong>
                            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#6b7280', lineHeight: 1.45 }}>
                              Enter marks and evaluate student exams
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card 3: Need to change account role or permissions? */}
                    {can('memberships.manage') && (
                      <div
                        style={{
                          background: '#ffffff',
                          border: '1px solid #eaecf0',
                          borderRadius: '16px',
                          padding: '16px 28px',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '16px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: '13px', color: '#111827', fontWeight: 600, display: 'block' }}>
                            Need to change account role or permissions?
                          </strong>
                          <span style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginTop: '3px' }}>
                            You can adjust assigned privileges or manage active memberships in workspace settings.
                          </span>
                        </div>
                        <Link
                          to="/settings?tab=Roles+%26+Permissions&section=members"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            background: '#ffffff',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: '#111827',
                            textDecoration: 'none',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Manage account and role <ArrowRight size={14} />
                        </Link>
                      </div>
                    )}
                  </>
                ) : (
                  /* Empty State when no account is linked */
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px dashed #cbd5e1',
                      borderRadius: '16px',
                      padding: '40px 20px',
                      textAlign: 'center',
                      maxWidth: '520px',
                      margin: '20px auto',
                    }}
                  >
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: '#fef3c7',
                        color: '#d97706',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '14px',
                      }}
                    >
                      <UserPlus size={24} />
                    </div>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
                      No login account linked
                    </h4>
                    <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                      This staff member does not have an active login account yet. Linking an account allows them to log in to Schoolwell to punch in and out, mark student attendance, and access their salary.
                    </p>
                    {can('staff.manage') && can('memberships.manage') && can('roles.view') && (
                      <Button onClick={() => setAction('login')}>Create login account</Button>
                    )}
                  </div>
                )}
              </div>
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
            {action === 'advance' && data && (
              <PaymentDialog
                adapter={adapter}
                data={data}
                staff={person}
                close={close}
                saved={saved}
              />
            )}
            {action === 'advanceOverview' && data && (
              <SalaryAdvanceOverviewModal
                open
                onClose={close}
                staff={person}
                data={data}
                canGiveAdvance={can('payroll.pay')}
                onGiveAdvance={() => setAction('advance')}
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
