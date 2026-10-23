import { Check } from 'lucide-react';
import './import.css';

const STEP_META = [
  { label: 'Upload File' },
  { label: 'Review & Correct' },
  { label: 'Submit' },
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
            <div className="import-step-pill">
              <span className="import-step-num" aria-hidden="true">
                {step > number ? <Check size={12} strokeWidth={3} /> : number}
              </span>
              <strong>{item.label}</strong>
            </div>
            {index < STEP_META.length - 1 && (
              <div
                className="import-step-divider"
                data-done={step > number ? 'true' : undefined}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
