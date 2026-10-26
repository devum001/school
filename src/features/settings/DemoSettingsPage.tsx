import SchoolProfile from './SchoolProfile';
import StaffPayrollSettings from './StaffPayrollSettings';
import ClassStructureSettings from './DemoClassStructureSettings';
import CommunicationSettings from './CommunicationSettings';
import RolesPermissionsSettings from './RolesPermissionsSettings';
import TemplatesSettings from './TemplatesSettings';
import DataSecuritySettings from './DataSecuritySettings';
import PreferencesSettings from './PreferencesSettings';
import SettingsPage from './SettingsPage';
export default function DemoSettingsPage() {
  return (
    <SettingsPage
      renderTab={(tab) => (
        <>
          {tab === 'General' && <SchoolProfile />}
          {tab === 'Classes, Sections & Grades' && <ClassStructureSettings />}
          {tab === 'Staff & Payroll' && <StaffPayrollSettings />}
          {tab === 'Communication' && <CommunicationSettings />}
          {tab === 'Preferences' && <PreferencesSettings />}
          {tab === 'Roles & Permissions' && <RolesPermissionsSettings />}
          {tab === 'Templates' && <TemplatesSettings />}
          {tab === 'Data & Security' && <DataSecuritySettings />}
        </>
      )}
    />
  );
}
