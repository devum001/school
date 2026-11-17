import { useState, useEffect, useCallback } from 'react';

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const isIos =
    typeof window !== 'undefined' &&
    (/iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase()) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1));

  const isAndroid =
    typeof window !== 'undefined' && /android/.test(window.navigator.userAgent.toLowerCase());

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          setDeferredPrompt(null);
          setIsInstalled(true);
          return true;
        }
      } catch (err) {
        console.error('PWA install error', err);
      }
    }
    return false;
  }, [deferredPrompt]);

  return {
    isInstallable: !isInstalled,
    isInstalled,
    isIos,
    isAndroid,
    hasNativePrompt: Boolean(deferredPrompt),
    promptInstall,
  };
}
