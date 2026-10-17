import { useSearchParams } from 'react-router-dom';
import { PageHeading } from '../../components/ui/Primitives';
import SchoolProfile from './SchoolProfile';
import AttendanceSettings from './AttendanceSettings';
import StaffPayrollSettings from './StaffPayrollSettings';
import ClassStructureSettings from './ClassStructureSettings';
import CommunicationSettings from './CommunicationSettings';
import RolesPermissionsSettings from './RolesPermissionsSettings';
import TemplatesSettings from './TemplatesSettings';
import './settings.css';
import '../../styles/admin-settings.css';
import DataSecuritySettings from './DataSecuritySettings';
import PreferencesSettings from './PreferencesSettings';

const tabs = [
  'General',
  'Classes, Sections & Grades',
  'Attendance',
  'Staff & Payroll',
  'Communication',
  'Roles & Permissions',
  'Templates',
  'Data & Security',
  'Preferences',
];
export default function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const requestedTab =
    params.get('tab') === 'Documents & Templates' ? 'Templates' : params.get('tab');
  const tab = tabs.find((label) => label === requestedTab) ?? 'General';
  function selectTab(label: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (label === 'General') next.delete('tab');
      else next.set('tab', label);
      return next;
    });
  }
  return (
    <div className="school-settings">
      <PageHeading
        title="School settings"
        description={
          tab === 'Classes, Sections & Grades'
            ? 'Configure classes, sections, grade labels and their student enrollments.'
            : tab === 'Attendance'
              ? 'Configure attendance policies, tracking rules, and notification thresholds.'
              : tab === 'Staff & Payroll'
                ? 'Configure staff structure, work and leave rules, and salary preferences.'
                : tab === 'Roles & Permissions'
                  ? 'Staff roles, module permissions and login access.'
                  : 'School identity, academic context, and workspace preferences.'
        }
      />
      <nav className="settings-tabs" aria-label="School settings sections">
        <div role="tablist" aria-label="Settings">
          {tabs.map((label, index) => (
            <button
              key={label}
              type="button"
              role="tab"
              id={`settings-tab-${index}`}
              aria-controls="settings-content"
              aria-selected={tab === label}
              tabIndex={tab === label ? 0 : -1}
              onClick={() => selectTab(label)}
              onKeyDown={(event) => {
                let next: number;
                if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
                else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
                else if (event.key === 'Home') next = 0;
                else if (event.key === 'End') next = tabs.length - 1;
                else return;
                event.preventDefault();
                selectTab(tabs[next]);
                document.getElementById(`settings-tab-${next}`)?.focus();
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>
      <div
        id="settings-content"
        role="tabpanel"
        aria-labelledby={`settings-tab-${tabs.indexOf(tab)}`}
        tabIndex={0}
      >
        {tab === 'General' && <SchoolProfile />}
        {tab === 'Attendance' && <AttendanceSettings />}
        {tab === 'Classes, Sections & Grades' && <ClassStructureSettings />}
        {tab === 'Staff & Payroll' && <StaffPayrollSettings />}
        {tab === 'Communication' && <CommunicationSettings />}
        {tab === 'Preferences' && <PreferencesSettings />}
        {tab === 'Roles & Permissions' && <RolesPermissionsSettings />}
        {tab === 'Templates' && <TemplatesSettings />}
        {tab === 'Data & Security' && <DataSecuritySettings />}
      </div>
    </div>
  );
}
