import { examIncludes } from '../../lib/academicSheets';
import { classSubjects, resolvedResult } from '../../lib/classSubjects';
import { StudentProfileBridge } from '../students/studentProfileBridge';
import { useContext, useEffect, useMemo, useState } from 'react';
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
  const bridge = useContext(StudentProfileBridge);
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

  const isAll = requestedExamId === 'all';
  const selected =
    exams.find((e) => e.id === requestedExamId) ??
    exams.find((e) =>
      state.results.some((r) => r.enrollmentId === enrollmentId && r.examId === e.id),
    ) ??
    exams[0];

  useEffect(() => {
    if (isAll) return;
    if (selected && params.get('exam') !== selected.id) {
      const next = new URLSearchParams(params);
      next.set('exam', selected.id);
      setParams(next, { replace: true });
    }
  }, [isAll, params, selected, setParams]);

  // Cumulative performance across all tests for this student
  const cumulativeData = useMemo(() => {
    if (!row) {
      return {
        totalMarks: 0,
        totalMaxMarks: 0,
        scoredTestsCount: 0,
        percentage: 0,
        grade: '—',
        subjects: [],
      };
    }

    const subjectMap = new Map<
      string,
      {
        name: string;
        marks: number;
        maxMarks: number;
        testsCount: number;
        scoredTestsCount: number;
        absentCount: number;
        pendingCount: number;
      }
    >();

    let totalMarks = 0;
    let totalMaxMarks = 0;
    let scoredTestsCount = 0;

    exams.forEach((e) => {
      const rec = state.results.find(
        (r) => r.schoolId === state.school.id && r.enrollmentId === enrollmentId && r.examId === e.id,
      );
      if (!rec) return;
      const res = resolvedResult(state, rec);
      const summ = resultSummary(res);
      if (summ.maximum > 0) {
        scoredTestsCount++;
        totalMarks += summ.marks;
        totalMaxMarks += summ.maximum;
      }

      res.subjects.forEach((s) => {
        const subName = s.name.trim();
        const existing = subjectMap.get(subName) ?? {
          name: subName,
          marks: 0,
          maxMarks: 0,
          testsCount: 0,
          scoredTestsCount: 0,
          absentCount: 0,
          pendingCount: 0,
        };

        existing.testsCount++;
        if (s.pending) {
          existing.pendingCount++;
        } else if (res.absent || s.absent) {
          existing.absentCount++;
        } else {
          existing.scoredTestsCount++;
          existing.marks += s.marks;
          existing.maxMarks += s.maxMarks;
        }

        subjectMap.set(subName, existing);
      });
    });

    const officialSubjects = classSubjects(state, row.enrollment.classId);
    const orderMap = new Map(officialSubjects.map((s, idx) => [s.name.toLowerCase().trim(), idx]));

    const subjectsList = Array.from(subjectMap.values()).map((sub) => {
      const percentage = sub.maxMarks > 0 ? (sub.marks / sub.maxMarks) * 100 : null;
      const grade =
        percentage === null
          ? '—'
          : percentage >= 90
            ? 'A+'
            : percentage >= 80
              ? 'A'
              : percentage >= 70
                ? 'B+'
                : percentage >= 60
                  ? 'B'
                  : percentage >= 50
                    ? 'C'
                    : 'D';
      return {
        ...sub,
        percentage,
        grade,
      };
    });

    subjectsList.sort((a, b) => {
      const orderA = orderMap.has(a.name.toLowerCase().trim())
        ? orderMap.get(a.name.toLowerCase().trim())!
        : 999;
      const orderB = orderMap.has(b.name.toLowerCase().trim())
        ? orderMap.get(b.name.toLowerCase().trim())!
        : 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });

    const overallPercentage = totalMaxMarks > 0 ? (totalMarks / totalMaxMarks) * 100 : 0;
    const overallGrade =
      !totalMaxMarks
        ? '—'
        : overallPercentage >= 90
          ? 'A+'
          : overallPercentage >= 80
            ? 'A'
            : overallPercentage >= 70
              ? 'B+'
              : overallPercentage >= 60
                ? 'B'
                : overallPercentage >= 50
                  ? 'C'
                  : 'D';

    return {
      totalMarks,
      totalMaxMarks,
      scoredTestsCount,
      percentage: overallPercentage,
      grade: overallGrade,
      subjects: subjectsList,
    };
  }, [exams, state, enrollmentId, row]);

  if (!row) return null;
  const scopedParams = new URLSearchParams({
    ...(bridge ? { year: state.academicYear.id } : {}),
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

  const examId = isAll ? 'all' : selected.id;
  const returnParams = new URLSearchParams(params);
  returnParams.set('tab', 'academics');
  returnParams.set('exam', examId);
  const manageParams = new URLSearchParams(scopedParams);
  manageParams.set('test', selected.id);
  manageParams.set('marks', '1');
  manageParams.set('student', row.student.id);
  manageParams.set('returnTo', `${location.pathname}?${returnParams}`);
  const managePath = `/academics?${manageParams}`;

  const selectExam = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('exam', id);
    setParams(next);
  };

  const recordedResult = !isAll
    ? state.results.find(
        (r) =>
          r.schoolId === state.school.id &&
          r.enrollmentId === enrollmentId &&
          r.examId === selected.id,
      )
    : undefined;
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

  const overallMarksTable =
    cumulativeData.totalMaxMarks > 0 ? (
      <div
        className="table-wrap"
        role="region"
        aria-label="Overall subject marks"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Tests evaluated</th>
              <th>Total marks obtained</th>
              <th>Total maximum marks</th>
              <th>Overall percentage</th>
              <th>Performance</th>
            </tr>
          </thead>
          <tbody>
            {cumulativeData.subjects.map((s) => (
              <tr key={s.name}>
                <td>
                  <strong>{s.name}</strong>
                </td>
                <td>
                  {s.absentCount > 0 ? (
                    <span>
                      {s.scoredTestsCount} of {s.testsCount} tests{' '}
                      <small style={{ color: '#d97706' }}>({s.absentCount} absent)</small>
                    </span>
                  ) : s.pendingCount > 0 ? (
                    <span>
                      {s.scoredTestsCount} of {s.testsCount} tests{' '}
                      <small style={{ color: '#64748b' }}>({s.pendingCount} pending)</small>
                    </span>
                  ) : (
                    `${s.scoredTestsCount} ${s.scoredTestsCount === 1 ? 'test' : 'tests'}`
                  )}
                </td>
                <td>
                  {s.maxMarks > 0 ? (
                    s.marks
                  ) : s.pendingCount > 0 ? (
                    <Badge tone="amber">Pending</Badge>
                  ) : (
                    <Badge tone="amber">Absent</Badge>
                  )}
                </td>
                <td>{s.maxMarks > 0 ? s.maxMarks : '—'}</td>
                <td>{s.percentage !== null ? `${s.percentage.toFixed(1)}%` : '—'}</td>
                <td>
                  {s.percentage !== null ? (
                    <div className="progress subject-progress">
                      <span style={{ width: `${s.percentage.toFixed(1)}%` }} />
                    </div>
                  ) : s.pendingCount > 0 ? (
                    <Badge tone="amber">Pending</Badge>
                  ) : (
                    <Badge tone="amber">Absent</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total (All Subjects)</td>
              <td>{cumulativeData.scoredTestsCount} evaluated tests</td>
              <td>{cumulativeData.totalMarks}</td>
              <td>{cumulativeData.totalMaxMarks}</td>
              <td>{`${cumulativeData.percentage.toFixed(1)}%`}</td>
              <td>Grade {cumulativeData.grade}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    ) : (
      <EmptyState
        title="No evaluated tests yet"
        description="Cumulative marks will appear here once marks are entered for this student in at least one test."
      />
    );

  return (
    <>
      {backToResults && (
        <Link className="student-academics-back" to={backToResults}>
          <ArrowLeft size={15} /> Back to class results
        </Link>
      )}
      <section
        className="panel student-test-context"
        aria-label={isAll ? 'Overall academic performance' : 'Selected test result'}
      >
        <div className="student-test-context-heading">
          <div>
            <h2>{isAll ? 'Overall Academic Performance' : 'Selected Test Result'}</h2>
            <p>
              {isAll
                ? 'Cumulative performance and subject-wise breakdown across all tests.'
                : 'Results below belong to this test.'}
            </p>
          </div>
          {(!bridge || bridge.manageMarks) && (
            <Link className="button secondary" to={isAll ? academicsPath : managePath}>
              <AppIcon name={isAll ? 'document' : 'edit'} size={16} />
              {isAll ? 'View class tests' : 'Manage marks'}
            </Link>
          )}
        </div>
        <div className="student-test-context-body">
          <label className="student-test-selector">
            <span>Test</span>
            <select
              aria-label="Student examination"
              value={examId}
              onChange={(e) => selectExam(e.target.value)}
            >
              <option value="all">All Tests (Overall Performance)</option>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <small>
              {isAll
                ? `${exams.length} tests in academic session`
                : displayDate(selected.date)}
            </small>
          </label>
          <div className="student-selected-marks">
            <span>Marks obtained</span>
            <strong>
              {isAll
                ? cumulativeData.totalMaxMarks > 0
                  ? `${cumulativeData.totalMarks} / ${cumulativeData.totalMaxMarks}`
                  : '—'
                : !summary || result?.absent
                  ? '—'
                  : `${summary.marks} / ${summary.maximum}`}
            </strong>
            <small>
              {isAll
                ? cumulativeData.totalMaxMarks > 0
                  ? `Across ${cumulativeData.scoredTestsCount} evaluated tests`
                  : 'No test marks recorded yet'
                : result?.absent
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
              {isAll
                ? cumulativeData.totalMaxMarks > 0
                  ? `${cumulativeData.percentage.toFixed(1)}%`
                  : '—'
                : result?.absent
                  ? 'Absent'
                  : !summary?.maximum
                    ? 'Pending'
                    : `${summary.percentage.toFixed(1)}%`}
            </strong>
            <Badge
              tone={
                isAll
                  ? cumulativeData.totalMaxMarks > 0
                    ? 'green'
                    : 'amber'
                  : !summary?.maximum || result?.absent
                    ? 'amber'
                    : 'green'
              }
            >
              {isAll
                ? cumulativeData.totalMaxMarks > 0
                  ? `Grade ${cumulativeData.grade}`
                  : 'Pending'
                : result?.absent
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
        title={isAll ? 'Overall subject-wise performance' : 'Subject-wise results'}
        subtitle={
          isAll
            ? 'Cumulative marks, percentage, and performance across all tests.'
            : result?.absent
              ? 'This student was recorded absent for the selected test.'
              : 'Marks and percentages use this test’s subject maximums.'
        }
        action={
          <div className="inline-actions">
            <Button
              variant="secondary"
              disabled={isAll ? !cumulativeData.totalMaxMarks : !summary}
              onClick={() => setReport(true)}
            >
              <AppIcon name="document" size={16} />
              Report preview
            </Button>
            <Button
              variant="secondary"
              className="whatsapp-share"
              disabled={isAll ? !cumulativeData.totalMaxMarks : !summary}
              onClick={() => setSharing(true)}
            >
              <AppIcon name="send" size={16} />
              Share on WhatsApp
            </Button>
          </div>
        }
      >
        {isAll ? overallMarksTable : marksTable}
      </Panel>

      <Panel
        className="student-history-panel"
        title="Examination history"
        subtitle="Newest first · Select a test to see the subject-wise report."
        action={<Badge>{exams.length} tests</Badge>}
      >
        <div className="student-exam-list">
          <button
            onClick={() => selectExam('all')}
            aria-pressed={isAll}
            className={`student-exam-row overall-exam-row ${isAll ? 'selected' : ''}`}
          >
            <span className="student-exam-icon overall-icon">
              <AppIcon name="trophy" size={19} />
            </span>
            <span className="student-exam-name">
              <strong>All Tests (Overall Performance)</strong>
              <small>Cumulative summary · {exams.length} tests</small>
            </span>
            <span className="student-exam-marks">
              <small>Total Marks</small>
              <strong>
                {cumulativeData.totalMaxMarks > 0
                  ? `${cumulativeData.totalMarks} / ${cumulativeData.totalMaxMarks}`
                  : '—'}
              </strong>
            </span>
            <span className="student-exam-percentage">
              <strong>
                {cumulativeData.totalMaxMarks > 0
                  ? `${cumulativeData.percentage.toFixed(1)}%`
                  : '—'}
              </strong>
              <Badge tone={cumulativeData.totalMaxMarks > 0 ? 'green' : 'amber'}>
                {cumulativeData.totalMaxMarks > 0 ? `Grade ${cumulativeData.grade}` : 'Pending'}
              </Badge>
            </span>
            <ChevronRight className="student-exam-chevron" size={17} />
          </button>
          {exams.map((e) => {
            const result = state.results.find(
              (r) => r.enrollmentId === enrollmentId && r.examId === e.id,
            );
            const data = result && resultSummary(result).maximum ? resultSummary(result) : null;
            return (
              <button
                key={e.id}
                onClick={() => selectExam(e.id)}
                aria-pressed={!isAll && selected.id === e.id}
                className={`student-exam-row ${!isAll && selected.id === e.id ? 'selected' : ''}`}
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
        title={isAll ? 'Cumulative academic report preview' : 'Academic report preview'}
        description={
          isAll
            ? 'Review the student’s cumulative session report before printing.'
            : 'Review the student’s academic report before printing.'
        }
      >
        <div className="printable">
          <div className="report-heading">
            <h2>{state.school.name}</h2>
            <p>
              {isAll
                ? `Overall Academic Performance (${cumulativeData.scoredTestsCount} Tests) · ${state.academicYear.name}`
                : `${state.exams.find((e) => e.id === selected.id)?.name} · ${state.academicYear.name}`}
            </p>
            <h3>{row.student.name}</h3>
            <p>
              {row.student.admissionNumber} · {row.className}, Section {row.sectionName}
            </p>
          </div>
          {isAll ? overallMarksTable : marksTable}
          <p className="panel-note">Grading: A+ ≥90 · A ≥80 · B+ ≥70 · B ≥60 · C ≥50 · D &lt;50.</p>
        </div>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setReport(false)}>
            Close
          </Button>
          <Button
            variant="secondary"
            className="whatsapp-share"
            disabled={isAll ? !cumulativeData.totalMaxMarks : !summary}
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
          selectedExamId={isAll ? 'all' : selected.id}
          onClose={() => setSharing(false)}
        />
      )}
    </>
  );
}
