export function classNameKey(value: string): string {
  const normalized = value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
  const number = normalized.match(/^(?:(?:class|grade)\s*)?(\d{1,2})(?:st|nd|rd|th)?$/);
  return number ? `level:${Number(number[1])}` : normalized;
}
export function ordinalClass(name: string) {
  const key = classNameKey(name);
  if (!key.startsWith('level:')) return null;
  const level = Number(key.slice(6)),
    last = level % 100;
  const suffix =
    last >= 11 && last <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[level % 10] ?? 'th');
  return { level, suffix };
}
