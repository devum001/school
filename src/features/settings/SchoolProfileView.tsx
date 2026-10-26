import SectionNavigation from '../../components/shared/SectionNavigation';
import { useSettingsSection } from './useSettingsSection';
import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { useFeedback } from '../../app/useFeedback';
import { useToday } from '../../app/useToday';
import { AppIcon, PickerInput, Button, Modal, Panel } from '../../components/ui/Primitives';
import { displayDate } from '../../lib/config';
import { schoolHoursSchema } from '../../lib/schoolHours';
import { formatSchoolTime, SCHOOL_WEEKDAYS } from '../../lib/studentTimings';
import type { School, SchoolHours } from '../../types/domain';
import { useDraftGuard } from '../academics/useDraftGuard';
import { readBrandingImage } from '../../lib/fileUploads';
import '../../styles/ledgers.css';

const fields = [
  ['name', 'School name'],
  ['motto', 'School motto'],
  ['city', 'Location'],
  ['code', 'School code'],
  ['board', 'Board / Affiliation'],
  ['affiliationNumber', 'Affiliation number'],
  ['principal', 'Principal'],
  ['phone', 'Phone'],
  ['email', 'Email'],
  ['website', 'Website'],
] as const;
const operationalFields = [
  ['address', 'Street address'],
  ['region', 'State / Region'],
  ['country', 'Country'],
  ['postalCode', 'Postal code'],
  ['timezone', 'Timezone'],
  ['accentColor', 'Accent color'],
] as const;
export type ProfileViewValue = School &
  Partial<Record<(typeof operationalFields)[number][0], string>>;
export interface SchoolProfileViewProps {
  school: ProfileViewValue;
  academicYear: { name: string } | null;
  hours?: SchoolHours;
  schoolLogo?: string;
  canManage?: boolean;
  weekStartsOn?: string;
  registrationManaged?: boolean;
  showOperationalFields?: boolean;
  validate: (school: ProfileViewValue) => Record<string, string>;
  save: (school: ProfileViewValue, hours?: SchoolHours) => Promise<void> | void;
}
export default function SchoolProfileView({
  school,
  academicYear,
  hours,
  schoolLogo,
  canManage = true,
  weekStartsOn,
  registrationManaged = false,
  showOperationalFields = false,
  validate,
  save,
}: SchoolProfileViewProps) {
  const { section, navigation } = useSettingsSection([
    { id: 'profile', label: 'School Profile' },
    { id: 'timing', label: 'School Timing' },
  ]);
  const today = useToday();
  const notify = useFeedback();
  const [draft, setDraft] = useState<typeof school | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [readingLogo, setReadingLogo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draftHours, setDraftHours] = useState<SchoolHours>({ start: '', end: '', days: [] });
  const guard = useDraftGuard(
    (!!draft && JSON.stringify(draft) !== JSON.stringify(school)) ||
      (!!draft &&
        JSON.stringify(draftHours) !== JSON.stringify(hours ?? { start: '', end: '', days: [] })),
    () => setDraft(null),
  );
  const draftLogo = draft?.logoDataUrl === null ? undefined : (draft?.logoDataUrl ?? schoolLogo);
  const rows = [
    ['Board / Affiliation', school.board],
    ['Affiliation number', school.affiliationNumber],
    ['Principal', school.principal],
    ['Academic year', academicYear?.name ?? 'Not configured'],
    ["Today's date", displayDate(today)],
    ['Phone', school.phone],
    ['Email', school.email],
    ['Website', school.website],
    ...(showOperationalFields ? operationalFields.map(([key, label]) => [label, school[key]]) : []),
    ['School opening time', hours ? formatSchoolTime(hours.start) : 'Not configured'],
    ['School closing time', hours ? formatSchoolTime(hours.end) : 'Not configured'],
    [
      'Working days',
      hours ? hours.days.map((day) => day.slice(0, 3)).join(', ') : 'Not configured',
    ],
  ];
  return (
    <>
      <SectionNavigation {...navigation} label="General settings features" />
      <Panel className="settings-profile">
        <div className="settings-profile-banner">
          <div className="settings-profile-identity">
            <span className="settings-school-mark">
              {schoolLogo ? (
                <img
                  src={schoolLogo}
                  alt="School logo"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <AppIcon name="graduation-cap" size={48} />
              )}
            </span>
            <div>
              <h2>{school.name}</h2>
              <p>{school.motto}</p>
              <div className="settings-profile-tags">
                <span>
                  <MapPin size={14} />
                  {school.city}
                </span>
                <span>
                  <AppIcon name="tag" size={14} />
                  Code: {school.code}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="secondary"
            disabled={!canManage}
            className="settings-edit"
            onClick={() => {
              setDraft({ ...school });
              setDraftHours(hours ? structuredClone(hours) : { start: '', end: '', days: [] });
              setErrors({});
            }}
          >
            <AppIcon name="edit" size={14} />
            {section === 'timing' ? 'Edit Timing' : 'Edit Details'}
          </Button>
        </div>
        <dl id="school-hours" tabIndex={-1} className="detail-list settings-profile-details">
          {rows
            .filter((_, index) =>
              section === 'timing' ? index >= rows.length - 3 : index < rows.length - 3,
            )
            .map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || 'Not provided'}</dd>
              </div>
            ))}
        </dl>
      </Panel>
      <Modal
        open={draft !== null}
        onClose={() => {
          if (!busy) guard.requestClose();
        }}
        title={section === 'timing' ? 'Edit school timing' : 'Edit school details'}
        description="Update the school profile used throughout your workspace."
        wide
      >
        {guard.confirming ? (
          <div className="modal-actions">
            <Button onClick={guard.keepEditing}>Keep editing</Button>
            <Button variant="danger" onClick={guard.discard}>
              Discard changes
            </Button>
          </div>
        ) : (
          draft && (
            <form
              data-unsaved={!!draft}
              onSubmit={async (event) => {
                event.preventDefault();
                if (busy || !canManage) return;
                const validation = validate(draft);
                if (Object.keys(validation).length) {
                  setErrors(validation);
                  return;
                }
                const hasHours =
                  !!draftHours.start || !!draftHours.end || draftHours.days.length > 0;
                const timingResult = hasHours ? schoolHoursSchema.safeParse(draftHours) : null;
                if (timingResult && !timingResult.success) {
                  setErrors(
                    Object.fromEntries(
                      timingResult.error.issues.map((issue) => [
                        `hours-${String(issue.path[0])}`,
                        issue.message,
                      ]),
                    ),
                  );
                  return;
                }
                try {
                  setBusy(true);
                  await save(draft, timingResult?.success ? timingResult.data : undefined);
                  guard.complete();
                  notify('School details saved.');
                } catch (cause) {
                  setErrors({
                    form:
                      cause instanceof Error ? cause.message : 'Your changes could not be saved.',
                  });
                } finally {
                  setBusy(false);
                }
              }}
            >
              <fieldset disabled={busy || !canManage} style={{ border: 0, padding: 0 }}>
                {section !== 'timing' && (
                  <>
                    {' '}
                    <div className="profile-image-editor">
                      {draftLogo && <img src={draftLogo} alt="School logo preview" />}
                      <label className="button secondary document-upload-control">
                        {readingLogo ? 'Preparing logo…' : 'Choose school logo'}
                        <input
                          aria-label="School logo"
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          disabled={readingLogo || busy}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (!file) return;
                            setReadingLogo(true);
                            try {
                              const logoDataUrl = await readBrandingImage(file);
                              setDraft((current) => (current ? { ...current, logoDataUrl } : null));
                              setErrors({});
                            } catch (cause) {
                              setErrors({
                                form:
                                  cause instanceof Error ? cause.message : 'Unable to read logo.',
                              });
                            } finally {
                              setReadingLogo(false);
                            }
                          }}
                        />
                      </label>
                      <p className="panel-note">
                        Recommended logo: 400 × 400 px · PNG, JPG or WebP · up to 5 MB. Transparent
                        PNG works best.
                      </p>
                      {draftLogo && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setDraft({ ...draft, logoDataUrl: null })}
                        >
                          Remove logo
                        </Button>
                      )}
                    </div>
                    <div className="settings-form-grid">
                      {[...fields, ...(showOperationalFields ? operationalFields : [])].map(
                        ([key, label]) => (
                          <label key={key} className="settings-field">
                            {label}
                            <input
                              disabled={registrationManaged && key === 'code'}
                              aria-label={label}
                              value={draft[key] ?? ''}
                              type={
                                key === 'accentColor'
                                  ? 'color'
                                  : key === 'email'
                                    ? 'email'
                                    : key === 'phone'
                                      ? 'tel'
                                      : 'text'
                              }
                              onChange={(event) =>
                                setDraft({ ...draft, [key]: event.target.value })
                              }
                              aria-invalid={!!errors[key]}
                              aria-describedby={errors[key] ? `school-${key}-error` : undefined}
                            />
                            {errors[key] && (
                              <span className="form-error" id={`school-${key}-error`}>
                                {errors[key]}
                              </span>
                            )}
                          </label>
                        ),
                      )}
                    </div>
                  </>
                )}
                {section === 'timing' && (
                  <fieldset className="school-hours-fields">
                    <legend>School timing</legend>
                    <p>
                      One opening and closing time for the selected working days. Attendance cutoffs
                      use this timing.
                    </p>
                    <div className="settings-form-grid">
                      {(['start', 'end'] as const).map((key) => (
                        <label className="settings-field" key={key}>
                          {key === 'start' ? 'School opening time' : 'School closing time'}
                          <PickerInput
                            aria-label={
                              key === 'start' ? 'School opening time' : 'School closing time'
                            }
                            type="time"
                            value={draftHours[key]}
                            onChange={(e) =>
                              setDraftHours({ ...draftHours, [key]: e.target.value })
                            }
                            aria-invalid={!!errors[`hours-${key}`]}
                            aria-describedby={
                              errors[`hours-${key}`] ? `hours-${key}-error` : undefined
                            }
                          />
                          {errors[`hours-${key}`] && (
                            <span className="form-error" id={`hours-${key}-error`}>
                              {errors[`hours-${key}`]}
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                    <fieldset className="school-working-days">
                      <legend>Working days</legend>
                      <div className="student-day-options">
                        {(weekStartsOn === 'Sunday'
                          ? [SCHOOL_WEEKDAYS[6], ...SCHOOL_WEEKDAYS.slice(0, 6)]
                          : SCHOOL_WEEKDAYS
                        ).map((day) => (
                          <label key={day}>
                            <input
                              type="checkbox"
                              checked={draftHours.days.includes(day)}
                              onChange={(e) =>
                                setDraftHours({
                                  ...draftHours,
                                  days: e.target.checked
                                    ? [...draftHours.days, day]
                                    : draftHours.days.filter((d) => d !== day),
                                })
                              }
                            />
                            {day}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    {errors['hours-days'] && (
                      <p className="form-error" role="alert">
                        {errors['hours-days']}
                      </p>
                    )}
                  </fieldset>
                )}
                {errors.form && (
                  <p className="form-error" role="alert">
                    {errors.form}
                  </p>
                )}
                <div className="modal-actions">
                  <Button type="button" variant="secondary" onClick={guard.requestClose}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={readingLogo || busy}>
                    <AppIcon name="save" size={16} />
                    {section === 'timing' ? 'Save timing' : 'Save details'}
                  </Button>
                </div>
              </fieldset>
            </form>
          )
        )}
      </Modal>
    </>
  );
}
