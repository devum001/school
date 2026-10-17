import { describe, expect, it } from 'vitest';
import { createSeed } from '../mocks/seed';
import { academicContextFor, studentHistoryUrl, studentReturnPath } from './academicNavigation';

describe('academic navigation context', () => {
  it('restores valid class, section, test, filters and selected view from a shared link', () => {
    const state = createSeed('2026-10-15');
    expect(
      academicContextFor(
        state,
        new URLSearchParams(
          'class=class-7&section=class-7-b&test=exam-daily&kind=Daily+test&month=2026-10&view=rankings&q=math&limit=20',
        ),
      ),
    ).toEqual({
      classId: 'class-7',
      sectionId: 'class-7-b',
      examId: 'exam-daily',
      kind: 'Daily test',
      month: '2026-10',
      tab: 'rankings',
      query: 'math',
      limit: 20,
    });
  });
  it('falls back to an available class and rejects unrelated section and invalid filter values', () => {
    const state = createSeed('2026-10-15');
    state.classes = state.classes.filter((item) => item.id === 'class-7');
    expect(
      academicContextFor(
        state,
        new URLSearchParams('class=deleted&section=class-5-a&kind=bad&month=2026-99&limit=-3'),
      ),
    ).toMatchObject({ classId: 'class-7', sectionId: '', kind: '', month: '', limit: 10 });
    state.classes = [];
    expect(academicContextFor(state, new URLSearchParams()).classId).toBe('');
  });
  it('keeps only safe local student return links and encodes test context', () => {
    expect(studentReturnPath('/students/stu-066?tab=academics&exam=exam-daily')).toBe(
      '/students/stu-066?tab=academics&exam=exam-daily',
    );
    for (const value of [
      'https://example.com/students/1',
      '//example.com/students/1',
      '/\\example.com/students/1',
      '/fees',
      'javascript:alert(1)',
      '//[',
    ])
      expect(studentReturnPath(value)).toBeNull();
    const url = new URL(
      studentHistoryUrl('stu-066', 'exam-daily', '/academics?class=class-7&section=class-7-b'),
      'https://schoolwell.local',
    );
    expect(url.searchParams.get('exam')).toBe('exam-daily');
    expect(url.searchParams.get('from')).toBe('/academics?class=class-7&section=class-7-b');
  });
});
