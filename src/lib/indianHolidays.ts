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

  // Key 2025 Festivals
  '2025-02-26': { title: 'Maha Shivratri', type: 'festival' },
  '2025-03-13': { title: 'Holika Dahan', type: 'festival' },
  '2025-03-14': { title: 'Holi / Dhulandi', type: 'festival' },
  '2025-03-31': { title: 'Eid-ul-Fitr (Ramzan Id)', type: 'festival' },
  '2025-04-06': { title: 'Ram Navami', type: 'festival' },
  '2025-04-10': { title: 'Mahavir Jayanti', type: 'festival' },
  '2025-04-18': { title: 'Good Friday', type: 'festival' },
  '2025-05-12': { title: 'Buddha Purnima', type: 'festival' },
  '2025-06-07': { title: 'Bakrid / Eid-ul-Adha', type: 'festival' },
  '2025-07-06': { title: 'Muharram', type: 'festival' },
  '2025-08-09': { title: 'Raksha Bandhan', type: 'festival' },
  '2025-08-16': { title: 'Krishna Janmashtami', type: 'festival' },
  '2025-09-05': { title: 'Milad-un-Nabi', type: 'festival' },
  '2025-10-01': { title: 'Maha Navami', type: 'festival' },
  '2025-10-02': { title: 'Dussehra / Vijayadashami', type: 'festival' },
  '2025-10-18': { title: 'Dhanteras', type: 'festival' },
  '2025-10-20': { title: 'Diwali / Deepavali', type: 'festival' },
  '2025-10-22': { title: 'Govardhan Puja', type: 'festival' },
  '2025-10-23': { title: 'Bhai Dooj', type: 'festival' },
  '2025-10-27': { title: 'Chhath Puja', type: 'festival' },
  '2025-11-05': { title: 'Guru Nanak Jayanti', type: 'festival' },

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
  '2027-03-06': { title: 'Maha Shivratri', type: 'festival' },
  '2027-03-10': { title: 'Eid-ul-Fitr (Ramzan Id)', type: 'festival' },
  '2027-03-21': { title: 'Holika Dahan', type: 'festival' },
  '2027-03-22': { title: 'Holi / Dhulandi', type: 'festival' },
  '2027-03-26': { title: 'Good Friday', type: 'festival' },
  '2027-04-15': { title: 'Ram Navami', type: 'festival' },
  '2027-04-19': { title: 'Mahavir Jayanti', type: 'festival' },
  '2027-05-17': { title: 'Bakrid / Eid-ul-Adha', type: 'festival' },
  '2027-05-20': { title: 'Buddha Purnima', type: 'festival' },
  '2027-06-16': { title: 'Muharram', type: 'festival' },
  '2027-08-17': { title: 'Raksha Bandhan', type: 'festival' },
  '2027-08-24': { title: 'Krishna Janmashtami', type: 'festival' },
  '2027-09-14': { title: 'Milad-un-Nabi', type: 'festival' },
  '2027-10-08': { title: 'Maha Navami', type: 'festival' },
  '2027-10-09': { title: 'Dussehra / Vijayadashami', type: 'festival' },
  '2027-10-15': { title: 'Maharishi Valmiki Jayanti', type: 'festival' },
  '2027-10-28': { title: 'Dhanteras', type: 'festival' },
  '2027-10-29': { title: 'Diwali / Deepavali', type: 'festival' },
  '2027-10-30': { title: 'Govardhan Puja', type: 'festival' },
  '2027-10-31': { title: 'Bhai Dooj', type: 'festival' },
  '2027-11-04': { title: 'Chhath Puja', type: 'festival' },
  '2027-11-14': { title: 'Guru Nanak Jayanti', type: 'festival' },

  // Key 2028 Festivals
  '2028-02-23': { title: 'Maha Shivratri', type: 'festival' },
  '2028-02-26': { title: 'Eid-ul-Fitr (Ramzan Id)', type: 'festival' },
  '2028-03-10': { title: 'Holika Dahan', type: 'festival' },
  '2028-03-11': { title: 'Holi / Dhulandi', type: 'festival' },
  '2028-04-03': { title: 'Ram Navami', type: 'festival' },
  '2028-04-07': { title: 'Mahavir Jayanti', type: 'festival' },
  '2028-04-14': { title: 'Good Friday', type: 'festival' },
  '2028-05-05': { title: 'Bakrid / Eid-ul-Adha', type: 'festival' },
  '2028-05-08': { title: 'Buddha Purnima', type: 'festival' },
  '2028-06-04': { title: 'Muharram', type: 'festival' },
  '2028-08-05': { title: 'Raksha Bandhan', type: 'festival' },
  '2028-08-13': { title: 'Krishna Janmashtami', type: 'festival' },
  '2028-09-02': { title: 'Milad-un-Nabi', type: 'festival' },
  '2028-09-26': { title: 'Maha Navami', type: 'festival' },
  '2028-09-27': { title: 'Dussehra / Vijayadashami', type: 'festival' },
  '2028-10-03': { title: 'Maharishi Valmiki Jayanti', type: 'festival' },
  '2028-10-16': { title: 'Dhanteras', type: 'festival' },
  '2028-10-17': { title: 'Diwali / Deepavali', type: 'festival' },
  '2028-10-18': { title: 'Govardhan Puja', type: 'festival' },
  '2028-10-19': { title: 'Bhai Dooj', type: 'festival' },
  '2028-10-23': { title: 'Chhath Puja', type: 'festival' },
  '2028-11-02': { title: 'Guru Nanak Jayanti', type: 'festival' },

  // Key 2029 Festivals
  '2029-02-11': { title: 'Maha Shivratri', type: 'festival' },
  '2029-02-15': { title: 'Eid-ul-Fitr (Ramzan Id)', type: 'festival' },
  '2029-02-28': { title: 'Holika Dahan', type: 'festival' },
  '2029-03-01': { title: 'Holi / Dhulandi', type: 'festival' },
  '2029-03-23': { title: 'Ram Navami', type: 'festival' },
  '2029-03-27': { title: 'Mahavir Jayanti', type: 'festival' },
  '2029-03-30': { title: 'Good Friday', type: 'festival' },
  '2029-04-24': { title: 'Bakrid / Eid-ul-Adha', type: 'festival' },
  '2029-04-28': { title: 'Buddha Purnima', type: 'festival' },
  '2029-05-24': { title: 'Muharram', type: 'festival' },
  '2029-08-24': { title: 'Raksha Bandhan', type: 'festival' },
  '2029-08-31': { title: 'Krishna Janmashtami', type: 'festival' },
  '2029-10-15': { title: 'Maha Navami', type: 'festival' },
  '2029-10-16': { title: 'Dussehra / Vijayadashami', type: 'festival' },
  '2029-11-04': { title: 'Dhanteras', type: 'festival' },
  '2029-11-05': { title: 'Diwali / Deepavali', type: 'festival' },
  '2029-11-06': { title: 'Govardhan Puja', type: 'festival' },
  '2029-11-07': { title: 'Bhai Dooj', type: 'festival' },
  '2029-11-11': { title: 'Chhath Puja', type: 'festival' },
  '2029-11-21': { title: 'Guru Nanak Jayanti', type: 'festival' },

  // Key 2030 Festivals
  '2030-02-05': { title: 'Eid-ul-Fitr (Ramzan Id)', type: 'festival' },
  '2030-03-02': { title: 'Maha Shivratri', type: 'festival' },
  '2030-03-19': { title: 'Holika Dahan', type: 'festival' },
  '2030-03-20': { title: 'Holi / Dhulandi', type: 'festival' },
  '2030-04-11': { title: 'Ram Navami', type: 'festival' },
  '2030-04-14': { title: 'Bakrid / Eid-ul-Adha', type: 'festival' },
  '2030-04-16': { title: 'Mahavir Jayanti', type: 'festival' },
  '2030-04-19': { title: 'Good Friday', type: 'festival' },
  '2030-05-17': { title: 'Buddha Purnima', type: 'festival' },
  '2030-08-13': { title: 'Raksha Bandhan', type: 'festival' },
  '2030-08-20': { title: 'Krishna Janmashtami', type: 'festival' },
  '2030-10-05': { title: 'Maha Navami', type: 'festival' },
  '2030-10-06': { title: 'Dussehra / Vijayadashami', type: 'festival' },
  '2030-10-25': { title: 'Dhanteras', type: 'festival' },
  '2030-10-26': { title: 'Diwali / Deepavali', type: 'festival' },
  '2030-10-27': { title: 'Govardhan Puja', type: 'festival' },
  '2030-10-28': { title: 'Bhai Dooj', type: 'festival' },
  '2030-11-01': { title: 'Chhath Puja', type: 'festival' },
  '2030-11-10': { title: 'Guru Nanak Jayanti', type: 'festival' },

  // Key 2031 Festivals
  '2031-03-08': { title: 'Holika Dahan', type: 'festival' },
  '2031-03-09': { title: 'Holi / Dhulandi', type: 'festival' },
  '2031-03-24': { title: 'Eid-ul-Fitr (Ramzan Id)', type: 'festival' },
  '2031-04-01': { title: 'Ram Navami', type: 'festival' },
  '2031-04-05': { title: 'Mahavir Jayanti', type: 'festival' },
  '2031-04-11': { title: 'Good Friday', type: 'festival' },
  '2031-05-06': { title: 'Buddha Purnima', type: 'festival' },
  '2031-05-31': { title: 'Bakrid / Eid-ul-Adha', type: 'festival' },
  '2031-08-03': { title: 'Raksha Bandhan', type: 'festival' },
  '2031-08-10': { title: 'Krishna Janmashtami', type: 'festival' },
  '2031-10-24': { title: 'Maha Navami', type: 'festival' },
  '2031-10-25': { title: 'Dussehra / Vijayadashami', type: 'festival' },
  '2031-11-13': { title: 'Dhanteras', type: 'festival' },
  '2031-11-14': { title: 'Diwali / Deepavali', type: 'festival' },
  '2031-11-15': { title: 'Govardhan Puja', type: 'festival' },
  '2031-11-16': { title: 'Bhai Dooj', type: 'festival' },
  '2031-11-20': { title: 'Chhath Puja', type: 'festival' },
  '2031-11-29': { title: 'Guru Nanak Jayanti', type: 'festival' },

  // Key 2032 Festivals
  '2032-03-13': { title: 'Eid-ul-Fitr (Ramzan Id)', type: 'festival' },
  '2032-03-26': { title: 'Holika Dahan', type: 'festival' },
  '2032-03-27': { title: 'Holi / Dhulandi', type: 'festival' },
  '2032-04-16': { title: 'Good Friday', type: 'festival' },
  '2032-04-19': { title: 'Ram Navami', type: 'festival' },
  '2032-04-23': { title: 'Mahavir Jayanti', type: 'festival' },
  '2032-05-19': { title: 'Bakrid / Eid-ul-Adha', type: 'festival' },
  '2032-05-24': { title: 'Buddha Purnima', type: 'festival' },
  '2032-08-21': { title: 'Raksha Bandhan', type: 'festival' },
  '2032-08-28': { title: 'Krishna Janmashtami', type: 'festival' },
  '2032-10-13': { title: 'Maha Navami', type: 'festival' },
  '2032-10-14': { title: 'Dussehra / Vijayadashami', type: 'festival' },
  '2032-11-01': { title: 'Dhanteras', type: 'festival' },
  '2032-11-02': { title: 'Diwali / Deepavali', type: 'festival' },
  '2032-11-03': { title: 'Govardhan Puja', type: 'festival' },
  '2032-11-04': { title: 'Bhai Dooj', type: 'festival' },
  '2032-11-08': { title: 'Chhath Puja', type: 'festival' },
  '2032-11-17': { title: 'Guru Nanak Jayanti', type: 'festival' },

  // Key 2033 Festivals
  '2033-03-02': { title: 'Eid-ul-Fitr (Ramzan Id)', type: 'festival' },
  '2033-03-15': { title: 'Holika Dahan', type: 'festival' },
  '2033-03-16': { title: 'Holi / Dhulandi', type: 'festival' },
  '2033-04-09': { title: 'Ram Navami', type: 'festival' },
  '2033-04-12': { title: 'Mahavir Jayanti', type: 'festival' },
  '2033-04-15': { title: 'Good Friday', type: 'festival' },
  '2033-05-09': { title: 'Bakrid / Eid-ul-Adha', type: 'festival' },
  '2033-05-13': { title: 'Buddha Purnima', type: 'festival' },
  '2033-08-10': { title: 'Raksha Bandhan', type: 'festival' },
  '2033-08-17': { title: 'Krishna Janmashtami', type: 'festival' },
  '2033-10-02': { title: 'Maha Navami', type: 'festival' },
  '2033-10-03': { title: 'Dussehra / Vijayadashami', type: 'festival' },
  '2033-10-21': { title: 'Dhanteras', type: 'festival' },
  '2033-10-22': { title: 'Diwali / Deepavali', type: 'festival' },
  '2033-10-23': { title: 'Govardhan Puja', type: 'festival' },
  '2033-10-24': { title: 'Bhai Dooj', type: 'festival' },
  '2033-10-28': { title: 'Chhath Puja', type: 'festival' },
  '2033-11-06': { title: 'Guru Nanak Jayanti', type: 'festival' },

  // Key 2034 Festivals
  '2034-02-19': { title: 'Eid-ul-Fitr (Ramzan Id)', type: 'festival' },
  '2034-03-04': { title: 'Holika Dahan', type: 'festival' },
  '2034-03-05': { title: 'Holi / Dhulandi', type: 'festival' },
  '2034-03-29': { title: 'Ram Navami', type: 'festival' },
  '2034-04-02': { title: 'Mahavir Jayanti', type: 'festival' },
  '2034-04-07': { title: 'Good Friday', type: 'festival' },
  '2034-04-28': { title: 'Bakrid / Eid-ul-Adha', type: 'festival' },
  '2034-05-03': { title: 'Buddha Purnima', type: 'festival' },
  '2034-08-29': { title: 'Raksha Bandhan', type: 'festival' },
  '2034-09-06': { title: 'Krishna Janmashtami', type: 'festival' },
  '2034-10-21': { title: 'Maha Navami', type: 'festival' },
  '2034-10-22': { title: 'Dussehra / Vijayadashami', type: 'festival' },
  '2034-11-09': { title: 'Dhanteras', type: 'festival' },
  '2034-11-10': { title: 'Diwali / Deepavali', type: 'festival' },
  '2034-11-11': { title: 'Govardhan Puja', type: 'festival' },
  '2034-11-12': { title: 'Bhai Dooj', type: 'festival' },
  '2034-11-16': { title: 'Chhath Puja', type: 'festival' },
  '2034-11-26': { title: 'Guru Nanak Jayanti', type: 'festival' },

  // Key 2035 Festivals
  '2035-02-09': { title: 'Eid-ul-Fitr (Ramzan Id)', type: 'festival' },
  '2035-03-23': { title: 'Good Friday / Holika Dahan', type: 'festival' },
  '2035-03-24': { title: 'Holi / Dhulandi', type: 'festival' },
  '2035-04-17': { title: 'Ram Navami', type: 'festival' },
  '2035-04-20': { title: 'Mahavir Jayanti', type: 'festival' },
  '2035-04-18': { title: 'Bakrid / Eid-ul-Adha', type: 'festival' },
  '2035-05-22': { title: 'Buddha Purnima', type: 'festival' },
  '2035-08-18': { title: 'Raksha Bandhan', type: 'festival' },
  '2035-08-26': { title: 'Krishna Janmashtami', type: 'festival' },
  '2035-10-10': { title: 'Maha Navami', type: 'festival' },
  '2035-10-11': { title: 'Dussehra / Vijayadashami', type: 'festival' },
  '2035-10-28': { title: 'Dhanteras', type: 'festival' },
  '2035-10-29': { title: 'Diwali / Deepavali', type: 'festival' },
  '2035-10-30': { title: 'Govardhan Puja', type: 'festival' },
  '2035-10-31': { title: 'Bhai Dooj', type: 'festival' },
  '2035-11-04': { title: 'Chhath Puja', type: 'festival' },
  '2035-11-15': { title: 'Guru Nanak Jayanti', type: 'festival' },
};

// In-memory runtime cache for cloud-synced festivals
const memoryCloudCache: Record<number, Record<string, { title: string; type: 'national' | 'festival' }>> = {};

export function getCachedCloudFestivals(year: number): Record<string, { title: string; type: 'national' | 'festival' }> {
  if (memoryCloudCache[year] && Object.keys(memoryCloudCache[year]).length > 0) {
    return memoryCloudCache[year];
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const item = localStorage.getItem(`schoolwell_cloud_festivals_${year}`);
      if (item) {
        const parsed = JSON.parse(item);
        memoryCloudCache[year] = parsed;
        return parsed;
      }
    }
  } catch {}
  return {};
}

export function saveCachedCloudFestivals(
  year: number,
  data: Record<string, { title: string; type: 'national' | 'festival' }>,
) {
  memoryCloudCache[year] = data;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`schoolwell_cloud_festivals_${year}`, JSON.stringify(data));
      localStorage.setItem(`schoolwell_cloud_festivals_synced_at_${year}`, new Date().toISOString());
    }
  } catch {}
}

/**
 * Free background sync for Indian holidays and festivals.
 * 1. Checks open-source Nager.Date API for official India gazetted holidays.
 * 2. Merges with rich built-in Indian festival data (Panchang / tithi dates).
 * 3. Caches to localStorage so subsequent visits are instant and offline-capable.
 */
export async function fetchHolidaysFromCloud(year: number): Promise<{
  success: boolean;
  count: number;
  source: 'api' | 'builtin';
  holidays: Record<string, { title: string; type: 'national' | 'festival' }>;
}> {
  const merged: Record<string, { title: string; type: 'national' | 'festival' }> = {};

  // 1. Populate from built-in high accuracy dictionary for this year
  Object.entries(INDIAN_NATIONAL_AND_FESTIVAL_HOLIDAYS).forEach(([key, val]) => {
    if (key.length === 5) {
      // Annual fixed 'MM-DD'
      merged[`${year}-${key}`] = val;
    } else if (key.startsWith(`${year}-`)) {
      merged[key] = val;
    }
  });

  let apiSuccess = false;

  // 2. Fetch from free public holiday API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/IN`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data: Array<{ date: string; localName?: string; name: string; types?: string[] }> =
        await res.json();
      if (Array.isArray(data) && data.length > 0) {
        apiSuccess = true;
        data.forEach((item) => {
          if (item.date && item.date.startsWith(`${year}-`)) {
            const isNational =
              item.name.toLowerCase().includes('republic') ||
              item.name.toLowerCase().includes('independence') ||
              item.name.toLowerCase().includes('gandhi') ||
              Boolean(item.types && item.types.includes('Public'));
            // If already present with Hindi/Panchang name, keep our rich name; otherwise add from API
            if (!merged[item.date]) {
              merged[item.date] = {
                title: item.localName || item.name,
                type: isNational ? 'national' : 'festival',
              };
            }
          }
        });
      }
    }
  } catch {
    // Offline / fallback to built-in dictionary
  }

  saveCachedCloudFestivals(year, merged);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('schoolwell_cloud_festivals_updated'));
  }

  return {
    success: true,
    count: Object.keys(merged).length,
    source: apiSuccess ? 'api' : 'builtin',
    holidays: merged,
  };
}

export function getAllFestivalsForYear(
  year: number,
): Array<{ date: string; title: string; type: 'national' | 'festival' }> {
  const cached = getCachedCloudFestivals(year);
  const map: Record<string, { title: string; type: 'national' | 'festival' }> = { ...cached };

  // Ensure built-in dates are also present
  Object.entries(INDIAN_NATIONAL_AND_FESTIVAL_HOLIDAYS).forEach(([key, val]) => {
    if (key.length === 5) {
      const fullDate = `${year}-${key}`;
      if (!map[fullDate]) map[fullDate] = val;
    } else if (key.startsWith(`${year}-`)) {
      if (!map[key]) map[key] = val;
    }
  });

  return Object.entries(map)
    .map(([date, val]) => ({ date, ...val }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getFestivalForDate(dateStr: string) {
  const year = Number(dateStr.slice(0, 4));
  if (year) {
    const cached = getCachedCloudFestivals(year);
    if (cached[dateStr]) {
      return cached[dateStr];
    }
  }
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
): { isHoliday: boolean; reason?: string; type?: 'national' | 'festival' | 'school' | 'vacation' } {
  const localSaved = getSavedHolidays();
  const allHolidays = Array.from(new Set([...(customHolidays || []), ...localSaved]));
  const titles = getCustomHolidayTitles();
  const fest = getFestivalForDate(dateStr);

  if (allHolidays.includes(dateStr)) {
    return {
      isHoliday: true,
      reason: titles[dateStr] || fest?.title || 'School Holiday',
      type: fest?.type || 'school',
    };
  }

  // Festivals / national days are informative unless explicitly marked as school holidays
  return { isHoliday: false };
}
