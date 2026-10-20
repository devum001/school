import type { CommunicationState } from './communication';
import type { StaffAccessSettings } from './staffAccess';
import type { WorkspacePreferences, WorkspaceSecurity, AuditEntry } from './admin';
import type {
  DocumentTemplates,
  RecordedDocumentData,
  PaymentAllocation,
  SalaryPayment,
  StoredDocument,
  StudentFeePlan,
} from './ledger';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half-day' | 'unmarked';
export interface School {
  timezone?: string;
  id: string;
  name: string;
  city: string;
  motto: string;
  code?: string;
  board?: string;
  affiliationNumber?: string;
  principal?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoDataUrl?: string | null;
}
export interface AttendancePolicy {
  studentStart: string;
  studentEnd: string;
  facultyStart: string;
  facultyEnd: string;
  officeStart: string;
  officeEnd: string;
  graceMinutes: number;
  lateTrigger: number;
  lateSms: boolean;
  minimumAttendance: number;
  warningAttendance: number;
  medicalExemption: number;
  absenceTime: string;
  consecutiveAbsences: number;
  absenceAlerts: boolean;
  minimumCampusMinutes: number;
  earlyExitStart: string;
  earlyExitEnd: string;
  enforceLate: boolean;
  enforceHalfDay: boolean;
  enforceEligibility: boolean;
}
export interface AcademicYear {
  id: string;
  schoolId: string;
  name: string;
  start: string;
  end: string;
}
export type SchoolWeekday =
  'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
export interface StudentTiming {
  id: string;
  schoolId: string;
  name: string;
  days: SchoolWeekday[];
  start: string;
  end: string;
  sectionIds: string[];
}
export interface SchoolHours {
  start: string;
  end: string;
  days: SchoolWeekday[];
}
export interface TimetableSlot {
  id: string;
  name: string;
  kind: 'entry' | 'prayer' | 'period' | 'transition' | 'break' | 'lunch' | 'activity' | 'dismissal';
  start: string;
  end: string;
  teacherId?: string;
}
export interface ClassTimetable {
  id: string;
  schoolId: string;
  sectionId: string;
  timingId: string;
  day: SchoolWeekday;
  slots: TimetableSlot[];
}
export interface StaffPayrollConfig {
  setup: {
    departments: StaffDepartment[];
  };
  work: {
    start: string;
    end: string;
    weeklyOff: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
    lateAfter: string;
    halfDayMinutes: number;
    leaveLimits: {
      casual: number;
      sick: number;
      paid: number;
      unpaid: number | null;
    };
    autoLeaveDeduction: boolean;
  };
  payroll: {
    salaryCycle: 'Monthly';
    paymentDay: number;
    components: ('Basic' | 'Allowance' | 'Bonus' | 'Deduction')[];
    lateDeduction: 'none' | 'fixed-amount';
    lateDeductionAmount: number; // Amount in paise, consistent with other monetary records.
    autoCalculation: boolean;
    payslipTemplate: 'Standard' | 'Compact';
  };
}
export interface StaffDesignation {
  id: string;
  name: string;
}
export interface StaffDepartment {
  id: string;
  name: string;
  designations: StaffDesignation[];
}
export type EmploymentType = 'Full Time' | 'Part Time' | 'Contract';
export interface StaffSalary {
  effectiveFrom: string;
  basic: number;
  allowance: number;
  bonus: number;
  deduction: number;
}
export interface StaffCycleInput {
  schoolId: string;
  staffId: string;
  month: string;
  start: string;
  end: string;
  unpaidDays: number;
  lateArrivals: number;
}
export interface StaffAttendanceRecord {
  schoolId: string;
  staffId: string;
  date: string;
  status: AttendanceStatus;
}
export interface StaffMember {
  id: string;
  schoolId: string;
  teacherId?: string;
  name: string;
  staffId?: string; // Kept for existing records; staff codes are not shown or required.
  departmentId: string;
  designationId?: string;
  designation?: string;
  employmentType?: EmploymentType; // Legacy metadata, no longer exposed in Staff.
  salary?: StaffSalary;
  salaryHistory?: StaffSalary[];
  status: 'active' | 'inactive';
  email: string;
  phone: string;
  joinedOn: string;
  qualification?: string;
  photoDataUrl?: string;
  isTeachingStaff?: boolean;
}
export interface SchoolClass {
  studentCount?: number;
  id: string;
  schoolId: string;
  name: string;
  grade?: string;
  subjects?: ClassSubject[];
}
export interface ClassSubject {
  id: string;
  name: string;
  aliases?: string[];
  archived?: boolean;
}
export interface Section {
  studentCount?: number;
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
  photoDataUrl?: string;
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
  rollNumber: string | number;
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
  installmentNumber?: number;
  installmentCount?: number;
  feeKind?: 'One Time' | 'Installments';
}
export interface Payment {
  id: string;
  schoolId: string;
  enrollmentId: string;
  studentId?: string;
  amount: number;
  date: string;
  method: 'Bank transfer' | 'Bank' | 'Cash' | 'UPI' | 'Card' | 'Cheque';
  reference: string;
  allocations?: PaymentAllocation[];
  installmentId?: string;
  receiptNumber?: string;
  receivedBy?: string;
  createdAt?: string;
  document?: RecordedDocumentData;
}
export interface Examination {
  id: string;
  schoolId: string;
  academicYearId: string;
  name: string;
  date: string;
  kind: string;
  classId: string;
  sectionId: string;
  classIds?: string[];
  sectionIds?: string[];
  sectionlessClassIds?: string[];
  subjectSelections?: { classId: string; subjectIds: string[] }[];
  subjectMaximums?: { classId: string; subjectId: string; maxMarks: number }[];
  sheets?: { classId?: string; sectionId: string; subjects: TestSubject[] }[];
  subjects: TestSubject[];
}
export interface TestSubject {
  subjectId?: string;
  name: string;
  maxMarks: number;
}
export interface ExamResult {
  schoolId: string;
  enrollmentId: string;
  examId: string;
  absent?: boolean;
  subjects: (TestSubject & { marks: number; absent?: boolean; pending?: boolean })[];
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
  preferences?: WorkspacePreferences;
  security?: WorkspaceSecurity;
  auditLog?: AuditEntry[];
  version: 1;
  communication?: CommunicationState;
  staffAccess?: StaffAccessSettings;
  feePlans?: StudentFeePlan[];
  salaryPayments?: SalaryPayment[];
  documents?: StoredDocument[];
  documentTemplates?: DocumentTemplates;
  school: School;
  academicYear: AcademicYear;
  attendancePolicy?: AttendancePolicy;
  staffPayroll?: StaffPayrollConfig;
  staffCycleInputs?: StaffCycleInput[];
  staffAttendance?: StaffAttendanceRecord[];
  staffMembers?: StaffMember[];
  studentTimings?: StudentTiming[];
  schoolHours?: SchoolHours;
  classTimetables?: ClassTimetable[];
  classes: SchoolClass[];
  sections: Section[];
  teachers: Teacher[];
  students: Student[];
  studentAdmissionSequences?: Record<string, number>;
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
