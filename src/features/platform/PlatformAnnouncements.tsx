import { useCallback, useState } from 'react';
import { Button, LoadingOverlay, Modal, Panel } from '../../components/ui/Primitives';
import {
  platformService,
  platformError,
  type PlatformAnnouncement,
} from '../../services/platformService';
import { useRemote } from '../live/useRemote';

const SEVERITY_STYLES = {
  info: { label: 'Information', bg: '#eff8ff', color: '#175cd3', border: '#b2ddff' },
  warning: { label: 'Warning', bg: '#fffaeb', color: '#b54708', border: '#fedf89' },
  critical: { label: 'Critical / Urgent', bg: '#fef3f2', color: '#b42318', border: '#fecdca' },
};

export default function PlatformAnnouncements() {
  const load = useCallback((signal: AbortSignal) => platformService.announcements(signal), []);
  const state = useRemote(load);

  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Form states
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<'info' | 'warning' | 'critical'>('info');
  const [target, setTarget] = useState<'all' | 'specific'>('all');
  const [expiresAt, setExpiresAt] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setError('Title and message are required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await platformService.createAnnouncement({
        title: title.trim(),
        message: message.trim(),
        severity,
        target,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      });
      setTitle('');
      setMessage('');
      setSeverity('info');
      setTarget('all');
      setExpiresAt('');
      setCreateOpen(false);
      state.reload();
    } catch (err) {
      setError(platformError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (announcement: PlatformAnnouncement) => {
    try {
      await platformService.updateAnnouncement(announcement.id, { active: !announcement.active });
      state.reload();
    } catch (err) {
      alert(platformError(err));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this broadcast announcement?')) return;
    try {
      await platformService.deleteAnnouncement(id);
      state.reload();
    } catch (err) {
      alert(platformError(err));
    }
  };

  if (state.loading) {
    return (
      <LoadingOverlay
        loading
        size="xl"
        label="Loading announcements…"
        message="Loading platform broadcasts…"
      >
        <div style={{ minHeight: 280 }} />
      </LoadingOverlay>
    );
  }

  const items = state.data || [];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: '#101828' }}>Global Announcements & Broadcasts</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#667085' }}>
            Broadcast platform-wide notifications and maintenance alerts to school owners and principals.
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          + New Broadcast
        </Button>
      </div>

      <Panel>
        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #eaecf0', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467' }}>SEVERITY</th>
                <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467' }}>TITLE & MESSAGE</th>
                <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467' }}>TARGET</th>
                <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467' }}>VALID UNTIL</th>
                <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467' }}>STATUS</th>
                <th style={{ padding: '10px 14px', fontSize: 12, color: '#475467', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#667085' }}>
                    No announcements created yet. Click "+ New Broadcast" to send a platform notice.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const sevStyle = SEVERITY_STYLES[item.severity] || SEVERITY_STYLES.info;
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f2f4f7' }}>
                      <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            fontSize: 11,
                            fontWeight: 600,
                            background: sevStyle.bg,
                            color: sevStyle.color,
                            border: `1px solid ${sevStyle.border}`,
                            padding: '2px 8px',
                            borderRadius: 12,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {sevStyle.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', maxWidth: 360 }}>
                        <strong style={{ fontSize: 13, color: '#101828', display: 'block' }}>
                          {item.title}
                        </strong>
                        <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#475467', lineHeight: 1.4 }}>
                          {item.message}
                        </p>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12, color: '#475467', verticalAlign: 'top' }}>
                        {item.target === 'all' ? (
                          <span style={{ fontWeight: 500 }}>All Registered Schools</span>
                        ) : (
                          <span>{item.targetSchoolIds.length} Schools</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12, color: '#667085', verticalAlign: 'top' }}>
                        {item.expiresAt ? new Date(item.expiresAt).toLocaleDateString('en-IN') : 'Permanent'}
                      </td>
                      <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(item)}
                          style={{
                            border: 'none',
                            background: item.active ? '#ecfdf3' : '#f2f4f7',
                            color: item.active ? '#027a48' : '#667085',
                            padding: '4px 10px',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {item.active ? '● Live (Broadcasting)' : '○ Paused'}
                        </button>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', verticalAlign: 'top' }}>
                        <Button variant="danger" onClick={() => handleDelete(item.id)}>
                          Delete
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* New Announcement Modal */}
      {createOpen && (
        <Modal
          open
          title="Create Broadcast Announcement"
          description="Send a message banner to all school dashboards and portals."
          onClose={() => {
            if (!busy) setCreateOpen(false);
          }}
        >
          <form onSubmit={handleCreate} className="live-content">
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}

            <label className="field">
              Broadcast Title
              <input
                type="text"
                placeholder="e.g. Scheduled Maintenance tonight at 11:00 PM"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>

            <label className="field">
              Detailed Notice Message
              <textarea
                rows={3}
                placeholder="Write the message that will be displayed on schools' portal banners..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <label className="field">
                Notice Severity
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as any)}
                >
                  <option value="info">Information (Blue)</option>
                  <option value="warning">Warning / Advisory (Amber)</option>
                  <option value="critical">Critical / Urgent (Red)</option>
                </select>
              </label>

              <label className="field">
                Expiry Date (Optional)
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </label>
            </div>

            <div className="live-actions">
              <Button type="button" variant="secondary" disabled={busy} onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={busy}>
                {busy ? 'Publishing...' : 'Publish Announcement'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
