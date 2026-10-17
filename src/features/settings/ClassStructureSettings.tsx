import ClassSubjectsSettings from './ClassSubjectsSettings';
import '../academics/academics.css';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { Button, EmptyState, Panel, Modal } from '../../components/ui/Primitives';
import DeleteDialog from '../../components/shared/DeleteDialog';
import { repository } from '../../lib/repository';
import { roster } from '../../lib/selectors';
import { orderedClasses, sectionLabel } from '../../lib/schoolLabels';
import ClassStructureDialog from './ClassStructureDialog';
import ClassStudents from './ClassStudents';
import '../../styles/student-timings.css';

export default function ClassStructureSettings() {
  const state = useSchool();
  const notify = useFeedback();
  const classes = orderedClasses(state.classes.filter((c) => c.schoolId === state.school.id));
  const [selected, setSelected] = useState(classes[0]?.id ?? '');
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
  const [students, setStudents] = useState('');
  const [subjectsDirty, setSubjectsDirty] = useState(false);
  const [pendingClass, setPendingClass] = useState('');
  return (
    <div className="setup-stack">
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
                    if (subjectsDirty) {
                      setPendingClass(e.target.value);
                      return;
                    }
                    setSelected(e.target.value);
                    setStudents('');
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
                <Pencil size={14} />
                Edit Class / Grade
              </Button>
              <Button
                variant="ghost"
                aria-label={`Delete class ${current.name}`}
                onClick={() => setDeleting({ kind: 'class', id: current.id, name: current.name })}
              >
                <Trash2 size={14} />
              </Button>
              <Button variant="secondary" onClick={() => setEditing({ kind: 'section' })}>
                <Plus size={14} />
                Add section
              </Button>
            </div>
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
                    <Button
                      variant="ghost"
                      aria-label={`Students in ${current.name} ${sectionLabel(s.name)}`}
                      onClick={() => setStudents(s.id)}
                    >
                      <Users size={14} />
                      {rows.filter((r) => r.enrollment.sectionId === s.id).length} students
                    </Button>
                    <div className="student-timing-actions">
                      <Button
                        variant="ghost"
                        aria-label={`Edit section ${s.name}`}
                        onClick={() => setEditing({ kind: 'section', id: s.id })}
                      >
                        <Pencil size={14} />
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
                        <Trash2 size={14} />
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
        ) : (
          <EmptyState
            title="Set up your first class"
            description="Use any class name or grade label your school follows."
          />
        )}
        <p className="setup-footnote">
          Classes and sections appear automatically in Students and Attendance. Configure school
          opening and closing times in{' '}
          <Link className="text-link" to="/settings#school-hours">
            General
          </Link>
          .
        </p>
      </Panel>
      {current && (
        <ClassSubjectsSettings
          key={current.id}
          classId={current.id}
          onDirtyChange={setSubjectsDirty}
        />
      )}
      {students && sections.some((s) => s.id === students) && (
        <ClassStudents key={students} sectionId={students} />
      )}
      {pendingClass && (
        <Modal
          open
          title="Discard subject changes?"
          description="Save your subjects before switching classes, or discard these changes."
          onClose={() => setPendingClass('')}
        >
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setPendingClass('')}>
              Keep editing
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setSelected(pendingClass);
                setPendingClass('');
                setStudents('');
                setSubjectsDirty(false);
              }}
            >
              Discard changes
            </Button>
          </div>
        </Modal>
      )}
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
