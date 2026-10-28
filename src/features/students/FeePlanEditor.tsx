import { Bus, Building2, Plus, Sparkles } from 'lucide-react';
import { AppIcon, PickerInput, Button } from '../../components/ui/Primitives';
import { installmentName } from '../../lib/feeLabels';
import { money } from '../../lib/config';
import { makeInstallments, rebalanceInstallments } from '../../services/feeService';
import '../../styles/ledgers.css';
import { computeNetRupees, type FeePlanDraft } from '../../lib/feePlanDraft';

export default function FeePlanEditor({
  value,
  onChange,
  required,
  defaultDueDate = '',
  showExtendedFields = true,
}: {
  value: FeePlanDraft;
  onChange: (draft: FeePlanDraft) => void;
  required: boolean;
  defaultDueDate?: string;
  showExtendedFields?: boolean;
}) {
  const hasFacilities = Boolean(
    value.transportActive ||
      value.hostelActive ||
      Number(value.discountAmount || 0) > 0,
  );

  const syncWithNewAmounts = (patch: Partial<FeePlanDraft>, autoRebalance = true) => {
    const next: FeePlanDraft = { ...value, ...patch };
    const netStr = computeNetRupees(next, next.totalFee);
    next.totalFee = netStr;

    const netPaise = Math.max(0, Math.round(Number(netStr || 0) * 100));
    if (autoRebalance && next.kind === 'Installments' && netPaise > 0) {
      const existingRows = next.installments.map((inst, idx) => ({
        id: inst.id || `inst-${idx + 1}`,
        amount: Math.max(0, Math.round(Number(inst.amount || 0) * 100)),
        dueDate: inst.dueDate || defaultDueDate || new Date().toISOString().slice(0, 10),
        paid: inst.paid ?? 0,
        openingPaid: inst.openingPaid ?? 0,
      }));
      const rebalanced = rebalanceInstallments(
        netPaise,
        existingRows.map(({ id, amount, dueDate }) => ({ id, amount, dueDate })),
        existingRows,
        defaultDueDate || new Date().toISOString().slice(0, 10),
      );
      next.installments = rebalanced.map((r) => {
        const old = next.installments.find((item) => item.id === r.id);
        return {
          id: r.id,
          amount: String(r.amount / 100),
          dueDate: r.dueDate,
          paid: old?.paid,
          openingPaid: old?.openingPaid,
        };
      });
    } else if (next.kind === 'One Time' && next.installments.length > 0) {
      next.installments = [
        {
          ...next.installments[0],
          amount: netStr,
          dueDate: next.installments[0].dueDate || defaultDueDate,
        },
      ];
    }
    onChange(next);
  };

  const applyQuickSplit = (count: number) => {
    const netPaise = Math.max(0, Math.round(Number(value.totalFee || 0) * 100));
    const startDue =
      value.installments[0]?.dueDate || defaultDueDate || new Date().toISOString().slice(0, 10);
    const paidRows = value.installments.filter(
      (inst) => (inst.paid ?? 0) + (inst.openingPaid ?? 0) > 0,
    );
    if (paidRows.length === 0 && netPaise > 0) {
      const generated = makeInstallments(netPaise, count, startDue, count <= 4 ? 3 : 1);
      onChange({
        ...value,
        kind: 'Installments',
        installments: generated.map((g) => ({
          id: g.id,
          amount: String(g.amount / 100),
          dueDate: g.dueDate,
        })),
      });
      return;
    }
    const targetRows = Array.from({ length: Math.max(count, paidRows.length) }, (_, idx) => {
      const existing = value.installments[idx];
      if (existing) return existing;
      const generated = makeInstallments(Math.max(netPaise, 100), count, startDue, 1)[idx];
      return {
        id: `inst-${idx + 1}`,
        amount: '0',
        dueDate: generated?.dueDate || startDue,
      };
    });
    const existingForBalance = targetRows.map((inst, idx) => ({
      id: inst.id || `inst-${idx + 1}`,
      amount: Math.max(0, Math.round(Number(inst.amount || 0) * 100)),
      dueDate: inst.dueDate || startDue,
      paid: inst.paid ?? 0,
      openingPaid: inst.openingPaid ?? 0,
    }));
    const balanced = rebalanceInstallments(
      netPaise,
      existingForBalance.map(({ id, amount, dueDate }) => ({ id, amount, dueDate })),
      existingForBalance,
      startDue,
    );
    onChange({
      ...value,
      kind: 'Installments',
      installments: balanced.map((r) => {
        const old = targetRows.find((item) => item.id === r.id);
        return {
          id: r.id,
          amount: String(r.amount / 100),
          dueDate: r.dueDate,
          paid: old?.paid,
          openingPaid: old?.openingPaid,
        };
      }),
    });
  };

  const total =
    value.kind === 'One Time'
      ? Math.round(Number(value.totalFee || 0) * 100)
      : value.installments.reduce(
          (sum, item) => sum + Math.round(Number(item.amount || 0) * 100),
          0,
        );

  const tuitionPaise = Math.round(
    Number((hasFacilities ? value.tuitionFee : value.totalFee) || 0) * 100,
  );
  const busPaise = value.transportActive
    ? Math.round(Number(value.transportFee || 0) * 100)
    : 0;
  const hostelPaise = value.hostelActive
    ? Math.round(Number(value.hostelFee || 0) * 100)
    : 0;
  const discountPaise = Math.round(Number(value.discountAmount || 0) * 100);
  const netTargetPaise = Math.round(Number(value.totalFee || 0) * 100);

  return (
    <div className="fee-plan-editor">
      <div className="fee-plan-header-row">
        <div>
          <h3 className="management-form-title" style={{ margin: 0 }}>
            Fee &amp; facilities setup
          </h3>
          <p className="panel-note" style={{ margin: '4px 0 0' }}>
            Configure tuition fee, optional school bus or hostel service, concessions, and payment
            schedule in one place.
          </p>
        </div>
      </div>

      <fieldset className="fee-plan-types">
        <legend>Fee Type</legend>
        {(['One Time', 'Installments'] as const).map((kind) => (
          <label key={kind}>
            <input
              type="radio"
              name="student-fee-type"
              checked={value.kind === kind}
              onChange={() => {
                if (kind === 'One Time') {
                  onChange({
                    ...value,
                    kind,
                    installments: [
                      {
                        ...value.installments[0],
                        amount: value.totalFee,
                        dueDate: value.installments[0]?.dueDate || defaultDueDate,
                      },
                    ],
                  });
                } else {
                  const netPaise = Math.max(0, Math.round(Number(value.totalFee || 0) * 100));
                  const startDue =
                    value.installments[0]?.dueDate ||
                    defaultDueDate ||
                    new Date().toISOString().slice(0, 10);
                  if (value.installments.length <= 1 && netPaise > 0) {
                    const split = makeInstallments(netPaise, 2, startDue, 3);
                    onChange({
                      ...value,
                      kind,
                      installments: split.map((s) => ({
                        id: s.id,
                        amount: String(s.amount / 100),
                        dueDate: s.dueDate,
                      })),
                    });
                  } else {
                    onChange({ ...value, kind });
                  }
                }
              }}
            />{' '}
            {kind}
          </label>
        ))}
      </fieldset>

      <div className="form-grid">
        <label className="field">
          {hasFacilities ? 'Tuition / Academic Fee (₹)' : 'Total Fee (₹)'}
          <input
            aria-label="Total Fee"
            required={required && !value.transportActive && !value.hostelActive}
            type="text"
            inputMode="decimal"
            pattern="[0-9]+([.][0-9]{1,2})?"
            placeholder="e.g. 24000"
            value={hasFacilities ? (value.tuitionFee ?? value.totalFee) : value.totalFee}
            onChange={(e) => {
              const val = e.target.value;
              if (hasFacilities) {
                syncWithNewAmounts({ tuitionFee: val }, true);
              } else {
                onChange({
                  ...value,
                  totalFee: val,
                  tuitionFee: val,
                });
              }
            }}
          />
        </label>

        {showExtendedFields && (
          <label className="field">
            Concession / Discount (₹)
            <input
              aria-label="Student concession (₹)"
              type="text"
              inputMode="decimal"
              pattern="[0-9]+([.][0-9]{1,2})?"
              placeholder="0 (optional)"
              value={value.discountAmount ?? ''}
              onChange={(e) =>
                syncWithNewAmounts(
                  {
                    tuitionFee: value.tuitionFee ?? value.totalFee,
                    discountAmount: e.target.value,
                  },
                  true,
                )
              }
            />
          </label>
        )}

        {value.kind === 'One Time' && showExtendedFields && (
          <label className="field">
            Paid Now / Partial Paid (₹)
            <input
              aria-label="One time paid now (₹)"
              type="text"
              inputMode="decimal"
              pattern="[0-9]+([.][0-9]{1,2})?"
              placeholder={
                netTargetPaise > 0
                  ? `0 to ${Math.round(netTargetPaise / 100)} (optional if leaving balance)`
                  : '0 (optional if paying partial now)'
              }
              value={value.openingPaid ?? ''}
              onChange={(e) => onChange({ ...value, openingPaid: e.target.value })}
            />
            {netTargetPaise > 0 && Number(value.openingPaid || 0) > 0 && (
              <small className="panel-note" style={{ marginTop: 4 }}>
                {Math.round(Number(value.openingPaid || 0) * 100) >= netTargetPaise
                  ? 'Full one-time fee marked as paid.'
                  : `Remaining balance pending: ${money(
                      Math.max(0, netTargetPaise - Math.round(Number(value.openingPaid || 0) * 100)),
                    )}`}
              </small>
            )}
          </label>
        )}

        {value.kind === 'One Time' &&
          showExtendedFields &&
          netTargetPaise > 0 &&
          Number(value.openingPaid || 0) > 0 &&
          Math.round(Number(value.openingPaid || 0) * 100) < netTargetPaise && (
            <label className="field">
              Remaining Balance Due Date (optional)
              <PickerInput
                aria-label="Remaining balance due date"
                type="date"
                value={value.installments[0]?.dueDate ?? ''}
                onChange={(e) =>
                  onChange({
                    ...value,
                    installments: [{ ...value.installments[0], dueDate: e.target.value }],
                  })
                }
              />
            </label>
          )}
      </div>

      {showExtendedFields && (
        <div className="fee-facility-cards">
          {/* BUS / TRANSPORT SERVICE */}
          <div className={`fee-facility-card ${value.transportActive ? 'active' : ''}`}>
            <label className="fee-facility-toggle">
              <input
                type="checkbox"
                checked={Boolean(value.transportActive)}
                onChange={(e) => {
                  const active = e.target.checked;
                  syncWithNewAmounts(
                    {
                      tuitionFee: value.tuitionFee ?? value.totalFee,
                      transportActive: active,
                      transportMonths: value.transportMonths || 12,
                    },
                    true,
                  );
                }}
              />
              <Bus size={16} />
              <span>Uses School Bus / Transport</span>
            </label>

            {value.transportActive && (
              <div className="fee-facility-fields">
                <label className="field">
                  Bus Fee for Selected Months (₹)
                  <input
                    aria-label="Bus fee (₹)"
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 6000"
                    value={value.transportFee ?? ''}
                    onChange={(e) =>
                      syncWithNewAmounts(
                        {
                          tuitionFee: value.tuitionFee ?? value.totalFee,
                          transportFee: e.target.value,
                          transportAnnualFee:
                            (value.transportMonths ?? 12) === 12
                              ? e.target.value
                              : value.transportAnnualFee,
                        },
                        true,
                      )
                    }
                  />
                </label>
                <label className="field">
                  Active Months (Mid-year join / stop)
                  <select
                    aria-label="Bus active months"
                    value={value.transportMonths ?? 12}
                    onChange={(e) => {
                      const months = Number(e.target.value);
                      const baseYearly = Number(
                        value.transportAnnualFee || value.transportFee || 0,
                      );
                      const prorated =
                        baseYearly > 0 ? String(Math.round((baseYearly * months) / 12)) : '';
                      syncWithNewAmounts(
                        {
                          tuitionFee: value.tuitionFee ?? value.totalFee,
                          transportMonths: months,
                          transportAnnualFee:
                            value.transportAnnualFee || value.transportFee || '',
                          transportFee: prorated || value.transportFee,
                        },
                        true,
                      );
                    }}
                  >
                    {Array.from({ length: 12 }, (_, i) => 12 - i).map((m) => (
                      <option key={m} value={m}>
                        {m === 12
                          ? 'Full academic year (12 months)'
                          : `${m} month${m > 1 ? 's' : ''} (Pro-rated / Mid-year)`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Bus Route / Stop (optional)
                  <input
                    aria-label="Bus route or stop"
                    type="text"
                    maxLength={120}
                    placeholder="e.g. Route 2 - Main Market"
                    value={value.transportRoute ?? ''}
                    onChange={(e) => onChange({ ...value, transportRoute: e.target.value })}
                  />
                </label>
              </div>
            )}
          </div>

          {/* HOSTEL SERVICE */}
          <div className={`fee-facility-card ${value.hostelActive ? 'active' : ''}`}>
            <label className="fee-facility-toggle">
              <input
                type="checkbox"
                checked={Boolean(value.hostelActive)}
                onChange={(e) => {
                  const active = e.target.checked;
                  syncWithNewAmounts(
                    {
                      tuitionFee: value.tuitionFee ?? value.totalFee,
                      hostelActive: active,
                      hostelMonths: value.hostelMonths || 12,
                    },
                    true,
                  );
                }}
              />
              <Building2 size={16} />
              <span>Stays in School Hostel</span>
            </label>

            {value.hostelActive && (
              <div className="fee-facility-fields">
                <label className="field">
                  Hostel Fee for Selected Months (₹)
                  <input
                    aria-label="Hostel fee (₹)"
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 18000"
                    value={value.hostelFee ?? ''}
                    onChange={(e) =>
                      syncWithNewAmounts(
                        {
                          tuitionFee: value.tuitionFee ?? value.totalFee,
                          hostelFee: e.target.value,
                          hostelAnnualFee:
                            (value.hostelMonths ?? 12) === 12
                              ? e.target.value
                              : value.hostelAnnualFee,
                        },
                        true,
                      )
                    }
                  />
                </label>
                <label className="field">
                  Active Months (Mid-year join / leave)
                  <select
                    aria-label="Hostel active months"
                    value={value.hostelMonths ?? 12}
                    onChange={(e) => {
                      const months = Number(e.target.value);
                      const baseYearly = Number(value.hostelAnnualFee || value.hostelFee || 0);
                      const prorated =
                        baseYearly > 0 ? String(Math.round((baseYearly * months) / 12)) : '';
                      syncWithNewAmounts(
                        {
                          tuitionFee: value.tuitionFee ?? value.totalFee,
                          hostelMonths: months,
                          hostelAnnualFee: value.hostelAnnualFee || value.hostelFee || '',
                          hostelFee: prorated || value.hostelFee,
                        },
                        true,
                      );
                    }}
                  >
                    {Array.from({ length: 12 }, (_, i) => 12 - i).map((m) => (
                      <option key={m} value={m}>
                        {m === 12
                          ? 'Full academic year (12 months)'
                          : `${m} month${m > 1 ? 's' : ''} (Pro-rated / Mid-year)`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Room / Hostel Block (optional)
                  <input
                    aria-label="Hostel room or note"
                    type="text"
                    maxLength={120}
                    placeholder="e.g. Boys Wing - Room 104"
                    value={value.hostelRoom ?? ''}
                    onChange={(e) => onChange({ ...value, hostelRoom: e.target.value })}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Breakdown Banner when facilities or discounts are active */}
      {hasFacilities && (
        <div className="fee-breakdown-summary">
          <div className="fee-breakdown-items">
            <span>
              Tuition: <strong className="currency-cell">{money(tuitionPaise)}</strong>
            </span>
            {value.transportActive && (
              <span>
                + Bus ({value.transportMonths ?? 12}m):{' '}
                <strong className="currency-cell">{money(busPaise)}</strong>
              </span>
            )}
            {value.hostelActive && (
              <span>
                + Hostel ({value.hostelMonths ?? 12}m):{' '}
                <strong className="currency-cell">{money(hostelPaise)}</strong>
              </span>
            )}
            {discountPaise > 0 && (
              <span>
                − Concession: <strong className="currency-cell">{money(discountPaise)}</strong>
              </span>
            )}
          </div>
          <div className="fee-breakdown-net">
            <span>Net Current Year Fee:</span>
            <strong className="currency-cell">{money(netTargetPaise)}</strong>
          </div>
        </div>
      )}

      {value.kind === 'Installments' && (
        <>
          {showExtendedFields && (
            <div className="fee-quick-split-bar">
              <span>Quick split installments:</span>
              {[2, 3, 4, 6, 12].map((count) => (
                <button
                  key={count}
                  type="button"
                  className="fee-split-pill"
                  onClick={() => applyQuickSplit(count)}
                >
                  {count} parts
                </button>
              ))}
              {total !== netTargetPaise && netTargetPaise > 0 && (
                <button
                  type="button"
                  className="fee-split-pill rebalance"
                  onClick={() => syncWithNewAmounts({}, true)}
                >
                  <Sparkles size={13} /> Auto-balance unpaid ({money(netTargetPaise)})
                </button>
              )}
            </div>
          )}

          {value.installments.map((item, index) => {
            const settledPaise = (item.paid ?? 0) + (item.openingPaid ?? 0);
            return (
              <div className="fee-installment-row" key={item.id ?? index}>
                <label className="field">
                  <span>
                    {installmentName(index + 1)} Amount (₹)
                    {settledPaise > 0 ? (
                      <small style={{ color: 'var(--green)', marginLeft: 6 }}>
                        (Paid: {money(settledPaise)})
                      </small>
                    ) : null}
                  </span>
                  <input
                    aria-label={`Installment ${index + 1} amount`}
                    required={required}
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]+([.][0-9]{1,2})?"
                    value={item.amount}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        installments: value.installments.map((entry, i) =>
                          i === index ? { ...entry, amount: e.target.value } : entry,
                        ),
                      })
                    }
                  />
                </label>
                <label className="field">
                  Due Date
                  <PickerInput
                    aria-label={`Installment ${index + 1} due date`}
                    required={required}
                    type="date"
                    value={item.dueDate}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        installments: value.installments.map((entry, i) =>
                          i === index ? { ...entry, dueDate: e.target.value } : entry,
                        ),
                      })
                    }
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={`Remove installment ${index + 1}`}
                  disabled={value.installments.length === 1 || settledPaise > 0}
                  onClick={() =>
                    onChange({
                      ...value,
                      installments: value.installments.filter((_, i) => i !== index),
                    })
                  }
                >
                  <AppIcon name="delete" size={16} />
                </Button>
              </div>
            );
          })}
          <Button
            type="button"
            variant="secondary"
            disabled={value.installments.length >= 60}
            onClick={() =>
              onChange({
                ...value,
                installments: [
                  ...value.installments,
                  { amount: '', dueDate: defaultDueDate },
                ],
              })
            }
          >
            <Plus size={15} /> Add Installment
          </Button>
          <div className="fee-plan-total">
            <span>Installment total</span>
            <strong className="currency-cell">{money(total)}</strong>
          </div>
          {total !== netTargetPaise && (
            <p className="panel-note">Installment amounts must add up to Total Fee.</p>
          )}
        </>
      )}
    </div>
  );
}
