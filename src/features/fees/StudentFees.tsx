import InstallmentSchedule from './InstallmentSchedule';
import { useToday } from '../../app/useToday';
import { useState } from 'react';
import { useSchool } from '../../app/useSchool';
import { Badge, Button, Panel, StatCard, AppIcon } from '../../components/ui/Primitives';
import { feeSummary, installments } from '../../lib/selectors';
import { displayDate, money } from '../../lib/config';
import PaymentDialog from './PaymentDialog';
import FeeReceiptDialog from './FeeReceiptDialog';
import '../../styles/ledgers.css';
export function StudentFees({ enrollmentId }: { enrollmentId: string }) {
  const state = useSchool();
  const today = useToday();
  const summary = feeSummary(state, enrollmentId);
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const schedule = installments(state, enrollmentId),
    next = schedule.find((item) => item.outstanding > 0);
  const overall = !schedule.length
    ? 'Not configured'
    : !summary.outstanding
      ? 'Paid'
      : schedule.some((item) => item.outstanding > 0 && item.dueDate < today)
        ? 'Overdue'
        : 'Pending';
  return (
    <>
      <div className="stats-grid three">
        <StatCard
          label="Total Fee"
          detail={null}
          value={money(summary.total)}
          icon={<AppIcon name="receipt" size={24} />}
        />
        <StatCard
          label="Paid"
          value={money(summary.paid)}
          detail={`${summary.payments.length} recorded transactions`}
          icon={<AppIcon name="wallet" size={24} />}
          tone="green"
        />
        <StatCard
          label="Pending"
          value={money(summary.outstanding)}
          detail="Includes future installments"
          icon={<AppIcon name="finance-balance" size={24} />}
          tone="amber"
        />
      </div>
      <div className="template-tools">
        <p>
          Next Installment:{' '}
          <strong>
            {next
              ? `${next.label} · ${money(next.outstanding)} · ${displayDate(next.dueDate)}`
              : '—'}
          </strong>
        </p>
        <Badge tone={overall === 'Paid' ? 'green' : overall === 'Overdue' ? 'amber' : 'neutral'}>
          {overall}
        </Badge>
      </div>
      <InstallmentSchedule enrollmentId={enrollmentId} onRecordPayment={() => setOpen(true)} />
      <Panel title="Payment history" subtitle="Transaction records for the academic year">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Mode</th>
                <th>Receipt</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {[...summary.payments].reverse().map((p) => (
                <tr key={p.id}>
                  <td>{displayDate(p.date)}</td>
                  <td>
                    <strong>{money(p.amount)}</strong>
                  </td>
                  <td>
                    {p.method === 'Bank transfer' ? 'Bank' : p.method}
                    {p.reference && <small className="table-subtext">{p.reference}</small>}
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      aria-label={`View fee receipt ${p.receiptNumber ?? p.id}`}
                      onClick={() => setViewing(p.id)}
                    >
                      {p.receiptNumber ?? 'View receipt'}
                    </Button>
                  </td>
                  <td>
                    <Badge tone="green">Paid</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {open && <PaymentDialog enrollmentId={enrollmentId} onClose={() => setOpen(false)} />}
      {viewing && <FeeReceiptDialog paymentId={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
