export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half-day' | 'unmarked';
export interface School {
  id: string;
  name: string;
  city: string;
  motto: string;
}
export interface AcademicYear {
  id: string;
  schoolId: string;
  name: string;
  start: string;
  end: string;
}
export interface SchoolClass {
  id: string;
  schoolId: string;
  name: string;
}
export interface Section {
  id: string;
  schoolId: string;
  classId: string;
  name: string;
  teacherId: string;
}
export interface Teacher {
  id: string;
  schoolId: string;
  name: string;
  subject: string;
  staffId: string;
  status: 'active' | 'inactive';
  email: string;
  phone: string;
  qualification: string;
  joinedOn: string;
}
export interface Student {
  id: string;
  schoolId: string;
  name: string;
  admissionNumber: string;
  status: 'active' | 'inactive';
  birthDate: string;
  guardian: { name: string; relation: string; contact: string | null };
  address: string;
}
export interface Enrollment {
  id: string;
  schoolId: string;
  studentId: string;
  academicYearId: string;
  classId: string;
  sectionId: string;
  rollNumber: number;
}
export interface AttendanceRecord {
  schoolId: string;
  enrollmentId: string;
  date: string;
  status: AttendanceStatus;
}
export interface FeeObligation {
  id: string;
  schoolId: string;
  enrollmentId: string;
  label: string;
  dueDate: string;
  amount: number;
  adjustment: number;
}
export interface Payment {
  id: string;
  schoolId: string;
  enrollmentId: string;
  amount: number;
  date: string;
  method: 'Bank transfer' | 'Cash' | 'UPI';
  reference: string;
}
export interface Examination {
  id: string;
  schoolId: string;
  academicYearId: string;
  name: string;
  date: string;
  kind: 'Daily test' | 'Monthly test' | 'Pre-board' | 'Term exam';
  classId: string;
  sectionId: string;
  subjects: { name: string; maxMarks: number }[];
}
export interface ExamResult {
  schoolId: string;
  enrollmentId: string;
  examId: string;
  absent?: boolean;
  subjects: { name: string; marks: number; maxMarks: number }[];
}
export interface NotificationRecord {
  id: string;
  schoolId: string;
  enrollmentId: string;
  date: string;
  attendanceDate: string;
  message: string;
  status: 'simulated-success' | 'simulated-failure';
}
export interface Activity {
  id: string;
  text: string;
  detail: string;
  date: string;
  kind: 'attendance' | 'payment' | 'notification';
}
export interface DemoState {
  version: 1;
  school: School;
  academicYear: AcademicYear;
  classes: SchoolClass[];
  sections: Section[];
  teachers: Teacher[];
  students: Student[];
  enrollments: Enrollment[];
  attendance: AttendanceRecord[];
  obligations: FeeObligation[];
  payments: Payment[];
  exams: Examination[];
  results: ExamResult[];
  notifications: NotificationRecord[];
  activities: Activity[];
}
export interface RosterEntry {
  student: Student;
  enrollment: Enrollment;
  className: string;
  sectionName: string;
}
