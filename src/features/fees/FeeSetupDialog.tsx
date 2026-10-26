import { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Layers3 } from 'lucide-react';
import { Button, Modal, LoadingOverlay } from '../../components/ui/Primitives';
import CalendarDateInput from '../../components/ui/CalendarDateInput';
import {
  feeApi,
  makeInstallments,
  type FeeAgreement,
  type FeeContext,
  type FeeStudentRow,
} from '../../services/feeService';
import { money } from '../../lib/config';
import { titleCase } from '../../lib/displayFormat';
import { useDraftGuard } from '../academics/useDraftGuard';
export function AmountField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      {label}
      <input
        aria-label={label}
        type="number"
        min="0"
        max="10000000"
        step="0.01"
        value={value / 100}
        disabled={disabled}
        required
        onChange={(e) => onChange(Math.round(Number(e.target.value) * 100))}
      />
    </label>
  );
}
export default function FeeSetupDialog({
  schoolId,
  context,
  students,
  canApprove,
  close,
  saved,
}: {
  schoolId: string;
  context: FeeContext;
  students: FeeStudentRow[];
  canApprove: boolean;
  close: () => void;
  saved: () => void;
}) {
  const year = context.years.find((y) => y.id === context.yearId)!;
  const editing = students.length === 1 && Boolean(students[0].account);
  const [step, setStep] = useState(editing ? 2 : 1),
    [base, setBase] = useState(0),
    [discount, setDiscount] = useState(0),
    [scholarship, setScholarship] = useState(0),
    [reason, setReason] = useState(''),
    [count, setCount] = useState(3),
    [installmentMode, setInstallmentMode] = useState(false),
    [interval, setInterval] = useState(3),
    [date, setDate] = useState(context.today < year.start ? year.start : context.today);
  const asOf = context.today;
  const [rows, setRows] = useState<FeeAgreement[]>(
    students.map((s) => ({
      studentId: s.id,
      revision: s.account?.revision ?? -1,
      baseFee: s.account?.baseFee ?? 0,
      concession: s.account?.concession ?? 0,
      scholarship: s.account?.scholarship ?? 0,
      reason: s.account?.reason ?? '',
      openingPaid: s.account?.installments.reduce((sum, i) => sum + i.openingPaid, 0) ?? 0,
      asOf: s.account?.asOf ?? '',
      installments:
        s.account?.installments.map((i) => ({ id: i.id, amount: i.amount, dueDate: i.dueDate })) ??
        [],
    })),
  );
  const [reviewPage, setReviewPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [completed, setCompleted] = useState(0),
    [error, setError] = useState('');
  const guard = useDraftGuard(step > 1 && completed < rows.length, close);
  const update = (id: string, patch: Partial<FeeAgreement>) =>
    setRows((old) => old.map((r) => (r.studentId === id ? { ...r, ...patch } : r)));
  const validate = () =>
    rows.every(
      (r) =>
        r.baseFee >= r.concession + r.scholarship &&
        r.openingPaid <= r.baseFee - r.concession - r.scholarship &&
        r.installments.length > 0 &&
        r.installments.every((i) => i.amount >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(i.dueDate)) &&
        r.installments.reduce((s, i) => s + i.amount, 0) ===
          r.baseFee - r.concession - r.scholarship,
    );
  const submit = async () => {
    if (!validate()) {
      setError(
        'Installment amounts must add up to the final fee. Check the amounts and dates below.',
      );
      return;
    }
    setBusy(true);
    setError('');
    try {
      for (let i = completed; i < rows.length; i += 25) {
        const batch = rows.slice(i, i + 25);
        await feeApi.agreements(schoolId, context.yearId, batch);
        setCompleted(i + batch.length);
      }
      setStep(4);
      saved();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Save could not be confirmed. Continue this batch to check its outcome safely.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      wide
      title={
        guard.confirming
          ? 'Leave fee setup?'
          : editing
            ? 'Edit student fees'
            : 'Set up student fees'
      }
      description={`${year.name} · ${students.length} selected students`}
      onClose={() => {
        if (!busy) guard.requestClose();
      }}
    >
      {guard.confirming ? (
        <div className="live-content">
          <p>Saved batches remain saved. Unsaved changes will be lost.</p>
          <Button onClick={guard.keepEditing}>Keep editing</Button>
          <Button variant="secondary" onClick={guard.discard}>
            Leave setup
          </Button>
        </div>
      ) : (
        <form
          className="fee-dialog"
          data-unsaved={step > 1 && step < 4}
          onSubmit={(e) => {
            e.preventDefault();
            if (step === 1) {
              if (base < discount + scholarship) {
                setError('Discounts cannot exceed the base fee.');
                return;
              }
              setRows((old) =>
                old.map((r) =>
                  r.revision >= 0
                    ? r
                    : {
                        ...r,
                        baseFee: base,
                        concession: discount,
                        scholarship,
                        reason,
                        asOf: '',
                        installments: makeInstallments(
                          base - discount - scholarship,
                          installmentMode ? count : 1,
                          date,
                          interval,
                        ),
                      },
                ),
              );
              setError('');
              setStep(2);
            } else if (step === 2) void submit();
          }}
        >
          <LoadingOverlay loading={busy} local label="Saving fees…">
            <div />
          </LoadingOverlay>
          <ol className="fee-steps">
            {['Fee details', 'Review & save'].map((name, i) => (
              <li key={name} data-active={step === i + 1} data-complete={step > i + 1}>
                <span>{step > i + 1 ? '✓' : i + 1}</span>
                {name}
              </li>
            ))}
          </ol>
          {step === 1 && (
            <>
              <div className="fee-callout">
                <Layers3 size={22} />
                <div>
                  <strong>Set the common arrangement once</strong>
                  <p>
                    Next, adjust only the students who need different fees or installments. Existing
                    agreements keep their saved values.
                  </p>
                </div>
              </div>
              <div className="fee-form-grid">
                <AmountField label="Base yearly fee (₹)" value={base} onChange={setBase} />
                <AmountField
                  label="Concession (₹)"
                  value={discount}
                  onChange={setDiscount}
                  disabled={!canApprove}
                />
                <AmountField
                  label="Scholarship (₹)"
                  value={scholarship}
                  onChange={setScholarship}
                  disabled={!canApprove}
                />
                <label className="field">
                  Note (optional)
                  <input
                    value={reason}
                    maxLength={300}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <fieldset className="fee-payment-choice">
                  <legend>Payment arrangement</legend>
                  <label>
                    <input
                      type="radio"
                      name="arrangement"
                      checked={!installmentMode}
                      onChange={() => setInstallmentMode(false)}
                    />{' '}
                    Single balance
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="arrangement"
                      checked={installmentMode}
                      onChange={() => setInstallmentMode(true)}
                    />{' '}
                    Split into installments
                  </label>
                </fieldset>
                {installmentMode && (
                  <>
                    {' '}
                    <label className="field">
                      Number of installments
                      <input
                        type="number"
                        min={1}
                        max={60}
                        required
                        value={count}
                        onChange={(e) => setCount(Number(e.target.value))}
                      />
                    </label>
                    <label className="field">
                      Payment interval
                      <select
                        value={interval}
                        onChange={(e) => setInterval(Number(e.target.value))}
                      >
                        <option value={1}>Monthly</option>
                        <option value={3}>Quarterly</option>
                        <option value={6}>Every six months</option>
                        <option value={12}>Yearly</option>
                      </select>
                    </label>
                  </>
                )}
                <label className="field">
                  {installmentMode ? 'First installment due' : 'Payment due date'}
                  <CalendarDateInput
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
              </div>
              <p className="fee-total">
                Agreed fee per student{' '}
                <strong>{money(Math.max(0, base - discount - scholarship))}</strong>
              </p>
            </>
          )}
          {step === 2 && (
            <>
              <p>
                Edit the amounts below. Use <strong>Payment details</strong> for custom due dates,
                previously paid amounts and optional notes. Paid installments are protected.
              </p>
              <div className="table-wrap fee-bulk-table">
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Base fee ₹</th>
                      <th>Concession ₹</th>
                      <th>Scholarship ₹</th>
                      <th>Already paid ₹</th>
                      <th>Final fee</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice((reviewPage - 1) * 50, reviewPage * 50).map((r) => {
                      const student = students.find((s) => s.id === r.studentId)!;
                      return (
                        <tr key={r.studentId}>
                          <th scope="row">
                            {titleCase(student.name)}
                            <small>{student.code}</small>
                          </th>
                          {(['baseFee', 'concession', 'scholarship', 'openingPaid'] as const).map(
                            (field) => (
                              <td key={field}>
                                <input
                                  aria-label={`${student.code} ${field}`}
                                  type="number"
                                  min={0}
                                  max={10000000}
                                  step="0.01"
                                  disabled={
                                    (field === 'concession' || field === 'scholarship') &&
                                    !canApprove
                                  }
                                  value={r[field] / 100}
                                  onChange={(e) => {
                                    const patch = {
                                      [field]: Math.round(Number(e.target.value) * 100),
                                    };
                                    const next = { ...r, ...patch };
                                    update(r.studentId, {
                                      ...patch,
                                      ...(r.revision < 0
                                        ? { asOf: next.openingPaid > 0 ? r.asOf || asOf : '' }
                                        : {}),
                                      ...(r.revision < 0
                                        ? {
                                            installments: makeInstallments(
                                              Math.max(
                                                0,
                                                next.baseFee - next.concession - next.scholarship,
                                              ),
                                              r.installments.length || count,
                                              r.installments[0]?.dueDate || date,
                                              interval,
                                            ),
                                          }
                                        : {}),
                                    });
                                  }}
                                />
                              </td>
                            ),
                          )}
                          <td>{money(r.baseFee - r.concession - r.scholarship)}</td>
                          <td>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() =>
                                setExpanded(expanded === r.studentId ? null : r.studentId)
                              }
                            >
                              Payment details
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <span>
                  {rows.length} selected students · Page {reviewPage}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={reviewPage <= 1}
                  onClick={() => setReviewPage((p) => p - 1)}
                >
                  Previous students
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={reviewPage * 50 >= rows.length}
                  onClick={() => setReviewPage((p) => p + 1)}
                >
                  Next students
                </Button>
              </div>
              {expanded &&
                (() => {
                  const r = rows.find((r) => r.studentId === expanded)!;
                  return (
                    <section className="fee-schedule-editor">
                      <h3>
                        {titleCase(students.find((s) => s.id === expanded)!.name)} · Payment details
                      </h3>
                      <div className="fee-form-grid">
                        <AmountField
                          label="Already paid before onboarding (₹)"
                          value={r.openingPaid}
                          onChange={(v) =>
                            update(r.studentId, { openingPaid: v, asOf: r.asOf || asOf })
                          }
                        />
                        <label className="field">
                          Balance recorded on
                          <CalendarDateInput
                            value={r.asOf}
                            max={context.today}
                            onChange={(e) => update(r.studentId, { asOf: e.target.value })}
                          />
                        </label>
                        <label className="field">
                          Note (optional)
                          <input
                            value={r.reason}
                            maxLength={300}
                            onChange={(e) => update(r.studentId, { reason: e.target.value })}
                          />
                        </label>
                      </div>
                      <p>
                        Already paid means money received before using this app. It will not appear
                        as a collection received today.
                      </p>
                      {r.installments.map((i, index) => (
                        <div className="fee-installment-row" key={i.id}>
                          <span>
                            {r.installments.length === 1
                              ? 'Single balance'
                              : `Installment ${index + 1}`}
                          </span>
                          <label className="field">
                            Due date
                            <CalendarDateInput
                              required
                              value={i.dueDate}
                              onChange={(e) =>
                                update(r.studentId, {
                                  installments: r.installments.map((v) =>
                                    v.id === i.id ? { ...v, dueDate: e.target.value } : v,
                                  ),
                                })
                              }
                            />
                          </label>
                          <AmountField
                            label={`Installment ${index + 1} amount (₹)`}
                            value={i.amount}
                            onChange={(amount) =>
                              update(r.studentId, {
                                installments: r.installments.map((v) =>
                                  v.id === i.id ? { ...v, amount } : v,
                                ),
                              })
                            }
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={r.installments.length === 1}
                            onClick={() =>
                              update(r.studentId, {
                                installments: r.installments.filter((v) => v.id !== i.id),
                              })
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={r.installments.length >= 60}
                        onClick={() =>
                          update(r.studentId, {
                            installments: [
                              ...r.installments,
                              { id: crypto.randomUUID(), amount: 0, dueDate: date },
                            ],
                          })
                        }
                      >
                        Add installment
                      </Button>
                      <p role="status">
                        Schedule total: {money(r.installments.reduce((s, i) => s + i.amount, 0))} /{' '}
                        {money(r.baseFee - r.concession - r.scholarship)}
                      </p>
                    </section>
                  );
                })()}
            </>
          )}
          {step === 4 && (
            <div className="fee-success">
              <CheckCircle2 size={48} />
              <h3>Fees are ready</h3>
              <p>
                {completed} students updated. Opening paid amounts remain separate from new
                collections.
              </p>
              <Button type="button" onClick={close}>
                Return to student fees
              </Button>
            </div>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {step === 2 && (
            <p role="status">
              {completed ? `${completed} of ${rows.length} saved · ` : ''}Total agreed fee:{' '}
              {money(rows.reduce((sum, r) => sum + r.baseFee - r.concession - r.scholarship, 0))}
            </p>
          )}
          {step < 4 && (
            <footer className="modal-actions">
              {step > 1 && !completed && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setStep(step - 1)}
                >
                  <ArrowLeft size={16} />
                  Back
                </Button>
              )}
              <Button disabled={busy}>
                {busy
                  ? 'Saving…'
                  : step === 2
                    ? completed
                      ? 'Continue saving safely'
                      : 'Save fee setup'
                    : 'Review students'}
                {!busy && <ArrowRight size={16} />}
              </Button>
            </footer>
          )}
        </form>
      )}
    </Modal>
  );
}
