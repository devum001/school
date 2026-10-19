import SectionNavigation from '../../components/shared/SectionNavigation';
import { useSettingsSection } from './useSettingsSection';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { Badge, Button, Modal, Panel } from '../../components/ui/Primitives';
import { securityFor } from '../../lib/adminSettings';
import { repository } from '../../lib/repository';
import { EXPORT_TYPES, exportSchoolData } from '../../lib/schoolExports';
import type { WorkspaceSecurity } from '../../types/admin';
import ActivityLog from './ActivityLog';
export default function DataSecuritySettings() {
  const { section, navigation } = useSettingsSection([
    { id: 'export', label: 'Data Export' },
    { id: 'security', label: 'Login & Sessions' },
    { id: 'activity', label: 'Activity Log' },
  ]);
  const state = useSchool(),
    settings = securityFor(state),
    notify = useFeedback();
  const [dialog, setDialog] = useState<'password' | 'logout' | null>(null),
    [error, setError] = useState(''),
    [passwordError, setPasswordError] = useState('');
  const save = (patch: Partial<WorkspaceSecurity>, message = 'Settings saved.') => {
    try {
      repository.saveSecurity({ ...settings, ...patch });
      notify(message);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save settings.');
    }
  };
  const sessions =
    Number(settings.currentSessionActive !== false) + Number(settings.otherSessionActive);
  return (
    <div className="admin-settings-stack">
      <SectionNavigation {...navigation} label="Settings features" />
      {section === 'export' && (
        <Panel title="Data Export" subtitle="Download your school's current records.">
          <div className="panel-padding export-options">
            {EXPORT_TYPES.map((type) => (
              <div className="export-option" key={type}>
                <strong>{type}</strong>
                <div className="admin-actions">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      try {
                        exportSchoolData(state, type, 'Excel');
                        setError('');
                      } catch {
                        setError('Unable to export this data.');
                      }
                    }}
                    aria-label={`Export ${type} Excel`}
                  >
                    Export Excel
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => exportSchoolData(state, type, 'CSV')}
                    aria-label={`Export ${type} CSV`}
                  >
                    CSV
                  </Button>
                  {(type === 'Salary' || type === 'Fees & Payments') && (
                    <Link
                      className="text-link"
                      to={
                        type === 'Salary'
                          ? '/fees?tab=Salary+Expenses'
                          : '/fees?tab=Student+Fees&feesView=history'
                      }
                    >
                      {type === 'Salary' ? 'Salary Slip PDFs' : 'Receipt PDFs'} →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
      {section === 'security' && (
        <Panel title="Login & Session Security" subtitle="Simple access controls for school staff.">
          <div className="panel-padding">
            <div className="admin-control-row">
              <Button
                variant="secondary"
                onClick={() => {
                  setPasswordError('');
                  setDialog('password');
                }}
              >
                Change Password
              </Button>
              <label className="field">
                Auto logout after inactivity
                <select
                  aria-label="Auto logout after inactivity"
                  value={settings.sessionTimeout}
                  onChange={(e) =>
                    save({
                      sessionTimeout: Number(e.target.value) as WorkspaceSecurity['sessionTimeout'],
                    })
                  }
                >
                  <option value={0}>Off — stay signed in</option>
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={60}>1 hour</option>
                </select>
              </label>
              <label className="admin-toggle">
                Require password for sensitive changes
                <input
                  type="checkbox"
                  role="switch"
                  aria-label="Require password for sensitive changes"
                  checked={settings.sensitivePassword}
                  onChange={(e) => save({ sensitivePassword: e.target.checked })}
                />
              </label>
            </div>
            <h3>
              Active sessions · {sessions} {sessions === 1 ? 'device' : 'devices'}
            </h3>
            <div className="session-list">
              {settings.currentSessionActive !== false && (
                <div>
                  <strong>This device</strong>
                  <Badge tone="green">Current device</Badge>
                </div>
              )}
              {settings.otherSessionActive && (
                <div>
                  <strong>Office device</strong>
                  <Badge>Other device</Badge>
                </div>
              )}
              {!sessions && <p>No active sessions.</p>}
            </div>
            <div className="admin-actions">
              <Button variant="secondary" disabled={!sessions} onClick={() => setDialog('logout')}>
                Logout All Devices
              </Button>
              {settings.currentSessionActive === false && (
                <Button
                  variant="ghost"
                  onClick={() => save({ currentSessionActive: true }, 'Session resumed.')}
                >
                  Continue session
                </Button>
              )}
            </div>
          </div>
        </Panel>
      )}
      {section === 'activity' && <ActivityLog />}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Modal
        open={dialog === 'password'}
        onClose={() => setDialog(null)}
        title="Change Password"
        description="Passwords are not stored in this workspace."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const values = new FormData(e.currentTarget);
            if (values.get('newPassword') !== values.get('confirmPassword')) {
              setPasswordError('The new passwords do not match.');
              return;
            }
            e.currentTarget.reset();
            setDialog(null);
            notify('Password fields validated.');
          }}
        >
          <div className="form-grid">
            <label className="field">
              Current password
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <label className="field">
              New password
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            <label className="field">
              Confirm new password
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
          </div>
          {passwordError && (
            <p role="alert" className="form-error">
              {passwordError}
            </p>
          )}
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button type="submit">Check password</Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={dialog === 'logout'}
        onClose={() => setDialog(null)}
        title="Logout all devices?"
        description="Clear the listed device sessions."
      >
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setDialog(null)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              save(
                { otherSessionActive: false, currentSessionActive: false },
                'Device sessions cleared.',
              );
              setDialog(null);
            }}
          >
            Confirm Logout
          </Button>
        </div>
      </Modal>
    </div>
  );
}
