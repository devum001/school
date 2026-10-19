import { Link } from 'react-router-dom';
import { useSchool } from '../../app/useSchool';
import { AppIcon, Badge, Button, EmptyState, Modal } from '../../components/ui/Primitives';
import {
  overallLeaderboard,
  savedSubjects,
  sectionStats,
  subjectResults,
} from '../../lib/academicSheets';
import { displayDate } from '../../lib/config';
import { downloadCsv } from '../../lib/download';
import { sectionLabel } from '../../lib/schoolLabels';
import { studentHistoryUrl } from '../../lib/academicNavigation';
import type { Examination } from '../../types/domain';

export default function TestResult({
  exam,
  sectionId,
  onClose,
  onEdit,
  from,
}: {
  exam: Examination;
  sectionId: string;
  onClose: () => void;
  onEdit: () => void;
  from: string;
}) {
  const state = useSchool();
  const subjects = savedSubjects(state, exam, sectionId);
  const columns = subjects.map((subject) => ({
    subject,
    ...subjectResults(state, exam, sectionId, subject),
  }));
  const students = columns[0]?.rows ?? [];
  const ranked = overallLeaderboard(state, students, [exam]);
  const ranks = new Map(ranked.map((student) => [student.enrollment.id, student]));
  const rows = [...students].sort(
    (a, b) =>
      (ranks.get(a.enrollment.id)?.rank ?? Infinity) -
        (ranks.get(b.enrollment.id)?.rank ?? Infinity) ||
      a.enrollment.rollNumber - b.enrollment.rollNumber,
  );
  const stats = sectionStats(state, exam, sectionId);
  const cells = columns.map(
    (column) => new Map(column.rows.map((student) => [student.enrollment.id, student])),
  );
  const cellText = (enrollmentId: string, index: number) => {
    const cell = cells[index].get(enrollmentId);
    return !cell || cell.pending ? 'Pending' : cell.absent ? 'Absent' : cell.cell!.marks;
  };
  const section = state.sections.find((s) => s.id === sectionId);
  const className = state.classes.find((c) => c.id === section?.classId)?.name;
  return (
    <Modal
      open
      wide
      title={exam.name}
      description={`${displayDate(exam.date)} · ${className} · ${sectionLabel(section?.name ?? '')}`}
      onClose={onClose}
    >
      {subjects.length ? (
        <>
          <dl className="academic-subject-stats">
            <div>
              <dt>Students</dt>
              <dd>{stats.students}</dd>
            </div>
            <div>
              <dt>Class Average</dt>
              <dd>{stats.average === null ? '—' : `${stats.average.toFixed(1)}%`}</dd>
            </div>
            <div>
              <dt>Absent</dt>
              <dd>{stats.absent}</dd>
            </div>
            <div>
              <dt>Pending</dt>
              <dd>{stats.pending}</dd>
            </div>
          </dl>
          <div
            className="table-wrap academic-class-result"
            role="region"
            aria-label="Class result by subject"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Roll No.</th>
                  <th scope="col">Student</th>
                  {subjects.map((subject) => (
                    <th scope="col" key={subject.subjectId ?? subject.name}>
                      {subject.name}
                      <span className="academic-subject-maximum">Max {subject.maxMarks}</span>
                    </th>
                  ))}
                  <th scope="col">Total</th>
                  <th scope="col">Overall %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((student) => {
                  const total = ranks.get(student.enrollment.id);
                  const pending = cells.some(
                    (column) => column.get(student.enrollment.id)?.pending,
                  );
                  return (
                    <tr key={student.enrollment.id}>
                      <td>{total ? `#${total.rank}` : '—'}</td>
                      <td>{student.enrollment.rollNumber}</td>
                      <th scope="row">
                        <Link
                          className="text-link"
                          to={studentHistoryUrl(student.student.id, exam.id, from)}
                        >
                          {student.student.name}
                        </Link>
                      </th>
                      {columns.map((column, index) => {
                        const text = cellText(student.enrollment.id, index);
                        return (
                          <td key={column.subject.subjectId ?? column.subject.name}>
                            {typeof text === 'number' ? (
                              `${text}/${column.subject.maxMarks}`
                            ) : (
                              <Badge tone={text === 'Absent' ? 'red' : 'neutral'}>{text}</Badge>
                            )}
                          </td>
                        );
                      })}
                      <td>
                        {total ? (
                          <>
                            <strong>
                              {total.marks}/{total.maximum}
                            </strong>
                            {pending && <small className="academic-result-partial">Partial</small>}
                          </>
                        ) : (
                          'Pending'
                        )}
                      </td>
                      <td>{total ? `${total.percentage.toFixed(1)}%` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={3}>
                    Class average
                  </th>
                  {columns.map((column) => (
                    <td key={column.subject.subjectId ?? column.subject.name}>
                      {column.average === null ? '—' : `${column.average.toFixed(1)}%`}
                    </td>
                  ))}
                  <td>—</td>
                  <td>{stats.average === null ? '—' : `${stats.average.toFixed(1)}%`}</td>
                </tr>
                <tr>
                  <th scope="row" colSpan={3}>
                    Highest marks
                  </th>
                  {columns.map((column) => (
                    <td key={column.subject.subjectId ?? column.subject.name}>
                      {column.highest === null
                        ? '—'
                        : `${column.highest}/${column.subject.maxMarks}`}
                    </td>
                  ))}
                  <td>—</td>
                  <td>—</td>
                </tr>
                <tr>
                  <th scope="row" colSpan={3}>
                    Absent students
                  </th>
                  {columns.map((column) => (
                    <td key={column.subject.subjectId ?? column.subject.name}>{column.absent}</td>
                  ))}
                  <td>—</td>
                  <td>—</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="modal-actions">
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  `Results-${exam.name}-${section?.name}.csv`,
                  [
                    'Roll No.',
                    'Student',
                    ...subjects.flatMap((s) => [s.name, `${s.name} maximum`]),
                  ],
                  rows.map((student) => [
                    student.enrollment.rollNumber,
                    student.student.name,
                    ...subjects.flatMap((subject, index) => [
                      cellText(student.enrollment.id, index),
                      subject.maxMarks,
                    ]),
                  ]),
                )
              }
            >
              <AppIcon name="download" size={16} />
              Export class result
            </Button>
            <Button onClick={onEdit}>
              <AppIcon name="edit" size={16} /> Edit Marks
            </Button>
          </div>
        </>
      ) : (
        <EmptyState title="No included subjects" />
      )}
    </Modal>
  );
}
