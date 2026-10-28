import SectionNavigation from '../../components/shared/SectionNavigation';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { useToday } from '../../app/useToday';
import {
  PickerInput,
  Button,
  EmptyState,
  Modal,
  PageHeading,
  Panel,
  SearchInput,
  StatCard,
  AppIcon,
  type IconName,
} from '../../components/ui/Primitives';
import GeneratedDocumentPreview from '../../components/shared/GeneratedDocumentPreview';
import { money, displayDate } from '../../lib/config';
import { feeSummary } from '../../lib/selectors';
import { defaultStaffPayroll } from '../../lib/settings';
import { currentPayrollMonth, payrollCycle } from '../../lib/staffPayroll';
import { salaryMonthSchema } from '../../lib/staffSalary';
import { schoolMonthlyFinance } from '../../lib/schoolFinance';
import { financeEntries } from '../../lib/financeLedger';
import { downloadCsv } from '../../lib/download';
import type { GeneratedDocument } from '../../types/ledger';
import FeesPage from './FeesPage';
import StaffPage from '../teachers/StaffPage';
import '../../styles/ledgers.css';
const tabs = ['Overview', 'Student Fees', 'Salary Expenses', 'Transactions'] as const;
const financeTabIcons: Record<(typeof tabs)[number], IconName> = {
  Overview: 'overview',
  'Student Fees': 'fees',
  'Salary Expenses': 'wallet',
  Transactions: 'receipt',
};
export default function FinanceWorkspace() {
  const state = useSchool(),
    today = useToday(),
    [params, setParams] = useSearchParams(),
    config = state.staffPayroll ?? defaultStaffPayroll;
  const requested = params.get('month'),
    month = salaryMonthSchema.safeParse(requested).success
      ? requested!
      : currentPayrollMonth(today, config.payroll.paymentDay),
    cycle = payrollCycle(month, config.payroll.paymentDay);
  const tab = tabs.find((value) => value === params.get('tab')) ?? 'Overview';
  const period = params.get('period') === 'cycle' ? 'cycle' : 'year';
  const range =
    period === 'cycle' ? cycle : { start: state.academicYear.start, end: state.academicYear.end };
  const finance = schoolMonthlyFinance(state, config, cycle.end > today ? today : cycle.end, month);
  const entries = financeEntries(state, range.start, range.end, today),
    fees = feeSummary(state);
  const income = entries.reduce((sum, entry) => sum + entry.income, 0),
    expenses = entries.reduce((sum, entry) => sum + entry.expense, 0),
    netRevenue = income - expenses;
  const [query, setQuery] = useState(''),
    [type, setType] = useState(''),
    [page, setPage] = useState(1),
    [document, setDocument] = useState<GeneratedDocument | null>(null);
  const filtered = entries.filter(
    (entry) =>
      (!type || entry.type === type) &&
      `${entry.name} ${entry.reference} ${entry.number}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 20)),
    current = Math.min(page, pages);
  const update = (key: string, value: string) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set(key, value);
      return next;
    });
  return (
    <div className="ledger-stack finance-workspace">
      <PageHeading title="Finance" />
      <SectionNavigation
        label="Finance"
        value={tab}
        onChange={(value) => update('tab', value)}
        items={tabs.map((value) => ({
          id: value,
          label: value,
          icon: financeTabIcons[value],
        }))}
      />
      {tab === 'Overview' && (
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
          onChange={(value) => update('financeView', value)}
        />
      )}
      {((tab === 'Overview' && !['salary', 'recent'].includes(params.get('financeView') ?? '')) ||
        tab === 'Transactions') && (
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
              Finance cycle month
              <PickerInput
                aria-label="Finance cycle month"
                type="month"
                value={month}
                onChange={(e) => {
                  if (salaryMonthSchema.safeParse(e.target.value).success)
                    update('month', e.target.value);
                }}
              />
            </label>
          )}
          <p>
            {displayDate(range.start)} – {displayDate(range.end > today ? today : range.end)}
          </p>
        </div>
      )}
      <div id="finance-panel" role="tabpanel" aria-labelledby={`finance-tab-${tabs.indexOf(tab)}`}>
        {tab === 'Overview' && (
          <div className="ledger-stack">
            {!['salary', 'recent'].includes(params.get('financeView') ?? '') && (
              <div className="stats-grid four finance-summary">
                <StatCard
                  label="Student Fee Collections"
                  value={money(income)}
                  detail="Recorded student fee collections"
                  icon={<AppIcon name="receipt" size={48} />}
                  tone="green"
                />
                <StatCard
                  label="Salary Expenses"
                  value={money(expenses)}
                  detail="Recorded salary payments"
                  icon={<AppIcon name="wallet" size={48} />}
                  tone="amber"
                />
                <StatCard
                  label="Net Revenue"
                  value={money(netRevenue)}
                  detail="Revenue minus paid salaries"
                  icon={<AppIcon name="finance-balance" size={48} />}
                />
                <StatCard
                  label="Pending Student Fees"
                  value={money(fees.outstanding)}
                  detail="All current fee plans, including future dues"
                  icon={<AppIcon name="fees" size={48} />}
                />
              </div>
            )}
            {params.get('financeView') === 'salary' && (
              <Panel
                title="Salary Overview"
                action={
                  <Button variant="secondary" onClick={() => update('tab', 'Salary Expenses')}>
                    Manage Staff Salaries
                  </Button>
                }
              >
                <div className="finance-period panel-padding">
                  <label className="field">
                    Salary cycle month
                    <PickerInput
                      aria-label="Overview salary cycle month"
                      type="month"
                      value={month}
                      onChange={(e) => {
                        if (salaryMonthSchema.safeParse(e.target.value).success)
                          update('month', e.target.value);
                      }}
                    />
                  </label>
                  <p>
                    {displayDate(cycle.start)} – {displayDate(cycle.end)}
                  </p>
                </div>
                <dl className="school-finance-values finance-salary-values" data-month={month}>
                  {[
                    ['Gross monthly salaries', finance.grossSalary],
                    ['Salary deductions', finance.deductions],
                    ['Net monthly salaries', finance.netSalary],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <dt>{label}</dt>
                      <dd>{money(Number(value))}</dd>
                    </div>
                  ))}
                </dl>
                <p className="school-finance-note panel-padding">
                  {finance.configuredCount} active staff with salary configured
                  {finance.unconfiguredCount
                    ? ` · ${finance.unconfiguredCount} salaries not set`
                    : ''}
                  .
                </p>
              </Panel>
            )}
            {params.get('financeView') === 'recent' && (
              <Panel title="Recent transactions">
                <div
                  className="table-wrap"
                  role="region"
                  aria-label="Recent finance transactions"
                  tabIndex={0}
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Person</th>
                        <th>Type</th>
                        <th>Date</th>
                        <th className="currency-cell">Income</th>
                        <th className="currency-cell">Expense</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.slice(0, 8).map((entry) => (
                        <tr key={entry.id}>
                          <th scope="row">{entry.name}</th>
                          <td>{entry.type}</td>
                          <td>{displayDate(entry.date)}</td>
                          <td className="currency-cell">
                            {entry.income ? money(entry.income) : '—'}
                          </td>
                          <td className="currency-cell">
                            {entry.expense ? money(entry.expense) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!entries.length && (
                  <EmptyState
                    title="No payments in this period"
                    description="Record student or salary payments to update this summary."
                  />
                )}
              </Panel>
            )}
          </div>
        )}
        {tab === 'Student Fees' && <FeesPage embedded />}
        {tab === 'Salary Expenses' && <StaffPage embedded />}
        {tab === 'Transactions' && (
          <Panel
            title="Transactions"
            action={
              <Button
                variant="secondary"
                onClick={() =>
                  downloadCsv(
                    'finance-transactions.csv',
                    [
                      'Type',
                      'Name',
                      'Date',
                      'Mode',
                      'Reference',
                      'Document',
                      'Income INR',
                      'Expense INR',
                    ],
                    filtered.map((e) => [
                      e.type,
                      e.name,
                      e.date,
                      e.method,
                      e.reference,
                      e.number,
                      e.income / 100,
                      e.expense / 100,
                    ]),
                  )
                }
              >
                <Download size={16} />
                Export Transactions
              </Button>
            }
          >
            <div className="toolbar">
              <SearchInput
                value={query}
                onChange={(value) => {
                  setQuery(value);
                  setPage(1);
                }}
                placeholder="Search person, reference or document…"
              />
              <select
                aria-label="Transaction type"
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All transactions</option>
                <option>Fee Payment</option>
                <option>Salary Payment</option>
              </select>
            </div>
            <div
              className="table-wrap"
              role="region"
              aria-label="Finance transactions"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Mode</th>
                    <th>Reference</th>
                    <th className="currency-cell">Income</th>
                    <th className="currency-cell">Expense</th>
                    <th>Document</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice((current - 1) * 20, current * 20).map((entry) => (
                    <tr key={entry.id}>
                      <th scope="row">{entry.name}</th>
                      <td>{entry.type}</td>
                      <td>{displayDate(entry.date)}</td>
                      <td>{entry.method}</td>
                      <td>{entry.reference || '—'}</td>
                      <td className="currency-cell">{entry.income ? money(entry.income) : '—'}</td>
                      <td className="currency-cell">
                        {entry.expense ? money(entry.expense) : '—'}
                      </td>
                      <td>
                        <button className="text-link" onClick={() => setDocument(entry.document)}>
                          {entry.number}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filtered.length && <EmptyState title="No matching transactions" />}
            <div className="pagination">
              <span>{filtered.length} transactions</span>
              <Button
                variant="secondary"
                disabled={current === 1}
                onClick={() => setPage(current - 1)}
              >
                Previous
              </Button>
              <span>
                {current} / {pages}
              </span>
              <Button
                variant="secondary"
                disabled={current === pages}
                onClick={() => setPage(current + 1)}
              >
                Next
              </Button>
            </div>
          </Panel>
        )}
      </div>
      <Modal
        open={!!document}
        wide
        title={document?.kind ?? 'Payment document'}
        description={document?.recipientName ?? ''}
        onClose={() => setDocument(null)}
      >
        {document && <GeneratedDocumentPreview data={document} />}
      </Modal>
      <Link className="text-link" to="/settings?tab=Staff+%26+Payroll&section=payroll">
        Salary rules & settings →
      </Link>
    </div>
  );
}
