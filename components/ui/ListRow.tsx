import { Children, isValidElement, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cx } from './cx';

export interface ListRowProps {
  /** Crop thumbnail, ToneIcon, Avatar, DateTile… */
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Small extra line under the subtitle (source, date). */
  meta?: ReactNode;
  /** Right side: trend, price, time, a Checkbox/Toggle (stays separately clickable). */
  trailing?: ReactNode;
  /** Chevron on the right. Default: shown when pressable and there is no trailing. */
  chevron?: boolean;
  onPress?: () => void;
  /** card = its own bordered card (default); plain = inside a ListGroup / Card. */
  variant?: 'card' | 'plain';
  /** Max lines for the subtitle (default 2). */
  subtitleLines?: 1 | 2 | 3;
  disabled?: boolean;
  /** Accessible name when the title alone is not descriptive. */
  ariaLabel?: string;
  className?: string;
}

const CLAMP = { 1: 'line-clamp-1', 2: 'line-clamp-2', 3: 'line-clamp-3' } as const;

/**
 * Row with leading media, title/subtitle and trailing content. When pressable, the title is a
 * real <button> whose hit area is stretched over the whole row, so trailing controls (checkbox,
 * listen button) remain their own buttons — no nested interactive elements.
 */
export function ListRow({
  leading,
  title,
  subtitle,
  meta,
  trailing,
  chevron,
  onPress,
  variant = 'card',
  subtitleLines = 2,
  disabled = false,
  ariaLabel,
  className,
}: ListRowProps) {
  const pressable = !!onPress && !disabled;
  const showChevron = chevron ?? (pressable && trailing == null);
  const titleEl = <span className="block text-body leading-snug font-semibold text-ink">{title}</span>;
  return (
    <div
      className={cx(
        'relative flex min-h-16 items-center gap-3 px-4 py-3',
        variant === 'card' && 'rounded-list border border-line bg-surface',
        pressable && 'press cursor-pointer hover:bg-surface-2/60 active:bg-surface-2',
        pressable && variant === 'card' && 'hover:border-line-strong',
        disabled && 'opacity-50',
        className,
      )}
    >
      {leading != null && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        {pressable ? (
          <button
            type="button"
            onClick={onPress}
            aria-label={ariaLabel}
            className={cx(
              'block w-full text-left focus-visible:outline-none',
              // Stretch the hit area (and the focus ring) over the whole row.
              "after:absolute after:inset-0 after:rounded-[inherit] after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-[var(--focus)] focus-visible:after:outline-solid",
            )}
          >
            {titleEl}
          </button>
        ) : (
          titleEl
        )}
        {subtitle != null && <span className={cx('mt-0.5 text-small text-ink-2', CLAMP[subtitleLines])}>{subtitle}</span>}
        {meta != null && <span className="mt-1 block text-caption text-ink-3">{meta}</span>}
      </div>
      {trailing != null && <div className="relative z-[1] flex shrink-0 items-center gap-2 text-right">{trailing}</div>}
      {showChevron && <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-3" />}
    </div>
  );
}

export interface ListGroupProps {
  children: ReactNode;
  /** Accessible name for the list. */
  ariaLabel?: string;
  className?: string;
}

/** One card holding plain ListRows separated by hairlines. */
export function ListGroup({ children, ariaLabel, className }: ListGroupProps) {
  const items = Children.toArray(children).filter(c => c != null && c !== false);
  return (
    <div role="list" aria-label={ariaLabel} className={cx('overflow-hidden rounded-list border border-line bg-surface', className)}>
      {items.map((child, i) => (
        <div key={isValidElement(child) && child.key != null ? child.key : i} role="listitem" className={cx(i > 0 && 'border-t border-line')}>
          {child}
        </div>
      ))}
    </div>
  );
}
