import { memo, useId, type ComponentPropsWithoutRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { CompassScene } from './CompassScene';
import './compass-animation.css';
import './app-loader.css';

export type AppLoaderVariant = 'inline' | 'overlay' | 'fullscreen';
export type AppLoaderSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export interface AppLoaderProps extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  /**
   * How the loader is placed.
   * - `inline` — flows in its parent: cards, tables, sections, buttons.
   * - `overlay` — covers the nearest positioned ancestor (give it `relative`)
   *   so a section cannot be interacted with mid-mutation.
   * - `fullscreen` — covers the viewport for app boot / page transitions.
   *   Portalled to `document.body`.
   * @default "inline"
   */
  variant?: AppLoaderVariant;
  /**
   * Scene size: `xs` 28px · `sm` 40px · `md` 64px · `lg` 96px · `xl` 120px.
   * Line weights are tuned per size so the compass stays legible when small.
   * @default "xl"
   */
  size?: AppLoaderSize;
  /**
   * Accessible description announced while loading.
   * @default "Loading"
   */
  label?: string;
  /** Optional visible text, shown under the animation. */
  message?: string;
  /**
   * Accent for the ink, pencil and compass body. Any CSS colour; defaults to
   * Schoolwell's emerald/forest green token (`--green`).
   */
  accent?: string;
  /** Merged onto the outermost element (the overlay for overlay variants). */
  className?: string;
}

function AppLoaderImpl({
  variant = 'inline',
  size = 'xl',
  label = 'Loading',
  message,
  accent,
  className,
  style,
  ...rest
}: AppLoaderProps) {
  const uid = useId().replace(/:/g, '');
  const text = message?.trim() ? message.trim() : undefined;
  const isOverlay = variant !== 'inline';

  const sceneStyle: CSSProperties | undefined = accent
    ? ({ ...style, '--sw-accent': accent } as CSSProperties)
    : style;

  const loader = (
    <div
      {...(isOverlay ? {} : rest)}
      data-size={size}
      className={cn('sw-loader', !isOverlay && className)}
      style={
        isOverlay
          ? accent
            ? ({ '--sw-accent': accent } as CSSProperties)
            : undefined
          : sceneStyle
      }
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={text ? undefined : label}
    >
      <div className="sw-loader__figure">
        <CompassScene u={uid} />
      </div>
      {text ? <p className="sw-loader__message">{text}</p> : null}
      {text && label !== text ? <span className="sr-only">{label}</span> : null}
    </div>
  );

  if (!isOverlay) return loader;

  const overlay = (
    <div
      {...rest}
      data-variant={variant}
      style={style}
      className={cn('sw-loader-overlay', className)}
    >
      {loader}
    </div>
  );

  return variant === 'fullscreen' && typeof document !== 'undefined'
    ? createPortal(overlay, document.body)
    : overlay;
}

export const AppLoader = memo(AppLoaderImpl);
AppLoader.displayName = 'AppLoader';
export default AppLoader;
