import type { WorkspacePreferences } from '../types/admin';
let preferences: Pick<WorkspacePreferences, 'language' | 'dateFormat' | 'timeFormat'> = {
  language: 'English',
  dateFormat: 'DD-MM-YYYY',
  timeFormat: '12-hour',
};
export const displayPreferences = () => preferences;
export function configureDisplay(input?: WorkspacePreferences) {
  preferences = input ?? { language: 'English', dateFormat: 'DD-MM-YYYY', timeFormat: '12-hour' };
}
