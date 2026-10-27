import { useCallback, useState } from 'react';
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
              <div>
                <span>Total outstanding</span>
                <strong>
                  {money(state.data.accounts.reduce((s, a) => s + accountBalance(a), 0))}
                </strong>
              </div>
              <div className="fee-inline">
                {can('fees.manage') &&
                  student.enrollment?.status === 'active' &&
                  context.years.find((y) => y.id === context.yearId)?.status !== 'closed' && (
                    <Button variant="secondary" onClick={() => setEdit(true)}>
                      {current ? 'Edit current-year fees' : 'Set up current-year fees'}
                    </Button>
                  )}
                {can('fees.collect') && state.data.accounts.some((a) => accountBalance(a) > 0) && (
                  <Button onClick={() => setCollect(true)}>Collect payment</Button>
                )}
              </div>
            </div>
            {state.data.accounts.map((a) => (
              <Panel
                key={a.id}
                title={`${a.yearName}${a.historical ? ' · Opening dues' : ''}`}
                subtitle={a.reason || 'Student fee agreement'}
                action={
                  a.historical && can('fees.manage') ? (
                    <Button variant="secondary" onClick={() => setCorrection(a)}>
                      Correct opening balance
                    </Button>
                  ) : undefined
                }
              >
                <div className="fee-account-summary">
                  <span>
                    Agreed: <strong>{money(a.baseFee - a.concession - a.scholarship)}</strong>
                  </span>
                  <span>
                    Concession / scholarship: <strong>{money(a.concession + a.scholarship)}</strong>
                  </span>
                  <span>
                    Outstanding: <strong>{money(accountBalance(a))}</strong>
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
                        <th className="currency-cell">Amount due</th>
                        <th className="currency-cell">Previously paid</th>
                        <th className="currency-cell">Collected</th>
                        <th className="currency-cell">Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.installments.map((i) => (
                        <tr key={i.id}>
                          <td>{formatCalendarDate(i.dueDate)}</td>
                          <td className="currency-cell">{money(i.amount)}</td>
                          <td className="currency-cell">{money(i.openingPaid)}</td>
                          <td className="currency-cell">{money(i.paid)}</td>
                          <td className="currency-cell">{money(installmentBalance(i))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            ))}
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
        .filter((i) => installmentBalance(i) > 0)
        .map((i) => ({
          accountId: a.id!,
          yearName: a.yearName,
          installmentId: i.id,
          dueDate: i.dueDate,
          balance: installmentBalance(i),
        })),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const [amount, setAmount] = useState(pending[0]?.balance ?? 0),
    [date, setDate] = useState(context.today),
    [method, setMethod] = useState('Cash'),
    [reference, setReference] = useState(''),
    [custom, setCustom] = useState(false),
    [chosen, setChosen] = useState<Record<string, number>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const automatic = allocateToEarliest(pending, amount);
  const allocations = pending.map((i, index) => ({
    ...i,
    amount: custom ? (chosen[`${i.accountId}:${i.installmentId}`] ?? 0) : automatic[index].amount,
  }));
  const allocated = allocations.reduce((s, a) => s + a.amount, 0),
    valid =
      amount > 0 &&
      amount === allocated &&
      allocations.every((a) => a.amount >= 0 && a.amount <= a.balance);
  return (
    <Modal
      open
      title="Collect fee payment"
      description="Review the year and installment allocation before confirming. A receipt is issued after the payment is saved."
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
              'The payment amount must match allocations and cannot exceed outstanding dues.',
            );
            return;
          }
          setBusy(true);
          setError('');
          try {
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
        <LoadingOverlay loading={busy} local label="Recording payment…">
          <div />
        </LoadingOverlay>
        <>
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
          <label className="fee-checkbox">
            <input
              type="checkbox"
              checked={custom}
              onChange={(e) => {
                setChosen(
                  Object.fromEntries(
                    allocations.map((a) => [`${a.accountId}:${a.installmentId}`, a.amount]),
                  ),
                );
                setCustom(e.target.checked);
              }}
            />
            Choose specific installments
          </label>
          <p>
            Payments clear the earliest unpaid balance first, including future installments. Paying
            on 28 October for an installment due on 30 October pays that installment early. Any
            remainder goes to the next unpaid balance.
          </p>
        </>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Year / Due</th>
                <th className="currency-cell">Remaining</th>
                <th className="currency-cell">Allocate</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((a) => (
                <tr key={`${a.accountId}:${a.installmentId}`}>
                  <th>
                    {a.yearName}
                    <small>{formatCalendarDate(a.dueDate)}</small>
                  </th>
                  <td>{money(a.balance)}</td>
                  <td>
                    {custom ? (
                      <input
                        aria-label={`Allocate ${a.yearName} ${a.dueDate}`}
                        type="number"
                        min={0}
                        max={a.balance / 100}
                        step="0.01"
                        value={a.amount / 100}
                        onChange={(e) =>
                          setChosen((old) => ({
                            ...old,
                            [`${a.accountId}:${a.installmentId}`]: Math.round(
                              Number(e.target.value) * 100,
                            ),
                          }))
                        }
                      />
                    ) : (
                      money(a.amount)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
        <LoadingOverlay loading={busy} local label="Saving balance…">
          <div />
        </LoadingOverlay>
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
