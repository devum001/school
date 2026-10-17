import { useState } from 'react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { Button, Panel } from '../../components/ui/Primitives';
import { preferencesFor } from '../../lib/adminSettings';
import { repository } from '../../lib/repository';
import type { WorkspacePreferences } from '../../types/admin';
import { useDraftGuard } from '../academics/useDraftGuard';
export default function PreferencesSettings() {
  const state = useSchool(),
    notify = useFeedback(),
    current = preferencesFor(state);
  const [draft, setDraft] = useState(current),
    [error, setError] = useState('');
  useDraftGuard(JSON.stringify(current) !== JSON.stringify(draft), () => setDraft(current));
  const set = <K extends keyof WorkspacePreferences>(key: K, value: WorkspacePreferences[K]) =>
    setDraft((previous) => ({ ...previous, [key]: value }));
  return (
    <form
      className="admin-settings-stack"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          repository.savePreferences(draft);
          notify('Preferences saved.');
          setError('');
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'Unable to save preferences.');
        }
      }}
    >
      <Panel
        title="Regional & Display"
        subtitle="Choose how dates, times and the workspace appear."
      >
        <div className="panel-padding form-grid">
          <label className="field">
            Language
            <select
              aria-label="Language"
              value={draft.language}
              onChange={(e) => set('language', e.target.value as WorkspacePreferences['language'])}
            >
              <option>English</option>
              <option>Hindi</option>
            </select>
          </label>
          <label className="field">
            Date Format
            <select
              aria-label="Date Format"
              value={draft.dateFormat}
              onChange={(e) =>
                set('dateFormat', e.target.value as WorkspacePreferences['dateFormat'])
              }
            >
              <option>DD/MM/YYYY</option>
              <option>DD MMM YYYY</option>
            </select>
          </label>
          <label className="field">
            Time Format
            <select
              aria-label="Time Format"
              value={draft.timeFormat}
              onChange={(e) =>
                set('timeFormat', e.target.value as WorkspacePreferences['timeFormat'])
              }
            >
              <option>12-hour</option>
              <option>24-hour</option>
            </select>
          </label>
          <label className="field">
            Currency
            <input readOnly value="₹ INR" />
          </label>
          <label className="field">
            Number Format
            <input readOnly value="Indian style · 1,25,000" />
          </label>
        </div>
      </Panel>
      <Panel title="Default Context" subtitle="Set the starting context for your school workspace.">
        <div className="panel-padding form-grid">
          <label className="field">
            Default Academic Year
            <select
              aria-label="Default Academic Year"
              value={draft.academicYearId}
              onChange={(e) => set('academicYearId', e.target.value)}
            >
              <option value={state.academicYear.id}>{state.academicYear.name}</option>
            </select>
          </label>
          <label className="field">
            Week Starts On
            <select
              aria-label="Week Starts On"
              value={draft.weekStartsOn}
              onChange={(e) =>
                set('weekStartsOn', e.target.value as WorkspacePreferences['weekStartsOn'])
              }
            >
              <option>Monday</option>
              <option>Sunday</option>
            </select>
          </label>
          <label className="field">
            Default landing page
            <select
              aria-label="Default landing page"
              value={draft.landingPage}
              onChange={(e) =>
                set('landingPage', e.target.value as WorkspacePreferences['landingPage'])
              }
            >
              <option>Dashboard</option>
              <option>Students</option>
              <option>Attendance</option>
            </select>
          </label>
        </div>
      </Panel>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-save">
        <Button type="submit">Save preferences</Button>
      </div>
    </form>
  );
}
