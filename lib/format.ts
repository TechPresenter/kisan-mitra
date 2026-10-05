// Locale-aware formatting helpers (₹, dates, "last updated" labels). Digits stay Latin.
import { getSettings } from './app-state';
import { localeFor, translate } from './i18n';

const lang = () => getSettings().languageCode;

export function formatINR(amount: number, opts: { decimals?: number } = {}): string {
  const d = opts.decimals ?? 0;
  return '₹' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d }).format(amount);
}

export function formatNumber(n: number, maxDecimals = 2): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: maxDecimals }).format(n);
}

/** "+1.8%" / "−2.4%" */
export function formatPct(n: number, decimals = 1): string {
  const s = Math.abs(n).toFixed(decimals);
  return (n > 0 ? '+' : n < 0 ? '−' : '') + s + '%';
}

/** Local calendar date as YYYY-MM-DD. */
export function toISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const todayISO = () => toISODate(new Date());

/** Parse YYYY-MM-DD as a local date (not UTC). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Whole days from a to b (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);
}

/** "15 नवंबर" (+ year when not the current year). */
export function formatDate(iso: string, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const d = parseISODate(iso);
  const showYear = opts.year ?? d.getFullYear() !== new Date().getFullYear();
  return new Intl.DateTimeFormat(localeFor(lang()), {
    day: 'numeric',
    month: 'long',
    ...(showYear ? { year: 'numeric' } : {}),
    ...(opts.weekday ? { weekday: 'short' } : {}),
  }).format(d);
}

/** Short weekday, e.g. "सोम". */
export function formatWeekday(iso: string): string {
  return new Intl.DateTimeFormat(localeFor(lang()), { weekday: 'short' }).format(parseISODate(iso));
}

/** "10:30 AM" (kept in AM/PM form, which farmers read most easily). */
export function formatTime(t: number | string | Date): string {
  const d = new Date(t);
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
    .format(d)
    .toUpperCase();
}

/** "आज" / "कल" / "बीता कल" / "15 नवंबर" for a date relative to today. */
export function relativeDay(iso: string): string {
  const diff = daysBetween(todayISO(), iso);
  const l = lang();
  if (diff === 0) return translate(l, 'common.today');
  if (diff === 1) return translate(l, 'common.tomorrow');
  if (diff === -1) return translate(l, 'common.yesterday');
  return formatDate(iso);
}

/** "आज 10:30 AM" — used for every "Last updated" label. */
export function formatUpdated(t: number | string): string {
  const d = new Date(t);
  return `${relativeDay(toISODate(d))} ${formatTime(d)}`;
}

/** "5 मिनट पहले" style label for short gaps, falling back to formatUpdated. */
export function timeAgo(t: number | string): string {
  const mins = Math.round((Date.now() - new Date(t).getTime()) / 60_000);
  const l = lang();
  if (mins < 1) return translate(l, 'common.justNow');
  if (mins < 60) return translate(l, 'common.minutesAgo', { n: mins });
  return formatUpdated(t);
}
