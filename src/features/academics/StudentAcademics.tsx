import { useState } from 'react';
import { FileText, CalendarDays, ChevronRight, MessageCircle } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { Badge, Button, EmptyState, Modal, Panel } from '../../components/ui/Primitives';
import { resultSummary, roster } from '../../lib/selectors';
import { displayDate } from '../../lib/config';
import ShareReportDialog from './ShareReportDialog';
import './student-academics.css';
export function StudentAcademics({ enrollmentId }: { enrollmentId: string }) {
  const state = useSchool();
  const [requestedExamId, setExam] = useState('');
  const [report, setReport] = useState(false);
  const [sharing, setSharing] = useState(false);
  const row = roster(state, true).find((r) => r.enrollment.id === enrollmentId);
  if (!row) return null;
  const exams = state.exams
    .filter(
      (e) =>
        e.schoolId === state.school.id &&
        e.academicYearId === state.academicYear.id &&
        (!e.classId || e.classId === row.enrollment.classId) &&
        (!e.sectionId || e.sectionId === row.enrollment.sectionId),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!exams.length)
    return (
      <EmptyState
        title="No examinations yet"
        description="Add a test in Academics to start tracking this student's results."
      />
    );
  const selected =
    exams.find((e) => e.id === requestedExamId) ??
    exams.find((e) =>
      state.results.some((r) => r.enrollmentId === enrollmentId && r.examId === e.id),
    ) ??
    exams[0];
  const examId = selected.id;
  const result = state.results.find(
    (r) => r.schoolId === state.school.id && r.enrollmentId === enrollmentId && r.examId === examId,
  );
  const previous = state.results.find(
    (r) => r.enrollmentId === enrollmentId && r.examId === 'exam-unit',
  );
  const summary = result ? resultSummary(result) : null;
  const comparison =
    previous && summary ? summary.percentage - resultSummary(previous).percentage : 0;
  const marksTable =
    result && summary ? (
      <div className="table-wrap" role="region" aria-label="Subject marks" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Marks obtained</th>
              <th>Maximum marks</th>
              <th>Percentage</th>
              <th>Performance</th>
            </tr>
          </thead>
          <tbody>
            {result.subjects.map((s) => (
              <tr key={s.name}>
                <td>
                  <strong>{s.name}</strong>
                </td>
                <td>{s.marks}</td>
                <td>{s.maxMarks}</td>
                <td>{((s.marks / s.maxMarks) * 100).toFixed(1)}%</td>
                <td>
                  <div className="progress subject-progress">
                    <span style={{ width: `${((s.marks / s.maxMarks) * 100).toFixed(1)}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td>{summary.marks}</td>
              <td>{summary.maximum}</td>
              <td>{summary?.percentage ?? '—'}%</td>
              <td>{result.absent ? 'Absent' : `Grade ${summary.grade}`}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    ) : (
      <EmptyState
        title="Marks pending"
        description="This test has been added. Marks have not been entered for this student yet."
      />
    );
  return (
    <>
      <div className="academic-summary">
        <div>
          <Badge tone="blue">ACADEMIC PROGRESS</Badge>
          <h2>Room to learn. Reasons to celebrate.</h2>
          <p>
            {state.exams.find((e) => e.id === examId)?.name} ·{' '}
            {displayDate(state.exams.find((e) => e.id === examId)!.date)}
          </p>
        </div>
        <div className="academic-score">
          <strong>
            {summary?.percentage ?? '—'}
            {summary && <span>%</span>}
          </strong>
          <Badge tone={summary ? 'green' : 'amber'}>
            {!summary ? 'Pending' : result?.absent ? 'Absent' : `Grade ${summary.grade}`}
          </Badge>
        </div>
      </div>
      <Panel
        className="student-results-panel"
        title="Subject-wise results"
        subtitle={
          examId === 'exam-midterm'
            ? `${comparison >= 0 ? '+' : ''}${comparison.toFixed(1)} percentage points vs. Unit Assessment I`
            : 'Marks and percentages use this test’s subject maximums'
        }
        action={
          <div className="inline-actions">
            <select
              aria-label="Student examination"
              value={examId}
              onChange={(e) => setExam(e.target.value)}
            >
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <Button variant="secondary" disabled={!result} onClick={() => setReport(true)}>
              <FileText size={15} />
              Report preview
            </Button>
            <Button
              variant="secondary"
              className="whatsapp-share"
              disabled={!result}
              onClick={() => setSharing(true)}
            >
              <MessageCircle size={15} />
              Share on WhatsApp
            </Button>
          </div>
        }
      >
        {marksTable}
      </Panel>
      <Panel
        className="student-history-panel"
        title="Examination history"
        subtitle="Newest first · Select a test to see the subject-wise report."
        action={<Badge>{exams.length} tests</Badge>}
      >
        <div className="student-exam-list">
          {exams.map((e) => {
            const result = state.results.find(
              (r) => r.enrollmentId === enrollmentId && r.examId === e.id,
            );
            const data = result ? resultSummary(result) : null;
            return (
              <button
                key={e.id}
                onClick={() => setExam(e.id)}
                aria-pressed={examId === e.id}
                className={`student-exam-row ${examId === e.id ? 'selected' : ''}`}
              >
                <span className="student-exam-icon">
                  <CalendarDays size={19} />
                </span>
                <span className="student-exam-name">
                  <strong>{e.name}</strong>
                  <small>
                    {displayDate(e.date)} <span aria-hidden="true">·</span> {e.kind}
                  </small>
                </span>
                <span className="student-exam-marks">
                  <small>Marks</small>
                  <strong>{data ? `${data.marks} / ${data.maximum}` : '—'}</strong>
                </span>
                <span className="student-exam-percentage">
                  <strong>{data ? `${data.percentage}%` : '—'}</strong>
                  <Badge tone={data ? 'green' : 'amber'}>
                    {!data ? 'Pending' : result?.absent ? 'Absent' : `Grade ${data.grade}`}
                  </Badge>
                </span>
                <ChevronRight className="student-exam-chevron" size={17} />
              </button>
            );
          })}
        </div>
      </Panel>
      <Modal
        wide
        open={report}
        onClose={() => setReport(false)}
        title="Academic report preview"
        description="Review the student’s academic report before printing."
      >
        <div className="printable">
          <div className="report-heading">
            <h2>{state.school.name}</h2>
            <p>
              {state.exams.find((e) => e.id === examId)?.name} · {state.academicYear.name}
            </p>
            <h3>{row.student.name}</h3>
            <p>
              {row.student.admissionNumber} · {row.className}, Section {row.sectionName}
            </p>
          </div>
          {marksTable}
          <p className="panel-note">Grading: A+ ≥90 · A ≥80 · B+ ≥70 · B ≥60 · C ≥50 · D &lt;50.</p>
        </div>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setReport(false)}>
            Close
          </Button>
          <Button
            variant="secondary"
            className="whatsapp-share"
            disabled={!result}
            onClick={() => {
              setReport(false);
              setSharing(true);
            }}
          >
            <MessageCircle size={15} />
            Share on WhatsApp
          </Button>
          <Button onClick={() => window.print()}>Print report</Button>
        </div>
      </Modal>
      {sharing && (
        <ShareReportDialog
          row={row}
          exams={exams}
          selectedExamId={examId}
          onClose={() => setSharing(false)}
        />
      )}
    </>
  );
}
