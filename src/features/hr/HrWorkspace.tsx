import CancelLeaveDialog from './CancelLeaveDialog';
import AttendanceTimeDialog from './AttendanceTimeDialog';
import AttendanceRequests from './AttendanceRequests';
import StaffAttendancePanel from './StaffAttendancePanel';
import StaffLoginDialog from './StaffLoginDialog';
import AttendanceCalendar from './AttendanceCalendar';
import { FloatingStickyTableHeader } from '../../components/shared/FloatingStickyTableHeader';
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
  AppIcon,
} from '../../components/ui/Primitives';
import CalendarDateInput from '../../components/ui/CalendarDateInput';
import { Calendar, CalendarDays, AlertCircle, ChevronLeft, ChevronRight, MoreHorizontal, Wallet, FileText } from 'lucide-react';
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
import SalaryAdvanceOverviewModal from './SalaryAdvanceOverviewModal';
import { AttendanceDialog, LeaveDialog, PaymentDialog, PayrollDialog, Payslip } from './HrActions';
import { PaySalaryDialog, BulkPaySalaryDialog, getStaffAttendanceSummary, AttendanceIssuesSection } from './PaySalaryDialog';
import { HrForm } from './HrForms';
import { formatCalendarDate, titleCase } from '../../lib/displayFormat';
import './hr.css';

function formatDueDate(isoDate?: string | null): string {
  if (!isoDate) return '—';
  const parts = isoDate.split('-');
  if (parts.length < 3) return isoDate;
  const [year, m, d] = parts;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = Number(m) - 1;
  const monthName = monthNames[monthIdx] || m;
  return `${d.padStart(2, '0')} ${monthName} ${year}`;
}

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
  const { schoolId, access, status, profile } = useLiveSchool();

  const schoolWorkingDays = useMemo(() => {
    const daysList = profile?.school?.hours?.days;
    if (!daysList || !Array.isArray(daysList) || daysList.length === 0) return undefined;
    const DAY_MAP: Record<string, number> = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };
    const mapped = daysList
      .map((d: string) => DAY_MAP[d])
      .filter((n): n is number => n !== undefined)
      .sort((a, b) => a - b);
    return mapped.length > 0 ? mapped : undefined;
  }, [profile?.school?.hours?.days]);
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
      schoolWorkingDays={schoolWorkingDays}
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
  schoolWorkingDays,
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
  schoolWorkingDays?: number[];
}) {
  const today = useToday(),
    [internalMonth, setInternalMonth] = useState(today.slice(0, 7)),
    month = controlledMonth ?? internalMonth,
    setMonth = useCallback(
      (m: string) => {
        setInternalMonth(m);
        onMonthChange?.(m);
      },
      [onMonthChange, setInternalMonth],
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
        : tab === 'leave'
          ? can('attendance.manage') ||
            can('leave.approve') ||
            can('leave.reject') ||
            can('attendance.view')
          : can('attendance.manage') || can('attendance.view');
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
    ...(can('attendance.manage') ||
    can('attendance.view') ||
    can('leave.approve') ||
    can('leave.reject')
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
          {!hideMonthCorner && tab !== 'leave' && tab !== 'salary' && !self && (
            <div className="hr-month-controls" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                className="button secondary"
                title="Previous month"
                aria-label="Previous month"
                style={{ padding: '6px 8px', height: '36px', minWidth: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => {
                  const d = new Date(`${month}-01T12:00:00Z`);
                  d.setUTCMonth(d.getUTCMonth() - 1);
                  setMonth(d.toISOString().slice(0, 7));
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <label className="hr-month-corner" style={{ margin: 0 }}>
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
              <button
                type="button"
                className="button secondary"
                title="Next month"
                aria-label="Next month"
                style={{ padding: '6px 8px', height: '36px', minWidth: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => {
                  const d = new Date(`${month}-01T12:00:00Z`);
                  d.setUTCMonth(d.getUTCMonth() + 1);
                  setMonth(d.toISOString().slice(0, 7));
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
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
              settings: {
                ...activeWorkspace.settings,
                workingDays: schoolWorkingDays ?? activeWorkspace.settings.workingDays,
              },
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
            hideNavigation={hideNavigation}
          />
        </LoadingOverlay>
      )}
    </div>
  );
}
type Action =
  | {
      kind: 'employment' | 'payroll' | 'payment' | 'advance' | 'attendance' | 'login' | 'calendar' | 'paySalary';
      staff: HrStaff;
      item?: HrPayroll;
    }
  | { kind: 'bulkPay' }
  | { kind: 'leave' | 'cancelLeave'; leave?: Workspace['leaves'][number] }
  | { kind: 'slip' | 'approve'; item: HrPayroll; staff?: HrStaff }
  | { kind: 'advanceHistory' | 'advanceOverview'; staff: HrStaff };

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
  hideNavigation = false,
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
  hideNavigation?: boolean;
}) {
  void dedicatedPunchPage;
  const [openMenuStaffId, setOpenMenuStaffId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const salaryExpensesTableWrapRef = useRef<HTMLDivElement>(null);
  const salaryExpensesTheadRef = useRef<HTMLTableSectionElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuStaffId(null);
      }
    }
    if (openMenuStaffId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openMenuStaffId]);
  const [params, setParams] = useSearchParams();
  const [leaveStatusTab, setLeaveStatusTab] = useState<'pending' | 'approved'>('pending');
  const [salaryStatusFilter, setSalaryStatusFilter] = useState<'all' | 'paid' | 'pending' | 'overdue' | 'setup_pending'>('all');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState('all');
  const initialStaff = data.staff.find((p) => p.id === params.get('setupSalary'));
  const selfView = ['attendance', 'requests', 'leave', 'salary', 'profile'].includes(
    params.get('view') || '',
  )
    ? params.get('view')!
    : 'salary';
  const [selectedStaff, setSelectedStaff] = useState(params.get('staff') || '');
  const requestedDate = params.get('date') || '';
  const initialDate =
    /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) &&
    requestedDate.startsWith(month) &&
    requestedDate <= data.today
      ? requestedDate
      : month === data.today.slice(0, 7)
        ? data.today
        : `${month}-01`;
  const [department, setDepartment] = useState(''),
    [date, setDate] = useState(initialDate),
    [action, setAction] = useState<Action | null>(
      initialStaff && can('payroll.manage') ? { kind: 'employment', staff: initialStaff } : null,
    ),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);

  const [priorMonthDue, setPriorMonthDue] = useState<{
    month: string;
    label: string;
    dueDate: string;
    unpreparedCount: number;
    draftCount: number;
    outstandingAmount: number;
  } | null>(null);

  useEffect(() => {
    if (tab !== 'salary') {
      setPriorMonthDue(null);
      return;
    }
    const currentCalMonth = data.today.slice(0, 7);
    if (month >= currentCalMonth) {
      const prevD = new Date(`${currentCalMonth}-01T12:00:00Z`);
      prevD.setUTCMonth(prevD.getUTCMonth() - 1);
      const prevMonthStr = prevD.toISOString().slice(0, 7);

      const abortCtrl = new AbortController();
      adapter
        .load(prevMonthStr, false, abortCtrl.signal)
        .then((prevData) => {
          if (abortCtrl.signal.aborted) return;
          const targetStaff = prevData.staff.filter(
            (p) => (!department || p.department === department) && (!selectedStaff || p.id === selectedStaff),
          );
          const isEligibleInMonth = (s: typeof prevData.staff[number]) => {
            if (s.joinedOn && s.joinedOn > `${prevMonthStr}-31`) return false;
            const emp = prevData.employment?.find((e) => e.staffId === s.id);
            if (emp?.endedOn && emp.endedOn < `${prevMonthStr}-01`) return false;
            const salary = emp?.salaries?.slice().reverse().find((sal) => sal.effectiveMonth <= prevMonthStr);
            return Boolean(salary && salary.basic > 0);
          };
          const eligibleStaff = targetStaff.filter(isEligibleInMonth);
          const unprepared = eligibleStaff.filter((s) => !prevData.payroll.some((p) => p.staffId === s.id));
          const drafts = prevData.payroll.filter(
            (p) => p.status === 'draft' && targetStaff.some((s) => s.id === p.staffId),
          );
          const approvedPayrolls = prevData.payroll.filter(
            (p) => p.status === 'approved' && targetStaff.some((s) => s.id === p.staffId),
          );
          const outstanding = approvedPayrolls.reduce(
            (sum, p) => sum + Math.max(0, p.net - payrollPaid(p, prevData)),
            0,
          );

          if (unprepared.length > 0 || drafts.length > 0 || outstanding > 0) {
            const day = prevData.settings.paymentDay || 5;
            const due = `${currentCalMonth}-${String(day).padStart(2, '0')}`;
            const monthLabel = prevD.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
            setPriorMonthDue({
              month: prevMonthStr,
              label: monthLabel,
              dueDate: due,
              unpreparedCount: unprepared.length,
              draftCount: drafts.length,
              outstandingAmount: outstanding,
            });
          } else {
            setPriorMonthDue(null);
          }
        })
        .catch(() => {});
      return () => abortCtrl.abort();
    } else {
      setPriorMonthDue(null);
    }
  }, [tab, month, data.today, adapter, department, selectedStaff]);
  const staff = data.staff.filter(
      (p) =>
        (!department || p.department === department) && (tab === 'salary' || tab === 'attendance' || !selectedStaff || p.id === selectedStaff),
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  void punch;
    const staffSalaryData = useMemo(() => {
    return staff.map((p) => {
      const item = data.payroll.find((v) => v.staffId === p.id);
      const emp = data.employment.find((e) => e.staffId === p.id);
      const salaryConfig = emp?.salaries.filter((sal) => sal.effectiveMonth <= month).at(-1);
      const configuredGross =
        (salaryConfig?.basic ?? 0) + (salaryConfig?.allowance ?? 0) + (salaryConfig?.bonus ?? 0);
      const configuredDeduction = salaryConfig?.deduction ?? 0;
      const configuredNet = Math.max(0, configuredGross - configuredDeduction);

      const netSalary = item ? item.net : configuredNet;
      const paidAmount = item ? payrollPaid(item, data) : 0;
      const pendingAmount = Math.max(0, netSalary - paidAmount);

      return {
        staff: p,
        item,
        salaryConfig,
        configuredGross,
        configuredDeduction,
        netSalary,
        paidAmount,
        pendingAmount,
      };
    });
  }, [staff, data.payroll, data.employment, data.payments, month]);

  const totalMonthlySalary = useMemo(
    () => staffSalaryData.reduce((s, row) => s + row.netSalary, 0),
    [staffSalaryData],
  );
  const totalPaidThisMonth = useMemo(
    () => staffSalaryData.reduce((s, row) => s + row.paidAmount, 0),
    [staffSalaryData],
  );
  const totalPendingThisMonth = useMemo(
    () => staffSalaryData.reduce((s, row) => s + row.pendingAmount, 0),
    [staffSalaryData],
  );
  const pendingStaffList = useMemo(
    () => staffSalaryData.filter((r) => r.pendingAmount > 0),
    [staffSalaryData],
  );

  const getSalaryCategory = useCallback((row: typeof staffSalaryData[0]): 'setup_pending' | 'paid' | 'overdue' | 'pending' => {
    if (row.netSalary === 0) return 'setup_pending';
    if (row.pendingAmount === 0 && row.paidAmount > 0) return 'paid';
    const dueDate = row.item?.dueDate || `${month}-05`;
    if (row.pendingAmount > 0 && dueDate < data.today) return 'overdue';
    return 'pending';
  }, [data.today, month]);

  const salaryStatusCounts = useMemo(() => {
    const counts = {
      all: staffSalaryData.length,
      paid: 0,
      pending: 0,
      overdue: 0,
      setup_pending: 0,
    };
    for (const row of staffSalaryData) {
      const cat = getSalaryCategory(row);
      counts[cat]++;
    }
    return counts;
  }, [staffSalaryData, getSalaryCategory]);

  const visibleSalaryRows = useMemo(() => {
    if (salaryStatusFilter === 'all') return staffSalaryData;
    return staffSalaryData.filter((row) => getSalaryCategory(row) === salaryStatusFilter);
  }, [staffSalaryData, salaryStatusFilter, getSalaryCategory]);
  return (
    <>
      {tab === 'self' && !hideNavigation && (
        <SectionNavigation
          variant="secondary"
          label="Salary & Leaves"
          items={[
            { id: 'salary', label: 'Salary' },
            { id: 'leave', label: 'Leave' },
            { id: 'profile', label: 'My profile' },
          ]}
          value={selfView === 'attendance' || selfView === 'requests' ? 'salary' : selfView}
          onChange={(view) =>
            setParams((previous) => {
              const next = new URLSearchParams(previous);
              next.set('view', view);
              return next;
            })
          }
        />
      )}
      {tab === 'salary' && priorMonthDue && (
        <div
          className="hr-pending-alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            background: '#fffbeb',
            border: '1px solid #fcd34d',
            borderRadius: '10px',
            padding: '14px 18px',
            marginBottom: '16px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertCircle size={24} style={{ color: '#d97706', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: '#92400e' }}>
                Pending Previous Month Salary: {priorMonthDue.label}
              </div>
              <div style={{ fontSize: '13px', color: '#b45309', marginTop: '2px' }}>
                Payment was due on {formatCalendarDate(priorMonthDue.dueDate)}.
                {priorMonthDue.unpreparedCount > 0 &&
                  ` ${priorMonthDue.unpreparedCount} staff salaries not prepared yet.`}
                {priorMonthDue.draftCount > 0 &&
                  ` ${priorMonthDue.draftCount} drafts awaiting approval.`}
                {priorMonthDue.outstandingAmount > 0 &&
                  ` Unpaid balance: ${rupees(priorMonthDue.outstandingAmount)}.`}
              </div>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={() => changeMonth(priorMonthDue.month)}
            style={{
              borderColor: '#d97706',
              color: '#92400e',
              background: '#ffffff',
              fontWeight: 600,
            }}
          >
            Open {priorMonthDue.label} Payroll →
          </Button>
        </div>
      )}
      {tab === 'salary' && (
        <div className="hr-summary">
          <StatCard
            label="Staff members"
            value={staff.length}
            detail="In the selected department"
            icon={<AppIcon name="staff" size={48} />}
          />
          <StatCard
            label="Total monthly salary"
            value={rupees(totalMonthlySalary)}
            detail="Net salary commitment for this month"
            icon={<AppIcon name="document" size={48} />}
          />
          <StatCard
            label="Paid this month"
            value={rupees(totalPaidThisMonth)}
            detail="Recorded payments for this salary month"
            icon={<AppIcon name="wallet" size={48} />}
            tone="green"
          />
          <StatCard
            label="Pending to pay"
            value={rupees(totalPendingThisMonth)}
            detail={
              totalPendingThisMonth > 0
                ? `${pendingStaffList.length} staff awaiting payment`
                : 'All salaries paid!'
            }
            icon={<AppIcon name="finance-balance" size={48} />}
            tone={totalPendingThisMonth > 0 ? 'amber' : 'green'}
          />
        </div>
      )}
      <Panel
        className="hr-content"
        subtitle={
          tab === 'self'
            ? selfView === 'requests'
              ? 'Request corrections by selecting an absent, half-day or invalid date in your attendance calendar.'
              : selfView === 'leave'
                ? 'Apply for leaves, track approval status, and view remaining paid leave allowance.'
                : selfView === 'salary'
                  ? 'View your monthly salary statement and payment history.'
                  : selfView === 'profile'
                    ? 'Your personal and school employment details.'
                    : 'Record your attendance and review your monthly attendance calendar.'
            : tab === 'salary' ? 'Review monthly salary breakdown and payments.'
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
            selfView === 'attendance' ? (
              <Button
                style={{
                  background: '#15803d',
                  color: '#ffffff',
                  borderColor: '#15803d',
                  fontWeight: 600,
                  borderRadius: '6px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                }}
                onClick={() => setAction({ kind: 'leave' })}
              >
                Request leave
              </Button>
            ) : selfView === 'requests' ? (
              <Button variant="secondary" onClick={reload}>
                Refresh requests
              </Button>
            ) : selfView === 'leave' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  className="hr-leave-balance-compact-badge"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    color: '#166534',
                    fontSize: '13px',
                    fontWeight: 500,
                  }}
                  title={`Annual Paid Leave Allowance: ${data.settings.paidLeaveDays} days (${month.slice(0, 4)})`}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#15803d',
                      color: '#ffffff',
                      borderRadius: '9999px',
                      padding: '2px 8px',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    {Math.max(
                      0,
                      data.settings.paidLeaveDays -
                        (data.leaveUsage?.find((l) => staff.some((p) => p.id === l.staffId))
                          ?.used ?? 0),
                    )}
                  </span>
                  <span>Paid days remaining</span>
                </div>
                <Button
                  style={{
                    background: '#15803d',
                    color: '#ffffff',
                    borderColor: '#15803d',
                    fontWeight: 600,
                    borderRadius: '6px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                  }}
                  onClick={() => setAction({ kind: 'leave' })}
                >
                  Request leave
                </Button>
              </div>
            ) : undefined
          ) : (
            <div className="hr-header-filters">
              {tab === 'salary' && (
                <label className="field hr-inline-filter hr-month-filter">
                  <span>Month</span>
                  <div className="hr-month-controls">
                    <button
                      type="button"
                      className="button secondary hr-month-nav-btn"
                      title="Previous month"
                      aria-label="Previous month"
                      onClick={() => {
                        const d = new Date(`${month}-01T12:00:00Z`);
                        d.setUTCMonth(d.getUTCMonth() - 1);
                        changeMonth(d.toISOString().slice(0, 7));
                      }}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <label className="hr-month-corner">
                      <PickerInput
                        type="month"
                        required
                        aria-label="Salary month"
                        value={month}
                        onChange={(e) => {
                          if (e.target.value) changeMonth(e.target.value);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="button secondary hr-month-nav-btn"
                      title="Next month"
                      aria-label="Next month"
                      onClick={() => {
                        const d = new Date(`${month}-01T12:00:00Z`);
                        d.setUTCMonth(d.getUTCMonth() + 1);
                        changeMonth(d.toISOString().slice(0, 7));
                      }}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </label>
              )}
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
              {tab === 'attendance' ? (
                <label className="field hr-inline-filter">
                  <span>Status</span>
                  <select
                    value={attendanceStatusFilter}
                    onChange={(e) => setAttendanceStatusFilter(e.target.value)}
                  >
                    <option value="all">All status</option>
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="late">Late</option>
                    <option value="half-day">Half day</option>
                    <option value="leave">On leave</option>
                    <option value="off">Weekly off</option>
                    <option value="holiday">Holiday</option>
                    <option value="unmarked">Not marked</option>
                  </select>
                </label>
              ) : tab === 'salary' ? (
                <label className="field hr-inline-filter">
                  <span>Status</span>
                  <select
                    value={salaryStatusFilter}
                    onChange={(e) => setSalaryStatusFilter(e.target.value as any)}
                  >
                    <option value="all">All staff ({salaryStatusCounts.all})</option>
                    <option value="paid">Paid ({salaryStatusCounts.paid})</option>
                    <option value="pending">Pending ({salaryStatusCounts.pending})</option>
                    <option value="overdue">Overdue ({salaryStatusCounts.overdue})</option>
                    <option value="setup_pending">Setup pending ({salaryStatusCounts.setup_pending})</option>
                  </select>
                </label>
              ) : (
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
              )}
              {tab === 'salary' && pendingStaffList.length > 0 && can('payroll.pay') && (
                <button
                  type="button"
                  className="hr-pay-all-btn"
                  onClick={() => setAction({ kind: 'bulkPay' })}
                >
                  Pay All Pending ({pendingStaffList.length})
                </button>
              )}
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
            {(data.punchState?.code === 'HR_ON_LEAVE' ||
              data.leaves.some(
                (l) =>
                  l.status === 'approved' &&
                  (l.approvedDates
                    ? l.approvedDates.includes(data.today)
                    : l.start <= data.today && l.end >= data.today),
              )) && (
              <p className="panel-note" role="status">
                You are on approved leave today. Punch in and punch out are disabled while on
                approved leave.
              </p>
            )}
          </>
        )}
        {tab === 'self' && selfView === 'attendance' && (
          <AttendanceCalendar
            data={data}
            month={month}
            onMonthChange={changeMonth}
            ars={
              liveSchoolId && data.staff.some((p) => p.teaching)
                ? { adapter, saved: reload }
                : undefined
            }
          />
        )}
        {tab === 'self' && selfView === 'profile' && (
          <section className="hr-personal-salary">
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
          <div className="table-wrap" ref={salaryExpensesTableWrapRef}>
            <FloatingStickyTableHeader
              tableWrapRef={salaryExpensesTableWrapRef}
              theadRef={salaryExpensesTheadRef}
            >
              {(colWidths) => (
                <thead>
                  <tr>
                    <th style={{ width: colWidths[0] }}>STAFF MEMBER</th>
                    <th style={{ width: colWidths[1] }}>NET SALARY</th>
                    <th style={{ width: colWidths[2] }}>STATUS</th>
                    <th style={{ width: colWidths[3] }}>DUE DATE</th>
                    <th style={{ width: colWidths[4] }}>ACTIONS</th>
                  </tr>
                </thead>
              )}
            </FloatingStickyTableHeader>
            <table>
              <thead ref={salaryExpensesTheadRef}>
                <tr>
                  <th>STAFF MEMBER</th>
                  <th>NET SALARY</th>
                  <th>STATUS</th>
                  <th>DUE DATE</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {visibleSalaryRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b' }}>
                      No staff found matching the selected status.
                    </td>
                  </tr>
                ) : (
                  visibleSalaryRows.map((row) => {
                  const p = row.staff;
                  const item = row.item;
                  const salaryConfig = row.salaryConfig;
                  const paid = row.paidAmount;
                  const pending = row.pendingAmount;
                  const net = row.netSalary;
                  const isZeroSalary = net === 0;
                  const isPaid = !isZeroSalary && pending === 0 && paid > 0;
                  const isPartiallyPaid = paid > 0 && pending > 0;
                  const isOverdue = !isZeroSalary && Boolean((item?.dueDate || `${month}-05`) < data.today && pending > 0);
                  const attSummary = getStaffAttendanceSummary(p.id, month, data.today, data, item);

                  const statusTone = isZeroSalary
                    ? 'gray'
                    : isPaid
                    ? 'green'
                    : isPartiallyPaid
                    ? 'amber'
                    : isOverdue
                    ? 'red'
                    : 'amber';
                  const statusLabel = isZeroSalary
                    ? 'No payment due'
                    : isPaid
                    ? 'Paid'
                    : isPartiallyPaid
                    ? 'Partially paid'
                    : isOverdue
                    ? 'Overdue'
                    : 'Pending';

                  const advObj = data.advanceBalances?.find((a) => a.staffId === p.id);
                  const advanceBalance = advObj?.balance ?? 0;
                  const advanceIssued = advObj?.issued ?? 0;
                  const hasAdvance = advanceIssued > 0 || (data.advances || []).some((a) => a.staffId === p.id);
                  const rowDueDate = item?.dueDate ? formatDueDate(item.dueDate) : formatDueDate(`${month}-05`);

                  const effectiveItem: HrPayroll = item ?? {
                    id: `draft-${p.id}`,
                    schoolId: (p as any).schoolId ?? '',
                    revision: 0,
                    staffId: p.id,
                    month,
                    name: p.name,
                    code: p.code,
                    department: p.department,
                    dueDate: `${month}-05`,
                    status: 'draft',
                    basic: salaryConfig?.basic ?? 0,
                    allowance: salaryConfig?.allowance ?? 0,
                    bonus: salaryConfig?.bonus ?? 0,
                    gross: (salaryConfig?.basic ?? 0) + (salaryConfig?.allowance ?? 0) + (salaryConfig?.bonus ?? 0),
                    unpaidUnits: 0,
                    leaveDeduction: 0,
                    manualDeduction: salaryConfig?.deduction ?? 0,
                    adjustment: 0,
                    advanceRecovery: 0,
                    note: '',
                    net,
                    unresolved: [],
                  };

                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="hr-person">
                          <Avatar name={p.name} />
                          <div>
                            <strong style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{titleCase(p.name)}</strong>
                            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '1px' }}>
                              {[titleCase(p.department || ''), titleCase(p.designation || '')].filter(Boolean).join(' • ')}
                            </div>
                            {advanceBalance > 0 && (
                              <div style={{ color: '#475569', fontSize: '12px', marginTop: '2px' }}>
                                • Advance taken: {rupees(advanceIssued)} · Remaining: <strong style={{ color: '#b45309' }}>{rupees(advanceBalance)}</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>
                        {rupees(net)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background:
                                statusTone === 'red'
                                  ? '#fee2e2'
                                  : statusTone === 'green'
                                  ? '#dcfce7'
                                  : statusTone === 'gray'
                                  ? '#f1f5f9'
                                  : '#fef3c7',
                              color:
                                statusTone === 'red'
                                  ? '#b91c1c'
                                  : statusTone === 'green'
                                  ? '#15803d'
                                  : statusTone === 'gray'
                                  ? '#64748b'
                                  : '#b45309',
                            }}
                          >
                            {statusLabel}
                          </span>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            {rowDueDate}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '13px', color: '#334155' }}>
                          {rowDueDate}
                        </span>
                      </td>
                      <td>
                        <div className="hr-actions-compact">
                          {isZeroSalary ? (
                            can('payroll.manage') ? (
                              <Link
                                to="/settings?tab=Staff+%26+Payroll&section=payroll"
                                className="hr-payslip-btn"
                                style={{ textDecoration: 'none' }}
                              >
                                Setup salary
                              </Link>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '13px', padding: '0 8px' }}>—</span>
                            )
                          ) : pending > 0 && can('payroll.pay') ? (
                            <button
                              type="button"
                              className="hr-pay-btn"
                              onClick={() => setAction({ kind: 'paySalary', staff: p, item })}
                            >
                              Pay
                            </button>
                          ) : paid > 0 ? (
                            <button
                              type="button"
                              className="hr-payslip-btn"
                              onClick={() => setAction({ kind: 'slip', item: effectiveItem })}
                            >
                              Payslip
                            </button>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '13px', padding: '0 8px' }}>—</span>
                          )}

                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              type="button"
                              className="hr-more-btn"
                              title="More options"
                              aria-label="More options"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuStaffId(openMenuStaffId === p.id ? null : p.id);
                              }}
                            >
                              <MoreHorizontal size={18} />
                            </button>
                            {openMenuStaffId === p.id && (
                              <div
                                ref={menuRef}
                                className="hr-kebab-menu"
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: 'calc(100% + 4px)',
                                  background: '#ffffff',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                                  zIndex: 50,
                                  minWidth: '175px',
                                  padding: '4px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px',
                                }}
                              >
                                <button
                                  type="button"
                                  className="hr-menu-item"
                                  onClick={() => {
                                    setOpenMenuStaffId(null);
                                    setAction({ kind: 'calendar', staff: p });
                                  }}
                                >
                                  <Calendar size={14} style={{ color: '#0f766e' }} />
                                  <span>Attendance ({attSummary.present}d)</span>
                                </button>
                                {can('payroll.pay') && (
                                  <button
                                    type="button"
                                    className="hr-menu-item"
                                    onClick={() => {
                                      setOpenMenuStaffId(null);
                                      setAction({ kind: 'advance', staff: p });
                                    }}
                                  >
                                    <Wallet size={14} style={{ color: '#2563eb' }} />
                                    <span>Give advance</span>
                                  </button>
                                )}
                                {hasAdvance && (
                                  <button
                                    type="button"
                                    className="hr-menu-item"
                                    onClick={() => {
                                      setOpenMenuStaffId(null);
                                      setAction({ kind: 'advanceOverview', staff: p });
                                    }}
                                  >
                                    <Wallet size={14} style={{ color: '#2563eb' }} />
                                    <span>Salary Advance Overview</span>
                                  </button>
                                )}
                                {can('payroll.manage') && (
                                  <button
                                    type="button"
                                    className="hr-menu-item"
                                    onClick={() => {
                                      setOpenMenuStaffId(null);
                                      setAction({ kind: 'payroll', staff: p, item });
                                    }}
                                  >
                                    <FileText size={14} style={{ color: '#64748b' }} />
                                    <span>Adjustments</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                }))}
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
            canManage={can('attendance.manage')}
            correct={(staff) => setAction({ kind: 'attendance', staff })}
            calendar={(staff) => setAction({ kind: 'calendar', staff })}
            filter={attendanceStatusFilter}
            onFilterChange={setAttendanceStatusFilter}
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
        {(tab === 'leave' || (tab === 'self' && selfView === 'leave')) &&
          (() => {
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

                <div
                  className="hr-leave-subnav-row"
                  style={{
                    padding: '0 22px',
                    borderBottom: '1px solid var(--border-subtle, #e5e7eb)',
                  }}
                >
                  <SectionNavigation
                    variant="secondary"
                    label="Leave status"
                    items={[
                      { id: 'pending', label: 'Pending', badge: pendingLeaves.length },
                      { id: 'approved', label: 'Reviewed', badge: approvedLeaves.length },
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
                        : 'No reviewed leave requests for this month'}
                    </p>
                    <span className="hr-empty-desc">
                      {leaveStatusTab === 'pending'
                        ? tab === 'self'
                          ? 'You haven\'t submitted any pending leave requests. Click "Request leave" above to apply for time off.'
                          : 'No pending staff leave requests requiring review.'
                        : 'Reviewed and decided leave requests will appear here.'}
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
                                  <div style={{ fontWeight: 600 }}>
                                    {staffMember?.name ?? 'Unknown staff'}
                                  </div>
                                  <small
                                    style={{
                                      color: '#047857',
                                      display: 'block',
                                      marginTop: '2px',
                                      fontSize: '11.5px',
                                      fontWeight: 500,
                                    }}
                                  >
                                    {remaining} paid days remaining
                                  </small>
                                </td>
                              )}
                              <td>
                                <strong>{formatCalendarDate(l.start)}</strong>
                                {l.start !== l.end && (
                                  <>
                                    {' '}
                                    to <strong>{formatCalendarDate(l.end)}</strong>
                                  </>
                                )}
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
                                {l.status === 'pending' &&
                                tab !== 'self' &&
                                (can('attendance.manage') ||
                                  can('leave.approve') ||
                                  can('leave.reject')) ? (
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
                                          onClick={() =>
                                            setAction({ kind: 'cancelLeave', leave: l })
                                          }
                                        >
                                          {l.status === 'approved'
                                            ? 'Cancel leave'
                                            : 'Cancel request'}
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
          className="pay-salary-modal"
          description={`Monthly attendance and selected-day punch details for ${month}.`}
          title={`${action.staff.name} · Attendance`}
          onClose={close}
        >
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px', background: '#ffffff' }}>
            <AttendanceCalendar
              month={month}
              label={action.staff.name}
              hideMonthNavigation
              data={{
                ...data,
                attendance: data.attendance.filter((d) => d.staffId === action.staff.id),
                leaves: data.leaves.filter((l) => l.staffId === action.staff.id),
              }}
            />
          </div>
          <AttendanceIssuesSection
            summary={getStaffAttendanceSummary(
              action.staff.id,
              month,
              data.today,
              data,
              data.payroll.find((p) => p.staffId === action.staff.id),
            )}
            month={month}
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
      {action?.kind === 'paySalary' && (
        <PaySalaryDialog
          {...shared}
          staff={action.staff}
          item={action.item}
          month={month}
        />
      )}
      {action?.kind === 'bulkPay' && (
        <BulkPaySalaryDialog
          {...shared}
          month={month}
          pendingStaff={pendingStaffList.map((r) => ({
            staff: r.staff,
            item: r.item,
            pendingAmount: r.pendingAmount,
          }))}
        />
      )}
      {(action?.kind === 'payment' || action?.kind === 'advance') && (
        <PaymentDialog {...shared} staff={action.staff} item={action.item} />
      )}
      {action?.kind === 'attendance' &&
        (liveSchoolId ? (
          <AttendanceTimeDialog
            {...shared}
            staff={action.staff}
            date={date}
            saved={(selected) => {
              if (selected) {
                setDate(selected);
                if (!selected.startsWith(month)) changeMonth(selected.slice(0, 7));
                setParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.set('date', selected);
                  next.set('month', selected.slice(0, 7));
                  return next;
                });
              }
              close();
              reload();
            }}
          />
        ) : (
          <AttendanceDialog {...shared} staff={action.staff} date={date} />
        ))}
      {action?.kind === 'leave' && (
        <LeaveDialog
          {...shared}
          leave={action.leave}
          decisions={[
            ...(can('attendance.manage') || can('leave.approve') ? ['approved'] : []),
            ...(can('attendance.manage') || can('leave.reject') ? ['rejected'] : []),
          ]}
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
      {(action?.kind === 'advanceHistory' || action?.kind === 'advanceOverview') && (
        <SalaryAdvanceOverviewModal
          open
          onClose={close}
          staff={action.staff}
          data={data}
          canGiveAdvance={can('payroll.pay')}
          onGiveAdvance={() => setAction({ kind: 'advance', staff: action.staff })}
        />
      )}
      {action?.kind === 'slip' && <Payslip item={action.item} data={data} close={close} />}
      {action?.kind === 'approve' && (() => {
        const isMonthEnded = month < data.today.slice(0, 7);

        const unresolvedList = action.item.unresolved || [];
        return (
          <HrForm
            title="Review & Approve Payroll"
            description={
              isMonthEnded
                ? "This freezes the salary calculation. Payment is recorded separately. Changes afterwards require an adjustment in a later period."
                : `Payroll for ${month} can be approved early now, or you can give a Salary Advance.`
            }
            submitLabel={isMonthEnded ? "Approve payroll" : "Approve early"}
            submitDisabled={false}
            close={close}
            submit={async () => {
              const currentItem = data.payroll.find((p) => p.id === action.item.id) || action.item;
              try {
                await adapter.save(`/payroll/${currentItem.id}/approve`, {
                  revision: currentItem.revision,
                });
                reload();
              } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                const isStale =
                  message.includes('changed') ||
                  message.includes('Refresh') ||
                  message.includes('stale') ||
                  message.includes('HR_STALE');
                if (isStale) {
                  const updatedDraft: any = await adapter.save(
                    `/staff/${currentItem.staffId}/payroll`,
                    {
                      month,
                      revision: currentItem.revision,
                      adjustment: currentItem.adjustment || 0,
                      advanceRecovery: currentItem.advanceRecovery || 0,
                      note: currentItem.note || 'Synced before approval',
                    },
                  );
                  await adapter.save(`/payroll/${updatedDraft?.id || currentItem.id}/approve`, {
                    revision: updatedDraft?.revision ?? (currentItem.revision + 1),
                  });
                  reload();
                } else {
                  throw err;
                }
              }
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  background: 'var(--surface-sunken, #f8fafc)',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <strong>{action.item.name}</strong>
                  <Badge tone={isMonthEnded ? 'green' : 'amber'}>
                    {isMonthEnded ? 'Ready for approval' : 'Month in progress'}
                  </Badge>
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted, #64748b)' }}>
                  Salary Month: <strong>{month}</strong> · Net Salary: <strong style={{ color: 'var(--text-primary, #0f172a)' }}>{rupees(action.item.net)}</strong>
                </div>
                <div style={{ fontSize: '0.85rem', marginTop: '6px' }}>
                  Gross {rupees(action.item.gross)} − Attendance deduction {rupees(action.item.leaveDeduction)} − Regular deduction {rupees(action.item.manualDeduction)} + Adjustment {rupees(action.item.adjustment)} − Advance recovery {rupees(action.item.advanceRecovery)}
                </div>
              </div>

              {!isMonthEnded && (
                <div
                  style={{
                    background: 'rgba(59, 130, 246, 0.08)',
                    color: '#1d4ed8',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    lineHeight: '1.5',
                  }}
                >
                  💡 <strong>Early Salary Payment:</strong>
                  <ul style={{ margin: '6px 0 0', paddingLeft: '20px' }}>
                    <li>
                      <strong>Approve early:</strong> Mahine ke beech me full salary release karne ke liye yahan se approve karke payment record kar sakte hain.
                    </li>
                    <li>
                      <strong>Salary Advance:</strong> Staff ko zaroorat ke hisab se advance (peshgi) dene ke liye <em>"Give advance"</em> click karein. Yeh month-end salary me automatic adjust ho jayega.
                    </li>
                  </ul>
                </div>
              )}

              

              {unresolvedList.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 600, margin: '8px 0 4px', color: 'var(--text-primary, #0f172a)' }}>
                    Attendance issues ({unresolvedList.length}):
                  </h4>
                  <ul
                    style={{
                      maxHeight: '130px',
                      overflowY: 'auto',
                      padding: '8px 16px',
                      background: 'var(--surface-sunken, #f8fafc)',
                      borderRadius: '6px',
                      fontSize: '0.825rem',
                      margin: 0,
                    }}
                  >
                    {unresolvedList.map((v) => (
                      <li key={v} style={{ margin: '3px 0' }}>{v}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </HrForm>
        );
      })()}
    </>
  );
}
