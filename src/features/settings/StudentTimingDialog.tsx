import { useState } from 'react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { Button, Modal } from '../../components/ui/Primitives';
import { repository } from '../../lib/repository';
import {
  SCHOOL_WEEKDAYS,
  studentTimingInputSchema,
  type StudentTimingInput,
} from '../../lib/studentTimings';

export default function StudentTimingDialog({
  timingId,
  onClose,
}: {
  timingId?: string;
  onClose: () => void;
}) {
  const state = useSchool();
  const notify = useFeedback();
  const existing = state.studentTimings?.find(
    (timing) => timing.id === timingId && timing.schoolId === state.school.id,
  );
  const [draft, setDraft] = useState<StudentTimingInput>(() =>
    existing
      ? {
          name: existing.name,
          days: [...existing.days],
          start: existing.start,
          end: existing.end,
          sectionIds: [...existing.sectionIds],
        }
      : { name: '', days: [...SCHOOL_WEEKDAYS.slice(0, 5)], start: '', end: '', sectionIds: [] },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const sections = state.sections.filter((section) => section.schoolId === state.school.id);
  function toggleSections(ids: string[]) {
    const selected = ids.every((id) => draft.sectionIds.includes(id));
    setDraft({
      ...draft,
      sectionIds: selected
        ? draft.sectionIds.filter((id) => !ids.includes(id))
        : [...new Set([...draft.sectionIds, ...ids])],
    });
  }
  return (
    <Modal
      open
      title={existing ? 'Edit student timing' : 'Add student timing'}
      description="Choose your own name, working days, and school hours. A section can have one timing per day."
      onClose={onClose}
      wide
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const result = studentTimingInputSchema.safeParse(draft);
          if (!result.success) {
            setErrors(
              Object.fromEntries(
                result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
              ),
            );
            return;
          }
          try {
            repository.saveStudentTiming(result.data, timingId);
            onClose();
            notify('Student timing saved. Attendance cutoffs are updated.');
          } catch (error) {
            setErrors({
              form: error instanceof Error ? error.message : 'Unable to save student timing.',
            });
          }
        }}
      >
        <div className="student-timing-form-grid">
          <label className="student-timing-field full">
            Timing name
            <input
              value={draft.name}
              placeholder="For example: Primary, Senior, or Saturday"
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'timing-name-error' : undefined}
            />
            {errors.name && (
              <span className="form-error" id="timing-name-error">
                {errors.name}
              </span>
            )}
          </label>
          {(['start', 'end'] as const).map((key) => (
            <label className="student-timing-field" key={key}>
              {key === 'start' ? 'Student start time' : 'Student end time'}
              <input
                type="time"
                required
                value={draft[key]}
                onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                aria-invalid={!!errors[key]}
                aria-describedby={errors[key] ? `timing-${key}-error` : undefined}
              />
              {errors[key] && (
                <span className="form-error" id={`timing-${key}-error`}>
                  {errors[key]}
                </span>
              )}
            </label>
          ))}
          <fieldset
            className="student-timing-picker full"
            aria-describedby={errors.days ? 'timing-days-error' : undefined}
          >
            <legend>Working days</legend>
            <div className="student-day-options">
              {SCHOOL_WEEKDAYS.map((day) => (
                <label key={day}>
                  <input
                    type="checkbox"
                    checked={draft.days.includes(day)}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        days: event.target.checked
                          ? [...draft.days, day]
                          : draft.days.filter((item) => item !== day),
                      })
                    }
                  />
                  {day.slice(0, 3)}
                </label>
              ))}
            </div>
            {errors.days && (
              <p className="form-error" id="timing-days-error">
                {errors.days}
              </p>
            )}
          </fieldset>
          <fieldset
            className="student-timing-picker full"
            aria-describedby={errors.sectionIds ? 'timing-sections-error' : undefined}
          >
            <legend>Classes & sections</legend>
            <div className="student-selection-actions">
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  setDraft({ ...draft, sectionIds: sections.map((section) => section.id) })
                }
              >
                Select all classes
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDraft({ ...draft, sectionIds: [] })}
              >
                Clear selection
              </Button>
            </div>
            <div className="student-section-picker">
              {state.classes
                .filter((grade) => grade.schoolId === state.school.id)
                .map((grade) => {
                  const choices = sections.filter((section) => section.classId === grade.id);
                  return (
                    <div key={grade.id}>
                      <div className="student-class-picker-heading">
                        <strong>{grade.name}</strong>
                        <Button
                          variant="ghost"
                          type="button"
                          aria-label={`Toggle all ${grade.name} sections`}
                          onClick={() => toggleSections(choices.map((section) => section.id))}
                        >
                          {choices.every((section) => draft.sectionIds.includes(section.id))
                            ? 'Clear'
                            : 'Select all'}
                        </Button>
                      </div>
                      <div className="student-section-options">
                        {choices.map((section) => (
                          <label key={section.id}>
                            <input
                              type="checkbox"
                              aria-label={`${grade.name} Section ${section.name}`}
                              checked={draft.sectionIds.includes(section.id)}
                              onChange={() => toggleSections([section.id])}
                            />
                            Section {section.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
            {errors.sectionIds && (
              <p className="form-error" id="timing-sections-error">
                {errors.sectionIds}
              </p>
            )}
          </fieldset>
        </div>
        {errors.form && (
          <p className="form-error" role="alert">
            {errors.form}
          </p>
        )}
        <div className="modal-actions">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save timing</Button>
        </div>
      </form>
    </Modal>
  );
}
