import { useCallback, useState } from 'react';
import type { HrAdapter, HrStaff, HrWorkspace } from '../../services/hrService';
import { LoadingOverlay } from '../../components/ui/Primitives';
import { HrForm, TextField } from './HrForms';
import AttendanceDayDetail from './AttendanceDayDetail';
import { useRemote } from '../live/useRemote';
import './manual-attendance.css';
const options = [
  ['in', 'Punch-in only'],
  ['out', 'Punch-out only'],
  ['both', 'Both times'],
  ['absent', 'Mark absent'],
] as const;
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
  saved: (date?: string) => void;
}) {
  const [selectedDate, setDate] = useState(date);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(selectedDate);
  const month = validDate ? selectedDate.slice(0, 7) : date.slice(0, 7);
  const load = useCallback(
    (signal: AbortSignal) =>
      month === date.slice(0, 7) ? Promise.resolve(data) : adapter.load(month, false, signal),
    [adapter, data, date, month],
  );
  const state = useRemote(load);
  const day = state.data?.attendance.find((d) => d.staffId === staff.id && d.date === selectedDate);
  const [entry, setEntry] = useState<{
    date: string;
    kind?: string;
    punchIn?: string;
    punchOut?: string;
  }>({ date });
  const [reason, setReason] = useState('');
  const local = (value: string | undefined, fallback: string) =>
    value
      ? new Intl.DateTimeFormat('en-GB', {
          timeZone: data.timezone,
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        }).format(new Date(value))
      : fallback;
  const current = entry.date === selectedDate ? entry : { date: selectedDate };
  const kind = current.kind ?? (day?.punchIn ? (day.punchOut ? 'both' : 'out') : 'in');
  const punchIn =
    current.punchIn ??
    local(
      day?.punchIn,
      selectedDate === data.today ? (data.schoolTime ?? data.settings.start) : data.settings.start,
    );
  const punchOut =
    current.punchOut ??
    local(
      day?.punchOut,
      selectedDate === data.today ? (data.schoolTime ?? data.settings.end) : data.settings.end,
    );
  const update = (patch: Partial<typeof entry>) =>
    setEntry({ ...current, ...patch, date: selectedDate });
  return (
    <HrForm
      title={`Mark / correct attendance · ${staff.name}`}
      description={`Record attendance on behalf of this staff member. Times use the school timezone (${data.timezone}).`}
      close={close}
      submitLabel={
        kind === 'both'
          ? 'Save both times'
          : kind === 'absent'
            ? 'Mark absent'
            : kind === 'in'
              ? 'Save punch-in'
              : 'Save punch-out'
      }
      submit={async () => {
        if (!state.data || state.loading) throw new Error('Please wait for attendance to load.');
        if (!validDate || selectedDate > data.today || selectedDate < staff.joinedOn)
          throw new Error('Choose a date from the joining date through today.');
        await adapter.save(
          `/staff/${staff.id}/${kind === 'absent' ? 'attendance' : 'attendance-times'}`,
          {
            date: selectedDate,
            revision: day?.revision ?? 0,
            reason: reason.trim(),
            ...(kind === 'absent'
              ? { status: 'absent', decision: 'paid', unpaidUnits: 0 }
              : {
                  ...(['in', 'both'].includes(kind) ? { punchIn } : {}),
                  ...(['out', 'both'].includes(kind) ? { punchOut } : {}),
                }),
          },
          'PUT',
        );
        saved(selectedDate);
      }}
    >
      <TextField label="Attendance date" type="date" value={selectedDate} onChange={setDate} />
      <LoadingOverlay local loading={state.loading} label="Loading attendance…">
        <AttendanceDayDetail
          date={validDate ? selectedDate : date}
          day={day}
          status={day?.status ?? 'unmarked'}
          timezone={data.timezone}
        />
        <fieldset className="manual-attendance-options">
          <legend>What would you like to record?</legend>
          {options.map(([value, label]) => (
            <label key={value} className={kind === value ? 'selected' : ''}>
              <input
                type="radio"
                name="manual-attendance-kind"
                value={value}
                checked={kind === value}
                onChange={() => update({ kind: value })}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <div className="form-grid">
          {['in', 'both'].includes(kind) && (
            <TextField
              label="Punch-in time"
              type="time"
              value={punchIn}
              onChange={(value) => update({ punchIn: value })}
            />
          )}
          {['out', 'both'].includes(kind) && (
            <TextField
              label="Punch-out time"
              type="time"
              value={punchOut}
              onChange={(value) => update({ punchOut: value })}
            />
          )}
        </div>
        <p className="manual-attendance-hint">
          {kind === 'in'
            ? 'An open punch-in today shows the teacher as on duty. They can punch out from their own account.'
            : kind === 'out'
              ? 'This records departure and keeps any existing arrival time. If arrival is missing, the day stays Invalid until corrected.'
              : kind === 'both'
                ? 'Arrival and departure are saved together; the school’s late and half-day rules apply.'
                : 'This marks an absence. Salary changes remain a separate decision.'}
        </p>
      </LoadingOverlay>
      <TextField label="Comment (optional)" required={false} value={reason} onChange={setReason} />
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      <p className="ars-form-note">
        Changes are attributed to your administrator account. Original device punches remain in the
        audit history.
      </p>
    </HrForm>
  );
}
