import { useState } from 'react';
import { Button, Modal } from '../../components/ui/Primitives';
import { saveSchoolProfile, type SchoolProfile } from '../../services/schoolProfileService';
import { useDraftGuard } from '../academics/useDraftGuard';
import { weekdays, profileDraft, validateProfile } from './profileForm';
const groups = [
  {
    title: 'School and contact',
    fields: [
      ['name', 'School name', 160],
      ['email', 'Contact email', 254],
      ['phone', 'Contact phone', 32],
      ['address', 'Street address', 240],
      ['city', 'City / location', 100],
      ['region', 'State / region', 100],
      ['country', 'Country', 80],
      ['postalCode', 'Postal code', 20],
    ],
  },
  {
    title: 'Identity details (optional)',
    fields: [
      ['motto', 'School motto', 200],
      ['website', 'Website', 300],
      ['board', 'Board / affiliation', 120],
      ['affiliationNumber', 'Affiliation number', 80],
      ['principalName', 'Principal display name', 120],
    ],
  },
] as const;
export default function ProfileEditor({
  school,
  close,
  saved,
}: {
  school: SchoolProfile['school'];
  close: () => void;
  saved: () => void;
}) {
  const [initial] = useState(() => profileDraft(school)),
    [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false),
    [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const guard = useDraftGuard(dirty && !busy, close);
  return (
    <Modal
      open
      description="Changes are saved to this school’s live workspace."
      wide
      title={guard.confirming ? 'Discard school changes?' : 'Edit school details'}
      onClose={() => {
        if (!busy) guard.requestClose();
      }}
    >
      {guard.confirming ? (
        <div className="live-content">
          <p>Your changes have not been saved.</p>
          <Button onClick={guard.keepEditing}>Keep editing</Button>
          <Button variant="danger" onClick={guard.discard}>
            Discard changes
          </Button>
        </div>
      ) : (
        <form
          className="live-form"
          data-unsaved={dirty}
          noValidate
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            const validation = validateProfile(draft);
            setErrors(validation);
            if (Object.keys(validation).length) return;
            setBusy(true);
            try {
              await saveSchoolProfile(school.id, draft);
              guard.complete(() => {
                saved();
                close();
              });
            } catch (cause) {
              setErrors({
                form: cause instanceof Error ? cause.message : 'Unable to save school details.',
              });
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>
            School code {school.code || 'is not assigned'} and registration slug are managed by your
            platform administrator.
          </p>
          {groups.map((group) => (
            <details
              key={group.title}
              open={
                group.title === 'School and contact' || group.fields.some(([key]) => !!errors[key])
              }
            >
              <summary>{group.title}</summary>
              <fieldset disabled={busy}>
                <legend>{group.title}</legend>
                <div className="setup-grid">
                  {group.fields.map(([key, label, max]) => (
                    <label key={key}>
                      {label}
                      <input
                        required={key === 'name'}
                        type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
                        maxLength={max}
                        value={draft[key]}
                        onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                        aria-invalid={!!errors[key]}
                        aria-describedby={errors[key] ? `profile-${key}-error` : undefined}
                      />
                      {errors[key] && (
                        <span className="form-error" id={`profile-${key}-error`}>
                          {errors[key]}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
                {group.title.startsWith('Identity') && (
                  <p>The principal name is display text, not a linked staff account.</p>
                )}
              </fieldset>
            </details>
          ))}
          <fieldset disabled={busy}>
            <legend>Working hours</legend>
            <div className="setup-grid">
              <label>
                Timezone
                <input
                  value={draft.timezone}
                  onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
                  aria-invalid={!!errors.timezone}
                />
                {errors.timezone && <span className="form-error">{errors.timezone}</span>}
              </label>
              {(['start', 'end'] as const).map((key) => (
                <label key={key}>
                  {key === 'start' ? 'Opening time' : 'Closing time'}
                  <input
                    type="time"
                    value={draft.hours[key]}
                    onChange={(e) =>
                      setDraft({ ...draft, hours: { ...draft.hours, [key]: e.target.value } })
                    }
                  />
                </label>
              ))}
            </div>
            {errors.hours && <p className="form-error">{errors.hours}</p>}
            <div className="setup-weekdays">
              {weekdays.map((day) => (
                <label className="live-check" key={day}>
                  <input
                    type="checkbox"
                    checked={draft.hours.days.includes(day)}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        hours: {
                          ...draft.hours,
                          days: e.target.checked
                            ? [...draft.hours.days, day]
                            : draft.hours.days.filter((item) => item !== day),
                        },
                      })
                    }
                  />
                  {day}
                </label>
              ))}
            </div>
            {errors.days && <p className="form-error">{errors.days}</p>}
          </fieldset>
          <fieldset disabled={busy}>
            <legend>Branding</legend>
            <label>
              School accent color
              <input
                type="color"
                value={draft.accentColor}
                onChange={(e) => setDraft({ ...draft, accentColor: e.target.value })}
              />
            </label>
            <p>
              Your school uses a monogram for now. Logo upload will be available when private asset
              storage is connected.
            </p>
          </fieldset>
          {errors.form && (
            <p role="alert" className="form-error">
              {errors.form}
            </p>
          )}
          <div className="live-actions">
            <Button type="button" variant="secondary" disabled={busy} onClick={guard.requestClose}>
              Cancel
            </Button>
            <Button disabled={busy}>{busy ? 'Saving…' : 'Save school details'}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
