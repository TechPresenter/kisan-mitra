// Indicative mandi prices. There is no free, keyless official price API, so prices come from the AI
// layer with live web search (AGMARKNET / eNAM pages are the target sources), then pass strict
// validation: numbers only, per-commodity plausibility bounds, a recent date, a named mandi and a
// cited page from a site the search really returned. A reply without search sources is the model's
// memory, not a reported price, and is rejected. Every fetch also records one observation per
// commodity per day per place on-device, which is the only basis for our own trends.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  GeoPlace,
  GroundingSource,
  ISODate,
  MandiHistoryPoint,
  MandiPrice,
  MandiSnapshot,
  PriceTrend,
} from '../types/models';
import { HOUR, fetchWithCache, readCache, writeCache, type CachedResult, type Resource } from '../lib/cache';
import { KEYS, store, usePersisted } from '../lib/store';
import { getProfile, getSettings } from '../lib/app-state';
import { addDays, daysBetween, formatDate, formatINR, parseISODate, toISODate, todayISO } from '../lib/format';
import { tNow } from '../lib/i18n';
import { CROP_KEYS, CROP_NAMES, cropName, isCropKey, type CropKey } from '../data/crop-keys';
import { ai, AIError, toPlainText, v } from './ai';
import { findState } from './location';
import { pushNotification } from './notifications';
import './mandi-strings';

/** Mandis report once a day; 3 h keeps AI/search usage low while catching the day's update. */
export const MANDI_MAX_AGE_MS = 3 * HOUR;
const SIGNAL_MAX_AGE_MS = 24 * HOUR;
/** Vegetables move day to day: a rate older than this is not the "latest" price any more. */
const PERISHABLE_MAX_AGE_DAYS = 3;
/** Grains, pulses, oilseeds, cotton, cane and garlic store well and move more slowly. */
const STORABLE_MAX_AGE_DAYS = 7;
const PERISHABLES: ReadonlySet<CropKey> = new Set<CropKey>(['tomato', 'onion', 'potato', 'brinjal', 'cauliflower', 'okra', 'chilli']);
const HISTORY_DAYS = 60;
/** |Δ| below this is shown as stable ("→ 0%"). */
const STABLE_PCT = 0.5;
/** A watched crop moving at least this much vs. our previous observation triggers a notification. */
const NOTIFY_MOVE_PCT = 3;
/** A move in a price dated before yesterday is old news: no notification. */
const NOTIFY_MAX_PRICE_AGE_DAYS = 1;
/** A previous price (from the source or our history) must be at most this many days older. */
const PREVIOUS_MAX_GAP_DAYS = 7;
/** A day-to-day move larger than this is almost certainly a different grade/market or a misread. */
const MAX_PREVIOUS_DEVIATION = 0.5;
const MAX_COMMODITIES = 12;
const MAX_ROW_SOURCES = 3;
const FALLBACK_COMMODITIES: CropKey[] = ['wheat', 'paddy', 'tomato', 'potato', 'onion', 'mustard'];
/** Gemini grounding links go through this redirect host and name the real site in the title. */
const REDIRECT_HOSTS = new Set(['vertexaisearch.cloud.google.com']);

/** Oldest acceptable price date for a commodity, in days before today. */
export const maxPriceAgeDays = (key: CropKey): number =>
  PERISHABLES.has(key) ? PERISHABLE_MAX_AGE_DAYS : STORABLE_MAX_AGE_DAYS;

/**
 * Plausible modal price per commodity, ₹/quintal. Deliberately wide: they reject misread units
 * (₹/kg, ₹/tonne), typos and invented numbers, not genuine swings. MSPs quoted are Govt. of India
 * figures (Kharif 2025-26, Rabi marketing season 2026-27).
 */
export const PRICE_BOUNDS: Record<CropKey, readonly [min: number, max: number]> = {
  wheat: [1000, 6000], // MSP ₹2,585; mandi trade mostly ₹2,200–3,500
  paddy: [1000, 6500], // MSP common ₹2,369; basmati paddy can reach ~₹5,000
  maize: [800, 4500], // MSP ₹2,400
  bajra: [1000, 5000], // MSP ₹2,775
  jowar: [1000, 7000], // MSP hybrid ₹3,699
  barley: [1000, 4500], // MSP ₹2,150
  gram: [3000, 11000], // MSP ₹5,875
  arhar: [4000, 15000], // MSP ₹8,000; 2023-24 peaks near ₹12,000
  moong: [4000, 14000], // MSP ₹8,768
  urad: [4000, 14000], // MSP ₹7,800
  masoor: [3500, 12000], // MSP ₹7,000
  mustard: [3500, 10000], // MSP ₹6,200
  soybean: [2500, 9000], // MSP ₹5,328
  groundnut: [3000, 11000], // MSP ₹7,263 (pods)
  cotton: [4000, 12000], // kapas; MSP medium staple ₹7,710
  sugarcane: [250, 700], // FRP ₹355 (2025-26); state advised prices ~₹400
  potato: [200, 5000], // glut years ~₹400, shortage years ~₹3,000
  onion: [200, 9000], // 2019 and 2023 shortages pushed modal prices past ₹6,000
  tomato: [100, 15000], // gluts ~₹200; July 2023 spike above ₹10,000
  brinjal: [100, 8000],
  cauliflower: [100, 8000],
  chilli: [500, 35000], // green ~₹1,000–8,000; dry red (e.g. Guntur) up to ~₹30,000
  okra: [200, 9000],
  garlic: [1000, 40000], // 2024 shortage: above ₹30,000 at Mandsaur / Neemuch
};

export type MandiErrorCode = 'no-data' | 'unverified';

export class MandiError extends Error {
  constructor(public code: MandiErrorCode, message?: string) {
    super(message || code);
    this.name = 'MandiError';
  }
  get messageKey(): string {
    return `mandi.error.${this.code}`;
  }
}

// ---------- Types beyond the shared model ----------

/** A validated price row. Every row has a mandi, a reported date and the sources that show it. */
export interface MandiPriceExt extends MandiPrice {
  market: string;
  priceDate: ISODate;
  /** Whole days from priceDate to today (0 = today's price), worked out whenever a snapshot is built. */
  ageDays: number;
  previousDate?: ISODate;
  /** 'source': the cited page's previous report; 'history': our own earlier observation. */
  previousFrom?: 'source' | 'history';
  /** Search results from the site that carries this price. */
  sources: GroundingSource[];
}

export interface MandiSnapshotExt extends MandiSnapshot {
  prices: MandiPriceExt[];
}

/** History point tagged with the place cell it was observed for (see mandiPlaceKey). */
export interface MandiHistoryPointExt extends MandiHistoryPoint {
  placeKey: string;
  market: string;
}

type StoredPrice = Omit<MandiPriceExt, 'ageDays'>;

/** One cached answer per place and crop; `price: null` = searched, nothing usable found. */
interface CropEntry {
  price: StoredPrice | null;
}

// ---------- Helpers ----------

const round1 = (n: number) => Math.round(n * 10) / 10;
const lang = () => getSettings().languageCode;

/**
 * Place cell (~11 km) for the price cache and history: mandis serve a whole area, so GPS jitter or a
 * neighbouring village must not trigger a new search or split the history.
 */
export const mandiPlaceKey = (p: GeoPlace) => `${p.lat.toFixed(1)},${p.lon.toFixed(1)}`;

/** Cache name of one crop's price at a place. */
export const mandiCacheName = (place: GeoPlace, commodityKey: string) => cropCacheName(mandiPlaceKey(place), commodityKey);
const cropCacheName = (placeKey: string, commodityKey: string) => `mandi.crop:${placeKey}:${commodityKey}`;
const nearbyCacheName = (placeKey: string) => `mandi.nearby:${placeKey}`;

/** Valid, unique crop keys in the given order. */
function normalizeKeys(keys: readonly string[]): CropKey[] {
  const out: CropKey[] = [];
  for (const k of keys) if (isCropKey(k) && !out.includes(k)) out.push(k);
  return out.slice(0, MAX_COMMODITIES);
}

/** Up to 8 commodities for the Mandi/Home lists: the farmer's crops first, then common staples. */
export function defaultCommodities(profileCropKeys: readonly string[] = []): string[] {
  return normalizeKeys([...profileCropKeys, ...FALLBACK_COMMODITIES]).slice(0, 8);
}

/**
 * Strict number: a JSON number, or a string that is only a number ("2,450", "₹2450").
 * Ranges ("2400-2500") and prose are rejected rather than guessed.
 */
function strictNumber(x: unknown): number | undefined {
  if (typeof x === 'number') return Number.isFinite(x) ? x : undefined;
  if (typeof x !== 'string') return undefined;
  const s = x.replace(/₹|rs\.?|inr/gi, '').trim();
  if (!/^\d{1,3}(,\d{2,3})*(\.\d+)?$|^\d+(\.\d+)?$/.test(s)) return undefined;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

const inBounds = (key: CropKey, n: number | undefined): n is number =>
  n !== undefined && n >= PRICE_BOUNDS[key][0] && n <= PRICE_BOUNDS[key][1];

export function trendOf(changePct: number | undefined): PriceTrend {
  if (changePct === undefined || Math.abs(changePct) < STABLE_PCT) return 'stable';
  return changePct > 0 ? 'up' : 'down';
}

const pctChange = (from: number, to: number) => round1(((to - from) / from) * 100);

function cleanText(x: unknown, max: number): string | undefined {
  const s = v.str(x).replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : undefined;
}

/** "Varanasi, Varanasi" → "Varanasi" (AGMARKNET repeats the district when it matches the mandi). */
function cleanMarket(x: unknown): string | undefined {
  const parts = (cleanText(x, 80) || '').split(',').map(p => p.trim()).filter(Boolean);
  const unique = parts.filter((p, i) => parts.findIndex(q => q.toLowerCase() === p.toLowerCase()) === i);
  return unique.length ? unique.join(', ').slice(0, 60) : undefined;
}

/** Comparable form of a mandi name ("Varanasi (Pahariya)" ≈ "varanasi pahariya"). */
const marketKey = (m: string | undefined) =>
  (m || '').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();

/** AGMARKNET's catch-all grade labels say nothing to a farmer. */
const GENERIC_VARIETY = /^(other|others|faq|local|na|n\/a|-|average|mixed|general|unknown|optional)$/i;

/** A real calendar date in YYYY-MM-DD form ("2026-02-30" and "05-10-2026" are rejected). */
function realDate(x: unknown): ISODate | undefined {
  const s = v.str(x);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && toISODate(parseISODate(s)) === s ? s : undefined;
}

function httpUrl(x: unknown): string | undefined {
  try {
    const u = new URL(v.str(x));
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}

/** Host without "www.", from a URL or from a bare domain such as a Gemini grounding title. */
function hostOf(s: string): string {
  try {
    return new URL(s).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    const t = s.trim().toLowerCase();
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(t) ? t.replace(/^www\./, '') : '';
  }
}

const sameSite = (a: string, b: string) => a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);

/** The search results from the same site as a row's cited page (empty = the row is unsupported). */
function sourcesFor(url: string, sources: GroundingSource[]): GroundingSource[] {
  const host = hostOf(url);
  if (!host) return [];
  return sources.filter(s =>
    [hostOf(s.uri), hostOf(s.title)].some(h => h && !REDIRECT_HOSTS.has(h) && sameSite(h, host)),
  );
}

// ---------- Commodity names ----------

/** Market names for catalog crops (AGMARKNET / eNAM spellings and common Hindi words). */
const NAME_ALIASES: Partial<Record<CropKey, readonly string[]>> = {
  wheat: ['gehun', 'गेहूँ'],
  paddy: ['dhan'],
  maize: ['makka', 'corn', 'मक्की'],
  bajra: ['pearl millet', 'cumbu'],
  jowar: ['cholam'],
  barley: ['jau'],
  gram: ['bengal gram', 'chana', 'kabuli chana'],
  arhar: ['tur', 'toor', 'red gram', 'तुअर', 'तूर'],
  moong: ['mung', 'moong', 'मूँग'],
  urad: ['urd', 'उरद'],
  masoor: ['masur'],
  mustard: ['rapeseed', 'sarson', 'सरसो'],
  soybean: ['soyabean', 'soya bean'],
  groundnut: ['ground nut', 'groundnuts', 'peanut', 'मूँगफली'],
  cotton: ['kapas'],
  potato: ['potatoes', 'aloo'],
  onion: ['onions', 'pyaz', 'प्याज़'],
  tomato: ['tomatoes', 'tamatar'],
  brinjal: ['baingan', 'eggplant'],
  cauliflower: ['phool gobhi', 'phool gobi', 'फूल गोभी'],
  chilli: ['chillies', 'chili', 'chilies', 'mirchi'],
  okra: ['bhindi', 'ladies finger', 'lady finger'],
  garlic: ['lahsun'],
};

/**
 * Commodities that share a word with a catalog crop but are something else (milled rice is not
 * paddy, sweet potato is not potato, cottonseed is not kapas, cabbage is not cauliflower).
 */
const OTHER_COMMODITY_NAMES = ['rice', 'चावल', 'sweet potato', 'शकरकंद', 'cotton seed', 'cottonseed', 'binola', 'बिनौला', 'cabbage', 'पत्ता गोभी', 'band gobhi'];
/** Processed products (dal, flour, oil) trade at different prices from the raw crop. */
const PROCESSED = /(^|[^\p{L}\p{M}])(dal|daal|दाल|atta|आटा|flour|oil|तेल)($|[^\p{L}\p{M}])/u;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every known name of every catalog crop, longest first, so "green gram" (moong) wins over "gram". */
const NAME_PATTERNS: { key: CropKey | 'other'; re: RegExp; length: number }[] = [
  ...CROP_KEYS.flatMap(key =>
    [key, CROP_NAMES[key].en, CROP_NAMES[key].hi, ...(NAME_ALIASES[key] || [])].map(name => ({ key, name })),
  ),
  ...OTHER_COMMODITY_NAMES.map(name => ({ key: 'other' as const, name })),
]
  .map(({ key, name }) => {
    const n = name.normalize('NFC').toLowerCase();
    // Unicode-aware word edges: a Devanagari letter or vowel sign continues the word ("मूंग" ≠ "मूंगफली").
    return { key, re: new RegExp(`(^|[^\\p{L}\\p{M}])${escapeRe(n)}($|[^\\p{L}\\p{M}])`, 'u'), length: n.length };
  })
  .sort((a, b) => b.length - a.length);

/** Catalog crop named in free text ('other' for look-alike commodities, undefined if none). */
function nameMatch(x: unknown): CropKey | 'other' | undefined {
  const text = v.str(x).normalize('NFC').toLowerCase();
  if (!text) return undefined;
  if (PROCESSED.test(text)) return 'other';
  return NAME_PATTERNS.find(p => p.re.test(text))?.key;
}

/**
 * The requested crop a reply row is about. `key` must be one of the requested keys exactly and must
 * not contradict the row's commodity name; without a key, the name must name a requested crop.
 */
function matchKey(r: Record<string, unknown>, requested: CropKey[]): CropKey | undefined {
  const byName = nameMatch(r.commodity ?? r.name);
  const rawKey = v.str(r.key).toLowerCase();
  if (rawKey) {
    if (!(requested as string[]).includes(rawKey)) return undefined;
    return byName && byName !== rawKey ? undefined : (rawKey as CropKey);
  }
  return byName && byName !== 'other' && requested.includes(byName) ? byName : undefined;
}

// ---------- Local price history ----------

const readHistory = () => store.get<MandiHistoryPointExt[]>(KEYS.mandiHistory, []);
const EMPTY_HISTORY: MandiHistoryPointExt[] = [];

/** Points from the most recently observed mandi only, oldest first: two mandis' prices are not a trend. */
function latestMarketSeries<T extends MandiHistoryPoint>(points: readonly T[]): T[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1];
  if (!last) return [];
  const market = marketKey(last.market);
  return sorted.filter(p => marketKey(p.market) === market);
}

function placeSeries(all: readonly MandiHistoryPointExt[], placeKey: string, commodityKey: string, days: number) {
  const from = addDays(todayISO(), -(days - 1));
  return latestMarketSeries(all.filter(p => p.placeKey === placeKey && p.commodityKey === commodityKey && p.date >= from));
}

/**
 * Our own observations of a commodity at `place` over the last `days` days, oldest first, from the
 * mandi observed most recently (points from other places or mandis are left out).
 */
export function getPriceHistory(place: GeoPlace, commodityKey: string, days = 7): MandiHistoryPointExt[] {
  return placeSeries(readHistory(), mandiPlaceKey(place), commodityKey, days);
}

/** Reactive version of getPriceHistory (re-renders when a fetch records new prices). */
export function usePriceHistory(place: GeoPlace | null | undefined, commodityKey: string, days = 7): MandiHistoryPointExt[] {
  const [all] = usePersisted<MandiHistoryPointExt[]>(KEYS.mandiHistory, EMPTY_HISTORY);
  const placeKey = place ? mandiPlaceKey(place) : null;
  const today = todayISO();
  return useMemo(
    () => (placeKey ? placeSeries(all, placeKey, commodityKey, days) : EMPTY_HISTORY),
    // `today` moves the 7-day window at midnight.
    [all, placeKey, commodityKey, days, today],
  );
}

/** Our latest observation of the same mandi at the same place, strictly before `date` (within a week). */
function previousPoint(placeKey: string, commodityKey: string, date: string, market: string): MandiHistoryPointExt | undefined {
  const mk = marketKey(market);
  if (!mk) return undefined;
  const from = addDays(date, -PREVIOUS_MAX_GAP_DAYS);
  return readHistory()
    .filter(
      p =>
        p.placeKey === placeKey &&
        p.commodityKey === commodityKey &&
        p.date < date &&
        p.date >= from &&
        marketKey(p.market) === mk,
    )
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}

/** One point per commodity, date and place (latest fetch wins); keeps the last 60 days. */
function recordHistory(points: MandiHistoryPointExt[]) {
  if (!points.length) return;
  const cutoff = addDays(todayISO(), -HISTORY_DAYS);
  const id = (p: MandiHistoryPointExt) => `${p.commodityKey}|${p.date}|${p.placeKey}`;
  store.set<MandiHistoryPointExt[]>(
    KEYS.mandiHistory,
    prev => {
      const fresh = new Set(points.map(id));
      // Points without a place come from an older build and cannot be attributed: they are dropped.
      const kept = prev.filter(p => p.placeKey && p.date >= cutoff && !fresh.has(id(p)));
      return [...kept, ...points].sort((a, b) => a.date.localeCompare(b.date));
    },
    [],
  );
}

export type HistoryStats =
  | { enough: false; count: number; /** i18n key: "not enough data" */ messageKey: string }
  | {
      enough: true;
      count: number;
      /** The mandi the figures are from. */
      market?: string;
      high: number;
      low: number;
      first: MandiHistoryPoint;
      last: MandiHistoryPoint;
      /** Change from the oldest to the newest observation in the window. */
      changePct7d: number;
      trend: PriceTrend;
      /** Calendar days between the first and last observation. */
      spanDays: number;
    };

/**
 * High / low / change computed only from real observations of one mandi (the latest one in
 * `points`); needs at least 2 points.
 */
export function historyStats(points: readonly MandiHistoryPoint[]): HistoryStats {
  const series = latestMarketSeries(points);
  if (series.length < 2) return { enough: false, count: series.length, messageKey: 'mandi.history.notEnough' };
  const prices = series.map(p => p.price);
  const first = series[0];
  const last = series[series.length - 1];
  const changePct7d = pctChange(first.price, last.price);
  return {
    enough: true,
    count: series.length,
    ...(last.market ? { market: last.market } : {}),
    high: Math.max(...prices),
    low: Math.min(...prices),
    first,
    last,
    changePct7d,
    trend: trendOf(changePct7d),
    spanDays: Math.max(1, daysBetween(first.date, last.date)),
  };
}

// ---------- Fetching ----------

interface RawRow {
  key: CropKey;
  market: string;
  modal: number;
  min?: number;
  max?: number;
  date: ISODate;
  /** The source's previous report at the same mandi, when it is dated and recent. */
  previous?: { price: number; date: ISODate };
  variety?: string;
  sourceUrl: string;
}

interface RawSnapshot {
  rows: RawRow[];
  nearbyMandis: string[];
}

/** Shape check for ai.generateJSON; row-level problems drop the row instead of failing the reply. */
function validateReply(value: any, requested: CropKey[], today: string): RawSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object');
  const list: unknown[] = Array.isArray(value.prices) ? value.prices : [];
  const rows: RawRow[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const key = matchKey(r, requested);
    if (!key || rows.some(x => x.key === key)) continue;
    const modal = strictNumber(r.modal ?? r.modalPrice ?? r.price);
    if (!inBounds(key, modal)) continue;
    // Undated, badly dated, future or too-old prices are dropped, never shown as today's.
    const date = realDate(r.date ?? r.priceDate);
    if (!date) continue;
    const age = daysBetween(date, today);
    if (age < 0 || age > maxPriceAgeDays(key)) continue;
    const market = cleanMarket(r.market ?? r.mandi);
    const sourceUrl = httpUrl(r.sourceUrl ?? r.source ?? r.url);
    if (!market || !sourceUrl) continue;

    let min = strictNumber(r.min ?? r.minPrice);
    let max = strictNumber(r.max ?? r.maxPrice);
    if (!inBounds(key, min) || !inBounds(key, max) || min > modal || max < modal) {
      min = undefined;
      max = undefined;
    }
    // The source's previous price counts only with its own date, shortly before this one.
    const prevPrice = strictNumber(r.previousModal ?? r.previousPrice);
    const prevDate = realDate(r.previousDate);
    const previous =
      inBounds(key, prevPrice) &&
      prevDate &&
      prevDate < date &&
      daysBetween(prevDate, date) <= PREVIOUS_MAX_GAP_DAYS &&
      Math.abs(prevPrice - modal) / modal <= MAX_PREVIOUS_DEVIATION
        ? { price: Math.round(prevPrice), date: prevDate }
        : undefined;
    const variety = cleanText(r.variety, 24);
    rows.push({
      key,
      market,
      modal: Math.round(modal),
      ...(min !== undefined && max !== undefined ? { min: Math.round(min), max: Math.round(max) } : {}),
      date,
      ...(previous ? { previous } : {}),
      ...(variety && !GENERIC_VARIETY.test(variety) ? { variety } : {}),
      sourceUrl,
    });
  }
  const nearbyMandis = v
    .strArr(value.nearbyMandis, 8)
    .map(m => m.replace(/\s+/g, ' ').slice(0, 60))
    .filter((m, i, all) => all.indexOf(m) === i)
    .slice(0, 5);
  return { rows, nearbyMandis };
}

const MANDI_SYSTEM = `You report Indian agricultural mandi (APMC) prices found with web search.
Rules:
- Search the web for every commodity before answering (for example "Agmarknet <commodity> price <district> mandi").
- Use only prices you actually find in sources: AGMARKNET (agmarknet.gov.in), eNAM (enam.gov.in), state agricultural marketing boards, and reputable news reports quoting them. Prefer the official portals.
- Prices are in rupees per quintal (100 kg). Convert ₹/kg ×100 and ₹/tonne ÷10.
- Never estimate, extrapolate, average across years or invent numbers, and never substitute the MSP or a procurement price for a mandi price. If you cannot find a recent price for a commodity, leave that commodity out.
- Each price must carry the date it refers to (YYYY-MM-DD), the mandi it is from and the URL of the page that shows it.`;

function mandiPrompt(place: GeoPlace, keys: CropKey[], today: string): string {
  // English names search better; the Hindi name is kept alongside for disambiguation.
  const name = [place.nameEn || place.name, place.nameEn && place.name !== place.nameEn ? `(${place.name})` : '']
    .filter(Boolean)
    .join(' ');
  const where = [
    name,
    place.district && place.district !== place.name ? `district ${place.district}` : '',
    findState(place.state)?.nameEn || place.state || '',
  ]
    .filter(Boolean)
    .join(', ');
  const list = keys
    .map(
      k =>
        `- ${k}: ${CROP_NAMES[k].en} (${CROP_NAMES[k].hi})${k === 'paddy' ? ', paddy (dhan), not milled rice' : ''}; price not older than ${maxPriceAgeDays(k)} days`,
    )
    .join('\n');
  const chilliNote = keys.includes('chilli')
    ? '\nFor chilli, give green chilli unless the nearby mandi mainly trades dry red chilli, and say which in "variety".'
    : '';
  return `Today is ${today}. Location: ${where}, India (lat ${place.lat.toFixed(2)}, lon ${place.lon.toFixed(2)}).
Find today's or the latest reported mandi prices for these commodities at APMC mandis in or nearest to this location — same district first, then neighbouring districts of the same state:
${list}${chilliNote}

JSON shape:
{
  "prices": [
    { "key": "wheat", "commodity": "commodity name as written on the page", "market": "mandi name, district", "modal": 2450, "min": 2400, "max": 2500, "date": "YYYY-MM-DD", "previousModal": 2430, "previousDate": "YYYY-MM-DD", "variety": "optional", "sourceUrl": "https://… the page that shows this price" }
  ],
  "nearbyMandis": ["3 to 5 APMC mandi names near the location"]
}
"key" must be one of: ${keys.join(', ')}. All prices are plain numbers in ₹/quintal (no symbols, commas or ranges). "date" is the date the price was reported. Include "previousModal" and "previousDate" only when the same page shows the previous reported price at the same mandi. Leave out any commodity whose price you did not find on a page.`;
}

/** Watched crops: the farmer's crops plus the Mandi watchlist (string keys or { commodityKey } items). */
function watchedKeys(): Set<string> {
  const keys = new Set<string>(getProfile()?.cropKeys || []);
  const list = store.get<unknown>(KEYS.mandiWatchlist, []);
  if (Array.isArray(list)) {
    for (const item of list) {
      if (typeof item === 'string') keys.add(item);
      else if (item && typeof item === 'object' && typeof (item as { commodityKey?: unknown }).commodityKey === 'string') {
        keys.add((item as { commodityKey: string }).commodityKey);
      }
    }
  }
  return keys;
}

/** Only a move against our own earlier observation of the same mandi, in a current price, notifies. */
function notifyMove(price: StoredPrice, today: string) {
  if (price.previousFrom !== 'history' || price.previousPrice === undefined || price.changePct === undefined) return;
  if (Math.abs(price.changePct) < NOTIFY_MOVE_PCT) return;
  if (daysBetween(price.priceDate, today) > NOTIFY_MAX_PRICE_AGE_DAYS) return;
  const crop = cropName(price.commodityKey, lang());
  pushNotification({
    category: 'mandi',
    priority: 'normal',
    title: tNow(price.changePct > 0 ? 'mandi.notif.up' : 'mandi.notif.down', {
      crop,
      pct: Math.abs(price.changePct).toFixed(1),
    }),
    body: tNow('mandi.notif.body', {
      market: price.market,
      date: formatDate(price.priceDate),
      price: formatINR(price.price),
      prev: formatINR(price.previousPrice),
      prevDate: price.previousDate ? formatDate(price.previousDate) : '',
    }),
    dedupeKey: `mandi:${price.commodityKey}:${price.priceDate}`,
    target: { screen: 'mandi', params: { commodityKey: price.commodityKey } },
  });
}

/** One AI + search call for `keys` at `place`; writes one cache entry per crop, history and notifications. */
async function refreshCrops(place: GeoPlace, keys: CropKey[]): Promise<void> {
  const today = todayISO();
  const pk = mandiPlaceKey(place);
  const { data, sources } = await ai.generateJSON<RawSnapshot>(
    { task: 'mandi-prices', grounding: true, system: MANDI_SYSTEM, prompt: mandiPrompt(place, keys, today) },
    value => validateReply(value, keys, today),
  );
  // No search results: the model answered from memory, and those numbers are not reported prices.
  if (!sources?.length) throw new MandiError('unverified');

  const watched = watchedKeys();
  const observed: MandiHistoryPointExt[] = [];
  const found = new Map<CropKey, StoredPrice>();
  for (const r of data.rows) {
    // The cited page must be on a site the search actually returned.
    const rowSources = sourcesFor(r.sourceUrl, sources);
    if (!rowSources.length) continue;
    const own = previousPoint(pk, r.key, r.date, r.market);
    const previous = r.previous
      ? { ...r.previous, from: 'source' as const }
      : own
        ? { price: own.price, date: own.date, from: 'history' as const }
        : undefined;
    const changePct = previous ? pctChange(previous.price, r.modal) : undefined;
    const price: StoredPrice = {
      commodityKey: r.key,
      commodity: r.variety ? `${CROP_NAMES[r.key].hi} (${r.variety})` : CROP_NAMES[r.key].hi,
      market: r.market,
      price: r.modal,
      ...(r.min !== undefined ? { minPrice: r.min, maxPrice: r.max } : {}),
      ...(previous ? { previousPrice: previous.price, previousDate: previous.date, previousFrom: previous.from } : {}),
      ...(changePct !== undefined ? { changePct } : {}),
      trend: trendOf(changePct),
      priceDate: r.date,
      sources: rowSources.slice(0, MAX_ROW_SOURCES),
    };
    found.set(r.key, price);
    observed.push({ commodityKey: r.key, date: r.date, price: r.modal, market: r.market, placeKey: pk });
    if (watched.has(r.key)) notifyMove(price, today);
  }
  recordHistory(observed);

  const fetchedAt = Date.now();
  for (const k of keys) writeCache<CropEntry>(cropCacheName(pk, k), { price: found.get(k) ?? null }, fetchedAt);
  if (data.nearbyMandis.length) writeCache<string[]>(nearbyCacheName(pk), data.nearbyMandis, fetchedAt);
}

/**
 * Snapshot of the cached prices for `keys` at `place`, in the given order. Ages are worked out for
 * today, and prices that have aged past their limit while cached are left out. `fetchedAt` is the
 * oldest entry used, so "last updated" never overstates freshness.
 */
function buildSnapshot(place: GeoPlace, keys: readonly CropKey[]): { snapshot: MandiSnapshotExt; fetchedAt: number } | undefined {
  const pk = mandiPlaceKey(place);
  const today = todayISO();
  const prices: MandiPriceExt[] = [];
  const sources: GroundingSource[] = [];
  let fetchedAt = Infinity;
  for (const k of keys) {
    const entry = readCache<CropEntry>(cropCacheName(pk, k));
    if (!entry) continue;
    fetchedAt = Math.min(fetchedAt, entry.fetchedAt);
    const p = entry.data?.price;
    if (!p) continue;
    const ageDays = daysBetween(p.priceDate, today);
    if (ageDays < 0 || ageDays > maxPriceAgeDays(k)) continue;
    prices.push({ ...p, ageDays });
    for (const s of p.sources) if (!sources.some(x => x.uri === s.uri)) sources.push(s);
  }
  if (!prices.length) return undefined;
  return {
    snapshot: {
      place,
      fetchedAt: new Date(fetchedAt).toISOString(),
      prices,
      nearbyMandis: readCache<string[]>(nearbyCacheName(pk))?.data ?? [],
      sources: sources.slice(0, 6),
      indicative: true,
    },
    fetchedAt,
  };
}

/** Running searches by crop cache name, so two screens never ask for the same crop at once. */
const inflight = new Map<string, Promise<void>>();

/**
 * Indicative prices for `commodityKeys` near `place`. Each crop is cached on its own for 3 h, so Home,
 * the Mandi tab and a crop screen show the same price; one AI + search call fetches only the crops
 * that are missing or stale. When that call fails, cached prices come back with `error` set. Throws
 * AIError, MandiError('unverified') or MandiError('no-data') when there is nothing to show.
 */
export async function getMandiSnapshot(
  place: GeoPlace,
  commodityKeys: readonly string[],
  opts: { force?: boolean } = {},
): Promise<CachedResult<MandiSnapshotExt>> {
  const keys = normalizeKeys(commodityKeys);
  if (!keys.length) throw new MandiError('no-data', 'No valid commodity keys');
  const pk = mandiPlaceKey(place);
  const startedAt = Date.now();
  for (;;) {
    const running = [...new Set(keys.map(k => inflight.get(cropCacheName(pk, k))).filter(p => p !== undefined))];
    if (!running.length) break;
    await Promise.allSettled(running);
  }

  const due = keys.filter(k => {
    const entry = readCache<CropEntry>(cropCacheName(pk, k));
    if (!entry) return true;
    // A forced refresh still accepts what a concurrent search wrote after this call began.
    return opts.force ? entry.fetchedAt <= startedAt : Date.now() - entry.fetchedAt >= MANDI_MAX_AGE_MS;
  });
  let error: Error | undefined;
  if (due.length) {
    const task = refreshCrops(place, due);
    for (const k of due) inflight.set(cropCacheName(pk, k), task);
    try {
      await task;
    } catch (e) {
      error = e instanceof Error ? e : new Error(String(e));
    } finally {
      for (const k of due) if (inflight.get(cropCacheName(pk, k)) === task) inflight.delete(cropCacheName(pk, k));
    }
  }

  const view = buildSnapshot(place, keys);
  if (!view) throw error ?? new MandiError('no-data');
  return { data: view.snapshot, fetchedAt: view.fetchedAt, fromCache: !due.length || !!error, ...(error ? { error } : {}) };
}

/**
 * React hook around getMandiSnapshot; idle when `place` is null or no valid keys are given. The
 * snapshot is rebuilt whenever any screen's search updates one of these crops, and at midnight.
 */
export function useMandi(place: GeoPlace | null | undefined, commodityKeys: readonly string[]): Resource<MandiSnapshotExt> {
  const keys = normalizeKeys(commodityKeys);
  const pk = place ? mandiPlaceKey(place) : null;
  const sig = pk && keys.length ? `${pk}|${keys.join(',')}` : null;
  const placeRef = useRef(place);
  placeRef.current = place;
  const keysRef = useRef(keys);
  keysRef.current = keys;
  const sigRef = useRef(sig);
  sigRef.current = sig;
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(!!sig);
  const [error, setError] = useState<Error>();
  const today = todayISO();

  useEffect(() => {
    if (!sig || !pk) return;
    const bump = () => setVersion(n => n + 1);
    const names = [...keysRef.current.map(k => cropCacheName(pk, k)), nearbyCacheName(pk)];
    const offs = names.map(n => store.subscribe(store.cacheKey(n), bump));
    return () => offs.forEach(off => off());
  }, [sig, pk]);

  const placeName = place?.name;
  const view = useMemo(
    () => (sig && placeRef.current ? buildSnapshot(placeRef.current, keysRef.current) : undefined),
    // `version`: a cache write for one of these crops; `today`: ages and age limits move at midnight;
    // `placeName`: another place in the same cell shares the prices but not the label.
    [sig, version, today, placeName],
  );

  const run = useCallback(async (force: boolean) => {
    const current = sigRef.current;
    const p = placeRef.current;
    if (!current || !p) return;
    setBusy(true);
    try {
      const result = await getMandiSnapshot(p, keysRef.current, { force });
      if (sigRef.current === current) setError(result.error);
    } catch (e) {
      if (sigRef.current === current) setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (sigRef.current === current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    setError(undefined);
    if (sig) run(false);
    else setBusy(false);
  }, [sig, run]);

  const refresh = useCallback(() => run(true), [run]);
  return {
    data: view?.snapshot,
    fetchedAt: view?.fetchedAt,
    loading: busy && !view,
    refreshing: busy && !!view,
    error,
    stale: !!view && Date.now() - view.fetchedAt > MANDI_MAX_AGE_MS,
    refresh,
  };
}

// ---------- AI market signal ----------

// The signal must describe what happened, never forecast. Replies that predict, or that quote a
// number the model was not given, are replaced. Compared in NFD so both encodings of nukta letters
// (ढ़ as one or two code points) match.
const PREDICTIVE = new RegExp(
  [
    // Hindi: rise/fall verbs in infinitive, "can", or "will" forms ("बढ़ने की संभावना", "गिर सकते", "बढ़ जाएगा").
    '(बढ़|घट|गिर|चढ़|उछल|उतर|टूट|सुधर)(ने|\\s*सकत|\\s*जा)',
    // Any future-tense verb ("बढ़ेगा", "मिलेगी", "रहेंगे", "आएगी", "होगा").
    '(े|ए)(ं|ँ)?(गा|गी|गे)',
    'हो(ं|ँ)?(गा|गी|गे)',
    'ऊपर\\s*जा',
    'नीचे\\s*जा',
    'संभावना',
    'सम्भावना',
    'उम्मीद',
    'आशंका',
    'तेज़?ी',
    'मंदी\\s*आ',
    'गारंटी',
    'निश्चित\\s*(रूप|तौर)',
    // English
    '\\b(will|shall|won\'t|gonna)\\b',
    '\\bgoing\\s+to\\b',
    '\\b(may|might|could|can|likely|unlikely|expected|poised|set|bound)\\b.{0,25}\\b(rise|fall|increase|decrease|go\\s+up|go\\s+down|climb|drop|surge|dip|rally|soar|decline|recover|firm\\s+up|ease|improve)',
    '\\b(forecast|predict|outlook|guarantee|definitely|surely|certainly)',
  ]
    .join('|')
    .normalize('NFD'),
  'i',
);

/** Numbers in text, with Devanagari digits and Indian comma grouping ("₹2,450", "२४५०") read as values. */
function numbersIn(text: string): number[] {
  const latin = text.replace(/[०-९]/g, d => String(d.charCodeAt(0) - 0x0966));
  return (latin.match(/\d[\d,]*(\.\d+)?/g) || [])
    .map(s => Number(s.replace(/,/g, '')))
    .filter(Number.isFinite);
}

/**
 * Whether an AI market signal may be shown: it must not predict or guarantee prices, and every number
 * in it must come from `input` (the prompt with our data; rounding is allowed).
 */
export function signalIsSafe(text: string, input: string): boolean {
  if (PREDICTIVE.test(text.normalize('NFD'))) return false;
  const allowed = new Set<number>();
  for (const n of numbersIn(input)) {
    allowed.add(n);
    allowed.add(Math.round(n));
  }
  return numbersIn(text).every(n => allowed.has(n) || allowed.has(Math.round(n)));
}

/** Deterministic, cautious signal from the same numbers (used when AI is unavailable or unsafe). */
function ruleSignal(commodityKey: string, price: MandiPrice | undefined, history: readonly MandiHistoryPoint[]): string {
  const crop = cropName(commodityKey, lang());
  const stats = historyStats(history);
  if (stats.enough) {
    const pct = Math.abs(stats.changePct7d).toFixed(1);
    return tNow(`mandi.signal.${stats.trend}`, { crop, pct, days: stats.spanDays });
  }
  if (price?.changePct !== undefined) {
    const key = price.trend === 'up' ? 'prevUp' : price.trend === 'down' ? 'prevDown' : 'prevStable';
    return tNow(`mandi.signal.${key}`, { crop, pct: Math.abs(price.changePct).toFixed(1) });
  }
  return tNow('mandi.signal.notEnough', { crop });
}

/** First two sentences, plain text, bounded length. */
function tidySignal(text: string): string {
  const plain = toPlainText(text).replace(/\s+/g, ' ').trim();
  const sentences = plain.match(/[^।.!?]+[।.!?]?/g) || [plain];
  return sentences.slice(0, 2).join(' ').replace(/\s+/g, ' ').trim().slice(0, 320);
}

const SIGNAL_SYSTEM = `You write the "AI बाजार संकेत" (market signal) card for one crop in a farmer app.
Rules:
- 1 or 2 short sentences in simple language. No markdown, no lists, no headings. Say "भाव" for price.
- Use ONLY the numbers given, and no other numbers. Describe what has happened; never predict, forecast or guarantee future prices, and do not say a price will rise or fall or is likely to.
- Be cautious: suggest checking the local mandi trend or nearby mandis before selling; mention storage only as "if you have storage".
- If the data is thin (one observation), say the trend is not clear yet.
Example: "पिछले 7 दिनों में गेहूं की कीमत बढ़ी है। यदि आपके पास storage की सुविधा है तो बेचने से पहले स्थानीय मंडी trend देखें।"`;

function signalPrompt(commodityKey: string, price: MandiPrice | undefined, history: readonly MandiHistoryPoint[]): string {
  const name = isCropKey(commodityKey) ? `${CROP_NAMES[commodityKey].hi} (${CROP_NAMES[commodityKey].en})` : commodityKey;
  const lines = [`Crop: ${name}`];
  if (price) {
    // Plain "price" wording: the model otherwise echoes "modal" as "मॉडल भाव", which farmers don't use.
    lines.push(
      `Latest mandi price: ₹${price.price}/quintal${price.market ? ` at ${price.market}` : ''}${price.priceDate ? ` on ${price.priceDate}` : ''}`,
    );
    if (price.minPrice !== undefined) lines.push(`Range that day: ₹${price.minPrice}–₹${price.maxPrice}/quintal`);
    if (price.previousPrice !== undefined && price.changePct !== undefined) {
      lines.push(`Previous reported price: ₹${price.previousPrice} (change ${price.changePct > 0 ? '+' : ''}${price.changePct}%)`);
    }
  }
  const stats = historyStats(history);
  if (history.length) {
    const at = history[history.length - 1].market;
    lines.push(
      `Prices observed in the app over the last 7 days${at ? ` at ${at}` : ''}: ${history.map(p => `${p.date}: ₹${p.price}`).join('; ')}`,
    );
  }
  if (stats.enough) {
    lines.push(
      `Over ${stats.spanDays} days: high ₹${stats.high}, low ₹${stats.low}, change ${stats.changePct7d > 0 ? '+' : ''}${stats.changePct7d}%`,
    );
  } else {
    lines.push('Not enough daily observations for a 7-day trend.');
  }
  return `${lines.join('\n')}\n\nWrite the market signal.`;
}

/** Short stable hash, so a cached signal is reused only for exactly the same numbers. */
function hashText(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * "AI बाजार संकेत": 1–2 cautious sentences based only on our numbers for `place`. `history` defaults
 * to getPriceHistory(place, commodityKey); points from another place are ignored, as is a snapshot for
 * another place. Cached per commodity, day, language, place and input. Never throws: without AI, or
 * when the reply predicts prices or quotes numbers it was not given, it returns a rule-based sentence.
 */
export async function getMarketSignal(
  place: GeoPlace,
  commodityKey: string,
  snapshot?: MandiSnapshot,
  history?: readonly MandiHistoryPoint[],
): Promise<string> {
  const pk = mandiPlaceKey(place);
  const series = latestMarketSeries(
    (history ?? getPriceHistory(place, commodityKey)).filter(
      p => p.commodityKey === commodityKey && (p as Partial<MandiHistoryPointExt>).placeKey === pk,
    ),
  );
  const price =
    snapshot && mandiPlaceKey(snapshot.place) === pk ? snapshot.prices.find(p => p.commodityKey === commodityKey) : undefined;
  if (!price && series.length < 2) return ruleSignal(commodityKey, price, series);
  const input = signalPrompt(commodityKey, price, series);
  const name = `mandi.signal:${commodityKey}:${todayISO()}:${lang()}:${pk}:${hashText(input)}`;
  try {
    const { data } = await fetchWithCache(
      name,
      async () => {
        const result = await ai.generate({ task: 'market', system: SIGNAL_SYSTEM, prompt: input });
        const text = tidySignal(result.text);
        return text && signalIsSafe(text, input) ? text : ruleSignal(commodityKey, price, series);
      },
      { maxAgeMs: SIGNAL_MAX_AGE_MS },
    );
    return data;
  } catch (e) {
    if (!(e instanceof AIError)) console.warn('[mandi] market signal failed', e);
    return ruleSignal(commodityKey, price, series);
  }
}

/** All 24 catalog keys (handy for a "add crop to mandi list" picker). */
export const MANDI_COMMODITIES: readonly CropKey[] = CROP_KEYS;
