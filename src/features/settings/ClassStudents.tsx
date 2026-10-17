import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSchool } from '../../app/useSchool';
import { Button, EmptyState, Panel, SearchInput } from '../../components/ui/Primitives';
import { roster } from '../../lib/selectors';
import StudentDialog from '../students/StudentDialog';
import StudentImportDialog from './StudentImportDialog';
import { STUDENT_IMPORT_HEADERS } from '../../lib/studentImport';
import { downloadStudentWorkbook } from '../../lib/xlsx';
import { sectionLabel } from '../../lib/schoolLabels';

export default function ClassStudents({ sectionId }: { sectionId: string }) {
  const state = useSchool();
  const section = state.sections.find((s) => s.id === sectionId);
  const schoolClass = state.classes.find((c) => c.id === section?.classId);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const students = roster(state, true)
    .filter((row) => row.enrollment.sectionId === sectionId)
    .sort((a, b) => a.enrollment.rollNumber - b.enrollment.rollNumber);
  const filtered = students.filter((row) =>
    `${row.student.name} ${row.student.admissionNumber} ${row.enrollment.rollNumber}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <Panel
        className="class-students-panel"
        title={`${schoolClass?.name} · ${sectionLabel(section?.name)} students`}
        subtitle={`${students.length} enrolled students · ${state.academicYear.name}`}
        action={
          <div className="student-import-actions">
            <Button
              variant="secondary"
              onClick={() => {
                downloadStudentWorkbook(
                  'student-import-sample.xlsx',
                  [STUDENT_IMPORT_HEADERS],
                  [
                    `Students will be added to ${schoolClass?.name}, ${sectionLabel(section?.name)} selected in the app.`,
                    'Fill the Students sheet below its header. Required: Student Name, Birth Date, Guardian Name.',
                    'Birth Date: YYYY-MM-DD (for example 2016-05-21) or an Excel date cell.',
                    'Relationship defaults to Parent. Parent Mobile and Address are optional.',
                    'Leave Admission Number blank to generate it automatically, or keep existing imported IDs. Keep Parent Mobile cells as text.',
                    'Roll numbers are assigned automatically by student name in each class/section.',
                    'Do not use formulas. Import up to 1,000 students per file. Duplicate admission or roll numbers will be reported.',
                  ],
                );
              }}
            >
              Download Sample Excel
            </Button>
            <Button variant="secondary" onClick={() => setImporting(true)}>
              Import Excel (.xlsx)
            </Button>
            <Button variant="secondary" onClick={() => setEditing('')}>
              Add student
            </Button>
          </div>
        }
      >
        <div className="panel-padding">
          <SearchInput value={query} onChange={setQuery} placeholder="Search section students…" />
        </div>
        {filtered.length ? (
          <ul className="setup-students">
            {filtered.map(({ student, enrollment }, index) => (
              <li key={enrollment.id}>
                <span className="student-list-number">{index + 1}</span>
                <div>
                  <Link className="text-link" to={`/students/${student.id}`}>
                    {student.name}
                  </Link>
                  <p>
                    Roll {enrollment.rollNumber} · {student.admissionNumber}
                    {student.status === 'inactive' ? ' · Inactive' : ''}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  aria-label={`Edit student ${student.name}`}
                  onClick={() => setEditing(student.id)}
                >
                  Edit
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title={students.length ? 'No matching students' : 'No students in this section'}
            description={
              students.length
                ? 'Try another name, admission number or roll number.'
                : 'Add students here. The same enrollment appears in the student directory and attendance register.'
            }
          />
        )}
      </Panel>
      {editing !== null && (
        <StudentDialog
          key={editing || sectionId}
          studentId={editing || undefined}
          initialSectionId={sectionId}
          onClose={() => setEditing(null)}
        />
      )}
      {importing && (
        <StudentImportDialog sectionId={sectionId} onClose={() => setImporting(false)} />
      )}
    </>
  );
}
