import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppLoader, type AppLoaderSize } from './app-loader/AppLoader';
import './app-loader/app-loader.css';

export interface LoadingOverlayProps {
  loading: boolean;
  size?: AppLoaderSize;
  label?: string;
  message?: string;
  children: ReactNode;
  className?: string;
  local?: boolean;
}

interface LoaderEntry {
  label: string;
  message: string;
}

interface WorkspaceLoadingContextValue {
  setEntry: (id: string, entry: LoaderEntry | null) => void;
}

const WorkspaceLoadingContext = createContext<WorkspaceLoadingContextValue | null>(null);

const HOLD_BEFORE_EXIT_MS = 140;
const EXIT_DURATION_MS = 350;

export function WorkspaceLoadingBoundary({
  routeLoading = false,
  defaultMessage = 'Loading workspace…',
  children,
}: {
  routeLoading?: boolean;
  defaultMessage?: string;
  children: ReactNode;
}) {
  const entriesRef = useRef<Map<string, LoaderEntry>>(new Map());
  const [snapshot, setSnapshot] = useState<{ active: boolean; label: string; message: string }>({
    active: routeLoading,
    label: defaultMessage,
    message: defaultMessage,
  });

  const sync = useCallback(() => {
    const values = Array.from(entriesRef.current.values());
    const latest = values[values.length - 1];
    setSnapshot((prev) => {
      const nextActive = values.length > 0;
      const nextLabel = latest?.label ?? prev.label;
      const nextMessage = latest?.message ?? prev.message;
      if (
        prev.active === nextActive &&
        prev.label === nextLabel &&
        prev.message === nextMessage
      ) {
        return prev;
      }
      return {
        active: nextActive,
        label: nextLabel,
        message: nextMessage,
      };
    });
  }, []);

  const setEntry = useCallback(
    (id: string, entry: LoaderEntry | null) => {
      if (entry) {
        entriesRef.current.set(id, entry);
      } else {
        entriesRef.current.delete(id);
      }
      sync();
    },
    [sync],
  );

  const contextValue = useMemo<WorkspaceLoadingContextValue>(() => ({ setEntry }), [setEntry]);

  const rawLoading = routeLoading || snapshot.active;
  const [effectiveLoading, setEffectiveLoading] = useState(rawLoading);
  const [prevRawLoading, setPrevRawLoading] = useState(rawLoading);

  if (rawLoading !== prevRawLoading) {
    setPrevRawLoading(rawLoading);
    if (rawLoading) {
      setEffectiveLoading(true);
    }
  }

  useEffect(() => {
    if (rawLoading) return;
    const timer = window.setTimeout(() => {
      setEffectiveLoading(false);
    }, HOLD_BEFORE_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [rawLoading]);

  const [prevEffective, setPrevEffective] = useState(effectiveLoading);
  const [exiting, setExiting] = useState(false);

  if (effectiveLoading !== prevEffective) {
    setPrevEffective(effectiveLoading);
    if (!effectiveLoading) {
      setExiting(true);
    } else if (exiting) {
      setExiting(false);
    }
  }

  useEffect(() => {
    if (effectiveLoading || !exiting) return;
    const timer = window.setTimeout(() => {
      setExiting(false);
    }, EXIT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [effectiveLoading, exiting]);

  const rendered = effectiveLoading || exiting;
  const displayLabel = snapshot.active ? snapshot.label : defaultMessage;
  const displayMessage = snapshot.active ? snapshot.message : defaultMessage;

  return (
    <WorkspaceLoadingContext.Provider value={contextValue}>
      <div
        className={`loading-overlay-host workspace-loading-host ${effectiveLoading ? 'is-loading' : ''}`.trim()}
        aria-busy={effectiveLoading}
      >
        <div className="loading-overlay-content">{children}</div>
        {rendered && (
          <div
            className={`loading-overlay-layer workspace-centered-loader ${!effectiveLoading && exiting ? 'is-exiting' : ''}`}
          >
            <AppLoader size="xl" label={displayLabel} message={displayMessage} />
          </div>
        )}
      </div>
    </WorkspaceLoadingContext.Provider>
  );
}

export function useWorkspaceLoading(loading: boolean, label = 'Loading…', message?: string): boolean {
  const ctx = useContext(WorkspaceLoadingContext);
  const id = useId();
  useEffect(() => {
    if (!ctx) return;
    if (loading) {
      ctx.setEntry(id, { label, message: message ?? label });
    } else {
      ctx.setEntry(id, null);
    }
    return () => {
      ctx.setEntry(id, null);
    };
  }, [ctx, id, loading, label, message]);
  return Boolean(ctx);
}

export function LoadingOverlay({
  loading,
  size = 'xl',
  label = 'Loading',
  message,
  children,
  className = '',
  local = false,
}: LoadingOverlayProps) {
  const ctx = useContext(WorkspaceLoadingContext);
  const id = useId();
  const delegateToWorkspace = Boolean(ctx) && !local;

  useEffect(() => {
    if (!delegateToWorkspace || !ctx) return;
    if (loading) {
      ctx.setEntry(id, { label, message: message ?? label });
    } else {
      ctx.setEntry(id, null);
    }
    return () => {
      ctx.setEntry(id, null);
    };
  }, [delegateToWorkspace, ctx, id, loading, label, message]);

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
    if (delegateToWorkspace || loading || !exiting) return;
    const timer = window.setTimeout(() => {
      setExiting(false);
    }, EXIT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [delegateToWorkspace, loading, exiting]);

  if (delegateToWorkspace) {
    return className ? <div className={className}>{children}</div> : <>{children}</>;
  }

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
