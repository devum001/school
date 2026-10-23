import StaffLoginDialog from '../hr/StaffLoginDialog';
import { titleCase } from '../../lib/displayFormat';
import StaffDepartmentOptions from '../hr/StaffDepartmentOptions';
import LiveHrWorkspace from '../hr/HrWorkspace';
import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Avatar,
  Badge,
  Button,
  Modal,
  Panel,
  SearchInput,
  EmptyState,
  LoadingOverlay,
} from '../../components/ui/Primitives';
import type { SchoolAccess } from '../../services/schoolAccessService';
import { onboardingApi, type Person } from '../../services/onboardingService';
import { productApi } from '../../services/productService';
import { useSetupList } from '../setup/useSetupList';
import { LoadState, Paging, ConfirmAction } from '../setup/SetupControls';
import RosterWorkspace from '../setup/RosterWorkspace';
import PeopleRelations from '../setup/PeopleRelations';
import SectionNavigation from '../../components/shared/SectionNavigation';
import { useDraftGuard } from '../academics/useDraftGuard';
import { useToday } from '../../app/useToday';
import { readProfileImage } from '../../lib/fileUploads';
import StaffContactFields from './StaffContactFields';
export default function LiveStaff({
  access,
  yearId,
  teachersOnly = false,
}: {
  access: SchoolAccess;
  yearId: string | null;
  teachersOnly?: boolean;
}) {
  const [params, setParams] = useSearchParams(),
    [query, setQuery] = useState(''),
    [loginStaff, setLoginStaff] = useState<Person | null>(null),
    [editing, setEditing] = useState<Person | 'new' | null>(
      params.get('add') === 'teacher' ? 'new' : null,
    ),
    [change, setChange] = useState<Person | null>(null);
  const manage = access.permissions.includes('staff.manage'),
    requested = params.get('section');
  const items = [
    { id: 'directory', label: teachersOnly ? 'Teachers' : 'All Staff' },
    ...(manage ? [{ id: 'import', label: 'Import staff' }] : []),
    ...(access.permissions.includes('attendance.manage')
      ? [
          { id: 'attendance', label: 'Attendance' },
          { id: 'leave', label: 'Leave' },
        ]
      : []),
    ...(access.permissions.includes('payroll.view')
      ? [{ id: 'salary', label: 'Salary Expenses' }]
      : []),
    ...(access.permissions.includes('attendance.self')
      ? [{ id: 'self', label: 'My attendance & salary' }]
      : []),
    ...(access.permissions.includes('assignments.view')
      ? [{ id: 'assignments', label: 'Teaching assignments' }]
      : []),
  ];
  const section = items.find((i) => i.id === requested)?.id ?? 'directory';
  const load = useCallback(
    (signal: AbortSignal, after?: string) =>
      onboardingApi.people(access.schoolId, 'staff', signal, after, query, teachersOnly),
    [access.schoolId, query, teachersOnly],
  );
  const state = useSetupList(load);
  const loadingLabel = teachersOnly ? 'Loading teachers…' : 'Loading staff & HR…';
  return (
    <div className="ledger-stack">
      {loginStaff && (
        <StaffLoginDialog
          schoolId={access.schoolId}
          staff={loginStaff}
          permissions={access.permissions}
          close={() => setLoginStaff(null)}
          saved={state.reload}
        />
      )}
      <SectionNavigation
        items={items}
        value={section}
        onChange={(value) =>
          setParams((previous) => {
            const next = new URLSearchParams(previous);
            next.set('section', value);
            next.delete('import');
            return next;
          })
        }
        label={teachersOnly ? 'Teacher features' : 'Staff & HR'}
      />
      {['attendance', 'leave', 'salary', 'self'].includes(section) ? (
        <LiveHrWorkspace
          key={section}
          section={section}
          hideNavigation
          teachersOnly={teachersOnly}
        />
      ) : section === 'import' ? (
        <RosterWorkspace access={access} kind="staff" yearId={yearId} />
      ) : section === 'assignments' ? (
        <PeopleRelations access={access} kind="teaching-assignments" yearId={yearId} />
      ) : (
        <LoadingOverlay
          loading={state.loading}
          size="xl"
          label={loadingLabel}
          message={loadingLabel}
        >
          <Panel
            title={teachersOnly ? 'Teachers' : 'Staff & HR'}
            action={
              <div className="panel-header-actions">
                <SearchInput
                  value={query}
                  onChange={setQuery}
                  placeholder="Search staff name or code…"
                />
                {manage && (
                  <Button onClick={() => setEditing('new')}>
                    {teachersOnly ? 'Add Teacher' : 'Add Staff'}
                  </Button>
                )}
              </div>
            }
          >
            {state.error && <LoadState {...state} loading={false} retry={state.reload} />}
            {!state.error && (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Staff member</th>
                        <th>Department</th>
                        <th>Designation</th>
                        <th>Contact</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(state.data?.items ?? []).map((p) => (
                        <tr key={p.id}>
                          <td>
                            <span className="avatar">
                              {p.photoDataUrl ? (
                                <img
                                  src={p.photoDataUrl}
                                  alt=""
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              ) : (
                                <Avatar name={p.name} />
                              )}
                            </span>
                            <strong>{titleCase(p.name)}</strong>
                            <small>
                              {p.code}
                              {p.teaching ? ' · Teaching' : ''}
                            </small>
                          </td>
                          <td>{titleCase(p.department || '') || '—'}</td>
                          <td>{titleCase(p.designation || '') || '—'}</td>
                          <td>{p.email || p.phone || 'Not provided'}</td>
                          <td>
                            <Badge tone={p.status === 'active' ? 'green' : 'neutral'}>
                              {titleCase(p.status)}
                            </Badge>
                          </td>
                          <td>
                            {manage && (
                              <>
                                {p.status === 'active' &&
                                  !p.userId &&
                                  access.permissions.includes('memberships.manage') &&
                                  access.permissions.includes('roles.view') && (
                                    <Button variant="ghost" onClick={() => setLoginStaff(p)}>
                                      Enable login
                                    </Button>
                                  )}
                                {p.userId && <Badge tone="green">Login linked</Badge>}
                                {access.permissions.includes('payroll.view') &&
                                  access.permissions.includes('payroll.manage') && (
                                    <Button
                                      variant="ghost"
                                      onClick={() =>
                                        setParams((previous) => {
                                          const next = new URLSearchParams(previous);
                                          next.set('section', 'salary');
                                          next.set('setupSalary', p.id);
                                          return next;
                                        })
                                      }
                                    >
                                      Salary & attendance
                                    </Button>
                                  )}
                                <Button variant="ghost" onClick={() => setEditing(p)}>
                                  Edit
                                </Button>
                                <Button variant="ghost" onClick={() => setChange(p)}>
                                  {p.status === 'active' ? 'Archive' : 'Restore'}
                                </Button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {state.data && !state.data.items.length && !state.loading && (
                  <EmptyState
                    title="No staff found"
                    description="Add a profile or import staff together. This does not create login accounts."
                  />
                )}
                {state.data && <Paging {...state} nextCursor={state.data.nextCursor} />}
              </>
            )}
            <p className="panel-note">
              Profiles and teaching assignments are saved to this school. Use the attendance and
              salary tabs according to your account permissions.
            </p>
          </Panel>
        </LoadingOverlay>
      )}
      {editing && (
        <StaffEditor
          schoolId={access.schoolId}
          person={editing === 'new' ? undefined : editing}
          teaching={teachersOnly}
          close={() => setEditing(null)}
          saved={(person) => {
            const created = editing === 'new';
            setEditing(null);
            state.reload();
            if (
              created &&
              access.permissions.includes('payroll.view') &&
              access.permissions.includes('payroll.manage')
            ) {
              setParams((previous) => {
                const next = new URLSearchParams(previous);
                next.set('section', 'salary');
                next.set('setupSalary', person.id);
                return next;
              });
            }
          }}
        />
      )}
      {change && (
        <ConfirmAction
          title={`${change.status === 'active' ? 'Archive' : 'Restore'} staff profile?`}
          description="History is retained. Active teaching and class-teacher assignments must be removed before archiving."
          close={() => setChange(null)}
          saved={() => undefined}
          action={async () => {
            await onboardingApi.changeStatus(access.schoolId, 'staff', change);
            setChange(null);
            state.reload();
          }}
        />
      )}
    </div>
  );
}
function StaffEditor({
  schoolId,
  person,
  teaching,
  close,
  saved,
}: {
  schoolId: string;
  person?: Person;
  teaching: boolean;
  close: () => void;
  saved: (person: Person) => void;
}) {
  const today = useToday();
  const [initial] = useState(() => ({
    photoDataUrl: person?.photoDataUrl ?? '',
    code: person?.code ?? '',
    name: person?.name ?? '',
    department: person?.department ?? '',
    designation: person?.designation ?? '',
    teaching: person?.teaching ?? teaching,
    email: person?.email ?? '',
    phone: person?.phone ?? '',
    joinedOn: person?.joinedOn ?? today,
    qualification: person?.qualification ?? '',
  }));
  const [draft, setDraft] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [readingPhoto, setReadingPhoto] = useState(false);
  const guard = useDraftGuard(JSON.stringify(initial) !== JSON.stringify(draft) && !busy, close);
  return (
    <Modal
      open
      wide
      title={guard.confirming ? 'Discard staff changes?' : person ? 'Edit staff' : 'Add Staff'}
      onClose={() => {
        if (!busy) guard.requestClose();
      }}
      description="Staff profiles do not automatically create login accounts."
    >
      {guard.confirming ? (
        <div className="modal-actions">
          <Button onClick={guard.keepEditing}>Keep editing</Button>
          <Button onClick={guard.discard}>Discard changes</Button>
        </div>
      ) : (
        <form
          data-unsaved={JSON.stringify(initial) !== JSON.stringify(draft)}
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError('');
            try {
              const result = await productApi.saveStaff(
                schoolId,
                [
                  draft.code,
                  draft.name,
                  draft.teaching ? 'Yes' : 'No',
                  draft.department,
                  draft.designation,
                  draft.email,
                  draft.phone,
                  draft.joinedOn,
                  draft.qualification,
                ],
                person,
                draft.photoDataUrl,
              );
              guard.complete(() => saved(result));
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Unable to save staff.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy} style={{ border: 0 }}>
            <div className="profile-image-editor">
              {draft.photoDataUrl && <img src={draft.photoDataUrl} alt="Staff photo preview" />}
              <label className="field">
                Photograph
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={readingPhoto}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    setReadingPhoto(true);
                    try {
                      const photoDataUrl = await readProfileImage(file);
                      setDraft((current) => ({ ...current, photoDataUrl }));
                    } catch (cause) {
                      setError(
                        cause instanceof Error ? cause.message : 'Unable to read photograph.',
                      );
                    } finally {
                      setReadingPhoto(false);
                    }
                  }}
                />
              </label>
              {draft.photoDataUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDraft({ ...draft, photoDataUrl: '' })}
                >
                  Remove photograph
                </Button>
              )}
            </div>
            <StaffDepartmentOptions schoolId={schoolId} />
            <div className="form-grid">
              {(['name', 'code', 'department', 'designation'] as const).map((key) => (
                <label className="field" key={key}>
                  {
                    {
                      name: 'Staff name',
                      code: 'Staff code',
                      department: 'Department',
                      designation: 'Designation',
                    }[key]
                  }
                  <input
                    required={key === 'name' || key === 'code'}
                    list={key === 'department' ? 'staff-departments' : undefined}
                    maxLength={key === 'code' ? 40 : 100}
                    disabled={key === 'code' && !!person}
                    value={draft[key]}
                    onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            <label className="access-login-field">
              <input
                type="checkbox"
                checked={draft.teaching}
                onChange={(e) => setDraft({ ...draft, teaching: e.target.checked })}
              />
              Teaching staff — show in Teachers directory
            </label>
            <StaffContactFields
              value={draft}
              onChange={(values) =>
                setDraft({ ...draft, ...values, qualification: values.qualification ?? '' })
              }
              today={today}
              qualificationLimit={120}
            />
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <Button type="button" variant="secondary" onClick={guard.requestClose}>
                Cancel
              </Button>
              <Button disabled={busy || readingPhoto}>Save staff</Button>
            </div>
          </fieldset>
        </form>
      )}
    </Modal>
  );
}
