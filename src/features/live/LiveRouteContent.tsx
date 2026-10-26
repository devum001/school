import LiveStudentProfile from '../students/LiveStudentProfile';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { PageHeading, Panel } from '../../components/ui/Primitives';
import LiveStudents from '../students/LiveStudents';
import LiveStaff from '../teachers/LiveStaff';
import { useLiveSchool } from './schoolContext';

// Reuse the existing school-scoped people integrations for these feature routes.
export function ExistingPeopleRoute() {
  const { schoolId, access, status } = useLiveSchool(),
    { pathname } = useLocation(),
    [params] = useSearchParams();
  const can = (p: string) => access.permissions.includes(p);
  const year = params.get('year') ?? status.currentAcademicYearId;
  const denied = (
    <Panel title="Access unavailable">
      <p>Your role does not include this feature.</p>
      <Link to="/settings">Open available settings</Link>
    </Panel>
  );
  return (
    <>
      <PageHeading
        title={
          pathname.startsWith('/students')
            ? 'Students'
            : pathname.startsWith('/teachers')
              ? 'Teachers'
              : 'Staff & HR'
        }
      />
      {pathname.startsWith('/students') ? (
        can('students.view') ? (
          pathname.startsWith('/students/') &&
          !['/students/new', '/students/import'].includes(pathname) ? (
            <LiveStudentProfile key={`${schoolId}:${year}:${pathname}`} yearId={year} />
          ) : (
            <LiveStudents
              key={`${schoolId}:${year}:${pathname}`}
              access={access}
              yearId={year}
              mode={
                pathname === '/students/new'
                  ? 'new'
                  : pathname === '/students/import'
                    ? 'import'
                    : 'directory'
              }
            />
          )
        ) : (
          denied
        )
      ) : can('staff.view') ? (
        <LiveStaff
          key={`${schoolId}:${pathname}`}
          access={access}
          yearId={year}
          teachersOnly={pathname.startsWith('/teachers')}
        />
      ) : (
        denied
      )}
    </>
  );
}
export function PendingSchoolRoute({ title }: { title: string }) {
  return (
    <>
      <PageHeading title={title} />
      <Panel>
        <p>This area is not connected yet. Your saved school records are preserved.</p>
        <Link to="/settings">Open school settings</Link>
      </Panel>
    </>
  );
}
