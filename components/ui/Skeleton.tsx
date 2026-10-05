import type { CSSProperties, ReactNode } from 'react';
import { useT } from '../../lib/i18n';
import { cx } from './cx';
import '../../lib/common-strings';

export interface SkeletonProps {
  className?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'card' | 'full';
  style?: CSSProperties;
}

const ROUND = { sm: 'rounded-md', md: 'rounded-xl', lg: 'rounded-list', card: 'rounded-card', full: 'rounded-full' } as const;

/** Placeholder block with a soft shimmer (flat under reduced motion). Size it with classes. */
export function Skeleton({ className, rounded = 'md', style }: SkeletonProps) {
  return <span aria-hidden style={style} className={cx('skeleton block', ROUND[rounded], className)} />;
}

const WIDTHS = ['100%', '92%', '76%', '84%', '60%'];

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <span aria-hidden className={cx('flex flex-col gap-2.5', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} rounded="sm" className="h-3.5" style={{ width: i === lines - 1 && lines > 1 ? '60%' : WIDTHS[i % WIDTHS.length] }} />
      ))}
    </span>
  );
}

/** Screen readers hear one "लोड हो रहा है…" instead of a pile of empty shapes. */
function LoadingRegion({ children, className }: { children: ReactNode; className?: string }) {
  const t = useT();
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{t('common.loading')}</span>
      {children}
    </div>
  );
}

export interface SkeletonCardProps {
  /** Leading media placeholder like a list row thumbnail / icon. */
  media?: boolean;
  lines?: number;
  /** A taller block on top (hero / weather card). */
  banner?: boolean;
  className?: string;
}

export function SkeletonCard({ media = true, lines = 2, banner = false, className }: SkeletonCardProps) {
  return (
    <LoadingRegion className={cx('rounded-card border border-line bg-surface p-4', className)}>
      {banner && <Skeleton rounded="lg" className="mb-4 h-28 w-full" />}
      <div className="flex items-center gap-3">
        {media && <Skeleton rounded="md" className="size-14 shrink-0" />}
        <div className="min-w-0 flex-1">
          <Skeleton rounded="sm" className="mb-2.5 h-4 w-1/2" />
          <SkeletonText lines={lines} />
        </div>
      </div>
    </LoadingRegion>
  );
}

export interface SkeletonListProps {
  rows?: number;
  /** card = separate row cards (default), plain = rows inside one card. */
  variant?: 'card' | 'plain';
  media?: 'square' | 'circle' | 'none';
  /** Show a trailing value placeholder (prices, trends). */
  trailing?: boolean;
  className?: string;
}

/** Mirrors a ListRow list so the layout doesn't jump when data arrives. */
export function SkeletonList({ rows = 4, variant = 'card', media = 'square', trailing = false, className }: SkeletonListProps) {
  const row = (i: number) => (
    <div
      key={i}
      className={cx(
        'flex min-h-16 items-center gap-3 px-4 py-3',
        variant === 'card' ? 'rounded-list border border-line bg-surface' : i > 0 && 'border-t border-line',
      )}
    >
      {media !== 'none' && <Skeleton rounded={media === 'circle' ? 'full' : 'md'} className={media === 'circle' ? 'size-11' : 'size-14'} />}
      <div className="min-w-0 flex-1">
        <Skeleton rounded="sm" className="mb-2 h-4" style={{ width: `${55 + ((i * 17) % 30)}%` }} />
        <Skeleton rounded="sm" className="h-3.5" style={{ width: `${35 + ((i * 23) % 25)}%` }} />
      </div>
      {trailing && <Skeleton rounded="sm" className="h-4 w-14" />}
    </div>
  );
  return (
    <LoadingRegion
      className={cx(variant === 'card' ? 'flex flex-col gap-3' : 'overflow-hidden rounded-list border border-line bg-surface', className)}
    >
      {Array.from({ length: rows }, (_, i) => row(i))}
    </LoadingRegion>
  );
}
