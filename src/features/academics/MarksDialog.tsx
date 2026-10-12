import { useState } from 'react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { Badge, Button, Modal } from '../../components/ui/Primitives';
import { repository } from '../../lib/repository';
import type { Examination, RosterEntry } from '../../types/domain';
import { useDraftGuard } from './useDraftGuard';
export default function MarksDialog({
  exam,
  students,
  onClose,
}: {
  exam: Examination;
  students: RosterEntry[];
  onClose: () => void;
}) {
  const state = useSchool();
  const notify = useFeedback();
  const [initial] = useState(() =>
    Object.fromEntries(
      students.map((r) => {
        const result = state.results.find(
          (x) =>
            x.schoolId === state.school.id &&
            x.examId === exam.id &&
            x.enrollmentId === r.enrollment.id,
        );
        return [
          r.enrollment.id,
          {
            marks: exam.subjects.map((_, i) => (result ? String(result.subjects[i].marks) : '')),
            absent: result?.absent ?? false,
          },
        ];
      }),
    ),
  );
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState('');
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const guard = useDraftGuard(dirty, onClose);
  const absent = Object.values(draft).filter((r) => r.absent).length;
  const recorded = Object.values(draft).filter(
    (r) => r.absent || r.marks.every((m) => m.trim() !== ''),
  ).length;
  return (
    <Modal
      open
      wide
      onClose={guard.confirming ? guard.keepEditing : guard.requestClose}
      title={guard.confirming ? 'Leave unsaved marks?' : 'Enter marks'}
      description={
        guard.confirming
          ? 'Keep editing to save your marks, or discard this draft.'
          : `${exam.name} · Leave a whole row blank for pending results. Mark absent students separately.`
      }
    >
      {guard.confirming ? (
        <div className="modal-actions">
          <Button variant="secondary" onClick={guard.keepEditing}>
            Keep editing
          </Button>
          <Button variant="danger" onClick={guard.discard}>
            Discard changes
          </Button>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            try {
              for (const row of Object.values(draft)) {
                if (
                  !row.absent &&
                  row.marks.some((m) => m.trim() !== '') &&
                  row.marks.some((m) => m.trim() === '')
                )
                  throw new Error(
                    'Complete every subject for a student, or leave their whole row blank to enter later.',
                  );
              }
              repository.saveTestMarks(
                exam.id,
                Object.entries(draft).map(([enrollmentId, row]) => ({
                  enrollmentId,
                  absent: row.absent,
                  marks: row.marks.every((m) => m.trim() === '') ? null : row.marks.map(Number),
                })),
              );
              notify('Marks saved. Results and rankings are up to date.');
              onClose();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Unable to save marks.');
            }
          }}
        >
          <div className="marks-entry-summary">
            <Badge tone="blue">
              {recorded - absent} took test · {absent} absent · {students.length - recorded} pending
            </Badge>
            <span>Absent students are tracked separately · Blank = pending</span>
          </div>
          <div className="table-wrap marks-entry-table">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  {exam.subjects.map((s) => (
                    <th key={s.name}>
                      {s.name}
                      <small>out of {s.maxMarks}</small>
                    </th>
                  ))}
                  <th>Absent</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {students.map((r) => {
                  const row = draft[r.enrollment.id];
                  return (
                    <tr key={r.enrollment.id}>
                      <td>
                        <strong>{r.student.name}</strong>
                        <small>
                          Section {r.sectionName} · Roll {r.enrollment.rollNumber}
                        </small>
                      </td>
                      {exam.subjects.map((subject, i) => (
                        <td key={subject.name}>
                          <input
                            aria-label={`${r.student.name} ${subject.name} marks`}
                            type="number"
                            min="0"
                            max={subject.maxMarks}
                            step="any"
                            disabled={row.absent}
                            value={row.absent ? '' : row.marks[i]}
                            placeholder="—"
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                [r.enrollment.id]: {
                                  ...row,
                                  marks: row.marks.map((v, j) => (i === j ? e.target.value : v)),
                                },
                              })
                            }
                          />
                        </td>
                      ))}
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`${r.student.name} absent`}
                          checked={row.absent}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              [r.enrollment.id]: { ...row, absent: e.target.checked },
                            })
                          }
                        />
                      </td>
                      <td>
                        {row.absent
                          ? '0'
                          : row.marks.every((m) => m.trim() !== '')
                            ? row.marks.reduce((n, m) => n + Number(m), 0)
                            : 'Pending'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={guard.requestClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!dirty}>
              Save marks
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
