import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { Badge, Button, EmptyState, Modal, Panel } from '../../components/ui/Primitives';
import { communicationError, communicationFor } from '../../lib/communication';
import { CHANNELS, ACTIVE_EVENTS } from '../../lib/communicationConfig';
import { repository } from '../../lib/repository';
import { getSchoolDate } from '../../lib/dates';
import { recipientLabel } from '../../lib/communicationRecipients';
import type { CommunicationRecord } from '../../types/communication';

export default function CommunicationHistory() {
  const state = useSchool(),
    notify = useFeedback(),
    [params, setParams] = useSearchParams();
  const [viewing, setViewing] = useState<CommunicationRecord | null>(null),
    [error, setError] = useState(''),
    [page, setPage] = useState(1);
  const update = (key: string, value: string) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  const records = communicationFor(state)
    .records.filter(
      (r) =>
        r.schoolId === state.school.id &&
        r.status !== 'Pending' &&
        (!params.get('historyType') || r.event === params.get('historyType')) &&
        (!params.get('historyDate') ||
          getSchoolDate(new Date(r.sentAt ?? r.createdAt)) === params.get('historyDate')) &&
        (!params.get('historyClass') || r.recipient.classId === params.get('historyClass')) &&
        (!params.get('historyChannel') || r.channel === params.get('historyChannel')) &&
        (!params.get('historyStatus') || r.status === params.get('historyStatus')),
    )
    .sort((a, b) => (b.sentAt ?? b.createdAt).localeCompare(a.sentAt ?? a.createdAt));
  const pages = Math.max(1, Math.ceil(records.length / 20)),
    currentPage = Math.min(page, pages);
  const visible = records.slice((currentPage - 1) * 20, currentPage * 20);
  const act = (record: CommunicationRecord, cancel = false) => {
    try {
      if (cancel) repository.cancelScheduledNotice(record.id);
      else repository.dispatchCommunication([record.id]);
      notify(cancel ? 'Scheduled notice cancelled.' : 'Demo retry complete.');
      setError('');
    } catch (cause) {
      setError(communicationError(cause));
    }
  };
  return (
    <Panel
      title="Notification History"
      subtitle="Sent, failed and scheduled notices. All delivery statuses are from the demo."
    >
      <div className="communication-filters">
        <label>
          Type
          <select
            aria-label="Type"
            value={params.get('historyType') ?? ''}
            onChange={(e) => update('historyType', e.target.value)}
          >
            <option value="">All types</option>
            {ACTIVE_EVENTS.map((event) => (
              <option key={event}>{event}</option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input
            type="date"
            value={params.get('historyDate') ?? ''}
            onChange={(e) => update('historyDate', e.target.value)}
          />
        </label>
        <label>
          Class
          <select
            aria-label="Class"
            value={params.get('historyClass') ?? ''}
            onChange={(e) => update('historyClass', e.target.value)}
          >
            <option value="">All classes</option>
            {state.classes
              .filter((c) => c.schoolId === state.school.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Channel
          <select
            aria-label="Channel"
            value={params.get('historyChannel') ?? ''}
            onChange={(e) => update('historyChannel', e.target.value)}
          >
            <option value="">All channels</option>
            {CHANNELS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            aria-label="Status"
            value={params.get('historyStatus') ?? ''}
            onChange={(e) => update('historyStatus', e.target.value)}
          >
            <option value="">All statuses</option>
            {['Delivered', 'Failed', 'Scheduled', 'Cancelled'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <Button
          variant="ghost"
          onClick={() =>
            setParams((previous) => {
              const next = new URLSearchParams(previous);
              for (const key of [
                'historyType',
                'historyDate',
                'historyClass',
                'historyChannel',
                'historyStatus',
              ])
                next.delete(key);
              return next;
            })
          }
        >
          Clear filters
        </Button>
      </div>
      {records.length ? (
        <div className="table-wrap" role="region" aria-label="Notification history" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th scope="col">Date & time</th>
                <th scope="col">Notification</th>
                <th scope="col">Recipient</th>
                <th scope="col">Channel</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((record) => (
                <tr key={record.id}>
                  <td>
                    {new Date(record.sentAt ?? record.createdAt).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td>
                    {record.event}
                    <small className="communication-cell-note">{record.title}</small>
                  </td>
                  <td>
                    {record.recipient.studentId &&
                    state.students.some((s) => s.id === record.recipient.studentId) ? (
                      <Link className="text-link" to={`/students/${record.recipient.studentId}`}>
                        {record.recipient.studentName} → {recipientLabel(record.recipient)}
                      </Link>
                    ) : (
                      `${record.recipient.studentName || record.recipient.name} → ${recipientLabel(record.recipient)}`
                    )}
                    <small className="communication-cell-note">
                      {record.recipient.className} {record.recipient.sectionName}
                    </small>
                  </td>
                  <td>{record.channel}</td>
                  <td>
                    <Badge
                      tone={
                        record.status === 'Delivered'
                          ? 'green'
                          : record.status === 'Failed'
                            ? 'red'
                            : 'amber'
                      }
                    >
                      {record.status}
                    </Badge>
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      aria-label={`View message ${record.id}`}
                      onClick={() => setViewing(record)}
                    >
                      View
                    </Button>
                    {record.status === 'Failed' && (
                      <Button
                        variant="ghost"
                        aria-label={`Retry notification ${record.id}`}
                        onClick={() => act(record)}
                      >
                        Retry
                      </Button>
                    )}
                    {record.status === 'Scheduled' && (
                      <Button
                        variant="ghost"
                        aria-label={`Cancel schedule ${record.id}`}
                        onClick={() => setViewing(record)}
                      >
                        Cancel schedule
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No matching history"
          description="Try other filters or send your first notice."
        />
      )}
      {records.length > 20 && (
        <div className="communication-pagination">
          <Button
            variant="ghost"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </Button>
          <span>
            Page {currentPage} of {pages} · {records.length} records
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
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.title ?? 'Notification'}
        description={`${viewing?.channel ?? ''} · ${viewing?.status ?? ''}`}
      >
        <div className="communication-message-preview">
          <strong>
            {viewing?.recipient.studentName || viewing?.recipient.name} →{' '}
            {viewing && recipientLabel(viewing.recipient)}
          </strong>
          <p>{viewing?.message}</p>
        </div>
        <p className="communication-note">
          {viewing?.reason}
          {viewing?.scheduledAt &&
            ` Scheduled for ${new Date(viewing.scheduledAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.`}
        </p>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setViewing(null)}>
            Close
          </Button>
          {viewing?.status === 'Scheduled' && (
            <Button
              variant="danger"
              onClick={() => {
                act(viewing, true);
                setViewing(null);
              }}
            >
              Confirm cancellation
            </Button>
          )}
        </div>
      </Modal>
    </Panel>
  );
}
