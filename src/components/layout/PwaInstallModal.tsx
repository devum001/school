import { Modal, Button } from '../ui/Primitives';
import { AppIcon } from '../ui/AppIcon';
import { Share, PlusSquare, MoreVertical, CheckCircle2, Download } from 'lucide-react';

interface PwaInstallModalProps {
  open: boolean;
  onClose: () => void;
  isIos: boolean;
  isAndroid?: boolean;
  onNativeInstall?: () => void;
  hasNativePrompt?: boolean;
}

export default function PwaInstallModal({
  open,
  onClose,
  isIos,
  onNativeInstall,
  hasNativePrompt,
}: PwaInstallModalProps) {
  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Install Schoolwell App · ऐप इंस्टॉल करें"
      description="Schoolwell ko apne device ki home screen par add karein taaki instant full-screen access aur faster performance mile."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', margin: '12px 0' }}>
        {/* App Info Card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '12px 14px',
            background: 'rgba(18, 55, 59, 0.04)',
            border: '1px solid rgba(18, 55, 59, 0.12)',
            borderRadius: '12px',
          }}
        >
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '12px',
              background: '#12373b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(18, 55, 59, 0.2)',
            }}
          >
            <AppIcon name="graduation-cap" size={32} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#12373b', lineHeight: 1.2 }}>
              Schoolwell
            </div>
            <div style={{ fontSize: '12px', color: '#52666a', marginTop: '2px' }}>
              School Management System · Web App
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                marginTop: '4px',
                fontSize: '11px',
                color: '#0d9488',
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={13} /> Fast, lightweight & battery efficient
            </div>
          </div>
        </div>

        {/* 1-Click Native Install Button (Android / Chrome / Edge) */}
        {hasNativePrompt && onNativeInstall && (
          <div style={{ margin: '4px 0' }}>
            <Button
              onClick={() => {
                onNativeInstall();
                onClose();
              }}
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '15px',
                fontWeight: 700,
                background: '#12373b',
                color: '#ffffff',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(18, 55, 59, 0.25)',
              }}
            >
              <Download size={18} />
              Install Now (अभी इंस्टॉल करें)
            </Button>
          </div>
        )}

        {/* iOS iPhone / iPad Safari Step-by-Step Visual Guide */}
        {isIos && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '14px',
              borderRadius: '12px',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
              iPhone / iPad (Safari) me install karne ke aasan steps:
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#334155' }}>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: '#0284c7',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '12px',
                  flexShrink: 0,
                }}
              >
                1
              </div>
              <div style={{ flex: 1 }}>
                Neeche Safari toolbar me <strong>Share button</strong>{' '}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    padding: '2px 6px',
                    background: '#e0f2fe',
                    color: '#0369a1',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '12px',
                  }}
                >
                  <Share size={12} /> Share
                </span>{' '}
                par tap karein.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#334155' }}>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: '#0284c7',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '12px',
                  flexShrink: 0,
                }}
              >
                2
              </div>
              <div style={{ flex: 1 }}>
                Menu me thoda neeche scroll karke{' '}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    padding: '2px 6px',
                    background: '#e0f2fe',
                    color: '#0369a1',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '12px',
                  }}
                >
                  <PlusSquare size={12} /> Add to Home Screen
                </span>{' '}
                chunein.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#334155' }}>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: '#0284c7',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '12px',
                  flexShrink: 0,
                }}
              >
                3
              </div>
              <div style={{ flex: 1 }}>
                Top-right corner me <strong>Add</strong> par tap karein. Schoolwell aapke phone par native app ban jayega!
              </div>
            </div>
          </div>
        )}

        {/* Android Manual Guide (if native prompt is deferred) */}
        {!isIos && !hasNativePrompt && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              background: '#fffbeb',
              border: '1px solid #fef3c7',
              padding: '14px',
              borderRadius: '12px',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#92400e' }}>
              Chrome / Android me install karne ke steps:
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#78350f' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: '#f59e0b',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '12px',
                  flexShrink: 0,
                }}
              >
                1
              </div>
              <div>
                Chrome ke top-right corner me <strong>three dots</strong>{' '}
                <MoreVertical size={13} style={{ verticalAlign: 'middle', display: 'inline' }} /> par tap karein.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#78350f' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: '#f59e0b',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '12px',
                  flexShrink: 0,
                }}
              >
                2
              </div>
              <div>
                Menu me <strong>'Install app'</strong> ya <strong>'Add to Home screen'</strong> par tap karein.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#78350f' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: '#f59e0b',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '12px',
                  flexShrink: 0,
                }}
              >
                3
              </div>
              <div>
                <strong>Install</strong> confirm karein. Schoolwell turant aapke phone me install ho jayega!
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
        <Button variant="secondary" onClick={onClose} style={{ minWidth: '100px' }}>
          Got it (समझ गया)
        </Button>
      </div>
    </Modal>
  );
}
