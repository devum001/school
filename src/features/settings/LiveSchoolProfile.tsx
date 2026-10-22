import type { ProfileSource } from './data/contracts';
import { Button, Panel, LoadingOverlay } from '../../components/ui/Primitives';
import type { SchoolHours } from '../../types/domain';
import { saveSchoolProfile } from '../../services/schoolProfileService';
import { profileDraft, validateProfile } from '../setup/profileForm';
import SchoolProfileView, { type ProfileViewValue } from './SchoolProfileView';
import { useSchoolProfile } from './useSchoolProfile';
export default function LiveSchoolProfile({
  schoolId,
  canManage = false,
  onSaved,
}: {
  schoolId: string;
  canManage?: boolean;
  onSaved?: () => void;
}) {
  const profile = useSchoolProfile(schoolId);
  if (profile.status === 'loading')
    return (
      <LoadingOverlay
        loading
        size="xl"
        label="Loading school profile…"
        message="Loading school profile…"
      >
        <SchoolProfileView
          school={{
            id: schoolId,
            name: 'School',
            motto: '',
            city: '',
            address: '',
            region: '',
            country: '',
            postalCode: '',
            timezone: 'Asia/Kolkata',
            accentColor: '#10523C',
            code: '',
            email: '',
            phone: '',
            principal: '',
          }}
          academicYear={{ name: 'Academic Year' }}
          hours={{ start: '08:00', end: '14:00', days: [] }}
          canManage={false}
          validate={() => ({})}
          save={async () => {}}
        />
      </LoadingOverlay>
    );
  if (!profile.data || profile.status === 'error')
    return (
      <Panel>
        <h2>School profile unavailable</h2>
        <p role="alert">{profile.error}</p>
        <Button onClick={profile.retry}>Retry school profile</Button>
      </Panel>
    );
  const { school, academicYear } = profile.data;
  const view: ProfileViewValue = {
    ...school,
    code: school.code ?? '',
    email: school.email ?? '',
    phone: school.phone ?? '',
    principal: school.principalName,
  };
  const input = (draft: ProfileViewValue, hours?: SchoolHours) => ({
    ...profileDraft(school),
    name: draft.name,
    address: draft.address ?? school.address,
    region: draft.region ?? school.region,
    country: draft.country ?? school.country,
    postalCode: draft.postalCode ?? school.postalCode,
    timezone: draft.timezone ?? school.timezone,
    accentColor: draft.accentColor ?? school.accentColor,
    motto: draft.motto,
    city: draft.city,
    board: draft.board ?? '',
    affiliationNumber: draft.affiliationNumber ?? '',
    principalName: draft.principal ?? '',
    phone: draft.phone ?? '',
    email: draft.email ?? '',
    website:
      draft.website && !draft.website.includes('://')
        ? `https://${draft.website}`
        : (draft.website ?? ''),
    logoDataUrl: draft.logoDataUrl ?? '',
    hours: hours ?? { start: '', end: '', days: [] },
  });
  const source: ProfileSource = {
    validate: (draft) =>
      validateProfile(input(draft, (school.hours as SchoolHours | undefined) ?? undefined)),
    save: async (draft, hours) => {
      await saveSchoolProfile(schoolId, input(draft, hours));
      profile.retry();
      onSaved?.();
    },
  };
  return (
    <SchoolProfileView
      key={school.profileRevision}
      school={view}
      academicYear={academicYear}
      hours={(school.hours as SchoolHours | undefined) ?? undefined}
      schoolLogo={school.logoDataUrl || undefined}
      canManage={canManage}
      registrationManaged
      validate={source.validate}
      save={source.save}
    />
  );
}
