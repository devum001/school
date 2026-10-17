import { useState } from 'react';
import { tabKeyboard } from '../../lib/tabKeyboard';
import { useSchool } from '../../app/useSchool';
import { useToday } from '../../app/useToday';
import { useFeedback } from '../../app/useFeedback';
import { Button, Modal, Panel } from '../../components/ui/Primitives';
import GeneratedDocumentPreview from '../../components/shared/GeneratedDocumentPreview';
import {
  documentTemplatesFor,
  designChoice,
  feeReceiptFor,
  salarySlipFor,
} from '../../lib/documentData';
import { TEMPLATE_IDS } from '../../lib/ledgerSchemas';
import { TEMPLATE_LABELS } from '../../lib/documentRendering';
import { roster } from '../../lib/selectors';
import { defaultStaffPayroll } from '../../lib/settings';
import { staffDirectory } from '../../lib/staffStructure';
import { currentPayrollMonth, staffCycleSummary } from '../../lib/staffPayroll';
import { repository } from '../../lib/repository';
import { communicationError } from '../../lib/communication';
import { useDraftGuard } from '../academics/useDraftGuard';
import { schoolLogoFor } from '../../lib/schoolBranding';
import { HEADER_IMPORT_SIZE } from '../../lib/documentLayout';
import { readBrandingImage } from '../../lib/fileUploads';
import type {
  BrandingAsset,
  DocumentKind,
  GeneratedDocument,
  TemplateId,
} from '../../types/ledger';
import '../../styles/ledgers.css';

export default function TemplatesSettings() {
  const state = useSchool(),
    today = useToday(),
    notify = useFeedback(),
    settings = documentTemplatesFor(state);
  const [draft, setDraft] = useState(() => structuredClone(settings)),
    [kind, setKind] = useState<DocumentKind>('Fee Receipt'),
    [error, setError] = useState('');
  const [previewId, setPreviewId] = useState<TemplateId | null>(null),
    [zoom, setZoom] = useState(100),
    [uploading, setUploading] = useState<BrandingAsset | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings),
    guard = useDraftGuard(dirty, () => setDraft(structuredClone(settings)));
  const key = kind === 'Fee Receipt' ? 'feeReceipt' : 'salarySlip',
    choice = draft[key];
  const row = roster(state, true)[0],
    config = state.staffPayroll ?? defaultStaffPayroll;
  const members = staffDirectory(state, config),
    month = currentPayrollMonth(today, config.payroll.paymentDay);
  const member =
    members.find((item) => staffCycleSummary(state, config, item, month).salary) ?? members[0];
  let preview: GeneratedDocument | null = null;
  if (kind === 'Fee Receipt' && row)
    preview = feeReceiptFor(state, {
      id: 'preview',
      schoolId: state.school.id,
      enrollmentId: row.enrollment.id,
      amount: state.obligations
        .filter((item) => item.enrollmentId === row.enrollment.id)
        .reduce((sum, item) => sum + item.amount + item.adjustment, 0),
      date: today,
      method: 'Cash',
      reference: '',
      receiptNumber: 'PREVIEW',
      receivedBy: state.school.principal,
    });
  if (kind === 'Salary Slip' && member) {
    const summary = staffCycleSummary(state, config, member, month);
    preview = salarySlipFor(state, {
      id: 'preview',
      schoolId: state.school.id,
      staffId: member.id,
      month,
      cycleStart: summary.cycle.start,
      cycleEnd: summary.cycle.end,
      gross: summary.gross,
      leaveDeduction: summary.leaveDeduction,
      manualDeduction: summary.manual,
      net: summary.net,
      leaveDays: summary.leaveDays,
      amountPaid: summary.net,
      method: 'Bank',
      date: today,
      reference: '',
      slipNumber: 'PREVIEW',
      createdAt: new Date().toISOString(),
      recordedBy: state.school.principal ?? 'School office',
      status: 'Paid',
    });
  }
  preview ??= {
    kind,
    number: 'PREVIEW',
    schoolName: state.school.name,
    schoolLogo: schoolLogoFor(state),
    recipientName: '',
    date: today,
    createdAt: new Date().toISOString(),
    template: designChoice(choice, choice.templateId),
    fields: [],
    amount: 0,
    amountLabel: kind === 'Fee Receipt' ? 'Amount received' : 'Net salary paid',
  };
  return (
    <Panel
      title="Templates"
      subtitle="Select a design and accent color for generated receipts and salary slips."
    >
      <div className="panel-padding">
        <section className="document-branding" aria-label="School letterhead assets">
          <h3>School letterhead</h3>
          <div className="branding-assets">
            {(
              [
                ['logo', 'School logo', '800 × 800 px'],
                [
                  'header',
                  'Header',
                  `${HEADER_IMPORT_SIZE.width} × ${HEADER_IMPORT_SIZE.height} px`,
                ],
                ['footer', 'Footer', '2480 × 262 px'],
                ['signature', 'Official signature', '1040 × 560 px'],
                ['stamp', 'School stamp', '800 × 800 px'],
              ] as const
            ).map(([asset, label, size]) => (
              <div className="branding-asset" key={asset}>
                <strong>{label}</strong>
                <div className="branding-asset-image">
                  {draft.branding?.[asset] ? (
                    <img src={draft.branding[asset]} alt={`${label} artwork`} />
                  ) : (
                    <span>No image added</span>
                  )}
                </div>
                <p className="branding-size">
                  {asset === 'header' ? 'Recommended size' : 'Print quality'}: {size}
                  <br />
                  PNG, JPG or WebP · up to 5 MB
                  <br />
                  {asset === 'header'
                    ? 'Matches the receipt table width. Export at this size without extra outside margins; the full image is preserved.'
                    : 'Keep artwork close to the edges; avoid large blank margins.'}
                  {(asset === 'logo' || asset === 'signature' || asset === 'stamp') && (
                    <>
                      <br />
                      Transparent PNG works best.
                    </>
                  )}
                </p>
                <label className="button secondary document-upload-control">
                  {uploading === asset ? 'Preparing…' : 'Import image'}
                  <input
                    aria-label={`Import ${label}`}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={!!uploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      setUploading(asset);
                      try {
                        const image = await readBrandingImage(file, asset);
                        setDraft((current) => ({
                          ...current,
                          branding: { ...current.branding, [asset]: image },
                        }));
                        setError('');
                      } catch (cause) {
                        setError(communicationError(cause));
                      } finally {
                        setUploading(null);
                      }
                    }}
                  />
                </label>
                {draft.branding?.[asset] && (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        branding: { ...current.branding, [asset]: null },
                      }))
                    }
                  >
                    Remove {label}
                  </Button>
                )}
              </div>
            ))}
          </div>
          <p className="panel-note">
            Sample artwork is ready to preview. Import your school images to replace it. The school
            logo updates school identity and documents. Schoolwell keeps its own app icon.
          </p>
        </section>
        <div className="hr-tabs" role="tablist" aria-label="Document templates">
          {(['Fee Receipt', 'Salary Slip'] as const).map((value, index) => (
            <button
              id={`document-template-tab-${index}`}
              aria-controls="document-template-panel"
              role="tab"
              aria-selected={kind === value}
              tabIndex={kind === value ? 0 : -1}
              onKeyDown={(e) =>
                tabKeyboard(
                  e,
                  index,
                  ['Fee Receipt', 'Salary Slip'] as const,
                  setKind,
                  (_, i) => `document-template-tab-${i}`,
                )
              }
              key={value}
              onClick={() => {
                setKind(value);
                setPreviewId(null);
              }}
            >
              {value}
            </button>
          ))}
        </div>
        <div
          id="document-template-panel"
          role="tabpanel"
          aria-labelledby={`document-template-tab-${kind === 'Fee Receipt' ? 0 : 1}`}
        >
          <div className="template-tools">
            <Button
              disabled={!dirty || !!uploading}
              onClick={() => {
                try {
                  repository.saveDocumentTemplates(draft);
                  notify('Templates saved.');
                  setError('');
                } catch (cause) {
                  setError(communicationError(cause));
                }
              }}
            >
              Save templates
            </Button>
          </div>
          <div className="template-gallery">
            {TEMPLATE_IDS.map((id) => (
              <button
                key={id}
                className={`template-option ${choice.templateId === id ? 'selected' : ''}`}
                aria-pressed={choice.templateId === id}
                aria-label={`${TEMPLATE_LABELS[id]} ${kind} template`}
                onClick={() => {
                  setPreviewId(id);
                  setZoom(100);
                  setError('');
                }}
              >
                {preview ? (
                  <GeneratedDocumentPreview
                    compact
                    brandingMode="draft"
                    actions={false}
                    data={{
                      ...preview,
                      schoolLogo:
                        draft.branding?.logo === null
                          ? undefined
                          : (draft.branding?.logo ?? schoolLogoFor(state)),
                      branding: { ...draft.branding },
                      template: designChoice(choice, id),
                    }}
                  />
                ) : (
                  <img
                    src={`/document-templates/${key === 'feeReceipt' ? 'fee' : 'salary'}-${id}.png`}
                    alt={`${TEMPLATE_LABELS[id]} design`}
                  />
                )}
                <span>{TEMPLATE_LABELS[id]}</span>
              </button>
            ))}
          </div>
          <p className="panel-note">
            Preview uses existing school and {kind === 'Fee Receipt' ? 'student' : 'staff'} details.
            All receipts and salary slips use your current saved templates and letterhead.
          </p>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <Modal
        open={!!previewId}
        wide
        onClose={() => setPreviewId(null)}
        title={previewId ? `${TEMPLATE_LABELS[previewId]} ${kind}` : 'Template preview'}
        description="Preview the design, choose its color, then apply it to all existing and new documents."
      >
        {previewId && (
          <div className="template-preview-editor">
            <div className="template-preview-controls">
              <label className="field">
                Template accent color
                <input
                  aria-label="Template accent color"
                  type="color"
                  value={designChoice(choice, previewId).accent}
                  onChange={(e) => {
                    const accent = e.target.value;
                    setDraft((current) => {
                      const currentChoice = current[key];
                      return {
                        ...current,
                        [key]: {
                          ...currentChoice,
                          accent:
                            currentChoice.templateId === previewId ? accent : currentChoice.accent,
                          colors: { ...currentChoice.colors, [previewId]: accent },
                        },
                      };
                    });
                  }}
                />
              </label>
              <div className="template-zoom-controls">
                <Button
                  variant="secondary"
                  aria-label="Zoom out"
                  disabled={zoom <= 50}
                  onClick={() => setZoom(Math.max(50, zoom - 25))}
                >
                  −
                </Button>
                <span>{zoom}%</span>
                <Button
                  variant="secondary"
                  aria-label="Zoom in"
                  disabled={zoom >= 150}
                  onClick={() => setZoom(Math.min(150, zoom + 25))}
                >
                  +
                </Button>
              </div>
              <Button
                disabled={!!uploading}
                onClick={() => {
                  const selected = designChoice(choice, previewId),
                    next = { ...draft, [key]: { ...choice, ...selected } };
                  try {
                    repository.saveDocumentTemplates(next);
                    setDraft(next);
                    notify(`${kind} template saved.`);
                    setPreviewId(null);
                    setError('');
                  } catch (cause) {
                    setError(communicationError(cause));
                  }
                }}
              >
                Use this template
              </Button>
            </div>
            <div
              className="template-preview-scroll"
              tabIndex={0}
              role="region"
              aria-label="Enlarged document preview"
            >
              <div className="template-preview-canvas" style={{ width: `${zoom}%` }}>
                {preview ? (
                  <GeneratedDocumentPreview
                    brandingMode="draft"
                    actions={false}
                    data={{
                      ...preview,
                      schoolLogo:
                        draft.branding?.logo === null
                          ? undefined
                          : (draft.branding?.logo ?? schoolLogoFor(state)),
                      branding: { ...draft.branding },
                      template: designChoice(choice, previewId),
                    }}
                  />
                ) : (
                  <img
                    src={`/document-templates/${key === 'feeReceipt' ? 'fee' : 'salary'}-${previewId}.png`}
                    alt="Template design"
                  />
                )}
              </div>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </Modal>
      <Modal
        open={guard.confirming}
        onClose={guard.keepEditing}
        title="Discard template changes?"
        description="Your selected designs and colors have not been saved."
      >
        <div className="modal-actions">
          <Button variant="secondary" onClick={guard.keepEditing}>
            Keep editing
          </Button>
          <Button variant="danger" onClick={guard.discard}>
            Discard changes
          </Button>
        </div>
      </Modal>
    </Panel>
  );
}
