import { installmentName } from '../lib/feeLabels';
import type { DemoState } from '../types/domain';
import { SCHOOL_ID } from '../lib/config';
import { getSchoolDate, shiftCalendarDate } from '../lib/dates';
const firstNames = [
  'Aarav',
  'Ananya',
  'Vihaan',
  'Diya',
  'Arjun',
  'Ishita',
  'Kabir',
  'Meera',
  'Reyansh',
  'Saanvi',
  'Advait',
  'Tara',
  'Ishan',
  'Riya',
  'Dev',
  'Kiara',
  'Rohan',
  'Aanya',
  'Neil',
  'Sara',
  'Vivaan',
  'Nisha',
  'Dhruv',
  'Myra',
];
const surnames = ['Sharma', 'Patel', 'Mehta', 'Kapoor', 'Rao', 'Nair'];
const teacherNames = [
  'Priya Menon',
  'Aditya Sethi',
  'Kavya Rao',
  'Rishi Nair',
  'Neha Bhat',
  'Arun Mehta',
  'Maya Sen',
  'Rahul Roy',
  'Ira Kapoor',
  'Vikram Das',
  'Sonia Jain',
  'Amit Shah',
];
export function createSeed(anchorDate = getSchoolDate()): DemoState {
  const schoolId = SCHOOL_ID;
  const state: DemoState = {
    version: 1,
    school: {
      id: schoolId,
      name: 'Vidya Niketan Public School',
      city: 'Bengaluru, Karnataka',
      motto: 'Curiosity today. Possibility tomorrow.',
      code: 'VNPS-2026',
      board: 'CBSE (Central Board of Secondary Education)',
      affiliationNumber: 'CBSE/AFF/1930482',
      principal: 'Dr. Nandita Rao',
      phone: '+91 80 2345 6789',
      email: 'contact@vidyaniketan.edu.in',
      website: 'www.vidyaniketan.edu.in',
    },
    academicYear: {
      id: 'ay-2026',
      schoolId,
      name: '2026 – 2027',
      start: '2026-04-01',
      end: '2027-03-31',
    },
    classes: [],
    sections: [],
    teachers: [],
    students: [],
    enrollments: [],
    attendance: [],
    obligations: [],
    payments: [],
    exams: [
      {
        id: 'exam-unit',
        schoolId,
        academicYearId: 'ay-2026',
        name: 'Unit Assessment I',
        kind: 'Monthly test',
        classId: '',
        sectionId: '',
        subjects: ['English', 'Mathematics', 'Science', 'Social studies', 'Hindi'].map((name) => ({
          name,
          maxMarks: 100,
        })),
        date: '2026-07-24',
      },
      {
        id: 'exam-midterm',
        schoolId,
        academicYearId: 'ay-2026',
        name: 'Mid-term Examination',
        kind: 'Term exam',
        classId: '',
        sectionId: '',
        subjects: ['English', 'Mathematics', 'Science', 'Social studies', 'Hindi'].map((name) => ({
          name,
          maxMarks: 100,
        })),
        date: '2026-09-25',
      },
    ],
    results: [],
    notifications: [],
    activities: [],
  };
  teacherNames.forEach((name, i) =>
    state.teachers.push({
      id: `teacher-${i + 1}`,
      staffId: `VN-T${String(i + 1).padStart(3, '0')}`,
      status: 'active',
      email: '',
      phone: '',
      qualification: 'B.Ed.',
      joinedOn: '2023-04-01',
      schoolId,
      name,
      subject: ['Mathematics', 'English', 'Science', 'Social studies'][i % 4],
    }),
  );
  for (let c = 0; c < 6; c++) {
    const classId = `class-${c + 5}`;
    state.classes.push({ id: classId, schoolId, name: `Grade ${c + 5}` });
    for (let s = 0; s < 2; s++) {
      const sectionId = `${classId}-${s === 0 ? 'a' : 'b'}`;
      state.sections.push({
        id: sectionId,
        schoolId,
        classId,
        name: s === 0 ? 'A' : 'B',
        teacherId: `teacher-${c * 2 + s + 1}`,
      });
      for (let n = 0; n < 12; n++) {
        const i = c * 24 + s * 12 + n;
        const studentId = `stu-${String(i + 1).padStart(3, '0')}`;
        const enrollmentId = `enr-${String(i + 1).padStart(3, '0')}`;
        state.students.push({
          id: studentId,
          schoolId,
          name: `${firstNames[(n + s * 12) % 24]} ${surnames[c]}`,
          admissionNumber: `WBA-${2026}-${String(i + 1).padStart(4, '0')}`,
          status: i === 143 ? 'inactive' : 'active',
          birthDate: `${2016 - c}-0${(n % 9) + 1}-${String(n + 10).padStart(2, '0')}`,
          guardian: {
            name: `${['Vivek', 'Anita', 'Sanjay', 'Pooja'][n % 4]} ${surnames[c]}`,
            relation: n % 2 ? 'Mother' : 'Father',
            contact: i % 7 === 0 ? null : `PARENT-${String(i + 1).padStart(3, '0')}`,
          },
          address: 'Willow Gardens, Bengaluru',
        });
        state.enrollments.push({
          id: enrollmentId,
          schoolId,
          studentId,
          academicYearId: 'ay-2026',
          classId,
          sectionId,
          rollNumber: n + 1,
        });
        for (const day of [1, 2, 3, 5, 6, 7, 8, 9, 10]) {
          const today = day === 10;
          const absenceInterval: Record<number, number> = {
            1: 12,
            2: 9,
            3: 8,
            5: 11,
            6: 13,
            7: 15,
            8: 12,
            9: 16,
            10: 13,
          };
          const status =
            today && s === 1 && c === 5
              ? 'unmarked'
              : (i + day) % absenceInterval[day] === 0
                ? 'absent'
                : (i + day) % 19 === 0
                  ? 'late'
                  : (i + day) % 37 === 0
                    ? 'half-day'
                    : 'present';
          if (i !== 143)
            state.attendance.push({
              schoolId,
              enrollmentId,
              date: shiftCalendarDate(anchorDate, day - 10),
              status,
            });
        }
        for (let term = 0; term < 3; term++)
          state.obligations.push({
            id: `fee-${i}-${term}`,
            schoolId,
            enrollmentId,
            label: installmentName(term + 1),
            dueDate: ['2026-04-10', '2026-09-10', '2027-01-10'][term],
            amount: 1800000,
            adjustment: 0,
          });
        state.payments.push({
          id: `pay-${i}-1`,
          schoolId,
          enrollmentId,
          amount: 1800000,
          date: '2026-04-08',
          method: 'Bank transfer',
          reference: `WBA-APR-${i + 1}`,
        });
        if (i % 4 !== 0)
          state.payments.push({
            id: `pay-${i}-2`,
            schoolId,
            enrollmentId,
            amount: i % 3 === 0 ? 900000 : 1800000,
            date: `2026-09-${String(1 + (i % 9)).padStart(2, '0')}`,
            method: i % 2 ? 'UPI' : 'Bank transfer',
            reference: `WBA-SEP-${i + 1}`,
          });
        state.exams.forEach((exam, e) =>
          state.results.push({
            schoolId,
            enrollmentId,
            examId: exam.id,
            subjects: ['English', 'Mathematics', 'Science', 'Social studies', 'Hindi'].map(
              (name, k) => ({
                name,
                marks: Math.min(98, 61 + ((i * 7 + k * 11) % 31) + e * 4),
                maxMarks: 100,
              }),
            ),
          }),
        );
      }
    }
  }
  const recentTests: DemoState['exams'] = [
    {
      id: 'exam-daily',
      name: 'Mathematics · Daily practice',
      kind: 'Daily test',
      date: anchorDate,
      classId: '',
      subjects: [{ name: 'Mathematics', maxMarks: 20 }],
    },
    {
      id: 'exam-monthly',
      name: 'Science · Monthly assessment',
      kind: 'Monthly test',
      date: shiftCalendarDate(anchorDate, -7),
      classId: '',
      subjects: [{ name: 'Science', maxMarks: 30 }],
    },
    {
      id: 'exam-preboard',
      name: 'Pre-board I',
      kind: 'Pre-board',
      date: shiftCalendarDate(anchorDate, -14),
      classId: 'class-10',
      subjects: ['English', 'Mathematics', 'Science', 'Social studies'].map((name) => ({
        name,
        maxMarks: 50,
      })),
    },
  ].map((exam) => ({
    ...exam,
    kind: exam.kind as DemoState['exams'][number]['kind'],
    schoolId,
    academicYearId: state.academicYear.id,
    sectionId: '',
  }));
  recentTests.forEach((exam, examIndex) => {
    state.exams.push(exam);
    state.enrollments
      .filter((enrollment) => !exam.classId || enrollment.classId === exam.classId)
      .forEach((enrollment, i) => {
        state.results.push({
          schoolId,
          examId: exam.id,
          enrollmentId: enrollment.id,
          subjects: exam.subjects.map((subject, j) => ({
            ...subject,
            marks:
              Math.round(
                subject.maxMarks * (0.6 + ((i * 7 + j * 3 + examIndex * 5) % 39) / 100) * 2,
              ) / 2,
          })),
        });
      });
  });
  state.activities = [
    {
      id: 'activity-seed-1',
      text: 'Mid-term results are ready',
      detail: 'Grade 5–10 · Academic office',
      date: anchorDate,
      kind: 'attendance',
    },
    {
      id: 'activity-seed-2',
      text: 'September fee payments reconciled',
      detail: 'Accounts office · Payment records',
      date: shiftCalendarDate(anchorDate, -1),
      kind: 'payment',
    },
    {
      id: 'activity-seed-3',
      text: 'Attendance registers opened',
      detail: '12 sections · Academic office',
      date: shiftCalendarDate(anchorDate, -9),
      kind: 'attendance',
    },
  ];
  return state;
}
