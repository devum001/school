import { useState, useEffect } from 'react';
import { Modal, Button } from '../ui/Primitives';
import { AppIcon } from '../ui/AppIcon';
import {
  Share,
  PlusSquare,
  MoreVertical,
  CheckCircle2,
  Download,
  Smartphone,
  Laptop,
  Compass,
  Globe,
  Sparkles,
} from 'lucide-react';

export interface PwaInstallModalProps {
  open: boolean;
  onClose: () => void;
  isIos?: boolean;
  isIosChrome?: boolean;
  isIosSafari?: boolean;
  isMac?: boolean;
  isMacSafari?: boolean;
  isMacChrome?: boolean;
  isAndroid?: boolean;
  hasNativePrompt?: boolean;
  onNativeInstall?: () => void;
}

type TabType = 'ios-chrome' | 'ios-safari' | 'mac-safari' | 'mac-chrome' | 'android' | 'desktop';

export default function PwaInstallModal({
  open,
  onClose,
  isIos,
  isIosChrome,
  isIosSafari,
  isMac,
  isMacSafari,
  isMacChrome,
  isAndroid,
  onNativeInstall,
  hasNativePrompt,
}: PwaInstallModalProps) {
  // Determine the default tab based on the active device & browser
  const getDefaultTab = (): TabType => {
    if (isIos) {
      return isIosChrome ? 'ios-chrome' : 'ios-safari';
    }
    if (isMac) {
      return isMacSafari ? 'mac-safari' : 'mac-chrome';
    }
    if (isAndroid) {
      return 'android';
    }
    return 'desktop';
  };

  const [activeTab, setActiveTab] = useState<TabType>(getDefaultTab);

  // Sync tab when modal opens or platform flags change
  useEffect(() => {
    if (open) {
      setActiveTab(getDefaultTab());
    }
  }, [open, isIos, isIosChrome, isIosSafari, isMac, isMacSafari, isMacChrome, isAndroid]);

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Install Schoolwell App · ऐप इंस्टॉल करें"
      description="Add Schoolwell to your Home Screen or Desktop for instant full-screen access · तेज़ और सीधे एक्सेस के लिए होम स्क्रीन पर जोड़ें"
      className="pwa-install-modal"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', margin: '8px 0' }}>
        {/* Sleek App Branding Card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '12px 14px',
            background: 'linear-gradient(135deg, rgba(18, 55, 59, 0.06) 0%, rgba(13, 148, 136, 0.06) 100%)',
            border: '1px solid rgba(18, 55, 59, 0.12)',
            borderRadius: '14px',
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '13px',
              background: '#12373b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 14px rgba(18, 55, 59, 0.22)',
            }}
          >
            <AppIcon name="graduation-cap" size={32} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#12373b', lineHeight: 1.2 }}>
                Schoolwell
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: '#e0f2fe',
                  color: '#0369a1',
                  letterSpacing: '0.3px',
                }}
              >
                PWA
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#52666a', marginTop: '2px' }}>
              School Management System · स्कूल मैनेजमेंट
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                marginTop: '3px',
                fontSize: '11px',
                color: '#0d9488',
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={13} /> Standalone app · No download needed
            </div>
          </div>
        </div>

        {/* 1-Click Native Install Button (when supported by browser, e.g. Android Chrome / Desktop Chrome) */}
        {hasNativePrompt && onNativeInstall && (
          <div style={{ margin: '2px 0' }}>
            <Button
              onClick={() => {
                onNativeInstall();
                onClose();
              }}
              style={{
                width: '100%',
                padding: '12px 18px',
                fontSize: '15px',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #12373b 0%, #0d9488 100%)',
                color: '#ffffff',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(18, 55, 59, 0.25)',
                cursor: 'pointer',
              }}
            >
              <Download size={18} />
              <span>Install Now · अभी इंस्टॉल करें</span>
            </Button>
          </div>
        )}

        {/* Segmented Browser Selector for iPhone & Mac */}
        {(isIos || isMac) && (
          <div
            style={{
              display: 'flex',
              gap: '6px',
              padding: '4px',
              background: '#f1f5f9',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
            }}
          >
            {isIos ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('ios-chrome')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 10px',
                    fontSize: '12px',
                    fontWeight: activeTab === 'ios-chrome' ? 700 : 500,
                    color: activeTab === 'ios-chrome' ? '#12373b' : '#64748b',
                    background: activeTab === 'ios-chrome' ? '#ffffff' : 'transparent',
                    border: 'none',
                    borderRadius: '7px',
                    boxShadow: activeTab === 'ios-chrome' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Globe size={14} />
                  <span>iPhone Chrome</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('ios-safari')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 10px',
                    fontSize: '12px',
                    fontWeight: activeTab === 'ios-safari' ? 700 : 500,
                    color: activeTab === 'ios-safari' ? '#12373b' : '#64748b',
                    background: activeTab === 'ios-safari' ? '#ffffff' : 'transparent',
                    border: 'none',
                    borderRadius: '7px',
                    boxShadow: activeTab === 'ios-safari' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Compass size={14} />
                  <span>iPhone Safari</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('mac-safari')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 10px',
                    fontSize: '12px',
                    fontWeight: activeTab === 'mac-safari' ? 700 : 500,
                    color: activeTab === 'mac-safari' ? '#12373b' : '#64748b',
                    background: activeTab === 'mac-safari' ? '#ffffff' : 'transparent',
                    border: 'none',
                    borderRadius: '7px',
                    boxShadow: activeTab === 'mac-safari' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Compass size={14} />
                  <span>Mac Safari (Dock)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('mac-chrome')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 10px',
                    fontSize: '12px',
                    fontWeight: activeTab === 'mac-chrome' ? 700 : 500,
                    color: activeTab === 'mac-chrome' ? '#12373b' : '#64748b',
                    background: activeTab === 'mac-chrome' ? '#ffffff' : 'transparent',
                    border: 'none',
                    borderRadius: '7px',
                    boxShadow: activeTab === 'mac-chrome' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Globe size={14} />
                  <span>Mac Chrome</span>
                </button>
              </>
            )}
          </div>
        )}

        {/* Content Box with Steps (English First, Hindi Devanagari Second) */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {/* ========================================================= */}
          {/* TAB 1: iPhone Google Chrome                               */}
          {/* ========================================================= */}
          {activeTab === 'ios-chrome' && (
            <>
              {/* Header Badge & Reason */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '8px 12px',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: '#166534',
                }}
              >
                <Smartphone size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 700 }}>
                    iPhone (Google Chrome) · Step-by-Step Guide
                  </div>
                  <div style={{ fontSize: '11px', color: '#15803d', marginTop: '2px' }}>
                    Apple requires manual confirmation to add apps to your Home Screen.
                    <br />
                    (Apple की सुरक्षा नीति के कारण मैन्युअली होम स्क्रीन पर जोड़ना होता है।)
                  </div>
                </div>
              </div>

              {/* Step 1 */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#12373b',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '13px',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  1
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.45 }}>
                    In the top address bar, tap the <strong>Share icon</strong>{' '}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '1px 6px',
                        background: '#e0f2fe',
                        color: '#0369a1',
                        borderRadius: '6px',
                        fontWeight: 600,
                        fontSize: '11px',
                      }}
                    >
                      <Share size={11} /> Share
                    </span>{' '}
                    (next to the URL), OR tap the <strong>Menu (···)</strong> at top-right.
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px', lineHeight: 1.4 }}>
                    ऊपर एड्रेस बार में लिंक के पास बने <strong>शेयर आइकन [ ⎋ ]</strong> पर टैप करें, या ऊपर दायें कोने में <strong>मेनू (···)</strong> दबाएं।
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#12373b',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '13px',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  2
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.45 }}>
                    Scroll down the menu and tap{' '}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '1px 6px',
                        background: '#e0f2fe',
                        color: '#0369a1',
                        borderRadius: '6px',
                        fontWeight: 600,
                        fontSize: '11px',
                      }}
                    >
                      <PlusSquare size={11} /> Add to Home Screen
                    </span>
                    .
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px', lineHeight: 1.4 }}>
                    मेनू में नीचे स्क्रॉल करके <strong>"होम स्क्रीन पर जोड़ें" (Add to Home Screen)</strong> पर टैप करें।
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#0d9488',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '13px',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  3
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.45 }}>
                    Tap <strong>"Add"</strong> at the top-right corner. Schoolwell will appear on your Home Screen!
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px', lineHeight: 1.4 }}>
                    ऊपर दायें कोने में <strong>"Add" (जोड़ें)</strong> पर टैप करें। Schoolwell आपके फ़ोन की होम स्क्रीन पर आ जाएगी!
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ========================================================= */}
          {/* TAB 2: iPhone Apple Safari                                */}
          {/* ========================================================= */}
          {activeTab === 'ios-safari' && (
            <>
              {/* Header Badge & Reason */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '8px 12px',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: '#166534',
                }}
              >
                <Compass size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 700 }}>
                    iPhone / iPad (Safari) · Step-by-Step Guide
                  </div>
                  <div style={{ fontSize: '11px', color: '#15803d', marginTop: '2px' }}>
                    Install via Safari's native Share toolbar.
                    <br />
                    (सफारी के शेयर टूलबार से सीधे होम स्क्रीन पर जोड़ें।)
                  </div>
                </div>
              </div>

              {/* Step 1 */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#12373b',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '13px',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  1
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.45 }}>
                    Tap the <strong>Share button</strong>{' '}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '1px 6px',
                        background: '#e0f2fe',
                        color: '#0369a1',
                        borderRadius: '6px',
                        fontWeight: 600,
                        fontSize: '11px',
                      }}
                    >
                      <Share size={11} /> Share
                    </span>{' '}
                    in the bottom or top Safari toolbar.
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px', lineHeight: 1.4 }}>
                    सफारी टूलबार (स्क्रीन के नीचे या ऊपर) में बने <strong>शेयर आइकन [ ⎋ ]</strong> पर टैप करें।
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#12373b',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '13px',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  2
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.45 }}>
                    Scroll down the sheet and select{' '}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '1px 6px',
                        background: '#e0f2fe',
                        color: '#0369a1',
                        borderRadius: '6px',
                        fontWeight: 600,
                        fontSize: '11px',
                      }}
                    >
                      <PlusSquare size={11} /> Add to Home Screen
                    </span>
                    .
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px', lineHeight: 1.4 }}>
                    मेनू में नीचे स्क्रॉल करके <strong>"होम स्क्रीन पर जोड़ें" (Add to Home Screen)</strong> चुनें।
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#0d9488',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '13px',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  3
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.45 }}>
                    Tap <strong>"Add"</strong> at the top-right corner. The app is ready!
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px', lineHeight: 1.4 }}>
                    ऊपर दायें कोने में <strong>"Add" (जोड़ें)</strong> पर टैप करें। ऐप आपकी होम स्क्रीन पर इंस्टॉल हो जाएगी!
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ========================================================= */}
          {/* TAB 3: Apple PC / Mac Safari (macOS Sonoma / Ventura)     */}
          {/* ========================================================= */}
          {activeTab === 'mac-safari' && (
            <>
              {/* Header Badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '8px 12px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: '#334155',
                }}
              >
                <Laptop size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>
                    Apple Mac (Safari) · Add to Dock
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    Add Schoolwell to your macOS Dock like a native Mac application.
                    <br />
                    (Schoolwell को अपने मैक के डॉक (Dock) में डेस्कटॉप ऐप की तरह जोड़ें।)
                  </div>
                </div>
              </div>

              {/* Step 1 */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#12373b',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '13px',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  1
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.45 }}>
                    In the top macOS menu bar, click <strong>File</strong> (or click the <strong>Share icon</strong>{' '}
                    <Share size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> in Safari toolbar).
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px', lineHeight: 1.4 }}>
                    ऊपर मैक मेनू बार में <strong>File (फ़ाइल)</strong> पर क्लिक करें (या सफारी टूलबार में <strong>शेयर आइकन [ ⎋ ]</strong> दबाएं)।
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#12373b',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '13px',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  2
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.45 }}>
                    Select{' '}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '1px 6px',
                        background: '#e0f2fe',
                        color: '#0369a1',
                        borderRadius: '6px',
                        fontWeight: 600,
                        fontSize: '11px',
                      }}
                    >
                      <PlusSquare size={11} /> Add to Dock...
                    </span>
                    .
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px', lineHeight: 1.4 }}>
                    मेनू में से <strong>"Add to Dock..." (डॉक में जोड़ें)</strong> चुनें।
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#0d9488',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '13px',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  3
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.45 }}>
                    Click <strong>"Add"</strong>. Schoolwell will now sit in your Mac Dock and Launchpad!
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px', lineHeight: 1.4 }}>
                    <strong>"Add"</strong> पर क्लिक करें। Schoolwell आपके मैक डॉक और लॉन्चपैड में एक ऐप की तरह सेव हो जाएगी!
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ========================================================= */}
          {/* TAB 4: Apple PC / Mac Google Chrome                       */}
          {/* ========================================================= */}
          {activeTab === 'mac-chrome' && (
            <>
              {/* Header Badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '8px 12px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: '#334155',
                }}
              >
                <Laptop size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>
                    Apple Mac (Google Chrome) · Install App
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    Install Schoolwell into its own clean desktop window.
                    <br />
                    (स्कूलवेल को मैक पर अलग डेस्कटॉप विंडो ऐप के रूप में चलाएं।)
                  </div>
                </div>
              </div>

              {/* Step 1 */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#12373b',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '13px',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  1
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.45 }}>
                    In the Chrome address bar, click the <strong>Install icon (⊕)</strong> on the right side, OR click the <strong>three dots (⋮)</strong> menu.
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px', lineHeight: 1.4 }}>
                    ऊपर एड्रेस बार में दायें तरफ बने <strong>इंस्टॉल आइकन (⊕)</strong> पर क्लिक करें, या <strong>तीन बिंदु मेनू (⋮)</strong> दबाएं।
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#12373b',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '13px',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  2
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.45 }}>
                    Select <strong>"Install Schoolwell..."</strong> and click <strong>"Install"</strong>.
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px', lineHeight: 1.4 }}>
                    विकल्पों में से <strong>"Install Schoolwell..."</strong> चुनकर <strong>"Install"</strong> पर क्लिक करें।
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#0d9488',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '13px',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  3
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.45 }}>
                    Schoolwell will launch immediately in a dedicated standalone app window!
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px', lineHeight: 1.4 }}>
                    Schoolwell तुरंत आपकी स्क्रीन पर अपनी अलग डेस्कटॉप ऐप विंडो में खुल जाएगी!
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ========================================================= */}
          {/* TAB 5: Android / Chrome fallback                          */}
          {/* ========================================================= */}
          {(activeTab === 'android' || activeTab === 'desktop') && (
            <>
              {/* Header Badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '8px 12px',
                  background: '#fefce8',
                  border: '1px solid #fef08a',
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: '#854d0e',
                }}
              >
                <Sparkles size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 700 }}>
                    Android / Chrome Browser Guide
                  </div>
                  <div style={{ fontSize: '11px', color: '#a16207', marginTop: '2px' }}>
                    If the 1-click install prompt didn't appear automatically, use these steps.
                    <br />
                    (यदि डायरेक्ट पॉपअप नहीं आया है, तो ब्राउज़र मेनू से इंस्टॉल करें।)
                  </div>
                </div>
              </div>

              {/* Step 1 */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#12373b',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '13px',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  1
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.45 }}>
                    Tap the <strong>three dots menu</strong>{' '}
                    <MoreVertical size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> in the top-right corner of Chrome.
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px', lineHeight: 1.4 }}>
                    क्रोम के ऊपर दायें कोने में <strong>तीन बिंदु मेनू (⋮)</strong> पर टैप करें।
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#12373b',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '13px',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  2
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.45 }}>
                    Select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px', lineHeight: 1.4 }}>
                    मेनू में से <strong>"Install app"</strong> या <strong>"Add to Home screen"</strong> चुनें।
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#0d9488',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '13px',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  3
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.45 }}>
                    Confirm <strong>"Install"</strong>. Schoolwell is now installed on your phone!
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px', lineHeight: 1.4 }}>
                    <strong>"Install"</strong> पर टैप करके पुष्टि करें। Schoolwell आपके फ़ोन पर इंस्टॉल हो जाएगी!
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal Actions */}
      <div
        className="modal-actions"
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '10px',
          marginTop: '16px',
          paddingTop: '10px',
          borderTop: '1px solid #f1f5f9',
        }}
      >
        <Button
          variant="primary"
          onClick={onClose}
          style={{
            minWidth: '130px',
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: 700,
            background: '#12373b',
            color: '#ffffff',
            borderRadius: '10px',
            cursor: 'pointer',
          }}
        >
          Got it · समझ गया
        </Button>
      </div>
    </Modal>
  );
}
