// Pure helpers for the Weather screens: wall-clock labels at the forecast's place, what the hero
// may honestly show as "now", per-day spray windows (same rules and scoring as services/weather
// sprayAdvice), rule-based farm tips, UV bands and the spoken summaries. No React here, so
// everything is cheap to memoize and easy to test.
import type { DailyForecast, HourlyForecast, SprayAdvice, WeatherAlert, WeatherSnapshot } from '../../types/models';
import { HOUR, MINUTE } from '../../lib/cache';
import { addDays, daysBetween, formatDate, formatWeekday, parseISODate } from '../../lib/format';
import type { TFunction } from '../../lib/i18n';
import {
  SPRAY_MAX_RAIN_MM,
  SPRAY_MAX_RAIN_PROB_PCT,
  SPRAY_MAX_TEMP_C,
  SPRAY_RAIN_FREE_HOURS,
  SPRAY_WIND_IDEAL_MAX_KMH,
  SPRAY_WIND_IDEAL_MIN_KMH,
  SPRAY_WIND_MAX_KMH,
  formatHourWindow,
  isWetCode,
  placeToday,
  weatherCodeInfo,
  type DailyForecastExt,
} from '../../services/weather';

// ---------- Wall-clock labels ----------
// Forecast times carry the place's UTC offset ("2026-10-05T16:00:00+05:30"), so the local hour
// is read from the string itself, never from the device clock's time zone.

export const localHourOf = (iso: string) => Number(iso.slice(11, 13));
export const localDateOf = (iso: string) => iso.slice(0, 10);

const amPm = (h: number) => (h < 12 ? 'AM' : 'PM');
const h12 = (h: number) => h % 12 || 12;

/** "4 PM" for an hourly forecast time (AM/PM, as lib/format uses everywhere). */
export function hourLabel(iso: string): string {
  const h = localHourOf(iso);
  return `${h12(h)} ${amPm(h)}`;
}

/** "6:02 AM" for a sunrise/sunset time, read at the place. */
export function clockLabel(iso?: string): string | undefined {
  if (!iso || iso.length < 16) return undefined;
  const h = localHourOf(iso);
  if (!Number.isFinite(h)) return undefined;
  return `${h12(h)}:${iso.slice(14, 16)} ${amPm(h)}`;
}

/** "आज" / "कल" / "बुध, 8 अक्टूबर", relative to today at the forecast's place. */
export function dayLabel(date: string, today: string, t: TFunction): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return t('common.today');
  if (diff === 1) return t('common.tomorrow');
  return formatDate(date, { weekday: true });
}

/** Compact chip label: "आज", "कल", "बुध 8". */
export function shortDayLabel(date: string, today: string, t: TFunction): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return t('common.today');
  if (diff === 1) return t('common.tomorrow');
  return `${formatWeekday(date)} ${parseISODate(date).getDate()}`;
}

/** Whether the middle of this forecast hour is in daylight (for sun vs moon glyphs). */
export function isDaylightHour(iso: string, daily: DailyForecast[]): boolean {
  const day = daily.find(d => d.date === localDateOf(iso));
  const mid = Date.parse(iso) + 30 * MINUTE;
  const rise = day?.sunrise ? Date.parse(day.sunrise) : NaN;
  const set = day?.sunset ? Date.parse(day.sunset) : NaN;
  if (Number.isFinite(rise) && Number.isFinite(set)) return mid >= rise && mid < set;
  const h = localHourOf(iso);
  return h >= 6 && h < 18;
}

/** The place's UTC offset (ms) read from a stored forecast time ("…T16:00:00+05:30"). */
function placeOffsetMs(w: Pick<WeatherSnapshot, 'daily' | 'hourly'>): number | undefined {
  const sample = w.hourly[0]?.time ?? w.daily.find(d => d.sunrise)?.sunrise;
  if (!sample) return undefined;
  if (sample.endsWith('Z')) return 0;
  const m = sample.match(/([+-])(\d{2}):(\d{2})$/);
  if (!m) return undefined;
  const ms = (Number(m[2]) * 60 + Number(m[3])) * MINUTE;
  return m[1] === '-' ? -ms : ms;
}

/**
 * Wall-clock hour (0–23) at the forecast's place for `now`. Works from the stored offset, so it
 * is right even when the cached hourly forecast has already run out.
 */
export function placeHourNow(w: Pick<WeatherSnapshot, 'daily' | 'hourly'>, now: number): number | undefined {
  const off = placeOffsetMs(w);
  return off === undefined ? undefined : new Date(now + off).getUTCHours();
}

/** Whether `now` is between this day's sunrise and sunset (06–18 at the place without them). */
function isDaylightAt(now: number, day: DailyForecast, hourNow?: number): boolean {
  const rise = day.sunrise ? Date.parse(day.sunrise) : NaN;
  const set = day.sunset ? Date.parse(day.sunset) : NaN;
  if (Number.isFinite(rise) && Number.isFinite(set)) return now >= rise && now < set;
  return hourNow == null || (hourNow >= 6 && hourNow < 18);
}

// ---------- What the hero may show as "now" ----------
// The `current` block is the reading at fetch time. Once the forecast is stale it is not "now" any
// more, so the hero uses this hour's forecast instead, and with no hour left only today's summary.

export type HeroKind = 'current' | 'hour' | 'day';

export interface HeroReading {
  /** current = fresh reading, hour = this hour's forecast, day = only today's summary is left. */
  kind: HeroKind;
  /** The big number (°C). Absent for 'day', which shows today's max / min instead. */
  temperatureC?: number;
  feelsLikeC?: number;
  weatherCode: number;
  isDay: boolean;
  humidityPct?: number;
  windKmh?: number;
  windGustKmh?: number;
}

export function heroReading(
  w: WeatherSnapshot,
  stale: boolean,
  now: number,
  today: DailyForecast | undefined,
): HeroReading {
  const c = w.current;
  const fromCurrent: HeroReading = {
    kind: 'current',
    temperatureC: c.temperatureC,
    feelsLikeC: c.feelsLikeC,
    weatherCode: c.weatherCode,
    isDay: c.isDay,
    humidityPct: c.humidityPct,
    windKmh: c.windKmh,
    windGustKmh: c.windGustKmh,
  };
  if (!stale) return fromCurrent;
  const h = w.hourly[0];
  if (h) {
    const start = Date.parse(h.time);
    if (start <= now && now < start + HOUR) {
      return {
        kind: 'hour',
        temperatureC: h.temperatureC,
        weatherCode: h.weatherCode,
        isDay: isDaylightHour(h.time, w.daily),
        humidityPct: h.humidityPct,
        windKmh: h.windKmh,
      };
    }
  }
  if (today) {
    return { kind: 'day', weatherCode: today.weatherCode, isDay: isDaylightAt(now, today, placeHourNow(w, now)) };
  }
  // No day left at all: the screen shows its "forecast is out of date" state instead of a hero.
  return fromCurrent;
}

/** The forecast day for `today` at the place, if the view still has it. */
export function todayOf(w: Pick<WeatherSnapshot, 'daily'>, today: string): DailyForecastExt | undefined {
  const d = w.daily[0];
  return d && d.date === today ? (d as DailyForecastExt) : undefined;
}

/** Hours of the forecast that fall on `date` (local to the place). */
export function hoursOn(hourly: HourlyForecast[], date: string): HourlyForecast[] {
  return hourly.filter(h => localDateOf(h.time) === date);
}

/** Visible gust only when it is clearly above the mean wind (avoids "हवा 12 · झोंके 13"). */
export function notableGust(wind: number, gust?: number): number | undefined {
  return gust != null && Number.isFinite(gust) && gust >= wind + 5 ? Math.round(gust) : undefined;
}

// ---------- UV (WHO UV index bands) ----------

export type UvLevel = 'low' | 'moderate' | 'high' | 'veryHigh' | 'extreme';

/** WHO bands: 0–2 low, 3–5 moderate, 6–7 high, 8–10 very high, 11+ extreme. */
export function uvLevel(uv: number): UvLevel {
  const n = Math.round(uv);
  return n <= 2 ? 'low' : n <= 5 ? 'moderate' : n <= 7 ? 'high' : n <= 10 ? 'veryHigh' : 'extreme';
}

export const UV_TONE: Record<UvLevel, 'green' | 'amber' | 'orange' | 'red' | 'tech'> = {
  low: 'green',
  moderate: 'amber',
  high: 'orange',
  veryHigh: 'red',
  extreme: 'tech',
};

// ---------- Alerts ----------

/**
 * Splits an alert message into the forecast sentence and the farmer action that follows it
 * ("…बारिश का अनुमान है। स्प्रे, खाद और सिंचाई टालें…"). Falls back to the whole text.
 */
export function splitAlertMessage(message: string): { forecast: string; action?: string } {
  const m = message.match(/^([\s\S]+?[।.!])\s+([\s\S]+)$/);
  if (!m) return { forecast: message };
  return { forecast: m[1].trim(), action: m[2].trim() };
}

// ---------- Spray windows for one day ----------
// Mirrors services/weather sprayAdvice + evaluateSprayDay (which are not exported): a 2-hour window
// in daylight with no rain in the window and the following SPRAY_RAIN_FREE_HOURS (a data gap counts
// as rain), wind ≤ SPRAY_WIND_MAX_KMH and temperature ≤ SPRAY_MAX_TEMP_C. Windows whose look-ahead
// runs past the forecast are not judged, and — like sprayAdvice — today is not judged at all when an
// old forecast ends before today's last window could be checked. The score is the service's, so
// today's best window matches the Weather screen's "क्या आज स्प्रे करना सही है?" card.
// TODO(lead): replace this copy with an exported evaluateSprayDay from services/weather.

/** Same as services/weather (not exported there). */
export const SPRAY_WINDOW_HOURS = 2;
const SPRAY_DUSK_GRACE_MS = 30 * MINUTE;
/** A window that started up to 15 minutes ago is still usable (service rule). */
const SPRAY_START_GRACE_MS = 15 * MINUTE;

export type SprayBlocker = 'rain' | 'wind' | 'heat';

export interface SprayWindow {
  startIso: string;
  /** "शाम 4–6 बजे" */
  label: string;
  /** All hours inside the ideal 3–10 km/h breeze. */
  ideal: boolean;
  /** Some hour has near-still air (< 3 km/h): use coarse droplets. */
  calm: boolean;
  /** Some hour is above the ideal 10 km/h: keep the nozzle low. */
  breezy: boolean;
  /** Average wind in the window (km/h). */
  windKmh: number;
  /** Warmest hour in the window (°C). */
  tempC: number;
  /** Highest rain chance in the window and its look-ahead (%). */
  maxRainPct: number;
  /** Lower is better (service scoring). */
  score: number;
}

export type DaySprayStatus = 'ok' | 'blocked' | 'passed' | 'noData';

export interface DaySprayResult {
  status: DaySprayStatus;
  /** Best non-overlapping windows, in time order (at most `max`). */
  windows: SprayWindow[];
  /** startIso of the single best window (lowest score; the earliest on a tie, like the service). */
  bestStartIso?: string;
  /** What blocked most windows (when status is 'blocked'). */
  blocker?: SprayBlocker;
  /**
   * The forecast ends before the day's last window can be judged (it needs SPRAY_RAIN_FREE_HOURS
   * of look-ahead), so later hours of the day were not checked.
   */
  partial: boolean;
}

function placeOffsetSuffix(hourly: HourlyForecast[], daily: DailyForecast[]): string {
  const sample = hourly[0]?.time ?? daily.find(d => d.sunrise)?.sunrise;
  const m = sample?.match(/([+-]\d{2}:\d{2})$/);
  return m ? m[1] : 'Z';
}

const placeTime = (date: string, hour: number, suffix: string) =>
  Date.parse(`${date}T${String(hour).padStart(2, '0')}:00:00${suffix}`);

export function daySprayWindows(
  date: string,
  daily: DailyForecast[],
  hourly: HourlyForecast[],
  now = Date.now(),
  max = 3,
): DaySprayResult {
  if (!hourly.length) return { status: 'noData', windows: [], partial: false };
  const suffix = placeOffsetSuffix(hourly, daily);
  const day = daily.find(d => d.date === date);
  const sunriseMs = day?.sunrise ? Date.parse(day.sunrise) : placeTime(date, 6, suffix);
  const sunsetMs = day?.sunset ? Date.parse(day.sunset) : NaN;
  const lastEnd = Number.isFinite(sunsetMs) ? sunsetMs + SPRAY_DUSK_GRACE_MS : placeTime(date, 18, suffix);
  const byTime = new Map(hourly.map(h => [Date.parse(h.time), h]));
  const dataEnd = Date.parse(hourly[hourly.length - 1].time) + HOUR;
  const between = (from: number, to: number) => {
    const out: (HourlyForecast | undefined)[] = [];
    for (let t = from; t < to; t += HOUR) out.push(byTime.get(t));
    return out;
  };

  // sprayAdvice's early rule: an old cached forecast that ends before today's last window can be
  // checked says nothing reliable about today — "no data", never half a day of confident windows.
  if (date === placeToday({ daily, hourly }, now) && now < lastEnd && dataEnd < lastEnd + SPRAY_RAIN_FREE_HOURS * HOUR) {
    return { status: 'noData', windows: [], partial: false };
  }

  // No window can start any more once the last one (ending at dusk) has begun.
  const dayOver = now >= lastEnd - SPRAY_WINDOW_HOURS * HOUR;
  const partial = !dayOver && lastEnd + SPRAY_RAIN_FREE_HOURS * HOUR > dataEnd;
  const blockers: Record<SprayBlocker, number> = { rain: 0, wind: 0, heat: 0 };
  const good: SprayWindow[] = [];
  let candidates = 0;

  for (const h of hourly) {
    if (localDateOf(h.time) !== date) continue;
    const start = Date.parse(h.time);
    const end = start + SPRAY_WINDOW_HOURS * HOUR;
    if (start < now - SPRAY_START_GRACE_MS) continue;
    if (start < sunriseMs || end > lastEnd) continue;
    const lookEnd = end + SPRAY_RAIN_FREE_HOURS * HOUR;
    if (lookEnd > dataEnd) continue;
    candidates++;

    const slot = between(start, end);
    const ahead = between(start, lookEnd);
    const rainy =
      ahead.some(x => !x || x.rainProbabilityPct > SPRAY_MAX_RAIN_PROB_PCT || x.rainMm > SPRAY_MAX_RAIN_MM) ||
      slot.some(x => x !== undefined && isWetCode(x.weatherCode));
    const windy = slot.some(x => x !== undefined && x.windKmh > SPRAY_WIND_MAX_KMH);
    const hot = slot.some(x => x !== undefined && x.temperatureC > SPRAY_MAX_TEMP_C);
    if (rainy) blockers.rain++;
    if (windy) blockers.wind++;
    if (hot) blockers.heat++;
    if (rainy || windy || hot) continue;

    const slotHours = slot as HourlyForecast[];
    const aheadHours = ahead as HourlyForecast[];
    const maxRainPct = Math.max(...aheadHours.map(x => x.rainProbabilityPct));
    let score = maxRainPct / 20;
    for (const x of slotHours) {
      if (x.windKmh < SPRAY_WIND_IDEAL_MIN_KMH) score += (SPRAY_WIND_IDEAL_MIN_KMH - x.windKmh) * 0.7;
      if (x.windKmh > SPRAY_WIND_IDEAL_MAX_KMH) score += x.windKmh - SPRAY_WIND_IDEAL_MAX_KMH;
      if (x.temperatureC > 28) score += (x.temperatureC - 28) * 0.5;
      if (x.weatherCode === 45 || x.weatherCode === 48) score += 2;
    }
    const calm = slotHours.some(x => x.windKmh < SPRAY_WIND_IDEAL_MIN_KMH);
    const breezy = slotHours.some(x => x.windKmh > SPRAY_WIND_IDEAL_MAX_KMH);
    good.push({
      startIso: h.time,
      label: formatHourWindow(localHourOf(h.time), SPRAY_WINDOW_HOURS),
      ideal: !calm && !breezy,
      calm,
      breezy,
      windKmh: Math.round(slotHours.reduce((s, x) => s + x.windKmh, 0) / slotHours.length),
      tempC: Math.round(Math.max(...slotHours.map(x => x.temperatureC))),
      maxRainPct,
      score,
    });
  }

  if (good.length) {
    // Best first (a stable sort keeps the earliest of equal scores first, as the service does), then
    // drop windows that overlap a better one; show them in time order.
    const ranked = [...good].sort((a, b) => a.score - b.score);
    const picked: SprayWindow[] = [];
    for (const w of ranked) {
      const s = Date.parse(w.startIso);
      if (picked.some(p => Math.abs(Date.parse(p.startIso) - s) < SPRAY_WINDOW_HOURS * HOUR)) continue;
      picked.push(w);
      if (picked.length >= max) break;
    }
    picked.sort((a, b) => a.startIso.localeCompare(b.startIso));
    return { status: 'ok', windows: picked, bestStartIso: ranked[0].startIso, partial };
  }
  if (candidates > 0) {
    // Ties resolve like the service: rain washes the spray off, wind drifts it, heat evaporates it.
    const blocker = (['rain', 'wind', 'heat'] as SprayBlocker[]).reduce((a, b) => (blockers[b] > blockers[a] ? b : a));
    return { status: 'blocked', windows: [], blocker, partial };
  }
  // Nothing to judge: either the day's daylight is over, or the forecast doesn't reach it.
  return { status: dayOver ? 'passed' : 'noData', windows: [], partial: false };
}

/**
 * Whether the service's spray advice is its "no data" answer, worked out from structure instead of
 * comparing reason strings. sprayAdvice says "no data" exactly when neither today nor tomorrow has
 * a window it could judge (or today is cut short by an old forecast), i.e. it is neither suitable,
 * nor names a window, nor was blocked by the weather on either day.
 */
export function isSprayNoData(spray: SprayAdvice, todayStatus: DaySprayStatus, tomorrowStatus: DaySprayStatus): boolean {
  return !spray.suitable && !spray.bestWindow && todayStatus !== 'blocked' && tomorrowStatus !== 'blocked';
}

/** Start times (ms) of every hour covered by the given windows, to mark hourly rows. */
export function sprayHourSet(windows: SprayWindow[]): Set<number> {
  const out = new Set<number>();
  for (const w of windows) {
    const s = Date.parse(w.startIso);
    for (let i = 0; i < SPRAY_WINDOW_HOURS; i++) out.add(s + i * HOUR);
  }
  return out;
}

// ---------- Rule-based farm tips ----------
// Local, offline rules. Thresholds are deliberately conservative and the wording is general
// guidance (no doses), so it never needs an AI disclaimer.

/** Rain chance that makes postponing irrigation / spraying sensible. */
export const TIP_RAIN_PROB_PCT = 60;
/** A day with this much rain (mm) waters the field on its own. */
export const TIP_RAIN_MM = 5;
/** Afternoon heat at which evening irrigation and mulching clearly pay off. */
export const TIP_HEAT_C = 35;
/** Sustained relative humidity that favours fungal leaf disease. */
export const TIP_HUMID_PCT = 80;
/** 10 m wind / gust that makes spraying a waste even before IMD's squall alert (40 km/h). */
export const TIP_WIND_KMH = 20;
export const TIP_GUST_KMH = 35;
/** From this local hour, today's daytime rain / wind / heat has mostly happened: advise for tomorrow. */
export const TIP_LATE_HOUR = 16;
/** After this local hour today's dawn minimum is behind us. */
export const TIP_COLD_PASSED_HOUR = 8;
/** Cool nights that stress nurseries before frost alerts (≤ 2 °C) kick in. */
export const TIP_COLD_C = 8;
/** A forecast week this dry needs planned irrigation. */
export const TIP_DRY_WEEK_MM = 2;
const TIP_DRY_MAX_PROB_PCT = 30;
const MAX_TIPS = 4;
const MIN_TIPS = 2;

export type TipKind = 'rain' | 'wind' | 'heat' | 'humidity' | 'fog' | 'cold' | 'dry' | 'normal' | 'scout';

export interface FarmTip {
  kind: TipKind;
  vars?: Record<string, string | number>;
}

const isFogCode = (code: number) => code === 45 || code === 48;

function avg(xs: number[]): number | undefined {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : undefined;
}

interface TipInput {
  /** Days to judge (today + tomorrow, or a single day). */
  days: DailyForecastExt[];
  /** Hours to judge humidity and fog on. */
  hours: HourlyForecast[];
  /** "आज"/"कल" for each day, or one fixed word ("इस दिन"). */
  when: (date: string) => string;
  /** Days whose dawn minimum is still ahead (default: `days`). */
  coldDays?: DailyForecastExt[];
  currentCode?: number;
  /** Whole forecast, for the dry-week rule (overview only). */
  week?: DailyForecast[];
}

function buildTips({ days, hours, when, coldDays = days, currentCode, week }: TipInput): FarmTip[] {
  const tips: FarmTip[] = [];

  const rainDay = days.find(d => d.rainProbabilityPct >= TIP_RAIN_PROB_PCT || d.rainMm >= TIP_RAIN_MM);
  if (rainDay) tips.push({ kind: 'rain', vars: { when: when(rainDay.date), pct: rainDay.rainProbabilityPct } });

  const windDay = days.find(d => d.windMaxKmh >= TIP_WIND_KMH || (d.windGustMaxKmh ?? 0) >= TIP_GUST_KMH);
  if (windDay) {
    tips.push({
      kind: 'wind',
      vars: { when: when(windDay.date), speed: Math.round(Math.max(windDay.windMaxKmh, windDay.windGustMaxKmh ?? 0)) },
    });
  }

  const hottest = days.reduce<DailyForecastExt | undefined>((a, d) => (!a || d.tempMaxC > a.tempMaxC ? d : a), undefined);
  if (hottest && hottest.tempMaxC >= TIP_HEAT_C) {
    tips.push({ kind: 'heat', vars: { when: when(hottest.date), temp: Math.round(hottest.tempMaxC) } });
  }

  // Averaged over the hours, not one reading: humidity peaks every night and means little alone.
  const humidity = avg(hours.map(h => h.humidityPct));
  if (humidity != null && humidity >= TIP_HUMID_PCT) tips.push({ kind: 'humidity', vars: { pct: Math.round(humidity) } });

  const foggy =
    (currentCode != null && isFogCode(currentCode)) ||
    hours.slice(0, 12).some(h => isFogCode(h.weatherCode)) ||
    days.some(d => isFogCode(d.weatherCode));
  if (foggy) tips.push({ kind: 'fog' });

  // The daily minimum comes around dawn, so the tip talks about that morning.
  const coldest = coldDays.reduce<DailyForecastExt | undefined>((a, d) => (!a || d.tempMinC < a.tempMinC ? d : a), undefined);
  if (coldest && coldest.tempMinC <= TIP_COLD_C) {
    tips.push({ kind: 'cold', vars: { when: when(coldest.date), temp: Math.round(coldest.tempMinC) } });
  }

  if (!rainDay && week && week.length >= 5) {
    const total = week.reduce((s, d) => s + d.rainMm, 0);
    const maxProb = Math.max(...week.map(d => d.rainProbabilityPct));
    if (total < TIP_DRY_WEEK_MM && maxProb < TIP_DRY_MAX_PROB_PCT) tips.push({ kind: 'dry' });
  }

  const out = tips.slice(0, MAX_TIPS);
  // Calm weather still gets useful lines: "weather is fine" only when nothing else applies.
  if (!out.length) out.push({ kind: 'normal' });
  if (out.length < MIN_TIPS) out.push({ kind: 'scout' });
  return out;
}

/**
 * Overview tips: today (until late afternoon) and tomorrow, the next 24 h of hours and the week for
 * dry spells. In the evening today's rain, wind and heat are mostly behind us, so only tomorrow counts.
 */
export function forecastTips(
  w: WeatherSnapshot,
  today: string,
  t: TFunction,
  now: number,
  /** The hero's weather code (a stale `current` must not raise a fog tip). */
  currentCode?: number,
): FarmTip[] {
  const tomorrow = addDays(today, 1);
  const nowHour = placeHourNow(w, now);
  const late = nowHour != null && nowHour >= TIP_LATE_HOUR;
  const days = (w.daily as DailyForecastExt[]).filter(d => (d.date === today && !late) || d.date === tomorrow);
  // Today's minimum has passed once the morning is under way; tomorrow's dawn is still ahead.
  const coldDays = days.filter(d => d.date === tomorrow || (nowHour != null && nowHour < TIP_COLD_PASSED_HOUR));
  return buildTips({
    days,
    coldDays,
    hours: w.hourly.slice(0, 24),
    when: date => dayLabel(date, today, t),
    currentCode,
    week: w.daily,
  });
}

/**
 * Tips for one forecast day (Weather Details). For today pass the place's current hour: in the
 * evening the day's rain, wind and heat have mostly happened, and after 8 AM so has its cold dawn.
 */
export function dayTips(day: DailyForecastExt, hours: HourlyForecast[], t: TFunction, nowHourToday?: number): FarmTip[] {
  const late = nowHourToday != null && nowHourToday >= TIP_LATE_HOUR;
  const coldPassed = nowHourToday != null && nowHourToday >= TIP_COLD_PASSED_HOUR;
  return buildTips({
    days: late ? [] : [day],
    coldDays: coldPassed ? [] : [day],
    hours,
    when: () => t('weather.tip.thisDay'),
  });
}

// ---------- Spoken summaries ----------

/**
 * Text for text-to-speech: units and symbols written out ("8 km/h" → "8 किलोमीटर प्रति घंटा",
 * "28°C" → "28 डिग्री", "7–9" → "7 से 9"), since TTS spells "km/h" letter by letter.
 */
export function speechify(text: string, t: TFunction): string {
  return text
    .replace(/\s*km\/h/g, ` ${t('weather.speak.kmh')}`)
    .replace(/\s*°C?/g, ` ${t('weather.speak.deg')}`)
    .replace(/(\d)\s*(?:मिमी|mm)(?![A-Za-z])/g, `$1 ${t('weather.speak.mm')}`)
    .replace(/\s*–\s*/g, ` ${t('weather.speak.to')} `)
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function overviewSpeech(
  w: WeatherSnapshot,
  reading: HeroReading,
  placeName: string,
  today: string,
  t: TFunction,
  opts: { staleTime?: string } = {},
): string {
  const parts: string[] = [];
  if (opts.staleTime) parts.push(t('weather.speak.stale', { time: opts.staleTime }));
  const cond = t(conditionKey(reading.weatherCode, reading.isDay));
  if (reading.kind === 'day' || reading.temperatureC == null) {
    parts.push(t('weather.speak.place', { place: placeName }));
  } else {
    parts.push(
      t(reading.kind === 'hour' ? 'weather.speak.hour' : 'weather.speak.now', {
        place: placeName,
        temp: Math.round(reading.temperatureC),
        cond,
      }),
    );
  }
  const td = todayOf(w, today);
  if (td) {
    parts.push(
      t('weather.speak.today', { max: Math.round(td.tempMaxC), min: Math.round(td.tempMinC), pct: td.rainProbabilityPct }),
    );
  }
  if (w.alerts.length) parts.push(t('weather.speak.alerts', { titles: w.alerts.map(a => a.title).join(', ') }));
  parts.push(t('weather.speak.spray', { reason: w.spray.reason }));
  return speechify(parts.join(' '), t);
}

export function daySpeech(
  day: DailyForecast,
  label: string,
  placeName: string,
  spray: DaySprayResult,
  alerts: WeatherAlert[],
  t: TFunction,
): string {
  const parts = [
    t('weather.speak.day', {
      day: label,
      place: placeName,
      cond: t(conditionKey(day.weatherCode, true)),
      max: Math.round(day.tempMaxC),
      min: Math.round(day.tempMinC),
      pct: day.rainProbabilityPct,
    }),
  ];
  if (alerts.length) parts.push(t('weather.speak.alerts', { titles: alerts.map(a => a.title).join(', ') }));
  if (spray.status === 'ok') {
    parts.push(t('weather.speak.dayWindows', { windows: spray.windows.map(w => w.label).join(', ') }));
    const best = spray.windows.length > 1 ? spray.windows.find(w => w.startIso === spray.bestStartIso) : undefined;
    if (best) parts.push(t('weather.speak.dayBest', { window: best.label }));
  } else if (spray.status === 'blocked' && spray.blocker) {
    parts.push(t('weather.day.spray.none', { why: t(`weather.spray.why.${spray.blocker}`) }));
  }
  return speechify(parts.join(' '), t);
}

/** i18n key of the short condition ("धूप खिली है"). */
export const conditionKey = (code: number, isDay = true) => weatherCodeInfo(code, isDay).key;
