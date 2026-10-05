import { useState, type ReactNode } from 'react';
import { ImageOff } from 'lucide-react';
import { localeFor, useLanguage, useT } from '../../lib/i18n';
import { parseISODate } from '../../lib/format';
import { cx } from './cx';
import { DUOTONE, renderIcon, type IconLike } from './icon';
import { TINT_BG, TONE_TEXT, type Tone } from './tones';
import './strings';

export interface ToneIconProps {
  icon: IconLike;
  tone?: Tone;
  /** sm 36px, md 44px (row icons), lg 56px (quick-action tile), xl 72px (empty states). */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'rounded';
  /** Faint fill behind the stroke for the two-tone look (default true). */
  duotone?: boolean;
  className?: string;
}

const BOX = { sm: 'size-9', md: 'size-11', lg: 'size-14', xl: 'size-18' } as const;
const GLYPH = { sm: 'size-5', md: 'size-6', lg: 'size-7', xl: 'size-9' } as const;

/** Tinted icon container: the coloured round icon in rows, the 56px tile in quick actions. */
export function ToneIcon({ icon, tone = 'green', size = 'md', shape = 'circle', duotone = true, className }: ToneIconProps) {
  return (
    <span
      aria-hidden
      className={cx(
        'inline-flex shrink-0 items-center justify-center',
        BOX[size],
        shape === 'circle' ? 'rounded-full' : size === 'sm' ? 'rounded-xl' : 'rounded-tile',
        TINT_BG[tone],
        TONE_TEXT[tone],
        className,
      )}
    >
      {renderIcon(icon, { className: GLYPH[size], strokeWidth: 2, ...(duotone ? DUOTONE : {}) })}
    </span>
  );
}

export interface ThumbnailProps {
  src?: string | null;
  alt?: string;
  /** sm 44px, md 56px (list rows), lg 72px, xl 96px. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Shown when there is no image or it fails to load (e.g. a crop illustration). */
  fallback?: ReactNode;
  className?: string;
}

const THUMB = { sm: 'size-11', md: 'size-14', lg: 'size-18', xl: 'size-24' } as const;

/** Rounded (12px) square image, e.g. the crop photo at the start of a mandi row. */
export function Thumbnail({ src, alt = '', size = 'md', fallback, className }: ThumbnailProps) {
  const [failed, setFailed] = useState(false);
  const showImg = !!src && !failed;
  return (
    <span className={cx('relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-2', THUMB[size], className)}>
      {showImg ? (
        <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className="size-full object-cover" />
      ) : (
        fallback ?? <ImageOff aria-hidden className="size-1/2 text-ink-3" />
      )}
    </span>
  );
}

export interface DateTileProps {
  /** YYYY-MM-DD */
  date: string;
  tone?: Tone;
  className?: string;
}

/** Calendar task date: big coloured day number with the month below ("15 / अक्टूबर"). */
export function DateTile({ date, tone = 'orange', className }: DateTileProps) {
  const { language } = useLanguage();
  const d = parseISODate(date);
  const locale = localeFor(language.code);
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(d);
  const month = new Intl.DateTimeFormat(locale, { month: 'short' }).format(d);
  const full = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  return (
    <span
      className={cx('inline-flex w-14 shrink-0 flex-col items-center justify-center rounded-xl py-1.5', TINT_BG[tone], className)}
      aria-label={full}
      role="img"
    >
      <span aria-hidden className={cx('text-[1.5rem] leading-none font-bold', TONE_TEXT[tone])}>
        {day}
      </span>
      <span aria-hidden className="mt-0.5 max-w-full truncate px-1 text-caption leading-snug text-ink-2">
        {month}
      </span>
    </span>
  );
}

export interface PaginationDotsProps {
  count: number;
  index: number;
  /** Makes the dots buttons (onboarding). */
  onSelect?: (index: number) => void;
  className?: string;
}

/** Onboarding page dots; the active one stretches into a short green pill. */
export function PaginationDots({ count, index, onSelect, className }: PaginationDotsProps) {
  const t = useT();
  return (
    <div className={cx('flex items-center justify-center', onSelect ? 'gap-0' : 'gap-2', className)}>
      {Array.from({ length: count }, (_, i) => {
        const dot = (
          <span
            aria-hidden
            className={cx(
              'block h-2 rounded-full transition-all duration-200',
              i === index ? 'w-6 bg-brand-700' : 'w-2 bg-control',
            )}
          />
        );
        if (!onSelect) return <span key={i}>{dot}</span>;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            aria-label={t('ui.page', { n: i + 1, total: count })}
            aria-current={i === index ? 'step' : undefined}
            className="inline-flex size-11 items-center justify-center rounded-full"
          >
            {dot}
          </button>
        );
      })}
      {!onSelect && <span className="sr-only">{t('ui.page', { n: index + 1, total: count })}</span>}
    </div>
  );
}
