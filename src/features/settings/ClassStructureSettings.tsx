import SectionNavigation from '../../components/shared/SectionNavigation';
import { useSettingsSection } from './useSettingsSection';
import ClassSubjectsSettings from './ClassSubjectsSettings';
import '../academics/academics.css';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { AppIcon, Button, EmptyState, Panel } from '../../components/ui/Primitives';
import DeleteDialog from '../../components/shared/DeleteDialog';
import { repository } from '../../lib/repository';
import { roster } from '../../lib/selectors';
import { orderedClasses, sectionLabel } from '../../lib/schoolLabels';
import ClassStructureDialog from './ClassStructureDialog';
import ClassStudents from './ClassStudents';
import '../../styles/student-timings.css';

export default function ClassStructureSettings() {
  const state = useSchool();
  const { section, navigation } = useSettingsSection([
    { id: 'sections', label: 'Sections' },
    { id: 'students', label: 'Students' },
    { id: 'subjects', label: 'Subjects' },
  ]);
  const [params, setParams] = useSearchParams();
  const notify = useFeedback();
  const classes = orderedClasses(state.classes.filter((c) => c.schoolId === state.school.id));
  const selected = params.get('classId') ?? '';
  const setSelected = (classId: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set('classId', classId);
        next.delete('studentSection');
        return next;
      },
      { flushSync: true },
    );
  const current = classes.find((c) => c.id === selected) ?? classes[0];
  const sections = state.sections.filter(
    (s) => s.schoolId === state.school.id && s.classId === current?.id,
  );
  const rows = roster(state, true);
  const [editing, setEditing] = useState<{ kind: 'class' | 'section'; id?: string } | null>(null);
  const [deleting, setDeleting] = useState<{
    kind: 'class' | 'section';
    id: string;
    name: string;
  } | null>(null);
  return (
    <div className="setup-stack">
      <SectionNavigation {...navigation} label="Class features" />
      <Panel
        title="Classes, Sections & Grades"
        subtitle="Set up class / grade names, sections and student enrollments for your school."
        action={
          <Button variant="secondary" onClick={() => setEditing({ kind: 'class' })}>
            <Plus size={15} />
            Add Class / Grade
          </Button>
        }
      >
        {current ? (
          <>
            <div className="setup-toolbar">
              <label className="student-timing-field">
                Class / grade
                <select
                  aria-label="Setup class"
                  value={current.id}
                  onChange={(e) => {
                    setSelected(e.target.value);
                  }}
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.grade ? ` · ${c.grade}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <span>
                {sections.length} sections ·{' '}
                {rows.filter((r) => r.enrollment.classId === current.id).length} students
              </span>
              <Button variant="ghost" onClick={() => setEditing({ kind: 'class', id: current.id })}>
                <AppIcon name="edit" size={14} />
                Edit Class / Grade
              </Button>
              <Button
                variant="ghost"
                aria-label={`Delete class ${current.name}`}
                onClick={() => setDeleting({ kind: 'class', id: current.id, name: current.name })}
              >
                <AppIcon name="delete" size={14} />
              </Button>
              <Button variant="secondary" onClick={() => setEditing({ kind: 'section' })}>
                <Plus size={14} />
                Add section
              </Button>
            </div>
            {section === 'sections' && (
              <>
                {' '}
                {sections.length ? (
                  <ul className="setup-sections">
                    {sections.map((s) => (
                      <li key={s.id}>
                        <div>
                          <h3>{sectionLabel(s.name)}</h3>
                          <p>
                            {state.teachers.find((t) => t.id === s.teacherId)?.name ??
                              'Class teacher not assigned'}
                          </p>
                        </div>
                        <span className="section-student-count">
                          {rows.filter((r) => r.enrollment.sectionId === s.id).length} students
                        </span>
                        <div className="student-timing-actions">
                          <Button
                            variant="ghost"
                            aria-label={`Edit section ${s.name}`}
                            onClick={() => setEditing({ kind: 'section', id: s.id })}
                          >
                            <AppIcon name="edit" size={14} />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            aria-label={`Delete section ${s.name}`}
                            onClick={() =>
                              setDeleting({
                                kind: 'section',
                                id: s.id,
                                name: `${current.name} Section ${s.name}`,
                              })
                            }
                          >
                            <AppIcon name="delete" size={14} />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    title="Add the first section"
                    description="Create a section to enroll students and assign its timetable."
                  />
                )}
              </>
            )}
          </>
        ) : (
          <EmptyState
            title="Set up your first class"
            description="Use any class name or grade label your school follows."
          />
        )}
      </Panel>
      {current && section === 'subjects' && (
        <ClassSubjectsSettings key={current.id} classId={current.id} />
      )}
      {current && section === 'students' && <ClassStudents key={current.id} classId={current.id} />}
      {editing && (
        <ClassStructureDialog
          key={`${editing.kind}-${editing.id ?? current?.id}`}
          {...editing}
          classId={current?.id}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <DeleteDialog
          title={`Delete ${deleting.name}?`}
          description="Only unused classes and sections can be deleted. Student records and timetable assignments are protected."
          onClose={() => setDeleting(null)}
          onDelete={() => {
            if (deleting.kind === 'class') repository.deleteSchoolClass(deleting.id);
            else repository.deleteSchoolSection(deleting.id);
            notify('Unused setup removed.');
          }}
        />
      )}
    </div>
  );
}
