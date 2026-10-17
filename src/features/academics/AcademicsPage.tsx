import { examClasses } from '../../lib/testScope';
import { tabKeyboard } from '../../lib/tabKeyboard';
import { useState } from 'react';

import { Link, useSearchParams } from 'react-router-dom';

import { MoreVertical, Pencil, Plus, BookOpen, ArrowLeft } from 'lucide-react';

import { useSchool } from '../../app/useSchool';

import {
  Badge,
  Button,
  EmptyState,
  PageHeading,
  SearchInput,
} from '../../components/ui/Primitives';

import DeleteDialog from '../../components/shared/DeleteDialog';

import { displayDate } from '../../lib/config';

import { orderedClasses, sectionLabel } from '../../lib/schoolLabels';

import { testRoster } from '../../lib/academics';

import { examSections, marksAdded, examIncludes } from '../../lib/academicSheets';

import { studentReturnPath } from '../../lib/academicNavigation';

import { repository } from '../../lib/repository';

import type { Examination } from '../../types/domain';

import MarksDialog from './MarksDialog';

import TestDialog from './TestDialog';

import ResultsView from './ResultsView';

import './academics.css';

export default function AcademicsPage() {
  const state = useSchool();

  const [params, setParams] = useSearchParams();

  const classes = orderedClasses(state.classes.filter((c) => c.schoolId === state.school.id));

  const classId = classes.find((c) => c.id === params.get('class'))?.id ?? classes[0]?.id ?? '';

  const resultsView = ['results', 'rankings'].includes(params.get('view') ?? '');

  const [adding, setAdding] = useState(false),
    [editing, setEditing] = useState<Examination | null>(null),
    [deleting, setDeleting] = useState<Examination | null>(null);

  const [query, setQuery] = useState('');

  const change = (values: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    next.set('class', classId);
    Object.entries(values).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    );
    setParams(next, { flushSync: true });
  };

  const exams = state.exams
    .filter(
      (e) =>
        e.schoolId === state.school.id &&
        e.academicYearId === state.academicYear.id &&
        examIncludes(e, classId),
    )
    .reverse()
    .sort((a, b) => b.date.localeCompare(a.date));

  const exam = exams.find((e) => e.id === params.get('test'));

  const returnTo = studentReturnPath(params.get('returnTo'));

  return (
    <>
      {returnTo && (
        <Link className="text-link academic-back" to={returnTo}>
          <ArrowLeft size={15} />
          Back to student academics
        </Link>
      )}

      <PageHeading
        title="Academics"
        description="Manage tests, record marks and follow every student’s progress."
        actions={
          !resultsView ? (
            <Button onClick={() => setAdding(true)}>
              <Plus size={17} />
              Add Test / Exam
            </Button>
          ) : undefined
        }
      />

      <div className="academic-tabs academic-main-tabs" role="tablist" aria-label="Academics">
        <button
          role="tab"
          id="academics-tab-tests"
          tabIndex={!resultsView ? 0 : -1}
          onKeyDown={(event) =>
            tabKeyboard(
              event,
              0,
              ['tests', 'results'],
              (tab) =>
                change({ view: tab === 'results' ? 'results' : null, test: null, marks: null }),
              (tab) => `academics-tab-${tab}`,
            )
          }
          aria-selected={!resultsView}
          onClick={() => change({ view: null, test: null, marks: null })}
        >
          Recent Tests / Exams
        </button>
        <button
          role="tab"
          id="academics-tab-results"
          tabIndex={resultsView ? 0 : -1}
          onKeyDown={(event) =>
            tabKeyboard(
              event,
              1,
              ['tests', 'results'],
              (tab) =>
                change({ view: tab === 'results' ? 'results' : null, test: null, marks: null }),
              (tab) => `academics-tab-${tab}`,
            )
          }
          aria-selected={resultsView}
          onClick={() => change({ view: 'results', test: null, marks: null })}
        >
          Results
        </button>
      </div>

      <div className="academic-context">
        <label className="field">
          Class
          <select
            aria-label="Academic class"
            value={classId}
            onChange={(e) =>
              change({
                class: e.target.value,
                section: null,
                scope: null,
                test: null,
                marks: null,
                student: null,
              })
            }
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <span>{state.academicYear.name}</span>
      </div>

      {!classes.length ? (
        <EmptyState
          title="Set up a class first"
          description="Add classes, sections and subjects in School Settings."
          action={
            <Link className="button secondary" to="/settings?tab=Classes%2C+Sections+%26+Grades">
              Open class settings
            </Link>
          }
        />
      ) : resultsView ? (
        <ResultsView classId={classId} exams={exams} params={params} change={change} />
      ) : (
        <>
          <div className="academic-list-heading">
            <div>
              <h2>Recent Tests / Exams</h2>
              <p>Newest first. Use the pencil to add or edit marks.</p>
            </div>
            <SearchInput value={query} onChange={setQuery} placeholder="Search test or exam…" />
          </div>

          <div className="academic-test-list">
            {exams
              .filter((e) => `${e.name} ${e.kind}`.toLowerCase().includes(query.toLowerCase()))
              .map((e) => {
                const sections = examSections(state, e, classId);

                return (
                  <article className="panel academic-test-card" key={e.id}>
                    <span className="academic-test-icon">
                      <BookOpen size={21} />
                    </span>
                    <div className="academic-test-info">
                      <h3>{e.name}</h3>
                      <p>
                        {e.kind} · {displayDate(e.date)}
                      </p>
                      <div className="academic-test-scope">
                        {examClasses(state, e).map((c) => {
                          const assigned = examSections(state, e, c.id);
                          return (
                            <small key={c.id}>
                              <strong>{c.name}</strong> ·{' '}
                              {assigned.length === 1
                                ? sectionLabel(assigned[0].name)
                                : `Sections ${assigned.map((s) => s.name).join(', ')}`}
                            </small>
                          );
                        })}
                      </div>
                    </div>

                    <Badge tone={marksAdded(state, e) ? 'green' : 'amber'}>
                      {marksAdded(state, e) ? 'Marks Added' : 'Marks Not Added'}
                    </Badge>

                    <div className="academic-test-actions">
                      <Button
                        variant="ghost"
                        aria-label={`Add/Edit Marks for ${e.name}`}
                        title="Add/Edit Marks"
                        onClick={() =>
                          change({ test: e.id, marks: '1', section: sections[0]?.id ?? null })
                        }
                      >
                        <Pencil size={18} />
                      </Button>
                      <details className="academic-test-menu">
                        <summary aria-label={`More options for ${e.name}`}>
                          <MoreVertical size={19} />
                        </summary>
                        <div>
                          <button
                            onClick={(event) => {
                              event.currentTarget.closest('details')?.removeAttribute('open');
                              setEditing(e);
                            }}
                          >
                            Edit Test
                          </button>
                          <button
                            className="delete-action"
                            onClick={(event) => {
                              event.currentTarget.closest('details')?.removeAttribute('open');
                              setDeleting(e);
                            }}
                          >
                            Delete Test
                          </button>
                        </div>
                      </details>
                    </div>
                  </article>
                );
              })}
          </div>

          {!exams.some((e) =>
            `${e.name} ${e.kind}`.toLowerCase().includes(query.toLowerCase()),
          ) && (
            <EmptyState
              title={query ? 'No matching tests' : 'No tests yet'}
              description="Create a test, then open its pencil to record marks."
            />
          )}
        </>
      )}

      {adding && (
        <TestDialog
          classId={classId}
          onClose={() => setAdding(false)}
          onCreated={(id) => {
            const created = repository.getSnapshot().exams.find((e) => e.id === id)!;
            setAdding(false);
            change({
              class: created.classIds?.includes(classId)
                ? classId
                : (created.classIds?.[0] ?? created.classId),
              test: null,
              marks: null,
            });
          }}
        />
      )}

      {editing && (
        <TestDialog
          classId={classId}
          exam={editing}
          onClose={() => setEditing(null)}
          onCreated={(id) => {
            const updated = repository.getSnapshot().exams.find((e) => e.id === id)!;
            setEditing(null);
            change({
              class: updated.classIds?.includes(classId)
                ? classId
                : (updated.classIds?.[0] ?? updated.classId),
              test: null,
              marks: null,
            });
          }}
        />
      )}

      {deleting && (
        <DeleteDialog
          title={`Delete ${deleting.name}?`}
          description="This removes the test and its saved marks from every assigned section. Student histories and rankings will update."
          onClose={() => setDeleting(null)}
          onDelete={() => {
            repository.deleteTest(deleting.id);
            setDeleting(null);
            if (params.get('test') === deleting.id) change({ test: null, marks: null });
          }}
        />
      )}

      {params.get('marks') === '1' && exam && (
        <MarksDialog
          key={exam.id}
          exam={exam}
          students={testRoster(state, exam).filter(
            (r) => !params.get('section') || r.enrollment.sectionId === params.get('section'),
          )}
          studentId={params.get('student') ?? undefined}
          onClose={() => change({ marks: null, student: null, test: resultsView ? exam.id : null })}
        />
      )}
    </>
  );
}
