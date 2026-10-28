import LiveHrWorkspace from '../hr/HrWorkspace';
import LiveNotificationsWorkspace from '../notifications/LiveNotificationsWorkspace';
import { Navigate, useSearchParams } from 'react-router-dom';
import SettingsPage from '../settings/SettingsPage';
import LiveSchoolProfile from '../settings/LiveSchoolProfile';
import LiveClassStructure from '../settings/LiveClassStructure';
import SectionNavigation from '../../components/shared/SectionNavigation';
import { Panel } from '../../components/ui/Primitives';
import AcademicYears from '../setup/AcademicYears';
import LiveRoles from './LiveRoles';
import LiveMembers from './LiveMembers';
import LiveAccount from './LiveAccount';
import LiveAudit from './LiveAudit';
import { useLiveSchool } from './schoolContext';
const sections: Record<string, { id: string; label: string }[]> = {
  'Staff & Payroll': [
    { id: 'departments', label: 'Departments' },
    { id: 'work', label: 'Work & Leave' },
    { id: 'payroll', label: 'Payroll' },
  ],
  Communication: [
    { id: 'channels', label: 'Channels' },
    { id: 'messages', label: 'Message Templates' },
  ],
  'Roles & Permissions': [
    { id: 'roles', label: 'Roles & Permissions' },
    { id: 'staff', label: 'Staff Access' },
  ],
  Templates: [
    { id: 'letterhead', label: 'School Letterhead' },
    { id: 'fee', label: 'Fee Receipt' },
    { id: 'salary', label: 'Salary Slip' },
  ],
  'Data & Security': [
    { id: 'export', label: 'Data Export' },
    { id: 'security', label: 'Login & Sessions' },
    { id: 'activity', label: 'Activity Log' },
  ],
  Preferences: [
    { id: 'display', label: 'Regional & Display' },
    { id: 'context', label: 'Default Context' },
  ],
};
export default function LiveSchoolSettings() {
  const context = useLiveSchool(),
    [params, setParams] = useSearchParams();
  const legacy: Record<string, { tab: string; section?: string }> = {
    Years: { tab: 'Preferences', section: 'context' },
    'Academic years': { tab: 'Preferences', section: 'context' },
    Setup: { tab: 'General' },
    Classes: { tab: 'Classes, Sections & Grades' },
    Roles: { tab: 'Roles & Permissions', section: 'roles' },
    Members: { tab: 'Roles & Permissions', section: 'staff' },
    Activity: { tab: 'Data & Security', section: 'activity' },
    Account: { tab: 'Data & Security', section: 'security' },
  };
  const alias = legacy[params.get('tab') ?? ''];
  if (alias) {
    const next = new URLSearchParams(params);
    next.set('tab', alias.tab);
    if (alias.section) next.set('section', alias.section);
    return <Navigate to={{ pathname: '/settings', search: next.toString() }} replace />;
  }
  const { access, schoolId, status, reload } = context;
  const can = (p: string) => access.permissions.includes(p);
  const denied = (
    <Panel>
      <p>Your role does not include access to this feature.</p>
    </Panel>
  );
  return (
    <SettingsPage
      availableTabs={
        access.owner
          ? undefined
          : [
              ...(can('school.profile.view') ? ['General'] : []),
              ...(can('classes.view') ? ['Classes, Sections & Grades'] : []),
              ...(can('payroll.view') && can('payroll.manage') ? ['Staff & Payroll'] : []),
              ...(can('school.profile.view') || can('overview.view') ? ['Communication'] : []),
              ...(can('roles.view') || can('memberships.view') ? ['Roles & Permissions'] : []),
              'Data & Security',
              ...(can('academic-years.view') ? ['Preferences'] : []),
            ]
      }
      renderTab={(tab) => {
        if (tab === 'General')
          return can('school.profile.view') ? (
            <LiveSchoolProfile
              schoolId={schoolId}
              canManage={can('school.profile.manage')}
              onSaved={reload}
            />
          ) : (
            denied
          );
        if (tab === 'Classes, Sections & Grades')
          return can('classes.view') ? (
            <LiveClassStructure
              key={`${schoolId}:${status.currentAcademicYearId}`}
              access={access}
              yearId={status.currentAcademicYearId}
            />
          ) : (
            denied
          );
        if (tab === 'Communication')
          return access.owner || can('school.profile.view') || can('overview.view') ? (
            <LiveNotificationsWorkspace settingsMode />
          ) : (
            denied
          );
        const items = sections[tab].filter((item) => {
            if (tab === 'Roles & Permissions')
              return can(item.id === 'roles' ? 'roles.view' : 'memberships.view');
            if (access.owner) return true;
            if (tab === 'Data & Security')
              return item.id === 'security' || (item.id === 'activity' && can('audit.view'));
            if (tab === 'Preferences') return item.id === 'context';
            return true;
          }),
          section = items.find((i) => i.id === params.get('section'))?.id ?? items[0].id;
        let content = (
          <Panel>
            <p>
              {tab === 'Staff & Payroll'
                ? 'Staff settings are not available yet.'
                : 'This settings area is not available yet. Your saved school configuration is preserved.'}
            </p>
          </Panel>
        );
        if (tab === 'Staff & Payroll') content = <LiveHrWorkspace settings section={section} />;
        if (tab === 'Preferences' && section === 'context')
          content = can('academic-years.view') ? (
            <AcademicYears access={access} status={status} changed={reload} />
          ) : (
            denied
          );
        if (tab === 'Roles & Permissions')
          content =
            section === 'roles' ? (
              can('roles.view') ? (
                <LiveRoles access={access} refreshAccess={reload} />
              ) : (
                denied
              )
            ) : can('memberships.view') ? (
              <LiveMembers access={access} refreshAccess={reload} />
            ) : (
              denied
            );
        if (tab === 'Data & Security' && section === 'security') content = <LiveAccount />;
        if (tab === 'Data & Security' && section === 'activity')
          content = can('audit.view') ? <LiveAudit schoolId={schoolId} /> : denied;
        return (
          <>
            <SectionNavigation
              items={items}
              value={section}
              label={`${tab} features`}
              onChange={(value) =>
                setParams((previous) => {
                  const next = new URLSearchParams(previous);
                  next.set('section', value);
                  return next;
                })
              }
            />
            {content}
          </>
        );
      }}
    />
  );
}
