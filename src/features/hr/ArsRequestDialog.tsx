import { useState } from 'react';
import type { HrAdapter } from '../../services/hrService';
import { HrForm, TextField } from './HrForms';
import AttendanceDayDetail, { type AttendanceDay } from './AttendanceDayDetail';
import './hr-personal-calendar.css';
const reasons = [
  ['forgot-out', 'Forgot to punch out'],
  ['forgot-in', 'Forgot to punch in'],
  ['app', 'App issue'],
  ['network', 'Network issue'],
  ['other', 'Other reason'],
] as const;
export default function ArsRequestDialog({
  day,
  timezone,
  adapter,
  close,
  saved,
}: {
  day: AttendanceDay;
  timezone?: string;
  adapter: HrAdapter;
  close: () => void;
  saved: () => void;
}) {
  const [draft, setDraft] = useState({
    requestKey: crypto.randomUUID(),
    requestedPeriod: 'full-day',
    reasonCode: '',
    other: '',
  });
  return (
    <HrForm
      className="ars-request-dialog"
      title="Attendance correction (ARS)"
      description="Choose the attendance you are requesting for this day."
      submitLabel="Submit ARS"
      close={close}
      submit={async () => {
        const reason =
          draft.reasonCode === 'other'
            ? draft.other.trim()
            : reasons.find(([code]) => code === draft.reasonCode)?.[1];
        if (!reason || reason.length < 5)
          throw new Error('Select a reason, or explain Other reason in at least 5 characters.');
        await adapter.save('/attendance-requests', {
          requestKey: draft.requestKey,
          date: day.date,
          requestedPeriod: draft.requestedPeriod,
          reasonCode: draft.reasonCode,
          reason,
        });
        saved();
      }}
    >
      <AttendanceDayDetail
        date={day.date}
        day={day}
        status={day.status ?? 'invalid'}
        timezone={timezone}
      />
      <label className="field">
        ARS type
        <select
          aria-label="ARS type"
          value={draft.requestedPeriod}
          onChange={(e) => setDraft({ ...draft, requestedPeriod: e.target.value })}
        >
          <option value="full-day">Full day</option>
          <option value="first-half">First half</option>
          <option value="second-half">Second half</option>
        </select>
      </label>
      <label className="field">
        Reason
        <select
          aria-label="ARS reason"
          required
          value={draft.reasonCode}
          onChange={(e) => setDraft({ ...draft, reasonCode: e.target.value })}
        >
          <option value="" disabled>
            Select a reason
          </option>
          {reasons.map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {draft.reasonCode === 'other' && (
        <TextField
          label="Other reason"
          value={draft.other}
          onChange={(other) => setDraft({ ...draft, other })}
        />
      )}
      <p className="ars-form-note">
        {day.status === 'half-day'
          ? 'Your attendance stays Half day while this request is reviewed. Only approval changes it to the requested attendance.'
          : 'Your administrator will review this request. The missed-punch day remains Invalid until approved.'}
      </p>
    </HrForm>
  );
}
