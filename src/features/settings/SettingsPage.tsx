import TabRail from '../../components/ui/TabRail';
import { useSearchParams } from 'react-router-dom';
import { AppIcon, type IconName, PageHeading } from '../../components/ui/Primitives';
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
      <nav className="settings-tabs" aria-label="School settings sections">
        <TabRail role="tablist" aria-label="Settings">
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
              <AppIcon name={TAB_ICONS[label] ?? 'settings'} size={18} />
              <span>{label === 'Classes, Sections & Grades' ? 'Classes & sections' : label}</span>
            </button>
          ))}
        </TabRail>
      </nav>
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
