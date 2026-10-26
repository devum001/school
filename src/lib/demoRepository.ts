import { applyClassSetup, type ClassSetupRow } from './classSetup';
import { saveClassSubjects } from './classSubjects';
import { saveMarksSheet, type SheetColumn, type SheetRow } from './academicSheets';
import type { ClassSubject } from '../types/domain';
import { hasStoredDocumentPresentation } from './recordedDocuments';
import { decodeSchoolStorage, encodeSchoolStorage } from './schoolStorage';
import { z } from 'zod';
import {
  preferencesSchema,
  securitySchema,
  auditSchema,
  savePreferences,
  saveSecurity,
  withAudit,
} from './adminSettings';
import { configureDisplay } from './displayPreferences';
import type { WorkspacePreferences, WorkspaceSecurity } from '../types/admin';
import {
  documentTemplatesSchema,
  paymentRecordSchema,
  salaryPaymentSchema,
  storedDocumentSchema,
  studentFeePlanSchema,
} from './ledgerSchemas';
import { recordSalaryPayment } from './financeTransactions';
import { saveFeePlan } from './feePlans';
import { saveDocumentTemplates } from './documentData';
import { saveEntityDocument, deleteEntityDocument } from './entityDocuments';
import type {
  DocumentTemplates,
  FeePlanInput,
  RecordSalaryPaymentInput,
  StoredDocument,
} from '../types/ledger';
import {
  staffAccessSettingsSchema,
  saveStaffRole,
  deleteStaffRole,
  saveStaffLoginAccess,
} from './staffAccess';
import type { StaffRole, StaffLoginAccess } from '../types/staffAccess';
import { communicationStateSchema } from './communicationConfig';
import {
  reconcileCommunication,
  saveCommunicationSettings,
  dispatchCommunication,
  createNotice,
  publishCommunication,
  cancelScheduledNotice,
} from './communication';
import type { CommunicationSettings, NoticeInput } from '../types/communication';
import { staffCycleInputSchema } from './staffPayroll';
import { staffAttendanceSchema, saveStaffAttendance } from './staffAttendance';
import type {
  AttendancePolicy,
  AttendanceStatus,
  DemoState,
  Payment,
  School,
  StaffPayrollConfig,
  TimetableSlot,
  SchoolWeekday,
  SchoolHours,
} from '../types/domain';
import {
  schoolProfileSchema,
  attendancePolicySchema,
  saveSchoolProfile,
  saveAttendancePolicy,
  staffPayrollSchema,
  saveStaffPayroll,
  defaultStaffPayroll,
} from './settings';
import {
  studentTimingRecordSchema,
  classTimetableSchema,
  saveStudentTiming,
  deleteStudentTiming,
  saveClassTimetable,
  clearClassTimetable,
  type StudentTimingInput,
} from './studentTimings';
import { appMode } from '../services/runtimeConfig';
import { createSeed } from '../mocks/seed';
import { schoolHoursSchema, saveSchoolHours } from './schoolHours';
import { importStudents } from './studentImport';
import type { ExcelCell } from './xlsx';
import {
  staffMemberSchema,
  saveStaffDepartment,
  saveStaffDesignation,
  deleteStaffDepartment,
  deleteStaffDesignation,
  saveStaffMember,
  type StaffInput,
} from './staffStructure';
import {
  schoolClassSchema,
  saveSchoolClass,
  saveSchoolSection,
  deleteSchoolClass,
  deleteSchoolSection,
  type ClassInput,
  type SectionInput,
} from './classStructure';
import { mergeAttendance, restoreSchoolState } from '../mocks/restore';
import { getSchoolDate } from './dates';
import {
  createTest,
  updateTest,
  deleteTest,
  saveTestMarks,
  examinationSchema,
  examResultSchema,
  type NewTest,
  type MarksEntry,
} from './academics';
import {
  saveStudent,
  deleteStudent,
  saveTeacher,
  deleteTeacher,
  studentSchema,
  teacherSchema,
  enrollmentSchema,
  sectionSchema,
  obligationSchema,
  type StudentInput,
  type TeacherInput,
} from './management';
import { STORAGE_KEY } from './config';
import { refreshPresentationCopy } from './presentation';
import {
  attendanceStatusSchema,
  dispatchNotifications,
  recordPayment,
  saveAttendance,
} from './operations';
const savedSchema = z.object({
  preferences: preferencesSchema.optional().catch(undefined),
  security: securitySchema.optional().catch(undefined),
  auditLog: z.array(auditSchema).optional().catch([]),
  version: z.literal(1),
  communication: communicationStateSchema.optional(),
  staffAccess: staffAccessSettingsSchema.optional().catch(undefined),
  feePlans: z.array(studentFeePlanSchema).optional(),
  salaryPayments: z.array(salaryPaymentSchema).optional(),
  documents: z.array(storedDocumentSchema).optional(),
  documentTemplates: documentTemplatesSchema.optional(),
  school: schoolProfileSchema
    .partial()
    .required({ name: true, city: true, motto: true })
    .extend({ id: z.string() })
    .optional(),
  attendancePolicy: attendancePolicySchema.optional(),
  staffPayroll: staffPayrollSchema.optional(),
  staffMembers: z.array(staffMemberSchema).optional().catch([]),
  staffCycleInputs: z.array(staffCycleInputSchema).optional().catch([]),
  staffAttendance: z.array(staffAttendanceSchema).optional().catch([]),
  studentTimings: z.array(studentTimingRecordSchema).optional().catch([]),
  schoolHours: schoolHoursSchema.optional().catch(undefined),
  classTimetables: z.array(classTimetableSchema).optional().catch([]),
  students: z.array(studentSchema).optional(),
  studentAdmissionSequences: z.record(z.string(), z.number().int().nonnegative()).optional(),
  enrollments: z.array(enrollmentSchema).optional(),
  teachers: z.array(teacherSchema).optional(),
  sections: z.array(sectionSchema).optional(),
  classes: z.array(schoolClassSchema).optional(),
  obligations: z.array(obligationSchema).optional(),
  exams: z.array(examinationSchema).optional(),
  results: z.array(examResultSchema).optional(),
  attendance: z.array(
    z.object({
      schoolId: z.string(),
      enrollmentId: z.string(),
      date: z.iso.date(),
      status: attendanceStatusSchema,
    }),
  ),
  payments: z.array(paymentRecordSchema),
  notifications: z.array(
    z.object({
      id: z.string(),
      schoolId: z.string(),
      enrollmentId: z.string(),
      date: z.iso.date(),
      attendanceDate: z.iso.date(),
      message: z.string(),
      status: z.enum(['simulated-success', 'simulated-failure']),
    }),
  ),
  activities: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      detail: z.string(),
      date: z.string(),
      kind: z.enum(['attendance', 'payment', 'notification']),
    }),
  ),
});
export interface SchoolRepository {
  saveMarksSheets: (
    examId: string,
    sheets: { classId?: string; sectionId: string; columns: SheetColumn[]; rows: SheetRow[] }[],
  ) => void;
  saveClassSubjects: (classId: string, subjects: ClassSubject[]) => void;
  saveMarksSheet: (
    examId: string,
    sectionId: string,
    columns: SheetColumn[],
    rows: SheetRow[],
  ) => void;
  savePreferences: (input: WorkspacePreferences) => void;
  saveSecurity: (input: WorkspaceSecurity) => void;
  refreshCommunication: (date?: string) => void;
  saveCommunicationSettings: (input: CommunicationSettings) => void;
  dispatchCommunication: (ids: string[]) => void;
  createNotice: (input: NoticeInput) => void;
  publishCommunication: (examId: string, results: boolean) => void;
  cancelScheduledNotice: (id: string) => void;
  getSnapshot: () => DemoState;
  saveFeePlan: (enrollmentId: string, input: FeePlanInput) => void;
  recordSalaryPayment: (input: RecordSalaryPaymentInput) => void;
  saveDocumentTemplates: (input: DocumentTemplates) => void;
  saveEntityDocument: (
    input: Omit<StoredDocument, 'id' | 'schoolId' | 'uploadedAt' | 'uploadedBy'>,
  ) => void;
  deleteEntityDocument: (id: string) => void;
  saveStaffRole: (input: StaffRole) => void;
  deleteStaffRole: (id: string) => void;
  saveStaffLoginAccess: (input: StaffLoginAccess) => void;
  subscribe: (listener: () => void) => () => void;
  saveAttendance: (
    date: string,
    sectionId: string,
    changes: Record<string, AttendanceStatus>,
  ) => void;
  recordPayment: (input: Omit<Payment, 'id' | 'schoolId'>) => void;
  dispatchNotifications: (ids: string[], date: string) => void;
  createTest: (input: NewTest) => string;
  saveTestMarks: (examId: string, entries: MarksEntry[]) => void;
  saveStudent: (input: StudentInput, studentId?: string) => void;
  importStudents: (scopeId: string, grid: ExcelCell[][]) => void;
  deleteStudent: (studentId: string) => void;
  saveTeacher: (input: TeacherInput, teacherId?: string) => void;
  deleteTeacher: (teacherId: string) => void;
  updateTest: (examId: string, input: NewTest) => void;
  deleteTest: (examId: string) => void;
  reset: () => void;
  setupClasses: (rows: ClassSetupRow[]) => void;
  saveSchoolClass: (input: ClassInput, id?: string) => void;
  saveSchoolSection: (input: SectionInput, id?: string) => void;
  deleteSchoolClass: (id: string) => void;
  deleteSchoolSection: (id: string) => void;
  saveSchoolProfile: (input: Omit<School, 'id'>) => void;
  saveSchoolDetails: (input: Omit<School, 'id'>, hours?: SchoolHours) => void;
  saveAttendancePolicy: (input: AttendancePolicy) => void;
  saveStaffPayroll: (input: StaffPayrollConfig) => void;
  saveStaffDepartment: (name: string, id?: string) => void;
  saveStaffDesignation: (departmentId: string, name: string, id?: string) => void;
  deleteStaffDepartment: (id: string) => void;
  deleteStaffDesignation: (departmentId: string, id: string) => void;
  saveStaffMember: (input: StaffInput, id?: string) => void;
  saveStaffAttendance: (date: string, changes: Record<string, AttendanceStatus>) => void;
  saveStudentTiming: (input: StudentTimingInput, timingId?: string) => void;
  deleteStudentTiming: (timingId: string) => void;
  saveClassTimetable: (
    sectionId: string,
    timingId: string,
    day: SchoolWeekday,
    slots: TimetableSlot[],
  ) => void;
  clearClassTimetable: (sectionId: string, timingId: string, day: SchoolWeekday) => void;
}
let state = createSeed();
try {
  const raw = appMode === 'demo' ? localStorage.getItem(STORAGE_KEY) : null;
  if (raw) {
    const decoded = decodeSchoolStorage(raw);
    const saved = savedSchema.parse(decoded);
    state = refreshPresentationCopy(restoreSchoolState(state, saved));
    if (hasStoredDocumentPresentation(decoded)) {
      try {
        localStorage.setItem(STORAGE_KEY, encodeSchoolStorage(saved));
      } catch {
        // Keep all loaded records usable; the next successful save also removes old presentation copies.
      }
    }
  }
} catch {
  /* An unavailable or incompatible browser cache starts a fresh demo. */
}
const listeners = new Set<() => void>();
if (appMode === 'demo') configureDisplay(state.preferences);
state = reconcileCommunication(state);
let seededDate = getSchoolDate();
let dayTimer: ReturnType<typeof setInterval> | undefined;
function refreshPresentationDay() {
  const refreshed = reconcileCommunication(state);
  if (JSON.stringify(refreshed.communication) !== JSON.stringify(state.communication)) {
    try {
      commit(refreshed);
    } catch {
      // Background refresh must not crash navigation; explicit saves surface storage errors.
      return;
    }
  }
  const today = getSchoolDate();
  if (today === seededDate) return;
  const fresh = createSeed(today);
  state = {
    ...state,
    attendance: mergeAttendance(fresh.attendance, state.attendance).filter((r) =>
      state.enrollments.some((e) => e.id === r.enrollmentId),
    ),
  };
  seededDate = today;
  state = reconcileCommunication(state, today);
  listeners.forEach((listener) => listener());
}
function commit(next: DemoState) {
  if (appMode === 'live')
    throw new Error(
      'Live changes require the school API. Browser demo storage is unavailable in live mode.',
    );
  next = reconcileCommunication(next);
  next = withAudit(state, next);
  try {
    localStorage.setItem(
      STORAGE_KEY,
      encodeSchoolStorage({
        version: next.version,
        preferences: next.preferences,
        security: next.security,
        auditLog: next.auditLog,
        communication: next.communication,
        staffAccess: next.staffAccess,
        feePlans: next.feePlans,
        salaryPayments: next.salaryPayments,
        documents: next.documents,
        documentTemplates: next.documentTemplates,
        school: next.school,
        attendancePolicy: next.attendancePolicy,
        staffPayroll: next.staffPayroll,
        staffMembers: next.staffMembers,
        staffCycleInputs: next.staffCycleInputs,
        staffAttendance: next.staffAttendance,
        studentTimings: next.studentTimings,
        schoolHours: next.schoolHours,
        classTimetables: next.classTimetables,
        students: next.students,
        studentAdmissionSequences: next.studentAdmissionSequences,
        enrollments: next.enrollments,
        teachers: next.teachers,
        sections: next.sections,
        classes: next.classes,
        obligations: next.obligations,
        attendance: next.attendance,
        payments: next.payments,
        notifications: next.notifications,
        activities: next.activities,
        exams: next.exams,
        results: next.results,
      }),
    );
  } catch {
    throw new Error(
      'Unable to save in browser storage. Your previous records are unchanged. Do not clear browser data; please try again or export your records.',
    );
  }
  state = next;
  configureDisplay(state.preferences);
  listeners.forEach((l) => l());
}
export const repository: SchoolRepository = {
  saveMarksSheets: (id, sheets) =>
    commit(
      sheets.reduce(
        (next, sheet) =>
          saveMarksSheet(next, id, sheet.sectionId, sheet.columns, sheet.rows, sheet.classId),
        state,
      ),
    ),
  saveClassSubjects: (id, subjects) => commit(saveClassSubjects(state, id, subjects)),
  saveMarksSheet: (id, section, columns, rows) =>
    commit(saveMarksSheet(state, id, section, columns, rows)),
  savePreferences: (input) => commit(savePreferences(state, input)),
  saveSecurity: (input) => commit(saveSecurity(state, input)),
  refreshCommunication: (date) => {
    const next = reconcileCommunication(state, date);
    if (JSON.stringify(next.communication) !== JSON.stringify(state.communication)) commit(next);
  },
  saveCommunicationSettings: (input) => commit(saveCommunicationSettings(state, input)),
  dispatchCommunication: (ids) => commit(dispatchCommunication(state, ids)),
  createNotice: (input) => commit(createNotice(state, input)),
  publishCommunication: (id, results) => commit(publishCommunication(state, id, results)),
  cancelScheduledNotice: (id) => commit(cancelScheduledNotice(state, id)),
  getSnapshot: () => state,
  subscribe: (listener) => {
    listeners.add(listener);
    if (listeners.size === 1) {
      refreshPresentationDay();
      dayTimer = setInterval(refreshPresentationDay, 30_000);
      window.addEventListener('focus', refreshPresentationDay);
      document.addEventListener('visibilitychange', refreshPresentationDay);
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        clearInterval(dayTimer);
        window.removeEventListener('focus', refreshPresentationDay);
        document.removeEventListener('visibilitychange', refreshPresentationDay);
      }
    };
  },
  saveAttendance: (date, section, changes) =>
    commit(reconcileCommunication(saveAttendance(state, date, section, changes), date)),
  recordPayment: (input) => commit(recordPayment(state, input)),
  recordSalaryPayment: (input) => commit(recordSalaryPayment(state, input)),
  saveFeePlan: (enrollmentId, input) => commit(saveFeePlan(state, enrollmentId, input)),
  saveDocumentTemplates: (input) => commit(saveDocumentTemplates(state, input)),
  saveEntityDocument: (input) => commit(saveEntityDocument(state, input)),
  deleteEntityDocument: (id) => commit(deleteEntityDocument(state, id)),
  dispatchNotifications: (ids, date) => commit(dispatchNotifications(state, ids, date)),
  createTest: (input) => {
    const next = createTest(state, input);
    commit(next);
    return next.exams[next.exams.length - 1].id;
  },
  saveTestMarks: (examId, entries) => commit(saveTestMarks(state, examId, entries)),
  saveStudent: (input, id) => commit(saveStudent(state, input, id)),
  saveStaffRole: (input) => commit(saveStaffRole(state, input)),
  deleteStaffRole: (id) => commit(deleteStaffRole(state, id)),
  saveStaffLoginAccess: (input) => commit(saveStaffLoginAccess(state, input)),
  importStudents: (scopeId, grid) => commit(importStudents(state, scopeId, grid)),
  deleteStudent: (id) => commit(deleteStudent(state, id)),
  saveTeacher: (input, id) => commit(saveTeacher(state, input, id)),
  deleteTeacher: (id) => {
    if (
      state.classTimetables?.some(
        (table) =>
          table.schoolId === state.school.id && table.slots.some((slot) => slot.teacherId === id),
      )
    )
      throw new Error('Remove this teacher’s timetable assignments before deleting the teacher.');
    const next = deleteTeacher(state, id);
    commit({
      ...next,
      staffMembers: next.staffMembers?.filter(
        (member) => member.schoolId !== state.school.id || member.teacherId !== id,
      ),
    });
  },
  updateTest: (id, input) => commit(updateTest(state, id, input)),
  deleteTest: (id) => commit(deleteTest(state, id)),
  reset: () => commit(createSeed()),
  setupClasses: (rows) => commit(applyClassSetup(state, rows)),
  saveSchoolClass: (input, id) => commit(saveSchoolClass(state, input, id)),
  saveSchoolSection: (input, id) => commit(saveSchoolSection(state, input, id)),
  deleteSchoolClass: (id) => commit(deleteSchoolClass(state, id)),
  deleteSchoolSection: (id) => commit(deleteSchoolSection(state, id)),
  saveSchoolProfile: (input) => commit(saveSchoolProfile(state, input)),
  saveSchoolDetails: (input, hours) => {
    const next = saveSchoolProfile(state, input);
    commit(hours ? saveSchoolHours(next, hours) : next);
  },
  saveAttendancePolicy: (input) => commit(saveAttendancePolicy(state, input)),
  saveStaffPayroll: (input) => commit(saveStaffPayroll(state, input)),
  saveStaffDepartment: (name, id) =>
    commit(saveStaffDepartment(state, state.staffPayroll ?? defaultStaffPayroll, name, id)),
  saveStaffDesignation: (departmentId, name, id) =>
    commit(
      saveStaffDesignation(
        state,
        state.staffPayroll ?? defaultStaffPayroll,
        departmentId,
        name,
        id,
      ),
    ),
  deleteStaffDepartment: (id) =>
    commit(deleteStaffDepartment(state, state.staffPayroll ?? defaultStaffPayroll, id)),
  deleteStaffDesignation: (departmentId, id) =>
    commit(
      deleteStaffDesignation(state, state.staffPayroll ?? defaultStaffPayroll, departmentId, id),
    ),
  saveStaffMember: (input, id) =>
    commit(saveStaffMember(state, state.staffPayroll ?? defaultStaffPayroll, input, id)),
  saveStaffAttendance: (date, changes) =>
    commit(saveStaffAttendance(state, state.staffPayroll ?? defaultStaffPayroll, date, changes)),
  saveStudentTiming: (input, id) => commit(saveStudentTiming(state, input, id)),
  deleteStudentTiming: (id) => commit(deleteStudentTiming(state, id)),
  saveClassTimetable: (sectionId, timingId, day, slots) =>
    commit(saveClassTimetable(state, sectionId, timingId, day, slots)),
  clearClassTimetable: (sectionId, timingId, day) =>
    commit(clearClassTimetable(state, sectionId, timingId, day)),
};
