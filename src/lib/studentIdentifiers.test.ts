import { describe, expect, it } from 'vitest';
import { identifierKey, rollKey, validRoll } from './studentIdentifiers';
import { saveStudent } from './management';
import { createSeed } from '../mocks/seed';
describe('student numeric identifier matching', () => {
  it('compares numeric parts across case, prefixes and leading zeros without number precision loss', () => {
    expect(identifierKey('SH-12')).toBe(identifierKey('ab-0012'));
    expect(rollKey('SH-12')).toBe(rollKey(12));
    expect(identifierKey('SH-13')).not.toBe(identifierKey('SH-12'));
    expect(identifierKey('SH-12345678901234567890')).not.toBe(
      identifierKey('SH-12345678901234567891'),
    );
    expect(identifierKey('Alpha')).toBe(identifierKey('alpha'));
    expect(identifierKey('Alpha')).not.toBe(identifierKey('Beta'));
  });
  it('allows alphanumeric rolls, but rejects malformed and invalid numeric values', () => {
    for (const roll of ['SH-12', 'ab/13', 'X_14', 12]) expect(validRoll(roll)).toBe(true);
    for (const roll of [0, NaN, -1, 1.2, Infinity, '', '@12', '1.5'])
      expect(validRoll(roll)).toBe(false);
  });
  it('keeps admission matching school-wide and roll matching per section when adding and editing', () => {
    const input = {
      name: 'Same Name',
      admissionNumber: 'SH-45678',
      birthDate: '2015-01-01',
      guardian: { name: 'Same Guardian', relation: 'Parent', contact: null },
      address: '',
      status: 'active' as const,
      classId: 'class-5',
      sectionId: 'class-5-a',
      rollNumber: 'SH-876',
    };
    const first = saveStudent(createSeed(), input);
    expect(() =>
      saveStudent(first, { ...input, admissionNumber: 'ab-045678', rollNumber: 'SH-877' }),
    ).toThrow(/admission number/);
    expect(() =>
      saveStudent(first, { ...input, admissionNumber: 'SH-45679', rollNumber: 'AB-876' }),
    ).toThrow(/roll number/);
    const second = saveStudent(first, {
      ...input,
      admissionNumber: 'SH-45679',
      sectionId: 'class-5-b',
      rollNumber: 'AB-876',
    });
    const studentId = second.students.at(-1)!.id;
    expect(() =>
      saveStudent(
        second,
        { ...input, admissionNumber: 'SH-45679', sectionId: 'class-5-b', rollNumber: 'xx-0876' },
        studentId,
      ),
    ).not.toThrow();
    expect(() =>
      saveStudent(
        second,
        { ...input, admissionNumber: 'SH-45678', sectionId: 'class-5-b' },
        studentId,
      ),
    ).toThrow(/admission number/);
  });
});
