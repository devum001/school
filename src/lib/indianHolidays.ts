export interface CalendarHoliday {
  date: string; // YYYY-MM-DD
  title: string;
  type: 'national' | 'festival' | 'school' | 'vacation';
  description?: string;
}

export const INDIAN_NATIONAL_AND_FESTIVAL_HOLIDAYS: Record<
  string,
  { title: string; type: 'national' | 'festival' }
> = {
  // Fixed annual national / gazetted days
  '01-01': { title: 'New Year Day', type: 'festival' },
  '01-14': { title: 'Makar Sankranti / Pongal', type: 'festival' },
  '01-26': { title: 'Republic Day', type: 'national' },
  '04-14': { title: 'Dr. B.R. Ambedkar Jayanti', type: 'national' },
  '05-01': { title: 'May Day / Labour Day', type: 'festival' },
  '08-15': { title: 'Independence Day', type: 'national' },
  '10-02': { title: 'Mahatma Gandhi Jayanti', type: 'national' },
  '10-31': { title: 'Sardar Vallabhbhai Patel Jayanti', type: 'national' },
  '11-14': { title: "Children's Day", type: 'festival' },
  '12-25': { title: 'Christmas Day', type: 'festival' },

  // Key 2026 Festivals (Academic year 2026-2027)
  '2026-02-15': { title: 'Maha Shivratri', type: 'festival' },
  '2026-03-03': { title: 'Holi / Holika Dahan', type: 'festival' },
  '2026-03-04': { title: 'Dhulandi (Holi Festival)', type: 'festival' },
  '2026-03-20': { title: 'Eid-ul-Fitr (Ramzan Id)', type: 'festival' },
  '2026-03-27': { title: 'Ram Navami', type: 'festival' },
  '2026-03-31': { title: 'Mahavir Jayanti', type: 'festival' },
  '2026-04-03': { title: 'Good Friday', type: 'festival' },
  '2026-05-01': { title: 'Buddha Purnima', type: 'festival' },
  '2026-05-27': { title: 'Bakrid / Eid-ul-Adha', type: 'festival' },
  '2026-06-25': { title: 'Muharram', type: 'festival' },
  '2026-08-28': { title: 'Raksha Bandhan', type: 'festival' },
  '2026-09-04': { title: 'Janmashtami', type: 'festival' },
  '2026-09-25': { title: 'Milad-un-Nabi', type: 'festival' },
  '2026-10-18': { title: 'Maha Navami', type: 'festival' },
  '2026-10-19': { title: 'Dussehra / Vijayadashami', type: 'festival' },
  '2026-10-25': { title: 'Maharishi Valmiki Jayanti', type: 'festival' },
  '2026-11-08': { title: 'Diwali / Deepavali', type: 'festival' },
  '2026-11-09': { title: 'Govardhan Puja', type: 'festival' },
  '2026-11-10': { title: 'Bhai Dooj', type: 'festival' },
  '2026-11-15': { title: 'Chhath Puja', type: 'festival' },
  '2026-11-24': { title: 'Guru Nanak Jayanti', type: 'festival' },

  // Key 2027 Festivals
  '2027-01-14': { title: 'Makar Sankranti', type: 'festival' },
  '2027-01-26': { title: 'Republic Day', type: 'national' },
  '2027-03-07': { title: 'Maha Shivratri', type: 'festival' },
  '2027-03-22': { title: 'Holi', type: 'festival' },
  '2027-03-26': { title: 'Good Friday', type: 'festival' },
  '2027-04-15': { title: 'Ram Navami', type: 'festival' },
};

export function getFestivalForDate(dateStr: string) {
  if (INDIAN_NATIONAL_AND_FESTIVAL_HOLIDAYS[dateStr]) {
    return INDIAN_NATIONAL_AND_FESTIVAL_HOLIDAYS[dateStr];
  }
  const monthDay = dateStr.slice(5); // 'MM-DD'
  if (INDIAN_NATIONAL_AND_FESTIVAL_HOLIDAYS[monthDay]) {
    return INDIAN_NATIONAL_AND_FESTIVAL_HOLIDAYS[monthDay];
  }
  return null;
}

export function getSavedHolidays(): string[] {
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('schoolwell_holidays') : null;
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function getCustomHolidayTitles(): Record<string, string> {
  try {
    const stored =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('schoolwell_custom_holiday_titles')
        : null;
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function saveHolidayDates(holidays: string[], titles?: Record<string, string>) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('schoolwell_holidays', JSON.stringify(holidays));
      if (titles) {
        localStorage.setItem('schoolwell_custom_holiday_titles', JSON.stringify(titles));
      }
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('schoolwell_holidays_changed'));
    }
  } catch {
    // ignore
  }
}

export function isDateHoliday(
  dateStr: string,
  customHolidays?: string[],
): { isHoliday: boolean; reason?: string } {
  const localSaved = getSavedHolidays();
  const allHolidays = Array.from(new Set([...(customHolidays || []), ...localSaved]));
  const titles = getCustomHolidayTitles();

  if (allHolidays.includes(dateStr)) {
    return {
      isHoliday: true,
      reason: titles[dateStr] || getFestivalForDate(dateStr)?.title || 'School Holiday',
    };
  }

  const fest = getFestivalForDate(dateStr);
  if (fest && fest.type === 'national') {
    return {
      isHoliday: true,
      reason: fest.title,
    };
  }

  return { isHoliday: false };
}
