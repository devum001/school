import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet,
  Receipt,
  Clock3,
  ArrowUpRight,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  PageHeading,
  Panel,
  SearchInput,
  StatCard,
} from '../../components/ui/Primitives';
import { ClassFilters } from '../../components/shared/ClassFilters';
import { feeSummary, roster } from '../../lib/selectors';
import { displayDate, money, shortMoney } from '../../lib/config';
import { downloadCsv } from '../../lib/download';
import PaymentDialog from './PaymentDialog';
export default function FeesPage() {
  const state = useSchool();
  const [query, setQuery] = useState('');
  const [classId, setClass] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState('');
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState('balances');
  const total = feeSummary(state);
  const rows = roster(state, true)
    .map((r) => ({ ...r, fees: feeSummary(state, r.enrollment.id) }))
    .filter(
      (r) =>
        (!classId || r.enrollment.classId === classId) &&
        `${r.student.name} ${r.student.admissionNumber}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (!status || (status === 'paid' ? r.fees.outstanding === 0 : r.fees.outstanding > 0)),
    );
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const current = Math.min(page, pages);
  const payments = state.payments
    .filter((p) => rows.some((r) => r.enrollment.id === p.enrollmentId))
    .slice()
    .reverse();
  return (
    <>
      <PageHeading
        eyebrow="HEALTHY FINANCES. STRONGER SCHOOLS."
        title="Fee management"
        description="Keep every obligation, payment, and balance in perspective."
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              downloadCsv(
                'vidya-niketan-fees.csv',
                ['Student', 'Admission', 'Obligation INR', 'Paid INR', 'Outstanding INR'],
                rows.map((r) => [
                  r.student.name,
                  r.student.admissionNumber,
                  r.fees.total / 100,
                  r.fees.paid / 100,
                  r.fees.outstanding / 100,
                ]),
              )
            }
          >
            <Download size={16} />
            Export balances
          </Button>
        }
      />
      <div className="stats-grid three">
        <StatCard
          label="Annual fee obligations"
          value={shortMoney(total.total)}
          detail="Includes scholarship adjustments"
          icon={<Receipt size={19} />}
        />
        <StatCard
          label="Total collected"
          value={shortMoney(total.paid)}
          detail={`${total.payments.length} payment records`}
          icon={<Wallet size={19} />}
          tone="green"
        />
        <StatCard
          label="Outstanding balance"
          value={shortMoney(total.outstanding)}
          detail="Includes future installments"
          icon={<Clock3 size={19} />}
          tone="amber"
        />
      </div>
      <div className="tabs">
        <button className={tab === 'balances' ? 'active' : ''} onClick={() => setTab('balances')}>
          Student balances
        </button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          Payment history
        </button>
      </div>
      <Panel>
        <div className="toolbar">
          <SearchInput
            value={query}
            onChange={(v) => {
              setQuery(v);
              setPage(1);
            }}
            placeholder="Search student or admission number…"
          />
          <ClassFilters
            classId={classId}
            onClassChange={(v) => {
              setClass(v);
              setPage(1);
            }}
          />
          <select
            aria-label="Payment status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All payment statuses</option>
            <option value="outstanding">Has outstanding balance</option>
            <option value="paid">Fully paid</option>
          </select>
        </div>
        {tab === 'balances' ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Annual obligation</th>
                    <th>Paid</th>
                    <th>Outstanding</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.slice((current - 1) * 10, current * 10).map((r) => (
                    <tr key={r.enrollment.id}>
                      <td>
                        <Link className="person" to={`/students/${r.student.id}?tab=fees`}>
                          <Avatar name={r.student.name} />
                          <span>
                            <strong>{r.student.name}</strong>
                            <small>{r.student.admissionNumber}</small>
                          </span>
                        </Link>
                      </td>
                      <td>
                        {r.className} · {r.sectionName}
                      </td>
                      <td>{money(r.fees.total)}</td>
                      <td>{money(r.fees.paid)}</td>
                      <td>
                        <strong>{money(r.fees.outstanding)}</strong>
                      </td>
                      <td>
                        <Badge tone={r.fees.outstanding ? 'amber' : 'green'}>
                          {r.fees.outstanding ? 'Part paid' : 'Fully paid'}
                        </Badge>
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          disabled={!r.fees.outstanding}
                          onClick={() => setSelected(r.enrollment.id)}
                        >
                          Record payment <ArrowUpRight size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && <EmptyState />}
            <div className="pagination">
              <span>{rows.length} matching students</span>
              <div>
                <Button
                  variant="secondary"
                  aria-label="Previous fee page"
                  disabled={current === 1}
                  onClick={() => setPage(current - 1)}
                >
                  <ChevronLeft size={15} />
                </Button>
                <span>
                  Page {current} of {pages}
                </span>
                <Button
                  variant="secondary"
                  aria-label="Next fee page"
                  disabled={current === pages}
                  onClick={() => setPage(current + 1)}
                >
                  <ChevronRight size={15} />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="table-wrap history-table">
              <table>
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Student</th>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const row = rows.find((r) => r.enrollment.id === p.enrollmentId);
                    return (
                      <tr key={p.id}>
                        <td className="mono">{p.reference}</td>
                        <td>
                          <Link to={`/students/${row?.student.id}?tab=fees`}>
                            {row?.student.name}
                          </Link>
                        </td>
                        <td>{displayDate(p.date)}</td>
                        <td>{p.method}</td>
                        <td>{money(p.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!payments.length && <EmptyState title="No matching payments" />}
          </>
        )}
      </Panel>
      <p className="panel-note">
        All amounts are in INR. Recorded payments are retained in the transaction history.
      </p>
      {selected && <PaymentDialog enrollmentId={selected} onClose={() => setSelected('')} />}
    </>
  );
}
