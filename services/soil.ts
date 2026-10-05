// Soil health: a 0–100 score from the readings on a farmer's Soil Health Card, per-nutrient
// ratings, saved reports (KEYS.soilReports) and AI fertilizer guidance (task 'soil').
//
// Everything here is GENERAL GUIDANCE. The lab's own rating printed on the card, the card's
// fertilizer recommendation and the local agronomist / KVK always take precedence; screens must
// show common.disclaimer.fertilizer next to any recommendation.
//
// ---------------------------------------------------------------------------------------------
// Rating ranges (the classes printed on Soil Health Cards)
// ---------------------------------------------------------------------------------------------
// The Soil Health Card scheme rates N, P, K and organic carbon as Low / Medium / High using the
// national soil-test ratings of the DAC&FW "Methods Manual: Soil Testing in India" (2011), which
// go back to Muhr et al. (1965). Lab methods: OC Walkley-Black, N alkaline KMnO4, P Olsen
// (neutral/alkaline soils) or Bray (acid soils), K neutral NH4OAc.
//
//   Parameter                      Low        Medium         High
//   Organic carbon (%)             < 0.50     0.50 – 0.75    > 0.75
//   Available N (kg N/ha)          < 280      280 – 560      > 560
//   Available P (kg P2O5/ha)       < 23       23 – 57        > 57     (= 10 / 25 kg P/ha × 2.29)
//   Available K (kg K2O/ha)        < 145      145 – 337      > 337    (= 120 / 280 kg K/ha × 1.2)
//
//   pH (1:2.5 soil:water)          < 4.5 strongly acidic, 4.5–5.5 moderately acidic,
//                                  5.5–6.5 slightly acidic, 6.5–7.5 neutral (normal),
//                                  7.5–8.5 slightly/moderately alkaline, > 8.5 strongly alkaline
//
// Sources (checked 2026-10-05):
//  - ICAR-Central Sericultural Research & Training Institute, "Soil Health Card (SHC) for
//    Sericulture Farmers" — the SHC rating tables for pH classes, N (280/560), P (23/57) and
//    K (145/337) kg/ha: https://www.csrtiber.res.in/Soil_health_card.pdf
//  - Soil Health Card portal (12 parameters, card format): https://soilhealth.dac.gov.in
//  - Vikaspedia, Soil Health Card scheme:
//    https://en.vikaspedia.in/viewcontent/agriculture/policies-and-schemes/crops-related/krishi-unnati-yojana/soil-health-card?lgn=en
//  - TNAU Agritech soil rating chart (OC 0.5 / 0.75 %; TN uses its own N, P, K limits, which is
//    why the card's printed rating wins): https://agritech.tnau.ac.in/agriculture/agri_soil_soilratingchart.html
// Sources differ by ±0.1 on the pH class edges and by a few kg on the P/K edges (some labs print
// K2O 141/336 or P2O5 22.5/55). These differences never move a reading by more than one class.
//
// ---------------------------------------------------------------------------------------------
// Score (transparent, shown to the farmer in "स्कोर कैसे बनता है?")
// ---------------------------------------------------------------------------------------------
//  - Five parameters, equal weight (20 % each): pH, organic carbon, N, P, K.
//  - Points per parameter: N, P, K, OC → High (sufficient) 100, Medium 70, Low 30.
//    pH → neutral 100, slightly acidic / slightly alkaline 70, moderately acidic 40,
//    strongly acidic or strongly alkaline 20.
//  - Missing readings are left out and the weights of the rest are re-normalised; at least
//    SOIL_MIN_READINGS readings are needed before a score is shown.
//  - Score = round(average points). Bands: ≥ 75 अच्छा, 45–74 मध्यम, < 45 कमज़ोर (the same edges
//    as the UI kit's gaugeTone, so the gauge colour and the word always agree).
// Micronutrients (S, Zn, Fe, Cu, Mn, B) and EC are not part of the score.
import { useMemo } from 'react';
import { cropName, isCropKey } from '../data/crop-keys';
import { getCropInfo } from '../data/crops';
import { track } from '../lib/analytics';
import { getPlace, getSettings } from '../lib/app-state';
import { HOUR, fetchWithCache, readCache, useResource, type CachedResult, type Resource } from '../lib/cache';
import { LANGUAGES, registerStrings, tNow } from '../lib/i18n';
import { KEYS, collection, newId, store, useCollection } from '../lib/store';
import type { Crop, ID, ISODate, SoilReport, SoilType } from '../types/models';
import { ai, toPlainText, v } from './ai';
import { isSaved, toggleSaved } from './saved';

// ---------- Ratings ----------

export type SoilParam = 'ph' | 'n' | 'p' | 'k' | 'oc';
export type NutrientParam = Exclude<SoilParam, 'ph'>;
export type NutrientStatus = 'low' | 'medium' | 'high' | 'acidic' | 'alkaline' | 'normal';
/** Colour level for the UI kit's LevelBar (good green, medium orange, low red). */
export type SoilLevel = 'good' | 'medium' | 'low';
export type PhClass = 'strongAcid' | 'moderateAcid' | 'slightAcid' | 'neutral' | 'slightAlkaline' | 'strongAlkaline';
export type SoilScoreLevel = 'good' | 'medium' | 'weak';

/** Low/High edges per nutrient, in the units stored on SoilReport (kg/ha, OC in %). */
export const SOIL_RATINGS: Record<NutrientParam, { low: number; high: number; unit: 'kg/ha' | '%' }> = {
  n: { low: 280, high: 560, unit: 'kg/ha' },
  p: { low: 23, high: 57, unit: 'kg/ha' },
  k: { low: 145, high: 337, unit: 'kg/ha' },
  oc: { low: 0.5, high: 0.75, unit: '%' },
};

/** pH classes in order; a reading belongs to the first class whose `below` it is under. */
export const PH_CLASSES: readonly { cls: PhClass; below: number; status: NutrientStatus; level: SoilLevel; points: number }[] = [
  { cls: 'strongAcid', below: 4.5, status: 'acidic', level: 'low', points: 20 },
  { cls: 'moderateAcid', below: 5.5, status: 'acidic', level: 'low', points: 40 },
  { cls: 'slightAcid', below: 6.5, status: 'acidic', level: 'medium', points: 70 },
  // 6.5 and 7.5 themselves count as neutral (the "सामान्य: 6.5–7.5" range on cards).
  { cls: 'neutral', below: 7.5 + 1e-9, status: 'normal', level: 'good', points: 100 },
  { cls: 'slightAlkaline', below: 8.5 + 1e-9, status: 'alkaline', level: 'medium', points: 70 },
  { cls: 'strongAlkaline', below: Infinity, status: 'alkaline', level: 'low', points: 20 },
];

export const PH_NORMAL = { low: 6.5, high: 7.5 } as const;
/** Allowed input ranges (wider than any real card, to catch typos without rejecting odd soils). */
export const SOIL_INPUT_LIMITS: Record<SoilParam, { min: number; max: number }> = {
  ph: { min: 3, max: 10 },
  n: { min: 0, max: 2000 },
  p: { min: 0, max: 500 },
  k: { min: 0, max: 3000 },
  oc: { min: 0, max: 5 },
};

/** Points per class (see the header comment). */
export const NUTRIENT_POINTS = { high: 100, medium: 70, low: 30 } as const;
export const SCORE_BANDS = { good: 75, medium: 45 } as const;
export const SOIL_MIN_READINGS = 3;
export const SOIL_PARAMS: readonly SoilParam[] = ['ph', 'n', 'p', 'k', 'oc'];
export const ACRES_PER_HA = 2.471;

export interface SoilReadings {
  ph?: number | null;
  nitrogen?: number | null;
  phosphorus?: number | null;
  potassium?: number | null;
  organicCarbon?: number | null;
}

export interface NutrientRating {
  key: SoilParam;
  value: number;
  status: NutrientStatus;
  /** Status word: कम / मध्यम / उचित, or उचित / अम्लीय / क्षारीय for pH. */
  labelKey: string;
  /** Parameter name, e.g. "नाइट्रोजन (N)". */
  nameKey: string;
  /** Finer class: the pH class ("हल्की अम्लीय") or the nutrient's class ("कम"). */
  classKey: string;
  level: SoilLevel;
  /** 0–100 points this reading contributes to the score. */
  points: number;
  /** 0–100 position of the reading on its scale (bar fill). */
  fill: number;
  unit: '' | 'kg/ha' | '%';
}

export interface SoilHealthResult {
  /** 0–100; 0 when `enough` is false. */
  score: number;
  level: SoilScoreLevel;
  /** "अच्छा" / "मध्यम" / "कमज़ोर" in the saved language (use t(labelKey) in components). */
  label: string;
  labelKey: string;
  nutrients: NutrientRating[];
  /** Readings that were given. */
  filled: number;
  total: number;
  /** At least SOIL_MIN_READINGS readings were given, so the score means something. */
  enough: boolean;
}

const VALUE_OF: Record<SoilParam, keyof SoilReadings> = {
  ph: 'ph',
  n: 'nitrogen',
  p: 'phosphorus',
  k: 'potassium',
  oc: 'organicCarbon',
};

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

export function phClassOf(ph: number) {
  return PH_CLASSES.find(c => ph < c.below) ?? PH_CLASSES[PH_CLASSES.length - 1];
}

/** Low / medium / high for a nutrient reading (kg/ha, OC %). */
export function nutrientClass(key: NutrientParam, value: number): 'low' | 'medium' | 'high' {
  const r = SOIL_RATINGS[key];
  return value < r.low ? 'low' : value > r.high ? 'high' : 'medium';
}

export function scoreLevel(score: number): SoilScoreLevel {
  return score >= SCORE_BANDS.good ? 'good' : score >= SCORE_BANDS.medium ? 'medium' : 'weak';
}

export const scoreLabelKey = (score: number) => `soil.score.${scoreLevel(score)}`;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function rateReading(key: SoilParam, value: number): NutrientRating {
  if (key === 'ph') {
    const c = phClassOf(value);
    return {
      key,
      value,
      status: c.status,
      labelKey: `soil.level.${c.status}`,
      nameKey: 'soil.param.ph',
      classKey: `soil.ph.${c.cls}`,
      level: c.level,
      points: c.points,
      // Position on the 3–10 scale the form accepts.
      fill: Math.max(0, Math.min(100, round1(((value - 3) / 7) * 100))),
      unit: '',
    };
  }
  const cls = nutrientClass(key, value);
  const r = SOIL_RATINGS[key];
  return {
    key,
    value,
    status: cls,
    labelKey: `soil.level.${cls}`,
    nameKey: `soil.param.${key}`,
    classKey: `soil.level.${cls}`,
    level: cls === 'high' ? 'good' : cls,
    points: NUTRIENT_POINTS[cls],
    // A reading at the "high" edge fills 80 % of the bar.
    fill: Math.max(0, Math.min(100, round1((value / (r.high * 1.25)) * 100))),
    unit: r.unit,
  };
}

/** Score and per-parameter ratings for a set of Soil Health Card readings (kg/ha, OC %). */
export function soilHealthScore(input: SoilReadings): SoilHealthResult {
  const nutrients: NutrientRating[] = [];
  for (const key of SOIL_PARAMS) {
    const raw = input[VALUE_OF[key]];
    if (isNum(raw)) nutrients.push(rateReading(key, raw));
  }
  const filled = nutrients.length;
  const enough = filled >= SOIL_MIN_READINGS;
  const score = enough ? Math.round(nutrients.reduce((s, n) => s + n.points, 0) / filled) : 0;
  const level = scoreLevel(score);
  const labelKey = `soil.score.${level}`;
  return { score, level, label: tNow(labelKey), labelKey, nutrients, filled, total: SOIL_PARAMS.length, enough };
}

/**
 * Score to show for a stored report, recomputed from its readings so the gauge, the nutrient
 * rows and the lists always agree. `null` when the record has fewer than SOIL_MIN_READINGS
 * readings (such a score would mean nothing; screens show soil.form.needMore instead of "0/100").
 */
export function reportScore(r: SoilReport): number | null {
  const res = soilHealthScore(readingsOf(r));
  return res.enough ? res.score : null;
}

/**
 * Readings outside SOIL_INPUT_LIMITS (kg/ha, OC %) — almost always a typo such as a missing
 * decimal point ("65" for pH 6.5). Screens must ask the farmer to fix these instead of clamping.
 */
export function readingsOutOfRange(input: SoilReadings): SoilParam[] {
  return SOIL_PARAMS.filter(key => {
    const raw = input[VALUE_OF[key]];
    if (!isNum(raw)) return false;
    const lim = SOIL_INPUT_LIMITS[key];
    return raw < lim.min || raw > lim.max;
  });
}

/** The readings of a stored report, as soilHealthScore input. */
export const readingsOf = (r: SoilReadings): SoilReadings => ({
  ph: r.ph,
  nitrogen: r.nitrogen,
  phosphorus: r.phosphorus,
  potassium: r.potassium,
  organicCarbon: r.organicCarbon,
});

// ---------- Units ----------

export type NutrientInputUnit = 'ha' | 'acre';

/** kg/acre → kg/ha (cards in some states print per acre). */
export const perAcreToPerHa = (v: number) => Math.round(v * ACRES_PER_HA * 10) / 10;
export const perHaToPerAcre = (v: number) => Math.round((v / ACRES_PER_HA) * 10) / 10;

// ---------- Soil types ----------

export const SOIL_TYPES: readonly SoilType[] = ['alluvial', 'black', 'red', 'laterite', 'sandy', 'clay', 'loamy', 'unknown'];
export const soilTypeLabelKey = (type: SoilType) => `soil.type.${type}`;

// ---------- Reports ----------

/** SoilReport plus fields this module keeps alongside the shared model. */
export interface SoilReportExt extends SoilReport {
  /** Crops the farmer asked advice for (catalog keys). */
  cropKeys?: string[];
  /** Unit the N/P/K were typed in; values are always stored in kg/ha. */
  inputUnit?: NutrientInputUnit;
  /** When `recommendations` were last written (epoch ms), so old advice can be labelled. */
  recommendationsAt?: number;
  /** Language `recommendations` were written in. */
  recommendationsLang?: string;
}

const reports = () => collection<SoilReportExt>(KEYS.soilReports);

const byNewest = (a: SoilReport, b: SoilReport) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

export interface SoilReportInput extends SoilReadings {
  date: ISODate;
  farmId?: ID;
  soilType?: SoilType;
  cropKeys?: string[];
  inputUnit?: NutrientInputUnit;
}

const clean = (x: number | null | undefined): number | undefined => (isNum(x) ? x : undefined);

/**
 * Creates (or, with `id`, replaces) a report; the score is always recomputed here.
 * Returns `null` and stores nothing when fewer than SOIL_MIN_READINGS readings are given or a
 * reading is outside SOIL_INPUT_LIMITS (check with soilHealthScore().enough /
 * readingsOutOfRange() first and tell the farmer what to fill in).
 */
export function saveSoilReport(input: SoilReportInput, id?: ID): SoilReportExt | null {
  const result = soilHealthScore(input);
  if (!result.enough || readingsOutOfRange(input).length) return null;
  const existing = id ? reports().get(id) : undefined;
  const report: SoilReportExt = {
    id: id ?? newId('soil'),
    farmId: input.farmId || undefined,
    date: input.date,
    ph: clean(input.ph),
    nitrogen: clean(input.nitrogen),
    phosphorus: clean(input.phosphorus),
    potassium: clean(input.potassium),
    organicCarbon: clean(input.organicCarbon),
    soilType: input.soilType,
    score: result.score,
    recommendations: existing?.recommendations,
    recommendationsAt: existing?.recommendationsAt,
    recommendationsLang: existing?.recommendationsLang,
    cropKeys: normalizeCropKeys(input.cropKeys ?? []),
    inputUnit: input.inputUnit,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  reports().upsert(report);
  if (!existing) track('soil_report', { readings: result.filled, level: result.level, farm: !!report.farmId, unit: report.inputUnit ?? 'ha' });
  return report;
}

export function updateSoilReport(id: ID, patch: Partial<SoilReportExt>) {
  return reports().update(id, patch);
}

/** Deletes a report with its cached AI advice and any bookmark of it. */
export function removeSoilReport(id: ID) {
  reports().remove(id);
  for (const l of LANGUAGES) store.remove(store.cacheKey(soilRecsCacheName(id, l.code)));
  if (isSaved('soil-report', id)) toggleSaved({ type: 'soil-report', refId: id, title: '', snippet: '' });
}

export function getSoilReport(id: ID): SoilReportExt | undefined {
  return reports().get(id);
}

/** Saved soil reports, newest test date first. */
export function useSoilReports() {
  const col = useCollection<SoilReportExt>(KEYS.soilReports);
  return useMemo(
    () => ({
      reports: [...col.items].sort(byNewest),
      get: (id: ID) => col.items.find(r => r.id === id),
      save: saveSoilReport,
      update: updateSoilReport,
      remove: removeSoilReport,
    }),
    [col],
  );
}

// ---------- AI recommendations ----------

export interface SoilRecommendations {
  summary: string;
  /** Practical next steps (nutrients to add or cut, amendments, timing). */
  actions: string[];
  /** Organic / low-cost options (FYM, compost, green manure, biofertilisers). */
  organic: string[];
  cautions: string[];
  /** Crops the advice was written for (empty = general). */
  cropKeys: string[];
  lang: string;
}

/** Any crop reference: a catalog key or a crop record. */
export type SoilCropInput = string | Pick<Crop, 'cropKey'>;

export function normalizeCropKeys(crops: readonly SoilCropInput[]): string[] {
  const keys = crops.map(c => (typeof c === 'string' ? c : c.cropKey)).filter(isCropKey);
  return [...new Set(keys)].slice(0, 4);
}

const DAY = 24 * HOUR;
/** A report's readings never change, so its advice stays valid; a new test is a new report. */
export const SOIL_RECS_MAX_AGE_MS = 365 * DAY;

export const soilRecsCacheName = (reportId: ID, lang = getSettings().languageCode) => `soil.recs:${reportId}:${lang}`;

/** Whether this build can ask the AI at all (screens hint before the farmer taps). */
export const soilAdviceAvailable = (): boolean => ai.available();

export function hasSoilRecommendations(reportId: ID): boolean {
  return !!readCache<SoilRecommendations>(soilRecsCacheName(reportId));
}

const SYSTEM = `You help an Indian farmer understand their Soil Health Card and plan nutrients for the next crop.
Return one JSON object: {"summary": string, "actions": string[], "organic": string[], "cautions": string[]}.
- summary: 1–2 short sentences on the overall soil health, naming the weakest readings.
- actions: 3–5 practical steps, most important first: which nutrient to raise or cut back (by the given ratings), soil amendments only when the pH class calls for it (lime for acidic soil, gypsum only for alkaline/sodic soil and only after a lab check), and timing (basal vs split doses).
- organic: 2–4 organic or low-cost options (FYM, compost, vermicompost, green manure, crop residue, biofertilisers such as Rhizobium/PSB/Azotobacter where they fit the crop).
- cautions: 2–3 cautions (do not overuse urea, follow the card's dose, test micronutrients like zinc/sulphur/boron if not tested, re-test every 2–3 years).
Rules:
- This is general guidance. Do not prescribe exact doses as certain. If you mention a quantity, give a per-acre range with the word "लगभग"/"about" and say to match it to the Soil Health Card recommendation and the local agriculture officer or KVK.
- Use only the readings given. Never invent a reading, lab value, price, subsidy or brand name.
- If a reading is missing, do not guess it.
- Each item at most 140 characters, simple words a farmer understands, no markdown.`;

function describeReadings(report: SoilReport): string {
  const res = soilHealthScore(readingsOf(report));
  const lines = res.nutrients.map(n => {
    if (n.key === 'ph') return `- pH ${n.value}: ${PH_CLASS_EN[phClassOf(n.value).cls]} (normal ${PH_NORMAL.low}–${PH_NORMAL.high})`;
    const r = SOIL_RATINGS[n.key as NutrientParam];
    const name = { n: 'Available nitrogen (N)', p: 'Available phosphorus (P2O5)', k: 'Available potassium (K2O)', oc: 'Organic carbon' }[n.key as NutrientParam];
    return `- ${name}: ${n.value} ${r.unit} — ${n.status} (medium range ${r.low}–${r.high} ${r.unit})`;
  });
  const missing = SOIL_PARAMS.filter(k => !res.nutrients.some(n => n.key === k));
  if (missing.length) lines.push(`- Not tested / not entered: ${missing.join(', ')}`);
  return lines.join('\n');
}

const PH_CLASS_EN: Record<PhClass, string> = {
  strongAcid: 'strongly acidic',
  moderateAcid: 'moderately acidic',
  slightAcid: 'slightly acidic',
  neutral: 'neutral (normal)',
  slightAlkaline: 'slightly alkaline',
  strongAlkaline: 'strongly alkaline (possibly sodic)',
};

const SOIL_TYPE_EN: Record<SoilType, string> = {
  alluvial: 'alluvial',
  black: 'black (regur)',
  red: 'red',
  laterite: 'laterite',
  sandy: 'sandy',
  clay: 'clay',
  loamy: 'loam',
  unknown: 'not known',
};

/**
 * Plain text without a leading list marker ("• ", "- ", "– ", "1. ", "2) "). Only a real marker
 * followed by a space is removed, so advice that starts with a quantity stays whole:
 * "50–60 किलो यूरिया…", "2-3 साल में…" and "0.5% से कम…" are kept as they are.
 */
export function tidyAdviceLine(s: string): string {
  return toPlainText(s)
    .replace(/^\s*(?:[•*\-–]\s+|\d{1,2}[.)]\s+)/, '')
    .trim();
}

async function loadSoilRecommendations(report: SoilReport, cropKeys: string[]): Promise<SoilRecommendations> {
  const lang = getSettings().languageCode;
  const res = soilHealthScore(readingsOf(report));
  const place = getPlace();
  const crops = cropKeys.map(k => {
    const info = getCropInfo(k);
    return info ? `${info.nameEn} (${info.nameHi})` : cropName(k, 'en');
  });
  const prompt = [
    `Soil test date: ${report.date}.`,
    `Soil type: ${SOIL_TYPE_EN[report.soilType ?? 'unknown']}.`,
    `Readings with their Soil Health Card rating:\n${describeReadings(report)}`,
    `Overall soil health score (app's own summary): ${res.score}/100 (${res.level}).`,
    crops.length ? `Crops the farmer will grow on this field: ${crops.join(', ')}.` : 'No crop chosen: give general advice for this soil.',
    `Region: ${place.nameEn || place.name}${place.state ? `, ${place.state}` : ''}, India.`,
  ].join('\n');

  const { data } = await ai.generateJSON(
    { task: 'soil', system: SYSTEM, prompt, maxOutputTokens: 1400 },
    (x: any) => {
      const list = (y: unknown, max: number) => v.strArr(y, max).map(tidyAdviceLine).filter(Boolean);
      const out = {
        summary: tidyAdviceLine(v.str(x?.summary)),
        actions: list(x?.actions, 6),
        organic: list(x?.organic, 5),
        cautions: list(x?.cautions, 4),
      };
      if (!out.summary && !out.actions.length) throw new Error('empty soil advice');
      return out;
    },
  );
  return { ...data, cropKeys, lang };
}

/** One line per item, for SoilReport.recommendations (read by other modules and old builds). */
export function flattenRecommendations(r: SoilRecommendations): string[] {
  return [r.summary, ...r.actions, ...r.organic, ...r.cautions].filter(Boolean);
}

function fetcherFor(report: SoilReport, crops: readonly SoilCropInput[]) {
  const keys = normalizeCropKeys(crops);
  return async () => {
    const data = await loadSoilRecommendations(report, keys);
    // Keep a plain copy on the record, so the advice survives a cache eviction.
    if (reports().get(report.id)) {
      reports().update(report.id, {
        recommendations: flattenRecommendations(data),
        recommendationsAt: Date.now(),
        recommendationsLang: data.lang,
        cropKeys: keys,
      });
    }
    return data;
  };
}

/**
 * AI advice for a saved report (task 'soil'), cached per report and language. Throws AIError
 * (offline, not-configured, rate-limit…) when nothing is cached. Always show
 * common.disclaimer.fertilizer with the result.
 */
export function getSoilRecommendations(
  report: SoilReport,
  crops: readonly SoilCropInput[] = [],
  opts: { force?: boolean } = {},
): Promise<CachedResult<SoilRecommendations>> {
  return fetchWithCache(soilRecsCacheName(report.id), fetcherFor(report, crops), { maxAgeMs: SOIL_RECS_MAX_AGE_MS, force: opts.force });
}

/**
 * Reactive advice for a report. Shows cached advice right away; asks the AI only once
 * `requested` is true (the farmer tapped "AI सुझाव देखें"). `refresh()` asks again (e.g. after
 * the crop changed).
 */
export function useSoilRecommendations(
  report: SoilReport | null | undefined,
  crops: readonly SoilCropInput[],
  requested: boolean,
): Resource<SoilRecommendations> {
  const name = report ? soilRecsCacheName(report.id) : null;
  const active = !!name && (requested || !!readCache(name));
  return useResource<SoilRecommendations>(
    active ? name : null,
    () => (report ? fetcherFor(report, crops)() : Promise.reject(new Error('no report'))),
    { maxAgeMs: SOIL_RECS_MAX_AGE_MS },
  );
}

// ---------- Strings used by this service's label keys ----------

registerStrings({
  hi: {
    'soil.param.ph': 'pH (अम्लीय/क्षारीय स्तर)',
    'soil.param.n': 'नाइट्रोजन (N)',
    'soil.param.p': 'फॉस्फोरस (P₂O₅)',
    'soil.param.k': 'पोटाश (K₂O)',
    'soil.param.oc': 'जैविक कार्बन (OC)',
    'soil.level.low': 'कम',
    'soil.level.medium': 'मध्यम',
    // Reference 18 shows a good nutrient as "उचित" (green); the card itself prints "उच्च/High".
    'soil.level.high': 'उचित',
    'soil.level.normal': 'उचित',
    'soil.level.acidic': 'अम्लीय',
    'soil.level.alkaline': 'क्षारीय',
    'soil.ph.strongAcid': 'बहुत ज़्यादा अम्लीय',
    'soil.ph.moderateAcid': 'मध्यम अम्लीय',
    'soil.ph.slightAcid': 'हल्की अम्लीय',
    'soil.ph.neutral': 'सामान्य',
    'soil.ph.slightAlkaline': 'हल्की क्षारीय',
    'soil.ph.strongAlkaline': 'ज़्यादा क्षारीय (ऊसर हो सकती है)',
    'soil.score.good': 'अच्छा',
    'soil.score.medium': 'मध्यम',
    'soil.score.weak': 'कमज़ोर',
    'soil.type.alluvial': 'जलोढ़ (कछारी) मिट्टी',
    'soil.type.black': 'काली मिट्टी',
    'soil.type.red': 'लाल मिट्टी',
    'soil.type.laterite': 'लैटेराइट मिट्टी',
    'soil.type.sandy': 'बलुई (रेतीली) मिट्टी',
    'soil.type.clay': 'चिकनी (मटियार) मिट्टी',
    'soil.type.loamy': 'दोमट मिट्टी',
    'soil.type.unknown': 'पता नहीं',
  },
  en: {
    'soil.param.ph': 'pH (soil reaction)',
    'soil.param.n': 'Nitrogen (N)',
    'soil.param.p': 'Phosphorus (P₂O₅)',
    'soil.param.k': 'Potash (K₂O)',
    'soil.param.oc': 'Organic carbon (OC)',
    'soil.level.low': 'Low',
    'soil.level.medium': 'Medium',
    'soil.level.high': 'Sufficient',
    'soil.level.normal': 'Normal',
    'soil.level.acidic': 'Acidic',
    'soil.level.alkaline': 'Alkaline',
    'soil.ph.strongAcid': 'Strongly acidic',
    'soil.ph.moderateAcid': 'Moderately acidic',
    'soil.ph.slightAcid': 'Slightly acidic',
    'soil.ph.neutral': 'Neutral',
    'soil.ph.slightAlkaline': 'Slightly alkaline',
    'soil.ph.strongAlkaline': 'Strongly alkaline (may be sodic)',
    'soil.score.good': 'Good',
    'soil.score.medium': 'Medium',
    'soil.score.weak': 'Weak',
    'soil.type.alluvial': 'Alluvial soil',
    'soil.type.black': 'Black soil',
    'soil.type.red': 'Red soil',
    'soil.type.laterite': 'Laterite soil',
    'soil.type.sandy': 'Sandy soil',
    'soil.type.clay': 'Clay soil',
    'soil.type.loamy': 'Loam soil',
    'soil.type.unknown': 'Not sure',
  },
});
