import AppShell from './AppShell';
import TopbarControls from './TopbarControls';
import { useSchool } from '../../app/useSchool';
import { schoolLogoFor } from '../../lib/schoolBranding';
import { notificationAttention } from '../../lib/communicationOverview';
import { preferencesFor } from '../../lib/adminSettings';
export default function DemoAppShell() {
  const state = useSchool();
  return (
    <AppShell
      school={{ name: state.school.name, logo: schoolLogoFor(state) }}
      user={{ name: 'Dr. Nandita Rao', avatarName: 'Nandita Rao', detail: 'Principal' }}
      preferences={preferencesFor(state)}
      attentionCount={notificationAttention(state).count}
      topbar={
        <TopbarControls
          academicYear={state.academicYear}
          attention={notificationAttention(state)}
        />
      }
    />
  );
}
