import { matchesAcademicScope } from '../../lib/academicGroups';
import ClassName from '../../components/shared/ClassName';
import SectionNavigation from '../../components/shared/SectionNavigation';
import TestResult from './TestResult';
import { useState } from 'react';
import StudentRecordLink from '../../components/shared/StudentRecordLink';
import { ArrowRight } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { useToday } from '../../app/useToday';
import {
  AppIcon,
  PickerInput,
  Button,
  EmptyState,
  Modal,
  Panel,
  SearchInput,
} from '../../components/ui/Primitives';
import { roster } from '../../lib/selectors';
import {
  examIncludes,
  marksAdded,
  overallLeaderboard,
  savedSubjects,
  scopeStateForFeature,
  sectionStats,
} from '../../lib/academicSheets';
import { useSchoolFeature } from '../../app/schoolFeatureContext';
import { displayDate } from '../../lib/config';
import { downloadCsv } from '../../lib/download';
import { orderedClasses, sectionLabel } from '../../lib/schoolLabels';
import { studentHistoryUrl } from '../../lib/academicNavigation';
import type { Examination } from '../../types/domain';

export default function ResultsView({
  classId,
  exams,
  params,
  change,
}: {
  classId: string;
  exams: Examination[];
  params: URLSearchParams;
  change: (values: Record<string, string | null>) => void;
}) {
  const recentView = params.get('resultsView') === 'recent' || !!params.get('test');
  const rawState = useSchool(),
    feature = useSchoolFeature(),
    state = scopeStateForFeature(rawState, feature?.canMarkSubject),
    today = useToday();
  const sections = state.sections.filter(
    (s) => s.schoolId === state.school.id && s.classId === classId,
  );
  const requestedScope = params.get(recentView ? 'section' : 'scope') ?? '';
  const hasSectionless = roster(state).some(
    (r) => r.enrollment.classId === classId && !r.enrollment.sectionId,
  );
  const scope =
    requestedScope === 'unsectioned' && hasSectionless
      ? requestedScope
      : (sections.find((s) => s.id === requestedScope)?.id ?? '');
  const section = scope === 'unsectioned' ? '' : scope || undefined;
  const scopeLabel =
    scope === 'unsectioned'
      ? 'Without section'
      : scope
        ? sectionLabel(sections.find((s) => s.id === scope)!.name)
        : 'Whole class';
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.get('month') ?? '')
    ? params.get('month')!
    : today.slice(0, 7);
  const all = roster(state).filter((r) => matchesAcademicScope(r.enrollment, classId, section));
  const ranked = overallLeaderboard(state, all, exams);
  const fullRanking = [
    ...ranked,
    ...all
      .filter((student) => !ranked.some((r) => r.enrollment.id === student.enrollment.id))
      .map((student) => ({ ...student, rank: 0, marks: 0, maximum: 0, count: 0, percentage: 0 })),
  ];
  const recent = exams.filter(
    (e) =>
      examIncludes(e, classId, section) &&
      e.date.startsWith(month) &&
      e.date <= today &&
      marksAdded(state, e, section, classId),
  );
  const exam = exams.find(
    (e) =>
      e.id === params.get('test') &&
      examIncludes(e, classId, section) &&
      marksAdded(state, e, section, classId),
  );
  const [search, setSearch] = useState('');
  const name = state.classes.find((c) => c.id === classId)?.name ?? 'Class';
  const from = `/academics?${params}`;
  const history = (student: string) => studentHistoryUrl(student, undefined, from);
  const rankingTable = (rows: typeof ranked) => (
    <div className="table-wrap academic-ranking-table">
      <table>
        <thead>
          <tr>
            <th className="mono">Rank</th>
            <th>Student</th>
            {!scope && <th>Section</th>}
            <th className="mono">Admission number</th>
            <th className="currency-cell">Marks / Maximum</th>
            <th className="currency-cell">Overall</th>
            <th className="currency-cell">Tests</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.enrollment.id}>
              <td className="mono">{r.rank ? `#${r.rank}` : '—'}</td>
              <td>
                <StudentRecordLink className="text-link" to={history(r.student.id)}>
                  {r.student.name}
                </StudentRecordLink>
                <small>Roll {r.enrollment.rollNumber}</small>
              </td>
              {!scope && <td>{r.sectionName || 'Without section'}</td>}
              <td className="mono muted">{r.student.admissionNumber || '—'}</td>
              <td className="currency-cell">{r.count ? `${r.marks} / ${r.maximum}` : '—'}</td>
              <td className="currency-cell">
                <strong>{r.count ? `${r.percentage.toFixed(1)}%` : 'Pending'}</strong>
              </td>
              <td className="currency-cell">{r.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="academic-results-stack">
      <div className="academic-context academic-results-context">
        <label className="field">
          Class
          <select
            aria-label="Academic class"
            value={classId}
            onChange={(event) =>
              change({
                class: event.target.value,
                scope: null,
                section: null,
                test: null,
                marks: null,
                student: null,
                leaderboard: null,
              })
            }
          >
            {orderedClasses(state.classes.filter((item) => item.schoolId === state.school.id)).map(
              (item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="field">
          Section
          <select
            aria-label={recentView ? 'Recent results section' : 'Leaderboard section scope'}
            value={scope}
            onChange={(event) =>
              change({
                section: event.target.value,
                scope: event.target.value,
                test: null,
                leaderboard: null,
              })
            }
          >
            <option value="">Whole class</option>
            {hasSectionless && <option value="unsectioned">Without section</option>}
            {sections.map((item) => (
              <option key={item.id} value={item.id}>
                {sectionLabel(item.name)}
              </option>
            ))}
          </select>
        </label>
        {recentView && (
          <label className="field">
            Month
            <PickerInput
              aria-label="Results month"
              type="month"
              value={month}
              min={state.academicYear.start.slice(0, 7)}
              max={
                state.academicYear.end.slice(0, 7) < today.slice(0, 7)
                  ? state.academicYear.end.slice(0, 7)
                  : today.slice(0, 7)
              }
              onChange={(e) => change({ month: e.target.value, test: null })}
            />
          </label>
        )}
      </div>
      <SectionNavigation
        label="Result views"
        items={[
          { id: 'overall', label: 'Overall Leaderboard', icon: 'trophy' },
          { id: 'recent', label: 'Recent Results', icon: 'document' },
        ]}
        value={recentView ? 'recent' : 'overall'}
        onChange={(value) =>
          change({ resultsView: value, section: scope, scope, test: null, leaderboard: null })
        }
      />
      {exam && params.get('marks') !== '1' ? (
        <TestResult
          key={`${exam.id}-${section}`}
          exam={exam}
          sectionId={section}
          classId={classId}
          onClose={() => change({ test: null })}
          onEdit={() => change({ marks: '1', section: scope })}
          from={from}
        />
      ) : (
        !recentView && (
          <section className="academic-overall" aria-labelledby="overall-performance">
            <div className="academic-list-heading">
              <div>
                <h2 id="overall-performance">
                  <AppIcon name="trophy" size={24} />
                  Overall Performance — <ClassName name={name} />
                </h2>
                <p>
                  {state.academicYear.name} · Aggregate recorded marks ÷ recorded maximum × 100.
                  Absent and pending subjects are excluded; ties share competition ranks (1, 2, 2,
                  4).
                </p>
                <p>
                  {scopeLabel} · {all.length} students · Through {displayDate(today)}
                </p>
              </div>
            </div>
            {ranked.length ? (
              <>
                <div className="academic-podium">
                  {ranked.slice(0, 3).map((r, i) => (
                    <StudentRecordLink
                      key={r.enrollment.id}
                      to={history(r.student.id)}
                      className={`academic-award award-${i + 1}`}
                    >
                      {['left', 'right'].map((side) => (
                        <span key={side} className={`award-laurel ${side}`} aria-hidden="true">
                          {Array.from({ length: 7 }, (_, leaf) => (
                            <i key={leaf} />
                          ))}
                        </span>
                      ))}
                      <h3>{r.student.name}</h3>
                      {!scope && (
                        <span className="award-section">
                          {r.sectionName ? sectionLabel(r.sectionName) : 'Without section'}
                        </span>
                      )}
                      <strong className="award-percentage">
                        {r.percentage.toFixed(1)}
                        <small>%</small>
                      </strong>
                      <span>
                        {r.marks} / {r.maximum} marks
                      </span>
                      <span className="award-tests">
                        {r.count} {r.count === 1 ? 'test' : 'tests'} counted
                      </span>
                      <span className="award-rank" aria-label={`Rank ${r.rank}`}>
                        {r.rank}
                      </span>
                    </StudentRecordLink>
                  ))}
                </div>
                {ranked.length > 3 && (
                  <Panel className="academic-rank-table">{rankingTable(ranked.slice(3, 10))}</Panel>
                )}
                <div className="academic-leaderboard-footer">
                  <Button variant="secondary" onClick={() => change({ leaderboard: 'all' })}>
                    View All Students <ArrowRight size={16} />
                  </Button>
                </div>
              </>
            ) : (
              <EmptyState
                title="No ranked results yet"
                description="Save marks for a test to see the class’s overall performance."
              />
            )}
          </section>
        )
      )}
      {recentView && !exam && (
        <section className="academic-recent-results" aria-label="Recent test results">
          <div className="academic-test-list">
            {recent.map((e) => {
              const stats = sectionStats(state, e, section, classId);
              return (
                <article className="panel academic-result-card" key={e.id}>
                  <div className="academic-result-card-heading">
                    <div>
                      <h3>{e.name}</h3>
                    </div>
                    <span>{displayDate(e.date)}</span>
                  </div>
                  <p className="academic-included-subjects">
                    {savedSubjects(state, e, section, classId)
                      .map((s) => s.name)
                      .join(' · ')}
                  </p>
                  <div className="academic-result-card-bottom">
                    <dl>
                      <div>
                        <dt>Class Average</dt>
                        <dd>{stats.average === null ? '—' : `${stats.average.toFixed(1)}%`}</dd>
                      </div>
                      <div>
                        <dt>Students</dt>
                        <dd>{stats.students}</dd>
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
                    <Button
                      variant="secondary"
                      onClick={() => change({ test: e.id, section: scope })}
                    >
                      View Result <ArrowRight size={15} />
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
          {!recent.length && (
            <EmptyState
              title="No results for this month"
              description="Choose another month or save marks for a test in this class or section."
            />
          )}
        </section>
      )}
      {params.get('leaderboard') === 'all' && (
        <Modal
          open
          wide
          title={`Overall Leaderboard — ${name}`}
          description={`${scopeLabel} · Through ${displayDate(today)}`}
          onClose={() => change({ leaderboard: null })}
        >
          <div className="sheet-tools">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search student rankings…"
            />
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  `Leaderboard-${name}.csv`,
                  [
                    'Rank',
                    'Roll No.',
                    'Student',
                    ...(!scope ? ['Section'] : []),
                    'Admission number',
                    'Marks obtained',
                    'Maximum marks',
                    'Overall %',
                    'Tests',
                  ],
                  fullRanking.map((r) => [
                    r.rank || '',
                    r.enrollment.rollNumber,
                    r.student.name,
                    ...(!scope ? [r.sectionName || 'Without section'] : []),
                    r.student.admissionNumber,
                    r.marks,
                    r.maximum,
                    r.count ? r.percentage.toFixed(1) : 'Pending',
                    r.count,
                  ]),
                )
              }
            >
              <AppIcon name="download" size={16} />
              Export rankings
            </Button>
          </div>
          {rankingTable(
            fullRanking.filter(
              (r) =>
                r.student.name.toLowerCase().includes(search.toLowerCase()) ||
                String(r.enrollment.rollNumber) === search,
            ),
          )}
          {!fullRanking.some(
            (r) =>
              r.student.name.toLowerCase().includes(search.toLowerCase()) ||
              String(r.enrollment.rollNumber) === search,
          ) && <EmptyState title="No matching students" />}
        </Modal>
      )}
    </div>
  );
}
