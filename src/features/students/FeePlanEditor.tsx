import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Primitives';
import { installmentName } from '../../lib/feeLabels';
import { money } from '../../lib/config';
import '../../styles/ledgers.css';
import type { FeePlanDraft } from '../../lib/feePlanDraft';
export default function FeePlanEditor({
  value,
  onChange,
  required,
}: {
  value: FeePlanDraft;
  onChange: (draft: FeePlanDraft) => void;
  required: boolean;
}) {
  const total =
    value.kind === 'One Time'
      ? Math.round(Number(value.totalFee || 0) * 100)
      : value.installments.reduce(
          (sum, item) => sum + Math.round(Number(item.amount || 0) * 100),
          0,
        );
  return (
    <div className="fee-plan-editor">
      <h3>Fee setup</h3>
      <fieldset className="fee-plan-types">
        <legend>Fee Type</legend>
        {(['One Time', 'Installments'] as const).map((kind) => (
          <label key={kind}>
            <input
              type="radio"
              name="student-fee-type"
              checked={value.kind === kind}
              onChange={() =>
                onChange({
                  ...value,
                  kind,
                  installments: kind === 'One Time' ? [value.installments[0]] : value.installments,
                })
              }
            />{' '}
            {kind}
          </label>
        ))}
      </fieldset>
      <label className="field">
        Total Fee (₹)
        <input
          aria-label="Total Fee"
          required={required}
          type="text"
          inputMode="decimal"
          pattern="[0-9]+([.][0-9]{1,2})?"

          value={value.totalFee}
          onChange={(e) => onChange({ ...value, totalFee: e.target.value })}
        />
      </label>
      {value.kind === 'One Time' ? (
        <label className="field">
          Due Date
          <input
            aria-label="Fee due date"
            required={required}
            type="date"
            value={value.installments[0].dueDate}
            onChange={(e) =>
              onChange({
                ...value,
                installments: [{ ...value.installments[0], dueDate: e.target.value }],
              })
            }
          />
        </label>
      ) : (
        <>
          {value.installments.map((item, index) => (
            <div className="fee-installment-row" key={item.id ?? index}>
              <label className="field">
                {installmentName(index + 1)} Amount (₹)
                <input
                  aria-label={`Installment ${index + 1} amount`}
                  required={required}
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]+([.][0-9]{1,2})?"

                  value={item.amount}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      installments: value.installments.map((entry, i) =>
                        i === index ? { ...entry, amount: e.target.value } : entry,
                      ),
                    })
                  }
                />
              </label>
              <label className="field">
                Due Date
                <input
                  aria-label={`Installment ${index + 1} due date`}
                  required={required}
                  type="date"
                  value={item.dueDate}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      installments: value.installments.map((entry, i) =>
                        i === index ? { ...entry, dueDate: e.target.value } : entry,
                      ),
                    })
                  }
                />
              </label>
              <Button
                type="button"
                variant="ghost"
                aria-label={`Remove installment ${index + 1}`}
                disabled={value.installments.length === 1}
                onClick={() =>
                  onChange({
                    ...value,
                    installments: value.installments.filter((_, i) => i !== index),
                  })
                }
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={value.installments.length >= 60}
            onClick={() =>
              onChange({
                ...value,
                installments: [...value.installments, { amount: '', dueDate: '' }],
              })
            }
          >
            <Plus size={15} /> Add Installment
          </Button>
          <div className="fee-plan-total">
            <span>Installment total</span>
            <strong>{money(total)}</strong>
          </div>
          {total !== Math.round(Number(value.totalFee || 0) * 100) && (
            <p className="panel-note">Installment amounts must add up to Total Fee.</p>
          )}
        </>
      )}
    </div>
  );
}
