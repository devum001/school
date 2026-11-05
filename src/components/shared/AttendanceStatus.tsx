import './attendance-status.css';
import { Badge } from '../ui/Primitives';
import { titleCase } from '../../lib/displayFormat';
export default function AttendanceStatus({ status = 'unmarked' }: { status?: string }) {
  if (status === 'late' || status === 'half-day')
    return (
      <span className="attendance-status-pair">
        <Badge tone="green">● Present</Badge>
        <Badge tone={status === 'half-day' ? 'purple' : 'amber'}>
          {status === 'half-day' ? 'Half Day' : 'Late'}
        </Badge>
      </span>
    );
  const tone =
    status === 'present'
      ? 'green'
      : ['absent', 'invalid'].includes(status)
        ? 'red'
        : ['late', 'half-day'].includes(status)
          ? 'amber'
          : 'neutral';
  return (
    <Badge tone={tone}>
      <span aria-hidden="true">● </span>
      {titleCase(status.replaceAll('-', ' '))}
    </Badge>
  );
}
