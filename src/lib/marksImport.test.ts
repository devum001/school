import { describe, expect, it } from 'vitest';
import { createSeed } from '../mocks/seed';
import type { Examination, ExamResult, RosterEntry } from '../types/domain';
import { saveTestMarks } from './academics';
import {
  marksImportEntries,
  marksImportHeaders,
  marksImportTemplate,
  parseMarksCsv,
  previewMarksImport,
} from './marksImport';
import { roster } from './selectors';
import type { ExcelCell } from './xlsx';

function fixture() {
  const state = createSeed();
  const exam: Examination = {
    id: 'import-test',
    schoolId: state.school.id,
    academicYearId: state.academicYear.id,
    name: 'Import test',
    date: '2026-10-10',
    kind: 'Monthly test',
    classId: 'class-5',
    sectionId: '',
    subjects: [
      { name: 'Mathematics', maxMarks: 20 },
      { name: 'Science', maxMarks: 30 },
    ],
  };
  state.exams = [exam];
  state.results = [];
  const students = roster(state).filter((student) => student.enrollment.classId === exam.classId);
  const row = (student: RosterEntry, marks: ExcelCell[] = ['', ''], absent = 'No'): ExcelCell[] => [
    student.sectionName,
    student.enrollment.rollNumber,
    student.student.name,
    ...marks,
    absent,
  ];
  const result = (student: RosterEntry, marks = [10, 20], absent = false): ExamResult => ({
    schoolId: exam.schoolId,
    examId: exam.id,
    enrollmentId: student.enrollment.id,
    absent,
    subjects: exam.subjects.map((subject, index) => ({
      ...subject,
      marks: absent ? 0 : marks[index],
    })),
  });
  return { state, exam, students, row, result, headers: marksImportHeaders(exam) };
}

describe('bulk marks import with section and roll numbers', () => {
  it('exports a blank marks roster without admission numbers or previously entered marks', () => {
    const { exam, students } = fixture();
    const template = marksImportTemplate(exam, students);
    expect(template[0]).toEqual([
      'Section',
      'Roll No.',
      'Student Name',
      'Mathematics',
      'Science',
      'Absent',
    ]);
    expect(template).toHaveLength(students.length + 1);
    expect(
      template.slice(1).every((row) => row[3] === '' && row[4] === '' && row[5] === 'No'),
    ).toBe(true);
    expect(template[1].slice(0, 2)).toEqual(['A', 1]);
  });

  it('previews and saves mixed new, corrected, absent, zero and blank rows without clearing skipped results', () => {
    const { state, exam, students, row, result, headers } = fixture();
    state.results = [result(students[0]), result(students[1]), result(students[4])];
    const preview = previewMarksImport(exam, students, state.results, [
      headers,
      row(students[0], [18.5, 25]),
      row(students[1]),
      row(students[2], [0, 0]),
      row(students[3], ['', ''], 'Yes'),
      row(students[4], [10, 20]),
    ]);
    expect(preview.errors).toEqual([]);
    expect(preview).toMatchObject({
      newCount: 2,
      updateCount: 1,
      unchangedCount: 1,
      skippedCount: 1,
    });
    expect(preview.rows[0]).toMatchObject({
      before: 'Mathematics: 10/20 · Science: 20/30',
      after: 'Mathematics: 18.5/20 · Science: 25/30',
    });
    const entries = marksImportEntries(preview);
    expect(entries).toHaveLength(3);
    expect(entries.find((entry) => entry.enrollmentId === students[2].enrollment.id)).toMatchObject(
      { marks: [0, 0], absent: false },
    );
    const next = saveTestMarks(state, exam.id, entries);
    expect(
      next.results.find((record) => record.enrollmentId === students[1].enrollment.id),
    ).toEqual(state.results[1]);
    expect(
      next.results.find((record) => record.enrollmentId === students[3].enrollment.id),
    ).toMatchObject({
      absent: true,
      subjects: [
        { name: 'Mathematics', marks: 0, maxMarks: 20 },
        { name: 'Science', marks: 0, maxMarks: 30 },
      ],
    });
    expect(state.results).toHaveLength(3);
  });

  it('matches repeated rolls across sections to the correct enrollment', () => {
    const { exam, students, row, headers } = fixture();
    const sectionA = students.find(
      (student) => student.sectionName === 'A' && student.enrollment.rollNumber === 1,
    )!;
    const sectionB = students.find(
      (student) => student.sectionName === 'B' && student.enrollment.rollNumber === 1,
    )!;
    const preview = previewMarksImport(
      exam,
      students,
      [],
      [headers, row(sectionA, [11, 21]), row(sectionB, [12, 22])],
    );
    expect(preview.errors).toEqual([]);
    expect(marksImportEntries(preview).map((entry) => entry.enrollmentId)).toEqual([
      sectionA.enrollment.id,
      sectionB.enrollment.id,
    ]);
  });

  it('supports legacy all-class tests within the selected class roster', () => {
    const { exam, students, row, headers } = fixture();
    const preview = previewMarksImport(
      { ...exam, classId: '', sectionId: '' },
      students,
      [],
      [headers, row(students[0], [10, 20])],
    );
    expect(preview.errors).toEqual([]);
    expect(marksImportEntries(preview)[0].enrollmentId).toBe(students[0].enrollment.id);
  });

  it('rejects duplicate keys on both rows and blocks the entire file despite other valid rows', () => {
    const { exam, students, row, headers } = fixture();
    const preview = previewMarksImport(
      exam,
      students,
      [],
      [headers, row(students[0], [11, 20]), row(students[0], [12, 21]), row(students[1], [13, 22])],
    );
    expect(preview.rows.slice(0, 2).every((record) => record.status === 'error')).toBe(true);
    expect(preview.rows[2].status).toBe('new');
    expect(() => marksImportEntries(preview)).toThrow('Correct every import error');
  });

  it('rejects changed roll assignments and name mismatches rather than assigning marks to another child', () => {
    const { exam, students, row, headers } = fixture();
    const a = students.find(
      (student) => student.sectionName === 'A' && student.enrollment.rollNumber === 1,
    )!;
    const b = students.find(
      (student) => student.sectionName === 'A' && student.enrollment.rollNumber === 2,
    )!;
    const updated = students.map((student) =>
      student === a
        ? { ...student, enrollment: { ...student.enrollment, rollNumber: 2 } }
        : student === b
          ? { ...student, enrollment: { ...student.enrollment, rollNumber: 1 } }
          : student,
    );
    const preview = previewMarksImport(exam, updated, [], [headers, row(a, [14, 23])]);
    expect(preview.errors.join(' ')).toContain('Name does not match Roll');
    expect(() => marksImportEntries(preview)).toThrow();
    const renamed = students.map((student) =>
      student === a
        ? { ...student, student: { ...student.student, name: 'Updated student name' } }
        : student,
    );
    expect(
      previewMarksImport(exam, renamed, [], [headers, row(a, [14, 23])]).errors.join(' '),
    ).toContain('Download a fresh roster');
  });

  it('does not match missing sections, unknown students, ambiguous rosters or another class', () => {
    const { exam, students, row, headers } = fixture();
    const missingSection = row(students[0], [12, 20]);
    missingSection[0] = '';
    expect(
      previewMarksImport(exam, students, [], [headers, missingSection]).errors.join(' '),
    ).toContain('Section is required');
    const unknown = row(students[0], [12, 20]);
    unknown[0] = 'Other section';
    expect(previewMarksImport(exam, students, [], [headers, unknown]).errors.join(' ')).toContain(
      'No student matches',
    );
    expect(
      previewMarksImport(
        exam,
        [
          ...students,
          { ...students[0], enrollment: { ...students[0].enrollment, id: 'duplicate' } },
        ],
        [],
        [headers, row(students[0], [12, 20])],
      ).errors.join(' '),
    ).toContain('more than one student');
    expect(
      previewMarksImport(
        { ...exam, classId: 'class-6' },
        students,
        [],
        [headers, row(students[0], [12, 20])],
      ).errors.join(' '),
    ).toContain('No student matches');
  });

  it.each([-1, 21, NaN, Infinity, '=10+2', '+12', '@SUM(1,2)', '1e1', '12%', 'twelve'])(
    'rejects invalid mathematics mark %s',
    (mark) => {
      const { exam, students, row, headers } = fixture();
      const preview = previewMarksImport(
        exam,
        students,
        [],
        [headers, row(students[0], [mark, 20])],
      );
      expect(preview.errors.join(' ')).toContain('Mathematics marks must be a plain number');
      expect(() => marksImportEntries(preview)).toThrow();
    },
  );

  it('requires complete subject marks and an unambiguous absence flag', () => {
    const { exam, students, row, headers } = fixture();
    expect(
      previewMarksImport(exam, students, [], [headers, row(students[0], [10, ''])]).errors.join(
        ' ',
      ),
    ).toContain('Complete Science');
    expect(
      previewMarksImport(
        exam,
        students,
        [],
        [headers, row(students[0], [10, 20], 'Maybe')],
      ).errors.join(' '),
    ).toContain('Absent must be Yes or No');
    expect(
      previewMarksImport(
        exam,
        students,
        [],
        [headers, row(students[0], [10, ''], 'Yes')],
      ).errors.join(' '),
    ).toContain('cannot also have earned marks');
    expect(
      previewMarksImport(exam, students, [], [headers, row(students[0], [0, 0], 'Yes')]).errors,
    ).toEqual([]);
  });

  it('requires the correct unique headers and limits file size by rows', () => {
    const { exam, students, row, headers } = fixture();
    expect(
      previewMarksImport(
        exam,
        students,
        [],
        [headers.filter((header) => header !== 'Section')],
      ).errors.join(' '),
    ).toContain('Missing column: Section');
    expect(
      previewMarksImport(exam, students, [], [[...headers, 'Section']]).errors.join(' '),
    ).toContain('duplicate column headers');
    expect(
      previewMarksImport(
        exam,
        students,
        [],
        [headers.map((header) => (header === 'Roll No.' ? 'Admission No.' : header))],
      ).errors.join(' '),
    ).toContain('Missing column: Roll No.');
    expect(
      previewMarksImport(
        exam,
        students,
        [],
        [headers.map((header) => (header === 'Science' ? 'science' : header))],
      ).errors.join(' '),
    ).toContain('Keep the subject header exactly');
    expect(
      previewMarksImport(
        exam,
        students,
        [],
        [headers, ...Array.from({ length: 1001 }, () => row(students[0]))],
      ).errors.join(' '),
    ).toContain('up to 1,000');
    expect(() =>
      marksImportTemplate({ ...exam, subjects: [{ name: 'Section', maxMarks: 20 }] }, students),
    ).toThrow('conflicts');
  });

  it('keeps blank or unchanged results without producing a save entry', () => {
    const { exam, students, row, result, headers } = fixture();
    const preview = previewMarksImport(
      exam,
      students,
      [result(students[0])],
      [headers, row(students[0], [10, 20]), row(students[1])],
    );
    expect(preview.errors).toEqual([]);
    expect(() => marksImportEntries(preview)).toThrow('no changed marks');
  });

  it('reads CSV quoted commas, escaped quotes, CRLF, BOM and embedded newlines safely', () => {
    // Real escaped CSV cells can include commas, double quotes and line breaks.
    const quoted = parseMarksCsv(
      '\uFEFFSection,Roll No.,Student Name,Mathematics,Science,Absent\r\nA,1,"Rao, ""A""\nKumar",0,20,No\r\n',
    );
    expect(quoted[1]).toEqual(['A', '1', 'Rao, "A"\nKumar', '0', '20', 'No']);
    expect(quoted[0][0]).toBe('Section');
    expect(() => parseMarksCsv('Section,Roll No.\nA,"unfinished')).toThrow('unclosed');
    expect(() => parseMarksCsv('Section,Roll No.\nA,"one"two')).toThrow('unexpected text');
    expect(() => parseMarksCsv('Section,Roll No.\nA,one"two')).toThrow('quote is misplaced');
  });
});
