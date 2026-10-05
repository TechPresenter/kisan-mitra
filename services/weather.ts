// Weather for the farmer's place from Open-Meteo (free, no key, CORS-enabled), mapped to
// WeatherSnapshot with farm alerts (IMD criteria) and pesticide-spray timing. Everything goes
// through lib/cache so the last forecast stays visible offline, labelled with its fetch time.
// A cached forecast is always re-viewed against the clock (weatherView), so yesterday's "today"
// advice or alerts for days that have passed are never shown as current.
import { useEffect, useMemo, useState } from 'react';
import type {
  CurrentWeather,
  DailyForecast,
  GeoPlace,
  HourlyForecast,
  SprayAdvice,
  WeatherAlert,
  WeatherAlertKind,
  WeatherSnapshot,
} from '../types/models';
import { HOUR, MINUTE, fetchWithCache, isOnline, useResource, type CachedResult, type Resource } from '../lib/cache';
import { store } from '../lib/store';
import { getSettings, useSettings } from '../lib/app-state';
import { addDays, formatDate, parseISODate } from '../lib/format';
import { localeFor, tNow } from '../lib/i18n';
import { pushNotification } from './notifications';
import './weather-strings';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const REQUEST_TIMEOUT_MS = 15_000;
const AQI_TIMEOUT_MS = 8_000;
/** Forecasts update hourly; 30 min keeps the "now" numbers honest without wasting data. */
export const WEATHER_MAX_AGE_MS = 30 * MINUTE;
/** useWeather re-views the cached forecast this often, so spray advice and alerts follow the clock. */
const VIEW_TICK_MS = 15 * MINUTE;
/** `weatherCode` when neither the current block nor this hour's forecast has one ("मौसम", cloud icon). */
export const UNKNOWN_WEATHER_CODE = -1;

// ---------- Alert thresholds ----------
// IMD rainfall terminology, 24-h accumulation
// (https://rsmcnewdelhi.imd.gov.in/images/pdf/terminology.pdf):
// heavy 64.5–115.5 mm, very heavy 115.6–204.4 mm, extremely heavy ≥ 204.5 mm.
export const IMD_HEAVY_RAIN_MM = 64.5;
export const IMD_VERY_HEAVY_RAIN_MM = 115.6;
export const IMD_EXTREMELY_HEAVY_RAIN_MM = 204.5;
// IMD heat/cold-wave criteria (https://mausam.imd.gov.in/pdfs/heatcolduser/Definition.pdf).
// Heatwave is only considered once Tmax ≥ 40 °C in the plains; without station normals we use the
// actual-temperature rule: heatwave ≥ 45 °C, severe ≥ 47 °C. ≥ 40 °C is still flagged as crop/animal heat stress.
export const IMD_HEAT_CONSIDER_C = 40;
export const IMD_HEATWAVE_C = 45;
export const IMD_SEVERE_HEATWAVE_C = 47;
// Cold wave by actual Tmin (plains only): ≤ 4 °C cold wave, ≤ 2 °C severe cold wave.
export const IMD_COLD_WAVE_C = 4;
export const IMD_SEVERE_COLD_WAVE_C = 2;
// IMD reports ground frost when the grass minimum reaches 0 °C. On clear, calm nights the crop
// canopy runs ~2–4 °C below the 2 m air temperature that models forecast, so Tmin ≤ 2 °C means likely frost.
export const FROST_RISK_TMIN_C = 2;
// IMD terminology: "squally wind" = gusts reaching ≥ 22 kt (40 km/h); "gale force" = 34 kt (≈ 62 km/h).
// We apply the gale figure to gusts too, which warns a little earlier than IMD's mean-wind definition.
export const IMD_SQUALL_KMH = 40;
export const IMD_GALE_KMH = 62;
// Thunderstorm and hail are NOT IMD criteria: they come from model weather codes (WMO 95 thunder,
// 96/99 hail). Open-Meteo's daily code is the worst hour of the day, and 96/99 come only from the
// models with a hail diagnostic, so a single model hour must not raise an alarm. We need thunder in at
// least 2 forecast hours of the day plus a real rain chance, which limits these alerts to the 48 h
// hourly horizon.
export const STORM_MIN_THUNDER_HOURS = 2;
export const STORM_MIN_RAIN_PROB_PCT = 50;
/** Hail is only urgent when squally gusts and a high rain chance back up the model's hail code. */
export const HAIL_URGENT_GUST_KMH = IMD_SQUALL_KMH;
export const HAIL_URGENT_RAIN_PROB_PCT = 60;
/** IMD's actual-minimum cold-wave rule is for plains; hill stations are cold by normal. */
const HILL_ELEVATION_M = 1000;
/** Only alerts inside this horizon become notifications; 4–7-day forecasts shift too much to alarm on. */
const NOTIFY_HORIZON_DAYS = 3;
/** Model-derived storm/hail alerts notify for today and tomorrow only. */
const STORM_NOTIFY_HORIZON_DAYS = 2;
/** Per-day record of what was already notified, so escalations notify and repeats do not. */
const NOTIFIED_STORE_KEY = 'weather.notified';

// ---------- Spray thresholds ----------
// Wind: GRDC / Queensland Government spray-drift guidance — spray in a steady 3–15 km/h breeze, ideally
// ≲ 10 km/h; under ~3 km/h inversions can carry fine droplets
// (https://www.business.qld.gov.au/industries/farms-fishing-forestry/agriculture/sustainable/chemical/spray-drift/minimise).
// We compare the 10 m model wind, which is higher than wind at nozzle height, so the check errs on the safe side.
// TNAU Agritech "Safe use of pesticides": do not spray in high wind, high temperature or rain
// (https://agritech.tnau.ac.in/crop_protection/crop_prot_pesticides_safe%20use%20of%20pesticides.html).
export const SPRAY_WIND_IDEAL_MIN_KMH = 3;
export const SPRAY_WIND_IDEAL_MAX_KMH = 10;
export const SPRAY_WIND_MAX_KMH = 15;
/** Above ~32 °C droplets evaporate fast and volatile products drift; Indian advisories say spray in cool hours. */
export const SPRAY_MAX_TEMP_C = 32;
export const SPRAY_MAX_RAIN_PROB_PCT = 40;
/** Most labels need 1–6 h without rain for the spray to dry and be absorbed; we ask for the full 6 h. */
export const SPRAY_RAIN_FREE_HOURS = 6;
/** Hourly rain above this (mm) counts as rain even when the probability is low. */
export const SPRAY_MAX_RAIN_MM = 0.2;
const SPRAY_WINDOW_HOURS = 2;
/** A window may end shortly after sunset ("शाम 4–6 बजे" in October) while there is still light. */
const SPRAY_DUSK_GRACE_MS = 30 * MINUTE;

// ---------- AQI (India's National Air Quality Index) ----------
// CPCB National Air Quality Index, 2014 (https://cpcb.gov.in/National-Air-Quality-Index/): sub-index
// bands 0–50 good, 51–100 satisfactory, 101–200 moderate, 201–300 poor, 301–400 very poor, 401–500 severe,
// from 24-hour average concentrations (µg/m³). PM2.5: 30 / 60 / 90 / 120 / 250; PM10: 50 / 100 / 250 / 350 / 430.
// CPCB leaves the severe band open-ended; like the common CPCB calculators we extend it by the width of the
// very-poor band (PM2.5 → 380, PM10 → 510) and cap the index at 500.
const NAQI_INDEX = [0, 50, 100, 200, 300, 400, 500] as const;
const NAQI_PM25 = [0, 30, 60, 90, 120, 250, 380] as const;
const NAQI_PM10 = [0, 50, 100, 250, 350, 430, 510] as const;
/** CPCB needs at least 16 hourly values for a valid 24-hour average. */
const NAQI_MIN_HOURS = 16;

// ---------- Types ----------

/** Daily forecast plus the day's peak gust (used for wind alerts; not part of the shared model yet). */
export interface DailyForecastExt extends DailyForecast {
  windGustMaxKmh?: number;
}

/** What is cached: the shared snapshot plus the station height needed to re-derive alerts later. */
interface StoredWeather extends WeatherSnapshot {
  daily: DailyForecastExt[];
  elevationM?: number;
}

export type WeatherScene = 'clear-day' | 'clear-night' | 'cloudy' | 'rain' | 'storm' | 'fog';

/** lucide-react export names, e.g. `import { icons } from 'lucide-react'; icons[info.icon]`. */
export type WeatherIconName =
  | 'Sun'
  | 'Moon'
  | 'CloudSun'
  | 'CloudMoon'
  | 'Cloud'
  | 'CloudFog'
  | 'CloudDrizzle'
  | 'CloudRain'
  | 'CloudRainWind'
  | 'CloudSnow'
  | 'CloudLightning'
  | 'CloudHail';

export interface WeatherCodeInfo {
  /** i18n key of a short condition, e.g. 'weather.cond.sunny' → "धूप खिली है" / "Sunny". */
  key: string;
  icon: WeatherIconName;
  scene: WeatherScene;
}

export type WeatherErrorCode = 'offline' | 'network' | 'bad-response';

export class WeatherError extends Error {
  constructor(public code: WeatherErrorCode, message?: string) {
    super(message || code);
    this.name = 'WeatherError';
  }
  get messageKey(): string {
    return this.code === 'offline' ? 'common.error.offline' : 'weather.error.load';
  }
}

// ---------- Conditions & AQI ----------

/** WMO weather code (Open-Meteo) → short Hindi condition key, lucide icon and illustration scene. */
export function weatherCodeInfo(code: number, isDay = true): WeatherCodeInfo {
  const clear = isDay ? 'clear-day' : 'clear-night';
  switch (code) {
    case 0:
      return isDay
        ? { key: 'weather.cond.sunny', icon: 'Sun', scene: clear }
        : { key: 'weather.cond.clearNight', icon: 'Moon', scene: clear };
    case 1:
      return isDay
        ? { key: 'weather.cond.mostlySunny', icon: 'Sun', scene: clear }
        : { key: 'weather.cond.mostlyClear', icon: 'Moon', scene: clear };
    case 2:
      return { key: 'weather.cond.partlyCloudy', icon: isDay ? 'CloudSun' : 'CloudMoon', scene: 'cloudy' };
    case 3:
      return { key: 'weather.cond.overcast', icon: 'Cloud', scene: 'cloudy' };
    case 45:
    case 48:
      return { key: 'weather.cond.fog', icon: 'CloudFog', scene: 'fog' };
    case 51:
    case 53:
    case 55:
      return { key: 'weather.cond.drizzle', icon: 'CloudDrizzle', scene: 'rain' };
    case 56:
    case 57:
      return { key: 'weather.cond.freezingDrizzle', icon: 'CloudDrizzle', scene: 'rain' };
    case 61:
      return { key: 'weather.cond.lightRain', icon: 'CloudRain', scene: 'rain' };
    case 63:
      return { key: 'weather.cond.rain', icon: 'CloudRain', scene: 'rain' };
    case 65:
      return { key: 'weather.cond.heavyRain', icon: 'CloudRainWind', scene: 'rain' };
    case 66:
    case 67:
      return { key: 'weather.cond.freezingRain', icon: 'CloudRain', scene: 'rain' };
    case 71:
    case 73:
    case 75:
    case 77:
    case 85:
    case 86:
      return { key: 'weather.cond.snow', icon: 'CloudSnow', scene: 'cloudy' };
    case 80:
      return { key: 'weather.cond.lightShowers', icon: 'CloudDrizzle', scene: 'rain' };
    case 81:
      return { key: 'weather.cond.showers', icon: 'CloudRain', scene: 'rain' };
    case 82:
      return { key: 'weather.cond.heavyShowers', icon: 'CloudRainWind', scene: 'rain' };
    case 95:
      return { key: 'weather.cond.thunderstorm', icon: 'CloudLightning', scene: 'storm' };
    case 96:
    case 99:
      return { key: 'weather.cond.hailstorm', icon: 'CloudHail', scene: 'storm' };
    default:
      return { key: 'weather.cond.unknown', icon: 'Cloud', scene: 'cloudy' };
  }
}

/** Any precipitation or thunder (WMO codes 51 and above). */
export const isWetCode = (code: number) => code >= 51;
const isThunderCode = (code: number) => code >= 95;
const isHailCode = (code: number) => code === 96 || code === 99;

export type AqiLevel = 'good' | 'satisfactory' | 'moderate' | 'poor' | 'veryPoor' | 'severe';

/** CPCB NAQI category for an index value. `key` is an i18n key ("अच्छा", "संतोषजनक" …). */
export function aqiInfo(aqi: number): { level: AqiLevel; key: string; tone: 'good' | 'warn' | 'bad' } {
  const level: AqiLevel =
    aqi <= 50 ? 'good' : aqi <= 100 ? 'satisfactory' : aqi <= 200 ? 'moderate' : aqi <= 300 ? 'poor' : aqi <= 400 ? 'veryPoor' : 'severe';
  const tone = level === 'good' || level === 'satisfactory' ? 'good' : level === 'moderate' ? 'warn' : 'bad';
  return { level, key: `weather.aqi.${level}`, tone };
}

function naqiSubIndex(conc: number, breakpoints: readonly number[]): number {
  for (let i = 1; i < breakpoints.length; i++) {
    if (conc <= breakpoints[i]) {
      const span = breakpoints[i] - breakpoints[i - 1];
      return NAQI_INDEX[i - 1] + ((conc - breakpoints[i - 1]) * (NAQI_INDEX[i] - NAQI_INDEX[i - 1])) / span;
    }
  }
  return NAQI_INDEX[NAQI_INDEX.length - 1];
}

/**
 * India NAQI from 24-hour average PM2.5 / PM10 (µg/m³): the higher sub-index, 0–500.
 * Undefined when neither average is available.
 */
export function naqiFromPm(pm25Avg24h?: number, pm10Avg24h?: number): number | undefined {
  const subs: number[] = [];
  if (fin(pm25Avg24h) && pm25Avg24h >= 0) subs.push(naqiSubIndex(pm25Avg24h, NAQI_PM25));
  if (fin(pm10Avg24h) && pm10Avg24h >= 0) subs.push(naqiSubIndex(pm10Avg24h, NAQI_PM10));
  return subs.length ? Math.round(Math.min(500, Math.max(...subs))) : undefined;
}

// ---------- Time helpers ----------
// Open-Meteo returns wall-clock times of the place (timezone=auto). We store them as ISO 8601 with
// the place's UTC offset ("2026-10-05T16:00:00+05:30"): Date parses them correctly and the local
// hour stays readable for labels like "शाम 4–6 बजे".

const pad = (n: number) => String(n).padStart(2, '0');

function offsetSuffix(seconds: number): string {
  const sign = seconds < 0 ? '-' : '+';
  const abs = Math.abs(seconds);
  return `${sign}${pad(Math.floor(abs / 3600))}:${pad(Math.floor((abs % 3600) / 60))}`;
}

const withOffset = (local: string, suffix: string) => `${local.length === 16 ? `${local}:00` : local}${suffix}`;

/** Wall-clock hour (0–23) at the place for a stored forecast time. */
const localHour = (iso: string) => Number(iso.slice(11, 13));
const localDate = (iso: string) => iso.slice(0, 10);

/** The place's UTC offset in ms, read from a stored time such as "…T16:00:00+05:30". */
function offsetMsOf(iso: string | undefined): number | undefined {
  const m = iso?.match(/([+-])(\d{2}):(\d{2})$/);
  if (!m) return undefined;
  const ms = (Number(m[2]) * 60 + Number(m[3])) * MINUTE;
  return m[1] === '-' ? -ms : ms;
}

/** Offset of the forecast's place; the device offset only if the snapshot carries no times at all. */
function placeOffsetMs(daily: DailyForecast[], hourly: HourlyForecast[]): number {
  return (
    offsetMsOf(hourly[0]?.time) ??
    offsetMsOf(daily.find(d => d.sunrise)?.sunrise) ??
    -new Date().getTimezoneOffset() * MINUTE
  );
}

/** Calendar date at the place (YYYY-MM-DD) for an instant. */
const placeDate = (now: number, offsetMs: number) => new Date(now + offsetMs).toISOString().slice(0, 10);

/** Instant of a wall-clock time at the place, e.g. 18:00 on `date`. */
const placeTime = (date: string, hour: number, offsetMs: number) =>
  Date.parse(`${date}T${pad(hour)}:00:00${offsetSuffix(offsetMs / 1000)}`);

/** Today's date at the snapshot's place (not the device's), for "is this day past?" checks. */
export function placeToday(snapshot: Pick<WeatherSnapshot, 'daily' | 'hourly'>, now = Date.now()): string {
  return placeDate(now, placeOffsetMs(snapshot.daily, snapshot.hourly));
}

function formatDateRange(from: string, to: string): string {
  const fmt = new Intl.DateTimeFormat(localeFor(getSettings().languageCode), { day: 'numeric', month: 'long' });
  try {
    return fmt.formatRange(parseISODate(from), parseISODate(to));
  } catch {
    return `${formatDate(from)} – ${formatDate(to)}`;
  }
}

type DayPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

/** IMD time-of-day bands: morning 04–08 + forenoon 08–12, afternoon 12–16, evening 16–20, night 20–04. */
function dayPeriod(hour: number): DayPeriod {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 4 && h < 12) return 'morning';
  if (h >= 12 && h < 16) return 'afternoon';
  if (h >= 16 && h < 20) return 'evening';
  return 'night';
}

const h12 = (hour: number) => ((hour % 24) % 12) || 12;
const amPm = (hour: number) => ((hour % 24) < 12 ? 'AM' : 'PM');

/** "शाम 4–6 बजे" / "सुबह 11 – दोपहर 1 बजे" (English: "4–6 PM"). */
export function formatHourWindow(startHour: number, hours = SPRAY_WINDOW_HOURS): string {
  const end = startHour + hours;
  const same = dayPeriod(startHour) === dayPeriod(end - 1) && amPm(startHour) === amPm(end);
  const vars = {
    period: tNow(`weather.period.${dayPeriod(startHour)}`),
    fromPeriod: tNow(`weather.period.${dayPeriod(startHour)}`),
    toPeriod: tNow(`weather.period.${dayPeriod(end)}`),
    from: h12(startHour),
    to: h12(end),
    fromAmPm: amPm(startHour),
    toAmPm: amPm(end),
  };
  return tNow(same ? 'weather.window.same' : 'weather.window.cross', vars);
}

// ---------- Spray advice ----------

type SprayBlocker = 'rain' | 'wind' | 'heat';

interface SprayDayResult {
  /** Best window on that day, if any. */
  best?: { startIso: string; score: number; windKmh: number; tempC: number };
  /** Daylight windows still ahead of `now` that the forecast covers (0 = nothing left to judge). */
  candidates: number;
  blockers: Record<SprayBlocker, number>;
}

interface SprayContext {
  hourly: HourlyForecast[];
  /** Hourly entries by start instant; a missing hour is a gap in the model data. */
  byTime: Map<number, HourlyForecast>;
  now: number;
  /** End of the last forecast hour: windows needing data beyond it cannot be judged. */
  dataEnd: number;
  offsetMs: number;
}

/** Hours [from, to) as entries, `undefined` where the forecast has a gap. */
function hoursBetween(ctx: SprayContext, from: number, to: number): (HourlyForecast | undefined)[] {
  const out: (HourlyForecast | undefined)[] = [];
  for (let t = from; t < to; t += HOUR) out.push(ctx.byTime.get(t));
  return out;
}

/** Latest end of a spray window on `date`: sunset plus a little light, else 18:00 at the place. */
function daylightEnd(day: DailyForecast | undefined, date: string, offsetMs: number): number {
  const sunset = day?.sunset ? Date.parse(day.sunset) : NaN;
  return Number.isFinite(sunset) ? sunset + SPRAY_DUSK_GRACE_MS : placeTime(date, 18, offsetMs);
}

function evaluateSprayDay(day: DailyForecast | undefined, date: string, ctx: SprayContext): SprayDayResult {
  const result: SprayDayResult = { candidates: 0, blockers: { rain: 0, wind: 0, heat: 0 } };
  const sunrise = day?.sunrise ? Date.parse(day.sunrise) : placeTime(date, 6, ctx.offsetMs);
  const lastEnd = daylightEnd(day, date, ctx.offsetMs);

  for (const h of ctx.hourly) {
    if (localDate(h.time) !== date) continue;
    const start = Date.parse(h.time);
    const end = start + SPRAY_WINDOW_HOURS * HOUR;
    // A window that started up to 15 minutes ago is still usable.
    if (start < ctx.now - 15 * MINUTE) continue;
    if (start < sunrise || end > lastEnd) continue;
    const lookEnd = end + SPRAY_RAIN_FREE_HOURS * HOUR;
    // Beyond the forecast we cannot tell whether rain follows, so the window is not judged at all.
    if (lookEnd > ctx.dataEnd) continue;
    result.candidates++;

    const slot = hoursBetween(ctx, start, end);
    const lookahead = hoursBetween(ctx, start, lookEnd);
    // A gap in the model data is unknown rain, and unknown is not safe to spray into.
    const rainy =
      lookahead.some(x => !x || x.rainProbabilityPct > SPRAY_MAX_RAIN_PROB_PCT || x.rainMm > SPRAY_MAX_RAIN_MM) ||
      slot.some(x => x !== undefined && isWetCode(x.weatherCode));
    const windy = slot.some(x => x !== undefined && x.windKmh > SPRAY_WIND_MAX_KMH);
    const hot = slot.some(x => x !== undefined && x.temperatureC > SPRAY_MAX_TEMP_C);
    if (rainy) result.blockers.rain++;
    if (windy) result.blockers.wind++;
    if (hot) result.blockers.heat++;
    if (rainy || windy || hot) continue;

    const slotHours = slot as HourlyForecast[];
    const ahead = lookahead as HourlyForecast[];
    // Lower is better: prefer a steady 3–10 km/h breeze, cooler air and the lowest rain chance.
    let score = Math.max(...ahead.map(x => x.rainProbabilityPct)) / 20;
    for (const x of slotHours) {
      if (x.windKmh < SPRAY_WIND_IDEAL_MIN_KMH) score += (SPRAY_WIND_IDEAL_MIN_KMH - x.windKmh) * 0.7;
      if (x.windKmh > SPRAY_WIND_IDEAL_MAX_KMH) score += x.windKmh - SPRAY_WIND_IDEAL_MAX_KMH;
      if (x.temperatureC > 28) score += (x.temperatureC - 28) * 0.5;
      if (x.weatherCode === 45 || x.weatherCode === 48) score += 2; // wet leaves dilute the spray
    }
    if (!result.best || score < result.best.score) {
      result.best = {
        startIso: h.time,
        score,
        windKmh: Math.round(slotHours.reduce((s, x) => s + x.windKmh, 0) / slotHours.length),
        tempC: Math.round(Math.max(...slotHours.map(x => x.temperatureC))),
      };
    }
  }
  return result;
}

function mainBlocker(...days: SprayDayResult[]): SprayBlocker {
  const total = { rain: 0, wind: 0, heat: 0 };
  for (const d of days) for (const k of Object.keys(total) as SprayBlocker[]) total[k] += d.blockers[k];
  // Ties resolve in this order: rain washes the spray off, wind drifts it, heat evaporates it.
  return (['rain', 'wind', 'heat'] as SprayBlocker[]).reduce((a, b) => (total[b] > total[a] ? b : a));
}

/**
 * "क्या आज स्प्रे करना सही है?" — checks today's remaining daylight for a 2-hour window with no rain
 * expected for the following 6 h, wind ≤ 15 km/h (ideally 3–10) and temperature ≤ 32 °C.
 * Falls back to tomorrow's best window. "Today" is the date at the place for `now`, not the day the
 * forecast was fetched, so this is safe to re-run on a cached forecast (weatherView does that).
 * Returns the "no data" advice when the forecast does not reach 6 h past today's daylight.
 */
export function sprayAdvice(daily: DailyForecast[], hourly: HourlyForecast[], now = Date.now()): SprayAdvice {
  const noData: SprayAdvice = { suitable: false, reason: tNow('weather.spray.noData') };
  if (!hourly.length) return noData;
  const offsetMs = placeOffsetMs(daily, hourly);
  const today = placeDate(now, offsetMs);
  const tomorrow = addDays(today, 1);
  const ctx: SprayContext = {
    hourly,
    byTime: new Map(hourly.map(h => [Date.parse(h.time), h])),
    now,
    dataEnd: Date.parse(hourly[hourly.length - 1].time) + HOUR,
    offsetMs,
  };
  const todayDay = daily.find(d => d.date === today);
  const todayEnd = daylightEnd(todayDay, today, offsetMs);
  // An old cached forecast runs out before today is over: say so instead of judging half a day.
  if (now < todayEnd && ctx.dataEnd < todayEnd + SPRAY_RAIN_FREE_HOURS * HOUR) return noData;
  const todayRes = evaluateSprayDay(todayDay, today, ctx);

  if (todayRes.best) {
    const b = todayRes.best;
    const label = formatHourWindow(localHour(b.startIso));
    let reason = tNow('weather.spray.good', {
      window: label,
      wind: b.windKmh,
      temp: b.tempC,
      hours: SPRAY_RAIN_FREE_HOURS,
    });
    if (b.windKmh < SPRAY_WIND_IDEAL_MIN_KMH) reason += ' ' + tNow('weather.spray.calmNote');
    return { suitable: true, bestWindow: label, reason };
  }

  const tomorrowRes = evaluateSprayDay(daily.find(d => d.date === tomorrow), tomorrow, ctx);
  if (tomorrowRes.best) {
    const label = formatHourWindow(localHour(tomorrowRes.best.startIso));
    const reason =
      todayRes.candidates === 0
        ? tNow('weather.spray.lateToday', { window: label })
        : tNow('weather.spray.notToday', { window: label, why: tNow(`weather.spray.why.${mainBlocker(todayRes)}`) });
    return { suitable: false, bestWindow: tNow('weather.window.tomorrow', { window: label }), reason };
  }

  const blockerDays = [todayRes, tomorrowRes].filter(d => d.candidates > 0);
  if (!blockerDays.length) return noData;
  const why = tNow(`weather.spray.why.${mainBlocker(...blockerDays)}`);
  return {
    suitable: false,
    reason: tNow(todayRes.candidates === 0 ? 'weather.spray.lateBadTomorrow' : 'weather.spray.notSoon', { why }),
  };
}

// ---------- Alerts ----------

const SEVERITY_RANK = { important: 1, urgent: 2 } as const;

interface DayHit {
  date: string;
  severity: WeatherAlert['severity'];
  /** Title variant, ordered by seriousness within a kind. */
  variant: string;
  rank: number;
  value: number;
}

/** One comparable number per hit: severity first, then the variant's rank within its kind. */
const hitLevel = (h: DayHit) => SEVERITY_RANK[h.severity] * 10 + h.rank;

/** Consecutive days with the same alert kind. */
interface AlertRun {
  kind: WeatherAlertKind;
  days: DayHit[];
}

const ALERT_KEYS: Record<WeatherAlertKind, { msg: string; worstIsMin?: boolean }> = {
  'heavy-rain': { msg: 'weather.alert.heavyRain.msg' },
  heatwave: { msg: 'weather.alert.heat.msg' },
  'cold-wave': { msg: 'weather.alert.coldWave.msg', worstIsMin: true },
  frost: { msg: 'weather.alert.frost.msg', worstIsMin: true },
  'strong-wind': { msg: 'weather.alert.wind.msg' },
  storm: { msg: 'weather.alert.storm.msg' },
};

/** Largest rain total in any 24 h window that starts on each date (catches storms split across midnight). */
function rolling24hRain(hourly: HourlyForecast[]): Map<string, number> {
  const out = new Map<string, number>();
  if (!hourly.length) return out;
  const times = hourly.map(h => Date.parse(h.time));
  const dataEnd = times[times.length - 1] + HOUR;
  for (let i = 0; i < hourly.length; i++) {
    const until = times[i] + 24 * HOUR;
    if (until > dataEnd) break;
    // Gap hours (missing model data) add nothing: a gap must not invent a rain alert.
    let sum = 0;
    for (let j = i; j < hourly.length && times[j] < until; j++) sum += hourly[j].rainMm;
    const date = localDate(hourly[i].time);
    out.set(date, Math.max(out.get(date) ?? 0, sum));
  }
  return out;
}

interface DayContext {
  rain24?: number;
  hills: boolean;
  /** Forecast hours on that day with a thunder code (95/96/99), and with a hail code (96/99). */
  thunderHours: number;
  hailHours: number;
}

function dayHits(d: DailyForecastExt, ctx: DayContext): Partial<Record<WeatherAlertKind, DayHit>> {
  const hits: Partial<Record<WeatherAlertKind, DayHit>> = {};
  const hit = (severity: DayHit['severity'], variant: string, rank: number, value: number): DayHit => ({
    date: d.date,
    severity,
    variant,
    rank,
    value,
  });

  // Every rule needs a real number; a missing value never counts as 0 °C or 0 mm.
  const rain = Math.max(fin(d.rainMm) ? d.rainMm : -Infinity, fin(ctx.rain24) ? ctx.rain24 : -Infinity);
  if (rain >= IMD_EXTREMELY_HEAVY_RAIN_MM) hits['heavy-rain'] = hit('urgent', 'extremeRain', 3, rain);
  else if (rain >= IMD_VERY_HEAVY_RAIN_MM) hits['heavy-rain'] = hit('urgent', 'veryHeavyRain', 2, rain);
  else if (rain >= IMD_HEAVY_RAIN_MM) hits['heavy-rain'] = hit('important', 'heavyRain', 1, rain);

  if (fin(d.tempMaxC)) {
    if (d.tempMaxC >= IMD_SEVERE_HEATWAVE_C) hits.heatwave = hit('urgent', 'severeHeatwave', 3, d.tempMaxC);
    else if (d.tempMaxC >= IMD_HEATWAVE_C) hits.heatwave = hit('urgent', 'heatwave', 2, d.tempMaxC);
    else if (d.tempMaxC >= IMD_HEAT_CONSIDER_C) hits.heatwave = hit('important', 'hot', 1, d.tempMaxC);
  }

  if (fin(d.tempMinC)) {
    // Frost already tells the farmer to protect crops from cold, so it replaces a cold-wave alert that
    // day. IMD's severe cold wave (≤ 2 °C) therefore always shows as the urgent frost alert.
    if (d.tempMinC <= Math.max(FROST_RISK_TMIN_C, IMD_SEVERE_COLD_WAVE_C)) hits.frost = hit('urgent', 'frost', 1, d.tempMinC);
    else if (!ctx.hills && d.tempMinC <= IMD_COLD_WAVE_C) hits['cold-wave'] = hit('important', 'coldWave', 1, d.tempMinC);
  }

  const gust = Math.max(fin(d.windGustMaxKmh) ? d.windGustMaxKmh : -Infinity, fin(d.windMaxKmh) ? d.windMaxKmh : -Infinity);
  if (gust >= IMD_GALE_KMH) hits['strong-wind'] = hit('urgent', 'gale', 2, gust);
  else if (gust >= IMD_SQUALL_KMH) hits['strong-wind'] = hit('important', 'wind', 1, gust);

  // Model-derived (see STORM_* above): thunder in ≥ 2 forecast hours and a ≥ 50% rain chance.
  const prob = fin(d.rainProbabilityPct) ? d.rainProbabilityPct : 0;
  if (ctx.thunderHours >= STORM_MIN_THUNDER_HOURS && prob >= STORM_MIN_RAIN_PROB_PCT) {
    if (ctx.hailHours > 0) {
      const backed = gust >= HAIL_URGENT_GUST_KMH && prob >= HAIL_URGENT_RAIN_PROB_PCT;
      hits.storm = hit(backed ? 'urgent' : 'important', 'hail', 2, 0);
    } else {
      hits.storm = hit('important', 'storm', 1, 0);
    }
  }
  return hits;
}

/** Day-by-day hits grouped into runs of consecutive days per kind. */
function alertRuns(daily: DailyForecastExt[], hourly: HourlyForecast[], opts: { elevationM?: number } = {}): AlertRun[] {
  const rain24 = rolling24hRain(hourly);
  const hills = (opts.elevationM ?? 0) >= HILL_ELEVATION_M;
  const runs: AlertRun[] = [];
  const open = new Map<WeatherAlertKind, AlertRun>();

  daily.forEach((d, i) => {
    const hoursOfDay = hourly.filter(h => localDate(h.time) === d.date);
    const hits = dayHits(d, {
      rain24: rain24.get(d.date),
      hills,
      thunderHours: hoursOfDay.filter(h => isThunderCode(h.weatherCode)).length,
      hailHours: hoursOfDay.filter(h => isHailCode(h.weatherCode)).length,
    });
    for (const kind of Object.keys(ALERT_KEYS) as WeatherAlertKind[]) {
      const h = hits[kind];
      const run = open.get(kind);
      if (!h) {
        open.delete(kind);
        continue;
      }
      if (run && run.days[run.days.length - 1].date === daily[i - 1]?.date) {
        run.days.push(h);
      } else {
        const fresh: AlertRun = { kind, days: [h] };
        runs.push(fresh);
        open.set(kind, fresh);
      }
    }
  });
  return runs;
}

/** Worst day of a run: highest severity/variant, then the most extreme value. */
function worstDay(kind: WeatherAlertKind, days: DayHit[]): DayHit {
  return days.reduce((worst, h) => {
    const byLevel = hitLevel(h) - hitLevel(worst);
    if (byLevel !== 0) return byLevel > 0 ? h : worst;
    const worse = ALERT_KEYS[kind].worstIsMin ? h.value < worst.value : h.value > worst.value;
    return worse ? h : worst;
  });
}

function runToAlert({ kind, days }: AlertRun): WeatherAlert {
  const first = days[0];
  const last = days[days.length - 1];
  const worst = worstDay(kind, days);
  const when =
    first.date === last.date
      ? tNow('weather.when.day', { date: formatDate(first.date) })
      : tNow('weather.when.range', { range: formatDateRange(first.date, last.date) });
  const msgKey = kind === 'storm' && worst.variant === 'hail' ? 'weather.alert.hail.msg' : ALERT_KEYS[kind].msg;
  return {
    kind,
    severity: worst.severity,
    date: first.date,
    title: tNow(`weather.alert.${worst.variant}.title`),
    message: tNow(msgKey, { when, value: Math.round(worst.value) }),
  };
}

/**
 * Farm weather alerts from the 7-day / 48-hour forecast, using IMD definitions where they exist.
 * Consecutive days of the same kind merge into one alert (date = first day, worst severity/value).
 * Text is rendered in the current language with absolute dates.
 */
export function deriveAlerts(
  daily: DailyForecastExt[],
  hourly: HourlyForecast[],
  opts: { elevationM?: number } = {},
): WeatherAlert[] {
  return alertRuns(daily, hourly, opts)
    .map(runToAlert)
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || a.date.localeCompare(b.date));
}

/**
 * Push alerts for the next few days. Notified levels are remembered per kind, day and place, so a
 * day notifies again only when it is new to the alert or got worse (heavy → very heavy rain).
 */
function notifyAlerts(place: GeoPlace, runs: AlertRun[], today: string) {
  const loc = `${place.lat.toFixed(1)},${place.lon.toFixed(1)}`;
  const logKey = (kind: WeatherAlertKind, date: string) => `${kind}|${date}|${loc}`;
  const log: Record<string, number> = {};
  // Past days are dropped so the record stays small.
  for (const [k, level] of Object.entries(store.get<Record<string, number>>(NOTIFIED_STORE_KEY, {}))) {
    if ((k.split('|')[1] ?? '') >= today) log[k] = level;
  }

  for (const run of runs) {
    const horizon = addDays(today, (run.kind === 'storm' ? STORM_NOTIFY_HORIZON_DAYS : NOTIFY_HORIZON_DAYS) - 1);
    const days = run.days.filter(d => d.date >= today && d.date <= horizon);
    const newOrWorse = days.filter(d => (log[logKey(run.kind, d.date)] ?? 0) < hitLevel(d));
    if (!newOrWorse.length) continue;
    const alert = runToAlert({ kind: run.kind, days });
    const trigger = worstDay(run.kind, newOrWorse);
    const pushed = pushNotification({
      category: 'weather',
      priority: alert.severity,
      title: tNow('weather.notif.title', { title: alert.title, place: place.name }),
      body: alert.message,
      dedupeKey: `weather:${run.kind}:${trigger.date}:${trigger.variant}:${loc}`,
      target: { screen: 'weather' },
    });
    if (!pushed) continue;
    for (const d of days) log[logKey(run.kind, d.date)] = Math.max(log[logKey(run.kind, d.date)] ?? 0, hitLevel(d));
  }
  store.set(NOTIFIED_STORE_KEY, log);
}

// ---------- Viewing a (possibly cached) snapshot ----------

/**
 * The snapshot as it stands at `now`: days and hours that have passed are dropped, and spray advice
 * and alerts are worked out again for what is left, in the current language. useWeather and
 * getWeather return this view; the stored `spray` / `alerts` are only valid at `fetchedAt`.
 */
export function weatherView<T extends WeatherSnapshot>(snapshot: T, now = Date.now()): T {
  const today = placeToday(snapshot, now);
  const daily = snapshot.daily.filter(d => d.date >= today) as DailyForecastExt[];
  const hourly = snapshot.hourly.filter(h => Date.parse(h.time) + HOUR > now);
  return {
    ...snapshot,
    daily,
    hourly,
    spray: sprayAdvice(daily, hourly, now),
    alerts: deriveAlerts(daily, hourly, { elevationM: (snapshot as unknown as StoredWeather).elevationM }),
  };
}

/** Re-renders at each VIEW_TICK_MS boundary so views of cached data follow the clock. */
function useClockTick(stepMs: number): number {
  const [tick, setTick] = useState(() => Math.floor(Date.now() / stepMs));
  useEffect(() => {
    const id = setTimeout(() => setTick(Math.floor(Date.now() / stepMs)), stepMs - (Date.now() % stepMs) + 1000);
    return () => clearTimeout(id);
  }, [tick, stepMs]);
  return tick;
}

// ---------- Fetching ----------

type Series = (number | null)[];

interface OpenMeteoForecast {
  utc_offset_seconds?: number;
  elevation?: number;
  current?: {
    time: string;
    temperature_2m: number | null;
    relative_humidity_2m: number | null;
    apparent_temperature: number | null;
    precipitation: number | null;
    weather_code: number | null;
    wind_speed_10m: number | null;
    wind_gusts_10m: number | null;
    is_day: number | null;
  };
  hourly?: {
    time: string[];
    temperature_2m: Series;
    precipitation_probability: Series;
    precipitation: Series;
    wind_speed_10m: Series;
    relative_humidity_2m: Series;
    weather_code: Series;
  };
  daily?: {
    time: string[];
    weather_code: Series;
    temperature_2m_max: Series;
    temperature_2m_min: Series;
    precipitation_probability_max: Series;
    precipitation_sum: Series;
    wind_speed_10m_max: Series;
    wind_gusts_10m_max: Series;
    sunrise: string[];
    sunset: string[];
    uv_index_max: Series;
  };
}

function fin(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}
const optNum = (x: number | null | undefined) => (fin(x) ? x : undefined);
const round1 = (n: number) => Math.round(n * 10) / 10;
/** All values present (none null), as numbers; undefined if any is missing. */
const allNums = (...xs: (number | null | undefined)[]): number[] | undefined => (xs.every(fin) ? (xs as number[]) : undefined);

async function getJSON<T>(url: string, { timeoutMs = REQUEST_TIMEOUT_MS, retries = 1 } = {}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (res.status >= 400 && res.status < 500) throw new WeatherError('bad-response', `HTTP ${res.status}`);
      if (!res.ok) throw new WeatherError('network', `HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (e) {
      // One retry for flaky rural connections; client errors will not fix themselves.
      const retryable = !(e instanceof WeatherError && e.code === 'bad-response');
      if (attempt >= retries || !retryable || !isOnline()) {
        throw e instanceof WeatherError ? e : new WeatherError('network', e instanceof Error ? e.message : String(e));
      }
      await new Promise(r => setTimeout(r, 1000));
    } finally {
      clearTimeout(timer);
    }
  }
}

function forecastUrl(place: GeoPlace): string {
  const params = new URLSearchParams({
    latitude: place.lat.toFixed(4),
    longitude: place.lon.toFixed(4),
    current:
      'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day',
    hourly: 'temperature_2m,precipitation_probability,precipitation,wind_speed_10m,relative_humidity_2m,weather_code',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,sunrise,sunset,uv_index_max',
    forecast_days: '7',
    forecast_hours: '48',
    wind_speed_unit: 'kmh',
    timezone: 'auto',
  });
  return `${FORECAST_URL}?${params}`;
}

/**
 * India NAQI estimate from Open-Meteo's modelled (CAMS) PM2.5 / PM10, averaged over the last 24 h as
 * CPCB requires. Undefined on any failure: AQI is a nice-to-have and never blocks the weather.
 */
async function fetchAqi(place: GeoPlace): Promise<number | undefined> {
  try {
    const params = new URLSearchParams({
      latitude: place.lat.toFixed(4),
      longitude: place.lon.toFixed(4),
      hourly: 'pm2_5,pm10',
      past_hours: '24',
      forecast_hours: '1',
      timezone: 'auto',
    });
    // Single short attempt: the forecast waits for this request, and AQI is optional.
    const body = await getJSON<{ hourly?: { pm2_5?: Series; pm10?: Series } }>(`${AIR_QUALITY_URL}?${params}`, {
      timeoutMs: AQI_TIMEOUT_MS,
      retries: 0,
    });
    const avg24 = (series: Series | undefined) => {
      const values = (series || []).slice(-24).filter(fin);
      return values.length >= NAQI_MIN_HOURS ? values.reduce((s, x) => s + x, 0) / values.length : undefined;
    };
    return naqiFromPm(avg24(body.hourly?.pm2_5), avg24(body.hourly?.pm10));
  } catch {
    return undefined;
  }
}

/** Map an Open-Meteo forecast to the app model (exported for tests / tooling). */
export function toWeatherSnapshot(
  place: GeoPlace,
  f: OpenMeteoForecast,
  aqi?: number,
  now = Date.now(),
): WeatherSnapshot {
  if (!f.current || !f.daily?.time?.length || !f.hourly?.time?.length) {
    throw new WeatherError('bad-response', 'Incomplete forecast');
  }
  const suffix = offsetSuffix(f.utc_offset_seconds ?? 0);

  // A day missing a core value ends the forecast there: a gap must never read as 0 °C, 0 mm or "sunny".
  const d = f.daily;
  const daily: DailyForecastExt[] = [];
  for (let i = 0; i < d.time.length; i++) {
    const core = allNums(
      d.weather_code[i],
      d.temperature_2m_max[i],
      d.temperature_2m_min[i],
      d.precipitation_probability_max[i],
      d.precipitation_sum[i],
      d.wind_speed_10m_max[i],
    );
    if (!core) break;
    const [code, tMax, tMin, rainProb, rainMm, windMax] = core;
    const gust = optNum(d.wind_gusts_10m_max[i]);
    daily.push({
      date: d.time[i],
      weatherCode: code,
      tempMaxC: round1(tMax),
      tempMinC: round1(tMin),
      rainProbabilityPct: Math.round(rainProb),
      rainMm: round1(rainMm),
      windMaxKmh: Math.round(windMax),
      ...(gust !== undefined ? { windGustMaxKmh: Math.round(gust) } : {}),
      sunrise: d.sunrise[i] ? withOffset(d.sunrise[i], suffix) : undefined,
      sunset: d.sunset[i] ? withOffset(d.sunset[i], suffix) : undefined,
      uvIndexMax: optNum(d.uv_index_max[i]),
    });
  }
  if (!daily.length) throw new WeatherError('bad-response', 'No complete forecast day');

  // Hours with a missing value are left out; spray advice treats such a gap as possible rain.
  const h = f.hourly;
  const hourly: HourlyForecast[] = [];
  h.time.forEach((time, i) => {
    const values = allNums(
      h.temperature_2m[i],
      h.precipitation_probability[i],
      h.precipitation[i],
      h.wind_speed_10m[i],
      h.relative_humidity_2m[i],
      h.weather_code[i],
    );
    if (!values) return;
    const [temp, rainProb, rainMm, wind, humidity, code] = values;
    hourly.push({
      time: withOffset(time, suffix),
      temperatureC: round1(temp),
      rainProbabilityPct: Math.round(rainProb),
      rainMm: round1(rainMm),
      windKmh: Math.round(wind),
      humidityPct: Math.round(humidity),
      weatherCode: code,
    });
  });

  const c = f.current;
  if (!fin(c.temperature_2m)) throw new WeatherError('bad-response', 'No current temperature');
  // When the current block lacks a field, this hour's forecast is the next-best real value.
  const hourIndex = h.time.indexOf(`${c.time.slice(0, 13)}:00`);
  const thisHour = (s: Series) => (hourIndex >= 0 ? optNum(s[hourIndex]) : undefined);
  const humidity = optNum(c.relative_humidity_2m) ?? thisHour(h.relative_humidity_2m);
  const wind = optNum(c.wind_speed_10m) ?? thisHour(h.wind_speed_10m);
  if (humidity === undefined || wind === undefined) throw new WeatherError('bad-response', 'Incomplete current weather');
  const gustNow = optNum(c.wind_gusts_10m);
  const today = daily.find(day => day.date === c.time.slice(0, 10));
  const current: CurrentWeather = {
    temperatureC: round1(c.temperature_2m),
    feelsLikeC: optNum(c.apparent_temperature),
    humidityPct: Math.round(humidity),
    windKmh: Math.round(wind),
    windGustKmh: gustNow === undefined ? undefined : Math.round(gustNow),
    precipitationMm: optNum(c.precipitation),
    weatherCode: optNum(c.weather_code) ?? thisHour(h.weather_code) ?? UNKNOWN_WEATHER_CODE,
    isDay: fin(c.is_day)
      ? c.is_day !== 0
      : today?.sunrise && today.sunset
        ? now >= Date.parse(today.sunrise) && now < Date.parse(today.sunset)
        : true,
  };

  const elevationM = optNum(f.elevation);
  const snapshot: StoredWeather = {
    place,
    fetchedAt: new Date(now).toISOString(),
    current,
    daily,
    hourly,
    ...(aqi !== undefined ? { aqi } : {}),
    ...(elevationM !== undefined ? { elevationM } : {}),
    alerts: deriveAlerts(daily, hourly, { elevationM }),
    spray: sprayAdvice(daily, hourly, now),
  };
  return snapshot;
}

async function loadWeather(place: GeoPlace): Promise<WeatherSnapshot> {
  if (!isOnline()) throw new WeatherError('offline');
  const [forecast, aqi] = await Promise.all([getJSON<OpenMeteoForecast>(forecastUrl(place)), fetchAqi(place)]);
  const now = Date.now();
  const snapshot = toWeatherSnapshot(place, forecast, aqi, now) as StoredWeather;
  notifyAlerts(place, alertRuns(snapshot.daily, snapshot.hourly, { elevationM: snapshot.elevationM }), placeToday(snapshot, now));
  return snapshot;
}

/** Cache name per ~1 km cell, so tiny GPS jitter reuses the same forecast. */
export const weatherCacheName = (place: GeoPlace) => `weather:${place.lat.toFixed(2)},${place.lon.toFixed(2)}`;

/**
 * Forecast for a place: cached copy while younger than 30 min, else a fresh fetch. On failure the
 * cached copy comes back with `error` set (show it as stale); with no cache the WeatherError is thrown.
 * `data` is weatherView(…) at call time. New or worsened alerts for the next days are pushed to the
 * notification center.
 */
export async function getWeather(place: GeoPlace, opts: { force?: boolean } = {}): Promise<CachedResult<WeatherSnapshot>> {
  const result = await fetchWithCache(weatherCacheName(place), () => loadWeather(place), {
    maxAgeMs: WEATHER_MAX_AGE_MS,
    force: opts.force,
  });
  return { ...result, data: weatherView(result.data) };
}

/**
 * React hook: weather for `place` (pass null to stay idle). See lib/cache Resource for the states.
 * `data` is always weatherView(…) for the current time and is re-worked every 15 minutes, so a
 * cached forecast never shows a past day as today.
 */
export function useWeather(place: GeoPlace | null | undefined): Resource<WeatherSnapshot> {
  const name = place ? weatherCacheName(place) : null;
  const resource = useResource(name, () => loadWeather(place as GeoPlace), { maxAgeMs: WEATHER_MAX_AGE_MS });
  const tick = useClockTick(VIEW_TICK_MS);
  const raw = resource.data;
  // `tick` is a dependency on purpose: the view must be rebuilt as the clock moves.
  const lang = useSettings()[0].languageCode;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tick/lang re-run the view on purpose
  const data = useMemo(() => (raw ? weatherView(raw, Date.now()) : undefined), [raw, tick, lang]);
  return { ...resource, data };
}
