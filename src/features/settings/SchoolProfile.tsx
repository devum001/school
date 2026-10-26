import { useSchool } from '../../app/useSchool';
import { demoProfileSource } from './data/demoSettings';
import { configuredSchoolHours } from '../../lib/schoolHours';
import { schoolLogoFor } from '../../lib/schoolBranding';
import SchoolProfileView from './SchoolProfileView';
export default function SchoolProfile() {
  const state = useSchool();
  return (
    <SchoolProfileView
      school={state.school}
      weekStartsOn={state.preferences?.weekStartsOn}
      academicYear={state.academicYear}
      hours={configuredSchoolHours(state)}
      schoolLogo={schoolLogoFor(state)}
      validate={demoProfileSource.validate}
      save={demoProfileSource.save}
    />
  );
}
