import TabRail from '../../components/ui/TabRail';
import { tabKeyboard } from '../../lib/tabKeyboard';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSchool } from '../../app/useSchool';
import { AppIcon, Badge, Button, EmptyState, Modal } from '../../components/ui/Primitives';
import { savedSubjects, subjectResults } from '../../lib/academicSheets';
import { subjectName } from '../../lib/classSubjects';
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
  const [index, setIndex] = useState(0);
  const subject = subjects[index] ?? subjects[0];
  const data = subject ? subjectResults(state, exam, sectionId, subject) : null;
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
      <TabRail
        variant="secondary"
        className="academic-tabs"
        role="tablist"
        aria-label="Result subjects"
      >
        {subjects.map((s, i) => (
          <button
            role="tab"
            id={`result-subject-${i}`}
            tabIndex={i === index ? 0 : -1}
            onKeyDown={(event) =>
              tabKeyboard(
                event,
                i,
                subjects.map((_, position) => String(position)),
                (value) => setIndex(Number(value)),
                (value) => `result-subject-${value}`,
              )
            }
            aria-selected={i === index}
            key={s.subjectId ?? s.name}
            onClick={() => setIndex(i)}
          >
            {s.name}
          </button>
        ))}
      </TabRail>
      {data && subject ? (
        <>
          <dl className="academic-subject-stats">
            <div>
              <dt>Maximum Marks</dt>
              <dd>{subject.maxMarks}</dd>
            </div>
            <div>
              <dt>Class Average</dt>
              <dd>{data.average === null ? '—' : `${data.average.toFixed(1)}%`}</dd>
            </div>
            <div>
              <dt>Highest</dt>
              <dd>{data.highest === null ? '—' : `${data.highest}/${subject.maxMarks}`}</dd>
            </div>
            <div>
              <dt>Absent</dt>
              <dd>{data.absent}</dd>
            </div>
          </dl>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Roll No.</th>
                  <th>Student</th>
                  <th>Marks</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.enrollment.id}>
                    <td>{r.rank ? `#${r.rank}` : '—'}</td>
                    <td>{r.enrollment.rollNumber}</td>
                    <td>
                      <Link
                        className="text-link"
                        to={studentHistoryUrl(r.student.id, exam.id, from)}
                      >
                        {r.student.name}
                      </Link>
                    </td>
                    <td>
                      {r.pending ? (
                        <Badge tone="amber">Pending</Badge>
                      ) : r.absent ? (
                        <Badge>Absent</Badge>
                      ) : (
                        `${r.cell!.marks}/${subject.maxMarks}`
                      )}
                    </td>
                    <td>{r.percentage === null ? '—' : `${r.percentage.toFixed(1)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panel-note">
            Average includes recorded absences as zero. Pending marks are excluded. {data.pending}{' '}
            pending.
          </p>
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
                  data.rows.map((r) => [
                    r.enrollment.rollNumber,
                    r.student.name,
                    ...subjects.flatMap((s) => {
                      const mark = state.results
                        .find(
                          (result) =>
                            result.examId === exam.id && result.enrollmentId === r.enrollment.id,
                        )
                        ?.subjects.find((cell) =>
                          s.subjectId
                            ? cell.subjectId === s.subjectId
                            : subjectName(state, section?.classId ?? '', cell) === s.name,
                        );
                      return [
                        !mark || mark.pending
                          ? 'Pending'
                          : mark.absent ||
                              state.results.find(
                                (result) =>
                                  result.examId === exam.id &&
                                  result.enrollmentId === r.enrollment.id,
                              )?.absent
                            ? 'Absent'
                            : mark.marks,
                        s.maxMarks,
                      ];
                    }),
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
