import type { RosterEntry } from '../types/domain';
import { compareRolls, rollKey, validRoll } from './studentIdentifiers';

function rollOrder(a: RosterEntry, b: RosterEntry) {
  const left = rollKey(a.enrollment.rollNumber),
    right = rollKey(b.enrollment.rollNumber);
  if (left.startsWith('n:') && right.startsWith('n:')) {
    const x = BigInt(left.slice(2)),
      y = BigInt(right.slice(2));
    return x < y ? -1 : x > y ? 1 : 0;
  }
  return compareRolls(a.enrollment.rollNumber, b.enrollment.rollNumber);
}
export function sortMarksRoster(students: RosterEntry[]) {
  const frequencies = new Map<string, number>();
  for (const s of students) {
    const key = `${s.enrollment.classId}:${s.enrollment.sectionId}:${rollKey(s.enrollment.rollNumber)}`;
    frequencies.set(key, (frequencies.get(key) ?? 0) + 1);
  }
  const groupKey = (s: RosterEntry) => `${s.enrollment.classId}:${s.enrollment.sectionId}`;
  const invalidGroups = new Set(
    students
      .filter(
        (s) =>
          !validRoll(s.enrollment.rollNumber) ||
          frequencies.get(`${groupKey(s)}:${rollKey(s.enrollment.rollNumber)}`) !== 1,
      )
      .map(groupKey),
  );
  return [...students].sort(
    (a, b) =>
      a.sectionName.localeCompare(b.sectionName, 'en', { numeric: true }) ||
      (!invalidGroups.has(groupKey(a)) && !invalidGroups.has(groupKey(b)) ? rollOrder(a, b) : 0) ||
      a.student.name.localeCompare(b.student.name) ||
      String(a.enrollment.rollNumber).localeCompare(String(b.enrollment.rollNumber)) ||
      a.enrollment.id.localeCompare(b.enrollment.id),
  );
}
