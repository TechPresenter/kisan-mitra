// Pure helpers for the My Crops module: labels, stage colours, harvest/progress maths,
// advice topics (coloured round icons) and stage-aware weather risks. No React here.
import {
  Bean,
  Bug,
  CloudLightning,
  CloudRain,
  CloudSun,
  Droplets,
  FlaskConical,
  Leaf,
  ShieldCheck,
  Shovel,
  Snowflake,
  SprayCan,
  Sprout,
  Thermometer,
  TriangleAlert,
  Wheat,
  Wind,
} from 'lucide-react';
import type { IconLike, Tone } from '../../components/ui';
import { CROP_NAMES, cropName, isCropKey } from '../../data/crop-keys';
import { STAGE_NAMES, catalogText, expectedHarvestForCrop, getCropInfo, isValidISODate, timelineFor, type StageStatus } from '../../data/crops';
import { addDays, daysBetween, formatDate, formatNumber, toISODate, todayISO } from '../../lib/format';
import type { TFunction } from '../../lib/i18n';
import type { Route } from '../../lib/nav';
import { adviceTaskWindows } from '../../services/advisory';
import { dueBeforeCropAdded, taskText } from '../../services/tasks';
import { AIError, toPlainText } from '../../services/ai';
import type { DailyForecastExt } from '../../services/weather';
import type {
  AreaUnit,
  Crop,
  CropAdvisory,
  CropDiagnosis,
  CropStage,
  FarmingTask,
  GeoPlace,
  ISODate,
  IrrigationType,
  RiskLevel,
  SoilType,
  TaskType,
  WeatherAlertKind,
  WeatherSnapshot,
} from '../../types/models';

export const AREA_UNITS: AreaUnit[] = ['acre', 'bigha', 'hectare'];
export const SOIL_TYPES: SoilType[] = ['alluvial', 'loamy', 'black', 'red', 'sandy', 'clay', 'laterite', 'unknown'];
export const IRRIGATION_TYPES: IrrigationType[] = ['tubewell', 'canal', 'drip', 'sprinkler', 'pond', 'rainfed', 'other'];

const SQM_PER_ACRE = 4046.86;
const ACRES_PER_HECTARE = 2.471;

// ---------- Names, areas, dates ----------

/** Crop name in the UI language; a farmer-typed name (or an 'other' crop) is shown as typed. */
export function cropLabel(crop: Pick<Crop, 'cropKey' | 'name'>, lang: string): string {
  const key = crop.cropKey;
  if (isCropKey(key)) {
    const names = CROP_NAMES[key];
    if (!crop.name || crop.name === names.hi || crop.name === names.en) return cropName(key, lang);
  }
  return crop.name || cropName(key, lang);
}

/** "2 एकड़", "1.5 बीघा", "3 hectares"; "रकबा नहीं डाला" when onboarding skipped the land question. */
export function areaText(area: number, unit: AreaUnit, t: TFunction): string {
  if (!(area > 0)) return t('crops.area.notSet');
  const n = formatNumber(area);
  return t(area === 1 ? `crops.area.one.${unit}` : `crops.area.${unit}`, { n });
}

export function toAcres(area: number, unit: AreaUnit, bighaSqm: number): number {
  if (unit === 'hectare') return area * ACRES_PER_HECTARE;
  if (unit === 'bigha') return (area * bighaSqm) / SQM_PER_ACRE;
  return area;
}

/** "कुल ज़मीन: 5.5 एकड़" (same unit) or "कुल ज़मीन: लगभग 6.2 एकड़" (mixed units, in acres). */
export function totalAreaText(crops: Crop[], bighaSqm: number, t: TFunction): string | null {
  const valid = crops.filter(c => Number.isFinite(c.area) && c.area > 0);
  if (!valid.length) return null;
  const units = new Set(valid.map(c => c.unit));
  if (units.size === 1) {
    const unit = valid[0].unit;
    const sum = Math.round(valid.reduce((s, c) => s + c.area, 0) * 100) / 100;
    return t('crops.totalArea', { area: areaText(sum, unit, t) });
  }
  const acres = Math.round(valid.reduce((s, c) => s + toAcres(c.area, c.unit, bighaSqm), 0) * 10) / 10;
  return t('crops.totalAreaApprox', { area: areaText(acres, 'acre', t) });
}

/** Colour of each stage (list rows, header line, timeline). */
export const STAGE_TONE: Record<CropStage, Tone> = {
  planned: 'gray',
  germination: 'teal',
  vegetative: 'green',
  flowering: 'rose',
  fruiting: 'orange',
  maturity: 'amber',
  harvested: 'indigo',
};

/** Short stage name: "बढ़वार", "फूल"… ("रोपाई से पहले" for a nursery crop before transplanting). */
export function stageShort(status: StageStatus, lang: string): string {
  if (status.stage === 'planned') return catalogText(lang, status.labelHi, status.labelEn);
  const n = STAGE_NAMES[status.stage];
  return catalogText(lang, n.hi, n.en);
}

/** "बढ़वार अवस्था" (or just "बुवाई से पहले" / "कटाई हो चुकी"). */
export function stagePhrase(status: StageStatus, lang: string, t: TFunction): string {
  const short = stageShort(status, lang);
  return status.stage === 'planned' || status.stage === 'harvested' ? short : t('crops.stageWithSuffix', { stage: short });
}

/** Detailed sub-stage name from the catalog, e.g. "कल्ले निकलना (Tillering)". */
export const subStageLabel = (s: { labelHi: string; labelEn: string }, lang: string) => catalogText(lang, s.labelHi, s.labelEn);

export const isNurseryCrop = (cropKey: string) => !!getCropInfo(cropKey)?.transplanted;

/** "बुवाई: 15 नवंबर 2024" / "रोपाई: …" / "बुवाई की तारीख नहीं डाली". */
export function plantingLine(crop: Crop, t: TFunction): string {
  const fmt = (d: string) => formatDate(d, { year: true });
  if (isNurseryCrop(crop.cropKey)) {
    if (isValidISODate(crop.transplantDate)) return t('crops.transplanted', { date: fmt(crop.transplantDate) });
    if (isValidISODate(crop.sowingDate)) return t('crops.nurserySown', { date: fmt(crop.sowingDate) });
    return t('crops.noTransplantDate');
  }
  if (isValidISODate(crop.sowingDate)) return t('crops.sown', { date: fmt(crop.sowingDate) });
  if (isValidISODate(crop.transplantDate)) return t('crops.transplanted', { date: fmt(crop.transplantDate) });
  return t('crops.noSowingDate');
}

/** The farmer's own harvest date when set, else the catalog estimate. */
export function effectiveHarvest(crop: Crop): ISODate | undefined {
  return isValidISODate(crop.expectedHarvestDate) ? crop.expectedHarvestDate : expectedHarvestForCrop(crop);
}

export interface CropProgress {
  day0?: ISODate;
  harvest?: ISODate;
  /** Day after day 0 (sowing or transplanting). */
  day: number;
  /** 0–100 towards the (effective) harvest date. */
  pct: number;
  /** Days from today to the harvest date; negative once it has passed. */
  daysLeft?: number;
}

/** Progress against the harvest date the farmer sees, so % and "days left" always agree. */
export function cropProgress(crop: Crop, status: StageStatus, today = todayISO()): CropProgress {
  const { day0 } = timelineFor(crop);
  const harvest = effectiveHarvest(crop);
  if (!day0 || !harvest) return { day0, harvest, day: status.day, pct: status.progressPct, daysLeft: harvest ? daysBetween(today, harvest) : undefined };
  const total = Math.max(1, daysBetween(day0, harvest));
  const day = daysBetween(day0, today);
  const pct = Math.max(0, Math.min(100, Math.round((day / total) * 100)));
  return { day0, harvest, day, pct, daysLeft: daysBetween(today, harvest) };
}

/** Local calendar date (YYYY-MM-DD) of a stored timestamp; createdAt is UTC, so slicing it is wrong in IST before 05:30. */
export function localDay(isoTime: string): ISODate {
  const d = new Date(isoTime);
  return Number.isNaN(d.getTime()) ? isoTime.slice(0, 10) : toISODate(d);
}

/**
 * This crop's tasks that still matter. Auto tasks dated before the crop was added (field prep,
 * sowing… for a crop entered weeks after sowing) are history, not pending work, so they are left
 * out of "next task" and advice (services/tasks.dueBeforeCropAdded, which uses the local date).
 */
export function activeCropTasks(all: FarmingTask[], crop: Crop): FarmingTask[] {
  return all.filter(x => x.cropId === crop.id && !dueBeforeCropAdded(x, crop));
}

/** "आज करना है" / "3 दिन बाद" / "2 दिन से बाकी". */
export function dueLabel(due: ISODate, t: TFunction, today = todayISO()): string {
  const diff = daysBetween(today, due);
  if (diff === 0) return t('crops.task.due.today');
  if (diff === 1) return t('crops.task.due.tomorrow');
  if (diff > 1) return t('crops.task.due.inDays', { n: diff });
  return t('crops.task.due.overdue', { n: -diff });
}

/** "आज" / "कल" / "7 अक्टूबर को" for weather risk lines. */
function whenText(date: ISODate, t: TFunction, today: ISODate): string {
  const diff = daysBetween(today, date);
  if (diff <= 0) return t('crops.when.today');
  if (diff === 1) return t('crops.when.tomorrow');
  return t('crops.when.on', { date: formatDate(date) });
}

// ---------- Diagnoses ----------

/** Photo checks this many days before the crop started (nursery, field prep) still count. */
const DIAGNOSIS_LEAD_DAYS = 14;

/**
 * Latest usable photo diagnosis for this crop (matched by catalog key; by name for 'other').
 * Checks from before this crop was planted (e.g. last season's wheat) are skipped.
 */
export function latestDiagnosis(list: CropDiagnosis[], crop: Crop): CropDiagnosis | undefined {
  const dates = [crop.sowingDate, crop.transplantDate, timelineFor(crop).day0].filter((d): d is ISODate => isValidISODate(d)).sort();
  const start = dates[0] ?? localDay(crop.createdAt);
  const from = addDays(start, -DIAGNOSIS_LEAD_DAYS);
  let best: CropDiagnosis | undefined;
  for (const d of list) {
    if (d.unusableReason) continue;
    if (d.cropKey !== crop.cropKey) continue;
    if (!isCropKey(crop.cropKey) && d.cropName && crop.name && d.cropName.trim() !== crop.name.trim()) continue;
    if (localDay(d.createdAt) < from) continue;
    if (!best || d.createdAt > best.createdAt) best = d;
  }
  return best;
}

/** A diagnosis older than this is shown as "पुरानी जांच". */
export const DIAGNOSIS_FRESH_DAYS = 21;

export const diagnosisAgeDays = (d: CropDiagnosis, today = todayISO()) => daysBetween(localDay(d.createdAt), today);

// ---------- Advice topics ----------

export type TopicKey =
  | 'irrigation'
  | 'pest'
  | 'protection'
  | 'fertilizer'
  | 'weather'
  | 'weatherInfo'
  | 'weeding'
  | 'spray'
  | 'sowing'
  | 'seed'
  | 'harvest'
  | 'general';

export interface Topic {
  key: TopicKey;
  icon: IconLike;
  tone: Tone;
}

export const TOPICS: Record<TopicKey, Topic> = {
  irrigation: { key: 'irrigation', icon: Droplets, tone: 'sky' },
  pest: { key: 'pest', icon: Bug, tone: 'orange' },
  protection: { key: 'protection', icon: ShieldCheck, tone: 'rose' },
  fertilizer: { key: 'fertilizer', icon: FlaskConical, tone: 'indigo' },
  weather: { key: 'weather', icon: CloudLightning, tone: 'red' },
  weatherInfo: { key: 'weatherInfo', icon: CloudSun, tone: 'sky' },
  weeding: { key: 'weeding', icon: Shovel, tone: 'green' },
  spray: { key: 'spray', icon: SprayCan, tone: 'teal' },
  sowing: { key: 'sowing', icon: Sprout, tone: 'green' },
  seed: { key: 'seed', icon: Bean, tone: 'teal' },
  harvest: { key: 'harvest', icon: Wheat, tone: 'amber' },
  general: { key: 'general', icon: Leaf, tone: 'green' },
};

const TASK_TOPIC: Record<TaskType, TopicKey> = {
  'seed-treatment': 'seed',
  sowing: 'sowing',
  irrigation: 'irrigation',
  fertilizer: 'fertilizer',
  'pest-scouting': 'pest',
  'crop-protection': 'protection',
  weeding: 'weeding',
  harvest: 'harvest',
  other: 'general',
};

const FERTILIZER_RE =
  /(खाद|उर्वरक|यूरिया|डीएपी|डी\.ए\.पी|पोटाश|नाइट्रोजन|फॉस्फोरस|फास्फोरस|जिंक|ज़िंक|सल्फर|गंधक|बोरॉन|एनपीके|गोबर|कम्पोस्ट|कंपोस्ट|वर्मी|\bNPK\b|\bDAP\b|\bMOP\b|\bSSP\b|\burea\b|\bfertili[sz]|\bnitrogen|\bphosph|\bpotash|\bpotassium|\bzinc\b|\bsulph|\bsulfur|\bboron\b|\bmanure|\bcompost)/i;

// First match wins, so the order encodes priority (a spray-window line mentions कीटनाशक too).
// English words are bounded (\b) so "wheat" is not heat, "grain" not rain, "window" not wind.
// Only real warnings get the red "मौसम चेतावनी"; a plain weather line ("आज मौसम साफ रहेगा") is
// the neutral "मौसम".
const TOPIC_RULES: [TopicKey, RegExp][] = [
  ['weather', /(चेतावनी|भारी बारिश|तेज़ बारिश|तेज बारिश|आंधी|आँधी|तूफ़ान|तूफान|ओला|ओले|पाला|पाले|(?:^|\s)लू(?=[\s,।]|$)|शीतलहर|शीत लहर|\bheavy rain|\bthunder|\bstorm|\bhail|\bfrost|\bheat ?wave|\bcold ?wave|\bstrong winds?\b|\bwarning)/i],
  ['spray', /(छिड़काव के लिए|छिड़काव न करें|छिड़काव टालें|\bgood time to spray|\bavoid spraying|\bspray window)/i],
  ['fertilizer', FERTILIZER_RE],
  ['pest', /(कीट|इल्ली|सुंडी|माहू|चेपा|तेला|मक्खी|दीमक|बेधक|फुदका|थ्रिप्स|फेरोमोन|ट्रैप|निगरानी|\bpest|\binsect|\baphids?\b|\bborers?\b|\bworms?\b|\bwhitefl|\btermites?\b|\bjassids?\b|\bthrips\b|\bcaterpillars?\b|\btraps?\b|\bscout)/i],
  ['protection', /(रोग|फफूंद|फफूँद|झुलसा|रतुआ|गेरुई|धब्बे|सड़न|उकठा|विषाणु|वायरस|\bdisease|\bfung|\bblight|\brust\b|\brot\b|\bwilt|\bmildew|\bvirus|\bleaf spots?\b)/i],
  ['spray', /(छिड़काव|छिड़कें|स्प्रे|\bspray)/i],
  ['irrigation', /(सिंचाई|पानी|नमी|\birrigat|\bwater|\bmoist)/i],
  ['weeding', /(निराई|गुड़ाई|खरपतवार|\bweed|\bhoe(?:ing)?\b)/i],
  ['seed', /(बीज उपचार|\bseed treat)/i],
  ['sowing', /(बुवाई|रोपाई|नर्सरी|पौध तैयार|पौधशाला|बीज|\bsow|\btransplant|\bnursery|\bseed)/i],
  ['harvest', /(कटाई|तुड़ाई|खुदाई|\bharvest|\bpicking\b)/i],
  ['weatherInfo', /(बारिश|वर्षा|मौसम|तापमान|गर्मी|ठंड|हवा|\brain(?:s|y|fall)?\b|\bweather|\btemperature|\bheat\b|\bcold\b|\bwinds?\b|\bwindy\b)/i],
];

export function topicForText(text: string): Topic {
  for (const [key, re] of TOPIC_RULES) if (re.test(text)) return TOPICS[key];
  return TOPICS.general;
}

export const topicForTask = (type: TaskType): Topic => TOPICS[TASK_TOPIC[type] ?? 'general'];

export const mentionsFertilizer = (text: string) => FERTILIZER_RE.test(text);

// ---------- Advice rows ----------

export type AdviceTab = 'today' | 'week' | 'month';
export const ADVICE_TABS: AdviceTab[] = ['today', 'week', 'month'];

export interface AdviceItem {
  key: string;
  topic: Topic;
  title: string;
  desc: string;
  /** Set when the line is a calendar task. */
  task?: FarmingTask;
}

export function adviceLines(advisory: CropAdvisory | undefined, tab: AdviceTab): string[] {
  if (!advisory) return [];
  const raw = tab === 'today' ? advisory.today : tab === 'week' ? advisory.thisWeek : advisory.thisMonth || [];
  return raw.map(l => toPlainText(l)).filter(Boolean);
}

/**
 * Rows for one tab. Rule-based lines are task titles, so they are matched back to the crop's
 * tasks for the right topic, a description and the due date; AI lines get a topic from keywords.
 */
export function adviceItems(advisory: CropAdvisory | undefined, tab: AdviceTab, cropTasks: FarmingTask[], t: TFunction, today = todayISO()): AdviceItem[] {
  const lines = adviceLines(advisory, tab);
  // Same-titled tasks (e.g. two irrigations) are handed out in due-date order, like the lines.
  const byTitle = new Map<string, FarmingTask[]>();
  if (advisory?.source === 'rules') {
    // Exactly the lists rulesCropAdvisory made the lines from, in the same order.
    const open = adviceTaskWindows(cropTasks, today)[tab];
    for (const task of open) {
      const title = taskText(task).title;
      byTitle.set(title, [...(byTitle.get(title) || []), task]);
    }
  }
  return lines.map((line, i) => {
    const task = byTitle.get(line)?.shift();
    if (task) {
      const { title, desc } = taskText(task);
      return { key: `${tab}-${i}-${task.id}`, topic: topicForTask(task.type), title, desc: desc || t(`crops.topic.${TASK_TOPIC[task.type] ?? 'general'}`), task };
    }
    const topic = topicForText(line);
    return { key: `${tab}-${i}`, topic, title: t(`crops.topic.${topic.key}`), desc: line };
  });
}

// ---------- Weather risks ----------

export interface CropRisk {
  id: string;
  level: RiskLevel;
  title: string;
  text: string;
  icon: IconLike;
}

export const RISK_TONE: Record<RiskLevel, Tone> = { high: 'red', medium: 'orange', low: 'amber' };
const RISK_ORDER: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };

const wet = (d: DailyForecastExt) => d.rainMm >= 10 || (d.rainProbabilityPct >= 60 && d.rainMm >= 2.5);
const gust = (d: DailyForecastExt) => Math.max(d.windMaxKmh || 0, d.windGustMaxKmh || 0);

/** Crops that grow tall and lodge (fall over) in wind near grain filling. */
const LODGING_CATEGORIES = new Set(['cereal', 'millet']);

/** Forecast alerts that already cover a stage rule, so the same event is not listed twice. */
const STAGE_RULE_COVERED_BY: Record<string, WeatherAlertKind[]> = {
  'stage:frost': ['frost', 'cold-wave'],
  'stage:heat': ['heatwave'],
  'stage:germ-rain': ['heavy-rain', 'storm'],
  'stage:flower-rain': ['heavy-rain', 'storm'],
  'stage:mature-rain': ['heavy-rain', 'storm'],
  'stage:wind': ['strong-wind', 'storm'],
};

/**
 * Weather risks for this crop over the next 3 days: the forecast's own alerts (optional) plus
 * stage rules — rain at flowering, heat or frost at flowering/grain filling, rain on a ripe
 * crop, wind lodging, wet spells. Works only on the given (current) weather view.
 */
export function cropWeatherRisks(
  crop: Crop,
  status: StageStatus,
  weather: WeatherSnapshot | undefined,
  t: TFunction,
  opts: { alerts?: boolean | 'urgent'; today?: ISODate } = {},
): CropRisk[] {
  if (!weather) return [];
  const today = opts.today ?? todayISO();
  const out: CropRisk[] = [];
  const alertKinds = new Set<WeatherAlertKind>();
  if (opts.alerts) {
    for (const a of weather.alerts) {
      if (daysBetween(today, a.date) > 2) continue;
      if (opts.alerts === 'urgent' && a.severity !== 'urgent') continue;
      const icon = a.kind === 'frost' || a.kind === 'cold-wave' ? Snowflake : a.kind === 'heatwave' ? Thermometer : a.kind === 'strong-wind' ? Wind : a.kind === 'heavy-rain' ? CloudRain : CloudLightning;
      out.push({ id: `alert:${a.kind}:${a.date}`, level: a.severity === 'urgent' ? 'high' : 'medium', title: a.title, text: a.message, icon });
      alertKinds.add(a.kind);
    }
  }
  const stage = status.stage;
  if (stage === 'planned' || stage === 'harvested') return out;
  const days = (weather.daily as DailyForecastExt[]).filter(d => d.date >= today).slice(0, 3);
  if (!days.length) return out;
  // One row per event: a stage rule is left out when a forecast alert shown above covers it.
  const covered = (id: string) => (STAGE_RULE_COVERED_BY[id] || []).some(k => alertKinds.has(k));
  const push = (risk: CropRisk) => {
    if (!covered(risk.id)) out.push(risk);
  };
  const day = (d: DailyForecastExt) => whenText(d.date, t, today);
  const info = getCropInfo(crop.cropKey);
  const season = timelineFor(crop).season;
  const firstWet = days.find(wet);
  const rainyCount = days.filter(d => d.rainProbabilityPct >= 50).length;

  if (stage === 'germination') {
    const heavy = days.find(d => d.rainMm >= 25) || (days.filter(wet).length >= 2 ? firstWet : undefined);
    if (heavy) push({ id: 'stage:germ-rain', level: 'medium', title: t('crops.risk.germRain.title'), text: t('crops.risk.germRain.text', { day: day(heavy) }), icon: CloudRain });
  }
  const flowerRain = stage === 'flowering' && !!firstWet;
  if (flowerRain && firstWet) {
    push({ id: 'stage:flower-rain', level: 'medium', title: t('crops.risk.flowerRain.title'), text: t('crops.risk.flowerRain.text', { day: day(firstWet) }), icon: CloudRain });
  }
  if (stage === 'flowering' || stage === 'fruiting') {
    // Terminal heat hurts rabi grain/pods above ~32 °C; kharif and summer crops tolerate more.
    const heatAt = season === 'rabi' ? 32 : 38;
    const hot = days.reduce<DailyForecastExt | undefined>((m, d) => (d.tempMaxC >= heatAt && (!m || d.tempMaxC > m.tempMaxC) ? d : m), undefined);
    if (hot) push({ id: 'stage:heat', level: 'medium', title: t('crops.risk.heat.title'), text: t('crops.risk.heat.text', { day: day(hot), temp: Math.round(hot.tempMaxC) }), icon: Thermometer });
    const cold = days.reduce<DailyForecastExt | undefined>((m, d) => (d.tempMinC <= 4 && (!m || d.tempMinC < m.tempMinC) ? d : m), undefined);
    if (cold) push({ id: 'stage:frost', level: 'high', title: t('crops.risk.frost.title'), text: t('crops.risk.frost.text', { day: day(cold), temp: Math.round(cold.tempMinC) }), icon: Snowflake });
  }
  const windy = days.find(d => gust(d) >= 35);
  if (stage === 'maturity' && (firstWet || windy)) {
    const d = [firstWet, windy].filter(Boolean).sort((a, b) => a!.date.localeCompare(b!.date))[0]!;
    push({ id: 'stage:mature-rain', level: 'medium', title: t('crops.risk.matureRain.title'), text: t('crops.risk.matureRain.text', { day: day(d) }), icon: CloudLightning });
  } else if ((stage === 'flowering' || stage === 'fruiting') && windy && (crop.cropKey === 'sugarcane' || (info && LODGING_CATEGORIES.has(info.category)))) {
    push({ id: 'stage:wind', level: 'medium', title: t('crops.risk.wind.title'), text: t('crops.risk.wind.text', { day: day(windy), kmh: Math.round(gust(windy)) }), icon: Wind });
  }
  if ((stage === 'vegetative' || stage === 'flowering' || stage === 'fruiting') && rainyCount >= 2 && !flowerRain) {
    push({ id: 'stage:humid', level: 'low', title: t('crops.risk.humid.title'), text: t('crops.risk.humid.text'), icon: TriangleAlert });
  }
  return out.sort((a, b) => RISK_ORDER[a.level] - RISK_ORDER[b.level]);
}

/** AI advisory risk lines as rows. */
export function advisoryRisks(advisory: CropAdvisory | undefined, t: TFunction): CropRisk[] {
  return (advisory?.risks || [])
    .map((r, i) => ({ id: `ai:${i}`, level: r.level, title: t(`crops.risk.level.${r.level}`), text: toPlainText(r.text), icon: TriangleAlert }))
    .filter(r => r.text);
}

/** The weather view still has a forecast day from today on (a very old snapshot has none left). */
export const hasForecast = (weather: WeatherSnapshot | undefined, today = todayISO()) => !!weather && weather.daily.some(d => d.date >= today);

// ---------- Advice source ----------

/**
 * Why the calendar version of the advice is showing: AI switched off, no internet, or an AI
 * error (friendly text, never the raw error). Null when nothing went wrong.
 */
export function adviceFallbackNote(error: unknown, aiAvailable: boolean, online: boolean, t: TFunction): string | null {
  if (!aiAvailable) return t('crops.advice.unavailableNote');
  if (!error) return null;
  if (!online || (error instanceof AIError && error.code === 'offline')) return t('crops.advice.offlineNote');
  const key = (error as { messageKey?: unknown }).messageKey;
  return t('crops.advice.errorNote', { error: typeof key === 'string' ? t(key) : t('common.error.generic') });
}

/** Text for read-aloud and sharing: sentences joined with the language's full stop, without doubling it. */
export function joinSentences(parts: string[], t: TFunction): string {
  return parts
    .map(p => p.trim().replace(/[।.!?]+$/, ''))
    .filter(Boolean)
    .join(t('crops.sep'));
}

// ---------- Places ----------

/** Same spot (to ~100 m), whatever the name. */
export const samePlace = (a?: GeoPlace | null, b?: GeoPlace | null) =>
  !!a && !!b && Math.abs(a.lat - b.lat) < 0.001 && Math.abs(a.lon - b.lon) < 0.001;

// ---------- Navigation ----------

const CROP_SCREENS = new Set(['crop-detail', 'crop-advisory', 'crop-edit']);

/**
 * How many routes at the top of the stack belong to this crop (its details, advice and edit
 * screens), so leaving a deleted crop pops all of them, not just one.
 */
export function cropRoutesOnTop(stack: Route[], cropId: string | undefined): number {
  if (!cropId) return stack.length > 1 ? 1 : 0;
  let n = 0;
  for (let i = stack.length - 1; i > 0; i--) {
    const r = stack[i];
    if (!CROP_SCREENS.has(r.screen) || r.params?.id !== cropId) break;
    n++;
  }
  return n;
}
