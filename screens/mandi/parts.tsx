// Building blocks shared by the Mandi list and the crop price detail screen: the watchlist hook,
// the price row, the "AI बाज़ार संकेत" card, source / portal link rows and the watchlist editor.
import './strings';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ExternalLink, Globe, Landmark } from 'lucide-react';
import {
  Button,
  Callout,
  ListGroup,
  ListRow,
  ListenButton,
  SectionHeader,
  Sheet,
  Skeleton,
  SkeletonText,
  ToneIcon,
  TrendBadge,
  type IconLike,
  type Tone,
} from '../../components/ui';
import { CropArt } from '../../components/illustrations';
import { CropPicker } from '../../components/shared/CropPicker';
import { useProfile } from '../../lib/app-state';
import { formatDate, formatINR, parseISODate } from '../../lib/format';
import { localeFor, useLanguage, useT, type TFunction } from '../../lib/i18n';
import { KEYS, useCollection, usePersisted } from '../../lib/store';
import { cropName, isCropKey } from '../../data/crop-keys';
import {
  defaultCommodities,
  getMarketSignal,
  mandiPlaceKey,
  usePriceHistory,
  type MandiHistoryPointExt,
  type MandiPriceExt,
  type MandiSnapshotExt,
} from '../../services/mandi';
import type { Crop, GeoPlace, GroundingSource } from '../../types/models';

// ---------- Watchlist ----------

/** services/mandi searches at most 12 commodities per call; the list stays within that. */
export const WATCHLIST_MAX = 12;

/** Stored watchlist → crop keys. Accepts string[] or { commodityKey }[]; null when nothing usable is stored. */
function normalizeWatchlist(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const item of raw) {
    const key =
      typeof item === 'string'
        ? item
        : item && typeof item === 'object' && typeof (item as { commodityKey?: unknown }).commodityKey === 'string'
          ? (item as { commodityKey: string }).commodityKey
          : '';
    if (isCropKey(key) && !out.includes(key)) out.push(key);
  }
  return out.slice(0, WATCHLIST_MAX);
}

/** 'last': the crop is the only one left in the list, so it was not removed. */
export type WatchToggleResult = 'added' | 'removed' | 'full' | 'last';

export interface MandiWatchlist {
  /** Crop keys in display order. Defaults to defaultCommodities(own crops) until the farmer edits it. */
  keys: string[];
  /** The farmer's own crops (onboarding choices, then crop records), valid crop keys only. */
  own: string[];
  set: (keys: string[]) => void;
  has: (key: string) => boolean;
  toggle: (key: string) => WatchToggleResult;
}

const NO_KEYS: string[] = [];

/**
 * The Mandi watchlist (KEYS.mandiWatchlist, stored as string[] of crop keys). While nothing (or an
 * empty list) is stored, it is defaultCommodities(own crops): the farmer's crops first, then common
 * staples, built the same way as Home's price list.
 *
 * The default is never written to the store: services/mandi reads the same key for price-move
 * alerts, so a stored default would alert on staples the farmer never chose. Reading with a `null`
 * fallback also means an empty snapshot cached by the service (`[]`) still shows the defaults here.
 */
export function useMandiWatchlist(): MandiWatchlist {
  const [profile] = useProfile();
  const crops = useCollection<Crop>(KEYS.crops).items;
  const ownSig = useMemo(() => {
    const keys: string[] = [];
    for (const k of [...(profile?.cropKeys ?? []), ...crops.map(c => c.cropKey)]) {
      if (isCropKey(k) && !keys.includes(k)) keys.push(k);
    }
    return keys.join(',');
  }, [profile?.cropKeys, crops]);
  // Keyed on the joined list, so editing a crop record's area does not rebuild the defaults.
  const own = useMemo(() => (ownSig ? ownSig.split(',') : NO_KEYS), [ownSig]);
  const fallback = useMemo(() => defaultCommodities(own), [own]);

  const [raw, setRaw] = usePersisted<unknown>(KEYS.mandiWatchlist, null);
  const stored = useMemo(() => normalizeWatchlist(raw), [raw]);
  const keys = stored && stored.length ? stored : fallback;

  const set = useCallback((next: string[]) => setRaw(normalizeWatchlist(next) ?? []), [setRaw]);
  const has = useCallback((key: string) => keys.includes(key), [keys]);
  const toggle = useCallback(
    (key: string): WatchToggleResult => {
      if (keys.includes(key)) {
        // An empty list would silently fall back to the defaults; keep at least one crop.
        if (keys.length <= 1) return 'last';
        set(keys.filter(k => k !== key));
        return 'removed';
      }
      if (keys.length >= WATCHLIST_MAX) return 'full';
      set([...keys, key]);
      return 'added';
    },
    [keys, set],
  );
  return { keys, own, set, has, toggle };
}

// ---------- Formatting ----------

/** Crop name in the UI language, keeping a meaningful variety from the source ("मिर्च (Green)"). */
export function priceName(p: { commodityKey: string; commodity?: string }, lang: string): string {
  const base = cropName(p.commodityKey, lang);
  const variety = /\(([^()]+)\)\s*$/.exec(p.commodity || '');
  return variety ? `${base} (${variety[1]})` : base;
}

/** "आज का भाव" for today's price, otherwise "भाव की तारीख: 3 अक्टूबर". */
export function priceDateLabel(t: TFunction, p: Pick<MandiPriceExt, 'ageDays' | 'priceDate'>): string {
  return p.ageDays > 0 ? t('mandi.priceDate', { date: formatDate(p.priceDate) }) : t('mandi.price.today');
}

/** "3 अक्टू" — short date for chart labels (observations can skip days, so weekdays would mislead). */
export function shortDate(iso: string, lang: string): string {
  return new Intl.DateTimeFormat(localeFor(lang), { day: 'numeric', month: 'short' }).format(parseISODate(iso));
}

/** Comparable mandi name: "Varanasi (Pahariya) Mandi" ≈ "varanasi pahariya". */
export function marketNorm(name: string): string {
  return name
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .replace(/(^|\s)(krishi upaj mandi|mandi samiti|mandi|apmc|market|yard|कृषि उपज मंडी|मंडी समिति|मंडी)(?=\s|$)/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Same mandi, allowing one name to be the other plus a sub-yard ("Varanasi" ≈ "Varanasi Pahariya"). */
export function sameMarket(a: string, b: string): boolean {
  const x = marketNorm(a);
  const y = marketNorm(b);
  // A name that is only a generic word ("APMC", "Market Yard") can still match itself.
  if (!x || !y) return a.trim().toLowerCase() === b.trim().toLowerCase();
  return x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `);
}

// ---------- Price row ----------

export interface PriceRowProps {
  price: MandiPriceExt;
  lang: string;
  onOpen: (commodityKey: string) => void;
}

/** Mandi list row: crop art, name, "₹2,480 / क्विंटल" in green, min–max, mandi + date, trend. */
export const PriceRow = memo(function PriceRow({ price: p, lang, onOpen }: PriceRowProps) {
  const t = useT();
  const name = priceName(p, lang);
  const hasRange = p.minPrice !== undefined && p.maxPrice !== undefined;
  return (
    <ListRow
      leading={<CropArt crop={p.commodityKey} size={56} />}
      title={name}
      // The date is part of the name, so an old price is never heard as today's.
      ariaLabel={t('mandi.row.a11y', { crop: name, price: formatINR(p.price), date: priceDateLabel(t, p) })}
      subtitle={
        <>
          <span className="text-body font-bold text-brand tabular-nums">{t('mandi.price.perQuintal', { price: formatINR(p.price) })}</span>
          {hasRange && (
            <span className="ml-2 text-caption whitespace-nowrap text-ink-2 tabular-nums">
              {t('mandi.price.range', { min: formatINR(p.minPrice as number), max: formatINR(p.maxPrice as number) })}
            </span>
          )}
        </>
      }
      meta={
        // ink-2 instead of ListRow's lighter meta colour: the date is what tells an old price apart.
        <span className="text-ink-2">
          <span>{p.market}</span>
          <span aria-hidden> · </span>
          {/* Prices two or more days old are tinted so they are never read as today's. */}
          <span className={p.ageDays >= 2 ? 'font-medium text-tone-amber' : undefined}>{priceDateLabel(t, p)}</span>
        </span>
      }
      // No previous price → no arrow at all (never a fake "0%").
      trailing={p.changePct !== undefined ? <TrendBadge value={p.changePct} /> : undefined}
      onPress={() => onOpen(p.commodityKey)}
    />
  );
});

// ---------- AI बाज़ार संकेत ----------

interface SignalState {
  sig: string | null;
  key: string | null;
  text?: string;
}

/**
 * Runs getMarketSignal once per distinct input (place cell, crop, language, latest price, own history).
 * While a new signal loads for the same crop, the previous text stays visible.
 */
function useMarketSignal(
  place: GeoPlace,
  commodityKey: string | null,
  snapshot: MandiSnapshotExt | undefined,
  history: MandiHistoryPointExt[],
  enabled: boolean,
  lang: string,
): { text?: string; loading: boolean } {
  const price = commodityKey && snapshot ? snapshot.prices.find(p => p.commodityKey === commodityKey) : undefined;
  const last = history[history.length - 1];
  const sig =
    enabled && commodityKey
      ? [
          mandiPlaceKey(place),
          commodityKey,
          lang,
          price?.price ?? '',
          price?.priceDate ?? '',
          price?.changePct ?? '',
          history.length,
          last?.date ?? '',
          last?.price ?? '',
        ].join('|')
      : null;
  const args = useRef({ place, commodityKey, snapshot, history });
  args.current = { place, commodityKey, snapshot, history };
  const [state, setState] = useState<SignalState>({ sig: null, key: null });

  useEffect(() => {
    if (!sig) return;
    let alive = true;
    const a = args.current;
    if (!a.commodityKey) return;
    const key = a.commodityKey;
    getMarketSignal(a.place, key, a.snapshot, a.history).then(
      (text: string) => {
        if (alive) setState({ sig, key, text: text && text.trim() ? text.trim() : undefined });
      },
      () => {
        if (alive) setState({ sig, key, text: undefined });
      },
    );
    return () => {
      alive = false;
    };
  }, [sig]);

  const done = state.sig === sig;
  const text = done || state.key === commodityKey ? state.text : undefined;
  return { text, loading: !!sig && !done };
}

export interface MarketSignalCardProps {
  place: GeoPlace;
  commodityKey: string | null;
  snapshot: MandiSnapshotExt | undefined;
  /** 'loading' while the prices load (skeleton), 'error' hides the card. */
  status: 'loading' | 'ready' | 'error';
  /** Button(s) under the text. */
  action?: ReactNode;
}

/** Lavender "AI बाज़ार संकेत" card. The caller places the price disclaimer next to it. */
export function MarketSignalCard({ place, commodityKey, snapshot, status, action }: MarketSignalCardProps) {
  const t = useT();
  const { language } = useLanguage();
  const history = usePriceHistory(place, commodityKey || '', 7);
  const { text, loading } = useMarketSignal(place, commodityKey, snapshot, history, status === 'ready', language.code);

  if (!commodityKey || status === 'error') return null;
  if (status === 'loading' || (loading && !text)) {
    return (
      <div role="status" aria-busy="true" className="flex items-start gap-3 rounded-list border border-tech/15 bg-tech-tint p-4">
        <span className="sr-only">{t('mandi.ai.loading')}</span>
        <Skeleton rounded="full" className="size-10 shrink-0" />
        <div className="min-w-0 flex-1 pt-1">
          <Skeleton rounded="sm" className="mb-3 h-4 w-2/5" />
          <SkeletonText lines={2} />
        </div>
      </div>
    );
  }
  if (!text) return null;
  return (
    <Callout
      tone="tech"
      title={t('mandi.ai.titleFor', { title: t('mandi.signal.title'), crop: cropName(commodityKey, language.code) })}
      aside={<ListenButton id={`mandi-signal-${commodityKey}`} text={text} variant="icon" />}
      action={action}
    >
      <p className="text-body text-ink">{text}</p>
    </Callout>
  );
}

// ---------- Links ----------

export interface ExternalLinkRowProps {
  href: string;
  title: string;
  subtitle?: string;
  icon: IconLike;
  tone?: Tone;
}

/** A row that opens a web page in the system browser (sources, official portals). */
export function ExternalLinkRow({ href, title, subtitle, icon, tone = 'sky' }: ExternalLinkRowProps) {
  const t = useT();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="press flex min-h-16 items-center gap-3 px-4 py-3 text-left hover:bg-surface-2/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--focus)] focus-visible:outline-solid active:bg-surface-2"
    >
      <ToneIcon icon={icon} tone={tone} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-body leading-snug font-semibold text-ink">{title}</span>
        {subtitle && <span className="mt-0.5 block truncate text-caption leading-snug text-ink-2">{subtitle}</span>}
      </span>
      <ExternalLink aria-hidden className="size-5 shrink-0 text-ink-3" />
      <span className="sr-only">{t('mandi.opensBrowser')}</span>
    </a>
  );
}

/** Gemini grounding links go through this redirect host; their title names the real site. */
const REDIRECT_HOST = /(^|\.)vertexaisearch\.cloud\.google\.com$/;

function httpHost(uri: string): string | null {
  try {
    const u = new URL(uri);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.hostname.toLowerCase().replace(/^www\./, '') : null;
  } catch {
    return null;
  }
}

/** Only real web links, de-duplicated, labelled with the page title and the site. */
function linkableSources(sources: readonly GroundingSource[]): { uri: string; title: string; site?: string }[] {
  const out: { uri: string; title: string; site?: string }[] = [];
  for (const s of sources) {
    const host = httpHost(s.uri);
    if (host === null || out.some(o => o.uri === s.uri)) continue;
    const redirect = REDIRECT_HOST.test(host);
    const title = (s.title || '').trim() || (redirect ? '' : host);
    if (!title) continue;
    const site = !redirect && host !== title.toLowerCase() ? host : undefined;
    out.push({ uri: s.uri, title, site });
  }
  return out;
}

export interface SourcesCardProps {
  sources: readonly GroundingSource[];
  title?: string;
}

/** "भाव कहाँ से लिए गए": the pages the prices were read from. */
export function SourcesCard({ sources, title }: SourcesCardProps) {
  const t = useT();
  const links = useMemo(() => linkableSources(sources).slice(0, 6), [sources]);
  if (!links.length) return null;
  const heading = title ?? t('mandi.sources.title');
  return (
    <section aria-label={heading}>
      <SectionHeader title={heading} subtitle={t('mandi.sources.note')} className="mb-3" />
      <ListGroup ariaLabel={heading}>
        {links.map(s => (
          <ExternalLinkRow key={s.uri} href={s.uri} title={s.title} subtitle={s.site} icon={Globe} tone="sky" />
        ))}
      </ListGroup>
    </section>
  );
}

/** Links to the official price portals (e-NAM, AGMARKNET). */
export function PortalsCard() {
  const t = useT();
  const heading = t('mandi.portals.title');
  return (
    <section aria-label={heading}>
      <SectionHeader title={heading} subtitle={t('mandi.portals.subtitle')} className="mb-3" />
      <ListGroup ariaLabel={heading}>
        <ExternalLinkRow
          href="https://enam.gov.in/"
          title={t('mandi.portals.enam')}
          subtitle={`enam.gov.in · ${t('mandi.portals.enamDesc')}`}
          icon={Landmark}
          tone="green"
        />
        <ExternalLinkRow
          href="https://agmarknet.gov.in/"
          title={t('mandi.portals.agmarknet')}
          subtitle={`agmarknet.gov.in · ${t('mandi.portals.agmarknetDesc')}`}
          icon={Landmark}
          tone="indigo"
        />
      </ListGroup>
    </section>
  );
}

// ---------- Watchlist editor ----------

export interface WatchlistSheetProps {
  open: boolean;
  onClose: () => void;
  value: string[];
  onSave: (keys: string[]) => void;
}

/** "+ फसल": pick the crops whose prices the Mandi tab shows. */
export function WatchlistSheet({ open, onClose, value, onSave }: WatchlistSheetProps) {
  const t = useT();
  const [draft, setDraft] = useState<string[]>(value);

  useEffect(() => {
    if (open) setDraft(value);
    // Reset only when the sheet opens; later list changes must not wipe the farmer's picks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const tooMany = draft.length > WATCHLIST_MAX;
  const none = draft.length === 0;
  const error = tooMany ? t('mandi.watch.max', { n: WATCHLIST_MAX }) : none ? t('mandi.watch.min') : undefined;

  const save = () => {
    if (tooMany || none) return;
    // Keep the existing order and add new picks at the end.
    onSave([...value.filter(k => draft.includes(k)), ...draft.filter(k => !value.includes(k))]);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="tall"
      title={t('mandi.watch.sheetTitle')}
      description={t('mandi.watch.sheetDesc')}
      footer={
        <Button fullWidth size="lg" disabled={tooMany || none} onClick={save}>
          {t('common.save')}
        </Button>
      }
    >
      <CropPicker
        multiple
        searchable
        columns={3}
        label={t('mandi.watch.pickerLabel')}
        hint={error ? undefined : t('mandi.watch.count', { n: draft.length })}
        error={error}
        value={draft}
        onChange={setDraft}
      />
    </Sheet>
  );
}
