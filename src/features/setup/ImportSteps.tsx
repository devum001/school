import './import.css';
export default function ImportSteps({ step }: { step: 1 | 2 | 3 }) {
  return (
    <ol className="import-steps" aria-label="Import steps">
      {['File & options', 'Review & correct', 'Submit'].map((label, index) => (
        <li key={label} aria-current={step === index + 1 ? 'step' : undefined}>
          <span>{index + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}
