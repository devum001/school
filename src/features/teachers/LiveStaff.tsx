import { useDebouncedValue } from '../../app/useDebouncedValue';
import { attendanceOptions } from '../../lib/attendanceOptions';
import AttendanceStatus from '../../components/shared/AttendanceStatus';
import ContactPhone from '../../components/shared/ContactPhone';
import StaffLoginDialog from '../hr/StaffLoginDialog';
import { autoCapitalizeName, titleCase } from '../../lib/displayFormat';
import { AppIcon } from '../../components/ui/Primitives';
import StaffDepartmentOptions from '../hr/StaffDepartmentOptions';
import LiveHrWorkspace from '../hr/HrWorkspace';
import { useCallback, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
import LiveStaffImport from './LiveStaffImport';
import { productApi } from '../../services/productService';
import { useSetupList } from '../setup/useSetupList';
import { LoadState, Paging, ConfirmAction } from '../setup/SetupControls';
import RosterWorkspace from '../setup/RosterWorkspace';
import PeopleRelations from '../setup/PeopleRelations';
import SectionNavigation from '../../components/shared/SectionNavigation';
import type { IconName } from '../../components/ui/Primitives';
const STAFF_NAV_ICONS: Record<string, IconName> = {
  directory: 'staff',
  import: 'upload',
  attendance: 'attendance',
  leave: 'document',
  salary: 'wallet',
  self: 'staff',
  assignments: 'document',
};
import { useDraftGuard } from '../academics/useDraftGuard';
import { useToday } from '../../app/useToday';
import { readProfileImage } from '../../lib/fileUploads';
import StaffContactFields from './StaffContactFields';
import '../hr/hr.css';
export default function LiveStaff({
  access,
  yearId,
  teachersOnly = false,
}: {
  access: SchoolAccess;
  yearId: string | null;
  teachersOnly?: boolean;
}) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams(),
    [query, setQuery] = useState(''),
    [loginStaff, setLoginStaff] = useState<Person | null>(null),
    [editing, setEditing] = useState<Person | 'new' | null>(
      params.get('add') === 'teacher' ? 'new' : null,
    ),
    [change, setChange] = useState<{
      person: Person;
      nextStatus: 'active' | 'inactive' | 'archived';
    } | null>(null),
    [importing, setImporting] = useState(false),
    [attendanceFilter, setAttendanceFilter] = useState('');

  const manage = access.permissions.includes('staff.manage'),
    requested = params.get('section');
  const items = [
    { id: 'directory', label: teachersOnly ? 'Teachers' : 'All Staff' },
    ...(!teachersOnly && access.permissions.includes('attendance.manage')
      ? [{ id: 'leave', label: 'Leave' }]
      : []),
    ...(access.permissions.includes('assignments.view')
      ? [{ id: 'assignments', label: 'Staff assignments' }]
      : []),
  ];
  const section = items.find((i) => i.id === requested)?.id ?? 'directory';
  const search = useDebouncedValue(query);
  const load = useCallback(
    (signal: AbortSignal, after?: string) =>
      onboardingApi.staffDirectory(
        access.schoolId,
        signal,
        after,
        search,
        teachersOnly,
        attendanceFilter,
      ),
    [access.schoolId, search, teachersOnly, attendanceFilter],
  );
  const state = useSetupList(load);

  const filteredStaff = state.data?.items ?? [];
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
      {items.length > 1 && (
        <SectionNavigation
          items={items.map((i) => ({ ...i, icon: STAFF_NAV_ICONS[i.id] || ('staff' as const) }))}
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
      )}
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
              <div className="panel-header-actions staff-header-toolbar">
                <label className="field">
                  Today's attendance
                  <select
                    value={attendanceFilter}
                    onChange={(e) => {
                      state.first();
                      setAttendanceFilter(e.target.value);
                    }}
                  >
                    <option value="">All attendance</option>
                    {attendanceOptions.map((status) => (
                      <option key={status} value={status}>
                        {titleCase(status.replaceAll('-', ' '))}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="staff-search-input">
                  <SearchInput
                    value={query}
                    onChange={(value) => {
                      state.first();
                      setQuery(value);
                    }}
                    placeholder={
                      teachersOnly
                        ? 'Search teacher name, code or phone…'
                        : 'Search staff name, code or phone…'
                    }
                  />
                </div>
                <div className="staff-header-buttons">
                  {manage && (
                    <Button variant="secondary" onClick={() => setImporting(true)}>
                      <AppIcon name="upload" size={16} />
                      {teachersOnly ? 'Import Teachers' : 'Import Staff'}
                    </Button>
                  )}
                  {(manage || access.permissions.includes('staff.create')) && (
                    <Button onClick={() => setEditing('new')}>
                      {teachersOnly ? 'Add Teacher' : 'Add Staff'}
                    </Button>
                  )}
                </div>
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
                        <th>{teachersOnly ? 'Teacher' : 'Staff member'}</th>
                        <th>Department</th>
                        <th>Designation</th>
                        <th>Contact</th>
                        <th>Employment / attendance</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStaff.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '36px' }}>
                            <EmptyState
                              title={teachersOnly ? 'No teachers found' : 'No staff members found'}
                              description="No matching records found."
                            />
                          </td>
                        </tr>
                      ) : (
                        filteredStaff.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <div className="person">
                                <Link
                                  aria-label={`Open ${p.name} profile`}
                                  to={`/${p.teaching ? 'teachers' : 'staff'}/${p.id}`}
                                >
                                  {p.photoDataUrl ? (
                                    <span className="avatar">
                                      <img
                                        src={p.photoDataUrl}
                                        alt=""
                                        style={{
                                          width: '100%',
                                          height: '100%',
                                          objectFit: 'cover',
                                        }}
                                      />
                                    </span>
                                  ) : (
                                    <Avatar name={p.name} />
                                  )}
                                </Link>
                                <div>
                                  <Link to={`/${p.teaching ? 'teachers' : 'staff'}/${p.id}`}>
                                    <strong>{titleCase(p.name)}</strong>
                                  </Link>
                                  <small>
                                    {[
                                      p.code,
                                      titleCase(p.designation || '') ||
                                        (p.teaching ? 'Teaching' : ''),
                                    ]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </small>
                                </div>
                              </div>
                            </td>
                            <td>{titleCase(p.department || '') || '—'}</td>
                            <td>{titleCase(p.designation || '') || '—'}</td>
                            <td className="staff-contact-cell">
                              <ContactPhone phone={p.phone} name={p.name} />
                              <small>{p.email}</small>
                            </td>
                            <td>
                              <div className="staff-status-chips">
                                <Badge
                                  tone={
                                    p.status === 'active'
                                      ? 'green'
                                      : p.status === 'inactive'
                                        ? 'amber'
                                        : 'neutral'
                                  }
                                >
                                  {p.status === 'inactive' ? 'Removed' : titleCase(p.status)}
                                </Badge>
                                <AttendanceStatus status={p.attendanceStatus} />
                              </div>
                            </td>
                            <td>
                              {(manage ||
                                access.permissions.includes('staff.edit') ||
                                access.permissions.includes('staff.archive')) && (
                                <div className="hr-actions staff-row-actions">
                                  {(manage || access.permissions.includes('staff.edit')) && (
                                    <Button variant="secondary" onClick={() => setEditing(p)}>
                                      Edit
                                    </Button>
                                  )}
                                  {access.permissions.includes('payroll.view') &&
                                    access.permissions.includes('payroll.manage') && (
                                      <Button
                                        variant="secondary"
                                        onClick={() =>
                                          navigate(`/fees?tab=Salary+Expenses&setupSalary=${p.id}`)
                                        }
                                      >
                                        Salary &amp; attendance
                                      </Button>
                                    )}
                                  {p.status === 'active' &&
                                    !p.userId &&
                                    access.permissions.includes('memberships.manage') &&
                                    access.permissions.includes('roles.view') && (
                                      <Button variant="secondary" onClick={() => setLoginStaff(p)}>
                                        Enable login
                                      </Button>
                                    )}
                                  {p.userId && <Badge tone="green">Login linked</Badge>}
                                  {p.status === 'active' &&
                                    (manage || access.permissions.includes('staff.archive')) && (
                                      <Button
                                        variant="ghost"
                                        className="staff-action-danger"
                                        onClick={() =>
                                          setChange({ person: p, nextStatus: 'inactive' })
                                        }
                                      >
                                        Remove
                                      </Button>
                                    )}
                                  {p.status === 'inactive' &&
                                    (manage || access.permissions.includes('staff.archive')) && (
                                      <>
                                        <Button
                                          variant="secondary"
                                          onClick={() =>
                                            setChange({ person: p, nextStatus: 'active' })
                                          }
                                        >
                                          Restore
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          className="staff-action-danger"
                                          onClick={() =>
                                            setChange({ person: p, nextStatus: 'archived' })
                                          }
                                        >
                                          Archive
                                        </Button>
                                      </>
                                    )}
                                  {p.status === 'archived' &&
                                    (manage || access.permissions.includes('staff.archive')) && (
                                      <Button
                                        variant="secondary"
                                        onClick={() =>
                                          setChange({ person: p, nextStatus: 'active' })
                                        }
                                      >
                                        Restore
                                      </Button>
                                    )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
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
      {importing && (
        <LiveStaffImport
          access={access}
          yearId={yearId}
          teachersOnly={teachersOnly}
          close={() => {
            setImporting(false);
            state.reload();
          }}
        />
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
          title={
            change.nextStatus === 'inactive'
              ? `Remove ${change.person.name}?`
              : change.nextStatus === 'archived'
                ? `Archive ${change.person.name}?`
                : `Restore ${change.person.name}?`
          }
          description={
            change.nextStatus === 'inactive'
              ? 'Removing this staff profile marks them as removed and ends their active class/subject assignments. Once removed, you can archive or restore their profile at any time.'
              : change.nextStatus === 'archived'
                ? 'History is retained in archived records. You can restore the profile later if needed.'
                : 'This will restore the staff profile back to active status.'
          }
          close={() => setChange(null)}
          saved={() => undefined}
          action={async () => {
            await onboardingApi.changeStatus(
              access.schoolId,
              'staff',
              change.person,
              change.nextStatus,
            );
            setChange(null);
            state.reload();
          }}
        />
      )}
    </div>
  );
}
export function StaffEditor({
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
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        [key]:
                          key === 'name' || key === 'designation'
                            ? autoCapitalizeName(e.target.value)
                            : e.target.value,
                      })
                    }
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
