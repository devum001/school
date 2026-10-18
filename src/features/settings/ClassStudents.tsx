import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { AppIcon, Button, EmptyState, Panel, SearchInput } from '../../components/ui/Primitives';
import { roster } from '../../lib/selectors';
import StudentDialog from '../students/StudentDialog';
import { STUDENT_IMPORT_HEADERS } from '../../lib/studentImport';
import { downloadStudentWorkbook } from '../../lib/xlsx';
import { sectionLabel } from '../../lib/schoolLabels';

export default function ClassStudents({ classId }: { classId: string }) {
  const state = useSchool(),
    navigate = useNavigate(),
    location = useLocation();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<string | null>(null);
  const schoolClass = state.classes.find((item) => item.id === classId);
  const sections = state.sections.filter(
    (item) => item.schoolId === state.school.id && item.classId === classId,
  );
  const section = sections.find((item) => item.id === params.get('studentSection'))?.id ?? '';
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
        a.enrollment.rollNumber - b.enrollment.rollNumber,
    );
  const filtered = students.filter(
    (row) =>
      (!section || row.enrollment.sectionId === section) &&
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
                downloadStudentWorkbook(
                  'student-import-sample.xlsx',
                  [STUDENT_IMPORT_HEADERS],
                  [
                    `Import students into ${schoolClass?.name} across all its sections in one file.`,
                    `Section: ${sections.map((item) => item.name).join(', ')}. Fill the section on every student row.`,
                    'Required: Student Name, Admission Number, Birth Date, Guardian Name, Roll Number, Section.',
                    'Admission Number and Roll Number are entered by the school. They are never assigned automatically.',
                    'Roll numbers must be unique within each section. Admission numbers must be unique across the school.',
                    'Birth Date: YYYY-MM-DD or Excel date cell. Keep identifiers and phone numbers as text.',
                    'Relationship defaults to Parent. Parent Mobile and Address are optional. No formulas; up to 1,000 rows.',
                  ],
                )
              }
            >
              <AppIcon name="download" size={16} />
              Download Sample Excel
            </Button>
            <Button
              variant="secondary"
              disabled={!sections.length}
              onClick={() =>
                navigate(
                  `/students/import?${new URLSearchParams({ classId, returnTo: location.pathname + location.search })}`,
                )
              }
            >
              <AppIcon name="upload" size={16} />
              Import Excel (.xlsx)
            </Button>
            <Button
              disabled={!sections.length}
              onClick={() =>
                navigate(
                  `/students/new?${new URLSearchParams({ classId, ...(section ? { sectionId: section } : {}), returnTo: location.pathname + location.search })}`,
                )
              }
            >
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
              <option value="">All sections</option>
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
          <div className="table-wrap" role="region" aria-label="Class students" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Roll no.</th>
                  <th>Student</th>
                  <th>Section</th>
                  <th>Admission no.</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ student, enrollment, sectionName }) => (
                  <tr key={enrollment.id}>
                    <td>{enrollment.rollNumber}</td>
                    <td>
                      <Link className="text-link" to={`/students/${student.id}`}>
                        {student.name}
                      </Link>
                    </td>
                    <td>{sectionLabel(sectionName)}</td>
                    <td>{student.admissionNumber}</td>
                    <td>{student.status === 'active' ? 'Active' : 'Inactive'}</td>
                    <td>
                      <Button
                        variant="ghost"
                        aria-label={`Edit student ${student.name}`}
                        onClick={() => setEditing(student.id)}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={students.length ? 'No matching students' : 'No students in this class'}
            description="Add a student and select their section, or import all sections together using Excel."
          />
        )}
      </Panel>
      {editing && <StudentDialog studentId={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
