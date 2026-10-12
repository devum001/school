import { useToday } from '../../app/useToday';
import { useState } from 'react';
import { Receipt, Wallet, Clock3 } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { Badge, Button, Panel, StatCard } from '../../components/ui/Primitives';
import { feeSummary, installments } from '../../lib/selectors';
import { displayDate, money } from '../../lib/config';
import PaymentDialog from './PaymentDialog';
export function StudentFees({ enrollmentId }: { enrollmentId: string }) {
  const state = useSchool();
  const today = useToday();
  const summary = feeSummary(state, enrollmentId);
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="stats-grid three">
        <StatCard
          label="Annual obligation"
          value={money(summary.total)}
          detail="After scholarship adjustments"
          icon={<Receipt size={18} />}
        />
        <StatCard
          label="Payments recorded"
          value={money(summary.paid)}
          detail={`${summary.payments.length} recorded transactions`}
          icon={<Wallet size={18} />}
          tone="green"
        />
        <StatCard
          label="Outstanding"
          value={money(summary.outstanding)}
          detail="Includes future installments"
          icon={<Clock3 size={18} />}
          tone="amber"
        />
      </div>
      <Panel
        title="Installment schedule"
        subtitle="Payments are allocated to the earliest installment first."
        action={
          <Button disabled={!summary.outstanding} onClick={() => setOpen(true)}>
            Record payment
          </Button>
        }
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Installment</th>
                <th>Due date</th>
                <th>Net amount</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {installments(state, enrollmentId).map((o) => (
                <tr key={o.id}>
                  <td>
                    {o.label}
                    {o.adjustment !== 0 && (
                      <small className="table-subtext">
                        Scholarship adjustment: {money(o.adjustment)}
                      </small>
                    )}
                  </td>
                  <td>{displayDate(o.dueDate)}</td>
                  <td>{money(o.net)}</td>
                  <td>{money(o.paid)}</td>
                  <td>{money(o.outstanding)}</td>
                  <td>
                    <Badge
                      tone={!o.outstanding ? 'green' : o.dueDate < today ? 'amber' : 'neutral'}
                    >
                      {!o.outstanding ? 'Paid' : o.dueDate < today ? 'Due' : 'Upcoming'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Payment history" subtitle="Transaction records for the academic year">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Date</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {[...summary.payments].reverse().map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.reference}</td>
                  <td>{displayDate(p.date)}</td>
                  <td>{p.method}</td>
                  <td>
                    <strong>{money(p.amount)}</strong>
                  </td>
                  <td>
                    <Badge tone="green">Recorded</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {open && <PaymentDialog enrollmentId={enrollmentId} onClose={() => setOpen(false)} />}
    </>
  );
}
