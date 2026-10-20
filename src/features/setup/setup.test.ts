import { describe, expect, it } from 'vitest';
import { scoped, yearValidation, type SetupStatus } from '../../services/schoolSetupService';
import { nextSetupStep } from './setupProgress';
import { validateProfile, profileDraft } from './profileForm';
import type { SchoolProfile } from '../../services/schoolProfileService';
import { schoolNavigation } from '../live/schoolNavigation';
describe('school setup boundaries', () => {
  it('resumes the first persisted required gap and allows optional identity to remain unfinished', () => {
    const status: SetupStatus = {
      schoolId: 'a'.repeat(24),
      currentAcademicYearId: null,
      academicRevision: 0,
      ready: false,
      counts: { classes: 0, withoutSections: 0, withoutSubjects: 0 },
      steps: [
        {
          key: 'profile',
          label: 'Profile',
          required: true,
          status: 'complete',
          detail: '',
          permission: 'school.profile.manage',
        },
        {
          key: 'years',
          label: 'Year',
          required: true,
          status: 'attention',
          detail: '',
          permission: 'academic-years.manage',
        },
        {
          key: 'branding',
          label: 'Identity',
          required: false,
          status: 'optional',
          detail: '',
          permission: 'school.profile.manage',
        },
      ],
    };
    expect(nextSetupStep(status)).toBe('years');
    status.steps[1].status = 'complete';
    expect(nextSetupStep(status)).toBe('review');
  });
  it('rejects impossible dates and reverse ranges before submission', () => {
    expect(yearValidation({ name: 'Year', start: '2026-02-30', end: '2027-01-01' }).start).not.toBe(
      '',
    );
    expect(yearValidation({ name: 'Year', start: '2026-04-01', end: '2026-03-31' }).end).not.toBe(
      '',
    );
    expect(
      Object.values(
        yearValidation({ name: 'Leap year', start: '2028-02-29', end: '2028-12-31' }),
      ).every((value) => !value),
    ).toBe(true);
  });
  it('rejects stale foreign school, year and class payloads', () => {
    const record = { schoolId: 'a', academicYearId: 'b', classId: 'c' };
    expect(scoped(record, 'a', 'b', 'c')).toBe(record);
    expect(() => scoped(record, 'other')).toThrow('workspace');
    expect(() => scoped(record, 'a', 'other')).toThrow('workspace');
    expect(() => scoped(record, 'a', 'b', 'other')).toThrow('workspace');
  });
  it('validates operational profile and excludes platform-owned fields from writes', () => {
    const school: SchoolProfile['school'] = {
      id: 'a'.repeat(24),
      slug: 'registered',
      code: 'CODE',
      status: 'active',
      name: 'School',
      timezone: 'UTC',
      email: null,
      phone: null,
      profileRevision: 3,
      academicRevision: 1,
      address: '',
      city: '',
      region: '',
      country: '',
      postalCode: '',
      motto: '',
      website: '',
      board: '',
      affiliationNumber: '',
      principalName: '',
      accentColor: '#245e63',
      hours: null,
      logoDataUrl: '',
    };
    const draft = profileDraft(school);
    expect(draft).not.toHaveProperty('slug');
    expect(draft).not.toHaveProperty('status');
    expect(draft).not.toHaveProperty('code');
    expect(validateProfile(draft)).toEqual({});
    draft.hours.start = '08:00';
    expect(validateProfile(draft)).toHaveProperty('hours');
    draft.hours = { start: '08:00', end: '15:00', days: ['Monday'] };
    expect(validateProfile(draft)).toEqual({});
    draft.website = 'https://private:secret@example.test';
    expect(validateProfile(draft)).toHaveProperty('website');
    draft.timezone = 'Unknown/Zone';
    expect(validateProfile(draft)).toHaveProperty('timezone');
  });
  it('offers setup to delegated academic managers without exposing ungranted management tabs', () => {
    const navigation = schoolNavigation(['academic-years.view', 'academic-years.manage']);
    expect(navigation.active).toBe('Academic years');
    expect(navigation.available.map((item) => item.name)).toEqual(['Academic years', 'Data & Security']);
  });
});
