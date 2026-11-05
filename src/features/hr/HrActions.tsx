import { useState } from 'react';
import type { HrAdapter, HrPayroll, HrStaff, HrWorkspace } from '../../services/hrService';
import { payrollPaid, rupees } from '../../services/hrService';
import { AmountField, HrForm, SelectField, TextField } from './HrForms';
import { Button, Modal } from '../../components/ui/Primitives';
import { formatCalendarDate } from '../../lib/displayFormat';
export function PayrollDialog({
  adapter,
  staff,
  item,
  month,
  close,
  saved,
}: {
  adapter: HrAdapter;
  staff: HrStaff;
  item?: HrPayroll;
  month: string;
  close: () => void;
  saved: () => void;
}) {
  const [draft, setDraft] = useState({
    month,
    revision: item?.revision ?? 0,
    adjustment: item?.adjustment ?? 0,
    advanceRecovery: item?.advanceRecovery ?? 0,
    note: item?.note ?? '',
  });
  return (
    <HrForm
      title={`Prepare salary · ${staff.name}`}
      description="Review salary and attendance first. This creates a draft, not a payment."
      close={close}
      submit={async () => {
        await adapter.save(`/staff/${staff.id}/payroll`, draft);
        saved();
      }}
    >
      <p>Salary month: {month}</p>
      <div className="form-grid">
        <AmountField
          label="Adjustment (+ bonus / − deduction)"
          signed
          value={draft.adjustment}
          onChange={(adjustment) => setDraft({ ...draft, adjustment })}
        />
        <AmountField
          label="Recover salary advance"
          value={draft.advanceRecovery}
          onChange={(advanceRecovery) => setDraft({ ...draft, advanceRecovery })}
        />
        <TextField
          label="Reason (required for adjustments or recovery)"
          required={false}
          value={draft.note}
          onChange={(note) => setDraft({ ...draft, note })}
        />
      </div>
    </HrForm>
  );
}
export function PaymentDialog({
  adapter,
  data,
  staff,
  item,
  close,
  saved,
}: {
  adapter: HrAdapter;
  data: HrWorkspace;
  staff: HrStaff;
  item?: HrPayroll;
  close: () => void;
  saved: () => void;
}) {
  const [draft, setDraft] = useState(() => ({
    requestKey: crypto.randomUUID(),
    amount: item ? item.net - payrollPaid(item, data) : 0,
    date: data.today,
    method: 'Bank',
    reference: '',
    reason: '',
  }));
  return (
    <HrForm
      title={`${item ? 'Record salary payment' : 'Record advance'} · ${staff.name}`}
      description="Record money already paid. This does not transfer money through a bank."
      close={close}
      submit={async () => {
        await adapter.save(
          item ? `/payroll/${item.id}/payments` : `/staff/${staff.id}/advances`,
          draft,
        );
        saved();
      }}
    >
      {item && <p>Outstanding: {rupees(item.net - payrollPaid(item, data))}</p>}
      <div className="form-grid">
        <AmountField
          label="Amount actually paid"
          value={draft.amount}
          onChange={(amount) => setDraft({ ...draft, amount })}
        />
        <TextField
          type="date"
          label="Payment date"
          value={draft.date}
          onChange={(date) => setDraft({ ...draft, date })}
        />
        <SelectField
          label="Payment method"
          options={['Bank', 'UPI', 'Cash']}
          value={draft.method}
          onChange={(method) => setDraft({ ...draft, method })}
        />
        <TextField
          label="Payment reference"
          required={false}
          value={draft.reference}
          onChange={(reference) => setDraft({ ...draft, reference })}
        />
        {!item && (
          <TextField
            label="Advance reason"
            value={draft.reason}
            onChange={(reason) => setDraft({ ...draft, reason })}
          />
        )}
      </div>
    </HrForm>
  );
}
export function AttendanceDialog({
  adapter,
  data,
  staff,
  date,
  close,
  saved,
}: {
  adapter: HrAdapter;
  data: HrWorkspace;
  staff: HrStaff;
  date: string;
  close: () => void;
  saved: () => void;
}) {
  const day = data.attendance.find((d) => d.staffId === staff.id && d.date === date);
  const [draft, setDraft] = useState({
    date,
    revision: day?.revision ?? 0,
    status:
      day && ['present', 'late', 'half-day', 'absent'].includes(day.status)
        ? day.status
        : 'present',
    decision: day?.decision === 'unpaid' ? 'unpaid' : 'paid',
    unpaidUnits: day?.unpaidUnits ?? 0,
    reason: '',
  });
  return (
    <HrForm
      title={`Review attendance · ${staff.name}`}
      description="Missing punches never deduct salary automatically. A different authorized administrator must review your own attendance."
      close={close}
      submit={async () => {
        await adapter.save(`/staff/${staff.id}/attendance`, draft, 'PUT');
        saved();
      }}
    >
      <p>{formatCalendarDate(date)}</p>
      <div className="form-grid">
        <SelectField
          label="Attendance"
          value={draft.status}
          options={['present', 'late', 'half-day', 'absent']}
          onChange={(status) => setDraft({ ...draft, status, decision: 'paid', unpaidUnits: 0 })}
        />
        <SelectField
          label="Salary decision"
          value={draft.decision}
          options={draft.status === 'present' ? ['paid'] : ['paid', 'unpaid']}
          onChange={(decision) =>
            setDraft({
              ...draft,
              decision,
              unpaidUnits: decision === 'paid' ? 0 : draft.status === 'half-day' ? 0.5 : 1,
            })
          }
        />
        {draft.decision === 'unpaid' && (
          <SelectField
            label="Unpaid days"
            value={String(draft.unpaidUnits)}
            options={draft.status === 'half-day' ? ['0.5'] : ['0.5', '1']}
            onChange={(v) => setDraft({ ...draft, unpaidUnits: Number(v) })}
          />
        )}
        <TextField
          label="Reason for decision / correction (optional)"
          required={false}
          value={draft.reason}
          onChange={(reason) => setDraft({ ...draft, reason })}
        />
      </div>
    </HrForm>
  );
}
export function LeaveDialog({
  decisions = ['approved', 'rejected'],
  adapter,
  data,
  leave,
  close,
  saved,
}: {
  adapter: HrAdapter;
  data: HrWorkspace;
  decisions?: string[];
  leave?: HrWorkspace['leaves'][number];
  close: () => void;
  saved: (start?: string) => void;
}) {
  const [draft, setDraft] = useState({
    start: data.today,
    end: data.today,
    kind: 'casual',
    units: 1,
    reason: '',
  });
  const [review, setReview] = useState({
    revision: leave?.revision ?? 0,
    status: decisions[0] || 'approved',
    paid: true,
    reviewNote: '',
  });
  return (
    <HrForm
      title={leave ? 'Review leave' : 'Request leave'}
      description="Leave requires approval. The reviewer decides whether the approved days are paid."
      close={close}
      submit={async () => {
        await adapter.save(
          leave ? `/leave/${leave.id}` : '/leave',
          leave ? review : draft,
          leave ? 'PUT' : 'POST',
        );
        saved(leave?.start ?? draft.start);
      }}
    >
      <div className="form-grid">
        {leave ? (
          <>
            <p>
              {formatCalendarDate(leave.start)}–{formatCalendarDate(leave.end)} · {leave.reason}
            </p>
            <SelectField
              label="Decision"
              options={decisions}
              value={review.status}
              onChange={(status) => setReview({ ...review, status })}
            />
            <SelectField
              label="Salary treatment"
              options={['Paid', 'Unpaid']}
              value={review.paid ? 'Paid' : 'Unpaid'}
              onChange={(v) => setReview({ ...review, paid: v === 'Paid' })}
            />
            <TextField
              label="Review reason (optional)"
              required={false}
              value={review.reviewNote}
              onChange={(reviewNote) => setReview({ ...review, reviewNote })}
            />
          </>
        ) : (
          <>
            {(['start', 'end'] as const).map((k) => (
              <TextField
                key={k}
                type="date"
                label={k === 'start' ? 'From' : 'Through'}
                value={draft[k]}
                onChange={(v) => setDraft({ ...draft, [k]: v })}
              />
            ))}
            <SelectField
              label="Leave type"
              options={['casual', 'sick', 'other']}
              value={draft.kind}
              onChange={(kind) => setDraft({ ...draft, kind })}
            />
            <SelectField
              label="Duration per day"
              options={['Full day', 'Half day']}
              value={draft.units === 1 ? 'Full day' : 'Half day'}
              onChange={(v) => setDraft({ ...draft, units: v === 'Full day' ? 1 : 0.5 })}
            />
            <TextField
              label="Reason (optional)"
              required={false}
              value={draft.reason}
              onChange={(reason) => setDraft({ ...draft, reason })}
            />
          </>
        )}
      </div>
    </HrForm>
  );
}
export function Payslip({
  item,
  data,
  close,
}: {
  item: HrPayroll;
  data: HrWorkspace;
  close: () => void;
}) {
  return (
    <Modal
      open
      wide
      title={`Salary statement · ${item.name}`}
      description={`${item.month} · ${item.code} · ${item.department}`}
      onClose={close}
    >
      <div className="hr-payslip">
        <h2>
          {item.name} · {item.month}
        </h2>
        <p>
          {item.status === 'draft'
            ? 'Draft — not an approved payslip'
            : 'Approved salary statement'}{' '}
          · Due {formatCalendarDate(item.dueDate)}
        </p>
        <dl className="hr-breakdown">
          {Object.entries({
            Basic: item.basic,
            Allowances: item.allowance,
            Bonus: item.bonus,
            Gross: item.gross,
            'Unpaid attendance deduction': item.leaveDeduction,
            'Regular deduction': item.manualDeduction,
            Adjustment: item.adjustment,
            'Advance recovery': item.advanceRecovery,
            'Net salary': item.net,
            Paid: payrollPaid(item, data),
            Outstanding: item.net - payrollPaid(item, data),
          }).map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{rupees(v)}</dd>
            </div>
          ))}
        </dl>
        <p>
          Unpaid days: {item.unpaidUnits}. {item.note}
        </p>
        <h3>Payment history</h3>
        {data.payments
          .filter((p) => p.payrollId === item.id)
          .map((p) => (
            <p key={p.id}>
              {formatCalendarDate(p.date)} · {rupees(p.amount)} · {p.method} ·{' '}
              {p.reference || 'No reference'}
            </p>
          ))}
        {!!item.unresolved.length && (
          <>
            <h3>Needs review</h3>
            <ul>
              {item.unresolved.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          </>
        )}
      </div>
      <Button onClick={() => window.print()}>Print / save PDF</Button>
    </Modal>
  );
}
