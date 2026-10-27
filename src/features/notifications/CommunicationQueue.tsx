import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { Badge, Button, EmptyState, Modal, Panel } from '../../components/ui/Primitives';
import { repository } from '../../lib/repository';
import { displayDate, money } from '../../lib/config';
import { communicationError, communicationFor } from '../../lib/communication';
import { recipientLabel } from '../../lib/communicationRecipients';
import type { CommunicationRecord } from '../../types/communication';

export default function CommunicationQueue({
  records,
  onSent,
}: {
  records: CommunicationRecord[];
  onSent: () => void;
}) {
  const state = useSchool(),
    notify = useFeedback();
  const [selected, setSelected] = useState<string[]>([]),
    [reviewing, setReviewing] = useState(false),
    [error, setError] = useState(''),
    [page, setPage] = useState(1);
  const pending = records.filter((record) => record.status === 'Pending'),
    chosen = pending.filter((record) => selected.includes(record.id));
  const pages = Math.max(1, Math.ceil(pending.length / 20)),
    currentPage = Math.min(page, pages);
  const visible = pending.slice((currentPage - 1) * 20, currentPage * 20);
  const settings = communicationFor(state).settings;
  const feeScope = records.length > 0 && records.every((record) => !!record.installment);
  const unavailable = chosen.filter(
    (r) =>
      !settings.channels.some((c) => c.name === r.channel && c.enabled) ||
      (r.channel === 'Email'
        ? !r.recipient.email
        : ['WhatsApp', 'SMS'].includes(r.channel)
          ? !r.recipient.phone
          : false),
  ).length;
  return (
    <Panel
      title="Pending notifications"
      subtitle={`${new Set(pending.map((r) => `${r.event}:${r.recipient.enrollmentId ?? r.recipient.id}`)).size} alerts · ${pending.length} messages awaiting review`}
      action={
        <Button
          variant="ghost"
          disabled={!pending.length}
          onClick={() =>
            setSelected(chosen.length === pending.length ? [] : pending.map((r) => r.id))
          }
        >
          {pending.length && chosen.length === pending.length ? 'Deselect all' : 'Select all'}
        </Button>
      }
    >
      {pending.length ? (
        <div className="table-wrap" role="region" aria-label="Notification queue" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th scope="col">Select</th>
                <th scope="col">Recipient</th>
                <th scope="col">Notification</th>
                {feeScope && (
                  <>
                    <th scope="col">Installment</th>
                    <th scope="col" className="currency-cell">Amount</th>
                    <th scope="col">Due Date</th>
                    <th scope="col">Status</th>
                  </>
                )}
                <th scope="col">Channel</th>
                <th scope="col">Date</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((record) => (
                <tr key={record.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${record.recipient.studentName || record.recipient.name} ${recipientLabel(record.recipient)} ${record.channel} ${record.event}`}
                      checked={selected.includes(record.id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, record.id]
                            : selected.filter((id) => id !== record.id),
                        )
                      }
                    />
                  </td>
                  <td>
                    <strong>
                      {record.recipient.studentName || record.recipient.name} →{' '}
                      {recipientLabel(record.recipient)}
                    </strong>
                    <small className="communication-cell-note">
                      {record.recipient.className} {record.recipient.sectionName} ·{' '}
                      {recipientLabel(record.recipient) === 'Student'
                        ? 'Guardian contact'
                        : record.recipient.name}
                    </small>
                  </td>
                  <td>{record.event}</td>
                  {feeScope && (
                    <>
                      <td>{record.installment?.label}</td>
                      <td>{money(record.installment?.amount ?? 0)}</td>
                      <td>{record.installment ? displayDate(record.installment.dueDate) : '—'}</td>
                      <td>{record.installment?.status}</td>
                    </>
                  )}
                  <td>
                    {record.channel}
                    <small className="communication-cell-note">
                      {settings.channels.some((c) => c.name === record.channel && c.enabled)
                        ? ''
                        : 'Channel disabled'}
                    </small>
                  </td>
                  <td>{displayDate(record.date)}</td>
                  <td>
                    <Button
                      variant="ghost"
                      aria-label={`Review ${record.recipient.studentName || record.recipient.name} ${record.installment?.label ?? record.event}`}
                      onClick={() => {
                        setSelected([record.id]);
                        setReviewing(true);
                      }}
                    >
                      Review
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No pending notifications"
          description="New alerts appear here for review before sending."
        />
      )}
      {pending.length > 20 && (
        <div className="communication-pagination">
          <Button
            variant="ghost"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </Button>
          <span>
            Page {currentPage} of {pages} · {pending.length} messages
          </span>
          <Button
            variant="ghost"
            disabled={currentPage === pages}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      )}
      <div className="communication-queue-actions">
        <span>
          {chosen.length} messages selected · {unavailable} missing a contact or active channel
        </span>
        <Button disabled={!chosen.length} onClick={() => setReviewing(true)}>
          {feeScope ? 'Send Reminder' : 'Review & Send'}
        </Button>
        {feeScope && (
          <Button
            variant="secondary"
            disabled={!pending.length}
            onClick={() => {
              setSelected(pending.map((record) => record.id));
              setReviewing(true);
            }}
          >
            Send All
          </Button>
        )}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Modal
        open={reviewing}
        onClose={() => setReviewing(false)}
        title="Review notifications"
        description={`${chosen.length} messages · ${new Set(chosen.map((r) => r.recipient.id)).size} recipients. No external messages are sent.`}
        wide
      >
        {chosen[0] && (
          <div className="communication-message-preview">
            <Badge>{chosen[0].channel}</Badge>
            <strong>
              {chosen[0].recipient.studentName || chosen[0].recipient.name} →{' '}
              {chosen[0].recipient.role}
            </strong>
            <p>{chosen[0].message}</p>
            {chosen[0].installment && (
              <dl className="fee-alert-facts">
                <div>
                  <dt>Installment</dt>
                  <dd>{chosen[0].installment.label}</dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd>{money(chosen[0].installment.amount)}</dd>
                </div>
                <div>
                  <dt>Due Date</dt>
                  <dd>{displayDate(chosen[0].installment.dueDate)}</dd>
                </div>
              </dl>
            )}
          </div>
        )}
        {unavailable > 0 && (
          <p className="communication-note">
            {unavailable} messages cannot be delivered with the current contact/channel details.
            Their failed entries will appear in History.
          </p>
        )}
        <p className="communication-note">
          Check templates and channels in{' '}
          <Link to="/settings?tab=Communication">Communication Settings</Link>.
        </p>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setReviewing(false)}>
            Cancel
          </Button>
          <Button
            disabled={!chosen.length}
            onClick={() => {
              try {
                repository.dispatchCommunication(chosen.map((r) => r.id));
                setReviewing(false);
                setSelected([]);
                notify('Notifications prepared. Review History for details.');
                onSent();
              } catch (cause) {
                setError(communicationError(cause));
                setReviewing(false);
              }
            }}
          >
            Confirm
          </Button>
        </div>
      </Modal>
    </Panel>
  );
}
