import { expect, it } from 'vitest';
import { orderedClasses } from './schoolLabels';
it('orders numeric class labels naturally across prefixes and suffixes without mutating the source', () => {
  const classes = ['Class 12', '2nd', 'Grade 10', 'Class 1'].map((name) => ({ name }));
  expect(orderedClasses(classes).map((c) => c.name)).toEqual([
    'Class 1',
    '2nd',
    'Grade 10',
    'Class 12',
  ]);
  expect(classes[0].name).toBe('Class 12');
});
