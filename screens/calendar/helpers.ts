// Date, grouping and label helpers for the calendar (plus the small useToday hook).
import { useEffect, useState } from 'react';
import { CROP_NAMES, cropName, isCropKey } from '../../data/crop-keys';
import { daysBetween, formatDate, formatTime, parseISODate, relativeDay, toISODate, todayISO } from '../../lib/format';
import { localeFor } from '../../lib/i18n';
import type { Crop, FarmingTask, ISODate } from '../../types/models';

/** "YYYY-MM" */
export type YearMonth = string;

export const monthOf = (iso: ISODate): YearMonth => iso.slice(0, 7);

export function shiftMonth(ym: YearMonth, n: number): YearMonth {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const monthStart = (ym: YearMonth): ISODate => `${ym}-01`;

export function monthEnd(ym: YearMonth): ISODate {
  const [y, m] = ym.split('-').map(Number);
  return toISODate(new Date(y, m, 0));
}

/** "अक्टूबर" (+ year when it is not the current year: "जनवरी 2027"). */
export function monthLabel(ym: YearMonth, lang: string, today: ISODate): string {
  const [y, m] = ym.split('-').map(Number);
  const withYear = String(y) !== today.slice(0, 4);
  return new Intl.DateTimeFormat(localeFor(lang), { month: 'long', ...(withYear ? { year: 'numeric' } : {}) }).format(new Date(y, m - 1, 1));
}

/**
 * Months for the month strip: one before and three after the current month, widened to cover
 * the farmer's tasks (at most 6 months back and 12 ahead), always including `selected`.
 */
export function monthRange(tasks: FarmingTask[], today: ISODate, selected: YearMonth): YearMonth[] {
  const cur = monthOf(today);
  const floor = shiftMonth(cur, -6);
  const ceil = shiftMonth(cur, 12);
  let min = shiftMonth(cur, -1);
  let max = shiftMonth(cur, 3);
  for (const t of tasks) {
    const m = monthOf(t.dueDate);
    if (m < min && m >= floor) min = m;
    if (m > max && m <= ceil) max = m;
  }
  if (selected < min) min = selected;
  if (selected > max) max = selected;
  const out: YearMonth[] = [];
  for (let m = min; m <= max && out.length < 24; m = shiftMonth(m, 1)) out.push(m);
  return out;
}

export interface DayGroup {
  date: ISODate;
  tasks: FarmingTask[];
}

/** Groups tasks (already sorted by due date) into consecutive date buckets. */
export function groupByDate(tasks: FarmingTask[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const t of tasks) {
    const last = groups[groups.length - 1];
    if (last && last.date === t.dueDate) last.tasks.push(t);
    else groups.push({ date: t.dueDate, tasks: [t] });
  }
  return groups;
}

/** Local date a task was completed on (falls back to its due date). */
export const doneDate = (t: FarmingTask): ISODate => (t.doneAt ? toISODate(new Date(t.doneAt)) : t.dueDate);

/** Whole days a task is late (0 when not overdue). */
export const daysLate = (t: FarmingTask, today: ISODate): number => (t.done ? 0 : Math.max(0, daysBetween(t.dueDate, today)));

/** Crop name in the UI language: a catalog name the farmer never changed follows the language. */
export function cropLabel(crop: Crop, lang: string): string {
  if (lang === 'en' && isCropKey(crop.cropKey) && (!crop.name || crop.name === CROP_NAMES[crop.cropKey].hi)) {
    return CROP_NAMES[crop.cropKey].en;
  }
  return crop.name || cropName(crop.cropKey, lang);
}

/** True while a task has a reminder that is still ahead (shown as "🔔 7:00 AM"). */
export const hasActiveReminder = (t: FarmingTask, now = Date.now()): boolean =>
  !t.done && !!t.reminderAt && new Date(t.reminderAt).getTime() > now;

/** "7:00 AM" when the reminder is on the due date, else "14 अक्टूबर, 6:00 PM". */
export function reminderLabel(reminderAt: string, dueDate: ISODate): string {
  const d = new Date(reminderAt);
  const day = toISODate(d);
  return day === dueDate ? formatTime(d) : `${relativeDay(day)}, ${formatTime(d)}`;
}

/** "आज, 7:00 AM" / "15 अक्टूबर, 6:00 PM" for confirmations. */
export function whenLabel(at: Date): string {
  return `${relativeDay(toISODate(at))}, ${formatTime(at)}`;
}

/** Local Date for an ISO date plus "HH:MM". Invalid input gives null. */
export function atLocal(date: ISODate, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(time)) return null;
  const d = parseISODate(date);
  const [h, m] = time.split(':').map(Number);
  if (h > 23 || m > 59) return null;
  d.setHours(h, m, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "HH:MM" of a Date (for the time input). */
export const timeOf = (d: Date): string => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** "आज · सोम, 5 अक्टूबर" style heading for a date group. */
export function dayHeading(iso: ISODate, today: ISODate, todayWord: string, tomorrowWord: string): string {
  const diff = daysBetween(today, iso);
  const date = formatDate(iso, { weekday: true });
  if (diff === 0) return `${todayWord} · ${date}`;
  if (diff === 1) return `${tomorrowWord} · ${date}`;
  return date;
}

/** Today's ISO date, refreshed when the app comes back to the foreground on a new day. */
export function useToday(): ISODate {
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    const refresh = () => setToday(prev => {
      const next = todayISO();
      return next === prev ? prev : next;
    });
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      window.clearInterval(timer);
    };
  }, []);
  return today;
}

