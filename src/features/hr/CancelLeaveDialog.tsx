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
  const isApproved = leave.status === 'approved';
  return (
    <HrForm
      title={isApproved ? 'Cancel approved leave?' : 'Cancel leave request?'}
      description={`${formatCalendarDate(leave.start)} – ${formatCalendarDate(leave.end)} · ${
        isApproved ? 'Approved leave' : 'Pending approval'
      }`}
      submitLabel={isApproved ? 'Cancel leave' : 'Cancel leave request'}
      close={close}
      submit={async () => {
        await adapter.save(`/leave/${leave.id}/cancel`, { revision: leave.revision });
        saved();
      }}
    >
      <p>{leave.reason}</p>
      <p>
        {isApproved
          ? 'This cancels your approved leave for these dates and restores regular attendance and punch-in eligibility.'
          : 'This cancels the entire pending request for these dates. You can submit a new request if your plans change.'}
      </p>
    </HrForm>
  );
}
