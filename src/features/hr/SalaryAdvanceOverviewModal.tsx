import { Modal } from '../../components/ui/Primitives';
import { formatCalendarDate, titleCase } from '../../lib/displayFormat';
import { rupees, type HrWorkspace } from '../../services/hrService';

export interface SalaryAdvanceOverviewModalProps {
  open: boolean;
  onClose: () => void;
  staff: {
    id: string;
    name: string;
    department?: string;
    designation?: string;
  };
  data: HrWorkspace;
  onGiveAdvance?: () => void;
  canGiveAdvance?: boolean;
}

export default function SalaryAdvanceOverviewModal({
  open,
  onClose,
  staff,
  data,
  onGiveAdvance,
  canGiveAdvance = false,
}: SalaryAdvanceOverviewModalProps) {
  if (!open) return null;

  const staffAdvance = data.advanceBalances?.find((a) => a.staffId === staff.id);
  const totalTaken = staffAdvance?.issued ?? 0;
  const totalRecovered = staffAdvance?.recovered ?? 0;
  const remainingBalance = staffAdvance?.balance ?? 0;
  const advanceHistory = (data.advances || []).filter((a) => a.staffId === staff.id);

  const deptDesig = [titleCase(staff.department || ''), titleCase(staff.designation || '')]
    .filter(Boolean)
    .join(' • ');

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={`Salary Advance Overview · ${titleCase(staff.name)}`}
      description={deptDesig || 'Monthly staff advance balance and disbursement history.'}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* 3 Summary Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
          }}
        >
          <div
            style={{
              padding: '14px 16px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
            }}
          >
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
              Total Advance Taken
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
              {rupees(totalTaken)}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              Total advance issued
            </div>
          </div>

          <div
            style={{
              padding: '14px 16px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
            }}
          >
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
              Advance Recovered
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f766e', marginTop: '4px' }}>
              {rupees(totalRecovered)}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              Deducted from salary
            </div>
          </div>

          <div
            style={{
              padding: '14px 16px',
              background: remainingBalance > 0 ? '#fffbeb' : '#f8fafc',
              border: `1px solid ${remainingBalance > 0 ? '#fde68a' : '#e2e8f0'}`,
              borderRadius: '8px',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                color: remainingBalance > 0 ? '#92400e' : '#64748b',
                fontWeight: 600,
              }}
            >
              Remaining Balance
            </div>
            <div
              style={{
                fontSize: '20px',
                fontWeight: 700,
                color: remainingBalance > 0 ? '#b45309' : '#0f172a',
                marginTop: '4px',
              }}
            >
              {rupees(remainingBalance)}
            </div>
            <div
              style={{
                fontSize: '11px',
                color: remainingBalance > 0 ? '#b45309' : '#94a3b8',
                marginTop: '2px',
              }}
            >
              {remainingBalance > 0 ? 'Pending recovery from salary' : 'No balance due'}
            </div>
          </div>
        </div>

        {/* Advance History Table */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
            }}
          >
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
              Advance Disbursement History
            </h4>
            {canGiveAdvance && onGiveAdvance && (
              <button
                type="button"
                className="button secondary"
                style={{ padding: '5px 12px', fontSize: '13px' }}
                onClick={() => {
                  onClose();
                  onGiveAdvance();
                }}
              >
                + Give advance
              </button>
            )}
          </div>

          {advanceHistory.length > 0 ? (
            <div className="table-wrap" style={{ border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Payment mode</th>
                    <th>Reason</th>
                    <th>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {advanceHistory.map((adv) => (
                    <tr key={adv.id}>
                      <td>{formatCalendarDate(adv.date)}</td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{rupees(adv.amount)}</td>
                      <td>{adv.method}</td>
                      <td>{adv.reason || '—'}</td>
                      <td>{adv.reference || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                color: '#64748b',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px dashed #cbd5e1',
                fontSize: '13px',
              }}
            >
              No advance records found for this staff member.
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
          <button type="button" className="button secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
