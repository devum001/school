import { examIncludes } from '../../lib/academicSheets';
import { resolvedResult } from '../../lib/classSubjects';
import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { CalendarDays, ChevronRight, ArrowLeft } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { AppIcon, Badge, Button, EmptyState, Modal, Panel } from '../../components/ui/Primitives';
import { resultSummary, roster } from '../../lib/selectors';
import { displayDate } from '../../lib/config';
import ShareReportDialog from './ShareReportDialog';
import './student-academics.css';

function classResultsPath(value: string | null) {
  if (!value?.startsWith('/') || value.startsWith('//')) return null;
  try {
    const url = new URL(value, 'https://schoolwell.local');
    return url.origin === 'https://schoolwell.local' && url.pathname === '/academics'
      ? `${url.pathname}${url.search}`
      : null;
  } catch {
    return null;
  }
}

export function StudentAcademics({ enrollmentId }: { enrollmentId: string }) {
  const state = useSchool();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const requestedExamId = params.get('exam');
  const [report, setReport] = useState(false);
  const [sharing, setSharing] = useState(false);
  const row = roster(state, true).find((r) => r.enrollment.id === enrollmentId);
  const exams = state.exams
    .filter(
      (e) =>
        e.schoolId === state.school.id &&
        e.academicYearId === state.academicYear.id &&
        !!row &&
        (!e.classId || e.classId === row.enrollment.classId) &&
        examIncludes(e, row.enrollment.classId, row.enrollment.sectionId),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const selected =
    exams.find((e) => e.id === requestedExamId) ??
    exams.find((e) =>
      state.results.some((r) => r.enrollmentId === enrollmentId && r.examId === e.id),
    ) ??
    exams[0];
  useEffect(() => {
    if (selected && params.get('exam') !== selected.id) {
      const next = new URLSearchParams(params);
      next.set('exam', selected.id);
      setParams(next, { replace: true });
    }
  }, [params, selected, setParams]);
  if (!row) return null;
  const scopedParams = new URLSearchParams({
    class: row.enrollment.classId,
    section: row.enrollment.sectionId,
  });
  const academicsPath = `/academics?${scopedParams}`;
  const backToResults = classResultsPath(params.get('from'));
  if (!selected)
    return (
      <Panel className="student-results-panel">
        <EmptyState
          title="No tests for this student yet"
          description="Create a test for this class or section in Test and Result. Saved marks will appear here."
          action={
            <Link className="button secondary" to={academicsPath}>
              Open class tests
            </Link>
          }
        />
      </Panel>
    );
  const examId = selected.id;
  const returnParams = new URLSearchParams(params);
  returnParams.set('tab', 'academics');
  returnParams.set('exam', examId);
  const manageParams = new URLSearchParams(scopedParams);
  manageParams.set('test', examId);
  manageParams.set('marks', '1');
  manageParams.set('student', row.student.id);
  manageParams.set('returnTo', `${location.pathname}?${returnParams}`);
  const managePath = `/academics?${manageParams}`;
  const selectExam = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('exam', id);
    setParams(next);
  };
  const recordedResult = state.results.find(
    (r) => r.schoolId === state.school.id && r.enrollmentId === enrollmentId && r.examId === examId,
  );
  const result = recordedResult ? resolvedResult(state, recordedResult) : undefined;
  const summary = result ? resultSummary(result) : null;
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
                <td>{s.pending ? 'Pending' : result.absent || s.absent ? 'Absent' : s.marks}</td>
                <td>{s.maxMarks}</td>
                <td>
                  {s.pending || result.absent || s.absent
                    ? '—'
                    : `${((s.marks / s.maxMarks) * 100).toFixed(1)}%`}
                </td>
                <td>
                  {s.pending ? (
                    <Badge tone="amber">Pending</Badge>
                  ) : result.absent || s.absent ? (
                    <Badge tone="amber">Absent</Badge>
                  ) : (
                    <div className="progress subject-progress">
                      <span style={{ width: `${((s.marks / s.maxMarks) * 100).toFixed(1)}%` }} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td>{summary.maximum ? summary.marks : '—'}</td>
              <td>{summary.maximum || '—'}</td>
              <td>{summary.maximum ? `${summary.percentage.toFixed(1)}%` : '—'}</td>
              <td>
                {result.absent
                  ? 'Absent'
                  : !summary.maximum
                    ? 'Awaiting marks'
                    : `Grade ${summary.grade}`}
              </td>
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
      {backToResults && (
        <Link className="student-academics-back" to={backToResults}>
          <ArrowLeft size={15} /> Back to class results
        </Link>
      )}
      <section className="panel student-test-context" aria-label="Selected test result">
        <div className="student-test-context-heading">
          <div>
            <h2>Selected Test Result</h2>
            <p>Results below belong to this test.</p>
          </div>
          <Link className="button secondary" to={managePath}>
            <AppIcon name="edit" size={16} /> Manage marks
          </Link>
        </div>
        <div className="student-test-context-body">
          <label className="student-test-selector">
            <span>Test</span>
            <select
              aria-label="Student examination"
              value={examId}
              onChange={(e) => selectExam(e.target.value)}
            >
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <small>{displayDate(selected.date)}</small>
          </label>
          <div className="student-selected-marks">
            <span>Marks obtained</span>
            <strong>
              {!summary || result?.absent ? '—' : `${summary.marks} / ${summary.maximum}`}
            </strong>
            <small>
              {result?.absent
                ? 'No marks recorded for an absence'
                : !summary
                  ? 'Marks have not been entered yet'
                  : result?.subjects.some((s) => s.pending)
                    ? 'Provisional · Some subject marks are pending'
                    : 'Across this test’s subjects'}
            </small>
          </div>
          <div className="student-selected-score">
            <strong>
              {result?.absent
                ? 'Absent'
                : !summary?.maximum
                  ? 'Pending'
                  : `${summary.percentage.toFixed(1)}%`}
            </strong>
            <Badge tone={!summary?.maximum || result?.absent ? 'amber' : 'green'}>
              {result?.absent
                ? 'Recorded absence'
                : !summary?.maximum
                  ? 'Awaiting marks'
                  : `Grade ${summary.grade}`}
            </Badge>
          </div>
        </div>
      </section>
      <Panel
        className="student-results-panel"
        title="Subject-wise results"
        subtitle={
          result?.absent
            ? 'This student was recorded absent for the selected test.'
            : 'Marks and percentages use this test’s subject maximums.'
        }
        action={
          <div className="inline-actions">
            <Button variant="secondary" disabled={!summary} onClick={() => setReport(true)}>
              <AppIcon name="document" size={16} />
              Report preview
            </Button>
            <Button
              variant="secondary"
              className="whatsapp-share"
              disabled={!summary}
              onClick={() => setSharing(true)}
            >
              <AppIcon name="send" size={16} />
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
            const data = result && resultSummary(result).maximum ? resultSummary(result) : null;
            return (
              <button
                key={e.id}
                onClick={() => selectExam(e.id)}
                aria-pressed={examId === e.id}
                className={`student-exam-row ${examId === e.id ? 'selected' : ''}`}
              >
                <span className="student-exam-icon">
                  <CalendarDays size={19} />
                </span>
                <span className="student-exam-name">
                  <strong>{e.name}</strong>
                  <small>{displayDate(e.date)}</small>
                </span>
                <span className="student-exam-marks">
                  <small>Marks</small>
                  <strong>
                    {data && !result?.absent ? `${data.marks} / ${data.maximum}` : '—'}
                  </strong>
                </span>
                <span className="student-exam-percentage">
                  <strong>
                    {result?.absent ? 'Absent' : data ? `${data.percentage.toFixed(1)}%` : '—'}
                  </strong>
                  <Badge tone={data && !result?.absent ? 'green' : 'amber'}>
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
            disabled={!summary}
            onClick={() => {
              setReport(false);
              setSharing(true);
            }}
          >
            <AppIcon name="send" size={16} />
            Share on WhatsApp
          </Button>
          <Button onClick={() => window.print()}>
            <AppIcon name="document" size={16} /> Print report
          </Button>
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
