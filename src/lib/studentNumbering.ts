import type { DemoState } from '../types/domain';

const names = new Intl.Collator('en-IN', { sensitivity: 'base', numeric: true });
export const admissionSequenceKey = (state: DemoState) =>
  `${state.school.id}:${state.academicYear.start.slice(0, 4)}`;

/** Existing admissions stay permanent; new records use the school's current year sequence. */
export function nextAdmissionNumber(state: DemoState): string {
  const year = state.academicYear.start.slice(0, 4);
  const code = state.school.code?.trim() || 'ADM';
  const prefix = code.endsWith(`-${year}`) ? `${code}-` : `${code}-${year}-`;
  const used = state.students.filter((student) => student.schoolId === state.school.id);
  const sequence = Math.max(
    state.studentAdmissionSequences?.[admissionSequenceKey(state)] ?? 0,
    ...used.map((student) => {
      const match = student.admissionNumber.match(/-(\d{4})-(\d+)$/);
      return match?.[1] === year ? Number(match[2]) : 0;
    }),
  );
  let next = sequence + 1;
  while (
    used.some(
      (student) =>
        student.admissionNumber.toLowerCase() ===
        `${prefix}${String(next).padStart(4, '0')}`.toLowerCase(),
    )
  )
    next++;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

/** Current active rosters are alphabetic within each section; inactive records follow them. */
export function renumberStudentRolls(state: DemoState): DemoState {
  const students = new Map(
    state.students
      .filter((student) => student.schoolId === state.school.id)
      .map((student) => [student.id, student]),
  );
  const groups = new Map<string, DemoState['enrollments']>();
  for (const enrollment of state.enrollments) {
    if (
      enrollment.schoolId !== state.school.id ||
      enrollment.academicYearId !== state.academicYear.id ||
      !students.has(enrollment.studentId)
    )
      continue;
    const key = `${enrollment.classId}:${enrollment.sectionId}`;
    const group = groups.get(key) ?? [];
    group.push(enrollment);
    groups.set(key, group);
  }
  const numbers = new Map<string, number>();
  for (const group of groups.values()) {
    group.sort((a, b) => {
      const left = students.get(a.studentId)!,
        right = students.get(b.studentId)!;
      return (
        Number(left.status !== 'active') - Number(right.status !== 'active') ||
        names.compare(left.name.trim(), right.name.trim()) ||
        names.compare(left.admissionNumber, right.admissionNumber) ||
        a.id.localeCompare(b.id)
      );
    });
    group.forEach((enrollment, index) => numbers.set(enrollment.id, index + 1));
  }
  const enrollments = state.enrollments.map((enrollment) => {
    const rollNumber = numbers.get(enrollment.id);
    return rollNumber !== undefined && enrollment.rollNumber !== rollNumber
      ? { ...enrollment, rollNumber }
      : enrollment;
  });
  return enrollments.some((enrollment, index) => enrollment !== state.enrollments[index])
    ? { ...state, enrollments }
    : state;
}

export function studentRollPreview(
  state: DemoState,
  draft: {
    id?: string;
    name: string;
    admissionNumber: string;
    status: 'active' | 'inactive';
    classId: string;
    sectionId: string;
  },
): number {
  const id = draft.id ?? '__student-preview__';
  const student = {
    id,
    schoolId: state.school.id,
    name: draft.name,
    admissionNumber: draft.admissionNumber,
    status: draft.status,
    birthDate: '',
    address: '',
    guardian: { name: '', relation: '', contact: null },
  };
  const enrollment = {
    id: '__enrollment-preview__',
    schoolId: state.school.id,
    academicYearId: state.academicYear.id,
    studentId: id,
    classId: draft.classId,
    sectionId: draft.sectionId,
    rollNumber: 1,
  };
  const numbered = renumberStudentRolls({
    ...state,
    students: [...state.students.filter((entry) => entry.id !== id), student],
    enrollments: [
      ...state.enrollments.filter(
        (entry) => entry.studentId !== id || entry.academicYearId !== state.academicYear.id,
      ),
      enrollment,
    ],
  });
  return numbered.enrollments.find((entry) => entry.id === enrollment.id)!.rollNumber;
}
