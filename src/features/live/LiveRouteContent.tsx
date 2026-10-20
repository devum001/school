import { Link, useLocation } from 'react-router-dom';
import { PageHeading, Panel } from '../../components/ui/Primitives';
import LiveSettings from './LiveSettings';
import { useLiveSchool } from './schoolContext';
// Reuse the existing school-scoped people integrations for these feature routes.
export function ExistingPeopleRoute() {
  const { schoolId } = useLiveSchool(),
    { pathname } = useLocation();
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
      <LiveSettings key={`${schoolId}:${pathname}`} schoolId={schoolId} />
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
