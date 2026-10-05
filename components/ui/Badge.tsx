import type { ReactNode } from 'react';
import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import { useT } from '../../lib/i18n';
import { cx } from './cx';
import { renderIcon, type IconLike } from './icon';
import { SOLID_BG, TINT_BG, TONE_TEXT, type Tone } from './tones';
import './strings';

export interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
  /** soft = tint + coloured text (default), solid = filled with white text, outline = border only. */
  variant?: 'soft' | 'solid' | 'outline';
  icon?: IconLike;
  size?: 'sm' | 'md';
  className?: string;
}

/** Small status label ("पुरानी जानकारी", "नया", "उचित"). Text never goes below 13px. */
export function Badge({ children, tone = 'green', variant = 'soft', icon, size = 'sm', className }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex max-w-full shrink-0 items-center gap-1 rounded-full font-semibold whitespace-nowrap',
        size === 'sm' ? 'min-h-6 px-2.5 text-caption leading-snug' : 'min-h-7 px-3 text-small leading-snug',
        variant === 'soft' && cx(TINT_BG[tone], TONE_TEXT[tone]),
        variant === 'solid' && cx(SOLID_BG[tone], 'text-white'),
        variant === 'outline' && cx('border border-current bg-transparent', TONE_TEXT[tone]),
        className,
      )}
    >
      {renderIcon(icon, { className: 'size-3.5 shrink-0', strokeWidth: 2.5 })}
      <span className="truncate">{children}</span>
    </span>
  );
}

export interface CountBadgeProps {
  /** Unread count; 0/undefined renders nothing unless `dot`. */
  count?: number;
  /** A plain red dot (no number). */
  dot?: boolean;
  max?: number;
  /** Ring colour that separates the badge from what it sits on. */
  ring?: 'surface' | 'appbar' | 'none';
  className?: string;
}

/** Red count/dot for icons (bell, nav items). Decorative: put the count in the parent's aria-label. */
export function CountBadge({ count, dot, max = 99, ring = 'surface', className }: CountBadgeProps) {
  const ringCls = ring === 'surface' ? 'ring-2 ring-surface' : ring === 'appbar' ? 'ring-2 ring-appbar' : '';
  if (dot) {
    return <span aria-hidden className={cx('block size-2.5 rounded-full bg-danger-fill', ringCls, className)} />;
  }
  if (!count || count <= 0) return null;
  return (
    <span
      aria-hidden
      className={cx(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger-fill px-1.5 text-caption leading-none font-bold text-white tabular-nums',
        ringCls,
        className,
      )}
    >
      {count > max ? `${max}+` : count}
    </span>
  );
}

export type TrendDirection = 'up' | 'down' | 'stable';

export interface TrendBadgeProps {
  /** Percentage change, e.g. 1.8 or -0.5. */
  value: number;
  /** Override the direction derived from `value`. */
  direction?: TrendDirection;
  decimals?: number;
  /** Which direction is good news (expenses: 'down'). Up is green by default. */
  goodWhen?: 'up' | 'down';
  /** text = coloured arrow + number; pill = on a tinted pill. */
  variant?: 'text' | 'pill';
  size?: 'sm' | 'md';
  className?: string;
}

export function trendOf(value: number, decimals = 1): TrendDirection {
  const rounded = Number(Math.abs(value).toFixed(decimals));
  if (rounded === 0) return 'stable';
  return value > 0 ? 'up' : 'down';
}

/** Price/metric trend: green "↑ 1.8%", red "↓ 0.5%", orange "→ 0%". */
export function TrendBadge({ value, direction, decimals = 1, goodWhen = 'up', variant = 'text', size = 'md', className }: TrendBadgeProps) {
  const t = useT();
  const dir = direction ?? trendOf(value, decimals);
  const tone: Tone = dir === 'stable' ? 'orange' : dir === goodWhen ? 'green' : 'red';
  const Icon = dir === 'up' ? ArrowUp : dir === 'down' ? ArrowDown : ArrowRight;
  const pct = dir === 'stable' ? '0%' : `${Math.abs(value).toFixed(decimals)}%`;
  return (
    <span
      className={cx(
        'inline-flex items-center gap-0.5 font-semibold whitespace-nowrap tabular-nums',
        size === 'sm' ? 'text-caption' : 'text-small',
        TONE_TEXT[tone],
        variant === 'pill' && cx('min-h-6 rounded-full px-2', TINT_BG[tone]),
        className,
      )}
    >
      <Icon aria-hidden className={size === 'sm' ? 'size-3.5' : 'size-4'} strokeWidth={2.5} />
      <span aria-hidden className="pt-px">{pct}</span>
      <span className="sr-only">{`${t(`ui.trend.${dir}`)} ${pct}`}</span>
    </span>
  );
}
