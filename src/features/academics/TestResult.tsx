import { useState } from 'react';
import { compareRolls } from '../../lib/studentIdentifiers';
import StudentRecordLink from '../../components/shared/StudentRecordLink';
import { useSchoolFeature } from '../../app/schoolFeatureContext';
import { useSchool } from '../../app/useSchool';
import {
  AppIcon,
  Badge,
  Button,
  EmptyState,
  Panel,
  SearchInput,
} from '../../components/ui/Primitives';
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
  classId,
  onClose,
  onEdit,
  from,
}: {
  exam: Examination;
  sectionId: string | undefined;
  classId: string;
  onClose: () => void;
  onEdit: () => void;
  from: string;
}) {
  const state = useSchool();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const feature = useSchoolFeature();
  const subjects = savedSubjects(state, exam, sectionId, classId);
  const columns = subjects.map((subject) => ({
    subject,
    ...subjectResults(state, exam, sectionId, subject, classId),
  }));
  const students = columns[0]?.rows ?? [];
  const ranked = overallLeaderboard(state, students, [exam]);
  const ranks = new Map(ranked.map((student) => [student.enrollment.id, student]));
  const rows = [...students].sort(
    (a, b) =>
      (ranks.get(a.enrollment.id)?.rank ?? Infinity) -
        (ranks.get(b.enrollment.id)?.rank ?? Infinity) ||
      compareRolls(a.enrollment.rollNumber, b.enrollment.rollNumber),
  );
  const matching = rows.filter((r) =>
    `${r.student.name} ${r.student.admissionNumber} ${r.enrollment.rollNumber}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(matching.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = matching.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const scores = ranked.map((r) => r.percentage);
  const stats = sectionStats(state, exam, sectionId, classId);
  const cells = columns.map(
    (column) => new Map(column.rows.map((student) => [student.enrollment.id, student])),
  );
  const cellText = (enrollmentId: string, index: number) => {
    const cell = cells[index].get(enrollmentId);
    return cell && !cell.applicable
      ? 'Not included'
      : !cell || cell.pending
        ? 'Pending'
        : cell.absent
          ? 'Absent'
          : cell.cell!.marks;
  };
  const section = state.sections.find((s) => s.id === sectionId);
  const className = state.classes.find((c) => c.id === classId)?.name;
  const scopeLabel =
    sectionId === undefined
      ? 'Whole class'
      : sectionId === ''
        ? 'Without section'
        : sectionLabel(section?.name ?? '');
  const maximums = columns.map((column) => [
    ...new Set(column.rows.flatMap((r) => (r.cell ? [r.cell.maxMarks] : []))),
  ]);
  return (
    <Panel
      className="assessment-result-page"
      title={exam.name}
      subtitle={`${exam.kind || 'Assessment'} · ${displayDate(exam.date)} · ${className} · ${scopeLabel}`}
      action={
        <Button variant="secondary" onClick={onClose}>
          Back to results
        </Button>
      }
    >
      <div className="live-content">
        {subjects.length ? (
          <>
            <dl className="academic-subject-stats">
              <div>
                <dt>Students</dt>
                <dd>{stats.students}</dd>
              </div>
              <div>
                <dt>Average recorded score</dt>
                <dd>{stats.average === null ? '—' : `${stats.average.toFixed(1)}%`}</dd>
              </div>
              <div>
                <dt>Students assessed</dt>
                <dd>{ranked.length}</dd>
              </div>
              <div>
                <dt>Highest score</dt>
                <dd>{scores.length ? `${Math.max(...scores).toFixed(1)}%` : '—'}</dd>
              </div>
              <div>
                <dt>80% and above</dt>
                <dd>{scores.filter((v) => v >= 80).length}</dd>
              </div>
              <div>
                <dt>90% and above</dt>
                <dd>{scores.filter((v) => v >= 90).length}</dd>
              </div>
              <div>
                <dt>100%</dt>
                <dd>{scores.filter((v) => v === 100).length}</dd>
              </div>
              <div>
                <dt>Absent in a subject</dt>
                <dd>{stats.absent}</dd>
              </div>
              <div>
                <dt>Pending</dt>
                <dd>{stats.pending}</dd>
              </div>
            </dl>
            <p className="panel-note">
              Percentage = recorded marks obtained ÷ recorded maximum marks × 100. Absent and
              pending subjects are shown separately and excluded from the score. Partial totals
              cover recorded subjects only.
            </p>
            <div className="sheet-tools">
              <SearchInput
                value={query}
                onChange={(v) => {
                  setQuery(v);
                  setPage(1);
                }}
                placeholder="Search name, roll or admission number…"
              />
            </div>
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
                    <th scope="col">Admission number</th>
                    {sectionId === undefined && <th scope="col">Section</th>}
                    {subjects.map((subject, index) => (
                      <th scope="col" key={subject.subjectId ?? subject.name}>
                        {subject.name}
                        <span className="academic-subject-maximum">
                          {maximums[index].length > 1
                            ? 'Maximum varies by section'
                            : `Max ${maximums[index][0] ?? subject.maxMarks}`}
                        </span>
                      </th>
                    ))}
                    <th scope="col">Total</th>
                    <th scope="col">Overall %</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((student) => {
                    const total = ranks.get(student.enrollment.id);
                    const pending = cells.some(
                      (column) => column.get(student.enrollment.id)?.pending,
                    );
                    return (
                      <tr key={student.enrollment.id}>
                        <td>{total ? `#${total.rank}` : '—'}</td>
                        <td>{student.enrollment.rollNumber}</td>
                        <th scope="row">
                          <StudentRecordLink
                            className="text-link"
                            to={studentHistoryUrl(student.student.id, exam.id, from)}
                          >
                            {student.student.name}
                          </StudentRecordLink>
                        </th>
                        <td>{student.student.admissionNumber || '—'}</td>
                        {sectionId === undefined && (
                          <td>{student.sectionName || 'Without section'}</td>
                        )}
                        {columns.map((column, index) => {
                          const text = cellText(student.enrollment.id, index);
                          return (
                            <td key={column.subject.subjectId ?? column.subject.name}>
                              {typeof text === 'number' ? (
                                `${text}/${cells[index].get(student.enrollment.id)!.cell!.maxMarks}`
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
                              {pending && (
                                <small className="academic-result-partial">Partial</small>
                              )}
                            </>
                          ) : cells.some((c) => c.get(student.enrollment.id)?.absent) ? (
                            'Absent'
                          ) : (
                            'Pending'
                          )}
                        </td>
                        <td>{total ? `${total.percentage.toFixed(1)}%` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!matching.length && <EmptyState title="No matching students" />}
            <div className="assessment-pagination">
              <span>
                {matching.length} students · Page {currentPage} of {pages}
              </span>
              <label className="field">
                Rows per page
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  {[20, 50, 100].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                variant="secondary"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={currentPage === pages}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
              </Button>
            </div>
            <div className="modal-actions">
              <Button
                variant="secondary"
                onClick={() =>
                  downloadCsv(
                    `Results-${exam.name}-${className}-${scopeLabel}.csv`,
                    [
                      'Roll No.',
                      'Student',
                      'Admission number',
                      'Class',
                      'Section',
                      ...subjects.flatMap((s) => [s.name, `${s.name} maximum`]),
                      'Recorded marks',
                      'Recorded maximum',
                      'Percentage',
                      'Rank',
                    ],
                    matching.map((student) => [
                      student.enrollment.rollNumber,
                      student.student.name,
                      student.student.admissionNumber,
                      student.className,
                      student.sectionName || 'Without section',
                      ...subjects.flatMap((_, index) => [
                        cellText(student.enrollment.id, index),
                        cells[index].get(student.enrollment.id)?.cell?.maxMarks ?? '',
                      ]),
                      ranks.get(student.enrollment.id)?.marks ?? '',
                      ranks.get(student.enrollment.id)?.maximum ?? '',
                      ranks.get(student.enrollment.id)?.percentage.toFixed(1) ?? '',
                      ranks.get(student.enrollment.id)?.rank ?? '',
                    ]),
                  )
                }
              >
                <AppIcon name="download" size={16} />
                Export class result
              </Button>
              {(!feature || feature.canManage) && (
                <Button onClick={onEdit}>
                  <AppIcon name="edit" size={16} /> Edit Marks
                </Button>
              )}
            </div>
          </>
        ) : (
          <EmptyState title="No included subjects" />
        )}
      </div>
    </Panel>
  );
}
