import { titleCase } from '../../lib/displayFormat';
import { useDraftGuard } from '../academics/useDraftGuard';
import { useState, type ReactNode } from 'react';
import { Button, Modal } from '../../components/ui/Primitives';
import CalendarDateInput from '../../components/ui/CalendarDateInput';
export function HrForm({
  title,
  description,
  close,
  submit,
  children,
  submitLabel = 'Save',
}: {
  title: string;
  description: string;
  close: () => void;
  submit: () => Promise<unknown>;
  children: ReactNode;
  submitLabel?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [dirty, setDirty] = useState(false);
  const guard = useDraftGuard(dirty && !busy, close);
  return (
    <Modal
      open
      wide
      title={guard.confirming ? 'Discard changes?' : title}
      description={description}
      onClose={() => {
        if (!busy) guard.requestClose();
      }}
    >
      {guard.confirming ? (
        <div className="modal-actions">
          <Button onClick={guard.keepEditing}>Keep editing</Button>
          <Button variant="danger" onClick={guard.discard}>
            Discard changes
          </Button>
        </div>
      ) : (
        <form
          className="hr-form"
          data-unsaved={dirty}
          onChangeCapture={() => setDirty(true)}
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError('');
            try {
              await submit();
              guard.complete(close);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Unable to save.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy} className="hr-fieldset">
            {children}
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <Button type="button" variant="secondary" onClick={guard.requestClose}>
                Cancel
              </Button>
              <Button disabled={busy}>{busy ? 'Saving…' : submitLabel}</Button>
            </div>
          </fieldset>
        </form>
      )}
    </Modal>
  );
}
export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="field">
      {label}
      {type === 'date' ? (
        <CalendarDateInput
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          required={required}
          type={type}
          value={value}
          maxLength={500}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
export function AmountField({
  label,
  value,
  onChange,
  signed = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  signed?: boolean;
}) {
  return (
    <label className="field">
      {label} (₹)
      <input
        required
        type="number"
        min={signed ? undefined : 0}
        max={10000000}
        step="0.01"
        value={value / 100}
        onChange={(e) => onChange(Math.round(Number(e.target.value) * 100))}
      />
    </label>
  );
}
export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="field">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((v) => (
          <option key={v} value={v}>
            {(
              {
                none: 'Salary only — no attendance',
                manual: 'Admin marks attendance',
                punch: 'Teacher punch in / out',
                basic: 'Basic salary',
                gross: 'Gross salary',
                calendar: 'Calendar days in month',
                working: 'Working days in month',
                '30': 'Fixed 30 days',
              } as Record<string, string>
            )[v] ?? titleCase(v)}
          </option>
        ))}
      </select>
    </label>
  );
}
