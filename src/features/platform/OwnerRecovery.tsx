import { useState } from 'react';
import { Button, Modal } from '../../components/ui/Primitives';
import { platformService, type PlatformSchool } from '../../services/platformService';
import { useDraftGuard } from '../academics/useDraftGuard';
export default function OwnerRecovery({
  school,
  close,
  saved,
}: {
  school: PlatformSchool;
  close: () => void;
  saved: () => void;
}) {
  const [email, setEmail] = useState(''),
    [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const guard = useDraftGuard(!!(email || reason) && !busy, close);
  return (
    <Modal
      open
      title="Recover school owner"
      description={`${school.name}: recovery is available only when no usable owner remains. School status is unchanged.`}
      onClose={() => {
        if (!busy) guard.requestClose();
      }}
    >
      {guard.confirming ? (
        <div className="live-content">
          <p>Discard this recovery request?</p>
          <Button onClick={guard.keepEditing}>Keep editing</Button>
          <Button variant="danger" onClick={guard.discard}>
            Discard
          </Button>
        </div>
      ) : (
        <form
          className="live-form"
          data-unsaved={!!(email || reason)}
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            setError('');
            if (reason.trim().length < 10) {
              setError('Explain the recovery reason in at least 10 characters.');
              return;
            }
            setBusy(true);
            try {
              const result = await platformService.users(
                undefined,
                undefined,
                email.trim().toLowerCase(),
              );
              const account = result.items.find(
                (user) => user.email === email.trim().toLowerCase() && user.status === 'active',
              );
              if (!account) throw new Error('Choose an existing active account.');
              await platformService.recoverOwner(school.id, account.id, reason.trim());
              guard.complete(() => {
                saved();
                close();
              });
            } catch (cause) {
              setError(
                cause instanceof Error ? cause.message : 'Recovery failed. Refresh and retry.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>
            This grants the selected account the built-in Owner role. Both school and platform audit
            logs record the recovery reason. Confirm the account with the school before proceeding.
          </p>
          <label>
            New owner email
            <input
              type="email"
              required
              value={email}
              disabled={busy}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Recovery reason
            <textarea
              required
              minLength={10}
              maxLength={240}
              value={reason}
              disabled={busy}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="live-actions">
            <Button type="button" variant="secondary" disabled={busy} onClick={guard.requestClose}>
              Cancel
            </Button>
            <Button disabled={busy}>{busy ? 'Recovering…' : 'Confirm owner recovery'}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
