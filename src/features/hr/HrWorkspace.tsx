import CancelLeaveDialog from './CancelLeaveDialog';
import AttendanceTimeDialog from './AttendanceTimeDialog';
import AttendanceRequests from './AttendanceRequests';
import StaffAttendancePanel from './StaffAttendancePanel';
import { wasLate } from './attendanceDisplay';
import StaffLoginDialog from './StaffLoginDialog';
import AttendanceCalendar from './AttendanceCalendar';
import { Link, useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  LoadingOverlay,
  Modal,
  Panel,
  StatCard,
  Avatar,
  PickerInput,
} from '../../components/ui/Primitives';
import CalendarDateInput from '../../components/ui/CalendarDateInput';
import { CalendarDays } from 'lucide-react';
import SectionNavigation from '../../components/shared/SectionNavigation';
import type { IconName } from '../../components/ui/Primitives';
const HR_NAV_ICONS: Record<string, IconName> = {
  salary: 'wallet',
  attendance: 'attendance',
  leave: 'document',
  self: 'staff',
};
import { useToday } from '../../app/useToday';
import { useLiveSchool } from '../live/schoolContext';
import { useRemote } from '../live/useRemote';
import {
  liveHrAdapter,
  payrollPaid,
  payrollStatus,
  rupees,
  type HrAdapter,
  type HrPayroll,
  type HrStaff,
  type HrWorkspace as Workspace,
} from '../../services/hrService';
import EmploymentDialog from './EmploymentDialog';
import HrSettingsPanel from './HrSettingsPanel';
import { AttendanceDialog, LeaveDialog, PaymentDialog, PayrollDialog, Payslip } from './HrActions';
import { HrForm } from './HrForms';
import { formatCalendarDate, titleCase } from '../../lib/displayFormat';
import './hr.css';
export default function LiveHrWorkspace({
  section,
  settings = false,
  hideNavigation = false,
  teachersOnly = false,
  month,
  onMonthChange,
  hideMonthCorner = false,
}: {
  section?: string;
  settings?: boolean;
  hideNavigation?: boolean;
  teachersOnly?: boolean;
  month?: string;
  onMonthChange?: (month: string) => void;
  hideMonthCorner?: boolean;
}) {
  const { schoolId, access, status } = useLiveSchool();
  const adapter = useMemo(() => liveHrAdapter(schoolId), [schoolId]);
  return (
    <HrWorkspace
      key={`${schoolId}:${settings}`}
      adapter={adapter}
      liveSchoolId={schoolId}
      permissions={access.permissions}
      punchSchoolId={status.selfTeaching ? schoolId : undefined}
      section={section}
      settings={settings}
      hideNavigation={hideNavigation}
      teachersOnly={teachersOnly}
      month={month}
      onMonthChange={onMonthChange}
      hideMonthCorner={hideMonthCorner}
    />
  );
}
export function HrWorkspace({
  adapter,
  permissions,
  section,
  settings = false,
  hideNavigation = false,
  teachersOnly = false,
  punchSchoolId,
  liveSchoolId,
  month: controlledMonth,
  onMonthChange,
  hideMonthCorner = false,
}: {
  liveSchoolId?: string;
  punchSchoolId?: string;
  adapter: HrAdapter;
  permissions: readonly string[];
  section?: string;
  settings?: boolean;
  hideNavigation?: boolean;
  teachersOnly?: boolean;
  month?: string;
  onMonthChange?: (month: string) => void;
  hideMonthCorner?: boolean;
}) {
  const today = useToday(),
    [internalMonth, setInternalMonth] = useState(today.slice(0, 7)),
    month = controlledMonth ?? internalMonth,
    setMonth = useCallback(
      (m: string) => {
        setInternalMonth(m);
        onMonthChange?.(m);
      },
      [onMonthChange],
    ),
    [tab, setTab] = useState(
      section ??
        (permissions.includes('payroll.view')
          ? 'salary'
          : permissions.includes('attendance.manage')
            ? 'attendance'
            : 'self'),
    );
  const can = (p: string) => permissions.includes(p),
    self = tab === 'self';
  const allowed = settings
    ? can('payroll.view') && can('payroll.manage')
    : self
      ? can('attendance.self')
      : tab === 'salary'
        ? can('payroll.view')
        : can('attendance.manage');
  const load = useCallback(
    async (signal: AbortSignal) =>
      allowed
        ? {
            value: await adapter.load(month, self, signal),
            key: `${month}:${self}`,
          }
        : null,
    [adapter, month, self, allowed],
  );
  const state = useRemote(load);
  const { reload } = state;
  useEffect(() => {
    if (!punchSchoolId) return;
    const refresh = (event: Event) => {
      if ((event as CustomEvent<string>).detail === punchSchoolId) reload();
    };
    window.addEventListener('schoolwell:punch-change', refresh);
    return () => window.removeEventListener('schoolwell:punch-change', refresh);
  }, [punchSchoolId, reload]);
  const items = [
    ...(can('payroll.view') ? [{ id: 'salary', label: 'Salary Expenses' }] : []),
    ...(can('attendance.manage')
      ? [
          { id: 'attendance', label: 'Attendance' },
          { id: 'leave', label: 'Leave' },
        ]
      : []),
    ...(can('attendance.self') ? [{ id: 'self', label: 'My attendance & salary' }] : []),
  ];
  const loadingMessage = settings
    ? 'Loading staff & payroll settings…'
    : tab === 'self'
      ? 'Loading my attendance & salary…'
      : tab === 'attendance'
        ? 'Loading staff attendance…'
        : tab === 'leave'
          ? 'Loading leave requests…'
          : 'Loading salary expenses…';
  const targetKey = `${month}:${self}`;
  const isReady = Boolean(state.data && state.data.key === targetKey);
  const fallbackWorkspace = useMemo<Workspace>(
    () => ({
      today,
      settings: {
        id: 'default',
        schoolId: 'default',
        revision: 0,
        departments: ['Academic', 'Administration', 'Operations'],
        start: '08:30',
        end: '15:30',
        lateAfter: '08:45',
        halfDayMinutes: 210,
        workingDays: [1, 2, 3, 4, 5, 6],
        holidays: [],
        paymentDay: 5,
        deductionBasis: 'basic',
        divisor: '30',
        paidLeaveDays: 12,
        maxAccuracy: 120,
        locations: [],
      },
      staff: [],
      employment: [],
      attendance: [],
      leaves: [],
      payroll: [],
      payments: [],
      advances: [],
    }),
    [today],
  );
  const activeWorkspace = isReady ? state.data!.value : (state.data?.value ?? fallbackWorkspace);
  return (
    <div className="ledger-stack hr-workspace">
      {!settings && (!hideNavigation || (!hideMonthCorner && tab !== 'leave')) && (
        <div className="hr-top-bar">
          {!hideNavigation && section !== 'self' && items.length > 1 && (
            <SectionNavigation
              label="Staff & HR"
              items={items.map((i) => ({ ...i, icon: HR_NAV_ICONS[i.id] || ('staff' as const) }))}
              value={tab}
              onChange={setTab}
            />
          )}
          {!hideMonthCorner && tab !== 'leave' && (
            <label className="hr-month-corner">
              <span className="sr-only">
                {self ? 'Calendar / salary month' : 'Salary / attendance month'}
              </span>
              <PickerInput
                type="month"
                required
                aria-label={self ? 'Calendar / salary month' : 'Salary / attendance month'}
                value={month}
                onChange={(e) => {
                  if (e.target.value) setMonth(e.target.value);
                }}
              />
            </label>
          )}
        </div>
      )}
      {!allowed ? (
        <Panel>
          <p>Your role does not include this area.</p>
        </Panel>
      ) : state.error ? (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      ) : settings ? (
        can('payroll.manage') ? (
          <LoadingOverlay
            loading={!isReady || state.loading}
            size="xl"
            label={loadingMessage}
            message={loadingMessage}
          >
            <HrSettingsPanel
              key={`${section ?? 'departments'}:${isReady ? activeWorkspace.settings.revision : 'loading'}`}
              settings={activeWorkspace.settings}
              staff={activeWorkspace.staff}
              section={section ?? 'departments'}
              adapter={adapter}
              saved={state.reload}
            />
          </LoadingOverlay>
        ) : (
          <Panel>
            <p>Payroll management permission is required to edit these settings.</p>
          </Panel>
        )
      ) : (
        <LoadingOverlay
          loading={!isReady || state.loading}
          size="xl"
          label={loadingMessage}
          message={loadingMessage}
        >
          <HrContent
            key={`${month}:${tab}`}
            adapter={adapter}
            data={{
              ...activeWorkspace,
              staff: teachersOnly
                ? activeWorkspace.staff.filter((p) => p.teaching)
                : activeWorkspace.staff,
            }}
            tab={tab}
            month={month}
            can={can}
            permissions={permissions}
            reload={state.reload}
            changeMonth={setMonth}
            dedicatedPunchPage={Boolean(punchSchoolId)}
            liveSchoolId={liveSchoolId}
          />
        </LoadingOverlay>
      )}
    </div>
  );
}
type Action =
  | {
      kind: 'employment' | 'payroll' | 'payment' | 'advance' | 'attendance' | 'login' | 'calendar';
      staff: HrStaff;
      item?: HrPayroll;
    }
  | { kind: 'leave' | 'cancelLeave'; leave?: Workspace['leaves'][number] }
  | { kind: 'slip' | 'approve'; item: HrPayroll }
  | { kind: 'advanceHistory'; staff: HrStaff };
function HrContent({
  adapter,
  data,
  tab,
  month,
  can,
  permissions,
  reload,
  changeMonth,
  dedicatedPunchPage,
  liveSchoolId,
}: {
  liveSchoolId?: string;
  dedicatedPunchPage: boolean;
  adapter: HrAdapter;
  data: Workspace;
  tab: string;
  month: string;
  can: (p: string) => boolean;
  permissions: readonly string[];
  reload: () => void;
  changeMonth: (month: string) => void;
}) {
  const [params, setParams] = useSearchParams();
  const [leaveStatusTab, setLeaveStatusTab] = useState<'pending' | 'approved'>('pending');
  const initialStaff = data.staff.find((p) => p.id === params.get('setupSalary'));
  const selfView = ['attendance', 'requests', 'leave', 'salary', 'profile'].includes(
    params.get('view') || '',
  )
    ? params.get('view')!
    : 'attendance';
  const [selectedStaff, setSelectedStaff] = useState('');
  const [department, setDepartment] = useState(''),
    [date, setDate] = useState(month === data.today.slice(0, 7) ? data.today : `${month}-01`),
    [action, setAction] = useState<Action | null>(
      initialStaff && can('payroll.manage') ? { kind: 'employment', staff: initialStaff } : null,
    ),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const staff = data.staff.filter(
      (p) =>
        (!department || p.department === department) && (!selectedStaff || p.id === selectedStaff),
    ),
    close = () => {
      setAction(null);
      if (params.has('setupSalary'))
        setParams(
          (previous) => {
            const next = new URLSearchParams(previous);
            next.delete('setupSalary');
            return next;
          },
          { replace: true },
        );
    },
    shared = { adapter, data, close, saved: reload };
  const punchRequest = useRef<{ kind: 'in' | 'out'; key: string } | null>(null);
  const punch = async (kind: 'in' | 'out') => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (!navigator.geolocation)
        throw new Error(
          'This device does not provide location. Ask an administrator to review attendance.',
        );
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(
          resolve,
          () => reject(new Error('Allow location access and try again at school.')),
          { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
        ),
      );
      if (punchRequest.current?.kind !== kind)
        punchRequest.current = { kind, key: crypto.randomUUID() };
      await adapter.save('/punch', {
        requestKey: punchRequest.current.key,
        kind,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        capturedAt: position.timestamp,
      });
      punchRequest.current = null;
      reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to punch.');
    } finally {
      setBusy(false);
    }
  };
  const visiblePayroll = data.payroll.filter((item) => staff.some((p) => p.id === item.staffId));
  const approved = visiblePayroll.filter((item) => item.status === 'approved');
  const paid = approved.reduce((total, item) => total + payrollPaid(item, data), 0);
  const outstanding = approved.reduce(
    (total, item) => total + item.net - payrollPaid(item, data),
    0,
  );
  return (
    <>
      {tab === 'self' && (
        <SectionNavigation
          variant="secondary"
          label="My workspace"
          items={[
            { id: 'attendance', label: 'Attendance' },
            ...(liveSchoolId && data.staff.some((p) => p.teaching)
              ? [{ id: 'requests', label: 'ARS' }]
              : []),
            { id: 'leave', label: 'Leave' },
            { id: 'salary', label: 'Salary' },
            { id: 'profile', label: 'My profile' },
          ]}
          value={selfView}
          onChange={(view) =>
            setParams((previous) => {
              const next = new URLSearchParams(previous);
              next.set('view', view);
              return next;
            })
          }
        />
      )}
      {tab === 'attendance' && (
        <div className="hr-summary">
          {[
            [
              'Present',
              staff.filter((p) =>
                data.attendance.some(
                  (d) =>
                    d.staffId === p.id &&
                    d.date === date &&
                    (d.status === 'present' || d.status === 'late'),
                ),
              ).length,
            ],
            [
              'Late',
              staff.filter((p) =>
                data.attendance.some(
                  (d) =>
                    d.staffId === p.id &&
                    d.date === date &&
                    (wasLate(d) || d.status === 'late'),
                ),
              ).length,
            ],
            [
              'Absent',
              staff.filter((p) =>
                data.attendance.some(
                  (d) => d.staffId === p.id && d.date === date && d.status === 'absent',
                ),
              ).length,
            ],
            [
              'Currently punched in',
              staff.filter((p) =>
                data.attendance.some(
                  (d) =>
                    d.staffId === p.id &&
                    d.date === date &&
                    (d.inProgress ??
                      (d.date === data.today && !!d.punchIn && !d.punchOut && !d.attendanceClosed)),
                ),
              ).length,
            ],
            [
              'Invalid / missed punch',
              staff.filter((p) =>
                data.attendance.some(
                  (d) =>
                    d.staffId === p.id &&
                    d.date === date &&
                    ['review', 'invalid'].includes(d.status),
                ),
              ).length,
            ],
            [
              'Pending leave',
              data.leaves.filter(
                (l) => l.status === 'pending' && staff.some((p) => p.id === l.staffId),
              ).length,
            ],
          ].map(([label, count]) => (
            <StatCard
              key={label}
              label={String(label)}
              value={count}
              detail="For the selected staff and period"
            />
          ))}
        </div>
      )}
      {tab === 'salary' && (
        <div className="hr-summary">
          <StatCard
            label="Staff members"
            value={staff.length}
            detail="In the selected department"
          />
          <StatCard
            label="Salary drafts"
            value={visiblePayroll.filter((p) => p.status === 'draft').length}
            detail="Awaiting review and approval"
          />
          <StatCard
            label="Paid this salary month"
            value={rupees(paid)}
            detail="Recorded payments for approved salaries"
          />
          <StatCard
            label="Outstanding"
            value={rupees(outstanding)}
            detail="Approved salaries still to be paid"
          />
        </div>
      )}
      <Panel
        className="hr-content"
        subtitle={
          tab === 'self'
            ? selfView === 'requests'
              ? 'Request corrections by selecting a half-day or invalid date in your attendance calendar.'
              : selfView === 'leave'
                ? 'Apply for leaves, track approval status, and view remaining paid leave allowance.'
                : selfView === 'salary'
                  ? 'View your monthly salary statement and payment history.'
                  : selfView === 'profile'
                    ? 'Your personal and school employment details.'
                    : 'Record your attendance and review your monthly attendance calendar.'
            : tab === 'salary'
              ? 'Set up salary → prepare a draft → review and approve → record payment.'
              : tab === 'attendance'
                ? 'Punches update attendance automatically. Review correction requests and choose any salary impact.'
                : 'Review requests and decide whether approved leave is paid or unpaid.'
        }
        title={
          tab === 'self'
            ? selfView === 'requests'
              ? 'Attendance requests (ARS)'
              : selfView === 'leave'
                ? 'Leave requests'
                : selfView === 'salary'
                  ? 'My salary'
                  : selfView === 'profile'
                    ? 'My profile'
                    : 'My attendance'
            : tab === 'attendance'
              ? 'Staff attendance'
              : tab === 'leave'
                ? 'Leave requests'
                : 'Salary Expenses'
        }
        action={
          tab === 'self' ? (
            selfView === 'requests' ? (
              <Button variant="secondary" onClick={reload}>
                Refresh requests
              </Button>
            ) : selfView === 'leave' ? (
              <Button onClick={() => setAction({ kind: 'leave' })}>
                Request leave
              </Button>
            ) : undefined
          ) : (
            <div className="hr-header-filters">
              <label className="field hr-inline-filter">
                <span>Department</span>
                <select value={department} onChange={(e) => setDepartment(e.target.value)}>
                  <option value="">All departments</option>
                  {[...new Set(data.staff.map((p) => p.department).filter(Boolean))].map((d) => (
                    <option key={d} value={d}>
                      {titleCase(d)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field hr-inline-filter">
                <span>Staff member</span>
                <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)}>
                  <option value="">All staff</option>
                  {data.staff
                    .filter((p) => !department || p.department === department)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
              {tab === 'leave' && (
                <label className="field hr-inline-filter">
                  <span>Month</span>
                  <PickerInput
                    type="month"
                    required
                    aria-label="Leave month"
                    value={month}
                    onChange={(e) => {
                      if (e.target.value) changeMonth(e.target.value);
                    }}
                  />
                </label>
              )}
              {tab === 'attendance' && (
                <label className="field hr-inline-filter">
                  <span>Attendance date</span>
                  <CalendarDateInput
                    value={date}
                    min={`${month}-01`}
                    max={data.today}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
              )}
            </div>
          )
        }
      >
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {tab === 'self' && selfView === 'attendance' && (
          <>
            {data.punchState?.code === 'HR_ON_LEAVE' ||
            data.leaves.some(
              (l) =>
                l.status === 'approved' &&
                (l.approvedDates
                  ? l.approvedDates.includes(data.today)
                  : l.start <= data.today && l.end >= data.today),
            ) ? (
              <p className="panel-note" role="status">
                You are on approved leave today. Punch in and punch out are disabled while on
                approved leave.
              </p>
            ) : (
              <>
                <p>
                  Location is checked only when you punch. Missing or inaccurate location? Ask your
                  administrator to correct attendance.
                </p>
                {data.punchState?.reason && (
                  <p className="panel-note" role="status">
                    {data.punchState.reason}
                  </p>
                )}
                {dedicatedPunchPage && (
                  <p className="panel-note">
                    <Link to="/staff/punch">Open Punch in & out</Link> to record your school day.
                  </p>
                )}
                <div className="toolbar">
                  {!dedicatedPunchPage && (
                    <>
                      <Button
                        disabled={
                          busy ||
                          (data.punchState &&
                            (!data.punchState.allowed || data.punchState.nextKind !== 'in'))
                        }
                        onClick={() => void punch('in')}
                      >
                        Punch in
                      </Button>
                      <Button
                        disabled={
                          busy ||
                          (data.punchState &&
                            (!data.punchState.allowed || data.punchState.nextKind !== 'out'))
                        }
                        onClick={() => void punch('out')}
                      >
                        Punch out
                      </Button>
                    </>
                  )}
                  <Button variant="secondary" onClick={() => setAction({ kind: 'leave' })}>
                    Request leave
                  </Button>
                </div>
              </>
            )}
          </>
        )}
        {tab === 'self' && selfView === 'attendance' && (
          <AttendanceCalendar
            data={data}
            month={month}
            ars={
              liveSchoolId && data.staff.some((p) => p.teaching)
                ? { adapter, saved: reload }
                : undefined
            }
          />
        )}
        {tab === 'self' && selfView === 'profile' && (
          <section className="hr-personal-salary">
            <h3>My profile</h3>
            {data.staff.map((p) => (
              <dl className="hr-breakdown" key={p.id}>
                {[
                  ['Name', p.name],
                  ['Department', p.department],
                  ['Designation', p.designation],
                  ['Email', p.email],
                  ['Phone', p.phone],
                  ['Joined on', formatCalendarDate(p.joinedOn)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value || '—'}</dd>
                  </div>
                ))}
              </dl>
            ))}
          </section>
        )}
        {tab === 'self' && selfView === 'salary' && (
          <>
            <div className="hr-personal-salary">
              <h3>My salary</h3>
              {data.payroll.length ? (
                data.payroll.map((item) => (
                  <div key={item.id} className="hr-personal-salary-card">
                    <Badge>{payrollStatus(item, data)}</Badge>
                    <dl className="hr-breakdown">
                      <div>
                        <dt>Net salary</dt>
                        <dd>{rupees(item.net)}</dd>
                      </div>
                      <div>
                        <dt>Paid</dt>
                        <dd>{rupees(payrollPaid(item, data))}</dd>
                      </div>
                      <div>
                        <dt>Outstanding</dt>
                        <dd>{rupees(item.net - payrollPaid(item, data))}</dd>
                      </div>
                      <div>
                        <dt>Due date</dt>
                        <dd>{formatCalendarDate(item.dueDate)}</dd>
                      </div>
                    </dl>
                    <Button variant="secondary" onClick={() => setAction({ kind: 'slip', item })}>
                      Statement
                    </Button>
                  </div>
                ))
              ) : (
                <p>Your salary has not been prepared for this month.</p>
              )}
            </div>
          </>
        )}
        {tab === 'salary' ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Staff member</th>
                  <th>Department</th>
                  <th className="currency-cell">Net salary</th>
                  <th className="currency-cell">Paid / outstanding</th>
                  <th>Status / due date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((p) => {
                  const item = data.payroll.find((v) => v.staffId === p.id);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="hr-person">
                          <Avatar name={p.name} />
                          <div>
                            <strong>{titleCase(p.name)}</strong>
                            <small>
                              {[p.code, titleCase(p.designation || '')].filter(Boolean).join(' · ')}
                            </small>
                          </div>
                        </div>
                        {data.advanceBalances?.find((a) => a.staffId === p.id) && (
                          <small>
                            Advance balance:{' '}
                            {rupees(data.advanceBalances.find((a) => a.staffId === p.id)!.balance)}
                          </small>
                        )}
                      </td>
                      <td>{titleCase(p.department || '') || '—'}</td>
                      <td className="currency-cell">{item ? rupees(item.net) : 'Not prepared'}</td>
                      <td className="currency-cell">
                        {item
                          ? `${rupees(payrollPaid(item, data))} / ${rupees(item.net - payrollPaid(item, data))}`
                          : '—'}
                      </td>
                      <td>
                        {item ? (
                          <>
                            <Badge
                              tone={payrollStatus(item, data) === 'Paid' ? 'green' : 'neutral'}
                            >
                              {payrollStatus(item, data)}
                            </Badge>
                            <small>
                              {formatCalendarDate(item.dueDate)}
                              {item.status === 'approved' &&
                              item.dueDate < data.today &&
                              payrollPaid(item, data) < item.net
                                ? ' · Overdue'
                                : ''}
                            </small>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <div className="hr-actions">
                          {!p.userId &&
                            can('staff.manage') &&
                            can('memberships.manage') &&
                            can('roles.view') && (
                              <Button
                                variant="ghost"
                                onClick={() => setAction({ kind: 'login', staff: p })}
                              >
                                Enable login
                              </Button>
                            )}
                          {can('payroll.manage') && (
                            <>
                              <Button
                                variant="ghost"
                                onClick={() => setAction({ kind: 'employment', staff: p })}
                              >
                                Salary setup
                              </Button>
                              {(!item || item.status === 'draft') && (
                                <Button
                                  variant="ghost"
                                  onClick={() => setAction({ kind: 'payroll', staff: p, item })}
                                >
                                  {item ? 'Recalculate draft' : 'Prepare salary'}
                                </Button>
                              )}
                            </>
                          )}
                          {item?.status === 'draft' && can('payroll.approve') && (
                            <Button
                              variant="ghost"
                              onClick={() => setAction({ kind: 'approve', item })}
                            >
                              Review & approve
                            </Button>
                          )}
                          {item?.status === 'approved' &&
                            payrollPaid(item, data) < item.net &&
                            can('payroll.pay') && (
                              <Button
                                variant="ghost"
                                onClick={() => setAction({ kind: 'payment', staff: p, item })}
                              >
                                Record payment
                              </Button>
                            )}
                          {can('payroll.pay') && (
                            <details className="hr-more-actions">
                              <summary>More actions</summary>
                              <Button
                                variant="ghost"
                                onClick={() => setAction({ kind: 'advance', staff: p })}
                              >
                                Record advance
                              </Button>
                            </details>
                          )}
                          {data.advances.some((a) => a.staffId === p.id) && (
                            <Button
                              variant="ghost"
                              onClick={() => setAction({ kind: 'advanceHistory', staff: p })}
                            >
                              Advance history
                            </Button>
                          )}
                          {item && (
                            <Button
                              variant="ghost"
                              onClick={() => setAction({ kind: 'slip', item })}
                            >
                              Statement
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        {tab === 'attendance' && (
          <StaffAttendancePanel
            data={data}
            staff={staff}
            date={date}
            adapter={adapter}
            saved={reload}
            live={Boolean(liveSchoolId)}
            canViewProfile={can('staff.view')}
            correct={(staff) => setAction({ kind: 'attendance', staff })}
            calendar={(staff) => setAction({ kind: 'calendar', staff })}
          />
        )}
        {tab === 'self' && selfView === 'requests' && liveSchoolId && (
          <AttendanceRequests
            requests={data.attendanceRequests ?? []}
            self
            adapter={adapter}
            saved={reload}
            today={data.today}
          />
        )}
        {(tab === 'leave' || (tab === 'self' && selfView === 'leave')) && (() => {
          const userLeaves = [...data.leaves]
            .sort(
              (a, b) =>
                Number(b.status === 'pending') - Number(a.status === 'pending') ||
                a.start.localeCompare(b.start),
            )
            .filter((l) => staff.some((p) => p.id === l.staffId));
          const pendingLeaves = userLeaves.filter((l) => l.status === 'pending');
          const approvedLeaves = userLeaves.filter((l) => l.status !== 'pending');
          const displayedLeaves = leaveStatusTab === 'pending' ? pendingLeaves : approvedLeaves;

          return (
            <div className="attendance-requests" style={{ padding: 0 }}>
              {tab === 'self' && (
                <div className="hr-leave-balance-card" style={{ margin: '0 0 16px' }}>
                  <div className="hr-leave-stat-pill">
                    <span className="hr-leave-stat-num">
                      {Math.max(
                        0,
                        data.settings.paidLeaveDays -
                          (data.leaveUsage?.find((l) => staff.some((p) => p.id === l.staffId))?.used ?? 0),
                      )}
                    </span>
                    <span className="hr-leave-stat-label">Paid days remaining</span>
                  </div>
                  <div className="hr-leave-info-text">
                    <strong>Annual Paid Leave Allowance: {data.settings.paidLeaveDays} days ({month.slice(0, 4)})</strong>
                    <p>Pending requests from every month are shown. Decided requests follow the selected month.</p>
                  </div>
                </div>
              )}
              <div
                className="hr-leave-subnav-row"
                style={{ padding: '0 22px', borderBottom: '1px solid var(--border-subtle, #e5e7eb)' }}
              >
                <SectionNavigation
                  variant="secondary"
                  label="Leave status"
                  items={[
                    { id: 'pending', label: 'Pending', badge: pendingLeaves.length },
                    { id: 'approved', label: 'Approved', badge: approvedLeaves.length },
                  ]}
                  value={leaveStatusTab}
                  onChange={(val) => setLeaveStatusTab(val as 'pending' | 'approved')}
                />
              </div>
              {displayedLeaves.length === 0 ? (
                <div className="hr-empty-box">
                  <CalendarDays size={36} className="hr-empty-icon" />
                  <p className="hr-empty-title">
                    {leaveStatusTab === 'pending'
                      ? 'No pending leave requests'
                      : 'No approved leave requests for this month'}
                  </p>
                  <span className="hr-empty-desc">
                    {leaveStatusTab === 'pending'
                      ? (tab === 'self'
                          ? 'You haven\'t submitted any pending leave requests. Click "Request leave" above to apply for time off.'
                          : 'No pending staff leave requests requiring review.')
                      : 'Approved and decided leave requests will appear here.'}
                  </span>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {tab !== 'self' && <th>Staff</th>}
                        <th>Dates</th>
                        <th>Reason</th>
                        <th>Status</th>
                        <th>Decision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedLeaves.map((l) => {
                        const staffMember = data.staff.find((p) => p.id === l.staffId);
                        const remaining = Math.max(
                          0,
                          data.settings.paidLeaveDays -
                            (data.leaveUsage?.find((u) => u.staffId === l.staffId)?.used ?? 0),
                        );
                        return (
                          <tr key={l.id}>
                            {tab !== 'self' && (
                              <td>
                                <div style={{ fontWeight: 600 }}>{staffMember?.name ?? 'Unknown staff'}</div>
                                <small style={{ color: '#047857', display: 'block', marginTop: '2px', fontSize: '11.5px', fontWeight: 500 }}>
                                  {remaining} paid days remaining
                                </small>
                              </td>
                            )}
                            <td>
                              <strong>{formatCalendarDate(l.start)}</strong>
                              {l.start !== l.end && <> to <strong>{formatCalendarDate(l.end)}</strong></>}
                            </td>
                            <td>{l.reason}</td>
                            <td>
                              <Badge
                                tone={
                                  l.status === 'approved'
                                    ? 'green'
                                    : l.status === 'rejected'
                                      ? 'red'
                                      : 'amber'
                                }
                              >
                                {titleCase(l.status)}{' '}
                                {l.status === 'approved' ? (l.paid ? '· Paid' : '· Unpaid') : ''}
                              </Badge>
                            </td>
                            <td>
                              {l.status === 'pending' && tab !== 'self' && can('attendance.manage') ? (
                                <Button onClick={() => setAction({ kind: 'leave', leave: l })}>
                                  Review
                                </Button>
                              ) : (
                                <>
                                  {l.reviewNote || '—'}
                                  {tab === 'self' &&
                                    (l.status === 'pending' || l.status === 'approved') &&
                                    l.end >= data.today && (
                                      <Button
                                        variant="ghost"
                                        onClick={() => setAction({ kind: 'cancelLeave', leave: l })}
                                      >
                                        {l.status === 'approved' ? 'Cancel leave' : 'Cancel request'}
                                      </Button>
                                    )}
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}
        {!staff.length && (
          <p>
            No staff found. Add staff individually or use the existing Excel import in Staff & HR.
          </p>
        )}
      </Panel>
      {action?.kind === 'calendar' && (
        <Modal
          open
          wide
          description="Monthly attendance and selected-day punch details."
          title={`${action.staff.name} · Attendance`}
          onClose={close}
        >
          <AttendanceCalendar
            month={month}
            label={action.staff.name}
            data={{
              ...data,
              attendance: data.attendance.filter((d) => d.staffId === action.staff.id),
              leaves: data.leaves.filter((l) => l.staffId === action.staff.id),
            }}
          />
        </Modal>
      )}
      {action?.kind === 'cancelLeave' && action.leave && (
        <CancelLeaveDialog leave={action.leave} adapter={adapter} close={close} saved={reload} />
      )}
      {action?.kind === 'login' && (
        <StaffLoginDialog
          schoolId={action.staff.schoolId}
          staff={action.staff}
          permissions={permissions}
          close={close}
          saved={reload}
        />
      )}
      {action?.kind === 'employment' && (
        <EmploymentDialog
          canLink={can('memberships.view') && can('memberships.manage')}
          {...shared}
          staff={action.staff}
          employment={data.employment.find((e) => e.staffId === action.staff.id)}
          month={month}
        />
      )}
      {action?.kind === 'payroll' && (
        <PayrollDialog {...shared} staff={action.staff} item={action.item} month={month} />
      )}
      {(action?.kind === 'payment' || action?.kind === 'advance') && (
        <PaymentDialog {...shared} staff={action.staff} item={action.item} />
      )}
      {action?.kind === 'attendance' &&
        (liveSchoolId ? (
          <AttendanceTimeDialog {...shared} staff={action.staff} date={date} />
        ) : (
          <AttendanceDialog {...shared} staff={action.staff} date={date} />
        ))}
      {action?.kind === 'leave' && (
        <LeaveDialog
          {...shared}
          leave={action.leave}
          saved={(start) => {
            if (start) changeMonth(start.slice(0, 7));
            if (tab === 'self')
              setParams((previous) => {
                const next = new URLSearchParams(previous);
                next.set('view', 'leave');
                return next;
              });
            reload();
          }}
        />
      )}
      {action?.kind === 'advanceHistory' && (
        <Modal
          open
          title={`Advances · ${action.staff.name}`}
          description="Approved payroll reserves its advance recovery, even while salary payment is outstanding."
          onClose={close}
        >
          <p>
            Outstanding:{' '}
            {rupees(data.advanceBalances?.find((a) => a.staffId === action.staff.id)?.balance ?? 0)}
          </p>
          {data.advances
            .filter((a) => a.staffId === action.staff.id)
            .map((a) => (
              <p key={a.id}>
                {formatCalendarDate(a.date)} · {rupees(a.amount)} · {a.method} ·{' '}
                {a.reference || 'No reference'}
              </p>
            ))}
        </Modal>
      )}
      {action?.kind === 'slip' && <Payslip item={action.item} data={data} close={close} />}
      {action?.kind === 'approve' && (
        <HrForm
          title="Approve payroll?"
          description="This freezes the salary calculation. Payment is recorded separately. Changes afterwards require an adjustment in a later period."
          close={close}
          submit={async () => {
            await adapter.save(`/payroll/${action.item.id}/approve`, {
              revision: action.item.revision,
            });
            reload();
          }}
        >
          <p>
            {action.item.name} · {month} · Net {rupees(action.item.net)}
          </p>
          <p>
            Gross {rupees(action.item.gross)} − attendance {rupees(action.item.leaveDeduction)} −
            regular deduction {rupees(action.item.manualDeduction)} + adjustment{' '}
            {rupees(action.item.adjustment)} − advance recovery{' '}
            {rupees(action.item.advanceRecovery)}
          </p>
          <ul>
            {action.item.unresolved.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
          <p>
            Approval is available after the month ends and every attendance issue has been reviewed.
          </p>
        </HrForm>
      )}
    </>
  );
}
