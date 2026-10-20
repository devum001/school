import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Modal, Panel } from '../../components/ui/Primitives';
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
}: {
  access: SchoolAccess;
  yearId: string | null;
  kind: RelationKind;
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
    />
  );
}
function RelationList({
  access,
  yearId,
  kind,
}: {
  access: SchoolAccess;
  yearId: string;
  kind: RelationKind;
}) {
  const [after, setAfter] = useState<string>();
  const load = useCallback(
    (signal: AbortSignal) => onboardingApi.relations(access.schoolId, yearId, kind, signal, after),
    [access.schoolId, yearId, kind, after],
  );
  const state = useRemote(load),
    [ending, setEnding] = useState<Relation | null>(null),
    [adding, setAdding] = useState(false);
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
  return (
    <Panel
      title={`${assignments ? 'Teaching assignments' : 'Student enrollments'}${year ? ` · ${year.name}` : ''}`}
      subtitle="Relationships belong to this academic year. Ending a relationship preserves its historical record."
      action={
        assignments && canAssign && <Button onClick={() => setAdding(true)}>Assign teacher</Button>
      }
    >
      <div className="live-content">
        <Link to="/settings?tab=Years">Choose another academic year</Link>
        <LoadState {...state} retry={state.reload} />
        {state.data && !state.error && (
          <>
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
                  {state.data.items.map((record) => (
                    <tr key={record.id}>
                      <td>
                        {record.name}
                        <small>{record.code}</small>
                      </td>
                      <td>{record.className}</td>
                      <td>{record.sectionName}</td>
                      <td>{assignments ? record.subjectName : (record.rollNumber ?? '—')}</td>
                      <td>{record.status}</td>
                      {manage && (
                        <td>
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
            {!state.data.items.length && (
              <p>
                {assignments
                  ? 'No assignments yet. Import teaching staff and configure class subjects first.'
                  : 'No enrollments yet. Import students into this year to get started.'}
              </p>
            )}
            <Paging
              nextCursor={state.data.nextCursor}
              hasPrevious={!!after}
              first={() => setAfter(undefined)}
              next={() => setAfter(state.data!.nextCursor ?? undefined)}
            />
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
        {adding && (
          <AssignmentForm
            schoolId={access.schoolId}
            yearId={yearId}
            close={() => setAdding(false)}
            saved={state.reload}
          />
        )}
      </div>
    </Panel>
  );
}
function AssignmentForm({
  schoolId,
  yearId,
  close,
  saved,
}: {
  schoolId: string;
  yearId: string;
  close: () => void;
  saved: () => void;
}) {
  const [teacher, setTeacher] = useState<Person>(),
    [classId, setClass] = useState(''),
    [sectionId, setSection] = useState(''),
    [subjectId, setSubject] = useState(''),
    [search, setSearch] = useState(''),
    [query, setQuery] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
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
      title="Assign a teacher"
      description="Only active teaching staff and matching class, section and subject records can be assigned."
      onClose={() => {
        if (!busy) close();
      }}
    >
      <div className="live-content">
        <LoadState {...structure} retry={structure.reload} />
        <LoadState {...staff} retry={staff.reload} />
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
                await onboardingApi.assign(schoolId, yearId, {
                  staffId: teacher.id,
                  classId,
                  sectionId,
                  subjectId,
                });
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
    </Modal>
  );
}
