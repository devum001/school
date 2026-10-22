import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingOverlay } from '../../components/ui/Primitives';
import { schoolAccessService } from '../../services/schoolAccessService';
import { liveHrAdapter } from '../../services/hrService';
import { titleCase } from '../../lib/displayFormat';
import { useRemote } from '../live/useRemote';
import { HrForm } from './HrForms';

export default function StaffLoginDialog({
  schoolId,
  staff,
  permissions,
  close,
  saved,
}: {
  schoolId: string;
  staff: { id: string; name: string; email?: string };
  permissions: readonly string[];
  close: () => void;
  saved: () => void;
}) {
  const [email, setEmail] = useState(staff.email || '');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const load = useCallback(
    (signal: AbortSignal) => schoolAccessService.allRoles(schoolId, signal),
    [schoolId],
  );
  const state = useRemote(load);
  const roles =
    state.data?.filter(
      (r) => r.builtinKey !== 'owner' && r.permissions.every((p) => permissions.includes(p)),
    ) ?? [];
  return (
    <HrForm
      submitLabel="Create login"
      title={`Enable login · ${titleCase(staff.name)}`}
      description="Create a school login and link it to this staff member in one step."
      close={close}
      submit={async () => {
        await liveHrAdapter(schoolId).save(`/staff/${staff.id}/login`, {
          email: email.trim(),
          password,
          roleId,
        });
        saved();
      }}
    >
      <LoadingOverlay
        local
        loading={!state.data && !state.error}
        size="lg"
        label="Loading school roles…"
        message="Loading school roles…"
      >
        <div className="form-grid">
          <label className="field">
            Login email
            <input
              type="email"
              autoComplete="off"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            Password
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={64}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="field">
            School role
            <select required value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">Select a role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {titleCase(r.name)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {state.error && (
          <p role="alert" className="form-error">
            {state.error}
          </p>
        )}
        <p className="panel-note">
          For teacher punching, choose a role with “Own attendance and salary”. Share credentials
          privately. An existing account's password will never be replaced here.
        </p>
        <Link className="text-link" to="/settings?tab=Roles+%26+Permissions&section=roles">
          Manage school roles
        </Link>
      </LoadingOverlay>
    </HrForm>
  );
}
