import type { DemoState } from '../types/domain';
import { saveSchoolClass, saveSchoolSection } from './classStructure';
export interface ClassSetupRow {
  name: string;
  sections: string[];
}
const key = (name: string) => name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
export function validateClassSetup(
  rows: ClassSetupRow[],
  existing: string[] = [],
): ClassSetupRow[] {
  if (!rows.length || rows.length > 50) throw new Error('Set up 1–50 classes at a time.');
  const names = new Set(existing.map(key));
  let total = 0;
  const result = rows.map((row) => {
    const name = row.name.trim().replace(/\s+/g, ' ');
    if (!name || name.length > 80) throw new Error('Enter a class name of up to 80 characters.');
    if (names.has(key(name))) throw new Error(`Class “${name}” already exists or is repeated.`);
    names.add(key(name));
    const sections = row.sections.map((s) => s.trim().replace(/\s+/g, ' '));
    if (sections.length > 20 || sections.some((s) => !s || s.length > 80))
      throw new Error(`Enter up to 20 section names for ${name}, up to 80 characters each.`);
    if (new Set(sections.map(key)).size !== sections.length)
      throw new Error(`Remove repeated section names in ${name}.`);
    total += sections.length;
    return { name, sections };
  });
  if (total > 200) throw new Error('Set up at most 200 sections per batch.');
  return result;
}
export function applyClassSetup(state: DemoState, input: ClassSetupRow[]): DemoState {
  const rows = validateClassSetup(
    input,
    state.classes.filter((c) => c.schoolId === state.school.id).map((c) => c.name),
  );
  let next = state;
  for (const row of rows) {
    next = saveSchoolClass(next, { name: row.name });
    const classId = next.classes[next.classes.length - 1].id;
    for (const name of row.sections)
      next = saveSchoolSection(next, { classId, name, teacherId: '' });
  }
  return next;
}
