import { createRoot } from 'react-dom/client';
import { PickerInput } from '../../src/components/ui/Primitives';
import { useState } from 'react';

function Fixture() {
  const [value, setValue] = useState('2026-10-18');
  const [submits, setSubmits] = useState(0);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setSubmits(submits + 1);
      }}
    >
      <label>
        Date
        <PickerInput type="date" value={value} onChange={(event) => setValue(event.target.value)} />
      </label>
      <label>
        Month
        <PickerInput type="month" defaultValue="2026-10" />
      </label>
      <label>
        Time
        <PickerInput type="time" defaultValue="09:15" />
      </label>
      <label>
        Schedule
        <PickerInput type="datetime-local" defaultValue="2026-10-18T09:15" />
      </label>
      <label>
        Read only
        <PickerInput type="date" value="2026-10-18" readOnly />
      </label>
      <label>
        Disabled
        <PickerInput type="date" value="2026-10-18" disabled />
      </label>
      <label>
        Custom action
        <PickerInput
          type="date"
          defaultValue="2026-10-18"
          onClick={(event) => event.preventDefault()}
        />
      </label>
      <output aria-label="Current date">{value}</output>
      <output aria-label="Form submits">{submits}</output>
    </form>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
