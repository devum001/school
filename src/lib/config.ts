import { displayPreferences } from './displayPreferences';
export const SCHOOL_ID = 'school-willowbrook';
export const STORAGE_KEY = 'schoolwell-demo-v1';
export const STATUS_LABELS = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  'half-day': 'Half day',
  unmarked: 'Not marked',
} as const;
export const money = (paise: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(paise / 100);
export const shortMoney = (paise: number) =>
  paise >= 10000000 ? `₹${(paise / 10000000).toFixed(2)}L` : money(paise);
export const displayDate = (date: string) =>
  displayPreferences().dateFormat === 'DD/MM/YYYY'
    ? `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`
    : new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString(
        displayPreferences().language === 'Hindi' ? 'hi-IN' : 'en-IN',
        {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        },
      );
export const initials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');

export const displayHindiDate = (date: string) =>
  new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('hi-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
