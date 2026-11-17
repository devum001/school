import { Modal, Button, AppIcon } from '../ui/Primitives';
import { Share, PlusSquare, MoreVertical, Smartphone, CheckCircle2 } from 'lucide-react';

interface PwaInstallModalProps {
  open: boolean;
  onClose: () => void;
  isIos: boolean;
  isAndroid: boolean;
  onNativeInstall?: () => void;
  hasNativePrompt?: boolean;
}

export default function PwaInstallModal({
  open,
  onClose,
  isIos,
  isAndroid,
  onNativeInstall,
  hasNativePrompt,
}: PwaInstallModalProps) {
  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Install Schoolwell App · ऐप इंस्टॉल करें"
      description="Install Schoolwell directly on your mobile device or computer for instant access, offline reliability, and full-screen workspace."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', margin: '14px 0' }}>
        {/* App Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '14px',
            background: 'var(--surface-subtle, #f8fafc)',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: '12px',
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '12px',
              background: '#12373b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(18, 55, 59, 0.2)',
            }}
          >
            <AppIcon name="graduation-cap" size={32} />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text, #0f172a)' }}>
              Schoolwell
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted, #64748b)' }}>
              School Management System · Web App
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
              <CheckCircle2 size={13} /> Fast, lightweight & battery efficient
            </div>
          </div>
        </div>

        {/* 1-Click Native Install if available */}
        {hasNativePrompt && onNativeInstall && (
          <div style={{ textAlign: 'center', margin: '4px 0' }}>
            <Button
              onClick={() => {
                onNativeInstall();
                onClose();
              }}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                fontWeight: 700,
                background: '#12373b',
                color: '#ffffff',
                borderRadius: '8px',
              }}
            >
              <Smartphone size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
              1-Click Install App (इंस्टॉल करें)
            </Button>
          </div>
        )}

        {/* iOS Step-by-Step Instructions */}
        {isIos && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
              How to install on iPhone / iPad (Safari):
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#334155' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                1
              </div>
              <div>
                Tap the <strong>Share</strong> button <Share size={14} style={{ verticalAlign: 'middle', margin: '0 2px' }} /> in the Safari toolbar at the bottom of the screen.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#334155' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                2
              </div>
              <div>
                Scroll down and select <strong>Add to Home Screen</strong> <PlusSquare size={14} style={{ verticalAlign: 'middle', margin: '0 2px' }} />.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#334155' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                3
              </div>
              <div>
                Tap <strong>Add</strong> in the top-right corner. Schoolwell will appear on your home screen like a native app!
              </div>
            </div>
          </div>
        )}

        {/* Android / Chrome Instructions if not iOS or manual */}
        {(!isIos || isAndroid) && !hasNativePrompt && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
              How to install on Android / Chrome:
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#334155' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                1
              </div>
              <div>
                Tap the <strong>three dots menu</strong> <MoreVertical size={14} style={{ verticalAlign: 'middle', margin: '0 2px' }} /> in the top right corner of Chrome.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#334155' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                2
              </div>
              <div>
                Select <strong>Install app</strong> or <strong>Add to Home screen</strong>.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#334155' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                3
              </div>
              <div>
                Confirm <strong>Install</strong>. Schoolwell is now installed on your phone with zero app-store download needed!
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
        <Button variant="secondary" onClick={onClose}>
          Got it (समझ गया)
        </Button>
      </div>
    </Modal>
  );
}
