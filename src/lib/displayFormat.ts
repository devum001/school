/** Calendar values remain ISO in APIs/storage; people enter and read day-month-year. */
export function parseCalendarDate(value: string): string | null {
  const raw = value.trim();
  const parts = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(raw);
  const iso = parts ? `${parts[3]}-${parts[2]}-${parts[1]}` : raw;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}
export function formatCalendarDate(value: string): string {
  const iso = parseCalendarDate(value.slice(0, 10));
  return iso ? `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}` : value;
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
