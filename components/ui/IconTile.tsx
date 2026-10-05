import type { ReactNode } from 'react';
import { CountBadge } from './Badge';
import { cx } from './cx';
import { DUOTONE, renderIcon, type IconLike } from './icon';
import { ToneIcon } from './Media';
import { TINT_BG, TONE_TEXT, type Tone } from './tones';

export interface IconTileProps {
  icon: IconLike;
  label: ReactNode;
  tone?: Tone;
  onPress?: () => void;
  /** grid = 56px tinted icon + label below (Home quick actions); card = whole tile tinted (calculators). */
  variant?: 'grid' | 'card';
  /** Second line in the card variant. */
  description?: ReactNode;
  /** Count / dot on the icon. */
  badge?: number | boolean;
  disabled?: boolean;
  /** Accessible name when the visible label is not enough. */
  ariaLabel?: string;
  className?: string;
}

/** Quick-action tile: soft tinted rounded icon with a 13–14px label. */
export function IconTile({
  icon,
  label,
  tone = 'green',
  onPress,
  variant = 'grid',
  description,
  badge,
  disabled,
  ariaLabel,
  className,
}: IconTileProps) {
  const badgeEl = badge ? (
    <CountBadge
      count={typeof badge === 'number' ? badge : undefined}
      dot={badge === true}
      className={cx('absolute', badge === true ? 'top-1 right-1' : '-top-1.5 -right-1.5')}
    />
  ) : null;

  if (variant === 'card') {
    return (
      <button
        type="button"
        onClick={onPress}
        disabled={disabled}
        aria-label={ariaLabel}
        className={cx(
          'press relative flex min-h-28 w-full flex-col items-start gap-3 rounded-tile p-4 text-left disabled:opacity-50 hc:border hc:border-line',
          TINT_BG[tone],
          className,
        )}
      >
        <span className={cx('inline-flex size-11 items-center justify-center rounded-xl bg-surface/80', TONE_TEXT[tone])}>
          {renderIcon(icon, { className: 'size-6', strokeWidth: 2, ...DUOTONE })}
        </span>
        <span className="min-w-0">
          <span className="block text-small leading-snug font-semibold text-ink">{label}</span>
          {description != null && <span className="mt-0.5 block text-caption text-ink-2">{description}</span>}
        </span>
        {badgeEl}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cx(
        'press group flex min-h-12 w-full flex-col items-center gap-2 rounded-tile px-0.5 py-1 text-center disabled:opacity-50',
        className,
      )}
    >
      <span className="relative">
        <ToneIcon icon={icon} tone={tone} size="lg" shape="rounded" />
        {badgeEl}
      </span>
      <span className="line-clamp-2 text-caption leading-snug font-medium text-ink">{label}</span>
    </button>
  );
}

export interface TileGridProps {
  children: ReactNode;
  /** 4 for Home quick actions, 2–3 for calculator tiles. */
  columns?: 2 | 3 | 4;
  className?: string;
}

const COLS = { 2: 'grid-cols-2 gap-3', 3: 'grid-cols-3 gap-3', 4: 'grid-cols-4 gap-x-2 gap-y-4' } as const;

export function TileGrid({ children, columns = 4, className }: TileGridProps) {
  return <div className={cx('grid', COLS[columns], className)}>{children}</div>;
}
