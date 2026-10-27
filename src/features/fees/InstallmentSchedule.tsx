import { useSchool } from '../../app/useSchool';
import { useToday } from '../../app/useToday';
import { Badge, Button, Panel } from '../../components/ui/Primitives';
import { feeProgress } from '../../lib/feeProgress';
import { money, displayDate } from '../../lib/config';
export default function InstallmentSchedule({
  enrollmentId,
  onRecordPayment,
}: {
  enrollmentId: string;
  onRecordPayment?: () => void;
}) {
  const state = useSchool(),
    today = useToday(),
    progress = feeProgress(state, enrollmentId),
    summary = progress,
    schedule = progress.schedule;
  return (
    <Panel
      title="Installment schedule"
      subtitle={`${schedule.length} total · ${progress.completed} paid · ${progress.remaining} remaining${progress.partial ? ` (${progress.partial} part paid)` : ''}`}
      action={
        <Button
          disabled={!summary.outstanding || !onRecordPayment}
          onClick={() => onRecordPayment?.()}
        >
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
              <th className="currency-cell">Amount</th>
              <th className="currency-cell">Paid</th>
              <th className="currency-cell">Balance</th>
              <th>Status</th>
              <th>Paid Date</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((o) => (
              <tr key={o.id}>
                <td>{o.label}</td>
                <td>{displayDate(o.dueDate)}</td>
                <td className="currency-cell">{money(o.net)}</td>
                <td className="currency-cell">{money(o.paid)}</td>
                <td className="currency-cell">{money(o.outstanding)}</td>
                <td>
                  <Badge tone={!o.outstanding ? 'green' : o.dueDate < today ? 'amber' : 'neutral'}>
                    {!o.outstanding
                      ? 'Paid'
                      : o.paid
                        ? o.dueDate < today
                          ? 'Part paid · Overdue'
                          : 'Part paid'
                        : o.dueDate < today
                          ? 'Overdue'
                          : 'Pending'}
                  </Badge>
                </td>
                <td>{o.paidDate ? displayDate(o.paidDate) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
