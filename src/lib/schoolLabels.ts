import type { SchoolClass } from '../types/domain';
const naturalOrder = new Intl.Collator('en-IN', { numeric: true, sensitivity: 'base' });
export const orderedClasses = (classes: SchoolClass[]) =>
  [...classes].sort((a, b) => naturalOrder.compare(a.name, b.name));
export const sectionLabel = (name: string | undefined) =>
  `Section ${(name ?? '').replace(/^(section\s+)+/i, '').trim()}`;
