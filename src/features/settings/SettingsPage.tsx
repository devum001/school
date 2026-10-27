import SectionNavigation from '../../components/shared/SectionNavigation';
import { useSearchParams } from 'react-router-dom';
import { type IconName, PageHeading } from '../../components/ui/Primitives';
import type { ReactNode } from 'react';
import './settings.css';
import '../../styles/admin-settings.css';

const tabs = [
  'General',
  'Classes, Sections & Grades',
  'Staff & Payroll',
  'Communication',
  'Roles & Permissions',
  'Templates',
  'Data & Security',
  'Preferences',
];

const TAB_ICONS: Record<string, IconName> = {
  General: 'settings',
  'Classes, Sections & Grades': 'graduation-cap',
  'Staff & Payroll': 'staff',
  Communication: 'notifications',
  'Roles & Permissions': 'user-check',
  Templates: 'templates',
  'Data & Security': 'security',
  Preferences: 'overview-grid',
};
export default function SettingsPage({
  renderTab,
  availableTabs = tabs,
}: {
  renderTab: (tab: string) => ReactNode;
  availableTabs?: string[];
}) {
  const tabs = availableTabs;
  const [params, setParams] = useSearchParams();
  const requestedTab =
    params.get('tab') === 'Documents & Templates' ? 'Templates' : params.get('tab');
  const tab = tabs.find((label) => label === requestedTab) ?? tabs[0];
  function selectTab(label: string) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (label === 'General') next.delete('tab');
        else next.set('tab', label);
        next.delete('section');
        next.delete('action');
        return next;
      },
      { flushSync: true },
    );
  }
  return (
    <div className="school-settings">
      <PageHeading title="School settings" />
      <SectionNavigation
        label="School settings sections"
        items={tabs.map((label) => ({
          id: label,
          label: label === 'Classes, Sections & Grades' ? 'Classes & sections' : label,
          icon: TAB_ICONS[label] ?? 'settings',
        }))}
        value={tab}
        onChange={selectTab}
      />
      <div
        id="settings-content"
        role="tabpanel"
        aria-labelledby={`settings-tab-${tabs.indexOf(tab)}`}
        tabIndex={0}
      >
        {renderTab(tab)}
      </div>
    </div>
  );
}
