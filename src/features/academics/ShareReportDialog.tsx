import { useState } from 'react';
import { Copy, MessageCircle } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { Button, Modal } from '../../components/ui/Primitives';
import type { Examination, RosterEntry } from '../../types/domain';
import {
  studentReportMessage,
  testAbsenceMessage,
  whatsappPhone,
  whatsappReportUrl,
} from '../../lib/reportShare';
import './student-academics.css';

export default function ShareReportDialog({
  row,
  exams,
  selectedExamId,
  absenceExam,
  onClose,
}: {
  row: RosterEntry;
  exams: Examination[];
  selectedExamId: string;
  absenceExam?: Examination;
  onClose: () => void;
}) {
  const state = useSchool();
  const notify = useFeedback();
  const [scope, setScope] = useState('selected');
  const [phone, setPhone] = useState(() => {
    const valid = whatsappPhone(row.student.guardian.contact ?? '');
    return valid ? `+${valid}` : '';
  });
  const [copyError, setCopyError] = useState('');
  const message = absenceExam
    ? testAbsenceMessage(state, row, absenceExam)
    : studentReportMessage(
        state,
        row,
        scope === 'all' ? exams : exams.filter((e) => e.id === selectedExamId),
      );
  const invalidPhone = Boolean(phone.trim()) && !whatsappPhone(phone);
  const href = !invalidPhone && message ? whatsappReportUrl(message, phone) : null;
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={absenceExam ? 'Notify parent about test absence' : 'Share report on WhatsApp'}
      description={`Review ${row.student.name}’s ${absenceExam ? 'absence notice' : 'report'}. WhatsApp will open with the message ready; you choose when to send it.`}
    >
      <div className="share-report-controls">
        {!absenceExam && (
          <label className="field">
            Report content
            <select
              aria-label="Report content"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            >
              <option value="selected">Selected test</option>
              <option value="all">All recorded tests</option>
            </select>
          </label>
        )}
        <label className="field">
          Parent’s WhatsApp number (optional)
          <input
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10-digit mobile or + country code"
            aria-describedby="whatsapp-number-help"
            aria-invalid={invalidPhone}
          />
        </label>
      </div>
      <p id="whatsapp-number-help" className="share-report-help">
        Parent / guardian: {row.student.guardian.name}. Leave the number blank to choose their
        contact in WhatsApp.
      </p>
      {invalidPhone && (
        <p className="form-error" role="alert">
          Enter a 10-digit Indian mobile number, or an international number with + and the country
          code.
        </p>
      )}
      <div
        className="report-message-preview"
        role="region"
        tabIndex={0}
        lang="hi"
        aria-label="Report message preview"
      >
        {message ||
          (absenceExam
            ? 'इस छात्र को इस परीक्षा में अनुपस्थित दर्ज नहीं किया गया है।'
            : 'इस परीक्षा के अंक अभी दर्ज नहीं किए गए हैं।')}
      </div>
      <p className="share-report-help">
        {absenceExam ? 'Shares a test absence notice.' : 'Shares the marks as a text report.'}{' '}
        Review the recipient in WhatsApp before sending.
      </p>
      {copyError && (
        <p className="form-error" role="alert">
          {copyError}
        </p>
      )}
      <div className="modal-actions share-report-actions">
        <Button
          variant="secondary"
          disabled={!message}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(message);
              setCopyError('');
              notify(absenceExam ? 'Absence notice copied.' : 'Report message copied.');
            } catch {
              setCopyError(
                'Copy is unavailable in this browser. Select the report text above to copy it.',
              );
            }
          }}
        >
          <Copy size={15} />
          Copy message
        </Button>
        {href ? (
          <a
            className="button whatsapp-share"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle size={16} />
            {phone.trim() ? 'Open parent chat' : 'Choose contact in WhatsApp'}
          </a>
        ) : (
          <Button disabled>
            <MessageCircle size={16} />
            Open WhatsApp
          </Button>
        )}
      </div>
    </Modal>
  );
}
