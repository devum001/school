import { matchesStaffAttendance } from '../../lib/staffAttendanceSummary';
import { attendanceOptions } from '../../lib/attendanceOptions';
import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Button, LoadingOverlay, PageHeading, Panel } from '../../components/ui/Primitives';
import SectionNavigation from '../../components/shared/SectionNavigation';
import ContactPhone from '../../components/shared/ContactPhone';
import AttendanceStatus from '../../components/shared/AttendanceStatus';
import {
  readContacts,
  type ContactDirectory,
  type ContactQuery,
} from '../../services/contactDirectoryService';
import { useLiveSchool } from '../live/schoolContext';
import { useRemote } from '../live/useRemote';
import { useSchool } from '../../app/useSchool';
import { useToday } from '../../app/useToday';
import { staffDirectory, staffDesignation } from '../../lib/staffStructure';
import { defaultStaffPayroll } from '../../lib/settings';
import { titleCase } from '../../lib/displayFormat';
import { useDebouncedValue } from '../../app/useDebouncedValue';
import '../hr/hr.css';
import './contacts.css';
type Loader = (query: ContactQuery, signal: AbortSignal) => Promise<ContactDirectory>;
export default function LiveQuickConnect() {
  const { schoolId, access, status } = useLiveSchool();
  const tabs = [
    ...(access.permissions.includes('contacts.students.view') &&
    (access.permissions.includes('students.view') || access.permissions.includes('teaching.self'))
      ? ['students']
      : []),
    ...(access.permissions.includes('contacts.staff.view') &&
    access.permissions.includes('staff.view')
      ? ['teachers', 'staff']
      : []),
  ];
  const load = useCallback<Loader>(
    (query, signal) =>
      readContacts(
        schoolId,
        { ...query, yearId: status.currentAcademicYearId || undefined },
        signal,
      ),
    [schoolId, status.currentAcademicYearId],
  );
  return <Directory key={schoolId} tabs={tabs} load={load} />;
}
export function DemoQuickConnect() {
  const state = useSchool(),
    today = useToday();
  const load = useCallback<Loader>(
    async (query) => {
      const config = state.staffPayroll || defaultStaffPayroll;
      const rows =
        query.kind === 'students'
          ? state.enrollments
              .filter(
                (e) => e.schoolId === state.school.id && e.academicYearId === state.academicYear.id,
              )
              .flatMap((e) => {
                const p = state.students.find((s) => s.id === e.studentId && s.status === 'active');
                return p
                  ? [
                      {
                        id: p.id,
                        name: p.name,
                        code: p.admissionNumber,
                        phone: p.guardian.contact || '',
                        contactName: p.guardian.name,
                        detail: [
                          state.classes.find((c) => c.id === e.classId)?.name,
                          state.sections.find((s) => s.id === e.sectionId)?.name,
                        ]
                          .filter(Boolean)
                          .join(' · '),
                        attendanceStatus:
                          state.attendance.find((d) => d.enrollmentId === e.id && d.date === today)
                            ?.status || 'unmarked',
                        profileUrl: `/students/${p.id}`,
                      },
                    ]
                  : [];
              })
          : staffDirectory(state, config)
              .filter(
                (p) =>
                  p.status === 'active' &&
                  (query.kind === 'teachers' ? !!p.teacherId : !p.teacherId),
              )
              .map((p) => ({
                id: p.id,
                name: p.name,
                code: p.staffId || '',
                phone: p.phone,
                detail: staffDesignation(p, config),
                attendanceStatus:
                  state.staffAttendance?.find((d) => d.staffId === p.id && d.date === today)
                    ?.status || 'unmarked',
                profileUrl: p.teacherId ? `/teachers/${p.teacherId}` : `/staff/${p.id}`,
              }));
      const searched = rows.filter((p) =>
        `${p.name} ${p.code} ${p.phone}`.toLowerCase().includes(query.search.toLowerCase()),
      );
      const filtered = searched.filter((p) =>
        query.kind === 'students'
          ? !query.status || p.attendanceStatus === query.status
          : matchesStaffAttendance(p.attendanceStatus, query.status),
      );
      return {
        items: filtered.slice(query.offset, query.offset + 50),
        counts: Object.fromEntries(
          attendanceOptions.map((s) => [
            s,
            searched.filter((p) =>
              query.kind === 'students'
                ? p.attendanceStatus === s
                : matchesStaffAttendance(p.attendanceStatus, s),
            ).length,
          ]),
        ),
        date: today,
        total: filtered.length,
        nextOffset: filtered.length > query.offset + 50 ? query.offset + 50 : null,
      };
    },
    [state, today],
  );
  return <Directory tabs={['students', 'teachers', 'staff']} load={load} />;
}
function Directory({ tabs, load }: { tabs: string[]; load: Loader }) {
  const [kind, setKind] = useState(tabs[0] || 'students');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);

  const query: ContactQuery = {
    kind,
    search: debouncedSearch.trim(),
    status,
    offset,
  };

  const allowed = tabs.includes(kind);
  const fetch = useCallback(
    (signal: AbortSignal) =>
      allowed
        ? load(query, signal)
        : Promise.resolve({ items: [], total: 0, counts: {}, date: '', nextOffset: null }),
    [load, allowed, kind, debouncedSearch, status, offset],
  );
  const state = useRemote(fetch);
  return (
    <div className="ledger-stack">
      <PageHeading
        title="Quick Connect"
        description="Find people in your school and contact them directly."
      />
      {!tabs.length ? (
        <Panel>Your role does not include contact-directory access.</Panel>
      ) : (
        <>
          <SectionNavigation
            label="Contact directory"
            value={kind}
            onChange={(newKind) => {
              setKind(newKind);
              setOffset(0);
            }}
            items={tabs.map((id) => ({
              id,
              label: id === 'staff' ? 'Other Staff' : titleCase(id),
              icon: id === 'students' ? 'student' : 'staff',
            }))}
          />
          <Panel
            title={
              kind === 'students' ? 'Parent & guardian contacts' : 'School staff contacts'
            }
            subtitle="Attendance describes the school day, not whether someone is signed in."
            action={
              <div className="hr-header-filters">
                <label className="field hr-inline-filter">
                  <span>Search</span>
                  <input
                    value={search}
                    maxLength={80}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setOffset(0);
                    }}
                    placeholder="Name, ID or phone"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setOffset(0);
                        state.reload();
                      }
                    }}
                  />
                </label>
                <label className="field hr-inline-filter">
                  <span>Attendance</span>
                  <select
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setOffset(0);
                    }}
                  >
                    <option value="">All statuses</option>
                    {attendanceOptions.map((s) => (
                      <option key={s} value={s}>
                        {titleCase(s.replaceAll('-', ' '))} ({state.data?.counts[s] || 0})
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="button" variant="secondary" onClick={state.reload}>
                  Refresh
                </Button>
              </div>
            }
          >
            <LoadingOverlay loading={state.loading} label="Loading contacts…">
              {state.error ? (
                <p className="form-error" role="alert">
                  {state.error}
                </p>
              ) : (
                <div className="contact-list">
                  {state.data?.items.map((p) => (
                    <article className="contact-row" key={p.id}>
                      <div className="person">
                        {p.profileUrl ? (
                          <Link className="person" to={p.profileUrl}>
                            <Avatar name={p.name} />
                            <strong>{titleCase(p.name)}</strong>
                          </Link>
                        ) : (
                          <>
                            <Avatar name={p.name} />
                            <strong>{titleCase(p.name)}</strong>
                          </>
                        )}
                        <small>{p.code}</small>
                      </div>
                      <div>
                        <p>{p.detail}</p>
                        {p.contactName && <small>Guardian · {titleCase(p.contactName)}</small>}
                      </div>
                      <AttendanceStatus status={p.attendanceStatus} />
                      <ContactPhone phone={p.phone} name={p.contactName || p.name} />
                    </article>
                  ))}
                  {!state.loading && !state.data?.items.length && (
                    <p className="panel-note">No contacts match your filters.</p>
                  )}
                </div>
              )}
            </LoadingOverlay>
            <div className="live-actions">
              <Button
                variant="secondary"
                disabled={!offset}
                onClick={() => setOffset(Math.max(0, offset - 50))}
              >
                Previous
              </Button>
              <span>{state.data?.total || 0} contacts</span>
              <Button
                variant="secondary"
                disabled={state.data?.nextOffset == null}
                onClick={() => setOffset(state.data?.nextOffset || 0)}
              >
                Next
              </Button>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
