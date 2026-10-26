import { useState } from 'react';
import { Button } from '../../../components/ui/Primitives';
import CalendarDateInput from '../../../components/ui/CalendarDateInput';
import type { FeeDraftSummary } from '../../../services/feeOnboardingService';
export default function FeeDraftSettings({
  job,
  today,
  disabled,
  save,
}: {
  job: FeeDraftSummary['job'];
  today: string;
  disabled: boolean;
  save: (body: object) => Promise<unknown>;
}) {
  const [settings, setSettings] = useState({
    asOf: job.asOf,
    oldStart: job.oldStart,
    oldEnd: job.oldEnd,
    oldName: job.oldName,
  });
  return (
    <details className="fee-draft-period">
      <summary>Previously paid amounts & old-dues period</summary>
      <p>
        These dates describe the records you are bringing into the app. Already paid is historical
        money, not a new payment receipt. Old dues must not repeat debt already in the ledger.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(settings);
        }}
      >
        <div className="fee-form-grid">
          <label className="field">
            Balance recorded on
            <CalendarDateInput
              required
              value={settings.asOf}
              max={today}
              disabled={disabled}
              onChange={(e) => setSettings({ ...settings, asOf: e.target.value })}
            />
          </label>
          <label className="field">
            Old-dues period name
            <input
              required
              value={settings.oldName}
              maxLength={80}
              disabled={disabled}
              onChange={(e) => setSettings({ ...settings, oldName: e.target.value })}
            />
          </label>
          <label className="field">
            Old period starts
            <CalendarDateInput
              required
              value={settings.oldStart}
              disabled={disabled}
              onChange={(e) => setSettings({ ...settings, oldStart: e.target.value })}
            />
          </label>
          <label className="field">
            Old period ends
            <CalendarDateInput
              required
              value={settings.oldEnd}
              disabled={disabled}
              onChange={(e) => setSettings({ ...settings, oldEnd: e.target.value })}
            />
          </label>
        </div>
        <Button variant="secondary" disabled={disabled}>
          Save balance dates
        </Button>
      </form>
    </details>
  );
}
