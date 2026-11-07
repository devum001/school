import { useCallback, useState } from 'react';
import { Button, LoadingOverlay, Panel } from '../../components/ui/Primitives';
import {
  platformService,
  platformError
} from '../../services/platformService';
import { useRemote } from '../live/useRemote';
import { Calendar, DollarSign, Layers } from 'lucide-react';

export default function PlatformMasterTemplates() {
  const load = useCallback((signal: AbortSignal) => platformService.masterTemplates(signal), []);
  const state = useRemote(load);

  const [activeSection, setActiveSection] = useState<'holidays' | 'feeHeads' | 'departments'>('holidays');
  const [applying, setApplying] = useState(false);
  const [applyMessage, setApplyMessage] = useState('');
  const [error, setError] = useState('');

  const handleApplyToAll = async () => {
    if (!window.confirm('Apply master templates (Indian Holidays, Fee Heads & Departments) to all registered schools?')) {
      return;
    }
    setApplying(true);
    setError('');
    setApplyMessage('');
    try {
      await platformService.applyMasterTemplates('all', {
        holidays: true,
        feeHeads: true,
        departments: true,
      });
      setApplyMessage('✓ Master templates successfully synchronized across all registered schools!');
      setTimeout(() => setApplyMessage(''), 6000);
    } catch (err) {
      setError(platformError(err));
    } finally {
      setApplying(false);
    }
  };

  if (state.loading) {
    return (
      <LoadingOverlay
        loading
        size="xl"
        label="Loading master templates…"
        message="Loading national Indian holidays and default templates…"
      >
        <div style={{ minHeight: 280 }} />
      </LoadingOverlay>
    );
  }

  if (state.error || !state.data) {
    return (
      <Panel>
        <h2>Templates Unavailable</h2>
        <p role="alert">{state.error || 'Failed to load master templates.'}</p>
        <Button onClick={state.reload}>Retry</Button>
      </Panel>
    );
  }

  const { holidays, feeHeads, departments } = state.data;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: '#101828' }}>Central Master Default Templates</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#667085' }}>
            Standard Indian national calendars and baseline fee heads automatically pre-filled when schools onboard.
          </p>
        </div>
        <Button
          variant="primary"
          disabled={applying}
          onClick={handleApplyToAll}
        >
          {applying ? 'Syncing...' : 'Sync Master Defaults to All Schools'}
        </Button>
      </div>

      {applyMessage && (
        <div style={{ marginBottom: 16, background: '#ecfdf3', border: '1px solid #a6f4c5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#027a48' }}>
          {applyMessage}
        </div>
      )}
      {error && (
        <div style={{ marginBottom: 16, background: '#fef3f2', border: '1px solid #fecdca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#b42318' }}>
          {error}
        </div>
      )}

      {/* Template navigation tabs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setActiveSection('holidays')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 8,
            border: activeSection === 'holidays' ? '1px solid #2d6a4f' : '1px solid #eaecf0',
            background: activeSection === 'holidays' ? '#ecfdf3' : '#ffffff',
            color: activeSection === 'holidays' ? '#1b4332' : '#475467',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <Calendar size={16} />
          Indian National Holidays ({holidays.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('feeHeads')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 8,
            border: activeSection === 'feeHeads' ? '1px solid #2d6a4f' : '1px solid #eaecf0',
            background: activeSection === 'feeHeads' ? '#ecfdf3' : '#ffffff',
            color: activeSection === 'feeHeads' ? '#1b4332' : '#475467',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <DollarSign size={16} />
          Default Fee Heads ({feeHeads.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('departments')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 8,
            border: activeSection === 'departments' ? '1px solid #2d6a4f' : '1px solid #eaecf0',
            background: activeSection === 'departments' ? '#ecfdf3' : '#ffffff',
            color: activeSection === 'departments' ? '#1b4332' : '#475467',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <Layers size={16} />
          Staff Departments ({departments.length})
        </button>
      </div>

      {/* Section 1: Indian National Holidays */}
      {activeSection === 'holidays' && (
        <Panel
          title="Indian National & Gazetted Holiday Master Calendar"
          subtitle="Pre-populated in academic year calendars for all Indian schools"
        >
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #eaecf0', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467' }}>DATE (2026)</th>
                  <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467' }}>HOLIDAY NAME</th>
                  <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467' }}>CATEGORY</th>
                  <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467' }}>GAZETTED / MANDATORY</th>
                </tr>
              </thead>
              <tbody>
                {holidays.map((h, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f2f4f7' }}>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500, color: '#101828' }}>
                      {new Date(h.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#101828' }}>
                      {h.name}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#475467' }}>
                      {h.description}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {h.mandatory ? (
                        <span style={{ fontSize: 11, background: '#ecfdf3', color: '#027a48', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                          ● Mandatory National Holiday
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, background: '#f2f4f7', color: '#475467', padding: '2px 8px', borderRadius: 10 }}>
                          ○ Gazetted / Regional
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Section 2: Default Fee Heads */}
      {activeSection === 'feeHeads' && (
        <Panel
          title="Master Default Fee Heads & Categories"
          subtitle="Standard baseline fee structures provided during new school onboarding"
        >
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #eaecf0', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467' }}>FEE HEAD NAME</th>
                  <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467' }}>BILLING CYCLE</th>
                  <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467' }}>HEAD TYPE</th>
                  <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467', textAlign: 'right' }}>
                    SUGGESTED BASELINE
                  </th>
                </tr>
              </thead>
              <tbody>
                {feeHeads.map((f, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f2f4f7' }}>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#101828' }}>
                      {f.name}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#475467' }}>
                      <span style={{ background: '#eff8ff', color: '#175cd3', padding: '2px 8px', borderRadius: 10, fontWeight: 500 }}>
                        {f.frequency}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#475467' }}>
                      {f.type}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#1b4332', textAlign: 'right' }}>
                      ₹{f.defaultAmount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Section 3: Staff Departments */}
      {activeSection === 'departments' && (
        <Panel
          title="Master Staff & Faculty Departments"
          subtitle="Baseline departments pre-configured for staff roles and payroll assignments"
        >
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #eaecf0', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467' }}>DEPARTMENT NAME</th>
                  <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467' }}>DEPARTMENT CODE</th>
                  <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467' }}>DEFAULT HEAD ROLE</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f2f4f7' }}>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#101828' }}>
                      {d.name}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#475467' }}>
                      <span style={{ background: '#f2f4f7', color: '#344054', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>
                        {d.code}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: '#475467' }}>
                      {d.headRole}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}
