import { useState } from 'react';
import type { HrAdapter, HrStaff, HrWorkspace } from '../../services/hrService';
import { HrForm, TextField } from './HrForms';
import AttendanceDayDetail from './AttendanceDayDetail';
import { formatCalendarDate } from '../../lib/displayFormat';
export default function AttendanceTimeDialog({
  adapter,
  data,
  staff,
  date,
  close,
  saved,
}: {
  adapter: HrAdapter;
  data: HrWorkspace;
  staff: HrStaff;
  date: string;
  close: () => void;
  saved: () => void;
}) {
  const day = data.attendance.find((d) => d.staffId === staff.id && d.date === date);
  const local = (value: string | undefined, fallback: string) =>
    value
      ? new Intl.DateTimeFormat('en-GB', {
          timeZone: data.timezone,
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        }).format(new Date(value))
      : fallback;
  const [kind, setKind] = useState('times');
  const [draft, setDraft] = useState({
    date,
    revision: day?.revision ?? 0,
    punchIn: local(day?.punchIn, data.settings.start),
    punchOut: local(day?.punchOut, data.settings.end),
    reason: '',
  });
  return (
    <HrForm
      title={`Correct attendance · ${staff.name}`}
      description={`${formatCalendarDate(date)} · School local time (${data.timezone ?? ''})`}
      close={close}
      submitLabel="Save correction"
      submit={async () => {
        if (draft.reason.trim().length < 5)
          throw new Error('Please give a reason for this correction.');
        await adapter.save(
          `/staff/${staff.id}/${kind === 'times' ? 'attendance-times' : 'attendance'}`,
          kind === 'times'
            ? draft
            : {
                date,
                revision: draft.revision,
                status: 'absent',
                decision: 'paid',
                unpaidUnits: 0,
                reason: draft.reason,
              },
          'PUT',
        );
        saved();
      }}
    >
      <AttendanceDayDetail
        date={date}
        day={day}
        status={day?.status ?? 'unmarked'}
        timezone={data.timezone}
      />
      <label className="field">
        Correction
        <select aria-label="Correction" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="times">Edit punch times</option>
          <option value="absent">Mark absent</option>
        </select>
      </label>
      {kind === 'times' && (
        <div className="form-grid">
          <TextField
            label="Punch-in time"
            type="time"
            value={draft.punchIn}
            onChange={(punchIn) => setDraft({ ...draft, punchIn })}
          />
          <TextField
            label="Punch-out time"
            type="time"
            value={draft.punchOut}
            onChange={(punchOut) => setDraft({ ...draft, punchOut })}
          />
        </div>
      )}
      <TextField
        label="Reason for correction"
        value={draft.reason}
        onChange={(reason) => setDraft({ ...draft, reason })}
      />
      <p className="ars-form-note">
        Working hours and attendance are recalculated using the school’s work rules. Original device
        punches remain in the audit history.
      </p>
    </HrForm>
  );
}
