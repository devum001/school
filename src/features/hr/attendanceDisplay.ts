import type { HrWorkspace } from '../../services/hrService';
export const wasLate = (day: HrWorkspace['attendance'][number]) =>
  day.late ?? day.status === 'late';
