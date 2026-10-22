import { formatCalendarDate } from '../../lib/displayFormat';
import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  Panel,
  SearchInput,
  EmptyState,
  LoadingOverlay,
} from '../../components/ui/Primitives';
import { onboardingApi } from '../../services/onboardingService';
import { productApi, type StudentRow } from '../../services/productService';
import type { SchoolAccess } from '../../services/schoolAccessService';
import { useRemote } from '../live/useRemote';
import { useSetupList } from '../setup/useSetupList';
import { LoadState, Paging } from '../setup/SetupControls';
import { downloadClassStudentTemplate } from '../../lib/studentTemplate';
import DeleteDialog from '../../components/shared/DeleteDialog';
import LiveStudentImport from './LiveStudentImport';
import StudentRosterTable from './StudentRosterTable';
import LiveStudentForm from './LiveStudentForm';
export default function LiveStudents({
  access,
  yearId,
  classId,
  mode = 'directory',
  onChanged,
}: {
  access: SchoolAccess;
  yearId: string | null;
  classId?: string;
  mode?: 'directory' | 'new' | 'import' | 'profile';
  onChanged?: () => void;
}) {
  const load = useCallback(
    async (signal: AbortSignal) =>
      yearId ? productApi.studentContext(access.schoolId, yearId, signal) : null,
    [access.schoolId, yearId],
  );
  const state = useRemote(load);
  if (!yearId)
    return (
      <Panel title="Select an academic year">
        <Link to="/settings?tab=Years">Open academic years</Link>
      </Panel>
    );
  const loadingMessage =
    mode === 'profile'
      ? 'Loading student profile…'
      : mode === 'new'
        ? 'Loading student admission form…'
        : mode === 'import'
          ? 'Loading student import…'
          : 'Loading students…';
  if (state.error)
    return (
      <Panel>
        <LoadState {...state} label={loadingMessage} retry={state.reload} />
      </Panel>
    );
  const fallbackSnapshot: Awaited<ReturnType<typeof onboardingApi.structure>> = {
    year: {
      id: yearId,
      schoolId: access.schoolId,
      name: 'Current academic year',
      start: '',
      end: '',
      status: 'active',
      revision: 0,
    },
    classes: [],
    children: [],
    truncated: false,
  };
  return (
    <StudentWorkspace
      key={`${yearId}:${classId ?? ''}:${mode}`}
      access={access}
      yearId={yearId}
      classId={classId}
      mode={mode}
      snapshot={state.data ?? fallbackSnapshot}
      contextLoading={state.loading || !state.data}
      onChanged={onChanged}
    />
  );
}
function StudentWorkspace({
  access,
  yearId,
  classId,
  mode,
  snapshot,
  contextLoading = false,
  onChanged,
}: {
  access: SchoolAccess;
  yearId: string;
  classId?: string;
  mode: string;
  contextLoading?: boolean;
  onChanged?: () => void;
  snapshot: Awaited<ReturnType<typeof onboardingApi.structure>>;
}) {
  const [inlineImport, setInlineImport] = useState(false);
  const [params, setParams] = useSearchParams(),
    location = useLocation(),
    navigate = useNavigate();
  const selectedClass = classId ?? params.get('classId') ?? '';
  const section =
      params.get('studentSection') === 'none' ? '' : (params.get('studentSection') ?? ''),
    search = params.get('studentSearch') ?? '';
  const studentId = mode === 'profile' ? location.pathname.split('/')[2] : undefined;
  const load = useCallback(
    (signal: AbortSignal, after?: string) =>
      mode === 'new' || mode === 'import'
        ? Promise.resolve({ items: [], nextCursor: null, total: 0 })
        : productApi.students(access.schoolId, yearId, signal, {
            classId: selectedClass || undefined,
            sectionId: section || undefined,
            search,
            after,
            studentId,
          }),
    [access.schoolId, yearId, selectedClass, section, search, studentId, mode],
  );
  const list = useSetupList(load),
    [editing, setEditing] = useState<StudentRow | null>(null),
    [deleting, setDeleting] = useState<StudentRow | null>(null);
  const manage =
    access.permissions.includes('students.manage') &&
    snapshot.year.status !== 'closed' &&
    !snapshot.truncated;
  const current = snapshot.classes.find((c) => c.id === selectedClass),
    sections = snapshot.children.filter((c) => c.classId === selectedClass);
  const returnTo = params.get('returnTo'),
    destination =
      returnTo && /^\/(settings|students)(\?|$)/.test(returnTo) ? returnTo : '/students';
  const close = () => navigate(destination, { replace: true });
  const update = (key: string, value: string) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key === 'classId') next.delete('studentSection');
      return next;
    });
  const firstPage = list.first;
  const [searchDraft, setSearchDraft] = useState(search);
  const [previousSearch, setPreviousSearch] = useState(search);
  if (previousSearch !== search) {
    setPreviousSearch(search);
    setSearchDraft(search);
  }
  useEffect(() => {
    if (searchDraft === search) return;
    const timer = setTimeout(() => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (searchDraft) next.set('studentSearch', searchDraft);
          else next.delete('studentSearch');
          return next;
        },
        { replace: true },
      );
      firstPage();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchDraft, search, setParams, firstPage]);
  const filters = (
    <div className="toolbar live-students-toolbar">
      {mode === 'directory' && (
        <div className="students-search-group">
          <span>Search</span>
          <SearchInput
            value={searchDraft}
            onChange={setSearchDraft}
            placeholder="Search class students…"
          />
        </div>
      )}
      <div className="students-filters-group">
        {!classId && (
          <label className="filter-label">
            <span>Class</span>
            <select
              aria-label="Student directory class"
              value={selectedClass}
              onChange={(e) => update('classId', e.target.value)}
            >
              <option value="">{mode === 'import' ? 'Choose a class' : 'All classes'}</option>
              {snapshot.classes
                .filter((c) => c.status === 'active')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        {mode === 'directory' && (
          <label className="filter-label">
            <span>Section</span>
            <select
              aria-label="Class students section"
              disabled={!selectedClass}
              value={section}
              onChange={(e) => update('studentSection', e.target.value)}
            >
              <option value="">Whole class · all students</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.status === 'archived' ? ' (archived)' : ''}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );
  const closeImport = () => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete('import');
      return next;
    });
    setInlineImport(false);
    if (onChanged) onChanged();
    else list.reload();
  };
  const importer = (
    <LiveStudentImport
      schoolId={access.schoolId}
      yearId={yearId}
      name={current?.name ?? ''}
      sections={sections.filter((s) => s.status === 'active').map((s) => s.name)}
      close={mode === 'import' ? close : closeImport}
    />
  );
  if (mode === 'new')
    return contextLoading ? (
      <LoadingOverlay
        loading
        size="xl"
        label="Loading student admission form…"
        message="Loading student admission form…"
      >
        <Panel title="Add student" subtitle="Prepare student admission details.">
          <div style={{ minHeight: 220 }} />
        </Panel>
      </LoadingOverlay>
    ) : manage ? (
      <LiveStudentForm
        schoolId={access.schoolId}
        yearId={yearId}
        snapshot={snapshot}
        initialClassId={selectedClass}
        initialSectionId={params.get('sectionId') ?? ''}
        close={close}
        saved={close}
      />
    ) : (
      <Panel>Student management access is required.</Panel>
    );
  if (mode === 'import')
    return contextLoading ? (
      <LoadingOverlay
        loading
        size="xl"
        label="Loading student import…"
        message="Loading student import…"
      >
        <Panel title="Student import" subtitle="Prepare class student workbook import.">
          <div style={{ minHeight: 220 }} />
        </Panel>
      </LoadingOverlay>
    ) : manage ? (
      importer
    ) : (
      <Panel>Student management access is required.</Panel>
    );
  const loadingLabel =
    mode === 'profile'
      ? 'Loading student profile…'
      : current
        ? `Loading ${current.name} students…`
        : 'Loading students…';
  const isBusy = contextLoading || list.loading;
  return (
    <>
      <LoadingOverlay
        loading={isBusy}
        size="xl"
        label={loadingLabel}
        message={loadingLabel}
      >
        <Panel
          title={
            mode === 'profile'
              ? 'Student details'
              : current
                ? `${current.name} students`
                : 'Student directory'
          }
          subtitle={`${snapshot.year.name} · ${list.data?.total ?? 0} saved enrollments`}
          action={
            mode !== 'profile' &&
            manage && (
              <div className="student-import-actions">
                {current && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      downloadClassStudentTemplate(
                        current.name,
                        sections.filter((s) => s.status === 'active').map((s) => s.name),
                      )
                    }
                  >
                    Download Sample Excel
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setInlineImport(true)}>
                  Import Excel (.xlsx)
                </Button>
                <Link
                  className="button primary"
                  to={`/students/new?${new URLSearchParams({ year: yearId, classId: selectedClass, sectionId: section === 'none' ? '' : section, returnTo: location.pathname + location.search })}`}
                >
                  Add student
                </Link>
              </div>
            )
          }
        >
          {mode !== 'profile' && filters}
          {list.error && <LoadState {...list} loading={false} retry={list.reload} />}
          {!list.error && mode !== 'profile' && (
            <>
              {list.data && list.data.items.length === 0 && !list.loading ? (
                <EmptyState
                  title="No matching students"
                  description="Add a student or import the class Excel workbook."
                />
              ) : (
                <StudentRosterTable
                  studentHref={(id) => `/students/${id}?year=${yearId}`}
                  rows={(list.data?.items ?? []).map((r) => ({
                    id: r.id,
                    studentId: r.student.id,
                    name: r.student.name,
                    code: r.student.code,
                    className: r.className,
                    sectionName: r.sectionName,
                    rollNumber: r.rollNumber,
                    status: r.status,
                  }))}
                  onEdit={
                    manage && list.data
                      ? (id) => setEditing(list.data!.items.find((r) => r.id === id)!)
                      : undefined
                  }
                  onDelete={
                    manage && list.data
                      ? (id) => setDeleting(list.data!.items.find((r) => r.id === id)!)
                      : undefined
                  }
                />
              )}
              {list.data && <Paging {...list} nextCursor={list.data.nextCursor} />}
            </>
          )}
          {mode === 'profile' &&
            (list.data?.items ?? []).map((r) => (
              <dl key={r.id} className="detail-list">
                <div>
                  <dt>Birth date</dt>
                  <dd>
                    {r.student.birthDate ? formatCalendarDate(r.student.birthDate) : 'Not provided'}
                  </dd>
                </div>
                <div>
                  <dt>Guardian</dt>
                  <dd>
                    {r.student.guardianName} · {r.student.guardianRelation}
                  </dd>
                </div>
                <div>
                  <dt>Parent mobile</dt>
                  <dd>{r.student.guardianPhone || 'Not provided'}</dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>{r.student.address || 'Not provided'}</dd>
                </div>
              </dl>
            ))}
        </Panel>
      </LoadingOverlay>
      {manage && (inlineImport || params.has('import')) && importer}
      {editing && (
        <LiveStudentForm
          schoolId={access.schoolId}
          yearId={yearId}
          snapshot={snapshot}
          existing={editing}
          close={() => setEditing(null)}
          saved={() => {
            setEditing(null);
            if (onChanged) onChanged();
            else list.reload();
          }}
        />
      )}
      {deleting && (
        <DeleteDialog
          title={`Delete ${deleting.student.name}?`}
          description="Permanently delete this student's profile and enrollments in every academic year. The audit entry is retained."
          onClose={() => setDeleting(null)}
          onDelete={async () => {
            await productApi.deleteStudent(access.schoolId, yearId, deleting.student);
            if (onChanged) onChanged();
            else list.reload();
          }}
        />
      )}
    </>
  );
}
