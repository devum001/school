import { useState } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import { Button, Panel } from '../../components/ui/Primitives';
import { notificationMessage } from '../../lib/operations';
import type { RosterEntry } from '../../types/domain';
export function NotificationPreview({
  schoolName,
  date,
  eligible,
  selectedCount,
  onReview,
}: {
  schoolName: string;
  date: string;
  eligible: RosterEntry[];
  selectedCount: number;
  onReview: () => void;
}) {
  const [previewId, setPreviewId] = useState('');
  const preview = eligible.find((r) => r.enrollment.id === previewId) ?? eligible[0];
  return (
    <Panel title="Message preview" subtitle="WhatsApp · अनुपस्थिति सूचना">
      <div className="message-preview">
        {eligible.length > 0 && (
          <label className="field">
            Preview recipient
            <select value={preview?.enrollment.id} onChange={(e) => setPreviewId(e.target.value)}>
              {eligible.map((r) => (
                <option key={r.enrollment.id} value={r.enrollment.id}>
                  {r.student.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="whatsapp-preview">
          <div className="message-school">
            <span className="school-initial">{schoolName[0]}</span>
            <span>
              <strong>{schoolName}</strong>
              <small>School office</small>
            </span>
          </div>
          <div className="message-bubble" lang={preview ? 'hi' : 'en'}>
            {preview
              ? notificationMessage(schoolName, preview.student.name, date)
              : 'Select an eligible student to preview their personalized attendance notice.'}
            <span lang="en">
              Message preview <CheckCircle2 size={13} />
            </span>
          </div>
        </div>
        <div className="recipient-summary">
          <span>
            Selected students<strong>{selectedCount}</strong>
          </span>
          <span>
            Eligible contacts<strong>{eligible.length}</strong>
          </span>
        </div>
        <Button className="full-width" disabled={!eligible.length} onClick={onReview}>
          <Send size={16} />
          Review notification
        </Button>
        <p className="fine-print">Messages are prepared in Hindi for parents and guardians.</p>
      </div>
    </Panel>
  );
}
