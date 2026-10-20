import { expect, it } from 'vitest';
import { createSeed } from '../mocks/seed';
import { applyClassSetup, validateClassSetup } from './classSetup';
it('creates multiple classes and sections without changing existing school records', () => {
  const state = createSeed();
  const next = applyClassSetup(state, [
    { name: ' Nursery ', sections: ['Blue', 'Green'] },
    { name: 'Class 1', sections: ['A'] },
  ]);
  expect(next.classes.slice(-2).map((c) => c.name)).toEqual(['Nursery', 'Class 1']);
  expect(next.sections.slice(-3).map((s) => s.classId)).toEqual([
    next.classes.at(-2)!.id,
    next.classes.at(-2)!.id,
    next.classes.at(-1)!.id,
  ]);
  expect(next.enrollments).toBe(state.enrollments);
  expect(state.classes).toHaveLength(createSeed().classes.length);
});
it('rejects duplicates and invalid names before committing any setup', () => {
  const state = createSeed(),
    original = JSON.stringify(state);
  expect(() =>
    applyClassSetup(state, [
      { name: 'New', sections: ['A'] },
      { name: 'grade 5', sections: ['A'] },
    ]),
  ).toThrow(/already exists/);
  expect(JSON.stringify(state)).toBe(original);
  expect(() => validateClassSetup([{ name: 'Class 1', sections: ['A', ' a '] }])).toThrow(
    /repeated/,
  );
  expect(() => validateClassSetup([{ name: 'Class 1', sections: [' '] }])).toThrow(/section names/);
  expect(() => validateClassSetup([{ name: ' ', sections: ['A'] }])).toThrow(/class name/);
  expect(() => validateClassSetup([])).toThrow(/1–50/);
});
it('limits batch size and normalizes names consistently with live setup', () => {
  expect(() =>
    validateClassSetup(
      Array.from({ length: 11 }, (_, i) => ({
        name: `Class ${i}`,
        sections: Array.from({ length: 20 }, (_, j) => `S${j}`),
      })),
    ),
  ).toThrow(/200/);
  expect(() => validateClassSetup([{ name: 'Class １', sections: ['A'] }], ['class 1'])).toThrow(
    /already exists/,
  );
});
