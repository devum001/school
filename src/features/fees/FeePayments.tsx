import { DocumentPreview } from '../../components/shared/GeneratedDocumentPreview';
import { useLiveSchool } from '../live/schoolContext';
import { useCallback, useState } from 'react';
import { Download } from 'lucide-react';
import { Button, EmptyState, Modal, Panel, LoadingOverlay } from '../../components/ui/Primitives';
import { feeApi, type FeePayment } from '../../services/feeService';
import { useRemote } from '../live/useRemote';
import { money } from '../../lib/config';
import { formatCalendarDate, titleCase } from '../../lib/displayFormat';
import { downloadCsv } from '../../lib/download';
export default function FeePayments({
  schoolId,
  schoolName,
  studentId = '',
  yearId = '',
  canReverse,
  changed,
}: {
  schoolId: string;
  schoolName: string;
  studentId?: string;
  yearId?: string;
  canReverse: boolean;
  changed?: () => void;
}) {
  const { profile } = useLiveSchool();
  const [after, setAfter] = useState(''),
    [history, setHistory] = useState<string[]>([]),
    [receipt, setReceipt] = useState<FeePayment | null>(null),
    [reverse, setReverse] = useState<FeePayment | null>(null),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const load = useCallback(
    (signal: AbortSignal) => feeApi.payments(schoolId, studentId, after, signal, yearId),
    [schoolId, studentId, after, yearId],
  );
  const state = useRemote(load);
  return (
    <>
      <Panel
        title={studentId ? 'Payments & receipts' : 'Fee transactions'}
        subtitle="Actual payments only. Opening paid balances are recorded in the student ledger."
        action={
          <Button
            variant="secondary"
            disabled={!state.data?.items.length}
            onClick={() =>
              downloadCsv(
                'fee-transactions-page.csv',
                [
                  'Receipt',
                  'Student',
                  'Admission number',
                  'Date',
                  'Amount INR',
                  'Method',
                  'Reference',
                  'Status',
                ],
                (state.data?.items ?? []).map((p) => [
                  p.receipt,
                  p.studentName,
                  p.admissionNumber,
                  formatCalendarDate(p.date),
                  p.amount / 100,
                  p.method,
                  p.reference,
                  p.reversedAt ? 'Reversed' : 'Received',
                ]),
              )
            }
          >
            <Download size={16} />
            Export this page
          </Button>
        }
      >
        <LoadingOverlay loading={state.loading} label="Loading payments…">
          <div />
        </LoadingOverlay>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student / receipt</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.data?.items.map((p) => (
                <tr key={p.id}>
                  <th scope="row">
                    {titleCase(p.studentName)}
                    <small>{p.receipt}</small>
                  </th>
                  <td>{formatCalendarDate(p.date)}</td>
                  <td>{money(p.amount)}</td>
                  <td>{p.method}</td>
                  <td>
                    <span className={`fee-status ${p.reversedAt ? 'overdue' : 'paid'}`}>
                      {p.reversedAt ? 'Reversed' : 'Received'}
                    </span>
                  </td>
                  <td>
                    <div className="fee-inline">
                      <Button variant="secondary" onClick={() => setReceipt(p)}>
                        Receipt
                      </Button>
                      {canReverse && !p.reversedAt && (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setReverse(p);
                            setReason('');
                            setError('');
                          }}
                        >
                          Reverse
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!state.loading && !state.error && !state.data?.items.length && (
          <EmptyState
            title="No payments yet"
            description="Collect a payment from Student Fees to issue a receipt."
          />
        )}
        <div className="pagination">
          <Button
            variant="secondary"
            disabled={!history.length}
            onClick={() => {
              setAfter(history.at(-1)!);
              setHistory((h) => h.slice(0, -1));
            }}
          >
            Previous
          </Button>
          <span>Page {history.length + 1}</span>
          <Button
            variant="secondary"
            disabled={!state.data?.nextCursor}
            onClick={() => {
              setHistory((h) => [...h, after]);
              setAfter(state.data!.nextCursor!);
            }}
          >
            Next
          </Button>
        </div>
        {state.error && (
          <p role="alert" className="form-error">
            {state.error}
          </p>
        )}
      </Panel>
      {receipt && (
        <Modal
          open
          title="Fee receipt"
          description={receipt.receipt}
          onClose={() => setReceipt(null)}
        >
          <DocumentPreview
            data={{
              kind: 'Fee Receipt',
              number: receipt.receipt,
              schoolName,
              schoolLogo: profile?.school.logoDataUrl || undefined,
              recipientName: titleCase(receipt.studentName),
              date: receipt.date,
              createdAt: receipt.createdAt,
              template: { templateId: 'classic', accent: profile?.school.accentColor || '#245e63' },
              amount: receipt.amount,
              amountLabel: receipt.reversedAt ? 'Reversed payment' : 'Amount received',
              fields: [
                { label: 'Student', value: titleCase(receipt.studentName) },
                { label: 'Admission number', value: receipt.admissionNumber },
                { label: 'Payment date', value: formatCalendarDate(receipt.date) },
                { label: 'Payment method', value: receipt.method },
                { label: 'Reference', value: receipt.reference || '—' },
                {
                  label: 'Allocated to',
                  value: receipt.allocations
                    .map((a) => `${a.yearName}: ${money(a.amount)}`)
                    .join('; '),
                },
                {
                  label: 'Status',
                  value: receipt.reversedAt ? `REVERSED: ${receipt.reversalReason}` : 'Received',
                },
              ],
            }}
          />
        </Modal>
      )}
      {reverse && (
        <Modal
          open
          title="Reverse this payment?"
          description="The original receipt remains visible. Its allocations return to outstanding balances."
          onClose={() => {
            if (!busy) setReverse(null);
          }}
        >
          <form
            className="fee-dialog"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                await feeApi.reverse(schoolId, reverse.id, reason.trim());
                setReverse(null);
                state.reload();
                changed?.();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Reversal could not be confirmed.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <LoadingOverlay loading={busy} local label="Reversing payment…">
              <div />
            </LoadingOverlay>
            <p>
              {titleCase(reverse.studentName)} · {money(reverse.amount)}
            </p>
            <label className="field">
              Note (optional)
              <textarea
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <Button disabled={busy}>{busy ? 'Reversing…' : 'Confirm reversal'}</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
