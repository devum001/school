import ReplaceTeacherDialog from './ReplaceTeacherDialog';
import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, LoadingOverlay, Modal, Panel } from '../../components/ui/Primitives';
import {
  onboardingApi,
  type Relation,
  type RelationKind,
  type Person,
} from '../../services/onboardingService';
import { accessError, type SchoolAccess } from '../../services/schoolAccessService';
import { useRemote } from '../live/useRemote';
import { useSetupList } from './useSetupList';
import { ConfirmAction, LoadState, Paging } from './SetupControls';
export default function PeopleRelations({
  access,
  yearId,
  kind,
  staffId,
}: {
  access: SchoolAccess;
  yearId: string | null;
  kind: RelationKind;
  staffId?: string;
}) {
  if (!yearId)
    return (
      <Panel>
        <div className="live-content">
          <p>
            Select an <Link to="/settings?tab=Years">academic year</Link> first.
          </p>
        </div>
      </Panel>
    );
  return (
    <RelationList
      key={`${access.schoolId}:${yearId}:${kind}`}
      access={access}
      yearId={yearId}
      kind={kind}
      staffId={staffId}
    />
  );
}
function RelationList({
  access,
  yearId,
  kind,
  staffId,
}: {
  access: SchoolAccess;
  yearId: string;
  kind: RelationKind;
  staffId?: string;
}) {
  const [after, setAfter] = useState<string>();
  const [search, setSearch] = useState(''),
    [query, setQuery] = useState(''),
    [classId, setClassId] = useState(''),
    [sectionId, setSectionId] = useState(''),
    [subjectId, setSubjectId] = useState('');
  const optionsLoad = useCallback(
    async (signal: AbortSignal) => {
      if (
        kind !== 'teaching-assignments' ||
        !['classes.view', 'sections.view', 'subjects.view'].every((p) =>
          access.permissions.includes(p),
        )
      )
        return null;
      const [sections, subjects] = await Promise.all([
        onboardingApi.structure(access.schoolId, yearId, 'sections', signal),
        onboardingApi.structure(access.schoolId, yearId, 'subjects', signal),
      ]);
      return { sections, subjects };
    },
    [access.schoolId, access.permissions, yearId, kind],
  );
  const options = useRemote(optionsLoad);
  const load = useCallback(
    (signal: AbortSignal) =>
      onboardingApi.relations(access.schoolId, yearId, kind, signal, after, {
        ...(staffId ? { staffId } : {}),
        ...(query ? { search: query } : {}),
        ...(classId ? { classId } : {}),
        ...(sectionId ? { sectionId } : {}),
        ...(subjectId ? { subjectId } : {}),
      }),
    [access.schoolId, yearId, kind, after, staffId, query, classId, sectionId, subjectId],
  );
  const state = useRemote(load),
    [ending, setEnding] = useState<Relation | null>(null),
    [adding, setAdding] = useState(false),
    [editing, setEditing] = useState<Relation>(),
    [replacing, setReplacing] = useState<Relation>();
  const year = state.data?.year;
  const assignments = kind === 'teaching-assignments',
    manage =
      year?.status !== 'closed' &&
      !!year &&
      access.permissions.includes(assignments ? 'assignments.manage' : 'students.manage');
  const canAssign =
    manage &&
    ['staff.view', 'classes.view', 'sections.view', 'subjects.view', 'academic-years.view'].every(
      (permission) => access.permissions.includes(permission),
    );
  const loadingLabel = assignments ? 'Loading staff assignments…' : 'Loading student enrollments…';
  return (
    <LoadingOverlay loading={state.loading} size="xl" label={loadingLabel} message={loadingLabel}>
      <Panel
        title={`${assignments ? 'Staff assignments' : 'Student enrollments'}${year ? ` · ${year.name}` : ''}`}
        subtitle="Manage who teaches each class, section and subject."
        action={
          assignments && canAssign && <Button onClick={() => setAdding(true)}>Assign staff</Button>
        }
      >
        <div className="live-content">
          {state.error && <LoadState {...state} loading={false} retry={state.reload} />}
          {!state.error && (
            <>
              {assignments && (
                <form
                  className="contact-toolbar"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setAfter(undefined);
                    setQuery(search);
                  }}
                >
                  <label className="field">
                    Find teacher
                    <input
                      value={search}
                      maxLength={80}
                      placeholder="Name or employee ID"
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <Button>Search</Button>
                  {options.data && (
                    <>
                      <label className="field">
                        Class
                        <select
                          value={classId}
                          onChange={(e) => {
                            setClassId(e.target.value);
                            setSectionId('');
                            setSubjectId('');
                            setAfter(undefined);
                          }}
                        >
                          <option value="">All classes</option>
                          {options.data.sections.classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        Section
                        <select
                          value={sectionId}
                          onChange={(e) => {
                            setSectionId(e.target.value);
                            setAfter(undefined);
                          }}
                        >
                          <option value="">All sections</option>
                          {options.data.sections.children
                            .filter((s) => !classId || s.classId === classId)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className="field">
                        Subject
                        <select
                          value={subjectId}
                          onChange={(e) => {
                            setSubjectId(e.target.value);
                            setAfter(undefined);
                          }}
                        >
                          <option value="">All subjects</option>
                          {options.data.subjects.children
                            .filter((s) => !classId || s.classId === classId)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    </>
                  )}
                </form>
              )}
              <div className="onboarding-table">
                <table>
                  <caption>
                    {assignments ? 'Teacher subject assignments' : 'Annual student enrollments'}
                  </caption>
                  <thead>
                    <tr>
                      <th>Name / code</th>
                      <th>Class</th>
                      <th>Section</th>
                      <th>{assignments ? 'Subject' : 'Roll'}</th>
                      <th>Status</th>
                      {manage && <th>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(state.data?.items ?? []).map((record) => (
                      <tr key={record.id}>
                        <td>
                          <Link
                            to={`/${assignments ? 'teachers' : 'students'}/${record.personId}?year=${yearId}`}
                          >
                            {record.name}
                          </Link>
                          <small>{record.code}</small>
                        </td>
                        <td>{record.className}</td>
                        <td>{record.sectionName}</td>
                        <td>{assignments ? record.subjectName : (record.rollNumber ?? '—')}</td>
                        <td>{record.status}</td>
                        {manage && (
                          <td>
                            {record.status === 'active' && canAssign && (
                              <Button variant="secondary" onClick={() => setEditing(record)}>
                                Edit
                              </Button>
                            )}
                            {assignments &&
                              record.status === 'active' &&
                              access.permissions.includes('staff.view') && (
                                <Button variant="secondary" onClick={() => setReplacing(record)}>
                                  Replace teacher
                                </Button>
                              )}
                            {record.status === 'active' && (
                              <Button variant="ghost" onClick={() => setEnding(record)}>
                                {assignments ? 'End assignment' : 'Withdraw enrollment'}
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {state.data && !state.data.items.length && !state.loading && (
                <p>
                  {assignments
                    ? 'No assignments yet. Import teaching staff and configure class subjects first.'
                    : 'No enrollments yet. Import students into this year to get started.'}
                </p>
              )}
              {state.data && (
                <Paging
                  nextCursor={state.data.nextCursor}
                  hasPrevious={!!after}
                  first={() => setAfter(undefined)}
                  next={() => setAfter(state.data!.nextCursor ?? undefined)}
                />
              )}
            </>
          )}
          {ending && (
            <ConfirmAction
              title={assignments ? 'End this teaching assignment?' : 'Withdraw this enrollment?'}
              description={
                assignments
                  ? 'The teacher will no longer be actively assigned to this subject and section. You can assign them again later.'
                  : 'This student’s enrollment will be marked withdrawn. Their identity and history remain. Imports cannot reactivate a withdrawn enrollment.'
              }
              action={() => onboardingApi.endRelation(access.schoolId, yearId, kind, ending)}
              close={() => setEnding(null)}
              saved={state.reload}
            />
          )}
          {replacing && (
            <ReplaceTeacherDialog
              schoolId={access.schoolId}
              yearId={yearId}
              assignment={replacing}
              close={() => setReplacing(undefined)}
              saved={state.reload}
            />
          )}
          {(adding || editing) && (
            <AssignmentForm
              schoolId={access.schoolId}
              yearId={yearId}
              replacing={editing}
              close={() => {
                setAdding(false);
                setEditing(undefined);
              }}
              saved={state.reload}
            />
          )}
        </div>
      </Panel>
    </LoadingOverlay>
  );
}
function AssignmentForm({
  replacing,
  schoolId,
  yearId,
  close,
  saved,
}: {
  schoolId: string;
  replacing?: Relation;
  yearId: string;
  close: () => void;
  saved: () => void;
}) {
  const [teacher, setTeacher] = useState<Person | undefined>(
      replacing
        ? {
            id: replacing.personId,
            schoolId,
            name: replacing.name,
            code: replacing.code,
            status: 'active',
            revision: 0,
            teaching: true,
          }
        : undefined,
    ),
    [classId, setClass] = useState(replacing?.classId || ''),
    [sectionId, setSection] = useState(replacing?.sectionId || ''),
    [subjectId, setSubject] = useState(replacing?.subjectId || ''),
    [search, setSearch] = useState(''),
    [query, setQuery] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [queue, setQueue] = useState<
    { staffId: string; classId: string; sectionId: string; subjectId: string; label: string }[]
  >([]);
  const loadStaff = useCallback(
    (signal: AbortSignal, after?: string) =>
      onboardingApi.people(schoolId, 'staff', signal, after, query),
    [schoolId, query],
  );
  const staff = useSetupList(loadStaff);
  const loadStructure = useCallback(
    async (signal: AbortSignal) => {
      const [sections, subjects] = await Promise.all([
        onboardingApi.structure(schoolId, yearId, 'sections', signal),
        onboardingApi.structure(schoolId, yearId, 'subjects', signal),
      ]);
      return { sections, subjects };
    },
    [schoolId, yearId],
  );
  const structure = useRemote(loadStructure);
  return (
    <Modal
      open
      title={replacing ? 'Edit assignment' : 'Assign teaching staff'}
      description="Only active teaching staff and matching class, section and subject records can be assigned."
      onClose={() => {
        if (!busy) close();
      }}
    >
      <LoadingOverlay
        local
        loading={structure.loading || staff.loading}
        size="lg"
        label="Loading assignment options…"
        message="Loading assignment options…"
      >
        <div className="live-content">
          {structure.error && <LoadState {...structure} loading={false} retry={structure.reload} />}
          {staff.error && <LoadState {...staff} loading={false} retry={staff.reload} />}
          <form
            className="live-actions"
            onSubmit={(event) => {
              event.preventDefault();
              staff.first();
              setQuery(search);
            }}
          >
            <input
              aria-label="Search teachers"
              placeholder="Name or staff code"
              value={search}
              maxLength={80}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Button variant="secondary">Search teachers</Button>
          </form>
          <label>
            Teacher
            <select
              aria-label="Teacher"
              value={teacher?.id ?? ''}
              onChange={(event) =>
                setTeacher(staff.data?.items.find((item) => item.id === event.target.value))
              }
            >
              <option value="">Choose teacher</option>
              {teacher && !staff.data?.items.some((item) => item.id === teacher.id) && (
                <option value={teacher.id}>{teacher.name}</option>
              )}
              {staff.data?.items
                .filter((item) => item.teaching && item.status === 'active')
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.code}
                  </option>
                ))}
            </select>
          </label>
          <Paging {...staff} nextCursor={staff.data?.nextCursor} />
          {structure.data && (
            <form
              className="live-form"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!teacher) return;
                setBusy(true);
                try {
                  await onboardingApi.assignBatch(schoolId, yearId, [
                    ...queue.map(({ label, ...row }) => {
                      void label;
                      return row;
                    }),
                    {
                      staffId: teacher.id,
                      classId,
                      sectionId,
                      subjectId,
                      ...(replacing
                        ? { replaceId: replacing.id, revision: replacing.revision }
                        : {}),
                    },
                  ]);
                  saved();
                  close();
                } catch (cause) {
                  setError(accessError(cause));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Class
                <select
                  aria-label="Class"
                  required
                  value={classId}
                  onChange={(event) => {
                    setClass(event.target.value);
                    setSection('');
                    setSubject('');
                  }}
                >
                  <option value="">Choose class</option>
                  {structure.data.sections.classes
                    .filter((item) => item.status === 'active')
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Section
                <select
                  aria-label="Section"
                  required={structure.data.sections.children.some(
                    (s) => s.classId === classId && s.status === 'active',
                  )}
                  value={sectionId}
                  onChange={(event) => setSection(event.target.value)}
                >
                  <option value="">
                    {structure.data.sections.children.some(
                      (s) => s.classId === classId && s.status === 'active',
                    )
                      ? 'Choose section'
                      : 'Whole class · no sections'}
                  </option>
                  {structure.data.sections.children
                    .filter((item) => item.classId === classId && item.status === 'active')
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Subject
                <select
                  aria-label="Subject"
                  required
                  value={subjectId}
                  onChange={(event) => setSubject(event.target.value)}
                >
                  <option value="">Choose subject</option>
                  {structure.data.subjects.children
                    .filter((item) => item.classId === classId && item.status === 'active')
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                        {item.optional ? ' (optional)' : ''}
                      </option>
                    ))}
                </select>
              </label>
              {replacing && (
                <p className="panel-note">
                  Current: {replacing.name} · {replacing.className} ·{' '}
                  {replacing.sectionName || 'Whole class'} · {replacing.subjectName}. Saving
                  archives this assignment and applies the new selection together. Historical
                  records remain. Separate class-teacher designations continue to grant their own
                  access.
                </p>
              )}
              {queue.length > 0 && (
                <ul>
                  {queue.map((row, i) => (
                    <li key={i}>
                      {row.label}
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setQueue(queue.filter((_, j) => j !== i))}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {!replacing && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy || !teacher || !classId || !subjectId || queue.length >= 99}
                  onClick={() => {
                    if (!teacher) return;
                    setQueue([
                      ...queue,
                      {
                        staffId: teacher.id,
                        classId,
                        sectionId,
                        subjectId,
                        label: `${teacher.name} · ${structure.data?.sections.classes.find((c) => c.id === classId)?.name} · ${structure.data?.sections.children.find((s) => s.id === sectionId)?.name || 'Whole class'} · ${structure.data?.subjects.children.find((s) => s.id === subjectId)?.name}`,
                      },
                    ]);
                    setSubject('');
                  }}
                >
                  Add another assignment
                </Button>
              )}
              <p className="panel-note">
                All selected assignments save together. The server validates active teaching staff
                and matching class subjects and sections; no timetable conflict rules are
                configured.
              </p>
              {error && <p role="alert">{error}</p>}
              {(structure.data.sections.truncated || structure.data.subjects.truncated) && (
                <p>Only the first 200 classes and 2,000 children are listed.</p>
              )}
              <Button disabled={busy || !teacher || !!structure.error}>
                {busy ? 'Saving…' : 'Save assignment'}
              </Button>
            </form>
          )}
        </div>
      </LoadingOverlay>
    </Modal>
  );
}
