import { useState } from 'react';
import { ArrowLeft, ArrowRight, Bus, Building2, CheckCircle2, Sparkles } from 'lucide-react';
import { Button, Modal, LoadingOverlay } from '../../components/ui/Primitives';
import CalendarDateInput from '../../components/ui/CalendarDateInput';
import {
  feeApi,
  makeInstallments,
  rebalanceInstallments,
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
  required = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  required?: boolean;
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
        value={value === 0 ? '' : value / 100}
        placeholder="0"
        disabled={disabled}
        required={required}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val === '' ? 0 : Math.round(Number(val) * 100));
        }}
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
    [transportActive, setTransportActive] = useState(false),
    [transportFee, setTransportFee] = useState(0),
    [transportMonths, setTransportMonths] = useState(12),
    [transportRoute, setTransportRoute] = useState(''),
    [hostelActive, setHostelActive] = useState(false),
    [hostelFee, setHostelFee] = useState(0),
    [hostelMonths, setHostelMonths] = useState(12),
    [hostelRoom, setHostelRoom] = useState(''),
    [discount, setDiscount] = useState(0),
    [scholarship, setScholarship] = useState(0),
    [reason, setReason] = useState(''),
    [count, setCount] = useState(3),
    [installmentMode, setInstallmentMode] = useState(false),
    [interval, setInterval] = useState(3),
    [date, setDate] = useState(context.today < year.start ? year.start : context.today);
  const asOf = context.today;

  const [rows, setRows] = useState<FeeAgreement[]>(
    students.map((s) => {
      const acc = s.account;
      const tFee = acc?.transportFee ?? 0;
      const hFee = acc?.hostelFee ?? 0;
      const tuiFee =
        acc?.tuitionFee !== undefined && acc.tuitionFee > 0
          ? acc.tuitionFee
          : Math.max(0, (acc?.baseFee ?? 0) - tFee - hFee);
      return {
        studentId: s.id,
        revision: acc?.revision ?? -1,
        baseFee: acc?.baseFee ?? 0,
        tuitionFee: tuiFee,
        transportActive: Boolean(acc?.transportActive || tFee > 0),
        transportFee: tFee,
        transportMonths: acc?.transportMonths || 12,
        transportRoute: acc?.transportRoute ?? '',
        hostelActive: Boolean(acc?.hostelActive || hFee > 0),
        hostelFee: hFee,
        hostelMonths: acc?.hostelMonths || 12,
        hostelRoom: acc?.hostelRoom ?? '',
        concession: acc?.concession ?? 0,
        scholarship: acc?.scholarship ?? 0,
        reason: acc?.reason ?? '',
        openingPaid: acc?.installments.reduce((sum, i) => sum + i.openingPaid, 0) ?? 0,
        asOf: acc?.asOf ?? '',
        installments:
          acc?.installments.map((i) => ({ id: i.id, amount: i.amount, dueDate: i.dueDate })) ?? [],
      };
    }),
  );

  const [reviewPage, setReviewPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(editing ? students[0].id : null),
    [busy, setBusy] = useState(false),
    [completed, setCompleted] = useState(0),
    [error, setError] = useState('');
  const guard = useDraftGuard(step > 1 && completed < rows.length, close);

  const update = (id: string, patch: Partial<FeeAgreement>) =>
    setRows((old) => old.map((r) => (r.studentId === id ? { ...r, ...patch } : r)));

  const updateWithRebalance = (id: string, patch: Partial<FeeAgreement>) => {
    setRows((old) =>
      old.map((r) => {
        if (r.studentId !== id) return r;
        const next = { ...r, ...patch };
        const studentAcc = students.find((s) => s.id === id)?.account;
        const targetNet = Math.max(0, next.baseFee - next.concession - next.scholarship);
        const rebalanced = rebalanceInstallments(
          targetNet,
          next.installments.length
            ? next.installments
            : makeInstallments(targetNet, count, date, interval),
          studentAcc?.installments ?? [],
          next.installments[0]?.dueDate || date,
        );
        return {
          ...next,
          ...(r.revision < 0 ? { asOf: next.openingPaid > 0 ? r.asOf || asOf : '' } : {}),
          installments: rebalanced,
        };
      }),
    );
  };

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

  const stepOneGross =
    base + (transportActive ? transportFee : 0) + (hostelActive ? hostelFee : 0);

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
              if (stepOneGross < discount + scholarship) {
                setError('Discounts cannot exceed the base fee.');
                return;
              }
              setRows((old) =>
                old.map((r) =>
                  r.revision >= 0
                    ? r
                    : {
                        ...r,
                        baseFee: stepOneGross,
                        tuitionFee: base,
                        transportActive,
                        transportFee: transportActive ? transportFee : 0,
                        transportMonths: transportActive ? transportMonths : 0,
                        transportRoute: transportActive ? transportRoute : '',
                        hostelActive,
                        hostelFee: hostelActive ? hostelFee : 0,
                        hostelMonths: hostelActive ? hostelMonths : 0,
                        hostelRoom: hostelActive ? hostelRoom : '',
                        concession: discount,
                        scholarship,
                        reason,
                        asOf: '',
                        installments: makeInstallments(
                          stepOneGross - discount - scholarship,
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
          {busy && (
            <LoadingOverlay loading={busy} local label="Saving fees…">
              <div />
            </LoadingOverlay>
          )}
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
              <div className="fee-form-grid">
                <AmountField label="Tuition yearly fees (₹)" value={base} onChange={setBase} />
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
              </div>

              {/* BUS & HOSTEL FACILITY TOGGLES */}
              <div className="fee-facility-cards">
                <div className={`fee-facility-card ${transportActive ? 'active' : ''}`}>
                  <label className="fee-facility-toggle">
                    <input
                      type="checkbox"
                      checked={transportActive}
                      onChange={(e) => setTransportActive(e.target.checked)}
                    />
                    <Bus size={16} />
                    <span>Include School Bus / Transport Fee</span>
                  </label>
                  {transportActive && (
                    <div className="fee-facility-fields">
                      <AmountField
                        label="Bus fee (₹)"
                        value={transportFee}
                        onChange={setTransportFee}
                      />
                      <label className="field">
                        Active months (Mid-year join / stop)
                        <select
                          value={transportMonths}
                          onChange={(e) => setTransportMonths(Number(e.target.value))}
                        >
                          {Array.from({ length: 12 }, (_, i) => 12 - i).map((m) => (
                            <option key={m} value={m}>
                              {m === 12
                                ? 'Full year (12 months)'
                                : `${m} month${m > 1 ? 's' : ''} (Mid-year)`}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        Bus route / stop (optional)
                        <input
                          value={transportRoute}
                          maxLength={120}
                          placeholder="e.g. Route 2"
                          onChange={(e) => setTransportRoute(e.target.value)}
                        />
                      </label>
                    </div>
                  )}
                </div>

                <div className={`fee-facility-card ${hostelActive ? 'active' : ''}`}>
                  <label className="fee-facility-toggle">
                    <input
                      type="checkbox"
                      checked={hostelActive}
                      onChange={(e) => setHostelActive(e.target.checked)}
                    />
                    <Building2 size={16} />
                    <span>Include Hostel Facility Fee</span>
                  </label>
                  {hostelActive && (
                    <div className="fee-facility-fields">
                      <AmountField
                        label="Hostel fee (₹)"
                        value={hostelFee}
                        onChange={setHostelFee}
                      />
                      <label className="field">
                        Active months (Mid-year join / leave)
                        <select
                          value={hostelMonths}
                          onChange={(e) => setHostelMonths(Number(e.target.value))}
                        >
                          {Array.from({ length: 12 }, (_, i) => 12 - i).map((m) => (
                            <option key={m} value={m}>
                              {m === 12
                                ? 'Full year (12 months)'
                                : `${m} month${m > 1 ? 's' : ''} (Mid-year)`}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        Room / block (optional)
                        <input
                          value={hostelRoom}
                          maxLength={120}
                          placeholder="e.g. Room 104"
                          onChange={(e) => setHostelRoom(e.target.value)}
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="fee-form-grid">
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
                    <label className="field">
                      Number of installments
                      <input
                        type="number"
                        min={1}
                        max={60}
                        required
                        value={count}
                        onFocus={(e) => e.target.select()}
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
                <strong>{money(Math.max(0, stepOneGross - discount - scholarship))}</strong>
              </p>
            </>
          )}
          {step === 2 && (
            <>
              {rows.length > 1 && (
                <>
                  <p>
                    Edit the amounts below. Use <strong>Payment details</strong> for Bus, Hostel,
                    mid-year service changes, custom due dates, and previously paid amounts. Paid
                    installments are protected.
                  </p>
                  <div className="table-wrap fee-bulk-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th className="currency-cell">Base fee ₹</th>
                          <th className="currency-cell">Concession ₹</th>
                          <th className="currency-cell">Scholarship ₹</th>
                          <th className="currency-cell">Already paid ₹</th>
                          <th className="currency-cell">Final fee</th>
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
                                <small style={{ color: 'var(--muted)', display: 'block' }}>
                                  Tuition {money(r.tuitionFee !== undefined ? r.tuitionFee : Math.max(0, r.baseFee - (r.transportActive ? r.transportFee ?? 0 : 0) - (r.hostelActive ? r.hostelFee ?? 0 : 0)))}
                                  {r.transportActive ? ` · Bus ${money(r.transportFee ?? 0)}` : ''}
                                  {r.hostelActive ? ` · Hostel ${money(r.hostelFee ?? 0)}` : ''}
                                </small>
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
                                      value={r[field] === 0 ? '' : r[field] / 100}
                                      placeholder="0"
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) => {
                                        const val = e.target.value === '' ? 0 : Math.round(Number(e.target.value) * 100);
                                        const patch: Partial<FeeAgreement> = { [field]: val };
                                        if (field === 'baseFee') {
                                          patch.tuitionFee = Math.max(
                                            0,
                                            val - (r.transportFee ?? 0) - (r.hostelFee ?? 0),
                                          );
                                        }
                                        updateWithRebalance(r.studentId, patch);
                                      }}
                                    />
                                  </td>
                                ),
                              )}
                              <td className="currency-cell">
                                {money(r.baseFee - r.concession - r.scholarship)}
                              </td>
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
                </>
              )}

              {(rows.length === 1 || expanded) &&
                (() => {
                  const activeId = rows.length === 1 ? rows[0].studentId : expanded!;
                  const r = rows.find((item) => item.studentId === activeId);
                  if (!r) return null;
                  const student = students.find((s) => s.id === activeId)!;
                  const tuitionVal =
                    r.tuitionFee ??
                    Math.max(0, r.baseFee - (r.transportFee ?? 0) - (r.hostelFee ?? 0));
                  const schedTotal = r.installments.reduce((s, i) => s + i.amount, 0);
                  const targetNet = Math.max(0, r.baseFee - r.concession - r.scholarship);

                  const updateBreakdown = (patch: Partial<FeeAgreement>) => {
                    const next = { ...r, ...patch };
                    const t = next.tuitionFee ?? tuitionVal;
                    const b = next.transportActive ? (next.transportFee ?? 0) : 0;
                    const h = next.hostelActive ? (next.hostelFee ?? 0) : 0;
                    updateWithRebalance(r.studentId, {
                      ...patch,
                      tuitionFee: t,
                      transportFee: b,
                      hostelFee: h,
                      baseFee: t + b + h,
                    });
                  };

                  const addInstallment = () => {
                    const lastInst = r.installments[r.installments.length - 1];
                    const baseDate = lastInst?.dueDate || date || context.today;
                    const d = new Date(`${baseDate}T12:00:00Z`);
                    d.setMonth(d.getMonth() + 1);
                    const nextDueDate = Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : baseDate;

                    const currentSum = r.installments.reduce((s, i) => s + i.amount, 0);
                    const diff = targetNet - currentSum;
                    const newInst = {
                      id: crypto.randomUUID(),
                      amount: diff > 0 ? diff : 0,
                      dueDate: nextDueDate,
                    };

                    if (diff <= 0) {
                      const studentAcc = students.find((s) => s.id === r.studentId)?.account;
                      const rebalanced = rebalanceInstallments(
                        targetNet,
                        [...r.installments, newInst],
                        studentAcc?.installments ?? [],
                        r.installments[0]?.dueDate || date,
                      );
                      update(r.studentId, { installments: rebalanced });
                    } else {
                      update(r.studentId, { installments: [...r.installments, newInst] });
                    }
                  };

                  const removeInstallment = (instId: string) => {
                    if (r.installments.length <= 1) return;
                    const remaining = r.installments.filter((v) => v.id !== instId);
                    const studentAcc = students.find((s) => s.id === r.studentId)?.account;
                    const rebalanced = rebalanceInstallments(
                      targetNet,
                      remaining,
                      studentAcc?.installments ?? [],
                      remaining[0]?.dueDate || date,
                    );
                    update(r.studentId, { installments: rebalanced });
                  };

                  return (
                    <section className="fee-schedule-editor" style={rows.length === 1 ? { border: 'none', borderRadius: 0, padding: 0, boxShadow: 'none' } : undefined}>
                      {rows.length === 1 ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                          <div>
                            <h3 style={{ margin: 0, fontSize: 18 }}>{titleCase(student.name)}</h3>
                            <small style={{ color: 'var(--muted, #64748b)' }}>Adm {student.code}</small>
                          </div>
                        </div>
                      ) : (
                        <h3>{titleCase(student.name)} · Payment, Bus &amp; Hostel details</h3>
                      )}

                      {/* TUITION, CONCESSION, SCHOLARSHIP */}
                      <div className="fee-facility-cards" style={{ marginTop: 4 }}>
                        <div className="fee-form-grid">
                          <AmountField
                            label="Tuition / Academic Fee (₹)"
                            value={tuitionVal}
                            onChange={(v) => updateBreakdown({ tuitionFee: v })}
                          />
                          <AmountField
                            label="Concession (₹)"
                            value={r.concession}
                            disabled={!canApprove}
                            onChange={(v) => updateWithRebalance(r.studentId, { concession: v })}
                          />
                          <AmountField
                            label="Scholarship (₹)"
                            value={r.scholarship}
                            disabled={!canApprove}
                            onChange={(v) => updateWithRebalance(r.studentId, { scholarship: v })}
                          />
                          <label className="field">
                            Note (optional)
                            <input
                              value={r.reason}
                              maxLength={300}
                              onChange={(e) => update(r.studentId, { reason: e.target.value })}
                            />
                          </label>
                        </div>

                        {/* BUS SERVICE */}
                        <div className={`fee-facility-card ${r.transportActive ? 'active' : ''}`}>
                          <label className="fee-facility-toggle">
                            <input
                              type="checkbox"
                              checked={Boolean(r.transportActive)}
                              onChange={(e) =>
                                updateBreakdown({
                                  transportActive: e.target.checked,
                                  transportMonths: r.transportMonths || 12,
                                })
                              }
                            />
                            <Bus size={16} />
                            <span>School Bus / Transport Service</span>
                          </label>
                          {r.transportActive && (
                            <div className="fee-facility-fields">
                              <AmountField
                                label="Bus fee for active months (₹)"
                                value={r.transportFee ?? 0}
                                onChange={(v) => updateBreakdown({ transportFee: v })}
                              />
                              <label className="field">
                                Active months (Reduce if student stops bus mid-year)
                                <select
                                  value={r.transportMonths || 12}
                                  onChange={(e) => {
                                    const m = Number(e.target.value);
                                    const oldM = r.transportMonths || 12;
                                    const currentBus = r.transportFee ?? 0;
                                    const prorated =
                                      currentBus > 0 && oldM > 0
                                        ? Math.round((currentBus * m) / oldM / 100) * 100
                                        : currentBus;
                                    updateBreakdown({
                                      transportMonths: m,
                                      transportFee: prorated,
                                    });
                                  }}
                                >
                                  {Array.from({ length: 12 }, (_, i) => 12 - i).map((m) => (
                                    <option key={m} value={m}>
                                      {m === 12
                                        ? 'Full year (12 months)'
                                        : `${m} month${m > 1 ? 's' : ''} (Mid-year / Partial)`}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="field">
                                Bus route / stop (optional)
                                <input
                                  value={r.transportRoute ?? ''}
                                  maxLength={120}
                                  placeholder="e.g. Route 3"
                                  onChange={(e) =>
                                    update(r.studentId, { transportRoute: e.target.value })
                                  }
                                />
                              </label>
                            </div>
                          )}
                        </div>

                        {/* HOSTEL SERVICE */}
                        <div className={`fee-facility-card ${r.hostelActive ? 'active' : ''}`}>
                          <label className="fee-facility-toggle">
                            <input
                              type="checkbox"
                              checked={Boolean(r.hostelActive)}
                              onChange={(e) =>
                                updateBreakdown({
                                  hostelActive: e.target.checked,
                                  hostelMonths: r.hostelMonths || 12,
                                })
                              }
                            />
                            <Building2 size={16} />
                            <span>Hostel Facility</span>
                          </label>
                          {r.hostelActive && (
                            <div className="fee-facility-fields">
                              <AmountField
                                label="Hostel fee for active months (₹)"
                                value={r.hostelFee ?? 0}
                                onChange={(v) => updateBreakdown({ hostelFee: v })}
                              />
                              <label className="field">
                                Active months (Reduce if student leaves hostel mid-year)
                                <select
                                  value={r.hostelMonths || 12}
                                  onChange={(e) => {
                                    const m = Number(e.target.value);
                                    const oldM = r.hostelMonths || 12;
                                    const currentHostel = r.hostelFee ?? 0;
                                    const prorated =
                                      currentHostel > 0 && oldM > 0
                                        ? Math.round((currentHostel * m) / oldM / 100) * 100
                                        : currentHostel;
                                    updateBreakdown({
                                      hostelMonths: m,
                                      hostelFee: prorated,
                                    });
                                  }}
                                >
                                  {Array.from({ length: 12 }, (_, i) => 12 - i).map((m) => (
                                    <option key={m} value={m}>
                                      {m === 12
                                        ? 'Full year (12 months)'
                                        : `${m} month${m > 1 ? 's' : ''} (Mid-year / Partial)`}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="field">
                                Room / block (optional)
                                <input
                                  value={r.hostelRoom ?? ''}
                                  maxLength={120}
                                  placeholder="e.g. Room 204"
                                  onChange={(e) =>
                                    update(r.studentId, { hostelRoom: e.target.value })
                                  }
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ALREADY PAID (OPTIONAL) */}
                      <div className="fee-form-grid" style={{ marginTop: 12 }}>
                        <AmountField
                          label="Already paid before onboarding (₹)"
                          value={r.openingPaid}
                          required={false}
                          onChange={(v) =>
                            update(r.studentId, { openingPaid: v, asOf: r.asOf || asOf })
                          }
                        />
                        {r.openingPaid > 0 && (
                          <label className="field">
                            Balance recorded on
                            <CalendarDateInput
                              value={r.asOf}
                              max={context.today}
                              onChange={(e) => update(r.studentId, { asOf: e.target.value })}
                            />
                          </label>
                        )}
                      </div>

                      {/* INSTALLMENT ARRANGEMENT */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '20px 0 8px', flexWrap: 'wrap' }}>
                        <h4 style={{ margin: 0, fontSize: 15 }}>Payment Schedule &amp; Due Dates</h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <label style={{ fontSize: 13, color: 'var(--muted, #64748b)' }}>Installment plan:</label>
                          <select
                            aria-label="Installment plan"
                            style={{
                              padding: '5px 10px',
                              borderRadius: 6,
                              fontSize: 13,
                              border: '1px solid var(--border, #cbd5e1)',
                              background: 'var(--surface, #fff)',
                            }}
                            value={
                              [1, 2, 3, 4, 6, 12].includes(r.installments.length)
                                ? r.installments.length
                                : 'custom'
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'custom') return;
                              const cnt = Number(val);
                              const studentAcc = students.find((s) => s.id === r.studentId)?.account;
                              const firstDue = r.installments[0]?.dueDate || date || context.today;
                              const nextInst = makeInstallments(targetNet, cnt, firstDue, 1);
                              const rebalanced = rebalanceInstallments(
                                targetNet,
                                nextInst,
                                studentAcc?.installments ?? [],
                                firstDue,
                              );
                              update(r.studentId, { installments: rebalanced });
                            }}
                          >
                            <option value={1}>One Time (1 balance)</option>
                            <option value={2}>2 Parts (Equal)</option>
                            <option value={3}>3 Parts (Equal)</option>
                            <option value={4}>4 Parts (Equal)</option>
                            <option value={6}>6 Parts (Equal)</option>
                            <option value={12}>12 Parts (Monthly)</option>
                            {![1, 2, 3, 4, 6, 12].includes(r.installments.length) && (
                              <option value="custom">Custom ({r.installments.length} parts)</option>
                            )}
                          </select>
                        </div>
                      </div>

                      {r.installments.map((i, index) => {
                        const prevInst = student.account?.installments.find((old) => old.id === i.id);
                        const settled = (prevInst?.paid ?? 0) + (prevInst?.openingPaid ?? 0);
                        return (
                          <div className="fee-installment-row" key={i.id}>
                            <span>
                              {r.installments.length === 1
                                ? 'Single balance'
                                : `Installment ${index + 1}`}
                              {settled > 0 && (
                                <small style={{ color: 'var(--green)' }}>
                                  Paid {money(settled)}
                                </small>
                              )}
                            </span>
                            <label className="field">
                              Due date
                              <CalendarDateInput
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
                              required={false}
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
                              disabled={r.installments.length === 1 || settled > 0}
                              onClick={() => removeInstallment(i.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        );
                      })}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={r.installments.length >= 60}
                            onClick={addInstallment}
                          >
                            + Add installment
                          </Button>
                          {schedTotal !== targetNet && (
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => updateWithRebalance(r.studentId, {})}
                            >
                              <Sparkles size={15} /> Auto-balance schedule ({money(targetNet)})
                            </Button>
                          )}
                        </div>
                        <p
                          role="status"
                          style={{
                            margin: 0,
                            fontWeight: 600,
                            color: schedTotal === targetNet ? 'var(--green, #16a34a)' : 'var(--amber, #d97706)',
                          }}
                        >
                          Schedule total: {money(schedTotal)} / {money(targetNet)}
                          {schedTotal === targetNet ? ' ✓' : ` (Diff: ${money(targetNet - schedTotal)})`}
                        </p>
                      </div>

                      <div
                        style={{
                          marginTop: 16,
                          padding: '12px 16px',
                          background: 'var(--surface-sunken, #f8fafc)',
                          borderRadius: 8,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 12,
                        }}
                      >
                        <span>
                          Total agreed fee: <strong>{money(targetNet)}</strong>
                          {r.transportActive && ` · Bus ${money(r.transportFee ?? 0)}`}
                          {r.hostelActive && ` · Hostel ${money(r.hostelFee ?? 0)}`}
                          {(r.concession > 0 || r.scholarship > 0) &&
                            ` · Concession ${money(r.concession + r.scholarship)}`}
                        </span>
                        <span style={{ fontWeight: 600 }}>
                          Payable this year: {money(Math.max(0, targetNet - r.openingPaid))}
                        </span>
                      </div>
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
