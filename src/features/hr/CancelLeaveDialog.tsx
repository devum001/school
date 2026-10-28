import { HrForm } from './HrForms';
import { formatCalendarDate } from '../../lib/displayFormat';
import type { HrAdapter, HrWorkspace } from '../../services/hrService';

export default function CancelLeaveDialog({
  leave,
  adapter,
  close,
  saved,
}: {
  leave: HrWorkspace['leaves'][number];
  adapter: HrAdapter;
  close: () => void;
  saved: () => void;
}) {
  return (
    <HrForm
      title="Cancel leave request?"
      description={`${formatCalendarDate(leave.start)} – ${formatCalendarDate(leave.end)} · Pending approval`}
      submitLabel="Cancel leave request"
      close={close}
      submit={async () => {
        await adapter.save(`/leave/${leave.id}/cancel`, { revision: leave.revision });
        saved();
      }}
    >
      <p>{leave.reason}</p>
      <p>
        This cancels the entire pending request for these dates. You can submit a new request if
        your plans change.
      </p>
    </HrForm>
  );
}
