/** Numeric digits determine identity; prefixes, case and leading zeros do not. */
export function identifierKey(value: string): string {
  const text = value.normalize('NFKC').trim().toLowerCase();
  const digits = text.replace(/[^0-9]/g, '');
  return digits ? `n:${digits.replace(/^0+(?=\d)/, '')}` : `t:${text}`;
}
export type RollNumber = string | number;
export function validRoll(value: RollNumber): boolean {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 1 || value > 99999))
    return false;
  const text = String(value).trim();
  if (!/^[a-z\d]+(?:[-_/][a-z\d]+)*$/i.test(text) || text.length > 40) return false;
  return (
    !/^\d+$/.test(text) ||
    (Number.isSafeInteger(Number(text)) && Number(text) > 0 && Number(text) <= 99999)
  );
}
export function rollValue(value: RollNumber): RollNumber {
  const text = String(value).trim();
  return /^\d+$/.test(text) ? Number(text) : text;
}
export const rollKey = (value: RollNumber) => identifierKey(String(rollValue(value)));
export const compareRolls = (a: RollNumber, b: RollNumber) =>
  String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' });
