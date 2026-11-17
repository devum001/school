import { useEffect, useMemo, useState } from 'react';
import { liveHrAdapter } from '../../services/hrService';
import { LoadingOverlay, PageHeading, Panel } from '../../components/ui/Primitives';
import type { SchoolHours } from '../../types/domain';
import SchoolCalendarSettings from '../settings/SchoolCalendarSettings';
import { useLiveSchool } from '../live/schoolContext';

export default function LiveCalendarWorkspace() {
  const { schoolId, access, profile } = useLiveSchool();
  const adapter = useMemo(() => liveHrAdapter(schoolId), [schoolId]);
  const [hrSettings, setHrSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    const currentMonth = new Date().toISOString().slice(0, 7);
    adapter
      .load(currentMonth, false, ctrl.signal)
      .then((data) => {
        setHrSettings(data.settings);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [adapter]);

  const canManage =
    access.owner ||
    access.permissions.includes('school.profile.manage') ||
    access.permissions.includes('attendance.manage');

  const handleSaveHolidays = async (newHolidays: string[]) => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const data = hrSettings
      ? { settings: hrSettings }
      : await adapter.load(currentMonth, false, new AbortController().signal);
    await adapter.save(
      '/settings',
      {
        ...data.settings,
        holidays: newHolidays,
      },
      'PUT',
    );
    setHrSettings({ ...data.settings, holidays: newHolidays });
  };

  const hours = profile?.school?.hours as SchoolHours | undefined;
  const workingDays =
    hours?.days && hours.days.length > 0
      ? hours.days
      : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="school-calendar-workspace" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <PageHeading title="School Calendar & Holidays" />
      <Panel>
        <LoadingOverlay loading={loading} label="Loading school calendar…">
          <SchoolCalendarSettings
            initialHolidays={hrSettings?.holidays || []}
            workingDays={workingDays}
            onSave={canManage ? handleSaveHolidays : undefined}
            canManage={canManage}
          />
        </LoadingOverlay>
      </Panel>
    </div>
  );
}
