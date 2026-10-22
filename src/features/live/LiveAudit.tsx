import { displayTimestamp } from '../../lib/displayFormat';
import { useCallback, useState } from 'react';
import { Button, LoadingOverlay, Panel } from '../../components/ui/Primitives';
import { schoolAccessService as api } from '../../services/schoolAccessService';
import { useRemote } from './useRemote';
const labels: Record<string, string> = {
  'school.onboarded': 'School created',
  'role.created': 'Role created',
  'role.updated': 'Role updated',
  'role.deleted': 'Role deleted',
  'membership.created': 'Member added',
  'membership.updated': 'Membership updated',
  'role.profile_grant_initialized': 'Owner profile access initialized',
};
export default function LiveAudit({ schoolId }: { schoolId: string }) {
  const [cursor, setCursor] = useState<string>();
  return (
    <AuditPage key={cursor ?? 'first'} schoolId={schoolId} cursor={cursor} setCursor={setCursor} />
  );
}
function AuditPage({
  schoolId,
  cursor,
  setCursor,
}: {
  schoolId: string;
  cursor?: string;
  setCursor: (value?: string) => void;
}) {
  const load = useCallback(
    (signal: AbortSignal) => api.audit(schoolId, signal, cursor),
    [schoolId, cursor],
  );
  const state = useRemote(load);
  return (
    <LoadingOverlay
      loading={state.loading}
      size="xl"
      label="Loading activity log…"
      message="Loading activity log…"
    >
      <Panel
        title="School activity"
        subtitle="Recorded access changes, ordered oldest first."
        action={
          <Button variant="secondary" onClick={state.reload} disabled={state.loading}>
            Refresh activity
          </Button>
        }
      >
        <div className="live-content">
          {state.error && (
            <p role="alert">
              {state.error}{' '}
              <Button variant="secondary" onClick={state.reload}>
                Retry activity
              </Button>
            </p>
          )}
          {!state.error && (
            <>
              <div className="live-table-wrap">
                <table className="live-table">
                  <caption className="sr-only">School audit events</caption>
                  <thead>
                    <tr>
                      <th scope="col">Activity</th>
                      <th scope="col">When</th>
                      <th scope="col">Actor</th>
                      <th scope="col">Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(state.data?.items ?? []).map((event) => (
                      <tr key={event.id}>
                        <th scope="row">{labels[event.action] ?? event.action}</th>
                        <td>
                          <time dateTime={event.createdAt}>
                            {displayTimestamp(event.createdAt)}
                          </time>
                        </td>
                        <td>
                          {event.actorType === 'operator'
                            ? 'Platform administrator'
                            : 'School account'}
                        </td>
                        <td>
                          <details>
                            <summary>Event details</summary>
                            <dl>
                              <dt>Actor ID</dt>
                              <dd>{event.actorUserId ?? 'Platform administrator'}</dd>
                              <dt>Record ID</dt>
                              <dd>{event.targetId ?? '—'}</dd>
                              <dt>Support request ID</dt>
                              <dd>{event.requestId}</dd>
                            </dl>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {state.data && state.data.items.length === 0 && <p>No recorded activity.</p>}
              {state.data && (
                <div className="live-actions">
                  {cursor && (
                    <Button variant="secondary" onClick={() => setCursor(undefined)}>
                      First page
                    </Button>
                  )}
                  {state.data.nextCursor && (
                    <Button variant="secondary" onClick={() => setCursor(state.data!.nextCursor!)}>
                      Next activity
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </Panel>
    </LoadingOverlay>
  );
}
