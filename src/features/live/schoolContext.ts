import { createContext, useContext } from 'react';
import type { SchoolAccess } from '../../services/schoolAccessService';
import type { SchoolProfile } from '../../services/schoolProfileService';
import type { SetupStatus } from '../../services/schoolSetupService';
export interface SchoolContextValue {
  schoolId: string;
  access: SchoolAccess;
  profile: SchoolProfile | null;
  status: SetupStatus;
  reload: () => void;
}
export const SchoolContext = createContext<SchoolContextValue | null>(null);
export function useLiveSchool() {
  const context = useContext(SchoolContext);
  if (!context) throw new Error('A verified school context is required.');
  return context;
}
