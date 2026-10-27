/** Calendar values remain ISO in APIs/storage; people enter and read day-month-year. */
export function parseCalendarDate(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  // 1. Continuous 8 digits: DDMMYYYY or YYYYMMDD (e.g. 05012010 or 20100105)
  if (/^\d{8}$/.test(raw)) {
    // Try DDMMYYYY first (standard Indian format)
    const d1 = parseInt(raw.slice(0, 2), 10);
    const m1 = parseInt(raw.slice(2, 4), 10);
    const y1 = parseInt(raw.slice(4, 8), 10);
    if (d1 >= 1 && d1 <= 31 && m1 >= 1 && m1 <= 12 && y1 >= 1900 && y1 <= 2100) {
      const iso = `${String(y1).padStart(4, '0')}-${String(m1).padStart(2, '0')}-${String(d1).padStart(2, '0')}`;
      const d = new Date(`${iso}T12:00:00Z`);
      if (Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === iso) return iso;
    }
    // Try YYYYMMDD
    const y2 = parseInt(raw.slice(0, 4), 10);
    const m2 = parseInt(raw.slice(4, 6), 10);
    const d2 = parseInt(raw.slice(6, 8), 10);
    if (d2 >= 1 && d2 <= 31 && m2 >= 1 && m2 <= 12 && y2 >= 1900 && y2 <= 2100) {
      const iso = `${String(y2).padStart(4, '0')}-${String(m2).padStart(2, '0')}-${String(d2).padStart(2, '0')}`;
      const d = new Date(`${iso}T12:00:00Z`);
      if (Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === iso) return iso;
    }
  }

  // 2. Day-first formats: DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY, DD MM YYYY (with 1 or 2 digits day/month)
  const dmyMatch = /^(\d{1,2})[-/.\s](\d{1,2})[-/.\s](\d{4})$/.exec(raw);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    const iso = `${year}-${month}-${day}`;
    const d = new Date(`${iso}T12:00:00Z`);
    if (Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === iso) return iso;
  }

  // 3. Year-first formats: YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD, YYYY MM DD (with optional time)
  const ymdMatch = /^(\d{4})[-/.\s](\d{1,2})[-/.\s](\d{1,2})(?:[T\s].*)?$/.exec(raw);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    const iso = `${year}-${month}-${day}`;
    const d = new Date(`${iso}T12:00:00Z`);
    if (Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === iso) return iso;
  }

  // 4. Text month formats: e.g. "12 Jan 2010", "12-Apr-2010"
  const textMonthMatch = /^(\d{1,2})[-/.\s]([a-zA-Z]{3,9})[-/.\s](\d{4})$/.exec(raw);
  if (textMonthMatch) {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
      january: '01', february: '02', march: '03', april: '04', june: '06',
      july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
    };
    const mKey = textMonthMatch[2].toLowerCase();
    const month = months[mKey];
    if (month) {
      const day = textMonthMatch[1].padStart(2, '0');
      const year = textMonthMatch[3];
      const iso = `${year}-${month}-${day}`;
      const d = new Date(`${iso}T12:00:00Z`);
      if (Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === iso) return iso;
    }
  }

  return null;
}

export function formatCalendarDate(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const iso = parseCalendarDate(value);
  return iso ? `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}` : String(value);
}

/** Auto-inserts hyphens when typing DD MM YYYY smoothly without blocking backspace */
export function formatBirthDateInput(input: string, prev = ''): string {
  if (input.length < prev.length) {
    if (input.endsWith('-')) return input.slice(0, -1);
    return input;
  }
  const clean = input.replace(/[/.\s]/g, '-');
  const digits = clean.replace(/\D/g, '').slice(0, 8);
  if (!digits) return '';
  if (digits.length <= 2) {
    return digits.length === 2 ? `${digits}-` : digits;
  }
  if (digits.length <= 4) {
    const d = digits.slice(0, 2);
    const m = digits.slice(2);
    return m.length === 2 ? `${d}-${m}-` : `${d}-${m}`;
  }
  const d = digits.slice(0, 2);
  const m = digits.slice(2, 4);
  const y = digits.slice(4, 8);
  return `${d}-${m}-${y}`;
}
export function titleCase(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('en-IN')
    .replace(
      /(^|[^\p{L}\p{M}\p{N}])([\p{L}])/gu,
      (_, prefix: string, letter: string) => prefix + letter.toLocaleUpperCase('en-IN'),
    );
}
export function formatRosterCell(column: string, value: string): string {
  if (['Birth Date', 'Joined On'].includes(column)) return formatCalendarDate(value);
  if (
    [
      'Student Name',
      'Staff Name',
      'Guardian Name',
      'Relationship',
      'Address',
      'Department',
      'Designation',
      'Qualification',
      'Teaching',
      'Class',
    ].includes(column)
  )
    return titleCase(value);
  return value;
}
export function displayTimestamp(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part('day')}-${part('month')}-${part('year')} ${date.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}`;
}

export function parseCalendarDateTime(value: string): string | null {
  const parts = /^(.*)[T ](\d{2}):(\d{2})$/.exec(value.trim());
  if (!parts || Number(parts[2]) > 23 || Number(parts[3]) > 59) return null;
  const day = parseCalendarDate(parts[1]);
  return day ? `${day}T${parts[2]}:${parts[3]}` : null;
}
export function formatCalendarDateTime(value: string): string {
  const iso = parseCalendarDateTime(value);
  return iso ? `${formatCalendarDate(iso.slice(0, 10))} ${iso.slice(11)}` : value;
}

/** Only known date columns are formatted; numeric cells and identifiers are untouched. */
export function formatExportCell(column: string, value: string | number): string | number {
  if (typeof value !== 'string') return value;
  if (
    [
      'Birth Date',
      'Joining Date',
      'Joined On',
      'Date',
      'Due / Payment Date',
      'Due Date',
      'Payment Date',
    ].includes(column)
  )
    return formatCalendarDate(value);
  if (['Sent At', 'Created At', 'Updated At'].includes(column) && value)
    return displayTimestamp(value);
  return value;
}


/**
 * Automatically capitalizes the first letter of each word in a name field
 * as the user types (e.g. "a" -> "A", "aarav" -> "Aarav", "aarav s" -> "Aarav S").
 */
export function autoCapitalizeName(value: string): string {
  if (!value) return '';
  return value.replace(/(^|[\s\-])([a-z\u00E0-\u00FC])/g, (_, boundary, char) => boundary + char.toUpperCase());
}
