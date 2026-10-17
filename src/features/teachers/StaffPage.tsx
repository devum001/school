import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { useToday } from '../../app/useToday';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  PageHeading,
  Panel,
  SearchInput,
} from '../../components/ui/Primitives';
import { defaultStaffPayroll } from '../../lib/settings';
import { staffDirectory, staffDesignation, staffLabel } from '../../lib/staffStructure';
import { salaryMonthSchema } from '../../lib/staffSalary';
import { currentPayrollMonth, payrollCycle, staffCycleSummary } from '../../lib/staffPayroll';
import { money, displayDate } from '../../lib/config';
import StaffDialog from './StaffDialog';
import '../../styles/management.css';
import '../../styles/staff-structure.css';
import SalaryPaymentDialog from './SalaryPaymentDialog';
import { salaryPaymentFor } from '../../lib/financeTransactions';
import '../../styles/ledgers.css';

export default function StaffPage({ embedded = false }: { embedded?: boolean }) {
  const state = useSchool(),
    [params, setParams] = useSearchParams();
  const config = state.staffPayroll ?? defaultStaffPayroll;
  const today = useToday();
  const requestedMonth = params.get('month');
  const month = salaryMonthSchema.safeParse(requestedMonth).success
    ? requestedMonth!
    : currentPayrollMonth(today, config.payroll.paymentDay);
  const cycle = payrollCycle(month, config.payroll.paymentDay);
  const [query, setQuery] = useState(''),
    [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);
  const requested = params.get('department') ?? '';
  const departmentId = config.setup.departments.some((d) => d.id === requested) ? requested : '';
  const members = staffDirectory(state, config),
    filtered = members.filter(
      (member) =>
        (!departmentId || member.departmentId === departmentId) &&
        (!params.get('staff') || member.id === params.get('staff')) &&
        `${member.name} ${staffDesignation(member, config)}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
  return (
    <>
      {!embedded && (
        <PageHeading
          title="Staff"
          description="Track staff salaries and leave deductions by salary cycle."
          actions={
            <>
              <Link className="button secondary" to="/attendance/staff">
                Staff attendance
              </Link>
              <Button onClick={() => setAdding(true)} disabled={!config.setup.departments.length}>
                <Plus size={15} />
                Add Staff
              </Button>
            </>
          }
        />
      )}
      <Panel
        title="Salary"
        subtitle={`${members.length} staff`}
        action={
          <Link className="text-link" to="/settings?tab=Staff+%26+Payroll">
            Manage staff & salary settings
          </Link>
        }
      >
        <div className="staff-directory-toolbar">
          <label>
            Salary cycle month
            <input
              type="month"
              value={month}
              onChange={(event) => {
                const value = event.target.value;
                if (salaryMonthSchema.safeParse(value).success)
                  setParams((previous) => {
                    const next = new URLSearchParams(previous);
                    next.set('month', value);
                    return next;
                  });
              }}
            />
          </label>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search staff name or designation…"
          />
          <label>
            Department filter
            <select
              value={departmentId}
              onChange={(event) =>
                setParams((previous) => {
                  const next = new URLSearchParams(previous);
                  if (event.target.value) next.set('department', event.target.value);
                  else next.delete('department');
                  return next;
                })
              }
            >
              <option value="">All departments</option>
              {config.setup.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="staff-cycle-note">
          {displayDate(cycle.start)} – {displayDate(cycle.end)}
        </p>
        {filtered.length ? (
          <div
            className="staff-payroll-table"
            role="region"
            aria-label="Staff salary tracker"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Staff</th>
                  <th scope="col">Salary</th>
                  <th scope="col">Leave Deduction</th>
                  <th scope="col">Net Salary</th>
                  <th scope="col">Leave details</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((member) => {
                  const department = config.setup.departments.find(
                    (d) => d.id === member.departmentId,
                  );
                  const summary = staffCycleSummary(state, config, member, month);
                  const payment = salaryPaymentFor(state, member.id, month);
                  return (
                    <tr key={member.id}>
                      <th scope="row">
                        <div className="staff-payroll-person">
                          <Avatar name={member.name} />
                          <div>
                            <strong>{staffLabel(member, config)}</strong>
                            <p>
                              {department?.name ?? 'Department not assigned'}
                              {member.status === 'inactive' ? ' · Inactive' : ''}
                            </p>
                          </div>
                        </div>
                      </th>
                      <td>
                        {payment
                          ? money(payment.gross)
                          : summary.salary
                            ? money(summary.gross)
                            : 'Not set'}
                      </td>
                      <td>{money(payment?.leaveDeduction ?? summary.leaveDeduction)}</td>
                      <td>
                        {payment ? money(payment.net) : summary.salary ? money(summary.net) : '—'}
                      </td>
                      <td>
                        {payment?.leaveDays ?? summary.leaveDays}{' '}
                        {(payment?.leaveDays ?? summary.leaveDays) === 1 ? 'leave' : 'leaves'}
                      </td>
                      <td>
                        <Badge tone={payment ? 'green' : 'amber'}>
                          {payment ? 'Paid' : 'Pending'}
                        </Badge>
                      </td>
                      <td>
                        <Button
                          variant={payment ? 'ghost' : 'secondary'}
                          aria-label={`${payment ? 'View salary slip' : 'Record Salary Payment'} ${member.name}`}
                          disabled={
                            !payment &&
                            (!summary.salary || member.status !== 'active' || cycle.start > today)
                          }
                          onClick={() => setPaying(member.id)}
                        >
                          {payment ? 'View Salary Slip' : 'Record Salary Payment'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No staff found"
            description="Add staff or try another search or department."
          />
        )}
      </Panel>
      <Panel
        title="Salary payment history"
        subtitle="Recorded payments · generate salary slips using the current template"
      >
        {(state.salaryPayments ?? []).filter(
          (payment) =>
            payment.schoolId === state.school.id &&
            (!params.get('staff') || payment.staffId === params.get('staff')),
        ).length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Month</th>
                  <th>Amount paid</th>
                  <th>Payment date</th>
                  <th>Mode</th>
                  <th>Reference</th>
                  <th>Salary Slip</th>
                </tr>
              </thead>
              <tbody>
                {(state.salaryPayments ?? [])
                  .filter(
                    (payment) =>
                      payment.schoolId === state.school.id &&
                      (!params.get('staff') || payment.staffId === params.get('staff')),
                  )
                  .slice()
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .map((payment) => (
                    <tr key={payment.id}>
                      <th scope="row">{payment.document.recipientName}</th>
                      <td>{payment.month}</td>
                      <td>{money(payment.amountPaid)}</td>
                      <td>{displayDate(payment.date)}</td>
                      <td>{payment.method}</td>
                      <td>{payment.reference || '—'}</td>
                      <td>
                        <Link
                          className="text-link"
                          to={`/fees?tab=Salary+Expenses&month=${payment.month}&staff=${payment.staffId}`}
                        >
                          {payment.slipNumber}
                        </Link>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No salary payments yet"
            description="Recorded salary payments will appear here."
          />
        )}
      </Panel>
      {adding && <StaffDialog departmentId={departmentId} onClose={() => setAdding(false)} />}
      {paying && (
        <SalaryPaymentDialog staffId={paying} month={month} onClose={() => setPaying(null)} />
      )}
    </>
  );
}
