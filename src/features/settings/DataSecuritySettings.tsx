import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { Badge, Button, Modal, Panel } from '../../components/ui/Primitives';
import { securityFor } from '../../lib/adminSettings';
import { repository } from '../../lib/repository';
import { displayDate } from '../../lib/config';
import { getSchoolDate } from '../../lib/dates';
import { EXPORT_TYPES, exportSchoolData } from '../../lib/schoolExports';
import type { WorkspaceSecurity } from '../../types/admin';
import ActivityLog from './ActivityLog';
import { displayPreferences } from '../../lib/displayPreferences';
export default function DataSecuritySettings() {
  const state = useSchool(),
    settings = securityFor(state),
    notify = useFeedback();
  const [dialog, setDialog] = useState<'restore' | 'password' | 'logout' | null>(null),
    [error, setError] = useState(''),
    [passwordError, setPasswordError] = useState(''),
    [backupFile, setBackupFile] = useState('');
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
      <Panel title="Backup & Restore" subtitle="Keep a copy of your school records.">
        <div className="panel-padding">
          <p className="admin-preview-note">
            Backup and restore are previews. Cloud backups will work when the school data service is
            connected.
          </p>
          <dl className="admin-detail-list">
            <div>
              <dt>Last Backup</dt>
              <dd>
                {settings.lastBackup
                  ? `${displayDate(getSchoolDate(new Date(settings.lastBackup)))} · ${new Date(settings.lastBackup).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: displayPreferences().timeFormat === '12-hour' })}`
                  : 'No backup created'}
              </dd>
            </div>
            <div>
              <dt>Backup Status</dt>
              <dd>
                <Badge tone={settings.lastBackup ? 'green' : 'neutral'}>
                  {settings.backupStatus}
                </Badge>
              </dd>
            </div>
          </dl>
          <div className="admin-control-row">
            <label className="admin-toggle">
              Automatic Backup
              <input
                type="checkbox"
                role="switch"
                aria-label="Automatic Backup"
                checked={settings.automaticBackup}
                onChange={(e) => save({ automaticBackup: e.target.checked })}
              />
              <span>{settings.automaticBackup ? 'ON' : 'OFF'}</span>
            </label>
            <label className="field">
              Backup Frequency
              <select
                value={settings.backupFrequency}
                onChange={(e) =>
                  save({ backupFrequency: e.target.value as WorkspaceSecurity['backupFrequency'] })
                }
              >
                <option>Daily</option>
                <option>Weekly</option>
              </select>
            </label>
          </div>
          <div className="admin-actions">
            <Button
              onClick={() =>
                save(
                  { lastBackup: new Date().toISOString(), backupStatus: 'Preview successful' },
                  'Backup preview created.',
                )
              }
            >
              Create Backup Now
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setBackupFile('');
                setDialog('restore');
              }}
            >
              Restore Backup
            </Button>
          </div>
        </div>
      </Panel>
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
      <Panel title="Login & Session Security" subtitle="Simple access controls for school staff.">
        <div className="panel-padding">
          <p className="admin-preview-note">
            Login controls and device sessions are previews until staff accounts are connected.
          </p>
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
                <Badge tone="green">Current preview</Badge>
              </div>
            )}
            {settings.otherSessionActive && (
              <div>
                <strong>Office device</strong>
                <Badge>Sample session</Badge>
              </div>
            )}
            {!sessions && <p>No active preview sessions.</p>}
          </div>
          <div className="admin-actions">
            <Button variant="secondary" disabled={!sessions} onClick={() => setDialog('logout')}>
              Logout All Devices
            </Button>
            {settings.currentSessionActive === false && (
              <Button
                variant="ghost"
                onClick={() => save({ currentSessionActive: true }, 'Preview session resumed.')}
              >
                Continue preview
              </Button>
            )}
          </div>
        </div>
      </Panel>
      <ActivityLog />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Modal
        open={dialog === 'restore'}
        onClose={() => setDialog(null)}
        title="Restore Backup"
        description="Preview the restore flow. A connected backup service is required to restore school records."
      >
        <label className="field">
          Choose backup file
          <input
            type="file"
            accept=".json,.zip"
            onChange={(e) => setBackupFile(e.target.files?.[0]?.name ?? '')}
          />
        </label>
        {backupFile && <p>{backupFile}</p>}
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setDialog(null)}>
            Cancel
          </Button>
          <Button
            disabled={!backupFile && !settings.lastBackup}
            onClick={() => {
              notify('Restore preview completed. School records are unchanged.');
              setDialog(null);
            }}
          >
            Preview Restore
          </Button>
        </div>
      </Modal>
      <Modal
        open={dialog === 'password'}
        onClose={() => setDialog(null)}
        title="Change Password"
        description="Preview the password change form. Passwords are not stored in this workspace."
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
            notify('Password change preview completed.');
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
            <Button type="submit">Preview Change</Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={dialog === 'logout'}
        onClose={() => setDialog(null)}
        title="Logout all devices?"
        description="This signs out the sample sessions in the preview."
      >
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setDialog(null)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              save(
                { otherSessionActive: false, currentSessionActive: false },
                'Preview sessions signed out.',
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
