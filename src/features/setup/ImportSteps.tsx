import './import.css';
const STEP_META = [
  { label: 'File & options', hint: 'Download template & choose workbook' },
  { label: 'Review & correct', hint: 'Check rows & fix flagged cells' },
  { label: 'Submit', hint: 'Confirm & enroll students' },
];
export default function ImportSteps({ step }: { step: 1 | 2 | 3 }) {
  return (
    <ol className="import-steps" aria-label="Import steps">
      {STEP_META.map((item, index) => {
        const number = index + 1;
        const state = step === number ? 'active' : step > number ? 'done' : 'upcoming';
        return (
          <li
            key={item.label}
            data-step-state={state}
            aria-current={step === number ? 'step' : undefined}
          >
            <span>{step > number ? '✓' : number}</span>
            <div className="import-step-copy">
              <strong>{item.label}</strong>
              <small>{item.hint}</small>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
