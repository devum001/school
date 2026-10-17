import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Clock3, Pencil, Users } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { Button, EmptyState, Panel } from '../../components/ui/Primitives';
import { roster } from '../../lib/selectors';
import {
  formatSchoolTime,
  isTimetableMilestone,
  SCHOOL_WEEKDAYS,
  TIMETABLE_LABELS,
  timeMinutes,
} from '../../lib/studentTimings';
import StudentTimings from './StudentTimings';
import ClassTimetableDialog from '../classes/ClassTimetableDialog';
import '../../styles/student-timings.css';

export default function TimetableSettings() {
  const state = useSchool();
  const [params, setParams] = useSearchParams();
  const classes = state.classes.filter((c) => c.schoolId === state.school.id);
  const schoolClass = classes.find((c) => c.id === params.get('timetableClass')) ?? classes[0];
  const sections = state.sections.filter(
    (s) => s.schoolId === state.school.id && s.classId === schoolClass?.id,
  );
  const section = sections.find((s) => s.id === params.get('timetableSection')) ?? sections[0];
  const day = SCHOOL_WEEKDAYS.find((d) => d === params.get('timetableDay')) ?? 'Monday';
  const timing = state.studentTimings?.find(
    (t) =>
      t.schoolId === state.school.id &&
      t.sectionIds.includes(section?.id ?? '') &&
      t.days.includes(day),
  );
  const timetable = state.classTimetables?.find(
    (t) =>
      t.schoolId === state.school.id &&
      t.sectionId === section?.id &&
      t.timingId === timing?.id &&
      t.day === day,
  );
  const [editing, setEditing] = useState(false);
  const studentCount = roster(state).filter((r) => r.enrollment.sectionId === section?.id).length;
  function select(key: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set(key, value);
      if (key === 'timetableClass') next.delete('timetableSection');
      return next;
    });
  }
  const rows = timetable?.slots ?? [];
  return (
    <div className="setup-stack">
      <Panel
        title="School Timetable"
        subtitle="School entry, prayer, subjects, transition time, lunch and dismissal — arranged in your school's order."
        action={
          section &&
          timing && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil size={15} />
              {rows.length ? 'Edit timetable' : 'Build timetable'}
            </Button>
          )
        }
      >
        <div className="setup-toolbar">
          <label className="student-timing-field">
            Class / grade
            <select
              aria-label="Timetable class"
              value={schoolClass?.id ?? ''}
              onChange={(e) => select('timetableClass', e.target.value)}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.grade ? ` · ${c.grade}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="student-timing-field">
            Section
            <select
              aria-label="Timetable section"
              value={section?.id ?? ''}
              onChange={(e) => select('timetableSection', e.target.value)}
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  Section {s.name}
                </option>
              ))}
            </select>
          </label>
          <span>
            <Users size={14} />
            {studentCount} students
          </span>
          <Link className="text-link" to="/settings?tab=Classes%2C+Sections+%26+Grades">
            Manage classes & students
          </Link>
        </div>
        <div className="timetable-days" role="group" aria-label="Timetable weekdays">
          {SCHOOL_WEEKDAYS.map((d) => (
            <button
              type="button"
              key={d}
              aria-pressed={day === d}
              onClick={() => select('timetableDay', d)}
            >
              {d.slice(0, 3)}
            </button>
          ))}
        </div>
        {!section ? (
          <EmptyState
            title="Create a class and section first"
            description="Timetables use your school setup automatically."
            action={
              <Link className="button secondary" to="/settings?tab=Classes%2C+Sections+%26+Grades">
                Set up classes & sections
              </Link>
            }
          />
        ) : !timing ? (
          <EmptyState
            title="No school hours set for this day"
            description={`Assign ${day} school hours to ${schoolClass?.name} Section ${section.name} using Student Timings below.`}
          />
        ) : !rows.length ? (
          <EmptyState
            title={`Plan ${day}'s school day`}
            description={`${formatSchoolTime(timing.start)} – ${formatSchoolTime(timing.end)}. Add school entry, prayer, subject periods, breaks, lunch and dismissal, or import a saved timetable.`}
          />
        ) : (
          <>
            <div className="timetable-summary">
              <Clock3 size={16} />
              <strong>
                {day} · {formatSchoolTime(timing.start)} – {formatSchoolTime(timing.end)}
              </strong>
              <span>{rows.filter((s) => s.kind === 'period').length} class periods</span>
            </div>
            <ol className="school-day-timeline">
              {rows.map((slot, index) => {
                const previousEnd = index > 0 ? rows[index - 1].end : timing.start;
                const gap = timeMinutes(slot.start) - timeMinutes(previousEnd);
                const teacher = state.teachers.find(
                  (t) => t.id === slot.teacherId && t.schoolId === state.school.id,
                );
                return (
                  <li key={slot.id}>
                    {gap > 0 && (
                      <div className="timetable-gap">
                        {formatSchoolTime(previousEnd)} – {formatSchoolTime(slot.start)} · {gap} min
                        between activities
                      </div>
                    )}
                    <div className={`timetable-event ${slot.kind === 'period' ? 'lesson' : ''}`}>
                      <time>
                        {formatSchoolTime(slot.start)}
                        {!isTimetableMilestone(slot.kind) && (
                          <span>to {formatSchoolTime(slot.end)}</span>
                        )}
                      </time>
                      <div>
                        <small>{TIMETABLE_LABELS[slot.kind]}</small>
                        <h3>{slot.name}</h3>
                        {teacher && <p>{teacher.name}</p>}
                      </div>
                      {!isTimetableMilestone(slot.kind) && (
                        <span className="timetable-duration">
                          {timeMinutes(slot.end) - timeMinutes(slot.start)} min
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
              {rows[rows.length - 1].end < timing.end && (
                <li className="timetable-gap">
                  {formatSchoolTime(rows[rows.length - 1].end)} – {formatSchoolTime(timing.end)} ·
                  Unplanned time before school closes
                </li>
              )}
            </ol>
          </>
        )}
      </Panel>
      <StudentTimings />
      {editing && section && (
        <ClassTimetableDialog
          key={section.id}
          sectionId={section.id}
          initialDay={day}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
