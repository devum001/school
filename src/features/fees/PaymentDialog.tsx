import { useToday } from '../../app/useToday';
import { useState } from 'react';
import { Receipt, CheckCircle2 } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { Badge, Button, Modal } from '../../components/ui/Primitives';
import { feeSummary, roster } from '../../lib/selectors';
import { money, displayDate } from '../../lib/config';
import { repository } from '../../lib/repository';
import type { Payment } from '../../types/domain';
export default function PaymentDialog({
  enrollmentId,
  onClose,
}: {
  enrollmentId: string;
  onClose: () => void;
}) {
  const state = useSchool();
  const today = useToday();
  const notify = useFeedback();
  const row = roster(state, true).find((r) => r.enrollment.id === enrollmentId);
  const balance = feeSummary(state, enrollmentId);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<Payment['method']>('Bank transfer');
  const [reference, setReference] = useState(
    () => `WBA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
  );
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<Payment | null>(null);
  if (!row) return null;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const paise = Math.round(Number(amount) * 100);
    if (!Number.isFinite(paise) || paise <= 0 || paise > balance.outstanding) {
      setError('Enter a positive amount within the outstanding balance.');
      return;
    }
    try {
      repository.recordPayment({ enrollmentId, amount: paise, date: today, method, reference });
      setReceipt(repository.getSnapshot().payments.at(-1) ?? null);
      notify('Payment recorded. All fee balances have been updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The payment could not be recorded.');
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={receipt ? 'Payment recorded' : 'Record a payment'}
      description={
        receipt
          ? 'Payment details and updated fee balance.'
          : `${row.student.name} · ${row.className}, Section ${row.sectionName}`
      }
    >
      {receipt ? (
        <>
          <div className="receipt printable">
            <div className="receipt-top">
              <Receipt size={28} />
              <Badge tone="green">
                <CheckCircle2 size={13} />
                Payment recorded
              </Badge>
            </div>
            <h2>{state.school.name}</h2>
            <p>PAYMENT RECEIPT</p>
            <dl>
              <div>
                <dt>Student</dt>
                <dd>{row.student.name}</dd>
              </div>
              <div>
                <dt>Admission number</dt>
                <dd>{row.student.admissionNumber}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{displayDate(receipt.date)}</dd>
              </div>
              <div>
                <dt>Reference</dt>
                <dd>{receipt.reference}</dd>
              </div>
              <div>
                <dt>Method</dt>
                <dd>{receipt.method}</dd>
              </div>
              <div className="receipt-total">
                <dt>Amount recorded</dt>
                <dd>{money(receipt.amount)}</dd>
              </div>
              <div>
                <dt>Remaining balance</dt>
                <dd>{money(balance.outstanding)}</dd>
              </div>
            </dl>
            <p>Please retain this acknowledgement for your records.</p>
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => window.print()}>
              Print receipt
            </Button>
            <Button onClick={onClose}>Done</Button>
          </div>
        </>
      ) : (
        <form onSubmit={submit}>
          <div className="payment-balance">
            <span>Outstanding balance</span>
            <strong>{money(balance.outstanding)}</strong>
          </div>
          <div className="form-grid">
            <label className="field">
              Amount (₹)
              <input
                autoFocus
                aria-label="Payment amount"
                required
                type="number"
                step="0.01"
                min="0.01"
                max={balance.outstanding / 100}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </label>
            <label className="field">
              Payment method
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as Payment['method'])}
              >
                <option>Bank transfer</option>
                <option>Cash</option>
                <option>UPI</option>
              </select>
            </label>
            <label className="field span-two">
              Payment reference
              <input
                required
                maxLength={80}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
          </div>
          <div className="info-banner">
            Payment date: {displayDate(today)}. Please verify the amount and reference before
            saving.
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              <Receipt size={16} />
              Confirm payment
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
