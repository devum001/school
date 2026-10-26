import { displayTimestamp } from '../../lib/displayFormat';
import { useState } from 'react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { PickerInput, Badge, Button, Modal, Panel } from '../../components/ui/Primitives';
import { communicationError, communicationFor, previewNotice } from '../../lib/communication';
import { ACTIVE_EVENTS, SYSTEM_EVENTS } from '../../lib/communicationConfig';
import { roster } from '../../lib/selectors';
import { staffDirectory, staffLabel } from '../../lib/staffStructure';
import { defaultStaffPayroll } from '../../lib/settings';
import { recipientLabel } from '../../lib/communicationRecipients';
import { repository } from '../../lib/repository';
import { useDraftGuard } from '../academics/useDraftGuard';
import type {
  CommunicationEvent,
  NoticeAudience,
  NoticeInput,
  RecipientRole,
} from '../../types/communication';

const audiences: NoticeAudience['kind'][] = [
  'All School',
  'Class',
  'Section',
  'Selected Students',
  'Teachers',
  'Staff',
];
export default function SendNotice({
  initialEvent,
  onSent,
}: {
  initialEvent?: CommunicationEvent;
  onSent: () => void;
}) {
  const state = useSchool(),
    notify = useFeedback(),
    settings = communicationFor(state).settings;
  const [initial] = useState<NoticeInput>(() => {
    const event = initialEvent === 'Event / Announcement' ? initialEvent : 'Compose Notice';
    const rule = settings.rules.find((r) => r.event === event);
    return {
      event,
      title: event,
      audience: { kind: 'All School', classIds: [], sectionIds: [], studentIds: [] },
      recipients: ['Student'],
      channels: rule?.channels.filter((channel) =>
        settings.channels.some((c) => c.name === channel && c.enabled),
      ) ?? ['In-app'],
      message: settings.templates[event],
    };
  });
  const [draft, setDraft] = useState(initial),
    [delivery, setDelivery] = useState('Send now'),
    [schedule, setSchedule] = useState(''),
    [query, setQuery] = useState(''),
    [error, setError] = useState(''),
    [review, setReview] = useState<ReturnType<typeof previewNotice> | null>(null),
    [complete, setComplete] = useState(false);
  const guard = useDraftGuard(
    !complete &&
      (JSON.stringify(draft) !== JSON.stringify(initial) || delivery !== 'Send now' || !!schedule),
    () => setDraft(initial),
  );
  const availableRoles: RecipientRole[] =
    draft.audience.kind === 'Teachers'
      ? ['Teacher']
      : draft.audience.kind === 'Staff'
        ? ['Staff']
        : draft.audience.kind === 'All School'
          ? ['Student', 'Teacher', 'Staff']
          : ['Student'];
  const students = roster(state).filter((r) =>
    r.student.name.toLowerCase().includes(query.toLowerCase()),
  );
  const setScope = (kind: NoticeAudience['kind']) => {
    setQuery('');
    setDraft({
      ...draft,
      audience: { kind, classIds: [], sectionIds: [], studentIds: [] },
      recipients: kind === 'Teachers' ? ['Teacher'] : kind === 'Staff' ? ['Staff'] : ['Student'],
      channels: ['Teachers', 'Staff'].includes(kind)
        ? draft.channels
        : draft.channels.filter((channel) => channel !== 'In-app'),
    });
  };
  const members = staffDirectory(state, state.staffPayroll ?? defaultStaffPayroll).filter(
    (member) =>
      member.status === 'active' && (draft.audience.kind !== 'Teachers' || !!member.teacherId),
  );
  const toggleAudienceId = (
    key: 'classIds' | 'sectionIds' | 'studentIds' | 'memberIds',
    id: string,
    checked: boolean,
  ) =>
    setDraft({
      ...draft,
      audience: {
        ...draft.audience,
        [key]: checked
          ? [...(draft.audience[key] ?? []), id]
          : (draft.audience[key] ?? []).filter((value) => value !== id),
      },
    });
  return (
    <Panel
      title="Create Notice"
      subtitle="Choose an audience, write your notice, then preview delivery."
    >
      <form
        className="communication-compose"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const input = {
              ...draft,
              scheduledAt: delivery === 'Schedule' ? `${schedule}:00+05:30` : undefined,
            };
            setReview(previewNotice(state, input));
            setError('');
          } catch (cause) {
            setError(communicationError(cause));
          }
        }}
      >
        <div className="form-grid">
          <label className="field">
            Type
            <select
              aria-label="Type"
              value={draft.event}
              onChange={(e) => {
                const event = ACTIVE_EVENTS.find((value) => value === e.target.value)!;
                setDraft({
                  ...draft,
                  event,
                  title: event,
                  message: settings.templates[event],
                });
              }}
            >
              {ACTIVE_EVENTS.filter((event) => !SYSTEM_EVENTS.includes(event)).map((event) => (
                <option key={event}>{event}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Notice title
            <input
              required
              minLength={2}
              maxLength={100}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <label className="field">
            Audience
            <select
              aria-label="Audience"
              value={draft.audience.kind}
              onChange={(e) => {
                const kind = audiences.find((value) => value === e.target.value);
                if (kind) setScope(kind);
              }}
            >
              {audiences.map((kind) => (
                <option key={kind}>{kind}</option>
              ))}
            </select>
          </label>
        </div>
        {draft.audience.kind === 'Class' && (
          <fieldset className="communication-checks">
            <legend>Choose classes</legend>
            {state.classes
              .filter((c) => c.schoolId === state.school.id)
              .map((c) => (
                <label key={c.id}>
                  <input
                    type="checkbox"
                    checked={draft.audience.classIds.includes(c.id)}
                    onChange={(e) => toggleAudienceId('classIds', c.id, e.target.checked)}
                  />
                  {c.name}
                </label>
              ))}
          </fieldset>
        )}
        {draft.audience.kind === 'Section' && (
          <fieldset className="communication-checks">
            <legend>Choose sections</legend>
            {state.sections
              .filter((s) => s.schoolId === state.school.id)
              .map((s) => (
                <label key={s.id}>
                  <input
                    type="checkbox"
                    checked={draft.audience.sectionIds.includes(s.id)}
                    onChange={(e) => toggleAudienceId('sectionIds', s.id, e.target.checked)}
                  />
                  {state.classes.find((c) => c.id === s.classId)?.name} · {s.name}
                </label>
              ))}
          </fieldset>
        )}
        {draft.audience.kind === 'Selected Students' && (
          <fieldset className="communication-students">
            <legend>Choose students</legend>
            <label className="field">
              Search students
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <div className="communication-student-options">
              {students.map((row) => (
                <label key={row.enrollment.id}>
                  <input
                    type="checkbox"
                    checked={draft.audience.studentIds.includes(row.enrollment.id)}
                    onChange={(e) =>
                      toggleAudienceId('studentIds', row.enrollment.id, e.target.checked)
                    }
                  />
                  {row.student.name} · {row.className} {row.sectionName}
                </label>
              ))}
            </div>
            <p>{draft.audience.studentIds.length} selected</p>
          </fieldset>
        )}
        {['Teachers', 'Staff'].includes(draft.audience.kind) && (
          <fieldset className="communication-students">
            <legend>Choose {draft.audience.kind.toLowerCase()}</legend>
            <label className="field">
              Selection
              <select
                aria-label="Selection"
                value={draft.audience.memberSelection ?? 'All'}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    audience: {
                      ...draft.audience,
                      memberSelection: e.target.value === 'Selected' ? 'Selected' : 'All',
                      memberIds: [],
                    },
                  })
                }
              >
                <option value="All">All {draft.audience.kind.toLowerCase()}</option>
                <option value="Selected">Selected {draft.audience.kind.toLowerCase()}</option>
              </select>
            </label>
            {draft.audience.memberSelection === 'Selected' && (
              <>
                <label className="field">
                  Search members
                  <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
                </label>
                <div className="communication-student-options">
                  {members
                    .filter((member) => member.name.toLowerCase().includes(query.toLowerCase()))
                    .map((member) => (
                      <label key={member.id}>
                        <input
                          type="checkbox"
                          checked={draft.audience.memberIds?.includes(member.id) ?? false}
                          onChange={(e) =>
                            toggleAudienceId('memberIds', member.id, e.target.checked)
                          }
                        />
                        {staffLabel(member, state.staffPayroll ?? defaultStaffPayroll)}
                      </label>
                    ))}
                </div>
                <p>{draft.audience.memberIds?.length ?? 0} selected</p>
              </>
            )}
          </fieldset>
        )}
        <fieldset className="communication-checks">
          <legend>Send To</legend>
          {availableRoles.map((role) => (
            <label key={role}>
              <input
                type="checkbox"
                checked={draft.recipients.includes(role)}
                onChange={(e) => {
                  const recipients = e.target.checked
                    ? [...draft.recipients, role]
                    : draft.recipients.filter((value) => value !== role);
                  setDraft({
                    ...draft,
                    recipients,
                    channels: recipients.some((recipient) =>
                      ['Teacher', 'Staff'].includes(recipient),
                    )
                      ? draft.channels
                      : draft.channels.filter((channel) => channel !== 'In-app'),
                  });
                }}
              />
              {role === 'Student' ? 'Students' : role === 'Staff' ? 'Staff' : 'Teachers'}
            </label>
          ))}
        </fieldset>
        <fieldset className="communication-checks">
          <legend>Channel</legend>
          {settings.channels.map((channel) => (
            <label key={channel.name}>
              <input
                type="checkbox"
                aria-label={channel.name}
                disabled={
                  !channel.enabled ||
                  (channel.name === 'In-app' &&
                    !draft.recipients.some((role) => ['Teacher', 'Staff'].includes(role)))
                }
                checked={draft.channels.includes(channel.name)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    channels: e.target.checked
                      ? [...draft.channels, channel.name]
                      : draft.channels.filter((value) => value !== channel.name),
                  })
                }
              />
              {channel.name}
              {channel.name === 'In-app' && ' · Staff only'}
              {!channel.enabled && ' · Disabled'}
            </label>
          ))}
        </fieldset>
        <label className="field">
          Message
          <textarea
            aria-label="Message"
            rows={6}
            required
            maxLength={2000}
            value={draft.message}
            onChange={(e) => setDraft({ ...draft, message: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label className="field">
            Delivery
            <select
              aria-label="Delivery"
              value={delivery}
              onChange={(e) => setDelivery(e.target.value)}
            >
              <option>Send now</option>
              <option>Schedule</option>
            </select>
          </label>
          {delivery === 'Schedule' && (
            <label className="field">
              Schedule date and time
              <PickerInput
                type="datetime-local"
                required
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
              />
            </label>
          )}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button type="submit">Preview notice</Button>
        </div>
      </form>
      <Modal
        open={!!review}
        onClose={() => {
          setReview(null);
          if (complete) onSent();
        }}
        title={complete ? 'Notice saved' : 'Preview notice'}
        description={`${review?.recipients.length ?? 0} recipients · ${review?.input.channels.join(' + ') ?? ''}`}
        wide
      >
        <div className="communication-message-preview">
          <Badge>{review?.input.event}</Badge>
          <strong>{review?.input.title}</strong>
          <p>{review?.message}</p>
          <small>
            {review?.recipients
              .slice(0, 4)
              .map((r) => `${r.studentName || r.name} (${recipientLabel(r)})`)
              .join(', ')}
            {(review?.recipients.length ?? 0) > 4 && '…'}
          </small>
        </div>
        {review?.input.scheduledAt && (
          <p className="communication-note">
            Scheduled for {displayTimestamp(review.input.scheduledAt)}.
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          {complete ? (
            <Button onClick={onSent}>Open History</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setReview(null)}>
                Back to edit
              </Button>
              <Button
                onClick={() => {
                  try {
                    if (review) repository.createNotice(review.input);
                    setComplete(true);
                    notify(
                      review?.input.scheduledAt
                        ? 'Notice scheduled.'
                        : 'Notice prepared. Review History for details.',
                    );
                  } catch (cause) {
                    setError(communicationError(cause));
                  }
                }}
              >
                {review?.input.scheduledAt ? 'Confirm schedule' : 'Save notice'}
              </Button>
            </>
          )}
        </div>
      </Modal>
      <Modal
        open={guard.confirming}
        onClose={guard.keepEditing}
        title="Discard notice draft?"
        description="Your notice has not been saved."
      >
        <div className="modal-actions">
          <Button variant="secondary" onClick={guard.keepEditing}>
            Keep editing
          </Button>
          <Button variant="danger" onClick={guard.discard}>
            Discard changes
          </Button>
        </div>
      </Modal>
    </Panel>
  );
}
