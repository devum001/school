import ClassName from '../../components/shared/ClassName';
import SectionNavigation from '../../components/shared/SectionNavigation';
import { useSettingsSection } from './useSettingsSection';
import '../academics/academics.css';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useFeedback } from '../../app/useFeedback';
import { AppIcon, Button, EmptyState, Panel } from '../../components/ui/Primitives';
import DeleteDialog from '../../components/shared/DeleteDialog';
import { sectionLabel } from '../../lib/schoolLabels';
import type { ReactNode } from 'react';
import '../../styles/student-timings.css';

export interface StructureViewProps {
  classes: { id: string; name: string; grade?: string }[];
  sections: {
    id: string;
    name: string;
    classId: string;
    teacherId?: string | null;
    status?: 'active' | 'archived';
  }[];
  teachers: { id: string; name: string }[];
  counts: { classId: string; sectionId: string; count: number }[];
  countsKnown?: boolean;
  canManageClasses?: boolean;
  canManageSections?: boolean;
  canViewStudents?: boolean;
  canViewSubjects?: boolean;
  setupAction?: ReactNode;
  toolbar?: ReactNode;
  emptyHelper?: ReactNode;
  renderSubjects: (classId: string) => ReactNode;
  renderStudents: (classId: string) => ReactNode;
  renderEditor: (value: {
    kind: 'class' | 'section';
    id?: string;
    classId?: string;
    onClose: () => void;
  }) => ReactNode;
  remove: (kind: 'class' | 'section', id: string) => Promise<void> | void;
  archive?: boolean;
}
export default function ClassStructureView({
  classes,
  sections: allSections,
  teachers,
  counts,
  countsKnown = true,
  renderSubjects,
  renderStudents,
  renderEditor,
  remove,
  canManageClasses = true,
  canManageSections = true,
  canViewStudents = true,
  canViewSubjects = true,
  setupAction,
  toolbar,
  emptyHelper,
  archive = false,
}: StructureViewProps) {
  const { section, navigation } = useSettingsSection([
    { id: 'sections', label: 'Sections' },
    ...(canViewStudents ? [{ id: 'students', label: 'Students' }] : []),
    ...(canViewSubjects ? [{ id: 'subjects', label: 'Subjects' }] : []),
  ]);
  const [params, setParams] = useSearchParams();
  const notify = useFeedback();
  const selected = params.get('classId') ?? '';
  const setSelected = (classId: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set('classId', classId);
        next.delete('studentSection');
        next.delete('import');
        return next;
      },
      { flushSync: true },
    );
  const current = classes.find((c) => c.id === selected) ?? classes[0];
  const sections = allSections.filter((s) => s.classId === current?.id);
  const studentCount = (id: string, isClass = false) =>
    !countsKnown
      ? '—'
      : counts
          .filter((c) => (isClass ? c.classId : c.sectionId) === id)
          .reduce((n, c) => n + c.count, 0);
  const [editing, setEditing] = useState<{ kind: 'class' | 'section'; id?: string } | null>(null);
  const [deleting, setDeleting] = useState<{
    kind: 'class' | 'section';
    id: string;
    name: string;
  } | null>(null);
  return (
    <div className="setup-stack">
      {toolbar}
      <Panel
        title="Classes & sections"
        subtitle="Choose a class once, then manage its sections, students and subjects below."
        action={
          setupAction ?? (
            <Button
              disabled={!canManageClasses}
              variant="secondary"
              onClick={() => setEditing({ kind: 'class' })}
            >
              <Plus size={15} />
              Add class
            </Button>
          )
        }
      >
        {current ? (
          <>
            <div className="setup-toolbar">
              <strong className="selected-class-name">
                <ClassName name={current.name} />
              </strong>
              <label className="student-timing-field">
                Class
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
                    </option>
                  ))}
                </select>
              </label>
              <span>
                {sections.length} sections · {studentCount(current.id, true)} students
              </span>
            </div>
          </>
        ) : (
          <EmptyState
            title="Set up your first class"
            description="Create classes and their sections together with Set up classes."
          />
        )}
      </Panel>
      {current && <SectionNavigation {...navigation} label="Class features" />}
      {current && section === 'sections' && (
        <Panel
          title={`${current.name} sections`}
          subtitle="Each section has its own student list and optional class teacher."
        >
          {counts.some((c) => c.classId === current.id && !c.sectionId && c.count > 0) && (
            <p className="panel-padding">
              {counts
                .filter((c) => c.classId === current.id && !c.sectionId)
                .reduce((n, c) => n + c.count, 0)}{' '}
              students enrolled directly in this class (no section).
            </p>
          )}
          <div className="setup-toolbar class-structure-actions">
            <Button
              disabled={!canManageClasses}
              variant="ghost"
              onClick={() => setEditing({ kind: 'class', id: current.id })}
            >
              <AppIcon name="edit" size={14} />
              Edit class
            </Button>
            <Button
              variant="ghost"
              disabled={!canManageClasses}
              aria-label={`${archive ? 'Archive' : 'Delete'} class ${current.name}`}
              onClick={() => setDeleting({ kind: 'class', id: current.id, name: current.name })}
            >
              <AppIcon name="delete" size={14} />
            </Button>
            <Button
              disabled={!canManageSections}
              variant="secondary"
              onClick={() => setEditing({ kind: 'section' })}
            >
              <Plus size={14} />
              Add section
            </Button>
          </div>
          {sections.length ? (
            <ul className="setup-sections">
              {sections.map((s) => (
                <li key={s.id}>
                  <div>
                    <h3>
                      {sectionLabel(s.name)}
                      {s.status === 'archived' ? ' (archived)' : ''}
                    </h3>
                    <p>
                      {teachers.find((t) => t.id === s.teacherId)?.name ??
                        (s.teacherId ? 'Assigned teacher' : 'Class teacher not assigned')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    disabled={!canViewStudents}
                    aria-label={`View students in section ${s.name}`}
                    onClick={() =>
                      setParams((previous) => {
                        const next = new URLSearchParams(previous);
                        next.set('classId', current.id);
                        next.set('section', 'students');
                        next.set('studentSection', s.id);
                        next.delete('studentSearch');
                        return next;
                      })
                    }
                  >
                    {studentCount(s.id)} students →
                  </Button>
                  <div className="student-timing-actions">
                    <Button
                      variant="ghost"
                      disabled={!canManageSections || s.status === 'archived'}
                      aria-label={`Edit section ${s.name}`}
                      onClick={() => setEditing({ kind: 'section', id: s.id })}
                    >
                      <AppIcon name="edit" size={14} />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={!canManageSections || s.status === 'archived'}
                      aria-label={`${archive ? 'Archive' : 'Delete'} section ${s.name}`}
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
              title="This class has no sections"
              description="Enroll students directly in this class. Add sections only if your school uses them."
            />
          )}
        </Panel>
      )}
      {current && section === 'subjects' && renderSubjects(current.id)}
      {current && section === 'students' && (
        <div key={current.id}>{renderStudents(current.id)}</div>
      )}
      {!current && emptyHelper}
      {editing &&
        renderEditor({ ...editing, classId: current?.id, onClose: () => setEditing(null) })}
      {deleting && (
        <DeleteDialog
          archive={archive}
          title={`${archive ? 'Archive' : 'Delete'} ${deleting.name}?`}
          description={
            archive
              ? 'Records are retained for history. Active enrollments, assignments and child records must be resolved before archiving.'
              : 'Only unused classes and sections can be deleted. Student records and timetable assignments are protected.'
          }
          onClose={() => setDeleting(null)}
          onDelete={async () => {
            await remove(deleting.kind, deleting.id);
            notify(archive ? 'Record archived.' : 'Unused setup removed.');
          }}
        />
      )}
    </div>
  );
}
