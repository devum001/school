import StaffLoginDialog from '../hr/StaffLoginDialog';
import { autoCapitalizeName, titleCase } from '../../lib/displayFormat';
import { AppIcon } from '../../components/ui/Primitives';
import StaffDepartmentOptions from '../hr/StaffDepartmentOptions';
import LiveHrWorkspace from '../hr/HrWorkspace';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import { onboardingApi, type Person, type Relation } from '../../services/onboardingService';
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
    [selectedClass, setSelectedClass] = useState(''),
    [selectedSection, setSelectedSection] = useState(''),
    [structure, setStructure] = useState<{
      classes: { id: string; name: string }[];
      children: { id: string; classId: string; name: string }[];
    }>({ classes: [], children: [] }),
    [assignments, setAssignments] = useState<Relation[]>([]);

  useEffect(() => {
    if (!yearId) return;
    let active = true;
    Promise.all([
      onboardingApi.structure(access.schoolId, yearId, 'sections').catch(() => null),
      onboardingApi.relations(access.schoolId, yearId, 'teaching-assignments').catch(() => null),
    ]).then(([struct, rels]) => {
      if (!active) return;
      if (struct) {
        setStructure({
          classes: struct.classes || [],
          children: struct.children || [],
        });
      }
      if (rels) {
        setAssignments(rels.items || []);
      }
    });
    return () => {
      active = false;
    };
  }, [access.schoolId, yearId]);

  const classList = useMemo(() => {
    const list = [...structure.classes];
    for (const a of assignments) {
      if (a.className && !list.some((c) => c.name.toLowerCase() === a.className.toLowerCase())) {
        list.push({ id: a.className, name: a.className });
      }
    }
    return list;
  }, [structure.classes, assignments]);

  const sectionList = useMemo(() => {
    if (!selectedClass) return [];
    const matchedClass = classList.find(
      (c) => c.name.toLowerCase() === selectedClass.toLowerCase(),
    );
    const list = structure.children
      .filter((s) => !matchedClass || s.classId === matchedClass.id)
      .map((s) => ({ id: s.id, name: s.name }));
    for (const a of assignments) {
      if (
        a.className.toLowerCase() === selectedClass.toLowerCase() &&
        a.sectionName &&
        !list.some((s) => s.name.toLowerCase() === a.sectionName.toLowerCase())
      ) {
        list.push({ id: a.sectionName, name: a.sectionName });
      }
    }
    return list;
  }, [selectedClass, classList, structure.children, assignments]);

  const manage = access.permissions.includes('staff.manage'),
    requested = params.get('section');
  const items = [
    { id: 'directory', label: teachersOnly ? 'Teachers' : 'All Staff' },
    ...(!teachersOnly && access.permissions.includes('attendance.manage')
      ? [{ id: 'leave', label: 'Leave' }]
      : []),
    ...(!teachersOnly && access.permissions.includes('assignments.view')
      ? [{ id: 'assignments', label: 'Staff assignments' }]
      : []),
  ];
  const section = items.find((i) => i.id === requested)?.id ?? 'directory';
  const load = useCallback(
    (signal: AbortSignal, after?: string) =>
      onboardingApi.people(access.schoolId, 'staff', signal, after, query, teachersOnly),
    [access.schoolId, query, teachersOnly],
  );
  const state = useSetupList(load);

  const filteredStaff = useMemo(() => {
    const items = state.data?.items ?? [];
    if (!selectedClass) return items;
    const matchingIds = new Set(
      assignments
        .filter((a) => a.status === 'active')
        .filter(
          (a) =>
            a.className.trim().toLowerCase() === selectedClass.trim().toLowerCase() &&
            (!selectedSection ||
              a.sectionName.trim().toLowerCase() === selectedSection.trim().toLowerCase()),
        )
        .map((a) => a.personId),
    );
    return items.filter((p) => matchingIds.has(p.id));
  }, [state.data?.items, selectedClass, selectedSection, assignments]);
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
                <div className="staff-filters-row">
                  <select
                    className="staff-select-filter"
                    aria-label="Filter by class"
                    value={selectedClass}
                    onChange={(e) => {
                      setSelectedClass(e.target.value);
                      setSelectedSection('');
                    }}
                  >
                    <option value="">All classes</option>
                    {classList.map((c) => (
                      <option key={c.id || c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="staff-select-filter"
                    aria-label="Filter by section"
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                  >
                    <option value="">All sections</option>
                    {sectionList.map((s) => (
                      <option key={s.id || s.name} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="staff-search-input">
                  <SearchInput
                    value={query}
                    onChange={setQuery}
                    placeholder={
                      teachersOnly ? 'Search teacher name or code…' : 'Search staff name or code…'
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
                  {manage && (
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
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStaff.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '36px' }}>
                            <EmptyState
                              title={teachersOnly ? 'No teachers found' : 'No staff members found'}
                              description={
                                selectedClass
                                  ? `No ${teachersOnly ? 'teachers' : 'staff members'} assigned to ${selectedClass}${selectedSection ? ` - ${selectedSection}` : ''}.`
                                  : 'No matching records found.'
                              }
                            />
                          </td>
                        </tr>
                      ) : (
                        filteredStaff.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <div className="person">
                              {p.photoDataUrl ? (
                                <span className="avatar">
                                  <img
                                    src={p.photoDataUrl}
                                    alt=""
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                </span>
                              ) : (
                                <Avatar name={p.name} />
                              )}
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
                          <td>{p.email || p.phone || 'Not provided'}</td>
                          <td>
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
                          </td>
                          <td>
                            {manage && (
                              <div className="hr-actions staff-row-actions">
                                <Button variant="secondary" onClick={() => setEditing(p)}>
                                  Edit
                                </Button>
                                {access.permissions.includes('payroll.view') &&
                                  access.permissions.includes('payroll.manage') && (
                                    <Button
                                      variant="secondary"
                                      onClick={() =>
                                        setParams((previous) => {
                                          const next = new URLSearchParams(previous);
                                          next.set('section', 'salary');
                                          next.set('setupSalary', p.id);
                                          return next;
                                        })
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
                                {p.status === 'active' && (
                                  <Button
                                    variant="ghost"
                                    className="staff-action-danger"
                                    onClick={() => setChange({ person: p, nextStatus: 'inactive' })}
                                  >
                                    Remove
                                  </Button>
                                )}
                                {p.status === 'inactive' && (
                                  <>
                                    <Button
                                      variant="secondary"
                                      onClick={() => setChange({ person: p, nextStatus: 'active' })}
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
                                {p.status === 'archived' && (
                                  <Button
                                    variant="secondary"
                                    onClick={() => setChange({ person: p, nextStatus: 'active' })}
                                  >
                                    Restore
                                  </Button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )))}
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
                    onChange={(e) => setDraft({ ...draft, [key]: (key === 'name' || key === 'designation') ? autoCapitalizeName(e.target.value) : e.target.value })}
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
