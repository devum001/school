import { useCallback, useState } from 'react';
import { Bus, Building2 } from 'lucide-react';
import { Button, Modal, Panel, LoadingOverlay } from '../../components/ui/Primitives';
import CalendarDateInput from '../../components/ui/CalendarDateInput';
import {
  accountBalance,
  allocateToEarliest,
  feeApi,
  installmentBalance,
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
                        {a.installments.map((i: FeeAccount['installments'][number]) => {
                          const bal = installmentBalance(i);
                          const paidAmount = (i.openingPaid ?? 0) + (i.paid ?? 0);
                          const isPartial = paidAmount > 0 && bal > 0;
                          return (
                            <tr key={i.id}>
                              <td>
                                <div style={{ fontWeight: 500 }}>{formatCalendarDate(i.dueDate)}</div>
                                {bal > 0 && i.dueDate < context.today && (
                                  <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>
                                    Overdue
                                  </div>
                                )}
                                {bal > 0 && i.dueDate === context.today && (
                                  <div style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>
                                    Due today
                                  </div>
                                )}
                              </td>
                              <td className="currency-cell">{money(i.amount)}</td>
                              <td className="currency-cell">{money(paidAmount)}</td>
                              <td
                                className="currency-cell"
                                style={{
                                  fontWeight: bal > 0 ? 700 : 500,
                                  color: bal > 0 ? '#b45309' : '#059669',
                                }}
                              >
                                {bal > 0 ? (
                                  isPartial ? (
                                    <span>
                                      {money(bal)}{' '}
                                      <small style={{ display: 'block', fontSize: 11, color: '#b45309', fontWeight: 500 }}>
                                        (Partial)
                                      </small>
                                    </span>
                                  ) : (
                                    money(bal)
                                  )
                                ) : (
                                  'Paid ✓'
                                )}
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

function formatDueDate(iso: string): string {
  if (!iso) return '—';
  try {
    const parts = iso.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts.map(Number);
      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      return `${String(d).padStart(2, '0')} ${months[m - 1] ?? ''} ${y}`;
    }
    return iso;
  } catch {
    return iso;
  }
}

export function CollectPayment({
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
        .map((i: FeeAccount['installments'][number], idx: number) => ({ i, originalIdx: idx + 1 }))
        .filter(({ i }) => installmentBalance(i) > 0)
        .map(({ i, originalIdx }) => ({
          accountId: a.id!,
          yearName: a.yearName,
          historical: a.historical || a.academicYearId !== context.yearId,
          installmentId: i.id,
          installmentIndex: originalIdx,
          dueDate: i.dueDate,
          amount: i.amount,
          paid: (i.paid ?? 0) + (i.openingPaid ?? 0),
          balance: installmentBalance(i),
        })),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const totalPendingPaise = pending.reduce((s, i) => s + i.balance, 0);

  // 1. Identify previous partial arrears vs next fresh installment:
  // An item has a partial arrear if it has already been partially paid (paid > 0)
  const firstFreshIdx = pending.findIndex((p) => (p.paid ?? 0) === 0);
  const hasPartialArrears = firstFreshIdx > 0;

  // Arrears from previous partially paid installment(s)
  const partialArrearsPaise = hasPartialArrears
    ? pending.slice(0, firstFreshIdx).reduce((s, p) => s + p.balance, 0)
    : 0;

  // Target item for this payment:
  // If there are partial arrears, combine them directly with the next installment!
  const targetItem = hasPartialArrears ? pending[firstFreshIdx] : pending[0];

  // Effective installment due:
  // Next installment balance + prior partial arrears (e.g. ₹9,750 + ₹750 = ₹10,500)
  const effectiveDuePaise = hasPartialArrears
    ? partialArrearsPaise + (targetItem?.balance ?? 0)
    : (targetItem?.balance ?? 0);

  const [amount, setAmount] = useState(
    effectiveDuePaise > 0 ? effectiveDuePaise : totalPendingPaise,
  ),
    [date, setDate] = useState(context.today),
    [method, setMethod] = useState('Cash'),
    [reference, setReference] = useState(''),
    [nextDueDate, setNextDueDate] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');

  const allocations = allocateToEarliest(pending, amount);
  const valid = amount > 0 && amount <= totalPendingPaise;

  // Check if any installment was partially paid
  const partialAllocItem = allocations.find((a) => a.amount > 0 && a.amount < a.balance);
  const showPartialDatePicker = Boolean(partialAllocItem);
  const partialRemainingPaise = partialAllocItem ? partialAllocItem.balance - partialAllocItem.amount : 0;

  const isOverdueDue = targetItem
    ? targetItem.dueDate < context.today || (hasPartialArrears && pending.some((p) => p.dueDate < context.today))
    : false;

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
            const effectiveNextDate = showPartialDatePicker
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

        {/* Clean, Single-line Due Summary */}
        {targetItem && (
          <div className={`fee-due-pill-banner ${isOverdueDue ? 'is-overdue' : ''}`}>
            <div className="fee-due-pill-left">
              <span className="fee-due-dot" />
              <span>{isOverdueDue ? 'Overdue Installment:' : 'Due Installment:'}</span>
              <strong>
                Installment {targetItem.installmentIndex} — {money(effectiveDuePaise)}
              </strong>
              {hasPartialArrears && (
                <span className="fee-due-breakdown-tag">
                  ({money(targetItem.balance)} + {money(partialArrearsPaise)} prev. balance)
                </span>
              )}
              <span className="fee-due-date-tag">
                (Due: {formatDueDate(targetItem.dueDate)})
              </span>
            </div>
            {totalPendingPaise > effectiveDuePaise && (
              <span className="fee-due-total-tag">
                Total Remaining: <strong>{money(totalPendingPaise)}</strong>
              </span>
            )}
          </div>
        )}

        <div className="fee-form-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <AmountField label="Amount received (₹)" value={amount} onChange={setAmount} />
            {totalPendingPaise > 0 && (
              <div className="fee-quick-amount-row">
                <button
                  type="button"
                  className={`fee-quick-amt-btn ${amount === effectiveDuePaise ? 'active' : ''}`}
                  onClick={() => setAmount(effectiveDuePaise)}
                >
                  {hasPartialArrears
                    ? `Next Installment (${money(effectiveDuePaise)})`
                    : `Installment (${money(effectiveDuePaise)})`}
                </button>

                {hasPartialArrears && (
                  <button
                    type="button"
                    className={`fee-quick-amt-btn ${amount === partialArrearsPaise ? 'active' : ''}`}
                    onClick={() => setAmount(partialArrearsPaise)}
                  >
                    Only Previous Due ({money(partialArrearsPaise)})
                  </button>
                )}

                {totalPendingPaise > effectiveDuePaise && (
                  <button
                    type="button"
                    className={`fee-quick-amt-btn ${amount === totalPendingPaise ? 'active' : ''}`}
                    onClick={() => setAmount(totalPendingPaise)}
                  >
                    Full Lump-sum ({money(totalPendingPaise)})
                  </button>
                )}
              </div>
            )}
          </div>

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
              placeholder="e.g. UPI / Cheque / Txn ID"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
        </div>

        {showPartialDatePicker && partialAllocItem && (
          <div className="fee-partial-box-slim">
            <div>
              <span>
                Remaining on Installment {partialAllocItem.installmentIndex}:{' '}
                <strong>{money(partialRemainingPaise)}</strong>
              </span>
            </div>
            <label className="fee-partial-date-label">
              Next due date:
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

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <footer className="modal-actions" style={{ marginTop: 4 }}>
          <Button type="button" variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button disabled={busy || !valid}>
            {busy ? 'Recording payment…' : `Collect ${valid ? money(amount) : ''} & Issue Receipt`}
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
