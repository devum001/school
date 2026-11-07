import './attendance-status.css';
import { Badge } from '../ui/Primitives';
import { titleCase } from '../../lib/displayFormat';

export default function AttendanceStatus({ status = 'unmarked' }: { status?: string }) {
  if (status === 'late' || status === 'half-day') {
    return (
      <span className="attendance-status-pair">
        <Badge tone="green">● Present</Badge>
        <Badge tone={status === 'half-day' ? 'purple' : 'amber'}>
          {status === 'half-day' ? 'Half Day' : 'Late'}
        </Badge>
      </span>
    );
  }
  if (status === 'present') {
    return <Badge tone="green">● Present</Badge>;
  }
  if (status === 'absent') {
    return <Badge tone="red">● Absent</Badge>;
  }
  if (status === 'leave') {
    return <Badge tone="blue">● On Leave</Badge>;
  }
  if (status === 'off') {
    return <Badge tone="neutral">● Weekly Off</Badge>;
  }
  if (status === 'holiday') {
    return <Badge tone="amber">● Holiday</Badge>;
  }
  if (status === 'unmarked' || status === 'pending') {
    return <Badge tone="neutral">● Not Marked</Badge>;
  }
  const tone = status === 'invalid' ? 'red' : 'neutral';
  return (
    <Badge tone={tone}>
      <span aria-hidden="true">● </span>
      {titleCase(status.replaceAll('-', ' '))}
    </Badge>
  );
}
