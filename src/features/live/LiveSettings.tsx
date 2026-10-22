import { useCallback } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Button, LoadingOverlay, Panel, StatCard } from '../../components/ui/Primitives';
import SectionNavigation from '../../components/shared/SectionNavigation';
import LiveSchoolProfile from '../settings/LiveSchoolProfile';
import LiveClassStructure from '../settings/LiveClassStructure';
import LiveStudents from '../students/LiveStudents';
import LiveStaff from '../teachers/LiveStaff';
import { schoolAccessService } from '../../services/schoolAccessService';
import { setupApi } from '../../services/schoolSetupService';
import AcademicYears from '../setup/AcademicYears';
import { useRemote } from './useRemote';
import LiveRoles from './LiveRoles';
import LiveMembers from './LiveMembers';
import LiveAudit from './LiveAudit';
import LiveAccount from './LiveAccount';
import { schoolNavigation } from './schoolNavigation';
import '../setup/setup.css';
import '../../styles/admin-settings.css';
export default function LiveSettings({ schoolId }: { schoolId: string | null }) {
  if (schoolId) return <SchoolWorkspace key={schoolId} schoolId={schoolId} />;
  return (
    <>
      <Panel>
        <div className="live-content">
          <h2>School setup required</h2>
          <p>No active school membership is available. Contact your administrator.</p>
        </div>
      </Panel>
      <LiveAccount />
    </>
  );
}
function SchoolWorkspace({ schoolId }: { schoolId: string }) {
  const [params, setParams] = useSearchParams(),
    location = useLocation();
  const load = useCallback(
    async (signal: AbortSignal) => ({
      access: await schoolAccessService.context(schoolId, signal),
      status: await setupApi.status(schoolId, signal),
    }),
    [schoolId],
  );
  const state = useRemote(load);
  if (state.loading)
    return (
      <LoadingOverlay
        loading
        size="xl"
        label="Loading your school workspace…"
        message="Loading your school workspace…"
      >
        <Panel title="School workspace" subtitle="Loading school configuration and permissions.">
          <div style={{ minHeight: 180 }} />
        </Panel>
      </LoadingOverlay>
    );
  if (!state.data || state.error)
    return (
      <Panel>
        <h2>School access unavailable</h2>
        <p role="alert">{state.error}</p>
        <Button onClick={state.reload}>Retry access</Button>
      </Panel>
    );
  const { access, status } = state.data,
    can = (p: string) => access.permissions.includes(p),
    year = params.get('year') ?? status.currentAcademicYearId;
  const path = location.pathname;
  const denied = (
    <Panel title="Access unavailable">
      <p>Your role does not include this feature.</p>
      <Link to="/settings">Open available settings</Link>
    </Panel>
  );
  if (path.startsWith('/students'))
    return can('students.view') ? (
      <LiveStudents
        key={`${schoolId}:${year}:${path}`}
        access={access}
        yearId={year}
        mode={
          path === '/students/new'
            ? 'new'
            : path === '/students/import'
              ? 'import'
              : path === '/students'
                ? 'directory'
                : 'profile'
        }
      />
    ) : (
      denied
    );
  if (path.startsWith('/teachers') || path === '/staff')
    return can('staff.view') ? (
      <LiveStaff
        key={`${schoolId}:${path}`}
        access={access}
        yearId={year}
        teachersOnly={path.startsWith('/teachers')}
      />
    ) : (
      denied
    );
  if (path === '/overview')
    return (
      <>
        <Panel
          title="School overview"
          subtitle="Saved school configuration and current-year records."
        >
          {null}
        </Panel>
        <div className="stats-grid">
          {Object.entries(status.counts)
            .filter(
              ([key, value]) =>
                typeof value === 'number' &&
                [
                  'classes',
                  'sections',
                  'subjects',
                  'students',
                  'staff',
                  'enrollments',
                  'assignments',
                ].includes(key),
            )
            .map(([key, value]) => (
              <StatCard key={key} label={key} value={value ?? 0} detail="Saved records" />
            ))}
        </div>
        <Panel title={status.ready ? 'School foundation ready' : 'Continue school configuration'}>
          <div className="live-content">
            {status.steps
              .filter((step) => can(step.permission))
              .map((step) => (
                <p key={step.key}>
                  {step.label}: {step.status.replace('-', ' ')} · {step.detail}
                </p>
              ))}
            <Link className="button primary" to="/settings">
              Open school settings
            </Link>
          </div>
        </Panel>
      </>
    );
  const requested = params.get('tab'),
    { available, active } = schoolNavigation(access.permissions, requested);
  const section =
    params.get('section') ??
    (requested === 'Members' ? 'members' : requested === 'Activity' ? 'activity' : '');
  const choose = (tab: string) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set('tab', tab);
      next.delete('section');
      next.delete('step');
      next.delete('import');
      return next;
    });
  const roleItems = [
    ...(can('roles.view') ? [{ id: 'roles', label: 'Roles' }] : []),
    ...(can('memberships.view') ? [{ id: 'members', label: 'Members' }] : []),
  ];
  const securityItems = [
    { id: 'account', label: 'Account' },
    ...(can('audit.view') ? [{ id: 'activity', label: 'Activity' }] : []),
  ];
  const nested = (items: { id: string; label: string }[], label: string) => (
    <SectionNavigation
      items={items}
      value={items.find((i) => i.id === section)?.id ?? items[0].id}
      onChange={(value) =>
        setParams((previous) => {
          const next = new URLSearchParams(previous);
          next.set('section', value);
          return next;
        })
      }
      label={label}
    />
  );
  return (
    <>
      <nav className="settings-tabs" aria-label="School settings sections">
        <SectionNavigation
          items={available.map((s) => ({ id: s.name, label: s.name }))}
          value={active}
          onChange={choose}
          label="Settings"
        />
      </nav>
      {active === 'General' ? (
        <LiveSchoolProfile schoolId={schoolId} canManage={can('school.profile.manage')} />
      ) : active === 'Classes, Sections & Grades' ? (
        <LiveClassStructure key={`${schoolId}:${year}`} access={access} yearId={year} />
      ) : active === 'Academic years' ? (
        <AcademicYears access={access} status={status} changed={state.reload} />
      ) : active === 'Staff & Payroll' ? (
        <LiveStaff access={access} yearId={year} />
      ) : active === 'Roles & Permissions' ? (
        <>
          {nested(roleItems, 'Roles and membership features')}
          {(section === 'members' || !can('roles.view')) && can('memberships.view') ? (
            <LiveMembers access={access} refreshAccess={state.reload} />
          ) : (
            <LiveRoles access={access} refreshAccess={state.reload} />
          )}
        </>
      ) : (
        <>
          {nested(securityItems, 'Data and security features')}
          {section === 'activity' && can('audit.view') ? (
            <LiveAudit schoolId={schoolId} />
          ) : (
            <LiveAccount />
          )}
        </>
      )}
    </>
  );
}
