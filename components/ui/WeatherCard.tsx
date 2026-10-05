import type { ReactNode } from 'react';
import { cx } from './cx';
import { renderIcon, type IconLike } from './icon';
import { WeatherGlyph, weatherKind } from './WeatherGlyph';

export interface WeatherChipProps {
  icon?: IconLike;
  children: ReactNode;
  className?: string;
}

/**
 * Small fact chip on the blue weather card or hero ("48% नमी", "12 km/h", "AQI 58").
 * A black wash, not white/20: white text stays ≥ 6:1 on every bg-weather stop.
 */
export function WeatherChip({ icon, children, className }: WeatherChipProps) {
  return (
    <span
      className={cx(
        'inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full bg-black/20 px-3 text-caption font-medium text-white',
        className,
      )}
    >
      {renderIcon(icon, { className: 'size-4 shrink-0', strokeWidth: 2.25 })}
      <span className="min-w-0 truncate pt-0.5 leading-snug">{children}</span>
    </span>
  );
}

export interface WeatherCardProps {
  /** Small heading ("आज का मौसम"). */
  title?: ReactNode;
  /** Pre-formatted temperature ("32°C"). */
  temperature: ReactNode;
  /** Condition line ("धूप खिली है (Sunny)"). */
  condition?: ReactNode;
  /** WMO code: draws the weather glyph at the top-right. */
  code?: number;
  isDay?: boolean;
  /** Replaces the glyph (e.g. an illustrated sun). Decorative. */
  art?: ReactNode;
  /** A row of WeatherChip. */
  chips?: ReactNode;
  /** Extra white content at the bottom (inline content only when the card is pressable). */
  footer?: ReactNode;
  /** Makes the whole card a button (e.g. open the Weather screen). */
  onPress?: () => void;
  /** Accessible name when pressable; defaults to the card's text. */
  ariaLabel?: string;
  className?: string;
}

/**
 * Home's sky-blue weather card: heading, huge temperature, condition, glyph at the top-right and
 * a chip row. White text only ever sits on bg-weather, which is tuned for AA in both themes.
 */
export function WeatherCard({
  title,
  temperature,
  condition,
  code,
  isDay = true,
  art,
  chips,
  footer,
  onPress,
  ariaLabel,
  className,
}: WeatherCardProps) {
  const kind = code != null ? weatherKind(code) : null;
  // Sun-led glyphs get the warm yellow; clouds, rain and night stay white on the blue.
  const sunny = isDay && (kind === 'clear' || kind === 'partly');
  const visual =
    art ??
    (code != null ? (
      <WeatherGlyph code={code} isDay={isDay} colored={false} className={cx('size-28', sunny ? 'text-[#ffd54f]' : 'text-white/90')} />
    ) : null);
  const hasVisual = visual != null;

  const content = (
    <>
      {hasVisual && (
        <span aria-hidden className="pointer-events-none absolute -top-2 -right-2">
          {visual}
        </span>
      )}
      {/* Text keeps clear of the glyph so white never lands on yellow. */}
      <span className={cx('relative block', hasVisual && 'pr-24')}>
        {title != null && <span className="block text-small font-medium">{title}</span>}
        <span className="mt-1 block text-hero font-bold">{temperature}</span>
        {condition != null && <span className="mt-1 block text-body leading-snug">{condition}</span>}
      </span>
      {chips != null && <span className="relative mt-4 flex flex-wrap gap-2">{chips}</span>}
      {footer != null && <span className="relative mt-3 block text-small">{footer}</span>}
    </>
  );

  const cls = cx('relative block w-full overflow-hidden rounded-card bg-weather p-5 text-left text-white', className);
  if (!onPress) return <div className={cls}>{content}</div>;
  return (
    <button type="button" onClick={onPress} aria-label={ariaLabel} className={cx('press', cls)}>
      {content}
    </button>
  );
}
