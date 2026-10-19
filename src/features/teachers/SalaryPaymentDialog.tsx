import { useState } from 'react';
import { useSchool } from '../../app/useSchool';
import { useToday } from '../../app/useToday';
import { useFeedback } from '../../app/useFeedback';
import { PickerInput, Button, Modal } from '../../components/ui/Primitives';
import GeneratedDocumentPreview from '../../components/shared/GeneratedDocumentPreview';
import { defaultStaffPayroll } from '../../lib/settings';
import { staffDirectory } from '../../lib/staffStructure';
import { staffCycleSummary } from '../../lib/staffPayroll';
import { salarySlipFor } from '../../lib/documentData';
import { salaryPaymentFor } from '../../lib/financeTransactions';
import { repository } from '../../lib/repository';
import { money } from '../../lib/config';
import { communicationError } from '../../lib/communication';
import { useDraftGuard } from '../academics/useDraftGuard';
import type { SalaryPayment } from '../../types/ledger';

export default function SalaryPaymentDialog({
  staffId,
  month,
  onClose,
}: {
  staffId: string;
  month: string;
  onClose: () => void;
}) {
  const state = useSchool(),
    today = useToday(),
    notify = useFeedback(),
    config = state.staffPayroll ?? defaultStaffPayroll,
    member = staffDirectory(state, config).find((item) => item.id === staffId);
  const [date, setDate] = useState(today),
    [method, setMethod] = useState<SalaryPayment['method']>('Bank'),
    [reference, setReference] = useState(''),
    [error, setError] = useState('');
  const [saved, setSaved] = useState(salaryPaymentFor(state, staffId, month));
  const guard = useDraftGuard(
    !saved && (date !== today || method !== 'Bank' || !!reference),
    onClose,
  );
  if (!member) return null;
  const summary = staffCycleSummary(state, config, member, month);
  return (
    <Modal
      open
      wide
      onClose={guard.confirming ? guard.keepEditing : guard.requestClose}
      title={
        guard.confirming
          ? 'Discard salary payment?'
          : saved
            ? 'Salary Payment Successful'
            : 'Record Salary Payment'
      }
      description={`${member.name} · ${month}`}
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
      ) : saved ? (
        <>
          <GeneratedDocumentPreview data={salarySlipFor(state, saved)} />
          <div className="modal-actions">
            <Button onClick={onClose}>Done</Button>
          </div>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              repository.recordSalaryPayment({ staffId, month, date, method, reference });
              setSaved(salaryPaymentFor(repository.getSnapshot(), staffId, month));
              notify('Salary payment recorded.');
              setError('');
            } catch (cause) {
              setError(communicationError(cause));
            }
          }}
        >
          <div className="form-grid">
            <label className="field">
              Staff name
              <input readOnly value={member.name} />
            </label>
            <label className="field">
              Salary month
              <input readOnly value={month} />
            </label>
            <label className="field">
              Net salary
              <input readOnly value={money(summary.net)} />
            </label>
            <label className="field">
              Payment Mode
              <select
                aria-label="Salary payment mode"
                value={method}
                onChange={(e) => setMethod(e.target.value as SalaryPayment['method'])}
              >
                {(['Bank', 'UPI', 'Cash'] as const).map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Payment Date
              <PickerInput
                aria-label="Salary payment date"
                required
                type="date"
                min={summary.cycle.start}
                max={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="field">
              Reference (optional)
              <input
                aria-label="Salary payment reference"
                maxLength={80}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
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
            <Button type="submit" disabled={!summary.salary || member.status !== 'active'}>
              Confirm Payment
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
