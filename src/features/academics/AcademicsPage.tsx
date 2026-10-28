import SectionNavigation from '../../components/shared/SectionNavigation';
import { examClasses } from '../../lib/testScope';
import { examGroups, matchesAcademicScope } from '../../lib/academicGroups';
import ClassName from '../../components/shared/ClassName';
import { useState } from 'react';

import { Link, useSearchParams } from 'react-router-dom';

import { MoreVertical, ArrowLeft } from 'lucide-react';

import { useSchool } from '../../app/useSchool';

import {
  Badge,
  Button,
  EmptyState,
  PageHeading,
  SearchInput,
  AppIcon,
} from '../../components/ui/Primitives';

import DeleteDialog from '../../components/shared/DeleteDialog';

import { displayDate } from '../../lib/config';

import { orderedClasses } from '../../lib/schoolLabels';

import { testRoster } from '../../lib/academics';

import { marksAdded, examIncludes, scopeStateForFeature } from '../../lib/academicSheets';

import { studentReturnPath } from '../../lib/academicNavigation';

import { useSchoolFeature } from '../../app/schoolFeatureContext';
import { repository } from '../../lib/repository';

import type { Examination } from '../../types/domain';

import MarksDialog from './MarksDialog';

import TestDialog from './TestDialog';

import ResultsView from './ResultsView';

import './academics.css';

export default function AcademicsPage() {
  const rawState = useSchool();
  const feature = useSchoolFeature(),
    data = feature ?? repository,
    canManage = feature?.canManage ?? true,
    canCreateTest = feature ? (feature.canCreateTest ?? canManage) : canManage;
  const state = scopeStateForFeature(rawState, feature?.canMarkSubject);

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
        (!resultsView || examIncludes(e, classId)),
    )
    .reverse()
    .sort((a, b) => b.date.localeCompare(a.date));

  const exam = rawState.exams.find((e) => e.id === params.get('test'));

  const returnTo = studentReturnPath(params.get('returnTo'));

  return (
    <>
      {returnTo && (
        <Link className="text-link academic-back" to={returnTo}>
          <ArrowLeft size={15} />
          Back to student progress report
        </Link>
      )}

      <PageHeading
        title="Test and Result"
        actions={
          <div className="academic-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {!resultsView && (
              <div style={{ minWidth: 220, flex: '1 1 220px' }}>
                <SearchInput value={query} onChange={setQuery} placeholder="Search test or exam…" />
              </div>
            )}
            {!resultsView && canCreateTest && (
              <Button onClick={() => setAdding(true)}>
                <AppIcon name="document" size={17} />
                Add Test / Exam
              </Button>
            )}
          </div>
        }
      />

      <SectionNavigation
        label="Test and Result"
        value={resultsView ? 'results' : 'tests'}
        onChange={(tab) =>
          change({ view: tab === 'results' ? 'results' : null, test: null, marks: null })
        }
        items={[
          { id: 'tests', label: 'Recent Tests / Exams', icon: 'document' },
          { id: 'results', label: 'Results', icon: 'trophy' },
        ]}
      />

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
          <div className="academic-test-list">
            {exams
              .filter((e) => e.name.toLowerCase().includes(query.toLowerCase()))
              .map((e) => {
                const groups = examGroups(state, e);

                return (
                  <article className="panel academic-test-card" key={e.id}>
                    <span className="academic-test-icon">
                      <AppIcon name="document" size={44} />
                    </span>
                    <div className="academic-test-info">
                      <h3>{e.name}</h3>
                      <p>{displayDate(e.date)}</p>
                      <div className="academic-test-scope">
                        {examClasses(state, e).map((c) => {
                          const assigned = groups.filter((g) => g.classId === c.id);
                          return (
                            <small key={c.id}>
                              <strong>
                                <ClassName name={c.name} />
                              </strong>{' '}
                              · {assigned.map((s) => s.label).join(', ')}
                            </small>
                          );
                        })}
                      </div>
                    </div>

                    <Badge tone={marksAdded(state, e) ? 'green' : 'amber'}>
                      {marksAdded(state, e) ? 'Marks Added' : 'Marks Not Added'}
                    </Badge>

                    {canManage && (
                      <div className="academic-test-actions">
                        <Button
                          variant="ghost"
                          aria-label={`Add/Edit Marks for ${e.name}`}
                          title="Add/Edit Marks"
                          onClick={() =>
                            change({
                              class: groups[0]?.classId ?? null,
                              test: e.id,
                              marks: '1',
                              section: groups[0]?.sectionId || 'unsectioned',
                            })
                          }
                        >
                          <AppIcon name="edit" size={18} />
                        </Button>
                        {canCreateTest && (!feature?.canEditTest || feature.canEditTest(e.id)) && (
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
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
          </div>

          {!exams.some((e) => e.name.toLowerCase().includes(query.toLowerCase())) && (
            <EmptyState
              title={query ? 'No matching tests' : 'No tests yet'}
              description={
                canCreateTest
                  ? 'Create a test, then open its pencil to record marks.'
                  : 'Tests created by your school administrator will appear here.'
              }
            />
          )}
        </>
      )}

      {adding && (
        <TestDialog
          classId={classId}
          onClose={() => setAdding(false)}
          onCreated={(id) => {
            const created = data.getSnapshot().exams.find((e) => e.id === id)!;
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
            const updated = data.getSnapshot().exams.find((e) => e.id === id)!;
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
          onDelete={async () => {
            await data.deleteTest(deleting.id);
            setDeleting(null);
            if (params.get('test') === deleting.id) change({ test: null, marks: null });
          }}
        />
      )}

      {canManage && params.get('marks') === '1' && exam && (
        <MarksDialog
          key={exam.id}
          exam={exam}
          students={testRoster(state, exam).filter((r) =>
            matchesAcademicScope(
              r.enrollment,
              classId,
              params.get('section') === 'unsectioned' ? '' : params.get('section') || undefined,
            ),
          )}
          studentId={params.get('student') ?? undefined}
          onClose={() => change({ marks: null, student: null, test: resultsView ? exam.id : null })}
        />
      )}
    </>
  );
}
