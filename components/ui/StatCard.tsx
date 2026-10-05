import type { KeyboardEvent, ReactNode } from 'react';
import { cx } from './cx';
import { DUOTONE, renderIcon, type IconLike } from './icon';
import { TINT_BG, TONE_TEXT, type Tone } from './tones';

export interface StatCardProps {
  /** Sentence-case label without a trailing colon ("कुल खर्च"). */
  label: ReactNode;
  /** Pre-formatted value ("₹28,500"). */
  value: ReactNode;
  tone?: Tone;
  icon?: IconLike;
  /** Small line under the value (period, unit, a TrendBadge…). */
  hint?: ReactNode;
  /** md = half-width stat, lg = wide card with a larger value ("अनुमानित लाभ"). */
  size?: 'md' | 'lg';
  /** Colour the value with the tone (keeps AA contrast); default ink. */
  colorValue?: boolean;
  /** Right side of the lg variant (e.g. a Sparkline). */
  aside?: ReactNode;
  onPress?: () => void;
  className?: string;
}

/** Tinted figure card: label + big value (proportional figures, never tabular at display size). */
export function StatCard({ label, value, tone = 'green', icon, hint, size = 'md', colorValue = false, aside, onPress, className }: StatCardProps) {
  const pressProps = onPress
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onClick: onPress,
        onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onPress();
          }
        },
      }
    : {};
  return (
    <div
      className={cx(
        'flex min-w-0 items-center gap-3 rounded-card p-4 hc:border hc:border-line',
        TINT_BG[tone],
        onPress && 'press cursor-pointer',
        className,
      )}
      {...pressProps}
    >
      {/* A size container: the value scales with the room it really has (half-width card, aside). */}
      <div className="@container min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {icon && (
            <span className={cx('inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface/80', TONE_TEXT[tone])}>
              {renderIcon(icon, { className: 'size-4.5', strokeWidth: 2.25, ...DUOTONE })}
            </span>
          )}
          <span className="min-w-0 truncate pt-0.5 text-small font-medium text-ink-2">{label}</span>
        </div>
        <div
          className={cx(
            // "₹1,25,000" at 130% text is wider than a half-width card: shrink with the container
            // (cqi), and as a last resort wrap rather than spill out of the tint.
            'mt-2 min-w-0 leading-tight font-bold [overflow-wrap:anywhere]',
            size === 'lg' ? 'text-[length:clamp(1.25rem,14cqi,2rem)]' : 'text-[length:clamp(1rem,18cqi,1.5rem)]',
            colorValue ? TONE_TEXT[tone] : 'text-ink',
          )}
        >
          {value}
        </div>
        {hint != null && <div className="mt-1 text-caption text-ink-2">{hint}</div>}
      </div>
      {aside != null && <div className="shrink-0">{aside}</div>}
    </div>
  );
}
