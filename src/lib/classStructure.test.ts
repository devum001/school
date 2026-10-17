import { describe, expect, it } from 'vitest';
import { createSeed } from '../mocks/seed';
import { restoreSchoolState } from '../mocks/restore';
import { saveStudent } from './management';
import {
  saveSchoolClass,
  saveSchoolSection,
  deleteSchoolClass,
  deleteSchoolSection,
} from './classStructure';

describe('school class and section setup', () => {
  it('creates flexible class/grade labels and sections used by enrollments and restore', () => {
    let state = saveSchoolClass(createSeed(), { name: 'Nursery Blue', grade: 'Pre-primary' });
    const schoolClass = state.classes[state.classes.length - 1];
    state = saveSchoolSection(state, { name: 'Lotus', classId: schoolClass.id, teacherId: '' });
    const section = state.sections[state.sections.length - 1];
    state = saveStudent(state, {
      name: 'Asha Singh',
      admissionNumber: 'NEW-1',
      status: 'active',
      birthDate: '2022-01-01',
      guardian: { name: 'Ravi Singh', relation: 'Parent', contact: null },
      address: '',
      classId: schoolClass.id,
      sectionId: section.id,
      rollNumber: 1,
    });
    const restored = restoreSchoolState(createSeed(), state);
    expect(restored.classes.find((c) => c.id === schoolClass.id)?.grade).toBe('Pre-primary');
    expect(restored.enrollments.at(-1)?.sectionId).toBe(section.id);
    expect(() => deleteSchoolSection(state, section.id)).toThrow(/students/);
    expect(() => deleteSchoolClass(state, schoolClass.id)).toThrow(/sections/);
  });
  it('rejects duplicate names and cross-school references, protects existing records', () => {
    const state = createSeed();
    expect(() => saveSchoolClass(state, { name: ' grade 5 ' })).toThrow(/already exists/);
    expect(() =>
      saveSchoolSection(state, { name: 'A', classId: 'class-5', teacherId: '' }),
    ).toThrow(/already exists/);
    expect(() =>
      saveSchoolSection(state, { name: 'C', classId: 'foreign', teacherId: '' }),
    ).toThrow(/this school/);
    expect(() =>
      saveSchoolSection(state, { name: 'C', classId: 'class-5', teacherId: 'foreign' }),
    ).toThrow(/this school/);
    expect(() => deleteSchoolSection(state, 'class-5-a')).toThrow(/students/);
    expect(() =>
      saveSchoolSection(state, { name: 'A', classId: 'class-6', teacherId: '' }, 'class-5-a'),
    ).toThrow(/existing class/);
    const renamed = saveSchoolClass(state, { name: 'Class V', grade: 'Grade 5' }, 'class-5');
    expect(renamed.enrollments).toEqual(state.enrollments);
    expect(renamed.classes.find((c) => c.id === 'class-5')?.name).toBe('Class V');
  });
  it('deletes only unused setup without changing student or timetable data', () => {
    let state = saveSchoolClass(createSeed(), { name: 'New class' });
    const id = state.classes.at(-1)!.id;
    state = saveSchoolSection(state, { name: 'C', classId: id, teacherId: '' });
    state = deleteSchoolSection(state, state.sections.at(-1)!.id);
    state = deleteSchoolClass(state, id);
    expect(state.classes).toEqual(createSeed().classes);
    expect(state.enrollments).toEqual(createSeed().enrollments);
  });
});
