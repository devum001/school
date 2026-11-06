import { useState } from 'react';
import type { HrAdapter, HrPayroll, HrStaff, HrWorkspace } from '../../services/hrService';
import { payrollPaid, rupees } from '../../services/hrService';
import { Button, Modal } from '../../components/ui/Primitives';
import { AmountField, SelectField, TextField } from './HrForms';
import { AlertCircle, Info, Wallet } from 'lucide-react';

export function PaySalaryDialog({
  adapter,
  data,
  staff,
  item,
  month,
  close,
  saved,
}: {
  adapter: HrAdapter;
  data: HrWorkspace;
  staff: HrStaff;
  item?: HrPayroll;
  month: string;
  close: () => void;
  saved: () => void;
}) {
  const emp = data.employment.find((e) => e.staffId === staff.id);
  const salaryConfig = emp?.salaries.filter((sal) => sal.effectiveMonth <= month).at(-1);

    const configuredGross = (salaryConfig?.basic ?? 0) + (salaryConfig?.allowance ?? 0) + (salaryConfig?.bonus ?? 0);
  const configuredDeduction = salaryConfig?.deduction ?? 0;
  const configuredNet = Math.max(0, configuredGross - configuredDeduction);

  const netSalary = item ? item.net : configuredNet;
  const grossSalary = item ? item.gross : configuredGross;
  const leaveDeduction = item ? item.leaveDeduction : 0;
  const regularDeduction = item ? item.manualDeduction : configuredDeduction;
  const paidAlready = item ? payrollPaid(item, data) : 0;
  const outstandingInitial = Math.max(0, netSalary - paidAlready);

  const advanceRecord = data.advanceBalances?.find((a) => a.staffId === staff.id);
  const advanceBalance = advanceRecord?.balance ?? 0;

  const [advanceAdjusted, setAdvanceAdjusted] = useState(false);
  const [advanceRecovery, setAdvanceRecovery] = useState(item?.advanceRecovery ?? 0);
  const [amount, setAmount] = useState(() => Math.max(0, outstandingInitial - (item?.advanceRecovery ?? 0)));
  const [date, setDate] = useState(data.today);
  const [method, setMethod] = useState<'Bank' | 'UPI' | 'Cash' | 'Cheque'>('Bank');
  const [reference, setReference] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepStatus, setStepStatus] = useState('');
  const [error, setError] = useState('');

  const toggleAdvanceAdjustment = () => {
    if (advanceAdjusted) {
      setAdvanceAdjusted(false);
      setAdvanceRecovery(0);
      setAmount(outstandingInitial);
    } else {
      const recovery = Math.min(outstandingInitial, advanceBalance);
      setAdvanceAdjusted(true);
      setAdvanceRecovery(recovery);
      setAmount(Math.max(0, outstandingInitial - recovery));
    }
  };

  const handlePay = async () => {
    if (amount <= 0 && advanceRecovery <= 0) {
      setError('Please enter a payment amount or adjust an advance.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      let currentItem = item;

      // 1. Prepare draft if it doesn't exist, or update draft advanceRecovery if changed
      if (!currentItem) {
        setStepStatus('Preparing salary draft…');
        currentItem = (await adapter.save(`/staff/${staff.id}/payroll`, {
          month,
          revision: 0,
          adjustment: 0,
          advanceRecovery,
          note: advanceRecovery > 0 ? 'Advance adjusted in salary payout' : '',
        })) as HrPayroll;
      } else if (currentItem.status === 'draft' && currentItem.advanceRecovery !== advanceRecovery) {
        setStepStatus('Updating advance recovery…');
        currentItem = (await adapter.save(`/staff/${staff.id}/payroll`, {
          month,
          revision: currentItem.revision,
          adjustment: currentItem.adjustment || 0,
          advanceRecovery,
          note: currentItem.note || (advanceRecovery > 0 ? 'Advance adjusted in salary payout' : ''),
        })) as HrPayroll;
      }

      // 2. Ensure payroll is approved (bypass unreviewed daily punch blockers with force=true)
      if (currentItem.status !== 'approved') {
        setStepStatus('Approving payroll…');
        try {
          currentItem = (await adapter.save(`/payroll/${currentItem.id}/approve`, {
            revision: currentItem.revision,
            force: true,
          })) as HrPayroll;
        } catch (approveErr: unknown) {
          const msg = approveErr instanceof Error ? approveErr.message : String(approveErr);
          if (msg.includes('stale') || msg.includes('HR_STALE')) {
            const refreshed = (await adapter.save(`/staff/${staff.id}/payroll`, {
              month,
              revision: currentItem.revision,
              adjustment: currentItem.adjustment || 0,
              advanceRecovery,
              note: currentItem.note || 'Synced before approval',
            })) as HrPayroll;
            currentItem = (await adapter.save(`/payroll/${refreshed.id}/approve`, {
              revision: refreshed.revision,
              force: true,
            })) as HrPayroll;
          } else {
            throw approveErr;
          }
        }
      }

      // 3. Record payment if amount > 0
      if (amount > 0) {
        setStepStatus('Recording payment…');
        await adapter.save(`/payroll/${currentItem.id}/payments`, {
          requestKey: crypto.randomUUID(),
          amount,
          date,
          method,
          reference: method === 'Cheque' && reference ? `Cheque: ${reference}` : reference,
        });
      }

      setStepStatus('Done!');
      saved();
      close();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed to process salary payment.');
      setStepStatus('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open
      wide
      title={`Pay Salary · ${staff.name}`}
      description={`Monthly salary disbursement for ${month} · Department: ${staff.department || 'General'}`}
      onClose={close}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 0' }}>
        {/* Salary Highlights Card */}
        <div
          style={{
            background: 'var(--panel-alt, #f8fafc)',
            border: '1px solid var(--border-subtle, #e2e8f0)',
            borderRadius: '12px',
            padding: '16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Gross Salary</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>{rupees(grossSalary)}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Deductions</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#e11d48' }}>
              {rupees(regularDeduction + leaveDeduction)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Net Monthly Salary</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f766e' }}>{rupees(netSalary)}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Remaining Due</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#b45309' }}>
              {rupees(Math.max(0, outstandingInitial - advanceRecovery))}
            </div>
          </div>
        </div>

        {/* Advance Balance Alert and 1-Click Adjustment */}
        {advanceBalance > 0 && (
          <div
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Wallet size={20} style={{ color: '#2563eb', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e40af' }}>
                  Advance Balance Available: {rupees(advanceBalance)}
                </div>
                <div style={{ fontSize: '12px', color: '#3b82f6' }}>
                  {advanceAdjusted
                    ? `${rupees(advanceRecovery)} will be recovered from this salary payment.`
                    : 'Staff took an advance earlier. You can settle it against this month\'s salary.'}
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant={advanceAdjusted ? 'secondary' : 'primary'}
              onClick={toggleAdvanceAdjustment}
              style={{
                fontSize: '12px',
                padding: '6px 12px',
                background: advanceAdjusted ? '#ffffff' : '#2563eb',
                color: advanceAdjusted ? '#1e40af' : '#ffffff',
                border: '1px solid #93c5fd',
              }}
            >
              {advanceAdjusted ? 'Remove Advance Adjustment' : `Adjust ${rupees(Math.min(outstandingInitial, advanceBalance))} Advance`}
            </Button>
          </div>
        )}

        {/* Attendance informational notice */}
        {item?.unresolved && item.unresolved.length > 0 && (
          <div
            style={{
              background: '#fefce8',
              border: '1px solid #fef08a',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '12px',
              color: '#854d0e',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Info size={16} style={{ color: '#ca8a04', flexShrink: 0 }} />
            <span>
              {item.unresolved.length} attendance issue(s) recorded for this month. Salary payment can proceed directly.
            </span>
          </div>
        )}

        {/* Payment Input Fields */}
        <div className="form-grid" style={{ marginTop: '4px' }}>
          <AmountField
            label="Payment amount"
            value={amount}
            onChange={(val) => setAmount(Math.max(0, val))}
          />
          <TextField
            type="date"
            label="Payment date"
            value={date}
            onChange={(val) => setDate(val)}
          />
          <SelectField
            label="Payment method"
            options={['Bank', 'UPI', 'Cash', 'Cheque']}
            value={method}
            onChange={(val) => setMethod(val as 'Bank' | 'UPI' | 'Cash' | 'Cheque')}
          />
          <TextField
            label="Reference (UTR / Cheque no / Note)"
            required={false}
            value={reference}
            onChange={(val) => setReference(val)}
          />
        </div>

        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={18} style={{ color: '#dc2626', flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {stepStatus && (
          <div style={{ fontSize: '13px', color: '#0f766e', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="spinner" style={{ width: '14px', height: '14px', border: '2px solid #0f766e', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            {stepStatus}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
          <Button variant="secondary" onClick={close} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handlePay}
            disabled={isSubmitting || (amount <= 0 && advanceRecovery <= 0)}
            style={{ minWidth: '150px' }}
          >
            {isSubmitting ? (
              'Processing…'
            ) : amount > 0 ? (
              `Confirm & Pay ${rupees(amount)}`
            ) : (
              'Settle from Advance'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function BulkPaySalaryDialog({
  adapter,
  data,
  pendingStaff,
  month,
  close,
  saved,
}: {
  adapter: HrAdapter;
  data: HrWorkspace;
  pendingStaff: Array<{
    staff: HrStaff;
    item?: HrPayroll;
    pendingAmount: number;
  }>;
  month: string;
  close: () => void;
  saved: () => void;
}) {
  const totalPending = pendingStaff.reduce((s, p) => s + p.pendingAmount, 0);
  const [method, setMethod] = useState<'Bank' | 'UPI' | 'Cash' | 'Cheque'>('Bank');
  const [date, setDate] = useState(data.today);
  const [reference, setReference] = useState(`Bulk salary ${month}`);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [error, setError] = useState('');

  const handleBulkPay = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      for (let i = 0; i < pendingStaff.length; i++) {
        const { staff, item, pendingAmount } = pendingStaff[i];
        setCurrentIdx(i + 1);

        let currentItem = item;
        // 1. Prepare draft if needed
        if (!currentItem) {
          currentItem = (await adapter.save(`/staff/${staff.id}/payroll`, {
            month,
            revision: 0,
            adjustment: 0,
            advanceRecovery: 0,
            note: 'Prepared in bulk payment',
          })) as HrPayroll;
        }

        // 2. Approve payroll with force=true
        if (currentItem.status !== 'approved') {
          try {
            currentItem = (await adapter.save(`/payroll/${currentItem.id}/approve`, {
              revision: currentItem.revision,
              force: true,
            })) as HrPayroll;
          } catch (approveErr: unknown) {
            const msg = approveErr instanceof Error ? approveErr.message : String(approveErr);
            if (msg.includes('stale') || msg.includes('HR_STALE')) {
              const refreshed = (await adapter.save(`/staff/${staff.id}/payroll`, {
                month,
                revision: currentItem.revision,
                adjustment: currentItem.adjustment || 0,
                advanceRecovery: 0,
                note: 'Synced in bulk payment',
              })) as HrPayroll;
              currentItem = (await adapter.save(`/payroll/${refreshed.id}/approve`, {
                revision: refreshed.revision,
                force: true,
              })) as HrPayroll;
            } else {
              throw approveErr;
            }
          }
        }

        // 3. Record payment
        if (pendingAmount > 0) {
          await adapter.save(`/payroll/${currentItem.id}/payments`, {
            requestKey: crypto.randomUUID(),
            amount: pendingAmount,
            date,
            method,
            reference: method === 'Cheque' && reference ? `Cheque: ${reference}` : reference,
          });
        }
      }

      saved();
      close();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Failed during bulk payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open
      wide
      title={`Pay All Pending Salaries (${pendingStaff.length} Staff)`}
      description={`Disburse salaries for ${month} in one click`}
      onClose={close}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 0' }}>
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '10px',
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '13px', color: '#166534', fontWeight: 600 }}>Total Disbursement</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#15803d' }}>{rupees(totalPending)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '13px', color: '#166534' }}>Staff Members</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#15803d' }}>{pendingStaff.length}</div>
          </div>
        </div>

        <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px' }}>
          {pendingStaff.map(({ staff, pendingAmount }) => (
            <div
              key={staff.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 0',
                borderBottom: '1px solid #f1f5f9',
                fontSize: '13px',
              }}
            >
              <span>{staff.name} <small style={{ color: '#64748b' }}>({staff.department || 'Staff'})</small></span>
              <strong style={{ color: '#0f766e' }}>{rupees(pendingAmount)}</strong>
            </div>
          ))}
        </div>

        <div className="form-grid">
          <TextField
            type="date"
            label="Payment date"
            value={date}
            onChange={(val) => setDate(val)}
          />
          <SelectField
            label="Payment method"
            options={['Bank', 'UPI', 'Cash', 'Cheque']}
            value={method}
            onChange={(val) => setMethod(val as 'Bank' | 'UPI' | 'Cash' | 'Cheque')}
          />
          <TextField
            label="Payment reference"
            required={false}
            value={reference}
            onChange={(val) => setReference(val)}
          />
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px', borderRadius: '8px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        {isSubmitting && (
          <div style={{ fontSize: '13px', color: '#0f766e', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="spinner" style={{ width: '14px', height: '14px', border: '2px solid #0f766e', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            Processing {currentIdx} of {pendingStaff.length}: {pendingStaff[currentIdx - 1]?.staff.name}…
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
          <Button variant="secondary" onClick={close} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleBulkPay}
            disabled={isSubmitting || pendingStaff.length === 0}
          >
            {isSubmitting ? 'Paying…' : `Pay All (${pendingStaff.length} Staff · ${rupees(totalPending)})`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
