import { useState } from 'react';
import { Clock } from 'lucide-react';
import { Button, Badge } from '../../components/ui/Primitives';
import SectionNavigation from '../../components/shared/SectionNavigation';
import { HrForm, TextField } from './HrForms';
import type { AttendanceRequest } from '../../services/attendanceTypes';
import type { HrAdapter, HrStaff } from '../../services/hrService';
import { formatCalendarDate, titleCase } from '../../lib/displayFormat';
import './staff-attendance.css';
const outcome = (r: AttendanceRequest) =>
  titleCase(r.requestedPeriod ?? (r.requestedStatus === 'present' ? 'Full day' : 'First half'));
export default function AttendanceRequests({
  requests,
  staff = [],
  self,
  adapter,
  saved,
}: {
  requests: AttendanceRequest[];
  staff?: HrStaff[];
  self: boolean;
  adapter: HrAdapter;
  saved: () => void;
  today?: string;
}) {
  const [review, setReview] = useState<AttendanceRequest>();
  const [tab, setTab] = useState('pending');
  const pending = requests.filter((r) => r.status === 'pending').length;
  const sorted = [...requests]
    .filter((r) => (tab === 'pending' ? r.status === 'pending' : r.status !== 'pending'))
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  return (
    <section className="attendance-requests" aria-label="Attendance requests">
      {!self && (
        <div className="attendance-requests-heading">
          <div>
            <h3>Attendance requests (ARS)</h3>
            <p>
              Review the requested attendance period. Approval updates the day and its working
              hours.
            </p>
          </div>
          <Button variant="secondary" onClick={saved}>
            Refresh requests
          </Button>
        </div>
      )}
      <SectionNavigation
        variant="secondary"
        label="ARS history"
        items={[
          { id: 'pending', label: `Pending (${pending})` },
          { id: 'past', label: 'Past requests' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {!sorted.length ? (
        <div className="hr-empty-box">
          <Clock size={36} className="hr-empty-icon" />
          <p className="hr-empty-title">
            {tab === 'pending'
              ? 'No pending attendance requests'
              : 'No past requests in the selected month'}
          </p>
          <span className="hr-empty-desc">
            {tab === 'pending'
              ? 'Select any half-day or marked date in your attendance calendar to request a punch adjustment.'
              : 'Decided attendance requests will appear here.'}
          </span>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="attendance-requests-table">
            <thead>
              <tr>
                {!self && <th>Staff</th>}
                <th>Date / request</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={`${r.dayId}:${r.requestKey}`}>
                  {!self && (
                    <td data-label="Staff">
                      {staff.find((s) => s.id === r.staffId)?.name ?? 'Staff member'}
                    </td>
                  )}
                  <td data-label="Date / request">
                    <strong>{formatCalendarDate(r.date)}</strong>
                    <small className="attendance-request-sub">{outcome(r)}</small>
                  </td>
                  <td data-label="Reason" className="request-reason">
                    {r.reason || '—'}
                  </td>
                  <td data-label="Status">
                    <Badge
                      tone={
                        r.status === 'approved'
                          ? 'green'
                          : r.status === 'rejected'
                            ? 'red'
                            : 'amber'
                      }
                    >
                      {titleCase(r.status)}
                    </Badge>
                  </td>
                  <td data-label="Decision">
                    {!self && r.status === 'pending' ? (
                      <Button variant="secondary" onClick={() => setReview(r)}>
                        Review request
                      </Button>
                    ) : (
                      r.reviewNote ||
                      (r.status === 'pending' ? 'Awaiting administrator' : 'No comment')
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {review && (
        <ReviewDialog
          key={review.requestKey}
          item={review}
          adapter={adapter}
          close={() => setReview(undefined)}
          saved={saved}
        />
      )}
    </section>
  );
}
function ReviewDialog({
  item,
  adapter,
  close,
  saved,
}: {
  item: AttendanceRequest;
  adapter: HrAdapter;
  close: () => void;
  saved: () => void;
}) {
  const [status, setStatus] = useState('approved'),
    [reviewNote, setNote] = useState('');
  return (
    <HrForm
      title="Review attendance request"
      description={`${formatCalendarDate(item.date)} · ${outcome(item)}`}
      submitLabel="Save decision"
      close={close}
      submit={async () => {
        await adapter.save(
          `/attendance-requests/${item.dayId}`,
          { revision: item.revision, requestKey: item.requestKey, status, reviewNote },
          'PUT',
        );
        saved();
      }}
    >
      <div className="ars-review-summary">
        <span>Requested attendance</span>
        <strong>{outcome(item)}</strong>
        <p>{item.reason}</p>
      </div>
      <label className="field">
        Decision
        <select aria-label="Decision" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="approved">Approve</option>
          <option value="rejected">Reject</option>
        </select>
      </label>
      <TextField
        required={false}
        label="Decision comment (optional)"
        value={reviewNote}
        onChange={setNote}
      />
      <p className="ars-form-note">
        {status === 'approved'
          ? 'Approved hours follow the school schedule: full day, the first half, or the second half. The accepted status replaces the earlier late or invalid result.'
          : 'Rejecting this request keeps the existing attendance status. The teacher can submit another request if needed.'}
      </p>
    </HrForm>
  );
}
