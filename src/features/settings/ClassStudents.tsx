import DeleteDialog from '../../components/shared/DeleteDialog';
import { repository } from '../../lib/repository';
import { compareRolls } from '../../lib/studentIdentifiers';
import StudentRosterTable from '../students/StudentRosterTable';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { AppIcon, Button, EmptyState, Panel, SearchInput } from '../../components/ui/Primitives';
import { roster } from '../../lib/selectors';
import StudentImportDialog from './StudentImportDialog';
import StudentDialog from '../students/StudentDialog';
import { downloadClassStudentTemplate } from '../../lib/studentTemplate';
import { sectionLabel } from '../../lib/schoolLabels';

export default function ClassStudents({ classId }: { classId: string }) {
  const state = useSchool();
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const schoolClass = state.classes.find((item) => item.id === classId);
  const sections = state.sections.filter(
    (item) => item.schoolId === state.school.id && item.classId === classId,
  );
  const section =
    params.get('studentSection') === 'none'
      ? ''
      : (sections.find((item) => item.id === params.get('studentSection'))?.id ?? '');
  const query = params.get('studentSearch') ?? '';
  const update = (key: string, value: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { flushSync: true },
    );
  const students = roster(state, true)
    .filter((row) => row.enrollment.classId === classId)
    .sort(
      (a, b) =>
        a.sectionName.localeCompare(b.sectionName) ||
        compareRolls(a.enrollment.rollNumber, b.enrollment.rollNumber),
    );
  const filtered = students.filter(
    (row) =>
      (!section ||
        (section === 'none' ? !row.enrollment.sectionId : row.enrollment.sectionId === section)) &&
      `${row.student.name} ${row.student.admissionNumber} ${row.enrollment.rollNumber}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <Panel
        className="class-students-panel"
        title={`${schoolClass?.name} students`}
        subtitle={`${students.length} students across ${sections.length} sections · ${state.academicYear.name}`}
        action={
          <div className="student-import-actions">
            <Button
              variant="secondary"
              onClick={() =>
                downloadClassStudentTemplate(
                  schoolClass?.name ?? '',
                  sections.map((item) => item.name),
                )
              }
            >
              <AppIcon name="download" size={16} />
              Download Sample Excel
            </Button>
            <Button variant="secondary" onClick={() => setImporting(true)}>
              <AppIcon name="upload" size={16} />
              Import Excel (.xlsx)
            </Button>
            <Button onClick={() => setAdding(true)}>
              <Plus size={15} />
              Add student
            </Button>
          </div>
        }
      >
        <div className="panel-padding class-students-filters">
          <SearchInput
            value={query}
            onChange={(value) => update('studentSearch', value)}
            placeholder="Search class students…"
          />
          <label className="field">
            Section
            <select
              aria-label="Class students section"
              value={section}
              onChange={(event) => update('studentSection', event.target.value)}
            >
              <option value="">Whole class · all students</option>
              {sections.map((item) => (
                <option key={item.id} value={item.id}>
                  {sectionLabel(item.name)}
                </option>
              ))}
            </select>
          </label>
          <span>{filtered.length} students</span>
        </div>
        {filtered.length ? (
          <StudentRosterTable
            rows={filtered.map(({ student, enrollment, sectionName, className }) => ({
              id: enrollment.id,
              studentId: student.id,
              name: student.name,
              code: student.admissionNumber,
              className,
              sectionName,
              rollNumber: enrollment.rollNumber,
              status: student.status,
            }))}
            onDelete={(id) => setDeleting(filtered.find((r) => r.enrollment.id === id)!.student.id)}
            onEdit={(id) => setEditing(filtered.find((r) => r.enrollment.id === id)!.student.id)}
          />
        ) : (
          <EmptyState
            title={students.length ? 'No matching students' : 'No students in this class'}
            description="Add a student and select their section, or import all sections together using Excel."
          />
        )}
      </Panel>
      {adding && (
        <StudentDialog
          initialClassId={classId}
          initialSectionId={section && section !== 'none' ? section : undefined}
          onClose={() => setAdding(false)}
        />
      )}
      {importing && <StudentImportDialog classId={classId} onClose={() => setImporting(false)} />}
      {deleting && (
        <DeleteDialog
          title="Delete student?"
          description="Permanently delete this student and their related local records."
          onClose={() => setDeleting(null)}
          onDelete={() => {
            repository.deleteStudent(deleting);
          }}
        />
      )}
      {editing && <StudentDialog studentId={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
