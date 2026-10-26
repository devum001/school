import { useCallback } from 'react';
import { schoolAccessService } from '../../services/schoolAccessService';
import { useSetupList } from '../setup/useSetupList';
import { LoadState, Paging } from '../setup/SetupControls';
export default function StaffAccountPicker({
  schoolId,
  value,
  onChange,
}: {
  schoolId: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const load = useCallback(
    (signal: AbortSignal, cursor?: string) => schoolAccessService.members(schoolId, signal, cursor),
    [schoolId],
  );
  const state = useSetupList(load);
  return (
    <div>
      <LoadState {...state} retry={state.reload} />
      <label className="field">
        School login account
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Keep current link / not linked</option>
          {value && !state.data?.items.some((m) => m.userId === value) && (
            <option value={value}>Currently linked account</option>
          )}
          {state.data?.items
            .filter((m) => m.status === 'active')
            .map((m) => (
              <option key={m.id} value={m.userId}>
                {m.user?.name ?? 'School member'} · {m.user?.email ?? m.roleName}
              </option>
            ))}
        </select>
      </label>
      {state.data && <Paging {...state} nextCursor={state.data.nextCursor} />}
      <p className="panel-note">
        Choose the teacher’s active school account. The account also needs the “Own attendance and
        salary” permission.
      </p>
    </div>
  );
}
