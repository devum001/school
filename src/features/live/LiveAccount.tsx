import { displayTimestamp } from '../../lib/displayFormat';
import { useState } from 'react';
import { Button, Modal, Panel } from '../../components/ui/Primitives';
import { useSession } from '../auth/useSession';
import { sessionStore } from '../auth/sessionStore';
import { accessError } from '../../services/schoolAccessService';
export default function LiveAccount() {
  const { session } = useSession();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!session) return null;
  return (
    <Panel title="Your account">
      <div className="live-content">
        <dl className="live-account">
          <dt>Name</dt>
          <dd>{session.user.name}</dd>
          <dt>Email</dt>
          <dd>{session.user.email}</dd>
          <dt>Current session expires</dt>
          <dd>{displayTimestamp(session.expiresAt)}</dd>
        </dl>
        <p>Contact your platform administrator for account setup or credential changes.</p>
        <Button variant="danger" onClick={() => setConfirm(true)}>
          Sign out all devices
        </Button>
      </div>
      <Modal
        open={confirm}
        onClose={() => {
          if (!busy) setConfirm(false);
        }}
        title="Sign out all devices?"
        description="This revokes every session for your account, including this browser."
      >
        <div className="live-content">
          {error && <p role="alert">{error} You are still signed in; retry.</p>}
          <div className="live-actions">
            <Button variant="secondary" disabled={busy} onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await sessionStore.logout(true);
                } catch (cause) {
                  setError(accessError(cause));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Signing out…' : 'Confirm sign out everywhere'}
            </Button>
          </div>
        </div>
      </Modal>
    </Panel>
  );
}
