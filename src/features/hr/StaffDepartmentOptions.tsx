import { useCallback } from 'react';
import { z } from 'zod';
import { apiService } from '../../services/apiService';
import { useRemote } from '../live/useRemote';
export default function StaffDepartmentOptions({ schoolId }: { schoolId: string }) {
  const load = useCallback(
    async (signal: AbortSignal) =>
      z
        .array(z.string())
        .parse(await apiService.request(`/schools/${schoolId}/hr/departments`, { signal })),
    [schoolId],
  );
  const state = useRemote(load);
  return (
    <>
      <datalist id="staff-departments">
        {state.data?.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>
      {state.error && (
        <p className="panel-note">
          Department suggestions are unavailable. You can still enter the department name.
        </p>
      )}
    </>
  );
}
