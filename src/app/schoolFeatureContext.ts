import { createContext, useContext } from 'react';
import type { DemoState } from '../types/domain';
import type { NewTest } from '../lib/academics';
import type { SheetColumn, SheetRow } from '../lib/academicSheets';
import type { AttendanceStatus } from '../types/domain';
export interface SchoolFeatureData {
  state: DemoState;
  mode: 'live';
  today: string;
  selectedDate?: string;
  canViewStudentProfiles?: boolean;
  canManage: boolean;
  canCreateTest?: boolean;
  routeAllowed?: (path: string) => boolean;
  canMarkAttendance?: boolean;
  teacherScoped?: boolean;
  staffAttendanceSummary?: {
    onDuty: number;
    late: number;
    invalid: number;
    pendingRequests: number;
  };
  attendanceGate?: { required: boolean; active: boolean; onLeave?: boolean };
  canEditTest?: (id: string) => boolean;
  canMarkSubject?: (
    classId: string,
    sectionId: string,
    subjectId: string,
    subjectName?: string,
  ) => boolean;
  unavailable: string[];
  refreshDate?: (date: string) => void;
  getSnapshot: () => DemoState;
  createTest: (input: NewTest & { requestKey?: string }) => Promise<string>;
  updateTest: (id: string, input: NewTest) => Promise<void>;
  deleteTest: (id: string) => Promise<void>;
  saveMarksSheets: (
    id: string,
    sheets: { classId?: string; sectionId: string; columns: SheetColumn[]; rows: SheetRow[] }[],
  ) => Promise<void>;
  saveAttendance: (
    date: string,
    sectionId: string,
    changes: Record<string, AttendanceStatus>,
    classId?: string,
  ) => Promise<void>;
}
export const SchoolFeatureContext = createContext<SchoolFeatureData | null>(null);
export const useSchoolFeature = () => useContext(SchoolFeatureContext);
