import { useState, useEffect, useCallback } from 'react';

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      return (window as any).__deferredPrompt || null;
    }
    return null;
  });

  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ((window as any).__deferredPrompt && !deferredPrompt) {
      setDeferredPrompt((window as any).__deferredPrompt);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      (window as any).__deferredPrompt = e;
      setDeferredPrompt(e);
    };

    const handlePromptReady = () => {
      if ((window as any).__deferredPrompt) {
        setDeferredPrompt((window as any).__deferredPrompt);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      (window as any).__deferredPrompt = null;
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-prompt-ready', handlePromptReady);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-prompt-ready', handlePromptReady);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [deferredPrompt]);

  const isIos =
    typeof window !== 'undefined' &&
    (/iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase()) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1));

  const isAndroid =
    typeof window !== 'undefined' && /android/.test(window.navigator.userAgent.toLowerCase());

  const promptInstall = useCallback(async (): Promise<boolean> => {
    const promptEvent =
      deferredPrompt || (typeof window !== 'undefined' ? (window as any).__deferredPrompt : null);

    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        (window as any).__deferredPrompt = null;
        setDeferredPrompt(null);
        if (choice && choice.outcome === 'accepted') {
          setIsInstalled(true);
        }
        return true;
      } catch (err) {
        console.error('PWA install error', err);
      }
    }
    return false;
  }, [deferredPrompt]);

  const hasNativePrompt = Boolean(
    deferredPrompt || (typeof window !== 'undefined' && (window as any).__deferredPrompt)
  );

  return {
    isInstallable: !isInstalled,
    isInstalled,
    isIos,
    isAndroid,
    hasNativePrompt,
    promptInstall,
  };
}
