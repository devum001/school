import { useCallback, useState } from 'react';
import { Bus, Building2 } from 'lucide-react';
import { Button, Modal, Panel, LoadingOverlay } from '../../components/ui/Primitives';
import CalendarDateInput from '../../components/ui/CalendarDateInput';
import {
  accountBalance,
  allocateToEarliest,
  feeApi,
  installmentBalance,
  rollForwardInstallments,
  type FeeAccount,
  type FeeContext,
  type FeeStudentRow,
} from '../../services/feeService';
import { useRemote } from '../live/useRemote';
import { formatCalendarDate, titleCase } from '../../lib/displayFormat';
import { money } from '../../lib/config';
import FeePayments from './FeePayments';
import FeeSetupDialog, { AmountField } from './FeeSetupDialog';
import './fees-live.css';

export default function FeeStudentLedger({
  schoolId,
  context,
  student,
  permissions,
  collectInitially = false,
  close,
  changed,
  embedded = false,
}: {
  embedded?: boolean;
  schoolId: string;
  context: FeeContext;
  student: FeeStudentRow;
  permissions: readonly string[];
  collectInitially?: boolean;
  close: () => void;
  changed: () => void;
}) {
  const load = useCallback(
    (signal: AbortSignal) => feeApi.student(schoolId, student.id, signal),
    [schoolId, student.id],
  );
  const state = useRemote(load),
    [collect, setCollect] = useState(collectInitially),
    [edit, setEdit] = useState(false),
    [correction, setCorrection] = useState<FeeAccount | null>(null),
    [version, setVersion] = useState(0);
  const refresh = () => {
    state.reload();
    setVersion((v) => v + 1);
    changed();
  };
  const current = state.data?.accounts.find((a) => a.academicYearId === context.yearId);
  const can = (p: string) => permissions.includes(p);
  return (
    <section className="fee-student-page">
      {!embedded && (
        <>
          <Button variant="secondary" onClick={close}>
            ← Back to student fees
          </Button>
          <h2>{titleCase(student.name)} · Fees</h2>
          <p>Admission {student.code} · All academic years</p>
        </>
      )}
      <LoadingOverlay loading={state.loading} label="Loading student ledger…">
        <div />
      </LoadingOverlay>
      <div className="fee-dialog">
        {state.data && (
          <>
            <div className="fee-ledger-heading">
              <div className="fee-ledger-stat">
                <span className="fee-ledger-label">Total outstanding</span>
                <strong className="fee-ledger-amount">
                  {money(state.data.accounts.reduce((s, a) => s + accountBalance(a), 0))}
                </strong>
              </div>
              {!state.data.accounts.length &&
                can('fees.manage') &&
                student.enrollment?.status === 'active' &&
                context.years.find((y) => y.id === context.yearId)?.status !== 'closed' && (
                  <div className="fee-ledger-actions">
                    <Button onClick={() => setEdit(true)}>Set up current-year fees</Button>
                  </div>
                )}
            </div>
            {state.data.accounts.map((a) => {
              const busPaise = a.transportFee ?? 0;
              const hostelPaise = a.hostelFee ?? 0;
              const hasFacilities = Boolean(
                a.transportActive || busPaise > 0 || a.hostelActive || hostelPaise > 0,
              );
              const tuitionPaise =
                a.tuitionFee !== undefined && a.tuitionFee > 0
                  ? a.tuitionFee
                  : Math.max(0, a.baseFee - busPaise - hostelPaise);
              return (
                <Panel
                  key={a.id}
                  title={`${a.yearName}${a.historical ? ' · Opening dues' : ''}`}
                  subtitle={a.reason || 'Student fee agreement'}
                  action={
                    <div className="fee-ledger-actions">
                      {a.historical && can('fees.manage') && (
                        <Button variant="secondary" onClick={() => setCorrection(a)}>
                          Correct opening balance
                        </Button>
                      )}
                      {!a.historical &&
                        can('fees.manage') &&
                        student.enrollment?.status === 'active' &&
                        context.years.find((y) => y.id === context.yearId)?.status !== 'closed' && (
                          <Button variant="secondary" onClick={() => setEdit(true)}>
                            {current ? 'Edit current-year fees' : 'Set up current-year fees'}
                          </Button>
                        )}
                      {can('fees.collect') && accountBalance(a) > 0 && (
                        <Button onClick={() => setCollect(true)}>Collect payment</Button>
                      )}
                    </div>
                  }
                >
                  <div className="fee-account-summary">
                    {hasFacilities && (
                      <span className="fee-summary-chip">
                        <span className="fee-chip-label">Tuition:</span>
                        <strong className="fee-chip-val">{money(tuitionPaise)}</strong>
                      </span>
                    )}
                    {(a.transportActive || busPaise > 0) && (
                      <span className="fee-summary-chip fee-chip-bus">
                        <Bus size={14} />
                        <span className="fee-chip-label">
                          Bus ({a.transportMonths || 12}m{a.transportRoute ? ` · ${a.transportRoute}` : ''}):
                        </span>
                        <strong className="fee-chip-val">{money(busPaise)}</strong>
                      </span>
                    )}
                    {(a.hostelActive || hostelPaise > 0) && (
                      <span className="fee-summary-chip fee-chip-hostel">
                        <Building2 size={14} />
                        <span className="fee-chip-label">
                          Hostel ({a.hostelMonths || 12}m{a.hostelRoom ? ` · ${a.hostelRoom}` : ''}):
                        </span>
                        <strong className="fee-chip-val">{money(hostelPaise)}</strong>
                      </span>
                    )}
                    {(a.concession + a.scholarship > 0) && (
                      <span className="fee-summary-chip fee-chip-concession">
                        <span className="fee-chip-label">Concession / scholarship:</span>
                        <strong className="fee-chip-val">{money(a.concession + a.scholarship)}</strong>
                      </span>
                    )}
                    <span className="fee-summary-chip fee-chip-agreed">
                      <span className="fee-chip-label">Agreed:</span>
                      <strong className="fee-chip-val">{money(a.baseFee - a.concession - a.scholarship)}</strong>
                    </span>
                    <span
                      className={`fee-summary-chip ${
                        accountBalance(a) > 0 ? 'fee-chip-outstanding' : 'fee-chip-paid'
                      }`}
                    >
                      <span className="fee-chip-label">Outstanding:</span>
                      <strong className="fee-chip-val">{money(accountBalance(a))}</strong>
                    </span>
                  </div>
                  {a.asOf && (
                    <p className="panel-padding">
                      Balance recorded on {formatCalendarDate(a.asOf)}. These are not new collections.
                    </p>
                  )}
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Due date</th>
                          <th className="currency-cell">Installment</th>
                          <th className="currency-cell">Paid</th>
                          <th className="currency-cell">Remaining</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rollForwardInstallments(a.installments).map((i: FeeAccount['installments'][number]) => {
                          const bal = installmentBalance(i);
                          return (
                            <tr key={i.id}>
                              <td>
                                <div style={{ fontWeight: 500 }}>{formatCalendarDate(i.dueDate)}</div>
                                {bal > 0 && (
                                  <div style={{ fontSize: 12, color: '#b45309', fontWeight: 600 }}>
                                    {money(bal)} due
                                  </div>
                                )}
                              </td>
                              <td className="currency-cell">{money(i.amount)}</td>
                              <td className="currency-cell">{money((i.openingPaid ?? 0) + (i.paid ?? 0))}</td>
                              <td
                                className="currency-cell"
                                style={{
                                  fontWeight: bal > 0 ? 700 : 500,
                                  color: bal > 0 ? '#b45309' : '#059669',
                                }}
                              >
                                {bal > 0 ? money(bal) : 'Paid ✓'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              );
            })}
            {!state.data.accounts.length && (
              <div className="fee-callout">
                <p>Fees have not been set up. This student is not marked as paid.</p>
              </div>
            )}
            <FeePayments
              key={version}
              schoolId={schoolId}
              schoolName={context.schoolName}
              studentId={student.id}
              canReverse={can('fees.reverse')}
              changed={refresh}
            />
            <details className="fee-history">
              <summary>Fee setup history · latest 20 changes</summary>
              {state.data.changes.map((c) => (
                <div key={c.id}>
                  <strong>
                    {c.kind === 'opening' ? 'Opening balance recorded' : 'Fee agreement saved'}
                  </strong>
                  <span>{formatCalendarDate(c.createdAt.slice(0, 10))}</span>
                  <small>Recorded by account {c.actorUserId}</small>
                  {['agreement', 'opening-correction'].includes(c.kind) &&
                    (() => {
                      try {
                        const updates = JSON.parse(c.changes) as {
                          before: FeeAccount | null;
                          after: FeeAccount;
                        }[];
                        return updates
                          .filter((u) => String(u.after.studentId) === student.id)
                          .map((u, index) => (
                            <p key={index}>
                              {u.before
                                ? `Agreed fee ${money(u.before.baseFee - u.before.concession - u.before.scholarship)} → `
                                : 'Agreed fee '}
                              {money(u.after.baseFee - u.after.concession - u.after.scholarship)} ·{' '}
                              {u.after.reason || 'Initial setup'}
                            </p>
                          ));
                      } catch {
                        return null;
                      }
                    })()}
                </div>
              ))}
            </details>
          </>
        )}
        {state.error && (
          <p className="form-error" role="alert">
            {state.error}
            <Button onClick={state.reload}>Retry</Button>
          </p>
        )}
      </div>
      {correction && (
        <OpeningCorrection
          account={correction}
          schoolId={schoolId}
          close={() => setCorrection(null)}
          saved={() => {
            setCorrection(null);
            refresh();
          }}
        />
      )}
      {edit && (
        <FeeSetupDialog
          schoolId={schoolId}
          context={context}
          students={[{ ...student, account: current }]}
          canApprove={can('fees.approve')}
          close={() => setEdit(false)}
          saved={refresh}
        />
      )}
      {collect && state.data && (
        <CollectPayment
          schoolId={schoolId}
          context={context}
          studentId={student.id}
          accounts={state.data.accounts}
          close={() => setCollect(false)}
          saved={() => {
            setCollect(false);
            refresh();
          }}
        />
      )}
    </section>
  );
}

function CollectPayment({
  schoolId,
  context,
  studentId,
  accounts,
  close,
  saved,
}: {
  schoolId: string;
  context: FeeContext;
  studentId: string;
  accounts: FeeAccount[];
  close: () => void;
  saved: () => void;
}) {
  const pending = accounts
    .flatMap((a) =>
      a.installments
        .filter((i: FeeAccount['installments'][number]) => installmentBalance(i) > 0)
        .map((i: FeeAccount['installments'][number]) => ({
          accountId: a.id!,
          yearName: a.yearName,
          historical: a.historical || a.academicYearId !== context.yearId,
          installmentId: i.id,
          dueDate: i.dueDate,
          balance: installmentBalance(i),
        })),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const totalPendingPaise = pending.reduce((s, i) => s + i.balance, 0);

  const [amount, setAmount] = useState(totalPendingPaise),
    [date, setDate] = useState(context.today),
    [method, setMethod] = useState('Cash'),
    [reference, setReference] = useState(''),
    [nextDueDate, setNextDueDate] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');

  const allocations = allocateToEarliest(pending, amount);
  const valid = amount > 0 && amount <= totalPendingPaise;

  const lastPendingItem = pending[pending.length - 1];
  const priorPendingPaise = totalPendingPaise - (lastPendingItem?.balance ?? 0);
  const remainingPaise = totalPendingPaise - amount;
  // Trigger remaining balance & due date only when payment leaves an unpaid balance on the final installment
  const showFinalInstallmentPartialPicker =
    amount > priorPendingPaise && amount < totalPendingPaise;

  return (
    <Modal
      open
      title="Collect fee payment"
      description="Enter amount and payment details. A receipt is issued after the payment is saved."
      onClose={() => {
        if (!busy) close();
      }}
    >
      <form
        className="fee-dialog"
        data-unsaved="true"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valid) {
            setError(
              amount > totalPendingPaise
                ? 'Payment amount cannot exceed total outstanding dues.'
                : 'Please enter a valid payment amount.',
            );
            return;
          }
          setBusy(true);
          setError('');
          try {
            const effectiveNextDate = showFinalInstallmentPartialPicker
              ? nextDueDate ||
                (() => {
                  const d = new Date(`${date || context.today}T12:00:00Z`);
                  d.setDate(d.getDate() + 30);
                  return d.toISOString().slice(0, 10);
                })()
              : undefined;

            await feeApi.collect(schoolId, {
              studentId,
              amount,
              date,
              method,
              reference,
              allocations: allocations
                .filter((a) => a.amount > 0)
                .map((a) => ({
                  accountId: a.accountId,
                  installmentId: a.installmentId,
                  amount: a.amount,
                })),
              ...(effectiveNextDate ? { nextDueDate: effectiveNextDate } : {}),
            });
            saved();
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : 'Payment could not be confirmed. Retry this same payment safely.',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy && (
          <LoadingOverlay loading={busy} local label="Recording payment…">
            <div />
          </LoadingOverlay>
        )}

        {totalPendingPaise > 0 && (
          <div className="fee-quick-split-bar" style={{ marginBottom: 8 }}>
            <span>Quick fill:</span>
            <button
              type="button"
              className="fee-split-pill rebalance"
              onClick={() => setAmount(totalPendingPaise)}
            >
              Pay full remaining lump-sum ({money(totalPendingPaise)})
            </button>
          </div>
        )}

        <div className="fee-form-grid">
          <AmountField label="Amount received (₹)" value={amount} onChange={setAmount} />
          <label className="field">
            Payment date
            <CalendarDateInput
              required
              max={context.today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="field">
            Payment method
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              {['Cash', 'UPI', 'Bank transfer', 'Card', 'Cheque'].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Reference
            <input
              maxLength={120}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
        </div>

        {showFinalInstallmentPartialPicker && (
          <div
            style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              padding: '12px 16px',
              margin: '12px 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <strong style={{ fontSize: 13, color: '#b45309', display: 'block' }}>
                Remaining balance: {money(remainingPaise)}
              </strong>
              <span style={{ fontSize: 12, color: '#78350f' }}>
                Select due date for remaining balance (used for reminders & notifications)
              </span>
            </div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                fontWeight: 500,
                color: '#78350f',
                margin: 0,
              }}
            >
              Due date:
              <CalendarDateInput
                required
                min={date || context.today}
                value={
                  nextDueDate ||
                  (() => {
                    const d = new Date(`${date || context.today}T12:00:00Z`);
                    d.setDate(d.getDate() + 30);
                    return d.toISOString().slice(0, 10);
                  })()
                }
                onChange={(e) => setNextDueDate(e.target.value)}
              />
            </label>
          </div>
        )}

        <p className="fee-total">
          Payment total <strong>{money(amount)}</strong>
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <footer className="modal-actions">
          <Button disabled={busy || !valid}>
            {busy ? 'Confirming payment…' : 'Record payment & issue receipt'}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

function OpeningCorrection({
  account,
  schoolId,
  close,
  saved,
}: {
  account: FeeAccount;
  schoolId: string;
  close: () => void;
  saved: () => void;
}) {
  const [amount, setAmount] = useState(account.baseFee),
    [reason, setReason] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      open
      title="Correct opening balance"
      description={`${account.yearName} · The original amount and reason remain in the audit history.`}
      onClose={() => {
        if (!busy) close();
      }}
    >
      <form
        className="fee-dialog"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await feeApi.correctOpening(schoolId, account.id!, {
              revision: account.revision,
              amount,
              reason,
            });
            saved();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to confirm correction.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy && (
          <LoadingOverlay loading={busy} local label="Saving balance…">
            <div />
          </LoadingOverlay>
        )}
        <AmountField label="Correct total opening due (₹)" value={amount} onChange={setAmount} />
        <p>
          Enter the original outstanding balance, including payments collected against it since
          onboarding. It cannot be lower than those payments. Reductions require fee approval
          permission.
        </p>
        <label className="field">
          Note (optional)
          <textarea maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <Button disabled={busy}>{busy ? 'Saving…' : 'Confirm correction'}</Button>
      </form>
    </Modal>
  );
}
