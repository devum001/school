import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, ArrowDown, Plus } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { AppIcon, PickerInput, Button, EmptyState, Modal } from '../../components/ui/Primitives';
import DeleteDialog from '../../components/shared/DeleteDialog';
import { repository } from '../../lib/repository';
import {
  formatSchoolTime,
  timetableSlotSchema,
  TIMETABLE_KINDS,
  TIMETABLE_LABELS,
  isTimetableMilestone,
} from '../../lib/studentTimings';
import type { SchoolWeekday, TimetableSlot } from '../../types/domain';
import '../../styles/student-timings.css';

export default function ClassTimetableDialog({
  sectionId,
  initialDay,
  onClose,
}: {
  sectionId: string;
  initialDay?: SchoolWeekday;
  onClose: () => void;
}) {
  const state = useSchool();
  const notify = useFeedback();
  const section = state.sections.find((entry) => entry.id === sectionId);
  const grade = state.classes.find((entry) => entry.id === section?.classId);
  const choices = (state.studentTimings ?? []).filter(
    (timing) => timing.schoolId === state.school.id && timing.sectionIds.includes(sectionId),
  );
  const initialTiming =
    choices.find((t) => initialDay && t.days.includes(initialDay)) ?? choices[0];
  const [selectedId, setSelectedId] = useState(initialTiming?.id ?? '');
  const timing = choices.find((entry) => entry.id === selectedId) ?? choices[0];
  const [selectedDay, setSelectedDay] = useState<SchoolWeekday>(
    initialDay && initialTiming?.days.includes(initialDay)
      ? initialDay
      : (initialTiming?.days[0] ?? 'Monday'),
  );
  const day = timing?.days.includes(selectedDay) ? selectedDay : (timing?.days[0] ?? 'Monday');
  const saved = state.classTimetables?.find(
    (table) =>
      table.schoolId === state.school.id &&
      table.sectionId === sectionId &&
      table.timingId === timing?.id &&
      table.day === day,
  );
  const [slots, setSlots] = useState<TimetableSlot[]>(() => structuredClone(saved?.slots ?? []));
  const [error, setError] = useState('');
  const [slotErrors, setSlotErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<
    | { kind: 'close' }
    | { kind: 'timing'; id: string; day: SchoolWeekday }
    | { kind: 'import'; id: string }
    | null
  >(null);
  const [clearing, setClearing] = useState(false);
  const [newKind, setNewKind] = useState<TimetableSlot['kind']>('prayer');
  const [importId, setImportId] = useState('');
  const importChoices = (state.classTimetables ?? []).filter(
    (table) =>
      table.schoolId === state.school.id &&
      table.id !== saved?.id &&
      table.slots.length > 0 &&
      state.sections.some((s) => s.id === table.sectionId),
  );
  function importRows(id: string) {
    const source = importChoices.find((table) => table.id === id);
    if (!source || !timing) return;
    setSlots(
      source.slots.map((slot) => ({
        ...slot,
        id: crypto.randomUUID(),
        teacherId: source.sectionId === sectionId ? slot.teacherId : '',
        ...(slot.kind === 'entry'
          ? { start: timing.start, end: timing.start }
          : slot.kind === 'dismissal'
            ? { start: timing.end, end: timing.end }
            : {}),
      })),
    );
    setError('');
    setSlotErrors({});
    notify('Timetable imported for review. Adjust times and teachers, then save.');
  }
  const dirty = JSON.stringify(slots) !== JSON.stringify(saved?.slots ?? []);
  function chooseTiming(id: string, nextDay: SchoolWeekday) {
    setSelectedId(id);
    setSelectedDay(nextDay);
    setSlots(
      structuredClone(
        state.classTimetables?.find(
          (table) =>
            table.schoolId === state.school.id &&
            table.sectionId === sectionId &&
            table.timingId === id &&
            table.day === nextDay,
        )?.slots ?? [],
      ),
    );
    setError('');
    setSlotErrors({});
  }
  function requestClose() {
    if (dirty) setPending({ kind: 'close' });
    else onClose();
  }
  function updateSlot<K extends keyof TimetableSlot>(id: string, key: K, value: TimetableSlot[K]) {
    setError('');
    setSlotErrors({});
    setSlots((previous) =>
      previous.map((slot) => {
        if (slot.id !== id) return slot;
        const next = { ...slot, [key]: value };
        if (isTimetableMilestone(next.kind)) next.end = next.start;
        if (next.kind !== 'period') next.teacherId = '';
        return next;
      }),
    );
  }
  function addSlot(kind: TimetableSlot['kind']) {
    setError('');
    const count = slots.filter((slot) => slot.kind === kind).length + 1;
    const beforeDismissal = slots.filter((s) => s.kind !== 'dismissal');
    const start =
      kind === 'entry'
        ? (timing?.start ?? '')
        : kind === 'dismissal'
          ? (timing?.end ?? '')
          : beforeDismissal[beforeDismissal.length - 1]?.end || timing?.start || '';
    if (isTimetableMilestone(kind) && slots.some((s) => s.kind === kind)) {
      setError(`The timetable already has ${TIMETABLE_LABELS[kind].toLowerCase()}.`);
      return;
    }
    const next = {
      id: crypto.randomUUID(),
      name:
        kind === 'period'
          ? `Period ${count}`
          : kind === 'break'
            ? `Break ${count}`
            : kind === 'activity'
              ? `Activity ${count}`
              : TIMETABLE_LABELS[kind],
      kind,
      start,
      end: isTimetableMilestone(kind) ? start : '',
    };
    setSlots(
      kind === 'entry'
        ? [next, ...slots]
        : kind === 'dismissal'
          ? [...slots, next]
          : [...beforeDismissal, next, ...slots.filter((s) => s.kind === 'dismissal')],
    );
  }
  function moveSlot(index: number, direction: -1 | 1) {
    setError('');
    const next = [...slots];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSlots(next);
  }
  return (
    <>
      <Modal
        open
        onClose={requestClose}
        title={`${grade?.name ?? 'Class'} · Section ${section?.name ?? ''} timetable`}
        description="Plan the whole school day: entry, prayer, subject periods, time between classes, lunch and dismissal."
        wide
      >
        {!timing ? (
          <EmptyState
            title="Set student timings first"
            description="Assign school days and hours to this section in General settings."
            action={
              <Link className="button secondary" to="/settings?section=timing">
                Set student timings
              </Link>
            }
          />
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (slots.length === 0) {
                setError('Add at least one timetable row.');
                return;
              }
              const nextErrors: Record<string, string> = {};
              const parsedSlots: TimetableSlot[] = [];
              slots.forEach((slot) => {
                const parsed = timetableSlotSchema.safeParse(slot);
                if (parsed.success) parsedSlots.push(parsed.data);
                else
                  for (const issue of parsed.error.issues)
                    nextErrors[`${slot.id}-${String(issue.path[0])}`] = issue.message;
              });
              if (Object.keys(nextErrors).length) {
                setSlotErrors(nextErrors);
                setError('Check the highlighted timetable fields.');
                return;
              }
              try {
                repository.saveClassTimetable(sectionId, timing.id, day, parsedSlots);
                setSlots(parsedSlots);
                setError('');
                setSlotErrors({});
                notify('Class timetable saved.');
              } catch (cause) {
                setError(
                  cause instanceof Error ? cause.message : 'Unable to save class timetable.',
                );
              }
            }}
          >
            <div className="class-timetable-context">
              <label className="student-timing-field">
                Student timing
                <select
                  aria-label="Timetable student timing"
                  value={timing.id}
                  onChange={(event) => {
                    if (event.target.value === timing.id) return;
                    const nextTiming = choices.find((entry) => entry.id === event.target.value);
                    if (!nextTiming) return;
                    if (dirty)
                      setPending({ kind: 'timing', id: nextTiming.id, day: nextTiming.days[0] });
                    else chooseTiming(nextTiming.id, nextTiming.days[0]);
                  }}
                >
                  {choices.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.name} · {choice.days.map((day) => day.slice(0, 3)).join(', ')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="student-timing-field">
                Day
                <select
                  aria-label="Timetable day"
                  value={day}
                  onChange={(event) => {
                    const nextDay = timing.days.find((entry) => entry === event.target.value);
                    if (!nextDay || nextDay === day) return;
                    if (dirty) setPending({ kind: 'timing', id: timing.id, day: nextDay });
                    else chooseTiming(timing.id, nextDay);
                  }}
                >
                  {timing.days.map((entry) => (
                    <option key={entry}>{entry}</option>
                  ))}
                </select>
              </label>
              <p>
                {formatSchoolTime(timing.start)} – {formatSchoolTime(timing.end)}
              </p>
            </div>
            {importChoices.length > 0 && (
              <div className="timetable-import">
                <label className="student-timing-field">
                  Import a saved timetable
                  <select
                    aria-label="Import source timetable"
                    value={importId}
                    onChange={(e) => setImportId(e.target.value)}
                  >
                    <option value="">Choose class, section and day</option>
                    {importChoices.map((table) => {
                      const sourceSection = state.sections.find((s) => s.id === table.sectionId);
                      const sourceClass = state.classes.find(
                        (c) => c.id === sourceSection?.classId,
                      );
                      return (
                        <option key={table.id} value={table.id}>
                          {sourceClass?.name} · {sourceSection?.name} · {table.day} ·{' '}
                          {state.studentTimings?.find((t) => t.id === table.timingId)?.name}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!importId}
                  onClick={() => {
                    if (dirty) setPending({ kind: 'import', id: importId });
                    else importRows(importId);
                  }}
                >
                  Import timetable
                </Button>
                <p>Import rows for review. Teachers are cleared when copying another section.</p>
              </div>
            )}
            <div className="class-timetable-rows">
              {slots.map((slot, index) => (
                <div className="class-timetable-row" key={slot.id}>
                  <label className="student-timing-field">
                    Row {index + 1} name
                    <input
                      aria-label={`Row ${index + 1} name`}
                      required
                      value={slot.name}
                      onChange={(event) => updateSlot(slot.id, 'name', event.target.value)}
                      aria-invalid={!!slotErrors[`${slot.id}-name`]}
                      aria-describedby={
                        slotErrors[`${slot.id}-name`] ? `${slot.id}-name-error` : undefined
                      }
                    />
                    {slotErrors[`${slot.id}-name`] && (
                      <span className="form-error" id={`${slot.id}-name-error`}>
                        {slotErrors[`${slot.id}-name`]}
                      </span>
                    )}
                  </label>
                  <label className="student-timing-field">
                    Type
                    <select
                      aria-label={`Row ${index + 1} type`}
                      value={slot.kind}
                      onChange={(event) => {
                        const kind = TIMETABLE_KINDS.find((k) => k === event.target.value);
                        if (kind) updateSlot(slot.id, 'kind', kind);
                      }}
                    >
                      {TIMETABLE_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {TIMETABLE_LABELS[kind]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {(['start', 'end'] as const).map((key) => (
                    <label key={key} className="student-timing-field">
                      {key === 'start' ? 'Start' : 'End'}
                      <PickerInput
                        aria-label={`Row ${index + 1} ${key}`}
                        type="time"
                        required
                        disabled={key === 'end' && isTimetableMilestone(slot.kind)}
                        value={slot[key]}
                        onChange={(event) => updateSlot(slot.id, key, event.target.value)}
                        aria-invalid={!!slotErrors[`${slot.id}-${key}`]}
                        aria-describedby={
                          slotErrors[`${slot.id}-${key}`] ? `${slot.id}-${key}-error` : undefined
                        }
                      />
                      {slotErrors[`${slot.id}-${key}`] && (
                        <span className="form-error" id={`${slot.id}-${key}-error`}>
                          {slotErrors[`${slot.id}-${key}`]}
                        </span>
                      )}
                    </label>
                  ))}
                  {slot.kind === 'period' && (
                    <label className="student-timing-field timetable-teacher">
                      Teacher (optional)
                      <select
                        aria-label={`Row ${index + 1} teacher`}
                        value={slot.teacherId ?? ''}
                        onChange={(e) => updateSlot(slot.id, 'teacherId', e.target.value)}
                      >
                        <option value="">Not assigned</option>
                        {state.teachers
                          .filter(
                            (t) =>
                              t.schoolId === state.school.id &&
                              (t.status === 'active' || t.id === slot.teacherId),
                          )
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} · {t.subject}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  <div className="class-timetable-row-actions">
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`Move row ${index + 1} up`}
                      disabled={index === 0}
                      onClick={() => moveSlot(index, -1)}
                    >
                      <ArrowUp size={14} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`Move row ${index + 1} down`}
                      disabled={index === slots.length - 1}
                      onClick={() => moveSlot(index, 1)}
                    >
                      <ArrowDown size={14} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`Remove row ${index + 1}`}
                      onClick={() => {
                        setSlots(slots.filter((entry) => entry.id !== slot.id));
                        setError('');
                        setSlotErrors({});
                      }}
                    >
                      <AppIcon name="delete" size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {slots.length === 0 && (
              <p className="class-timetable-note">
                Start with school entry and prayer, then add your subjects, transitions, lunch and
                dismissal. You choose every duration.
              </p>
            )}
            <div className="class-timetable-add">
              <label className="student-timing-field">
                School-day item
                <select
                  aria-label="School-day item"
                  value={newKind}
                  onChange={(e) => {
                    const kind = TIMETABLE_KINDS.find((k) => k === e.target.value);
                    if (kind) setNewKind(kind);
                  }}
                >
                  {TIMETABLE_KINDS.filter((k) => !['period', 'break', 'activity'].includes(k)).map(
                    (k) => (
                      <option key={k} value={k}>
                        {TIMETABLE_LABELS[k]}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <Button type="button" variant="secondary" onClick={() => addSlot(newKind)}>
                <Plus size={14} />
                Add school-day item
              </Button>
              <Button type="button" variant="secondary" onClick={() => addSlot('period')}>
                <Plus size={14} />
                Add period
              </Button>
              <Button type="button" variant="secondary" onClick={() => addSlot('break')}>
                <Plus size={14} />
                Add break
              </Button>
              <Button type="button" variant="secondary" onClick={() => addSlot('activity')}>
                <Plus size={14} />
                Add activity
              </Button>
            </div>
            <p className="class-timetable-note">
              Gaps are allowed. Keep rows in time order and within the configured school hours.
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              {saved && (
                <Button variant="danger" type="button" onClick={() => setClearing(true)}>
                  Clear timetable
                </Button>
              )}
              <Button variant="secondary" type="button" onClick={requestClose}>
                Close
              </Button>
              <Button type="submit" disabled={!dirty}>
                <AppIcon name="save" size={16} /> Save timetable
              </Button>
            </div>
          </form>
        )}
      </Modal>
      <Modal
        open={pending !== null}
        onClose={() => setPending(null)}
        title="Leave unsaved timetable changes?"
        description="Save your current rows or discard them before leaving."
      >
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setPending(null)}>
            Keep editing
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (pending?.kind === 'close') onClose();
              else if (pending?.kind === 'timing') chooseTiming(pending.id, pending.day);
              else if (pending?.kind === 'import') importRows(pending.id);
              setPending(null);
            }}
          >
            Discard changes
          </Button>
        </div>
      </Modal>
      {clearing && timing && (
        <DeleteDialog
          title="Clear this timetable?"
          description="Remove the saved periods, breaks, and activities for this section and timing."
          onClose={() => setClearing(false)}
          onDelete={() => {
            repository.clearClassTimetable(sectionId, timing.id, day);
            setSlots([]);
            setError('');
            setSlotErrors({});
            notify('Class timetable cleared.');
          }}
        />
      )}
    </>
  );
}
