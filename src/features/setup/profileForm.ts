import type { ProfileInput, SchoolProfile } from '../../services/schoolProfileService';
export const weekdays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
export function profileDraft(school: SchoolProfile['school']): ProfileInput {
  return {
    revision: school.profileRevision,
    name: school.name,
    logoDataUrl: school.logoDataUrl ?? '',
    email: school.email ?? '',
    phone: school.phone ?? '',
    timezone: school.timezone,
    address: school.address,
    city: school.city,
    region: school.region,
    country: school.country,
    postalCode: school.postalCode,
    motto: school.motto,
    website: school.website,
    board: school.board,
    affiliationNumber: school.affiliationNumber,
    principalName: school.principalName,
    accentColor: school.accentColor,
    hours: school.hours ?? { start: '', end: '', days: [] },
  };
}
export function validateProfile(value: ProfileInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!value.name.trim()) errors.name = 'Enter the school name.';
  if (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))
    errors.email = 'Enter a valid email address.';
  if (value.phone && !/^[+0-9 ().-]{3,32}$/.test(value.phone))
    errors.phone = 'Enter a valid contact number.';
  try {
    new Intl.DateTimeFormat('en', { timeZone: value.timezone });
  } catch {
    errors.timezone = 'Enter an IANA timezone, such as Asia/Kolkata.';
  }
  if (value.website) {
    try {
      const url = new URL(value.website);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
        throw new Error();
    } catch {
      errors.website = 'Use a complete https:// website address without credentials.';
    }
  }
  const hasHours = !!(value.hours.start || value.hours.end || value.hours.days.length);
  if (hasHours && (!value.hours.start || !value.hours.end || value.hours.start >= value.hours.end))
    errors.hours = 'Closing time must be after opening time.';
  if (hasHours && !value.hours.days.length) errors.days = 'Select at least one working day.';
  return errors;
}

// Choose the higher-contrast text color for the user-selected six-digit accent.
export function contrastText(hex: string) {
  const channels = [1, 3, 5]
    .map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#000000' : '#ffffff';
}
