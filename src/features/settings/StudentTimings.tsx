import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { Button, Panel } from '../../components/ui/Primitives';
import DeleteDialog from '../../components/shared/DeleteDialog';
import { repository } from '../../lib/repository';
import { formatSchoolTime } from '../../lib/studentTimings';
import StudentTimingDialog from './StudentTimingDialog';
import '../../styles/student-timings.css';

export default function StudentTimings() {
  const state = useSchool();
  const location = useLocation();
  const notify = useFeedback();
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState('');
  const timings = (state.studentTimings ?? []).filter(
    (timing) => timing.schoolId === state.school.id,
  );
  const target = timings.find((timing) => timing.id === deleting);
  useEffect(() => {
    if (location.hash === '#student-timings') document.getElementById('student-timings')?.focus();
  }, [location.hash]);
  return (
    <div id="student-timings" className="student-timings" tabIndex={-1}>
      <Panel
        title="Student Timings"
        subtitle="Define your school days and assign timings to classes or sections."
        action={
          <Button variant="secondary" onClick={() => setEditing('')}>
            <Plus size={15} />
            Add timing
          </Button>
        }
      >
        {timings.length === 0 ? (
          <div className="student-timing-empty">
            <p>No student timings configured yet.</p>
            <span>
              Add one timing for the whole school, or separate timings for different classes and
              days.
            </span>
          </div>
        ) : (
          <ul className="student-timing-list">
            {timings.map((timing) => {
              const assignments = state.classes
                .map((grade) => {
                  const sections = state.sections.filter(
                    (section) =>
                      section.classId === grade.id && timing.sectionIds.includes(section.id),
                  );
                  return sections.length
                    ? `${grade.name} (${sections.map((section) => section.name).join(', ')})`
                    : '';
                })
                .filter(Boolean);
              return (
                <li key={timing.id}>
                  <div>
                    <h3>{timing.name}</h3>
                    <p>
                      {timing.days.map((day) => day.slice(0, 3)).join(', ')} ·{' '}
                      {formatSchoolTime(timing.start)} – {formatSchoolTime(timing.end)}
                    </p>
                  </div>
                  <div className="student-timing-applies">
                    <span>Applies to</span>
                    <p>{assignments.join(' · ')}</p>
                  </div>
                  <div className="student-timing-actions">
                    <Button
                      variant="ghost"
                      aria-label={`Edit timing ${timing.name}`}
                      onClick={() => setEditing(timing.id)}
                    >
                      <Pencil size={15} />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      aria-label={`Delete timing ${timing.name}`}
                      onClick={() => setDeleting(timing.id)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      {editing !== null && (
        <StudentTimingDialog
          key={editing || 'new'}
          timingId={editing || undefined}
          onClose={() => setEditing(null)}
        />
      )}
      {target && (
        <DeleteDialog
          title={`Delete ${target.name}?`}
          description="Remove this student timing and its attached class timetables."
          detail={`${state.classTimetables?.filter((table) => table.timingId === target.id && table.schoolId === state.school.id).length ?? 0} class timetable(s) will also be removed.`}
          onClose={() => setDeleting('')}
          onDelete={() => {
            repository.deleteStudentTiming(target.id);
            notify('Student timing removed.');
          }}
        />
      )}
    </div>
  );
}
