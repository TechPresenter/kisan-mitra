// Pure helpers for the Hisab module: category metadata, period windows and totals.
import {
  Coins,
  Droplets,
  Ellipsis,
  FlaskConical,
  Fuel,
  SprayCan,
  Sprout,
  Store,
  Tractor,
  Users,
  Wheat,
} from 'lucide-react';
import type { Tone } from '../../components/ui';
import { cropName, isCropKey } from '../../data/crop-keys';
import { SEASON_NAMES, catalogText, isValidISODate, seasonFromSowingDate, type Season } from '../../data/crops';
import { areaInAcres } from '../../data/units';
import { addDays } from '../../lib/format';
import { localeFor } from '../../lib/i18n';
import type { Crop, ExpenseCategory, FarmExpense, FarmIncome, ID, IncomeCategory, ISODate } from '../../types/models';

export type EntryKind = 'expense' | 'income';

export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  'seed',
  'fertilizer',
  'pesticide',
  'labour',
  'irrigation',
  'machine',
  'diesel',
  'other',
];

export const INCOME_CATEGORIES: readonly IncomeCategory[] = ['crop-sale', 'mandi-sale', 'other'];

type Meta = { icon: typeof Sprout; tone: Tone };

export const EXPENSE_META: Record<ExpenseCategory, Meta> = {
  seed: { icon: Sprout, tone: 'green' },
  fertilizer: { icon: FlaskConical, tone: 'amber' },
  pesticide: { icon: SprayCan, tone: 'red' },
  labour: { icon: Users, tone: 'orange' },
  irrigation: { icon: Droplets, tone: 'sky' },
  machine: { icon: Tractor, tone: 'indigo' },
  diesel: { icon: Fuel, tone: 'teal' },
  other: { icon: Ellipsis, tone: 'gray' },
};

export const INCOME_META: Record<IncomeCategory, Meta> = {
  'crop-sale': { icon: Wheat, tone: 'green' },
  'mandi-sale': { icon: Store, tone: 'teal' },
  other: { icon: Coins, tone: 'amber' },
};

export const isExpenseCategory = (c: unknown): c is ExpenseCategory =>
  typeof c === 'string' && (EXPENSE_CATEGORIES as readonly string[]).includes(c);
export const isIncomeCategory = (c: unknown): c is IncomeCategory =>
  typeof c === 'string' && (INCOME_CATEGORIES as readonly string[]).includes(c);

/** i18n key of a category label. */
export const categoryKey = (kind: EntryKind, category: string) =>
  kind === 'expense' ? `hisab.cat.${category}` : `hisab.inc.${category}`;

export function metaFor(kind: EntryKind, category: string): Meta {
  if (kind === 'expense') return EXPENSE_META[isExpenseCategory(category) ? category : 'other'];
  return INCOME_META[isIncomeCategory(category) ? category : 'other'];
}

// ---------- Periods ----------
//
// A farm season is not a set of calendar months: kharif money is spent from June but the crop
// is sold in October–November, rabi seed is bought in October and wheat is sold in April–May.
// So a season's account is worked out like this:
// - An entry linked to a crop counts in that crop's season (crop.season, else the season implied
//   by its sowing date), whatever the entry date.
// - Other entries count by date, in a generous window that covers sowing to sale. The windows
//   overlap (kharif Jun–Nov, rabi Nov–Apr, zaid Mar–Jun), so a November entry without a crop
//   shows in both kharif and rabi; linking a crop makes it exact.

export type PeriodKey = 'season' | 'prevSeason' | 'year' | 'all';

export interface SeasonRef {
  season: Season;
  /** Year the season starts in: rabi 2026 runs Nov 2026 – Apr 2027. */
  year: number;
}

export interface SeasonWindow extends SeasonRef {
  /** First day of the date window (inclusive). */
  start: ISODate;
  /** Day after the last day (exclusive). */
  endExcl: ISODate;
}

/** Date windows for entries without a crop: first month and length in months. */
const WINDOW: Record<Season, { month: number; months: number }> = {
  kharif: { month: 6, months: 6 }, // Jun–Nov: sowing to harvest and sale
  rabi: { month: 11, months: 6 }, // Nov–Apr
  zaid: { month: 3, months: 4 }, // Mar–Jun
};

const pad2 = (n: number) => String(n).padStart(2, '0');
const yearOf = (iso: ISODate) => Number(iso.slice(0, 4));
const monthOf = (iso: ISODate) => Number(iso.slice(5, 7));

export function windowOf(ref: SeasonRef): SeasonWindow {
  const w = WINDOW[ref.season];
  const end0 = w.month - 1 + w.months; // months after January of ref.year
  return {
    ...ref,
    start: `${ref.year}-${pad2(w.month)}-01`,
    endExcl: `${ref.year + Math.floor(end0 / 12)}-${pad2((end0 % 12) + 1)}-01`,
  };
}

/**
 * The season a farmer is keeping accounts for today. During an overlap the older season wins,
 * because its harvest is being sold: Jun–Nov kharif, Dec–Apr rabi, May zaid.
 */
export function currentSeasonRef(today: ISODate): SeasonRef {
  const y = yearOf(today);
  const m = monthOf(today);
  if (m <= 4) return { season: 'rabi', year: y - 1 };
  if (m === 5) return { season: 'zaid', year: y };
  if (m <= 11) return { season: 'kharif', year: y };
  return { season: 'rabi', year: y };
}

/** The main season before `ref` (zaid is skipped): kharif → last rabi, rabi → kharif. */
export function previousSeasonRef(ref: SeasonRef): SeasonRef {
  if (ref.season === 'rabi') return { season: 'kharif', year: ref.year };
  return { season: 'rabi', year: ref.year - 1 };
}

/** Season year of a sowing date (rabi sown Sep–Jan, zaid sown Dec–Apr). */
function seasonYearOfSowing(season: Season, date: ISODate): number {
  const y = yearOf(date);
  const m = monthOf(date);
  if (season === 'rabi') return m >= 7 ? y : y - 1;
  if (season === 'zaid') return m >= 10 ? y + 1 : y;
  return y;
}

/** Season year of an expense / income date for a crop whose sowing date is unknown. */
function seasonYearOfEntry(season: Season, date: ISODate): number {
  const y = yearOf(date);
  const m = monthOf(date);
  if (season === 'rabi') return m >= 7 ? y : y - 1;
  if (season === 'zaid') return m >= 10 ? y + 1 : y;
  // A kharif crop sold in Jan–Mar belongs to last year's kharif.
  return m <= 3 ? y - 1 : y;
}

type CropSeason = { season: Season; year: number | null };

/** The season of a crop record: its own season, else the one implied by its sowing date. */
function cropSeasonOf(crop: Crop): CropSeason | null {
  const sown = crop.sowingDate && isValidISODate(crop.sowingDate) ? crop.sowingDate : undefined;
  const season = crop.season ?? (sown ? seasonFromSowingDate(crop.cropKey, sown) : undefined);
  if (!season) return null;
  return { season, year: sown ? seasonYearOfSowing(season, sown) : null };
}

/** Name of a season with its year: "खरीफ़ 2026", "रबी 2026-27". */
export function seasonLabel(ref: SeasonRef, lang: string): string {
  const name = catalogText(lang, SEASON_NAMES[ref.season].hi, SEASON_NAMES[ref.season].en);
  return ref.season === 'rabi' ? `${name} ${ref.year}-${pad2((ref.year + 1) % 100)}` : `${name} ${ref.year}`;
}

export const lastDayOf = (w: SeasonWindow): ISODate => addDays(w.endExcl, -1);

export interface PeriodInfo {
  current: SeasonWindow;
  previous: SeasonWindow;
}

export function periodInfo(today: ISODate): PeriodInfo {
  const current = currentSeasonRef(today);
  return { current: windowOf(current), previous: windowOf(previousSeasonRef(current)) };
}

type Dated = { date: ISODate; cropId?: ID };

/**
 * A filter for one period. Crop-linked entries follow their crop's season; the rest go by date
 * (see the note above). 'year' is the calendar year.
 */
export function periodFilter(period: PeriodKey, today: ISODate, crops: Iterable<Crop>): (e: Dated) => boolean {
  if (period === 'all') return () => true;
  if (period === 'year') {
    const y = today.slice(0, 4);
    return e => e.date.slice(0, 4) === y;
  }
  const info = periodInfo(today);
  const win = period === 'season' ? info.current : info.previous;
  const seasons = new Map<ID, CropSeason | null>();
  for (const c of crops) seasons.set(c.id, cropSeasonOf(c));
  return e => {
    const cs = e.cropId ? seasons.get(e.cropId) : null;
    if (cs) return cs.season === win.season && (cs.year ?? seasonYearOfEntry(cs.season, e.date)) === win.year;
    return e.date >= win.start && e.date < win.endExcl;
  };
}

/**
 * The period to open Hisab with: this season when it has entries, else the previous season,
 * else everything, so the first view is never an empty season while data exists.
 */
export function defaultPeriod(today: ISODate, crops: Crop[], entries: Dated[]): PeriodKey {
  if (entries.some(periodFilter('season', today, crops))) return 'season';
  if (entries.some(periodFilter('prevSeason', today, crops))) return 'prevSeason';
  return entries.length ? 'all' : 'season';
}

// ---------- Entries ----------

export type Entry =
  | { kind: 'expense'; item: FarmExpense }
  | { kind: 'income'; item: FarmIncome };

/** Newest first: by date, then by creation time. */
export function sortEntries(list: Entry[]): Entry[] {
  return list.sort((a, b) =>
    a.item.date === b.item.date
      ? (b.item.createdAt || '').localeCompare(a.item.createdAt || '')
      : b.item.date.localeCompare(a.item.date),
  );
}

export const validAmount = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

export const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + (validAmount(x.amount) ? x.amount : 0), 0);

export function byCategory(expenses: FarmExpense[]): Record<ExpenseCategory, number> {
  const out = Object.fromEntries(EXPENSE_CATEGORIES.map(c => [c, 0])) as Record<ExpenseCategory, number>;
  for (const e of expenses) {
    if (!validAmount(e.amount)) continue;
    out[isExpenseCategory(e.category) ? e.category : 'other'] += e.amount;
  }
  return out;
}

const monthKey = (iso: ISODate) => iso.slice(0, 7);

function prevMonth(key: string): string {
  let y = Number(key.slice(0, 4));
  let m = Number(key.slice(5, 7)) - 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export interface MonthTotal {
  /** "2026-10" */
  key: string;
  year: number;
  month: number;
  income: number;
  expense: number;
}

/**
 * Income and expense per month, oldest first, for up to `max` months (months without entries
 * included as zero). The range ends at `endMonth` ("2026-10", e.g. the current month) or, when
 * not given, at the latest month with entries. Empty when there are no entries.
 */
export function monthlyTotals(
  expenses: FarmExpense[],
  incomes: FarmIncome[],
  opts: { endMonth?: string; max?: number } = {},
): MonthTotal[] {
  const max = opts.max ?? 6;
  const map = new Map<string, { income: number; expense: number }>();
  const add = (date: ISODate, field: 'income' | 'expense', amount: number) => {
    if (!validAmount(amount) || !date) return;
    const k = monthKey(date);
    const cur = map.get(k) ?? { income: 0, expense: 0 };
    cur[field] += amount;
    map.set(k, cur);
  };
  expenses.forEach(e => add(e.date, 'expense', e.amount));
  incomes.forEach(i => add(i.date, 'income', i.amount));
  if (!map.size) return [];
  const keys = [...map.keys()].sort();
  const first = keys[0];
  const latest = keys[keys.length - 1];
  let k = opts.endMonth && opts.endMonth > latest ? opts.endMonth : latest;
  const out: MonthTotal[] = [];
  while (out.length < max && k >= first) {
    const v = map.get(k) ?? { income: 0, expense: 0 };
    out.unshift({ key: k, year: Number(k.slice(0, 4)), month: Number(k.slice(5, 7)), ...v });
    k = prevMonth(k);
  }
  return out;
}

const monthFormats = new Map<string, Intl.DateTimeFormat>();
/** Month name in the UI language from a "2026-10" key ('short': "अक्टू॰", 'long': "अक्टूबर 2026"). */
export function monthName(key: string, lang: string, style: 'short' | 'long'): string {
  const id = `${lang}|${style}`;
  let f = monthFormats.get(id);
  if (!f) {
    f = new Intl.DateTimeFormat(localeFor(lang), style === 'short' ? { month: 'short' } : { month: 'long', year: 'numeric' });
    monthFormats.set(id, f);
  }
  return f.format(new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 15));
}

// ---------- Crops ----------

/** Display name of a crop record in the UI language. */
export function cropLabel(crop: Pick<Crop, 'name' | 'cropKey'>, lang: string): string {
  if (lang === 'en' && isCropKey(crop.cropKey)) return cropName(crop.cropKey, 'en');
  return crop.name || cropName(crop.cropKey, lang);
}

/** Land in acres for a crop record, or null when the area is missing. */
export function cropAcres(crop: Pick<Crop, 'area' | 'unit'> | undefined, bighaSqm: number): number | null {
  if (!crop || !(typeof crop.area === 'number' && crop.area > 0)) return null;
  const unit = crop.unit === 'bigha' || crop.unit === 'hectare' ? crop.unit : 'acre';
  const acres = areaInAcres(crop.area, unit, bighaSqm);
  return Number.isFinite(acres) && acres > 0 ? acres : null;
}

/**
 * Acres behind a per-acre figure. One crop: that crop's area. All crops: the areas of the crops
 * the entries belong to; when no entry names a crop, the farmer's reported land (if any).
 */
export function acresFor(
  cropFilter: 'all' | ID,
  cropsById: Map<ID, Crop>,
  entryCropIds: Iterable<ID | undefined>,
  bighaSqm: number,
  profileLand?: { area?: number; unit?: 'acre' | 'bigha' | 'hectare' },
): number | null {
  if (cropFilter !== 'all') return cropAcres(cropsById.get(cropFilter), bighaSqm);
  const ids = new Set<ID>();
  let unassigned = false;
  for (const id of entryCropIds) {
    if (id && cropsById.has(id)) ids.add(id);
    else unassigned = true;
  }
  if (ids.size && !unassigned) {
    let total = 0;
    for (const id of ids) {
      const a = cropAcres(cropsById.get(id), bighaSqm);
      if (a == null) return null;
      total += a;
    }
    return total > 0 ? total : null;
  }
  if (profileLand?.area && profileLand.area > 0) {
    return cropAcres({ area: profileLand.area, unit: profileLand.unit ?? 'acre' }, bighaSqm);
  }
  return null;
}
