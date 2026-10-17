import { Modal, Button } from '../../components/ui/Primitives';
import GeneratedDocumentPreview from '../../components/shared/GeneratedDocumentPreview';
import { feeReceiptFor } from '../../lib/documentData';
import { useSchool } from '../../app/useSchool';
export default function FeeReceiptDialog({
  paymentId,
  onClose,
}: {
  paymentId: string;
  onClose: () => void;
}) {
  const state = useSchool(),
    payment = state.payments.find(
      (item) => item.schoolId === state.school.id && item.id === paymentId,
    );
  if (!payment) return null;
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Fee Receipt"
      description={payment.receiptNumber ?? 'Historical transaction'}
    >
      <GeneratedDocumentPreview data={feeReceiptFor(state, payment)} />
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
