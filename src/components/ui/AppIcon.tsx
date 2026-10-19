import type { CSSProperties } from 'react';

export const iconNames = [
  'overview',
  'student',
  'teacher',
  'staff',
  'attendance',
  'fees',
  'academics',
  'notifications',
  'templates',
  'security',
  'search-dark',
  'settings',
  'edit',
  'receipt',
  'save',
  'finance-balance',
  'search',
  'send',
  'verified',
  'tag',
  'delete',
  'trophy',
  'upload',
  'user-check',
  'users',
  'wallet',
  'copy',
  'download',
  'document',
  'graduation-cap',
  'inbox',
  'overview-grid',
] as const;

export type IconName = (typeof iconNames)[number];

export interface AppIconProps {
  name: IconName;
  size?: number;
  alt?: string;
  basePath?: string;
  className?: string;
  style?: CSSProperties;
  loading?: 'lazy' | 'eager';
}

export function AppIcon({
  name,
  size = 24,
  alt = '',
  basePath = '/icons',
  className,
  style,
  loading = 'lazy',
}: AppIconProps) {
  const base = basePath.replace(/\/$/, '');
  return (
    <img
      src={`${base}/webp/256/${name}.webp`}
      srcSet={[32, 48, 64, 96, 128, 256]
        .map((px) => `${base}/webp/${px}/${name}.webp ${px}w`)
        .join(', ')}
      sizes={`${size}px`}
      width={size}
      height={size}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      decoding="async"
      loading={loading}
      className={className ? `app-icon ${className}` : 'app-icon'}
      style={{
        display: 'inline-block',
        objectFit: 'contain',
        flexShrink: 0,
        verticalAlign: 'middle',
        ...style,
      }}
    />
  );
}

export default AppIcon;
