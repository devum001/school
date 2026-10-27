import { ordinalClass } from './classNames';
const naturalOrder = new Intl.Collator('en-IN', { numeric: true, sensitivity: 'base' });
export const orderedClasses = <T extends { name: string }>(classes: readonly T[]) =>
  [...classes].sort((a, b) => {
    const left = ordinalClass(a.name),
      right = ordinalClass(b.name);
    if (left && right) return left.level - right.level || naturalOrder.compare(a.name, b.name);
    if (left || right) return left ? 1 : -1;
    return naturalOrder.compare(a.name, b.name);
  });
export const sectionLabel = (name: string | undefined) =>
  name ? `Section ${name.replace(/^(section\s+)+/i, '').trim()}` : 'No section';
