import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  BookOpen,
  Clock3,
  Plus,
  ArrowLeft,
  ArrowUpRight,
  Trophy,
  Download,
  Star,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  PageHeading,
  Panel,
  SearchInput,
  StatCard,
} from '../../components/ui/Primitives';
import { ClassFilters } from '../../components/shared/ClassFilters';
import { resultSummary, roster } from '../../lib/selectors';
import {
  rankResults,
  testKinds,
  testResults,
  testRoster,
  testParticipation,
} from '../../lib/academics';
import { displayDate } from '../../lib/config';
import { downloadCsv } from '../../lib/download';
import { repository } from '../../lib/repository';
import TestDialog from './TestDialog';
import MarksDialog from './MarksDialog';
import TestAbsences from './TestAbsences';
import DeleteDialog from '../../components/shared/DeleteDialog';
import type { Examination } from '../../types/domain';
import '../../styles/management.css';
import './academics.css';

export default function AcademicsPage() {
  const state = useSchool();
  const [classId, setClass] = useState('class-5');
  const [sectionId, setSection] = useState('');
  const [kind, setKind] = useState('');
  const [month, setMonth] = useState('');
  const [examId, setExam] = useState('');
  const [tab, setTab] = useState('tests');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(10);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingTest, setEditingTest] = useState<Examination | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Examination | null>(null);
  const students = roster(state).filter(
    (r) => r.enrollment.classId === classId && (!sectionId || r.enrollment.sectionId === sectionId),
  );
  const exams = state.exams
    .filter(
      (e) =>
        e.schoolId === state.school.id &&
        e.academicYearId === state.academicYear.id &&
        (!e.classId || e.classId === classId) &&
        (!sectionId || !e.sectionId || e.sectionId === sectionId) &&
        (!kind || e.kind === kind) &&
        (!month || e.date.startsWith(month)),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
  const exam = exams.find((e) => e.id === examId);
  const summaries = exams.map((e) => {
    const eligible = testRoster(state, e).filter((r) =>
      students.some((s) => s.enrollment.id === r.enrollment.id),
    );
    return { exam: e, ...testParticipation(state, e, eligible) };
  });
  const selectedStudents = exam
    ? testRoster(state, exam).filter((r) =>
        students.some((s) => s.enrollment.id === r.enrollment.id),
      )
    : students;
  const ranking = rankResults(state, selectedStudents, exam ? [exam] : exams, !exam);
  const leaders = ranking.rows.filter((r) => r.rank <= 3);
  const selectedResults = exam ? testResults(state, exam, selectedStudents) : [];
  const participation = exam ? testParticipation(state, exam, selectedStudents) : null;
  const pending = summaries.filter((s) => s.recorded < s.total).length;
  const average = participation
    ? participation.average
    : ranking.rows.length
      ? ranking.rows.reduce((n, r) => n + r.percentage, 0) / ranking.rows.length
      : null;
  const className = state.classes.find((c) => c.id === classId)?.name;
  const resetView = () => {
    setExam('');
    setQuery('');
    setLimit(10);
  };
  const matching = (name: string) => name.toLowerCase().includes(query.toLowerCase());
  const resultRows = exam
    ? selectedStudents
        .map((r) => ({
          ...r,
          result: selectedResults.find((s) => s.enrollmentId === r.enrollment.id),
          rank: ranking.rows.find((s) => s.enrollment.id === r.enrollment.id)?.rank,
        }))
        .sort(
          (a, b) =>
            (a.rank ?? Infinity) - (b.rank ?? Infinity) ||
            a.student.name.localeCompare(b.student.name),
        )
        .filter((r) => matching(r.student.name))
    : [];
  const exportResults = () =>
    downloadCsv(
      'class-results.csv',
      ['Student', 'Class', 'Section', 'Rank', 'Marks', 'Maximum', 'Percentage', 'Status'],
      exam
        ? resultRows.map((r) => {
            const s = r.result ? resultSummary(r.result) : null;
            return [
              r.student.name,
              r.className,
              r.sectionName,
              r.rank ?? '',
              s?.marks ?? '',
              s?.maximum ?? '',
              s?.percentage ?? '',
              !r.result ? 'Pending' : r.result.absent ? 'Absent' : 'Recorded',
            ];
          })
        : ranking.rows
            .filter((r) => matching(r.student.name))
            .map((r) => [
              r.student.name,
              r.className,
              r.sectionName,
              r.rank,
              r.marks,
              r.maximum,
              r.percentage.toFixed(1),
              `${r.count} completed tests`,
            ]),
    );
  return (
    <>
      <PageHeading
        eyebrow="EVERY TEST. A CLEARER PICTURE."
        title="Tests & results"
        description="Daily practice, monthly progress and major exams — together in one place."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} />
            Add test
          </Button>
        }
      />
      <div className="toolbar standalone academic-filters">
        <ClassFilters
          classId={classId}
          sectionId={sectionId}
          allowAll={false}
          onClassChange={(v) => {
            setClass(v);
            setSection('');
            resetView();
          }}
        />
        <label className="filter-label">
          <span>Section</span>
          <select
            aria-label="Results section"
            value={sectionId}
            onChange={(e) => {
              setSection(e.target.value);
              resetView();
            }}
          >
            <option value="">All sections</option>
            {state.sections
              .filter((s) => s.classId === classId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  Section {s.name}
                </option>
              ))}
          </select>
        </label>
        <label className="filter-label">
          <span>Test type</span>
          <select
            aria-label="Filter test type"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              resetView();
            }}
          >
            <option value="">All test types</option>
            {testKinds.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label className="filter-label">
          <span>Month</span>
          <input
            aria-label="Test month"
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              resetView();
            }}
          />
        </label>
        {(month || kind || sectionId) && (
          <Button
            variant="ghost"
            onClick={() => {
              setMonth('');
              setKind('');
              setSection('');
              resetView();
            }}
          >
            Clear filters
          </Button>
        )}
      </div>
      {exam && (
        <div className="test-detail-heading">
          <div>
            <Button variant="ghost" onClick={resetView}>
              <ArrowLeft size={15} />
              All tests
            </Button>
            <h2>{exam.name}</h2>
            <p>
              {exam.kind} · {displayDate(exam.date)} · {className}
              {sectionId
                ? ` · Section ${state.sections.find((s) => s.id === sectionId)?.name}`
                : ''}{' '}
              · {exam.subjects.reduce((n, s) => n + s.maxMarks, 0)} maximum marks
            </p>
          </div>
          <div className="management-row-actions">
            <Button variant="secondary" onClick={() => setEditingTest(exam)}>
              <Pencil size={15} />
              Edit test
            </Button>
            <Button
              variant="secondary"
              className="delete-action"
              onClick={() => setDeleteTarget(exam)}
            >
              <Trash2 size={15} />
              Delete test
            </Button>
            <Button onClick={() => setEditing(true)}>Enter / edit marks</Button>
          </div>
        </div>
      )}
      <div className="stats-grid three">
        <StatCard
          label={exam ? 'Took test' : 'Tests tracked'}
          value={participation ? `${participation.taken} / ${participation.total}` : exams.length}
          detail={
            exam
              ? `${participation!.absent} absent · ${participation!.pending} pending`
              : `${summaries.filter((s) => s.recorded === s.total && s.total > 0).length} complete · ${pending} awaiting marks`
          }
          icon={<BookOpen size={18} />}
        />
        <StatCard
          label={exam ? 'Test average' : 'Overall class average'}
          value={average === null ? '—' : `${average.toFixed(1)}%`}
          detail={
            exam
              ? 'Only students who took this test'
              : `${ranking.included.length} completed tests shared by this class / section`
          }
          icon={<Award size={18} />}
          tone="green"
        />
        <StatCard
          label={exam ? 'Marks pending' : 'Students in view'}
          value={exam ? selectedStudents.length - selectedResults.length : students.length}
          detail={
            exam
              ? 'Blank rows are not counted as zero'
              : `${className} · ${sectionId ? 'Selected section' : 'All sections'} · ${state.academicYear.name}`
          }
          icon={<Clock3 size={18} />}
          tone="amber"
        />
      </div>
      {exam && <TestAbsences key={exam.id} exam={exam} students={selectedStudents} />}
      <section className="results-leaders" aria-labelledby="leaders-heading">
        <div className="results-section-heading">
          <div>
            <h2 id="leaders-heading">
              <Trophy size={19} />
              {exam ? 'Top performers in this test' : 'Top performers overall'}
            </h2>
            <p>
              {exam
                ? selectedResults.length < selectedStudents.length
                  ? 'Provisional rankings · More marks are still to come.'
                  : 'All marks recorded. Equal scores share a rank.'
                : 'Total earned ÷ total maximum × 100. Completed tests only; equal scores share a rank.'}
            </p>
          </div>
          <Badge tone="amber">Top 3 ranks</Badge>
        </div>
        {leaders.length ? (
          <div className="leader-grid">
            {leaders.map((r) => (
              <Link
                key={r.enrollment.id}
                className={`leader-card place-${r.rank}`}
                to={`/students/${r.student.id}?tab=academics`}
              >
                <span className="leader-stars" aria-hidden="true">
                  {[0, 1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} />
                  ))}
                </span>
                <span className="rank-medal">{r.rank}</span>
                <Avatar name={r.student.name} />
                <div>
                  <strong>{r.student.name}</strong>
                  <small>
                    Section {r.sectionName} · {r.count} {r.count === 1 ? 'test' : 'tests'}
                  </small>
                </div>
                <div className="leader-score">
                  <strong>{r.percentage.toFixed(1)}%</strong>
                  <small>
                    {r.marks} / {r.maximum}
                  </small>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="panel rankings-empty">
            {exam
              ? 'No ranked results yet. Absent students are listed separately.'
              : 'Complete marks for a test shared by this class or section to see overall rankings.'}
          </div>
        )}
      </section>
      {!exam && (
        <div className="tabs">
          <button
            className={tab === 'tests' ? 'active' : ''}
            onClick={() => {
              setTab('tests');
              setQuery('');
            }}
          >
            Test history
          </button>
          <button
            className={tab === 'rankings' ? 'active' : ''}
            onClick={() => {
              setTab('rankings');
              setQuery('');
            }}
          >
            Overall rankings
          </button>
        </div>
      )}
      {!exam && tab === 'tests' ? (
        <>
          <Panel
            className="academic-history"
            title="Recent & earlier tests"
            subtitle="Newest first. Open any test to review results or enter marks."
            action={
              <SearchInput
                value={query}
                onChange={(v) => {
                  setQuery(v);
                  setLimit(10);
                }}
                placeholder="Search tests…"
              />
            }
          >
            <div className="table-wrap">
              <table className="tests-history-table">
                <thead>
                  <tr>
                    <th>Test</th>
                    <th>Date</th>
                    <th>Maximum</th>
                    <th>Test attendance</th>
                    <th>Class average</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {summaries
                    .filter((s) => matching(s.exam.name))
                    .slice(0, limit)
                    .map((s) => (
                      <tr key={s.exam.id}>
                        <td>
                          <button
                            className="test-name-button"
                            onClick={() => {
                              setExam(s.exam.id);
                              setQuery('');
                            }}
                          >
                            {s.exam.name}
                          </button>
                          <small>
                            {s.exam.kind} ·{' '}
                            {s.exam.sectionId
                              ? `Section ${state.sections.find((section) => section.id === s.exam.sectionId)?.name}`
                              : 'All sections'}
                          </small>
                        </td>
                        <td>{displayDate(s.exam.date)}</td>
                        <td>{s.exam.subjects.reduce((n, sub) => n + sub.maxMarks, 0)}</td>
                        <td>
                          <Badge tone={s.recorded === s.total ? 'green' : 'amber'}>
                            {s.recorded === s.total
                              ? 'Complete'
                              : s.recorded
                                ? 'In progress'
                                : 'Awaiting marks'}
                          </Badge>
                          <strong className="test-taken-count">
                            {s.taken} / {s.total} took test
                          </strong>
                          <div className="test-participation-breakdown">
                            <button
                              className="absence-count-link"
                              aria-label={`View ${s.absent} absent students for ${s.exam.name}`}
                              onClick={() => {
                                setExam(s.exam.id);
                                setQuery('');
                              }}
                            >
                              {s.absent} absent
                            </button>
                            <span>· {s.pending} pending</span>
                          </div>
                        </td>
                        <td>
                          <strong>{s.average === null ? '—' : `${s.average.toFixed(1)}%`}</strong>
                        </td>
                        <td>
                          <Button
                            variant="ghost"
                            aria-label={`View results for ${s.exam.name}`}
                            onClick={() => {
                              setExam(s.exam.id);
                              setQuery('');
                            }}
                          >
                            View results <ArrowUpRight size={15} />
                          </Button>
                          <div className="management-row-actions">
                            <Button
                              variant="ghost"
                              aria-label={`Edit ${s.exam.name}`}
                              onClick={() => setEditingTest(s.exam)}
                            >
                              <Pencil size={14} />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              className="delete-action"
                              aria-label={`Delete ${s.exam.name}`}
                              onClick={() => setDeleteTarget(s.exam)}
                            >
                              <Trash2 size={14} />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {!summaries.some((s) => matching(s.exam.name)) && (
              <EmptyState
                title="No tests found"
                description="Try another filter or add the first test for this class."
              />
            )}
            {summaries.filter((s) => matching(s.exam.name)).length > limit && (
              <div className="academic-load-more">
                <Button variant="secondary" onClick={() => setLimit(limit + 10)}>
                  Show earlier tests
                </Button>
              </div>
            )}
          </Panel>
          <Panel
            title="Recent test performance"
            subtitle="Average for students who took each test. Absent and pending students are excluded."
          >
            <div className="test-trend">
              {summaries
                .filter((s) => s.average !== null)
                .slice(0, 6)
                .reverse()
                .map((s) => (
                  <button
                    key={s.exam.id}
                    onClick={() => {
                      setExam(s.exam.id);
                      setQuery('');
                    }}
                  >
                    <span>
                      <strong>{s.exam.name}</strong>
                      <small>{displayDate(s.exam.date)}</small>
                    </span>
                    <span className="test-trend-track">
                      <span style={{ width: `${s.average}%` }} />
                    </span>
                    <b>{s.average!.toFixed(1)}%</b>
                  </button>
                ))}
              {!summaries.some((s) => s.average !== null) && (
                <p>Performance will appear here when marks are saved.</p>
              )}
            </div>
          </Panel>
        </>
      ) : (
        <Panel
          className="academic-results"
          title={exam ? 'Student results' : 'Overall class rankings'}
          subtitle={
            exam
              ? 'Review every student, including pending and absent results.'
              : `${ranking.included.length} completed tests included · Select a section to include tests held only for that section.`
          }
          action={
            <Button variant="secondary" onClick={exportResults}>
              <Download size={15} />
              Export results
            </Button>
          }
        >
          <div className="toolbar">
            <SearchInput value={query} onChange={setQuery} placeholder="Search student results…" />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Student</th>
                  <th>Marks</th>
                  <th>Percentage</th>
                  <th>{exam ? 'Status' : 'Tests counted'}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {exam
                  ? resultRows.map((r) => {
                      const summary = r.result ? resultSummary(r.result) : null;
                      return (
                        <tr key={r.enrollment.id}>
                          <td>{r.rank ? `#${r.rank}` : '—'}</td>
                          <td>
                            <strong>{r.student.name}</strong>
                            <small>
                              Section {r.sectionName} · Roll {r.enrollment.rollNumber}
                            </small>
                          </td>
                          <td>{summary ? `${summary.marks} / ${summary.maximum}` : '—'}</td>
                          <td>
                            <strong>{summary ? `${summary.percentage}%` : '—'}</strong>
                          </td>
                          <td>
                            <Badge
                              tone={!r.result ? 'amber' : r.result.absent ? 'neutral' : 'green'}
                            >
                              {!r.result
                                ? 'Pending'
                                : r.result.absent
                                  ? 'Absent'
                                  : `Grade ${summary!.grade}`}
                            </Badge>
                          </td>
                          <td>
                            <Link
                              className="text-link"
                              to={`/students/${r.student.id}?tab=academics`}
                            >
                              Student history <ArrowUpRight size={14} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  : ranking.rows
                      .filter((r) => matching(r.student.name))
                      .map((r) => (
                        <tr key={r.enrollment.id}>
                          <td>#{r.rank}</td>
                          <td>
                            <strong>{r.student.name}</strong>
                            <small>
                              Section {r.sectionName} · Roll {r.enrollment.rollNumber}
                            </small>
                          </td>
                          <td>
                            {r.marks} / {r.maximum}
                          </td>
                          <td>
                            <strong>{r.percentage.toFixed(1)}%</strong>
                          </td>
                          <td>{r.count}</td>
                          <td>
                            <Link
                              className="text-link"
                              to={`/students/${r.student.id}?tab=academics`}
                            >
                              Student history <ArrowUpRight size={14} />
                            </Link>
                          </td>
                        </tr>
                      ))}
              </tbody>
            </table>
          </div>
          {!(exam
            ? resultRows.length
            : ranking.rows.filter((r) => matching(r.student.name)).length) && (
            <EmptyState
              title="No matching results"
              description="Enter marks for a test or adjust your filters."
            />
          )}
        </Panel>
      )}
      <p className="panel-note">
        A score of 18/20 and 24/30 totals 42/50 (84%). Larger tests contribute in proportion to
        their maximum marks. Test averages and test ranks exclude absent students. Overall totals
        retain absence as zero; pending marks stay out of overall rankings until the test is
        complete.
      </p>
      {deleteTarget && (
        <DeleteDialog
          title={`Delete ${deleteTarget.name}?`}
          description="This deletes the test and all its marks and absence records across every assigned class and section. Rankings and student histories will update."
          detail={`${state.results.filter((r) => r.examId === deleteTarget.id).length} student result records will be removed.`}
          onClose={() => setDeleteTarget(null)}
          onDelete={() => {
            repository.deleteTest(deleteTarget.id);
            if (examId === deleteTarget.id) resetView();
          }}
        />
      )}
      {editingTest && (
        <TestDialog
          classId={classId}
          exam={editingTest}
          onClose={() => setEditingTest(null)}
          onCreated={() => {
            setEditingTest(null);
            setKind('');
            setMonth('');
            setQuery('');
          }}
        />
      )}
      {adding && (
        <TestDialog
          classId={classId}
          onClose={() => setAdding(false)}
          onCreated={(id) => {
            const created = repository.getSnapshot().exams.find((e) => e.id === id)!;
            setClass(created.classId);
            setSection(created.sectionId);
            setKind('');
            setMonth('');
            setQuery('');
            setExam(id);
            setAdding(false);
            setEditing(true);
          }}
        />
      )}
      {editing && exam && (
        <MarksDialog
          key={exam.id}
          exam={exam}
          students={selectedStudents}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}
