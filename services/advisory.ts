// Personalised advice: "आज किसान के लिए" (Home) and per-crop advisory (आज / इस सप्ताह / इस महीने).
// Rule-based lines (weather alerts, spray window, due tasks) work offline and update live;
// AI lines are added on top when online and cached for the day.
import { useMemo } from 'react';
import { expectedHarvestForCrop, getCropInfo, isValidISODate, stageForCrop, timelineFor } from '../data/crops';
import { cropName } from '../data/crop-keys';
import { HOUR, fetchWithCache, useResource, type CachedResult } from '../lib/cache';
import { getPlace, getSettings, usePlace } from '../lib/app-state';
import { tNow } from '../lib/i18n';
import { addDays, todayISO } from '../lib/format';
import { KEYS, collection, store, useCollection } from '../lib/store';
import type { Crop, CropAdvisory, DailyRecommendation, FarmingTask, GeoPlace, TaskType, WeatherSnapshot } from '../types/models';
import { ai, v } from './ai';
import { dueBeforeCropAdded, taskText, tasksInRange, useTasks } from './tasks';
import { getWeather, useWeather } from './weather';
import './advisory-strings';

const placeKey = (p: GeoPlace) => `${p.lat.toFixed(1)},${p.lon.toFixed(1)}`;

/** Short weather summary for prompts. */
function weatherSummary(w?: WeatherSnapshot): string {
  if (!w) return 'Weather: unavailable.';
  const days = w.daily
    .slice(0, 4)
    .map(d => `${d.date}: ${Math.round(d.tempMinC)}–${Math.round(d.tempMaxC)}°C, rain ${d.rainProbabilityPct}% (${d.rainMm} mm), wind max ${Math.round(d.windMaxKmh)} km/h`)
    .join('; ');
  const alerts = w.alerts.map(a => `${a.kind} on ${a.date}`).join(', ') || 'none';
  return `Now ${Math.round(w.current.temperatureC)}°C, humidity ${w.current.humidityPct}%. Forecast: ${days}. Alerts: ${alerts}. Spray today: ${w.spray.suitable ? `suitable ${w.spray.bestWindow || ''}` : 'not suitable'}.`;
}

function cropSummary(c: Crop): string {
  const info = getCropInfo(c.cropKey);
  const st = stageForCrop(c);
  const tl = timelineFor(c);
  const name = info ? `${info.nameEn} (${info.nameHi})` : c.name;
  // Nursery crops count days from transplanting; say so, so the model reads "day N" correctly.
  const from = tl.profile.transplanted ? 'transplanting' : 'sowing';
  const planted = [c.sowingDate ? `${tl.profile.transplanted ? 'nursery sown' : 'sown'} ${c.sowingDate}` : '', c.transplantDate ? `transplanted ${c.transplantDate}` : '']
    .filter(Boolean)
    .join(', ');
  let timing = 'not sown yet (planned)';
  if (tl.day0 && st.stage === 'planned') timing = `${planted}; ${from} expected in ${-st.day} days`;
  else if (tl.day0) {
    const harvest = isValidISODate(c.expectedHarvestDate) ? c.expectedHarvestDate : expectedHarvestForCrop(c);
    timing = `${planted}, day ${st.day} after ${from}, ${tl.season} season, stage ${st.labelEn}${st.nextStage ? ` (next: ${st.nextStage.labelEn} in ${st.nextStage.inDays} days)` : ''}${harvest ? `, expected harvest ${harvest}` : ''}`;
  }
  const area = c.area > 0 ? `, ${c.area} ${c.unit}` : '';
  return `${name}${c.variety ? `, variety ${c.variety}` : ''}${area}, ${timing}${c.irrigation ? `, irrigation ${c.irrigation}` : ''}${c.soilType ? `, soil ${c.soilType}` : ''}`;
}

// ---------------- Daily recommendations (Home) ----------------

/** Offline, rule-based lines from weather + tasks. */
export function rulesDailyRecommendations(weather: WeatherSnapshot | undefined, tasks: FarmingTask[], today = todayISO()): DailyRecommendation[] {
  const out: DailyRecommendation[] = [];
  if (weather) {
    for (const a of weather.alerts.filter(a => a.date <= addDays(today, 2)).slice(0, 2)) {
      out.push({ kind: 'warn', text: `${a.title}: ${a.message}` });
    }
    out.push(
      weather.spray.suitable
        ? { kind: 'do', text: tNow('advisory.sprayOk', { window: weather.spray.bestWindow || tNow('common.today') }) }
        : { kind: 'warn', text: tNow('advisory.sprayNo', { reason: weather.spray.reason }) },
    );
    const tomorrow = weather.daily.find(d => d.date === addDays(today, 1));
    if (tomorrow && tomorrow.rainProbabilityPct >= 60 && !weather.alerts.some(a => a.kind === 'heavy-rain')) {
      out.push({ kind: 'warn', text: tNow('advisory.rainTomorrow', { pct: tomorrow.rainProbabilityPct }) });
    }
  }
  const overdue = tasksInRange(tasks, 'overdue', today);
  for (const t of [...tasksInRange(tasks, 'today', today), ...overdue].slice(0, 3)) {
    out.push({ kind: 'do', text: taskText(t).title, cropId: t.cropId });
  }
  return out;
}

interface AiLines {
  items: DailyRecommendation[];
}

async function aiDailyLines(crops: Crop[], place: GeoPlace): Promise<DailyRecommendation[]> {
  let weather: WeatherSnapshot | undefined;
  try {
    weather = (await getWeather(place)).data;
  } catch {
    /* advise without weather */
  }
  const { data } = await ai.generateJSON<AiLines>(
    {
      task: 'daily',
      system:
        'You write the "Today for the farmer" card: 2–3 short, specific, actionable lines for TODAY based on the crops, their stage and the weather. Each line ≤ 90 characters. No generic advice, no repetition of weather numbers already shown. Use "warn" only for real risks.',
      prompt: `Date: ${todayISO()}. Place: ${place.nameEn || place.name}, ${place.state || 'India'}.\n${weatherSummary(weather)}\nCrops:\n${crops
        .slice(0, 6)
        .map(c => `- [${c.id}] ${cropSummary(c)}`)
        .join('\n')}\nJSON shape: {"items":[{"kind":"do"|"warn"|"info","text":string,"cropId"?:string}]}`,
    },
    raw => {
      const items: DailyRecommendation[] = (Array.isArray(raw?.items) ? raw.items : [])
        .map((i: any) => ({
          kind: v.oneOf(i?.kind, ['do', 'warn', 'info'] as const, 'info'),
          text: v.str(i?.text),
          cropId: crops.some(c => c.id === i?.cropId) ? i.cropId : undefined,
        }))
        .filter((i: DailyRecommendation) => i.text)
        .slice(0, 3);
      if (!items.length) throw new Error('no items');
      return { items };
    },
  );
  return data.items;
}

/**
 * Home "आज किसान के लिए": live rule-based lines + cached AI lines.
 * `items` is never empty when weather or tasks exist; `aiLoading` only affects the AI part.
 */
export function useDailyRecommendations() {
  const [place] = usePlace();
  const weather = useWeather(place);
  const { tasks } = useTasks();
  const crops = useCollection<Crop>(KEYS.crops).items;
  const lang = getSettings().languageCode;
  const rules = useMemo(() => rulesDailyRecommendations(weather.data, tasks).slice(0, 4), [weather.data, tasks, lang]);
  const sig = crops.map(c => `${c.id}:${c.updatedAt}`).join('|');
  const aiName = ai.available() && crops.length ? `daily-ai:${todayISO()}:${placeKey(place)}:${lang}:${sig}` : null;
  const aiRes = useResource(aiName, () => aiDailyLines(crops, place), { maxAgeMs: 12 * HOUR });
  const items = useMemo(() => {
    const seen = new Set<string>();
    return [...rules, ...(aiRes.data || [])].filter(i => !seen.has(i.text) && seen.add(i.text)).slice(0, 7);
  }, [rules, aiRes.data]);
  return {
    items,
    hasCrops: crops.length > 0,
    weatherLoading: weather.loading,
    aiLoading: aiRes.loading || aiRes.refreshing,
    aiError: aiRes.error,
    fetchedAt: aiRes.fetchedAt ?? weather.fetchedAt,
    refresh: async () => {
      await Promise.all([weather.refresh(), aiName ? aiRes.refresh() : Promise.resolve()]);
    },
  };
}

// ---------------- Per-crop advisory ----------------

/** A missed task older than this is no longer "today" advice (farmers rarely tick tasks off). */
const OVERDUE_ADVICE_DAYS = 7;
/** Missed sowing / seed treatment is history once the crop has a date, not work for today. */
const NOT_OVERDUE_ADVICE: readonly TaskType[] = ['sowing', 'seed-treatment'];

/**
 * A crop's open calendar tasks for each advice tab: today (recently missed ones first, then
 * today's), the rest of this week, and the rest of the next 30 days. Pass the crop's own tasks
 * without the ones that were history when it was added. The crop screens match rule-based lines
 * back to tasks with this, so both always use the same windows.
 */
export function adviceTaskWindows(cropTasks: FarmingTask[], today = todayISO()): { today: FarmingTask[]; week: FarmingTask[]; month: FarmingTask[] } {
  const from = addDays(today, -OVERDUE_ADVICE_DAYS);
  const recent = tasksInRange(cropTasks, 'overdue', today).filter(t => t.dueDate >= from && !NOT_OVERDUE_ADVICE.includes(t.type));
  const todayList = [...recent, ...tasksInRange(cropTasks, 'today', today)];
  const week = tasksInRange(cropTasks, 'week', today).filter(t => !todayList.includes(t));
  const month = tasksInRange(cropTasks, 'month', today).filter(t => !week.includes(t) && !todayList.includes(t));
  return { today: todayList, week, month };
}

/** Offline advisory from the crop's calendar tasks and weather alerts. */
export function rulesCropAdvisory(crop: Crop, allTasks: FarmingTask[], weather?: WeatherSnapshot, today = todayISO()): CropAdvisory {
  // Auto tasks dated before the crop was added (field prep, sowing… for a crop entered weeks
  // after sowing) are history, not pending work.
  const mine = allTasks.filter(t => t.cropId === crop.id && !dueBeforeCropAdded(t, crop));
  const titles = (list: FarmingTask[]) => list.map(t => taskText(t).title);
  const windows = adviceTaskWindows(mine, today);
  // The most urgent open task: a recently missed one (last 7 days) before anything upcoming.
  const next = [...tasksInRange(mine, 'overdue', today).filter(t => t.dueDate >= addDays(today, -OVERDUE_ADVICE_DAYS)), ...tasksInRange(mine, 'month', today)][0];
  const risks = (weather?.alerts || []).slice(0, 3).map(a => ({ level: a.severity === 'urgent' ? ('high' as const) : ('medium' as const), text: `${a.title}: ${a.message}` }));
  // A spray window only matters while the crop is standing in the field.
  const stage = stageForCrop(crop, today).stage;
  const inField = stage !== 'planned' && stage !== 'harvested';
  const sprayLine = weather && inField
    ? weather.spray.suitable
      ? tNow('advisory.sprayOk', { window: weather.spray.bestWindow || tNow('common.today') })
      : tNow('advisory.sprayNo', { reason: weather.spray.reason })
    : undefined;
  return {
    id: `rules:${crop.id}:${today}`,
    cropId: crop.id,
    generatedAt: new Date().toISOString(),
    today: [...titles(windows.today), ...(sprayLine ? [sprayLine] : [])],
    thisWeek: titles(windows.week),
    thisMonth: titles(windows.month),
    nextTask: next ? { title: taskText(next).title, due: next.dueDate } : undefined,
    risks,
    source: 'rules',
  };
}

interface AiAdvice {
  today: string[];
  thisWeek: string[];
  thisMonth: string[];
  nextTask?: { title: string; due?: string };
  risks: { level: 'low' | 'medium' | 'high'; text: string }[];
  health?: { status: 'good' | 'watch' | 'risk'; note: string };
}

/** Short, stable hash for cache names. */
function shortHash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Cache name for a crop's AI advisory: per crop, day and language, keyed on the details that
 * change the advice (not updatedAt, so fixing a typo in the notes does not start a new AI call).
 */
function advisoryCacheName(crop: Crop, place: GeoPlace = crop.place || getPlace()): string {
  const facts = [
    crop.cropKey,
    getCropInfo(crop.cropKey) ? '' : crop.name,
    crop.variety,
    crop.area > 0 ? `${crop.area}${crop.unit}` : '',
    crop.sowingDate,
    crop.transplantDate,
    crop.season,
    crop.expectedHarvestDate,
    crop.irrigation,
    crop.soilType,
    placeKey(place),
  ];
  return `advisory:${crop.id}:${todayISO()}:${getSettings().languageCode}:${shortHash(facts.map(f => f ?? '').join('|'))}`;
}

/** Last advisory cache name per crop, so an outdated entry is dropped instead of piling up. */
const ADVISORY_NAMES_KEY = 'advisory.cacheNames';

function rememberAdvisoryName(cropId: string, name: string) {
  const names = store.get<Record<string, string>>(ADVISORY_NAMES_KEY, {});
  const previous = names[cropId];
  if (previous === name) return;
  if (previous) store.remove(store.cacheKey(previous));
  store.set(ADVISORY_NAMES_KEY, { ...names, [cropId]: name });
}

/** Uncached AI call for one crop's advisory. */
async function loadCropAdvisory(crop: Crop): Promise<CropAdvisory> {
  const place = crop.place || getPlace();
  const name = advisoryCacheName(crop);
  let weather: WeatherSnapshot | undefined;
  try {
    weather = (await getWeather(place)).data;
  } catch {
    /* without weather */
  }
  const upcoming = collection<FarmingTask>(KEYS.tasks)
    .all()
    .filter(t => t.cropId === crop.id && !t.done && !dueBeforeCropAdded(t, crop) && t.dueDate >= addDays(todayISO(), -7) && t.dueDate <= addDays(todayISO(), 30))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 12)
    .map(t => `${t.dueDate}: ${taskText(t, 'en').title}`)
    .join('\n');
  const info = getCropInfo(crop.cropKey);
  const { data } = await ai.generateJSON<AiAdvice>(
    {
      task: 'advisory',
      system:
        'You are an agronomist giving a personalised crop advisory for an Indian smallholder. Be specific to the crop stage, weather and local season. Each line is one short imperative sentence (≤ 110 characters). Fertilizer guidance must be general and defer to the soil test / local agronomist.',
      prompt: `Date: ${todayISO()}. Place: ${place.nameEn || place.name}, ${place.state || 'India'}.\nCrop: ${cropSummary(crop)}.\n${info ? `Critical irrigation stages: ${info.criticalIrrigationEn.join('; ')}.` : ''}\n${weatherSummary(weather)}\nPlanned calendar tasks:\n${upcoming || 'none'}\n\nReturn JSON: {"today":[2-4 lines],"thisWeek":[2-4 lines],"thisMonth":[2-4 lines],"nextTask":{"title":string,"due":"YYYY-MM-DD"},"risks":[{"level":"low"|"medium"|"high","text":string}],"health":{"status":"good"|"watch"|"risk","note":string}}`,
    },
    raw => {
      const r: AiAdvice = {
        today: v.strArr(raw?.today, 5),
        thisWeek: v.strArr(raw?.thisWeek, 5),
        thisMonth: v.strArr(raw?.thisMonth, 5),
        nextTask: raw?.nextTask && v.str(raw.nextTask.title) ? { title: v.str(raw.nextTask.title), due: /^\d{4}-\d{2}-\d{2}$/.test(raw.nextTask.due) ? raw.nextTask.due : undefined } : undefined,
        risks: (Array.isArray(raw?.risks) ? raw.risks : [])
          .map((x: any) => ({ level: v.oneOf(x?.level, ['low', 'medium', 'high'] as const, 'medium'), text: v.str(x?.text) }))
          .filter((x: { text: string }) => x.text)
          .slice(0, 4),
        health: raw?.health && v.str(raw.health.note) ? { status: v.oneOf(raw.health.status, ['good', 'watch', 'risk'] as const, 'watch'), note: v.str(raw.health.note) } : undefined,
      };
      if (!r.today.length && !r.thisWeek.length) throw new Error('empty advisory');
      return r;
    },
  );
  const advisory: CropAdvisory = { id: name, cropId: crop.id, generatedAt: new Date().toISOString(), source: 'ai', ...data };
  rememberAdvisoryName(crop.id, name);
  return advisory;
}

/** AI advisory for one crop, cached per crop per day (refetch with force). Throws AIError offline. */
export function getCropAdvisory(crop: Crop, opts: { force?: boolean } = {}): Promise<CachedResult<CropAdvisory>> {
  return fetchWithCache(advisoryCacheName(crop), () => loadCropAdvisory(crop), { maxAgeMs: 12 * HOUR, force: opts.force });
}

/** Hook: AI advisory with a live rule-based fallback (`fallback`) when AI is unavailable. */
export function useCropAdvisory(crop: Crop | undefined) {
  const { tasks } = useTasks();
  const [appPlace] = usePlace();
  const place = crop?.place || appPlace;
  const weather = useWeather(place);
  const name = crop && ai.available() ? advisoryCacheName(crop, place) : null;
  const res = useResource(name, () => loadCropAdvisory(crop as Crop), { maxAgeMs: 12 * HOUR });
  // The date is a dependency so a screen left open past midnight rolls over on its next render.
  const today = todayISO();
  const fallback = useMemo(() => (crop ? rulesCropAdvisory(crop, tasks, weather.data, today) : undefined), [crop, tasks, weather.data, today]);
  return { ...res, fallback, advisory: res.data || fallback };
}

/** Display name helper used in advisory lines. */
export const cropDisplayName = (c: Crop) => c.name || cropName(c.cropKey, getSettings().languageCode);
