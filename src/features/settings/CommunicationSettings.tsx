import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { Button, Modal, Panel } from '../../components/ui/Primitives';
import { communicationError, communicationFor } from '../../lib/communication';
import { ACTIVE_EVENTS } from '../../lib/communicationConfig';
import { repository } from '../../lib/repository';
import type {
  CommunicationEvent,
  CommunicationSettings as Settings,
} from '../../types/communication';
import { useDraftGuard } from '../academics/useDraftGuard';
import '../notifications/communication.css';

export default function CommunicationSettings() {
  const state = useSchool(),
    notify = useFeedback(),
    settings = communicationFor(state).settings;
  const [editing, setEditing] = useState<CommunicationEvent | null>(null),
    [error, setError] = useState('');
  const save = (next: Settings) => {
    try {
      repository.saveCommunicationSettings(next);
      notify('Communication settings saved.');
      setError('');
    } catch (cause) {
      setError(communicationError(cause));
    }
  };
  return (
    <div className="communication-settings">
      <Panel
        title="Channels"
        subtitle="Choose the channels available to your school."
        action={
          <Link className="text-link" to="/notifications">
            Open notifications
          </Link>
        }
      >
        <div className="communication-channels">
          {settings.channels.map((channel) => (
            <div key={channel.name}>
              <div>
                <strong>{channel.name}</strong>
                <p>
                  {channel.enabled
                    ? channel.name === 'WhatsApp'
                      ? 'Demo connected'
                      : 'Active in demo'
                    : 'Disabled'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-label={`${channel.name} channel`}
                aria-checked={channel.enabled}
                className={`toggle ${channel.enabled ? 'checked' : ''}`}
                onClick={() =>
                  save({
                    ...settings,
                    channels: settings.channels.map((c) =>
                      c.name === channel.name ? { ...c, enabled: !c.enabled } : c,
                    ),
                  })
                }
              >
                <span />
              </button>
            </div>
          ))}
        </div>
      </Panel>
      <Panel
        title="Message Templates"
        subtitle="Write default messages in your preferred language."
      >
        <ul className="communication-template-list">
          {ACTIVE_EVENTS.map((event) => (
            <li key={event}>
              <div>
                <strong>{event}</strong>
                <p>{settings.templates[event]}</p>
              </div>
              <Button
                variant="ghost"
                aria-label={`Edit ${event} template`}
                onClick={() => setEditing(event)}
              >
                <Pencil size={15} />
                Edit
              </Button>
            </li>
          ))}
        </ul>
      </Panel>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {editing && (
        <TemplateEditor
          key={editing}
          event={editing}
          settings={settings}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
function TemplateEditor({
  event,
  settings,
  onClose,
}: {
  event: CommunicationEvent;
  settings: Settings;
  onClose: () => void;
}) {
  const notify = useFeedback();
  const [template, setTemplate] = useState(settings.templates[event]),
    [error, setError] = useState('');
  const guard = useDraftGuard(template !== settings.templates[event], onClose);
  return (
    <Modal
      open
      onClose={guard.confirming ? guard.keepEditing : guard.requestClose}
      title={guard.confirming ? 'Discard communication changes?' : event}
      description="Edit the default message in your preferred language."
    >
      <div className="communication-drawer-form">
        {guard.confirming ? (
          <div className="modal-actions">
            <Button variant="secondary" onClick={guard.keepEditing}>
              Keep editing
            </Button>
            <Button variant="danger" onClick={guard.discard}>
              Discard changes
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                repository.saveCommunicationSettings({
                  ...settings,
                  templates: { ...settings.templates, [event]: template },
                });
                notify('Communication settings saved.');
                onClose();
              } catch (cause) {
                setError(communicationError(cause));
              }
            }}
          >
            <label className="field">
              Message Template
              <textarea
                aria-label="Message Template"
                required
                rows={6}
                maxLength={2000}
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <Button type="button" variant="secondary" onClick={guard.requestClose}>
                Cancel
              </Button>
              <Button type="submit">Save template</Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
