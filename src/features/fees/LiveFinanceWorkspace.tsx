import FeeOnboardingWorkspace from './onboarding/FeeOnboardingWorkspace';
import { orderedClasses } from '../../lib/schoolLabels';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckSquare, Download, RefreshCw } from 'lucide-react';
import {
  AppIcon,
  Button,
  EmptyState,
  PageHeading,
  Panel,
  PickerInput,
  SearchInput,
  StatCard,
  LoadingOverlay,
} from '../../components/ui/Primitives';
import SectionNavigation from '../../components/shared/SectionNavigation';
import { useLiveSchool } from '../live/schoolContext';
import { useRemote } from '../live/useRemote';
import LiveHrWorkspace from '../hr/HrWorkspace';
import { liveHrAdapter } from '../../services/hrService';
import {
  feeApi,
  type FeeContext,
  type FeeFilters,
  type FeeStudentRow,
} from '../../services/feeService';
import { money } from '../../lib/config';
import { formatCalendarDate, titleCase } from '../../lib/displayFormat';
import { downloadCsv } from '../../lib/download';
import FeeSetupDialog from './FeeSetupDialog';
import FeeOpeningDialog from './FeeOpeningDialog';
import FeeStudentLedger from './FeeStudentLedger';
import FeePayments from './FeePayments';
import './fees-live.css';
import '../../styles/ledgers.css';
import type { IconName } from '../../components/ui/AppIcon';

const LIVE_FINANCE_ICONS: Record<string, IconName> = {
  Overview: 'overview',
  'Student Fees': 'fees',
  'Salary Expenses': 'wallet',
  Transactions: 'receipt',
};

export default function LiveFinanceWorkspace() {
  const { schoolId, access } = useLiveSchool(),
    [params, setParams] = useSearchParams();
  const canView = access.permissions.includes('fees.view'),
    payroll = access.permissions.includes('payroll.view');
  const tabs = [
    ...(canView ? ['Overview', 'Student Fees'] : []),
    ...(canView && access.permissions.includes('fees.manage') ? ['School fee setup'] : []),
    ...(payroll ? ['Salary Expenses'] : []),
    ...(canView ? ['Transactions'] : []),
  ];
  const tab = tabs.find((t) => t === params.get('tab')) ?? tabs[0];
  const yearId = params.get('year') ?? '';
  const load = useCallback(
    (signal: AbortSignal) =>
      canView ? feeApi.context(schoolId, yearId, signal) : Promise.resolve(null),
    [schoolId, yearId, canView],
  );
  const state = useRemote(load);
  return (
    <div className="ledger-stack finance-workspace fee-workspace">
      <PageHeading title="Finance" />
      <SectionNavigation
        label="Finance"
        items={tabs.map((t) => ({ id: t, label: t, icon: LIVE_FINANCE_ICONS[t] || 'fees' }))}
        value={tab ?? ''}
        onChange={(value) =>
          setParams((previous) => {
            const next = new URLSearchParams(previous);
            next.set('tab', value);
            return next;
          })
        }
      />

      {tab === 'Salary Expenses' ? (
        <LiveHrWorkspace section="salary" hideNavigation />
      ) : !canView ? (
        <EmptyState title="Fee access is not assigned" />
      ) : state.error ? (
        <Panel title="Fee workspace unavailable">
          <p role="alert" className="form-error">
            {state.error}
          </p>
          <Button onClick={state.reload}>Retry</Button>
        </Panel>
      ) : !state.data ? (
        <LoadingOverlay loading label="Loading finance…">
          <div style={{ minHeight: 250 }} />
        </LoadingOverlay>
      ) : !state.data.yearId ? (
        <EmptyState
          title="Set up an academic year first"
          description="Fees belong to a student's academic year."
        />
      ) : tab === 'School fee setup' ? (
        <FeeOnboardingWorkspace
          key={`${schoolId}:${state.data.yearId}`}
          schoolId={schoolId}
          context={state.data}
          permissions={access.permissions}
        />
      ) : (
        <FeeWorkspace
          key={`${schoolId}:${state.data.yearId}`}
          schoolId={schoolId}
          context={state.data}
          permissions={access.permissions}
          payroll={payroll}
          tab={tab}
          setTab={(value) =>
            setParams((previous) => {
              const next = new URLSearchParams(previous);
              next.set('tab', value);
              return next;
            })
          }
          setYear={(value) =>
            setParams((previous) => {
              const next = new URLSearchParams(previous);
              next.set('year', value);
              return next;
            })
          }
        />
      )}
    </div>
  );
}
function FeeWorkspace({
  schoolId,
  context,
  permissions,
  payroll,
  tab,
  setTab,
  setYear,
}: {
  schoolId: string;
  context: FeeContext;
  permissions: readonly string[];
  payroll: boolean;
  tab: string;
  setTab: (t: string) => void;
  setYear: (id: string) => void;
}) {
  const [classId, setClass] = useState(''),
    [sectionId, setSection] = useState(''),
    [search, setSearch] = useState(''),
    [debounced, setDebounced] = useState(''),
    [status, setStatus] = useState(''),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<Map<string, FeeStudentRow>>(new Map()),
    [action, setAction] = useState<'setup' | 'opening' | null>(null),
    [student, setStudent] = useState<{ row: FeeStudentRow; collect: boolean } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [version, setVersion] = useState(0),
    [params, setParams] = useSearchParams();
  const period = (params.get('period') === 'cycle' ? 'cycle' : 'year') as 'year' | 'cycle';
  const month = params.get('month') || (context.today ? context.today.slice(0, 7) : new Date().toISOString().slice(0, 7));
  const financeView = params.get('financeView') ?? 'summary';
  const update = (key: string, value: string) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });

  const [salaryExpenses, setSalaryExpenses] = useState(0);
  useEffect(() => {
    if (!payroll) return;
    const ctrl = new AbortController();
    liveHrAdapter(schoolId)
      .load(month, false, ctrl.signal)
      .then((hr) => {
        const total = hr.payments.reduce((s, p) => s + p.amount, 0);
        setSalaryExpenses(total);
      })
      .catch(() => {
        setSalaryExpenses(0);
      });
    return () => ctrl.abort();
  }, [schoolId, payroll, month]);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const filters: FeeFilters = {
    yearId: context.yearId,
    classId,
    sectionId,
    search: debounced,
    status,
    page,
  };
  const load = useCallback(
    (signal: AbortSignal) =>
      tab === 'Transactions'
        ? Promise.resolve(null)
        : feeApi.directory(
            schoolId,
            { yearId: context.yearId, classId, sectionId, search: debounced, status, page },
            signal,
          ),
    [schoolId, context.yearId, classId, sectionId, debounced, status, page, tab],
  );
  const state = useRemote(load),
    data = state.data,
    can = (p: string) => permissions.includes(p),
    year = context.years.find((y) => y.id === context.yearId)!;
  const reset = () => {
    setPage(1);
    setSelected(new Map());
  };
  const refresh = () => {
    state.reload();
    setSelected(new Map());
    setVersion((v) => v + 1);
  };
  const selectAll = async () => {
    setBusy(true);
    setError('');
    const all = new Map<string, FeeStudentRow>();
    try {
      for (let next = 1; ; next++) {
        const result = await feeApi.directory(schoolId, { ...filters, page: next });
        result.items.forEach((r) => {
          all.set(r.id, r);
        });
        if (next * result.pageSize >= result.total) break;
      }
      setSelected(all);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to select students.');
    } finally {
      setBusy(false);
    }
  };
  const openSetup = () => {
    if ([...selected.values()].some((s) => s.enrollment?.status !== 'active')) {
      setError(
        'Current-year fees need an active enrollment. Use Previous-year dues for former students.',
      );
      return;
    }
    if (selected.size > 1 && [...selected.values()].some((s) => s.configured)) {
      setError(
        'Cannot select multiple students who already have fee structures. Select 1 student to edit, or select students with "Fee setup pending".',
      );
      return;
    }
    setError('');
    setAction('setup');
  };
  if (student)
    return (
      <FeeStudentLedger
        schoolId={schoolId}
        context={context}
        student={student.row}
        collectInitially={student.collect}
        permissions={permissions}
        close={() => setStudent(null)}
        changed={refresh}
      />
    );
  return (
    <>
      {tab === 'Overview' && (
        <div className="finance-subnav-row">
          <SectionNavigation
            variant="secondary"
            label="Finance overview views"
            items={[
              { id: 'summary', label: 'Collections & Revenue', icon: 'wallet' },
              { id: 'salary', label: 'Salary Summary', icon: 'finance-balance' },
              { id: 'recent', label: 'Recent Transactions', icon: 'receipt' },
            ]}
            value={
              ['salary', 'recent'].includes(params.get('financeView') ?? '')
                ? params.get('financeView')!
                : 'summary'
            }
            onChange={(value) =>
              setParams((previous) => {
                const next = new URLSearchParams(previous);
                if (value === 'summary') {
                  next.delete('financeView');
                } else {
                  next.set('financeView', value);
                }
                return next;
              })
            }
          />
          {(financeView === 'summary' || financeView === 'salary') && (
            <div className="finance-period">
              <label className="field">
                <select
                  aria-label="Finance period"
                  value={period}
                  onChange={(e) => update('period', e.target.value)}
                >
                  <option value="year">Academic Year</option>
                  <option value="cycle">Monthly Cycle</option>
                </select>
              </label>
              {period === 'cycle' && (
                <label className="field">
                  <PickerInput
                    aria-label="Finance cycle month"
                    type="month"
                    value={month}
                    onChange={(e) => update('month', e.target.value)}
                  />
                </label>
              )}
              <p>
                {period === 'cycle'
                  ? `${month}-01 – ${month}-28`
                  : year
                    ? `${formatCalendarDate(year.start)} – ${formatCalendarDate(year.end > (context.today || '') ? (context.today || '') : year.end)}`
                    : ''}
              </p>
            </div>
          )}
        </div>
      )}
      {tab === 'Transactions' && (
        <div className="finance-period">
          <label className="field">
            <select
              aria-label="Finance period"
              value={period}
              onChange={(e) => update('period', e.target.value)}
            >
              <option value="year">Academic Year</option>
              <option value="cycle">Monthly Cycle</option>
            </select>
          </label>
          {period === 'cycle' && (
            <label className="field">
              <PickerInput
                aria-label="Finance cycle month"
                type="month"
                value={month}
                onChange={(e) => update('month', e.target.value)}
              />
            </label>
          )}
          <p>
            {period === 'cycle'
              ? `${month}-01 – ${month}-28`
              : year
                ? `${formatCalendarDate(year.start)} – ${formatCalendarDate(year.end > (context.today || '') ? (context.today || '') : year.end)}`
                : ''}
          </p>
        </div>
      )}
      {tab === 'Student Fees' && (
        <div className="fee-filter-bar">
          <label className="field">
            Academic year
            <select value={context.yearId} onChange={(e) => setYear(e.target.value)}>
              {context.years.map((y) => (
                <option value={y.id} key={y.id}>
                  {y.name}
                  {y.status === 'closed' ? ' · Closed' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-label">
            <span>Class</span>
            <select
              value={classId}
              onChange={(e) => {
                setClass(e.target.value);
                setSection('');
                reset();
              }}
            >
              <option value="">All classes</option>
              {orderedClasses(context.classes).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-label">
            <span>Section</span>
            <select
              value={sectionId}
              disabled={!classId}
              onChange={(e) => {
                setSection(e.target.value);
                reset();
              }}
            >
              <option value="">Whole class</option>
              {context.sections
                .filter((s) => s.classId === classId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
          <Button variant="secondary" onClick={refresh}>
            <RefreshCw size={16} />
            Refresh
          </Button>
        </div>
      )}
      {tab === 'Transactions' ? (
        <FeePayments
          key={version}
          schoolId={schoolId}
          schoolName={context.schoolName}
          yearId={context.yearId}
          canReverse={can('fees.reverse')}
          changed={refresh}
        />
      ) : (
        <>
          {(state.loading || busy) && !(tab === 'Overview' && financeView === 'salary') && (
            <LoadingOverlay
              loading={state.loading || busy}
              size="xl"
              label={busy ? 'Selecting students…' : 'Loading student fees…'}
              message={busy ? 'Selecting students…' : 'Loading student fees…'}
            >
              <div style={{ minHeight: 160 }} />
            </LoadingOverlay>
          )}
          {tab === 'Overview' && (
            <>
              {financeView === 'salary' ? (
                <LiveHrWorkspace section="salary" hideNavigation />
              ) : financeView === 'recent' ? (
                <FeePayments
                  key={version}
                  schoolId={schoolId}
                  schoolName={context.schoolName}
                  yearId={context.yearId}
                  canReverse={can('fees.reverse')}
                  changed={refresh}
                />
              ) : (
                data && (
                  <>
                    <div className="stats-grid four finance-summary fee-stats">
                      <StatCard
                        label="Student Fee Collections"
                        value={money(data.summary.collected)}
                        detail="Recorded student fee collections"
                        icon={<AppIcon name="receipt" size={48} />}
                        tone="green"
                      />
                      <StatCard
                        label="Salary Expenses"
                        value={money(salaryExpenses)}
                        detail="Recorded salary payments"
                        icon={<AppIcon name="wallet" size={48} />}
                        tone="amber"
                      />
                      <StatCard
                        label="Net Revenue"
                        value={money(data.summary.collected - salaryExpenses)}
                        detail="Revenue minus paid salaries"
                        icon={<AppIcon name="finance-balance" size={48} />}
                      />
                      <StatCard
                        label="Pending Student Fees"
                        value={money(data.summary.outstanding)}
                        detail="All current fee plans, including future dues"
                        icon={<AppIcon name="fees" size={48} />}
                      />
                    </div>
                    <div className="fee-overview-grid">
                      <Panel
                        className="fee-ready-panel"
                        title="Ready for collection"
                        subtitle="Set up the common fee arrangement, then adjust individual exceptions."
                      >
                        <div className="fee-dashboard-action">
                          <div className="fee-dashboard-action-main">
                            <strong>{data.summary.pending}</strong>
                            <div>
                              <h3>Students need fee setup</h3>
                              <p>Unconfigured students are never shown as paid.</p>
                            </div>
                          </div>
                          <Button
                            onClick={() => {
                              setStatus('pending');
                              reset();
                              setTab('Student Fees');
                            }}
                          >
                            Set up fees
                          </Button>
                        </div>
                        <div className="fee-ready-footer">
                          <span>Concessions & scholarships</span>
                          <strong className="currency-cell">{money(data.summary.concessions)}</strong>
                        </div>
                      </Panel>
                      <Panel title="Class-wise balances">
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Class</th>
                                <th>Students</th>
                                <th>Outstanding</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.classes.map((c) => (
                                <tr key={c._id ?? 'former'}>
                                  <th>
                                    {context.classes.find((v) => v.id === c._id)?.name ??
                                      'No current enrollment'}
                                  </th>
                                  <td>{c.count}</td>
                                  <td>{money(c.outstanding)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Panel>
                    </div>
                    <div className="fee-inline">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setStatus('overdue');
                          reset();
                          setTab('Student Fees');
                        }}
                      >
                        Review overdue students
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setStatus('outstanding');
                          reset();
                          setTab('Student Fees');
                        }}
                      >
                        Upcoming installments & balances
                      </Button>
                      <Button variant="secondary" onClick={() => update('financeView', 'recent')}>
                        Recent payments & receipts
                      </Button>
                    </div>
                  </>
                )
              )}
            </>
          )}
          {tab === 'Student Fees' && (
            <Panel
              title="Student fees"
              subtitle="Select students for bulk setup, or manage an individual agreement and collect payment."
              action={
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <SearchInput
                    value={search}
                    onChange={(v) => {
                      setSearch(v);
                      reset();
                    }}
                    placeholder="Search student, admission number…"
                  />
                  <select
                    style={{
                      height: 38,
                      padding: '0 12px',
                      fontSize: 13,
                      borderRadius: 8,
                      border: '1px solid var(--border, #d1d5db)',
                      background: 'var(--surface-input, #fff)',
                      color: 'inherit',
                      outline: 'none',
                    }}
                    value={status}
                    aria-label="Fee status"
                    onChange={(e) => {
                      setStatus(e.target.value);
                      reset();
                    }}
                  >
                    <option value="">All students</option>
                    <option value="pending">Fee setup pending</option>
                    <option value="overdue">Overdue</option>
                    <option value="outstanding">Outstanding</option>
                    <option value="paid">Paid in full</option>
                    <option value="former">Former students / no active enrollment</option>
                  </select>
                  <Button
                    variant="secondary"
                    disabled={!data?.items.length}
                    onClick={() =>
                      downloadCsv(
                        'student-fees-page.csv',
                        [
                          'Student',
                          'Admission number',
                          'Agreed fee INR',
                          'Old dues INR',
                          'Paid current year INR',
                          'Outstanding INR',
                          'Next due',
                        ],
                        (data?.items ?? []).map((r) => [
                          r.name,
                          r.code,
                          r.net / 100,
                          r.oldDues / 100,
                          r.paid / 100,
                          r.outstanding / 100,
                          r.nextDue ? formatCalendarDate(r.nextDue) : '',
                        ]),
                      )
                    }
                  >
                    <Download size={16} />
                    Export page
                  </Button>
                </div>
              }
            >
              {can('fees.manage') && year.status !== 'closed' && (
                <>
                  <div className="fee-bulk-bar">
                    <span>
                      <CheckSquare size={16} />
                      {selected.size} selected
                    </span>
                    <Button
                      variant="secondary"
                      disabled={busy || !data?.total}
                      onClick={() => void selectAll()}
                    >
                      {busy ? 'Selecting…' : 'Select all matching students'}
                    </Button>
                    {selected.size > 0 && (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setSelected(new Map());
                            setError('');
                          }}
                        >
                          Clear
                        </Button>
                        <Button onClick={openSetup}>Set up fees</Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setError('');
                            setAction('opening');
                          }}
                        >
                          Previous-year dues
                        </Button>
                      </>
                    )}
                  </div>
                  {error && (
                    <div
                      role="alert"
                      className="form-error"
                      style={{
                        margin: '10px 0 14px',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        color: '#b91c1c',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>{error}</span>
                      <button
                        type="button"
                        onClick={() => setError('')}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#b91c1c',
                          fontWeight: 700,
                          fontSize: 14,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </>
              )}
              <div className="table-wrap fee-directory">
                <table>
                  <thead>
                    <tr>
                      {can('fees.manage') && (
                        <th>
                          <span className="sr-only">Select</span>
                        </th>
                      )}
                      <th>Student</th>
                      <th>Class / Section</th>
                      <th>Yearly fee</th>
                      <th>Old dues</th>
                      <th>Paid this year</th>
                      <th>Outstanding</th>
                      <th>Next due</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.items.map((r) => (
                      <tr key={r.id}>
                        {can('fees.manage') && (
                          <td>
                            <input
                              aria-label={`Select ${r.code}`}
                              type="checkbox"

                              checked={selected.has(r.id)}
                              onChange={(e) =>
                                setSelected((old) => {
                                  const next = new Map(old);
                                  if (e.target.checked) next.set(r.id, r);
                                  else next.delete(r.id);
                                  return next;
                                })
                              }
                            />
                          </td>
                        )}
                        <th scope="row">
                          {titleCase(r.name)}
                          <small>{r.code}</small>
                        </th>
                        <td>
                          {context.classes.find((c) => c.id === r.enrollment?.classId)?.name ??
                            'No current enrollment'}
                          <small>
                            {context.sections.find((s) => s.id === r.enrollment?.sectionId)?.name ??
                              ''}
                          </small>
                        </td>
                        <td>{r.configured ? money(r.net) : 'Not set'}</td>
                        <td>{money(r.oldDues)}</td>
                        <td>{money(r.paid)}</td>
                        <td>
                          <strong>{money(r.outstanding)}</strong>
                        </td>
                        <td>{r.nextDue ? formatCalendarDate(r.nextDue) : '—'}</td>
                        <td>
                          <span
                            className={`fee-status ${r.pending ? 'pending' : r.overdue ? 'overdue' : r.outstanding ? 'pending' : 'paid'}`}
                          >
                            {r.pending
                              ? 'Setup pending'
                              : r.overdue
                                ? 'Overdue'
                                : r.outstanding
                                  ? 'Pending'
                                  : r.configured
                                    ? 'Paid'
                                    : 'No fee account'}
                          </span>
                        </td>
                        <td>
                          <div className="fee-row-actions">
                            <Button
                              variant="secondary"
                              onClick={() => setStudent({ row: r, collect: false })}
                            >
                              Manage Fees
                            </Button>
                            {can('fees.collect') && r.outstanding > 0 && (
                              <Button onClick={() => setStudent({ row: r, collect: true })}>
                                Collect payment
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!state.loading && !state.error && !data?.items.length && (
                <EmptyState
                  title="No matching students"
                  description="Change the class or fee status filter. Student records appear here automatically."
                />
              )}
              <div className="pagination">
                <span>{data?.total ?? 0} students · 50 per page</span>
                <Button
                  variant="secondary"
                  disabled={page <= 1 || state.loading}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span>Page {page}</span>
                <Button
                  variant="secondary"
                  disabled={!data || page * 50 >= data.total || state.loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </Panel>
          )}
        </>
      )}
      {(state.error || error) && (
        <p role="alert" className="form-error">
          {state.error || error}
        </p>
      )}
      {action === 'setup' && (
        <FeeSetupDialog
          schoolId={schoolId}
          context={context}
          students={[...selected.values()]}
          canApprove={can('fees.approve')}
          close={() => setAction(null)}
          saved={() => {
            state.reload();
            setVersion((v) => v + 1);
          }}
        />
      )}
      {action === 'opening' && (
        <FeeOpeningDialog
          schoolId={schoolId}
          context={context}
          students={[...selected.values()]}
          close={() => setAction(null)}
          saved={refresh}
        />
      )}
    </>
  );
}
