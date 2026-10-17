import TestResult from './TestResult';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Download, Trophy } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { useToday } from '../../app/useToday';
import {
  Avatar,
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
  sectionStats,
} from '../../lib/academicSheets';
import { displayDate } from '../../lib/config';
import { downloadCsv } from '../../lib/download';
import { sectionLabel } from '../../lib/schoolLabels';
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
  const state = useSchool(),
    today = useToday();
  const sections = state.sections.filter(
    (s) => s.schoolId === state.school.id && s.classId === classId,
  );
  const scope = sections.find((s) => s.id === params.get('scope'))?.id ?? '';
  const section = sections.find((s) => s.id === params.get('section'))?.id ?? sections[0]?.id ?? '';
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.get('month') ?? '')
    ? params.get('month')!
    : today.slice(0, 7);
  const all = roster(state).filter(
    (r) => r.enrollment.classId === classId && (!scope || r.enrollment.sectionId === scope),
  );
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
      marksAdded(state, e, section),
  );
  const exam = exams.find(
    (e) =>
      e.id === params.get('test') &&
      examIncludes(e, classId, section) &&
      marksAdded(state, e, section),
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
            <th>Rank</th>
            <th>Student</th>
            {!scope && <th>Section</th>}
            <th>Overall</th>
            <th>Tests</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.enrollment.id}>
              <td>{r.rank ? `#${r.rank}` : '—'}</td>
              <td>
                <Link className="text-link" to={history(r.student.id)}>
                  {r.student.name}
                </Link>
                <small>Roll {r.enrollment.rollNumber}</small>
              </td>
              {!scope && <td>{r.sectionName}</td>}
              <td>
                <strong>{r.count ? `${r.percentage.toFixed(1)}%` : 'Pending'}</strong>
              </td>
              <td>{r.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="academic-results-stack">
      <section className="academic-overall" aria-labelledby="overall-performance">
        <div className="academic-list-heading">
          <div>
            <h2 id="overall-performance">
              <Trophy size={21} />
              Overall Performance — {name}
            </h2>
            <p>
              {state.academicYear.name} · Through {displayDate(today)}
            </p>
          </div>
          <label className="field">
            Section Scope
            <select
              aria-label="Leaderboard section scope"
              value={scope}
              onChange={(e) => change({ scope: e.target.value, leaderboard: null })}
            >
              <option value="">All Sections</option>
              {sections.map((s) => (
                <option value={s.id} key={s.id}>
                  {sectionLabel(s.name)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {ranked.length ? (
          <>
            <div className="academic-podium">
              {ranked.slice(0, 3).map((r, i) => (
                <Link
                  key={r.enrollment.id}
                  to={history(r.student.id)}
                  className={`academic-award award-${i + 1}`}
                >
                  <span className="award-rank">
                    <Trophy size={17} />#{r.rank}
                  </span>
                  <Avatar name={r.student.name} large />
                  <h3>{r.student.name}</h3>
                  {!scope && <span className="award-section">{sectionLabel(r.sectionName)}</span>}
                  <strong className="award-percentage">
                    {r.percentage.toFixed(1)}
                    <small>%</small>
                  </strong>
                  <span>
                    {r.count} {r.count === 1 ? 'test' : 'tests'} counted
                  </span>
                </Link>
              ))}
            </div>
            {ranked.length > 3 && (
              <Panel className="academic-rank-table">{rankingTable(ranked.slice(3, 10))}</Panel>
            )}
            <div className="academic-leaderboard-footer">
              <p>
                All recorded marks count. Absence counts as zero; pending marks are excluded. Equal
                scores share a rank.
              </p>
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
      <section className="academic-recent-results" aria-labelledby="recent-results-heading">
        <div className="academic-list-heading">
          <div>
            <h2 id="recent-results-heading">Recent Results</h2>
            <p>Review one section at a time.</p>
          </div>
          <div className="academic-result-filters">
            <label className="field">
              Section
              <select
                aria-label="Recent results section"
                value={section}
                onChange={(e) => change({ section: e.target.value, test: null })}
              >
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {sectionLabel(s.name)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Month
              <input
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
          </div>
        </div>
        <div className="academic-test-list">
          {recent.map((e) => {
            const stats = sectionStats(state, e, section);
            return (
              <article className="panel academic-result-card" key={e.id}>
                <div className="academic-result-card-heading">
                  <div>
                    <h3>{e.name}</h3>
                    <p>{e.kind}</p>
                  </div>
                  <span>{displayDate(e.date)}</span>
                </div>
                <p className="academic-included-subjects">
                  {savedSubjects(state, e, section)
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
                  <Button variant="secondary" onClick={() => change({ test: e.id, section })}>
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
            description="Choose another month or save marks for a test in this section."
          />
        )}
      </section>
      {params.get('leaderboard') === 'all' && (
        <Modal
          open
          wide
          title={`Overall Leaderboard — ${name}`}
          description={`${scope ? sectionLabel(sections.find((s) => s.id === scope)!.name) : 'All Sections'} · ${state.academicYear.name} · Through ${displayDate(today)}`}
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
                    'Overall %',
                    'Tests',
                  ],
                  fullRanking.map((r) => [
                    r.rank || '',
                    r.enrollment.rollNumber,
                    r.student.name,
                    ...(!scope ? [r.sectionName] : []),
                    r.count ? r.percentage.toFixed(1) : 'Pending',
                    r.count,
                  ]),
                )
              }
            >
              <Download size={15} />
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
      {exam && params.get('marks') !== '1' && (
        <TestResult
          key={`${exam.id}-${section}`}
          exam={exam}
          sectionId={section}
          onClose={() => change({ test: null })}
          onEdit={() => change({ marks: '1', section })}
          from={from}
        />
      )}
    </div>
  );
}
