export interface WorkspacePreferences {
  language: 'English' | 'Hindi';
  dateFormat: 'DD-MM-YYYY' | 'DD/MM/YYYY' | 'DD MMM YYYY';
  timeFormat: '12-hour' | '24-hour';
  academicYearId: string;
  weekStartsOn: 'Monday' | 'Sunday';
  landingPage: 'Dashboard' | 'Students' | 'Attendance';
}
export interface WorkspaceSecurity {
  automaticBackup: boolean;
  backupFrequency: 'Daily' | 'Weekly';
  lastBackup?: string;
  backupStatus: 'Not created' | 'Preview successful';
  sessionTimeout: 0 | 15 | 30 | 60;
  sensitivePassword: boolean;
  otherSessionActive: boolean;
  currentSessionActive?: boolean;
}
export type AuditModule =
  | 'Students'
  | 'Staff'
  | 'Attendance'
  | 'Finance'
  | 'Academics'
  | 'Notifications'
  | 'School Settings';
export interface AuditEntry {
  id: string;
  schoolId: string;
  actor: string;
  action: string;
  module: AuditModule;
  detail: string;
  createdAt: string;
}
