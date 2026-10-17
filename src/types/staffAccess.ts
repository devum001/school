export type PermissionLevel = 'No Access' | 'View' | 'Manage';
export type AccessModule =
  | 'Students'
  | 'Attendance'
  | 'Fee Management'
  | 'Academics'
  | 'Staff'
  | 'Salary'
  | 'Notifications'
  | 'School Settings';
export interface StaffRole {
  id: string;
  name: string;
  kind: 'owner' | 'admin' | 'teacher' | 'accountant' | 'office' | 'custom';
  scope: 'school' | 'assigned';
  permissions: Record<AccessModule, PermissionLevel>;
}
export interface StaffLoginAccess {
  staffId: string;
  roleId: string;
  loginAllowed: boolean;
  sectionIds: string[];
}
export interface StaffAccessSettings {
  schoolId: string;
  roles: StaffRole[];
  staff: StaffLoginAccess[];
}
