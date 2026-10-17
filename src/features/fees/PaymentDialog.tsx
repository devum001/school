import FeeProgressSummary from './FeeProgressSummary';
import { useToday } from '../../app/useToday';
import { useState } from 'react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { Button, Modal } from '../../components/ui/Primitives';
import { feeSummary, installments, roster } from '../../lib/selectors';
import { money } from '../../lib/config';
import { repository } from '../../lib/repository';
import type { Payment } from '../../types/domain';
import GeneratedDocumentPreview from '../../components/shared/GeneratedDocumentPreview';
import { feeReceiptFor } from '../../lib/documentData';
import { PAYMENT_METHODS } from '../../lib/ledgerSchemas';
import { useDraftGuard } from '../academics/useDraftGuard';
import '../../styles/ledgers.css';
export default function PaymentDialog({
  enrollmentId,
  onClose,
  installmentId: initialInstallmentId,
}: {
  enrollmentId: string;
  onClose: () => void;
  installmentId?: string;
}) {
  const state = useSchool();
  const today = useToday();
  const notify = useFeedback();
  const row = roster(state, true).find((r) => r.enrollment.id === enrollmentId);
  const balance = feeSummary(state, enrollmentId);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<Payment['method']>('Cash');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(today),
    [installmentId, setInstallmentId] = useState(initialInstallmentId ?? '');
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const pending = installments(state, enrollmentId).filter((item) => item.outstanding > 0);
  const available = installmentId
    ? (pending.find((item) => item.id === installmentId)?.outstanding ?? 0)
    : balance.outstanding;
  const guard = useDraftGuard(
    !receipt && Boolean(amount || reference || date !== today || method !== 'Cash'),
    onClose,
  );
  if (!row) return null;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const paise = Math.round(Number(amount) * 100);
    if (receipt) return;
    if (!Number.isFinite(paise) || paise <= 0 || paise > available) {
      setError('Enter a positive amount within the outstanding balance.');
      return;
    }
    try {
      repository.recordPayment({
        enrollmentId,
        amount: paise,
        date,
        method,
        reference,
        installmentId: installmentId || undefined,
      });
      setReceipt(repository.getSnapshot().payments.at(-1) ?? null);
      notify('Payment recorded. All fee balances have been updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The payment could not be recorded.');
    }
  };
  return (
    <Modal
      open
      onClose={guard.confirming ? guard.keepEditing : guard.requestClose}
      title={
        guard.confirming
          ? 'Discard payment details?'
          : receipt
            ? 'Payment Successful'
            : 'Record Payment'
      }
      description={
        receipt
          ? 'Payment details and updated fee balance.'
          : `${row.student.name} · ${row.className}, Section ${row.sectionName}`
      }
    >
      {guard.confirming ? (
        <div className="modal-actions">
          <Button variant="secondary" onClick={guard.keepEditing}>
            Keep editing
          </Button>
          <Button variant="danger" onClick={guard.discard}>
            Discard changes
          </Button>
        </div>
      ) : receipt ? (
        <>
          <GeneratedDocumentPreview data={feeReceiptFor(state, receipt)} />
          <p className="panel-note">Pending amount: {money(balance.outstanding)}</p>
          <div className="modal-actions">
            <Button onClick={onClose}>Done</Button>
          </div>
        </>
      ) : (
        <form onSubmit={submit}>
          <FeeProgressSummary enrollmentId={enrollmentId} />
          {installmentId && (
            <div className="payment-balance">
              <span>Selected installment balance</span>
              <strong>{money(available)}</strong>
            </div>
          )}
          <div className="form-grid">
            <label className="field">
              Student
              <input readOnly value={row.student.name} />
            </label>
            <label className="field">
              Apply payment to
              <select
                aria-label="Apply payment to"
                value={installmentId}
                onChange={(e) => setInstallmentId(e.target.value)}
              >
                <option value="">Pending installments — earliest first</option>
                {pending.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label} · {money(item.outstanding)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Amount (₹)
              <input
                autoFocus
                aria-label="Payment amount"
                required
                type="text"
                inputMode="decimal"
                pattern="[0-9]+([.][0-9]{1,2})?"

                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </label>
            <label className="field">
              Payment method
              <select
                aria-label="Payment method"
                value={method}
                onChange={(e) => setMethod(e.target.value as Payment['method'])}
              >
                {PAYMENT_METHODS.filter((value) => value !== 'Bank transfer').map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="field span-two">
              Payment reference (optional)
              <input
                aria-label="Payment reference"
                maxLength={80}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
            <label className="field">
              Payment date
              <input
                aria-label="Payment date"
                required
                type="date"
                min={state.academicYear.start}
                max={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>
          <div className="info-banner">
            Verify the amount, date and payment mode before confirming.
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={guard.requestClose}>
              Cancel
            </Button>
            <Button type="submit">Confirm payment</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
