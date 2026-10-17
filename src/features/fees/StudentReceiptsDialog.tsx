import { useState } from 'react';
import { useSchool } from '../../app/useSchool';
import { Button, EmptyState, Modal } from '../../components/ui/Primitives';
import { allocatedPayments, installments, roster } from '../../lib/selectors';
import { displayDate, money } from '../../lib/config';
import FeeReceiptDialog from './FeeReceiptDialog';

export default function StudentReceiptsDialog({
  enrollmentId,
  onClose,
}: {
  enrollmentId: string;
  onClose: () => void;
}) {
  const state = useSchool();
  const [paymentId, setPaymentId] = useState('');
  const student = roster(state, true).find((row) => row.enrollment.id === enrollmentId)?.student;
  const schedule = installments(state, enrollmentId);
  const payments = allocatedPayments(state, enrollmentId).sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      (b.createdAt ?? '').localeCompare(a.createdAt ?? '') ||
      b.id.localeCompare(a.id),
  );
  if (paymentId) return <FeeReceiptDialog paymentId={paymentId} onClose={() => setPaymentId('')} />;
  return (
    <Modal
      open
      wide
      title="Payment receipts"
      description={
        student ? `${student.name} · ${student.admissionNumber}` : 'Recorded student payments'
      }
      onClose={onClose}
    >
      {payments.length ? (
        <div
          className="table-wrap"
          role="region"
          aria-label="Student payment receipts"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Installment</th>
                <th>Amount paid</th>
                <th>Mode / Reference</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => {
                const labels = [
                  ...new Set(
                    (payment.allocations ?? [])
                      .map(
                        (allocation) =>
                          schedule.find((item) => item.id === allocation.obligationId)?.label,
                      )
                      .filter(Boolean),
                  ),
                ];
                return (
                  <tr key={payment.id}>
                    <td>{displayDate(payment.date)}</td>
                    <td>{labels.join(', ') || 'School fees'}</td>
                    <td>
                      <strong>{money(payment.amount)}</strong>
                    </td>
                    <td>
                      {payment.method === 'Bank transfer' ? 'Bank' : payment.method}
                      {payment.reference && (
                        <small className="table-subtext">{payment.reference}</small>
                      )}
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        aria-label={`View receipt ${payment.receiptNumber ?? (payment.reference || payment.id)}`}
                        onClick={() => setPaymentId(payment.id)}
                      >
                        View receipt
                      </Button>
                      {payment.receiptNumber && (
                        <small className="table-subtext">{payment.receiptNumber}</small>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No payments recorded"
          description="Receipts will be available after a payment is recorded."
        />
      )}
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
