import { useCallback, useState } from 'react';
import { Button, LoadingOverlay, Panel } from '../../components/ui/Primitives';
import {
  platformService,
  platformError
} from '../../services/platformService';
import { useRemote } from '../live/useRemote';
import { AlertCircle, CheckCircle2, Database, Download, HelpCircle, MessageSquare, Smartphone, X } from 'lucide-react';

export default function PlatformSystemHealth() {
  const load = useCallback((signal: AbortSignal) => platformService.systemHealth(signal), []);
  const state = useRemote(load);

  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [backupError, setBackupError] = useState('');
  const [activeSetupModal, setActiveSetupModal] = useState<'sms' | 'whatsapp' | null>(null);

  const handleDownloadBackup = async () => {
    setDownloading(true);
    setBackupError('');
    setDownloadSuccess(false);
    try {
      await platformService.exportBackup();
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 5000);
    } catch (err) {
      setBackupError(platformError(err));
    } finally {
      setDownloading(false);
    }
  };

  if (state.loading) {
    return (
      <LoadingOverlay
        loading
        size="xl"
        label="Inspecting system health…"
        message="Checking platform gateways and database status…"
      >
        <div style={{ minHeight: 280 }} />
      </LoadingOverlay>
    );
  }

  if (state.error || !state.data) {
    return (
      <Panel>
        <h2>Health Check Unavailable</h2>
        <p role="alert">{state.error || 'Failed to inspect platform system health.'}</p>
        <Button onClick={state.reload}>Retry health check</Button>
      </Panel>
    );
  }

  const { gateways, storage } = state.data;
  const isSmsConfigured = gateways.sms.configured && gateways.sms.status === 'operational';
  const isWhatsAppConfigured = gateways.whatsapp.configured && gateways.whatsapp.status === 'operational';
  const isDbHealthy = gateways.database.status === 'healthy';

  return (
    <>
      {/* Top 3 Real Gateway & Database Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {/* SMS Gateway */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #eaecf0',
            borderRadius: 14,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Smartphone size={20} color={isSmsConfigured ? '#027a48' : '#667085'} />
                <strong style={{ fontSize: 14, color: '#101828' }}>SMS Gateway</strong>
              </div>
              <span
                style={{
                  fontSize: 11,
                  background: isSmsConfigured ? '#ecfdf3' : gateways.sms.status === 'error' ? '#fef3f2' : '#f2f4f7',
                  color: isSmsConfigured ? '#027a48' : gateways.sms.status === 'error' ? '#b42318' : '#475467',
                  padding: '3px 8px',
                  borderRadius: 10,
                  fontWeight: 600,
                }}
              >
                ● {isSmsConfigured ? 'Operational' : gateways.sms.status === 'error' ? 'Config Error' : 'Not Configured'}
              </span>
            </div>

            <div style={{ marginTop: 14, fontSize: 13, color: '#475467' }}>
              Provider: <strong>{gateways.sms.provider}</strong>
            </div>

            {isSmsConfigured ? (
              <>
                <div style={{ marginTop: 4, fontSize: 13, color: '#475467' }}>
                  Sender ID: <strong>{gateways.sms.senderId || 'Default'}</strong>
                </div>
                <div style={{ marginTop: 14, borderTop: '1px solid #f2f4f7', paddingTop: 10 }}>
                  <span style={{ fontSize: 12, color: '#667085' }}>Live Balance: </span>
                  <strong style={{ fontSize: 15, color: '#101828' }}>
                    {gateways.sms.creditsRemaining != null
                      ? `${gateways.sms.creditsRemaining.toLocaleString('en-IN')} credits`
                      : 'Active'}
                  </strong>
                </div>
              </>
            ) : (
              <div style={{ marginTop: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: '#475467' }}>
                  <AlertCircle size={15} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>No SMS API key in <code>.env</code>. Alerts & balance tracking inactive.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSetupModal('sms')}
                  style={{
                    marginTop: 8,
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    color: '#1b4332',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <HelpCircle size={13} /> View SMS Setup Guide
                </button>
              </div>
            )}
          </div>
        </div>

        {/* WhatsApp Cloud API */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #eaecf0',
            borderRadius: 14,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={20} color={isWhatsAppConfigured ? '#027a48' : '#667085'} />
                <strong style={{ fontSize: 14, color: '#101828' }}>WhatsApp API</strong>
              </div>
              <span
                style={{
                  fontSize: 11,
                  background: isWhatsAppConfigured ? '#ecfdf3' : gateways.whatsapp.status === 'error' ? '#fef3f2' : '#f2f4f7',
                  color: isWhatsAppConfigured ? '#027a48' : gateways.whatsapp.status === 'error' ? '#b42318' : '#475467',
                  padding: '3px 8px',
                  borderRadius: 10,
                  fontWeight: 600,
                }}
              >
                ● {isWhatsAppConfigured ? 'Connected' : gateways.whatsapp.status === 'error' ? 'Config Error' : 'Not Configured'}
              </span>
            </div>

            <div style={{ marginTop: 14, fontSize: 13, color: '#475467' }}>
              Provider: <strong>{gateways.whatsapp.provider}</strong>
            </div>

            {isWhatsAppConfigured ? (
              <>
                <div style={{ marginTop: 4, fontSize: 13, color: '#475467' }}>
                  Quality Rating: <strong style={{ color: '#027a48' }}>{gateways.whatsapp.qualityRating}</strong>
                </div>
                <div style={{ marginTop: 14, borderTop: '1px solid #f2f4f7', paddingTop: 10 }}>
                  <span style={{ fontSize: 12, color: '#667085' }}>Meta Cloud API: </span>
                  <strong style={{ fontSize: 14, color: '#101828' }}>
                    {gateways.whatsapp.verifiedName || 'Verified'}
                  </strong>
                </div>
              </>
            ) : (
              <div style={{ marginTop: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: '#475467' }}>
                  <AlertCircle size={15} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>Meta Cloud API token not set in <code>.env</code>. WhatsApp receipts inactive.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSetupModal('whatsapp')}
                  style={{
                    marginTop: 8,
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    color: '#1b4332',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <HelpCircle size={13} /> View WhatsApp Setup Guide
                </button>
              </div>
            )}
          </div>
        </div>

        {/* MongoDB Database Health */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #eaecf0',
            borderRadius: 14,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Database size={20} color={isDbHealthy ? '#027a48' : '#b42318'} />
                <strong style={{ fontSize: 14, color: '#101828' }}>Database Engine</strong>
              </div>
              <span
                style={{
                  fontSize: 11,
                  background: isDbHealthy ? '#ecfdf3' : '#fef3f2',
                  color: isDbHealthy ? '#027a48' : '#b42318',
                  padding: '3px 8px',
                  borderRadius: 10,
                  fontWeight: 600,
                }}
              >
                ● {isDbHealthy ? 'Connected' : 'Degraded'}
              </span>
            </div>

            <div style={{ marginTop: 14, fontSize: 13, color: '#475467' }}>
              Cluster: <strong>{gateways.database.provider}</strong>
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: '#475467' }}>
              Database: <strong>{gateways.database.databaseName || 'school_management'}</strong>
            </div>
          </div>
          <div style={{ marginTop: 14, borderTop: '1px solid #f2f4f7', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: 12, color: '#667085' }}>Live Ping: </span>
              <strong style={{ fontSize: 14, color: '#101828' }}>
                {gateways.database.latencyMs != null ? `${gateways.database.latencyMs} ms` : 'Active'}
              </strong>
            </div>
            <span style={{ fontSize: 12, color: '#475467' }}>
              <strong>{gateways.database.collectionsCount || 0}</strong> collections
            </span>
          </div>
        </div>
      </div>

      {/* Setup Guide Modal */}
      {activeSetupModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(16, 24, 40, 0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setActiveSetupModal(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 14,
              width: '100%',
              maxWidth: 540,
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #eaecf0', paddingBottom: 14 }}>
              <strong style={{ fontSize: 16, color: '#101828' }}>
                {activeSetupModal === 'sms' ? 'SMS Gateway Configuration Setup' : 'Meta WhatsApp Cloud API Setup'}
              </strong>
              <button
                type="button"
                onClick={() => setActiveSetupModal(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#667085' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginTop: 16, fontSize: 13, color: '#344054', lineHeight: 1.6 }}>
              {activeSetupModal === 'sms' ? (
                <>
                  <p style={{ margin: '0 0 12px' }}>
                    Schoolwell supports direct integration with Indian SMS providers like <strong>Fast2SMS</strong> and <strong>MSG91</strong> for automated fee alerts, attendance SMS, and OTPs.
                  </p>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                    <strong style={{ fontSize: 12, color: '#1b4332' }}>Configuration Steps:</strong>
                    <ol style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 12, color: '#475467' }}>
                      <li>Create an account on <code>fast2sms.com</code> or <code>msg91.com</code>.</li>
                      <li>Generate your API Key / Auth Token from their developer dashboard.</li>
                      <li>Open <code>school-backend/.env</code> and add:</li>
                    </ol>
                    <pre style={{ margin: '8px 0 0', background: '#0f172a', color: '#f8fafc', padding: '8px 12px', borderRadius: 6, fontSize: 12, overflowX: 'auto' }}>
{`# Option A: Fast2SMS
FAST2SMS_API_KEY=your_fast2sms_api_key_here
SMS_SENDER_ID=SCHWL

# Option B: MSG91
MSG91_AUTH_KEY=your_msg91_auth_key_here
SMS_SENDER_ID=SCHWL`}
                    </pre>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: '#667085' }}>
                    Once added, restart the backend server. The live balance and status will update automatically here with zero dummy numbers.
                  </p>
                </>
              ) : (
                <>
                  <p style={{ margin: '0 0 12px' }}>
                    Schoolwell integrates with the official <strong>Meta WhatsApp Cloud API</strong> to send automated WhatsApp fee receipts, student report card PDFs, and circulars directly to parents.
                  </p>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                    <strong style={{ fontSize: 12, color: '#1b4332' }}>Configuration Steps:</strong>
                    <ol style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 12, color: '#475467' }}>
                      <li>Register a WhatsApp Business App on <code>developers.facebook.com</code>.</li>
                      <li>Get your Permanent Access Token and Phone Number ID.</li>
                      <li>Open <code>school-backend/.env</code> and add:</li>
                    </ol>
                    <pre style={{ margin: '8px 0 0', background: '#0f172a', color: '#f8fafc', padding: '8px 12px', borderRadius: 6, fontSize: 12, overflowX: 'auto' }}>
{`WHATSAPP_CLOUD_API_TOKEN=your_meta_system_user_access_token
WHATSAPP_PHONE_NUMBER_ID=your_whatsapp_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_waba_account_id`}
                    </pre>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: '#667085' }}>
                    Once saved and restarted, real-time quality score and Meta verified status will show here live.
                  </p>
                </>
              )}
            </div>

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={() => setActiveSetupModal(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* 1-Click Platform Backup & Disaster Recovery */}
      <Panel
        title="Platform Data Backup & Disaster Recovery"
        subtitle="Download real JSON snapshot of platform records, registered schools, user accounts, and announcements directly from MongoDB"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#101828' }}>
              <CheckCircle2 size={16} color="#027a48" />
              <span>
                On-Demand Full Backup: <strong style={{ color: '#027a48' }}>Ready</strong> (1-Click JSON Snapshot)
              </span>
            </div>
            <p style={{ margin: '4px 0 0 24px', fontSize: 12, color: '#667085' }}>
              Automated recurring cron: <strong>Not scheduled</strong>. Click the button to export all MongoDB platform records on demand.
            </p>
          </div>

          <div>
            <Button
              variant="primary"
              disabled={downloading}
              onClick={handleDownloadBackup}
            >
              <Download size={16} style={{ marginRight: 6 }} />
              {downloading ? 'Bundling Backup...' : 'Download Platform JSON Backup'}
            </Button>
          </div>
        </div>

        {downloadSuccess && (
          <div style={{ marginTop: 12, background: '#ecfdf3', border: '1px solid #a6f4c5', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#027a48' }}>
            ✓ Platform backup JSON generated and downloaded to your computer successfully!
          </div>
        )}
        {backupError && (
          <div style={{ marginTop: 12, background: '#fef3f2', border: '1px solid #fecdca', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#b42318' }}>
            {backupError}
          </div>
        )}
      </Panel>

      {/* Per-School Storage Footprint */}
      <Panel
        title="School Storage Consumption Leaderboard"
        subtitle={`Total calculated storage: ~${storage.totalEstimatedMb} MB across student photos, fee receipts, and database documents`}
      >
        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #eaecf0', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467' }}>SCHOOL</th>
                <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467' }}>STUDENTS</th>
                <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467' }}>PHOTOS STORED</th>
                <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467' }}>FEE RECEIPTS</th>
                <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467', textAlign: 'right' }}>
                  CALCULATED STORAGE
                </th>
              </tr>
            </thead>
            <tbody>
              {storage.schools.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#667085' }}>
                    No schools recorded yet.
                  </td>
                </tr>
              ) : (
                storage.schools.map((item) => (
                  <tr key={item.schoolId} style={{ borderBottom: '1px solid #f2f4f7' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <strong style={{ fontSize: 13, color: '#101828' }}>{item.schoolName}</strong>
                      {item.code && (
                        <span style={{ marginLeft: 8, fontSize: 11, background: '#f2f4f7', padding: '2px 6px', borderRadius: 4, color: '#344054' }}>
                          {item.code}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: '#475467' }}>
                      {item.studentsCount}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: '#475467' }}>
                      {item.photosCount}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: '#475467' }}>
                      {item.feeReceiptsCount}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#1b4332', textAlign: 'right' }}>
                      {item.estimatedMb} MB
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
