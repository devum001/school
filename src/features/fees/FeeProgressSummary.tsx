import { useSchool } from '../../app/useSchool';
import { feeProgress } from '../../lib/feeProgress';
import { money, displayDate } from '../../lib/config';
import './fee-progress.css';
export default function FeeProgressSummary({ enrollmentId }: { enrollmentId: string }) {
  const progress = feeProgress(useSchool(), enrollmentId);
  return (
    <section className="fee-progress-summary" aria-label="Fee plan summary">
      <dl>
        <div>
          <dt>Total fee</dt>
          <dd>{money(progress.total)}</dd>
        </div>
        <div>
          <dt>Total paid</dt>
          <dd>{money(progress.paid)}</dd>
        </div>
        <div>
          <dt>Remaining amount</dt>
          <dd>{money(progress.outstanding)}</dd>
        </div>
      </dl>
      <p>
        {!progress.count
          ? 'Fee plan not configured'
          : progress.kind === 'One Time'
            ? 'One Time fee'
            : `${progress.count} installments · ${progress.completed} paid · ${progress.remaining} remaining${progress.partial ? ` (${progress.partial} part paid)` : ''}`}
      </p>
      {progress.next && (
        <p className="fee-next-due">
          Next: {progress.next.label} · {money(progress.next.outstanding)} remaining · Due{' '}
          {displayDate(progress.next.dueDate)}
        </p>
      )}
    </section>
  );
}
