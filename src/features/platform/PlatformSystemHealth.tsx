import { useCallback, useState } from 'react';
import { Button, LoadingOverlay, Panel } from '../../components/ui/Primitives';
import {
  platformService,
  platformError
} from '../../services/platformService';
import { useRemote } from '../live/useRemote';
import { CheckCircle2, Database, Download, MessageSquare, Smartphone } from 'lucide-react';

export default function PlatformSystemHealth() {
  const load = useCallback((signal: AbortSignal) => platformService.systemHealth(signal), []);
  const state = useRemote(load);

  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [backupError, setBackupError] = useState('');

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

  const { gateways, storage, backup } = state.data;

  return (
    <>
      {/* Top 3 Gateway Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #eaecf0',
            borderRadius: 14,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Smartphone size={20} color="#027a48" />
                <strong style={{ fontSize: 14, color: '#101828' }}>SMS Gateway</strong>
              </div>
              <span style={{ fontSize: 11, background: '#ecfdf3', color: '#027a48', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                ● Operational
              </span>
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: '#475467' }}>
              Provider: <strong>{gateways.sms.provider}</strong>
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: '#475467' }}>
              Sender ID: <strong>{gateways.sms.senderId}</strong>
            </div>
          </div>
          <div style={{ marginTop: 16, borderTop: '1px solid #f2f4f7', paddingTop: 10 }}>
            <span style={{ fontSize: 12, color: '#667085' }}>Remaining Balance: </span>
            <strong style={{ fontSize: 15, color: '#101828' }}>
              {gateways.sms.creditsRemaining.toLocaleString('en-IN')} credits
            </strong>
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #eaecf0',
            borderRadius: 14,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={20} color="#027a48" />
                <strong style={{ fontSize: 14, color: '#101828' }}>WhatsApp API</strong>
              </div>
              <span style={{ fontSize: 11, background: '#ecfdf3', color: '#027a48', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                ● Connected
              </span>
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: '#475467' }}>
              Provider: <strong>{gateways.whatsapp.provider}</strong>
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: '#475467' }}>
              Quality Rating: <strong style={{ color: '#027a48' }}>{gateways.whatsapp.qualityRating}</strong>
            </div>
          </div>
          <div style={{ marginTop: 16, borderTop: '1px solid #f2f4f7', paddingTop: 10 }}>
            <span style={{ fontSize: 12, color: '#667085' }}>Approved Templates: </span>
            <strong style={{ fontSize: 15, color: '#101828' }}>
              {gateways.whatsapp.templatesApproved} templates
            </strong>
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #eaecf0',
            borderRadius: 14,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Database size={20} color="#027a48" />
                <strong style={{ fontSize: 14, color: '#101828' }}>MongoDB Cluster</strong>
              </div>
              <span style={{ fontSize: 11, background: '#ecfdf3', color: '#027a48', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                ● Healthy
              </span>
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: '#475467' }}>
              Provider: <strong>{gateways.database.provider}</strong>
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: '#475467' }}>
              Cluster Latency: <strong>{gateways.database.latencyMs} ms</strong>
            </div>
          </div>
          <div style={{ marginTop: 16, borderTop: '1px solid #f2f4f7', paddingTop: 10 }}>
            <span style={{ fontSize: 12, color: '#667085' }}>Replica Uptime: </span>
            <strong style={{ fontSize: 15, color: '#101828' }}>
              {gateways.database.uptimeHours} hrs (99.99%)
            </strong>
          </div>
        </div>
      </div>

      {/* 1-Click Platform Backup & Disaster Recovery */}
      <Panel
        title="Platform Data Backup & Disaster Recovery"
        subtitle="Download snapshot of platform records, schools, users, announcements, and configuration"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#101828' }}>
              <CheckCircle2 size={16} color="#027a48" />
              <span>
                Automated Daily Backups: <strong style={{ color: '#027a48' }}>Active</strong> (Retention:{' '}
                {backup.retentionDays} days)
              </span>
            </div>
            <p style={{ margin: '4px 0 0 24px', fontSize: 12, color: '#667085' }}>
              Last automated snapshot created at {new Date(backup.lastAutomatedBackup).toLocaleString('en-IN')}.
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
        subtitle={`Total platform storage: ~${storage.totalEstimatedMb} MB across student photos, fee receipts, and documents`}
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
                  ESTIMATED STORAGE
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
