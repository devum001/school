import { Check } from 'lucide-react';
import './import.css';

const STEP_META = [
  { label: 'Upload File' },
  { label: 'Review & Correct' },
  { label: 'Submit' },
];

export default function ImportSteps({
  step,
  validated = false,
}: {
  step: 1 | 2 | 3;
  validated?: boolean;
}) {
  return (
    <div className="import-stepper-wrap" data-purpose="compact-stepper">
      <ol className="import-steps" aria-label="Import steps">
        {STEP_META.map((item, index) => {
          const number = index + 1;
          const isDone = step > number;
          const isActive = step === number;
          const state = isActive ? 'active' : isDone ? 'done' : 'upcoming';
          const showCheck = isDone || (isActive && number === 1 && validated);
          return (
            <li
              key={item.label}
              data-step-state={state}
              aria-current={isActive ? 'step' : undefined}
            >
              <div className="import-step-pill">
                <span className="import-step-num" aria-hidden="true">
                  {showCheck ? <Check size={11} strokeWidth={3} /> : number}
                </span>
                <strong>{item.label}</strong>
              </div>
              {index < STEP_META.length - 1 && (
                <div
                  className="import-step-divider"
                  data-done={isDone ? 'true' : undefined}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
