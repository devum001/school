import { examIncludes } from './testScope';
import { z } from 'zod';
import type { ClassSubject, DemoState, ExamResult } from '../types/domain';

export const classSubjectSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(60),
  aliases: z.array(z.string()).optional(),
  archived: z.boolean().optional(),
});
const key = (name: string) => name.trim().toLowerCase();

export type AcademicStream = 'science' | 'commerce' | 'arts';

export function detectClassStream(label: string): AcademicStream | null {
  const normalized = label.toLowerCase();
  if (/\b(science|sci|pcm|pcb|pcmb)\b/.test(normalized)) return 'science';
  if (/\b(commerce|com)\b/.test(normalized)) return 'commerce';
  if (/\b(arts|art|humanities)\b/.test(normalized)) return 'arts';
  return null;
}

export const STREAM_SUBJECTS_11_12: Record<AcademicStream, string[]> = {
  science: [
    'Physics',
    'Chemistry',
    'Mathematics',
    'Biology',
    'English Compulsory',
    'Hindi Compulsory',
    'Computer Science',
    'Informatics Practices',
    'Physical Education',
  ],
  commerce: [
    'Accountancy',
    'Business Studies',
    'Economics',
    'English Compulsory',
    'Hindi Compulsory',
    'Mathematics',
    'Applied Mathematics',
    'Informatics Practices',
    'Entrepreneurship',
    'Physical Education',
  ],
  arts: [
    'History',
    'Political Science',
    'Geography',
    'Hindi Literature',
    'English Literature',
    'English Compulsory',
    'Hindi Compulsory',
    'Economics',
    'Sociology',
    'Psychology',
    'Sanskrit Literature',
    'Home Science',
    'Drawing & Painting',
    'Physical Education',
  ],
};

export const RBSE_CBSE_SENIOR_STREAM_CLASSES = [
  { name: 'Class 11 Science', grade: '11 Science' },
  { name: 'Class 11 Commerce', grade: '11 Commerce' },
  { name: 'Class 11 Arts', grade: '11 Arts' },
  { name: 'Class 12 Science', grade: '12 Science' },
  { name: 'Class 12 Commerce', grade: '12 Commerce' },
  { name: 'Class 12 Arts', grade: '12 Arts' },
] as const;

export function boardSubjectCatalogForClass(
  classLabel: string,
  streamOverride?: AcademicStream | null,
  board?: string,
): string[] {
  const grade = Number(classLabel.match(/\d+/)?.[0] ?? 0);
  const stream = streamOverride ?? detectClassStream(classLabel);

  if (stream) {
    return [...STREAM_SUBJECTS_11_12[stream]];
  }

  if (grade === 11 || grade === 12) {
    return [
      'English Compulsory',
      'Hindi Compulsory',
      'Physics',
      'Chemistry',
      'Mathematics',
      'Biology',
      'Accountancy',
      'Business Studies',
      'Economics',
      'History',
      'Political Science',
      'Geography',
      'Hindi Literature',
      'English Literature',
      'Computer Science',
      'Informatics Practices',
      'Sociology',
      'Sanskrit Literature',
      'Home Science',
      'Physical Education',
    ];
  }

  if (grade >= 1 && grade <= 2) {
    return [
      'English',
      'Hindi',
      'Mathematics',
      'Environmental Studies',
      'Drawing & Art',
      'General Knowledge',
      'Physical Education',
    ];
  }

  if (grade >= 3 && grade <= 5) {
    return [
      'Mathematics',
      'Hindi',
      'English',
      'Environmental Studies',
      'Computer',
      'General Knowledge',
      'Drawing & Art',
      'Moral Science',
      'Physical Education',
    ];
  }

  if (grade >= 6 && grade <= 8) {
    return [
      'Mathematics',
      'Hindi',
      'English',
      'Science',
      'Social Studies',
      'Sanskrit',
      'Computer',
      'General Knowledge',
      'Drawing & Art',
      'Physical Education',
    ];
  }

  if (grade >= 9 && grade <= 10) {
    if (/icse|isc/i.test(board ?? '')) {
      return [
        'Mathematics',
        'Hindi',
        'English',
        'Physics',
        'Chemistry',
        'Biology',
        'History & Civics',
        'Geography',
        'Computer',
        'Sanskrit',
        'Physical Education',
      ];
    }
    return [
      'Mathematics',
      'Hindi',
      'English',
      'Science',
      'Social Studies',
      'Sanskrit',
      'Computer',
      'Information Technology',
      'Rajasthan Adhyayan',
      'Health & Physical Education',
      'Art Education',
    ];
  }

  return ['Mathematics', 'Hindi', 'English', 'Science', 'Social Studies', 'Computer'];
}

export function classSubjects(state: DemoState, classId: string): ClassSubject[] {
  const schoolClass = state.classes.find((c) => c.id === classId && c.schoolId === state.school.id);
  if (!schoolClass) return [];
  if (schoolClass.subjects) return schoolClass.subjects;
  const label = `${schoolClass.name} ${schoolClass.grade ?? ''}`.trim();
  const names = boardSubjectCatalogForClass(label, undefined, state.school.board);
  // Keep subjects from existing records available when opening an older demo.
  for (const exam of state.exams.filter((e) => examIncludes(e, classId)))
    for (const subject of exam.subjects)
      if (!names.some((n) => key(n) === key(subject.name))) names.push(subject.name);
  return names.map((name) => ({ id: `${classId}:${key(name).replace(/[^a-z0-9]+/g, '-')}`, name }));
}

export function subjectName(
  state: DemoState,
  classId: string,
  subject: { subjectId?: string; name: string },
) {
  const subjects = classSubjects(state, classId);
  const byId = subject.subjectId ? subjects.find((s) => s.id === subject.subjectId) : undefined;
  return (
    byId?.name ??
    subjects.find(
      (s) =>
        key(s.name) === key(subject.name) || s.aliases?.some((n) => key(n) === key(subject.name)),
    )?.name ??
    subject.name
  );
}

export function resolvedResult(state: DemoState, result: ExamResult): ExamResult {
  const classId = state.enrollments.find((e) => e.id === result.enrollmentId)?.classId ?? '';
  return {
    ...result,
    subjects: result.subjects.map((s) => ({ ...s, name: subjectName(state, classId, s) })),
  };
}

export function saveClassSubjects(
  state: DemoState,
  classId: string,
  input: ClassSubject[],
): DemoState {
  if (!state.classes.some((c) => c.id === classId && c.schoolId === state.school.id))
    throw new Error('Class not found.');
  const parsed = z.array(classSubjectSchema).max(30).safeParse(input);
  if (!parsed.success)
    throw new Error('Enter a subject name (up to 60 characters). Add up to 30 subjects.');
  const subjects = parsed.data;
  const active = subjects.filter((s) => !s.archived);
  if (!active.length) throw new Error('Keep at least one subject.');
  if (
    new Set(subjects.map((s) => s.id)).size !== subjects.length ||
    new Set(active.map((s) => key(s.name))).size !== active.length
  )
    throw new Error('Each subject needs a different name.');
  const previous = classSubjects(state, classId);
  const next = subjects.map((s) => {
    const old = previous.find((p) => p.id === s.id);
    return {
      ...s,
      aliases: [
        ...new Set([
          ...(old?.aliases ?? []),
          ...(s.aliases ?? []),
          ...(old && old.name !== s.name ? [old.name] : []),
        ]),
      ],
    };
  });
  // Archive omitted subjects so historical scores retain their identity.
  next.push(
    ...previous
      .filter((s) => !next.some((n) => n.id === s.id))
      .map((s) => ({ ...s, aliases: s.aliases ?? [], archived: true })),
  );
  return {
    ...state,
    classes: state.classes.map((c) => (c.id === classId ? { ...c, subjects: next } : c)),
  };
}
