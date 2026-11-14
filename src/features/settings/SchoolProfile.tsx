import SchoolLocations from './SchoolLocations';
import { demoSchoolLocations } from './data/demoSchoolLocations';
import { useState } from 'react';
import { useSchool } from '../../app/useSchool';
import { demoProfileSource } from './data/demoSettings';
import { configuredSchoolHours } from '../../lib/schoolHours';
import { schoolLogoFor } from '../../lib/schoolBranding';
import SchoolProfileView from './SchoolProfileView';

export default function SchoolProfile() {
  const state = useSchool();
  const [holidays, setHolidays] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('schoolwell_demo_holidays');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const handleSaveHolidays = (newHolidays: string[]) => {
    setHolidays(newHolidays);
    localStorage.setItem('schoolwell_demo_holidays', JSON.stringify(newHolidays));
  };

  return (
    <SchoolProfileView
      locationContent={<SchoolLocations source={demoSchoolLocations} />}
      school={state.school}
      weekStartsOn={state.preferences?.weekStartsOn}
      academicYear={state.academicYear}
      hours={configuredSchoolHours(state)}
      schoolLogo={schoolLogoFor(state)}
      validate={demoProfileSource.validate}
      save={demoProfileSource.save}
      holidays={holidays}
      onSaveHolidays={handleSaveHolidays}
    />
  );
}
