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
export { formatCalendarDate as displayDate } from './displayFormat';
export const initials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');

export { formatCalendarDate as displayHindiDate } from './displayFormat';
