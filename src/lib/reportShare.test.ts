import { describe, expect, it } from 'vitest';
import { createSeed } from '../mocks/seed';
import { roster, resultSummary } from './selectors';
import {
  studentReportMessage,
  testAbsenceMessage,
  whatsappPhone,
  whatsappReportUrl,
} from './reportShare';

describe('parent report sharing', () => {
  it('normalizes Indian and international numbers without treating contact references as phone numbers', () => {
    expect(whatsappPhone('98765 43210')).toBe('919876543210');
    expect(whatsappPhone('+91 (98765) 43210')).toBe('919876543210');
    expect(whatsappPhone('919876543210')).toBe('919876543210');
    expect(whatsappPhone('+44 7700 900123')).toBe('447700900123');
    for (const value of [
      '',
      'PARENT-121',
      '123',
      '+91987654',
      '9876543210 ext 1',
      'https://other.example',
      '+0000000000',
    ])
      expect(whatsappPhone(value)).toBeNull();
  });
  it('creates an encoded text report link or a contact-picker link without sending', () => {
    const message = 'आदरणीय अभिभावक,\nMarks: 18 / 20 & 90%';
    const link = new URL(whatsappReportUrl(message, '+91 9876543210'));
    expect(link.origin).toBe('https://wa.me');
    expect(link.pathname).toBe('/919876543210');
    expect(link.searchParams.get('text')).toBe(message);
    expect(new URL(whatsappReportUrl(message)).pathname).toBe('/');
    expect(() => whatsappReportUrl(message, 'PARENT-001')).toThrow();
  });
  it('reports the selected student and actual subject maxima in Hindi', () => {
    const state = createSeed('2026-10-11');
    const row = roster(state).find((r) => r.student.id === 'stu-121')!;
    const exam = state.exams.find((e) => e.id === 'exam-preboard')!;
    const result = state.results.find(
      (r) => r.enrollmentId === row.enrollment.id && r.examId === exam.id,
    )!;
    const summary = resultSummary(result);
    const text = studentReportMessage(state, row, [exam]);
    expect(text).toContain('Aarav Nair');
    expect(text).toContain('आदरणीय अभिभावक');
    expect(text).toContain(`कुल अंक: ${summary.marks} / 200`);
    expect(text).toContain('Mathematics:');
    expect(text).not.toContain('localhost');
  });
  it('excludes pending and out-of-scope tests and describes absence accurately', () => {
    const state = createSeed('2026-10-11');
    const row = roster(state)[0];
    state.results = state.results.filter((r) => r.examId !== 'exam-daily');
    expect(
      studentReportMessage(state, row, [state.exams.find((e) => e.id === 'exam-daily')!]),
    ).toBe('');
    expect(
      studentReportMessage(state, row, [state.exams.find((e) => e.id === 'exam-preboard')!]),
    ).toBe('');
    const result = state.results.find(
      (r) => r.enrollmentId === row.enrollment.id && r.examId === 'exam-monthly',
    )!;
    result.absent = true;
    result.subjects.forEach((s) => (s.marks = 0));
    const text = studentReportMessage(state, row, state.exams);
    expect(text).toContain('स्थिति: अनुपस्थित');
    expect(text).toContain('प्रतिशत: — (अनुपस्थित या लंबित)');
    expect(text).not.toContain('कुल अंक: 0 / 30');
    expect(text).toContain('समग्र परिणाम');
    expect(text).not.toContain('Daily practice');
  });
});

it('prepares a test-specific Hindi absence notice only for an explicitly absent student', () => {
  const state = createSeed('2026-10-11');
  const row = roster(state).find((r) => r.student.id === 'stu-121')!;
  const exam = state.exams.find((e) => e.id === 'exam-preboard')!;
  expect(testAbsenceMessage(state, row, exam)).toBe('');
  const result = state.results.find(
    (r) => r.enrollmentId === row.enrollment.id && r.examId === exam.id,
  )!;
  result.absent = true;
  result.subjects.forEach((s) => (s.marks = 0));
  const message = testAbsenceMessage(state, row, exam);
  expect(message).toContain('Aarav Nair');
  expect(message).toContain('Pre-board I');
  expect(message).toContain('प्री-बोर्ड परीक्षा');
  expect(message).toContain('अनुपस्थित');
  expect(message).toContain('27-09-2026');
  expect(
    testAbsenceMessage(
      state,
      row,
      state.exams.find((e) => e.id === 'exam-daily')!,
    ),
  ).toBe('');
  expect(testAbsenceMessage(state, row, { ...exam, schoolId: 'another-school' })).toBe('');
});
