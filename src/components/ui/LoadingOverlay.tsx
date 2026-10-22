import { useEffect, useState, type ReactNode } from 'react';
import { AppLoader, type AppLoaderSize } from './app-loader/AppLoader';
import './app-loader/app-loader.css';

export interface LoadingOverlayProps {
  loading: boolean;
  size?: AppLoaderSize;
  label?: string;
  message?: string;
  children: ReactNode;
  className?: string;
}

const EXIT_DURATION_MS = 350;

export function LoadingOverlay({
  loading,
  size = 'xl',
  label = 'Loading',
  message,
  children,
  className = '',
}: LoadingOverlayProps) {
  const [prevLoading, setPrevLoading] = useState(loading);
  const [exiting, setExiting] = useState(false);

  if (loading !== prevLoading) {
    setPrevLoading(loading);
    if (!loading) {
      setExiting(true);
    } else if (exiting) {
      setExiting(false);
    }
  }

  useEffect(() => {
    if (loading || !exiting) return;
    const timer = window.setTimeout(() => {
      setExiting(false);
    }, EXIT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [loading, exiting]);

  const rendered = loading || exiting;

  return (
    <div
      className={`loading-overlay-host ${loading ? 'is-loading' : ''} ${className}`.trim()}
      aria-busy={loading}
    >
      <div className="loading-overlay-content">{children}</div>
      {rendered && (
        <div className={`loading-overlay-layer ${!loading && exiting ? 'is-exiting' : ''}`}>
          <AppLoader size={size} label={label} message={message ?? label} />
        </div>
      )}
    </div>
  );
}

export default LoadingOverlay;
