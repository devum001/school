import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MapPin, Tag, GraduationCap, Pencil } from 'lucide-react';
import { useFeedback } from '../../app/useFeedback';
import { useSchool } from '../../app/useSchool';
import { useToday } from '../../app/useToday';
import { Button, Modal, Panel } from '../../components/ui/Primitives';
import { displayDate } from '../../lib/config';
import { repository } from '../../lib/repository';
import { schoolProfileSchema } from '../../lib/settings';
import { configuredSchoolHours, schoolHoursSchema } from '../../lib/schoolHours';
import { formatSchoolTime, SCHOOL_WEEKDAYS } from '../../lib/studentTimings';
import type { SchoolHours } from '../../types/domain';
import { schoolLogoFor } from '../../lib/schoolBranding';
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
export default function SchoolProfile() {
  const state = useSchool();
  const { school, academicYear } = state;
  const schoolLogo = schoolLogoFor(state);
  const hours = configuredSchoolHours(state);
  const location = useLocation();
  const today = useToday();
  const notify = useFeedback();
  const [draft, setDraft] = useState<typeof school | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [readingLogo, setReadingLogo] = useState(false);
  const [draftHours, setDraftHours] = useState<SchoolHours>({ start: '', end: '', days: [] });
  useEffect(() => {
    if (['#school-hours', '#student-timings'].includes(location.hash))
      document.getElementById('school-hours')?.focus();
  }, [location.hash]);
  const draftLogo = draft?.logoDataUrl === null ? undefined : (draft?.logoDataUrl ?? schoolLogo);
  const rows = [
    ['Board / Affiliation', school.board],
    ['Affiliation number', school.affiliationNumber],
    ['Principal', school.principal],
    ['Academic year', academicYear.name],
    ["Today's date", displayDate(today)],
    ['Phone', school.phone],
    ['Email', school.email],
    ['Website', school.website],
    ['School opening time', hours ? formatSchoolTime(hours.start) : 'Not configured'],
    ['School closing time', hours ? formatSchoolTime(hours.end) : 'Not configured'],
    [
      'Working days',
      hours ? hours.days.map((day) => day.slice(0, 3)).join(', ') : 'Not configured',
    ],
  ];
  return (
    <>
      <Panel className="settings-profile">
        <div className="settings-profile-banner">
          <div className="settings-profile-identity">
            <span className="settings-school-mark">
              {schoolLogo ? (
                <img
                  src={schoolLogo}
                  alt="School logo"
                  style={{ width: 64, height: 64, objectFit: 'contain' }}
                />
              ) : (
                <GraduationCap size={48} strokeWidth={1.8} />
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
                  <Tag size={14} />
                  Code: {school.code}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="secondary"
            className="settings-edit"
            onClick={() => {
              setDraft({ ...school });
              setDraftHours(hours ? structuredClone(hours) : { start: '', end: '', days: [] });
              setErrors({});
            }}
          >
            <Pencil size={14} />
            Edit Details
          </Button>
        </div>
        <dl id="school-hours" tabIndex={-1} className="detail-list settings-profile-details">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value || 'Not provided'}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title="Edit school details"
        description="Update the school profile used throughout your workspace."
        wide
      >
        {draft && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const result = schoolProfileSchema.safeParse(draft);
              if (!result.success) {
                setErrors(
                  Object.fromEntries(
                    result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
                  ),
                );
                return;
              }
              const hasHours = !!draftHours.start || !!draftHours.end || draftHours.days.length > 0;
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
                repository.saveSchoolDetails(
                  result.data,
                  timingResult?.success ? timingResult.data : undefined,
                );
                setDraft(null);
                notify('School details saved.');
              } catch (cause) {
                setErrors({
                  form: cause instanceof Error ? cause.message : 'Your changes could not be saved.',
                });
              }
            }}
          >
            <div className="profile-image-editor">
              {draftLogo && <img src={draftLogo} alt="School logo preview" />}
              <label className="button secondary document-upload-control">
                {readingLogo ? 'Preparing logo…' : 'Choose school logo'}
                <input
                  aria-label="School logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={readingLogo}
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
                        form: cause instanceof Error ? cause.message : 'Unable to read logo.',
                      });
                    } finally {
                      setReadingLogo(false);
                    }
                  }}
                />
              </label>
              <p className="panel-note">
                Recommended logo: 400 × 400 px · PNG, JPG or WebP · up to 5 MB. Transparent PNG
                works best.
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
              {fields.map(([key, label]) => (
                <label key={key} className="settings-field">
                  {label}
                  <input
                    value={draft[key] ?? ''}
                    type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
                    onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                    aria-invalid={!!errors[key]}
                    aria-describedby={errors[key] ? `school-${key}-error` : undefined}
                  />
                  {errors[key] && (
                    <span className="form-error" id={`school-${key}-error`}>
                      {errors[key]}
                    </span>
                  )}
                </label>
              ))}
            </div>
            <fieldset className="school-hours-fields">
              <legend>School timing</legend>
              <p>
                One opening and closing time for the selected working days. Attendance cutoffs use
                this timing.
              </p>
              <div className="settings-form-grid">
                {(['start', 'end'] as const).map((key) => (
                  <label className="settings-field" key={key}>
                    {key === 'start' ? 'School opening time' : 'School closing time'}
                    <input
                      type="time"
                      value={draftHours[key]}
                      onChange={(e) => setDraftHours({ ...draftHours, [key]: e.target.value })}
                      aria-invalid={!!errors[`hours-${key}`]}
                      aria-describedby={errors[`hours-${key}`] ? `hours-${key}-error` : undefined}
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
                  {(state.preferences?.weekStartsOn === 'Sunday'
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
            {errors.form && (
              <p className="form-error" role="alert">
                {errors.form}
              </p>
            )}
            <div className="modal-actions">
              <Button type="button" variant="secondary" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={readingLogo}>
                Save details
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
