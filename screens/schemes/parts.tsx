// Small building blocks shared by the two scheme screens (and usable by Home / Search /
// Saved to show a scheme the same way): category icon + tone, amount highlighting, the
// source-age helpers and the list row from reference screen 15.
import { memo, type ReactNode } from 'react';
import { BadgePercent, Clock, Droplets, HandCoins, Landmark, ShieldCheck, Sprout, Tractor, type LucideIcon } from 'lucide-react';
import { ListRow, ToneIcon, type Tone } from '../../components/ui';
import { SCHEMES_LAST_VERIFIED, getSchemeCategory, type SchemeIconName } from '../../data/schemes';
import { daysBetween, formatDate, todayISO } from '../../lib/format';
import { useT } from '../../lib/i18n';
import type { GovernmentScheme, SchemeCategory } from '../../types/models';
import './strings';

const ICONS: Record<SchemeIconName, LucideIcon> = {
  HandCoins,
  ShieldCheck,
  Landmark,
  BadgePercent,
  Tractor,
  Sprout,
  Droplets,
};

/** Lucide icon and tint for a scheme category (the coloured round icon in rows). */
export function schemeCategoryVisual(category: SchemeCategory): { icon: LucideIcon; tone: Tone } {
  const def = getSchemeCategory(category);
  return { icon: ICONS[def.icon] ?? HandCoins, tone: def.tone };
}

/** Category label key for t(): `schemes.cat.<id>`. */
export const schemeCategoryKey = (category: SchemeCategory) => `schemes.cat.${category}`;

/** Entries whose newest official document is older than this are flagged as old everywhere. */
export const OLD_SOURCE_DAYS = 90;

/**
 * True when the scheme's figures come from an official document older than OLD_SOURCE_DAYS.
 * `lastVerified` is the newest official document's date (or the catalog review date when a
 * 2026 source confirmed the entry), so old entries must never look current.
 */
export const isSchemeOld = (s: Pick<GovernmentScheme, 'lastVerified'>, today: string = todayISO()): boolean =>
  daysBetween(s.lastVerified, today) > OLD_SOURCE_DAYS;

/** True when the entry was re-confirmed against a 2026 source in the catalog review. */
export const isSchemeReviewed = (s: Pick<GovernmentScheme, 'lastVerified'>): boolean => s.lastVerified === SCHEMES_LAST_VERIFIED;

// Rupee amounts ("₹6,000", "₹3 लाख", "₹10,000") and percentages ("2%", "1.5%", "40–50%").
// One capture group, so String.split keeps the matches at the odd indices. "करोड़" and
// "हज़ार" are matched with the nukta both precomposed and as a combining mark.
const AMOUNT_RE =
  /(₹\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:लाख|करो(?:ड़|ड़)|हज(?:़)?ार|हज़ार))?|\d+(?:\.\d+)?(?:\s?[–-]\s?\d+(?:\.\d+)?)?\s?%)/;

/** Renders text with every ₹ amount and percentage in bold brand green. */
export function Amounts({ text, className, lang }: { text: string; className?: string; lang?: string }) {
  const parts = text.split(AMOUNT_RE);
  if (parts.length === 1)
    return (
      <span lang={lang} className={className}>
        {text}
      </span>
    );
  return (
    <span lang={lang} className={className}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-bold whitespace-nowrap text-brand">
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </span>
  );
}

/** Ends a line with "।" when it has no sentence mark, so read-aloud text pauses naturally. */
export function asSentence(s: string): string {
  const trimmed = s.trim();
  return /[.।?!:]$/.test(trimmed) ? trimmed : `${trimmed}।`;
}

export interface SchemeRowProps {
  scheme: GovernmentScheme;
  /** Called with the scheme id (stable callbacks keep the memoised rows from re-rendering). */
  onOpen: (id: string) => void;
  /** Replaces the default one-line benefit (benefitsHi[0], or the summary). */
  subtitle?: ReactNode;
  variant?: 'card' | 'plain';
}

/**
 * Reference screen 15 row: category icon, Hindi name, one-line benefit, chevron. Entries
 * based on an old official document get an amber "पुरानी जानकारी" line with its date, so
 * their figures are never shown as current.
 */
export const SchemeRow = memo(function SchemeRow({ scheme, onOpen, subtitle, variant = 'card' }: SchemeRowProps) {
  const t = useT();
  const { icon, tone } = schemeCategoryVisual(scheme.category);
  const line = scheme.benefitsHi[0] ?? scheme.summaryHi;
  const old = isSchemeOld(scheme);
  return (
    <ListRow
      variant={variant}
      leading={<ToneIcon icon={icon} tone={tone} />}
      title={<span lang="hi">{scheme.nameHi}</span>}
      subtitle={subtitle ?? <Amounts text={line} lang="hi" />}
      subtitleLines={1}
      meta={
        old ? (
          <span className="inline-flex items-start gap-1 font-medium text-tone-amber">
            <Clock aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.5} />
            <span>{t('schemes.row.oldSource', { date: formatDate(scheme.lastVerified, { year: true }) })}</span>
          </span>
        ) : undefined
      }
      onPress={() => onOpen(scheme.id)}
    />
  );
});
