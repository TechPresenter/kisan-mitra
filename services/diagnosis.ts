// फसल डॉक्टर: photo → preliminary AI diagnosis (services/ai, task 'diagnosis'), the on-device
// history (KEYS.diagnoses, newest first, at most 40 small thumbnails) and the link from an AI
// result to the offline disease knowledge base (data/diseases.ts).
import { useMemo } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { SEASON_NAMES, currentSeason, getCropInfo, seasonForCrop, stageForCrop } from '../data/crops';
import { cropName, isCropKey } from '../data/crop-keys';
import { DISEASES, diseasesForCrop, normalizeSearch, searchDiseases, type DiseaseInfo } from '../data/diseases';
import { track } from '../lib/analytics';
import { getPlace, getSettings } from '../lib/app-state';
import { addDays, todayISO } from '../lib/format';
import { registerStrings, tNow } from '../lib/i18n';
import { compressImage } from '../lib/image';
import { KEYS, collection, newId, store, useCollection, usePersisted } from '../lib/store';
import type { Crop, CropDiagnosis, FarmingTask, GeoPlace } from '../types/models';
import { AIError, ai, toPlainText, v } from './ai';
import { isNative } from './native';
import { isSaved, toggleSaved } from './saved';
import { addUserTask } from './tasks';

registerStrings({
  hi: {
    'doctor.svc.healthy': 'स्वस्थ फसल',
    'doctor.svc.unusable': 'फोटो साफ़ नहीं',
    'doctor.svc.recheckTitle': '{crop} की दोबारा जांच — {issue}',
    'doctor.svc.recheckNote':
      'फसल डॉक्टर में दिखी समस्या दोबारा देखें: धब्बे या कीट बढ़े हैं या घटे? बढ़े हों तो नई फोटो से जांच करें और कृषि विज्ञान केंद्र (KVK) से सलाह लें।',
    'doctor.error.photo': 'यह फोटो खुल नहीं पाई। कोई दूसरी फोटो चुनें।',
    'doctor.error.permission': 'कैमरा या गैलरी की अनुमति नहीं मिली। फ़ोन की सेटिंग में जाकर किसान मित्र को अनुमति दें।',
    'doctor.error.camera': 'फोटो नहीं ले पाए। दोबारा कोशिश करें।',
  },
  en: {
    'doctor.svc.healthy': 'Healthy crop',
    'doctor.svc.unusable': 'Photo not clear',
    'doctor.svc.recheckTitle': 'Re-check {crop} — {issue}',
    'doctor.svc.recheckNote':
      'Look again at the problem Crop Doctor found: have the spots or pests spread or reduced? If they spread, check again with a new photo and ask your Krishi Vigyan Kendra (KVK).',
    'doctor.error.photo': 'This photo could not be opened. Please choose another photo.',
    'doctor.error.permission': 'Camera or gallery permission was not given. Allow it for Kisan Mitra in your phone settings.',
    'doctor.error.camera': 'Could not take the photo. Please try again.',
  },
});

/** At most this many checks are kept on the phone (small thumbnails only, ~12–18 KB each). */
export const MAX_DIAGNOSES = 40;
/** History thumbnails are never shown larger than ~96 px, so 320 px is plenty (3× density). */
const THUMB = { maxDim: 320, quality: 0.55 } as const;
/** Below this the result screen asks for a clearer photo and suggests the KVK. */
export const LOW_CONFIDENCE = 50;
/** At or above this the confidence is shown in green. */
export const HIGH_CONFIDENCE = 70;

/** Non-AI failures (photo could not be read, camera denied). `messageKey` like AIError. */
export class DiagnosisError extends Error {
  constructor(public code: 'photo' | 'permission' | 'camera', message?: string) {
    super(message || code);
    this.name = 'DiagnosisError';
  }
  get messageKey(): string {
    return `doctor.error.${this.code}`;
  }
}

const diagnoses = () => collection<CropDiagnosis>(KEYS.diagnoses);
const newestFirst = (a: CropDiagnosis, b: CropDiagnosis) => b.createdAt.localeCompare(a.createdAt);

// ---------------- Photos ----------------

// The last photo prepared for analysis: analyzeCropPhoto() skips re-encoding it (no double JPEG loss).
let lastPrepared: string | null = null;

/** Compress a picked photo (data URL or File) to the 1280px JPEG that is analysed. */
export async function preparePhoto(input: string | Blob): Promise<string> {
  if (typeof input !== 'string' && input.type && !input.type.startsWith('image/')) throw new DiagnosisError('photo', 'not an image');
  try {
    const out = await compressImage(input, { maxDim: 1280, quality: 0.82 });
    if (!out.startsWith('data:image/')) throw new Error('not an image');
    lastPrepared = out;
    return out;
  } catch (e) {
    throw e instanceof DiagnosisError ? e : new DiagnosisError('photo', String(e));
  }
}

/**
 * Native camera or gallery (Android). Resolves with a prepared JPEG data URL, or null when the
 * farmer cancelled. On the web use a file input (capture="environment") + preparePhoto().
 * Kept here because services/native's pickCropPhoto() always shows the camera/gallery prompt,
 * and Crop Doctor has separate "फोटो लें" and "गैलरी से चुनें" buttons.
 */
export async function capturePhoto(source: 'camera' | 'gallery'): Promise<string | null> {
  if (!isNative) throw new DiagnosisError('camera', 'web: use a file input');
  try {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.DataUrl,
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      quality: 85,
      width: 1280,
      correctOrientation: true,
    });
    if (!photo.dataUrl) return null;
    return await preparePhoto(photo.dataUrl);
  } catch (e: any) {
    if (e instanceof DiagnosisError) throw e;
    const msg = String(e?.message || e || '');
    if (/cancel/i.test(msg)) return null;
    if (/denied|permission/i.test(msg)) throw new DiagnosisError('permission', msg);
    throw new DiagnosisError('camera', msg);
  }
}

// ---------------- Prompt ----------------

const SYSTEM = `ROLE: You are a senior plant pathologist and entomologist with long field experience across India (ICAR institutes, state agricultural universities and Krishi Vigyan Kendras). A farmer sends ONE photo of a crop and you give a careful, PRELIMINARY field diagnosis that they can act on safely.

HOW TO EXAMINE THE PHOTO
1. Usability first. The photo must clearly show a plant part (leaf, stem, fruit, pod, ear/panicle, root). If it is not a plant, or it is too blurry, too dark, overexposed, too far away, or the affected part is not visible, set "unusableReason" to ONE short sentence that says what is wrong and how to retake it (e.g. "फोटो धुंधली है — पत्ती को 15–20 सेमी पास से, दिन की रोशनी में फिर लें।"). Then set healthy=false, confidence=0 and leave every list empty.
2. If the plant is clearly a different crop from the one stated, also use "unusableReason" and say which crop it looks like, so the farmer can choose the right crop.
3. Describe only what you can actually see: colour, shape, size and pattern of spots or streaks, powder or mould, holes, insects or eggs, webbing, curling, mosaic, wilting, and whether old or new leaves are affected.
4. Think through every kind of cause before you decide: fungal, bacterial, viral, insect or mite pests, nematodes, nutrient deficiency or toxicity, water stress or waterlogging, herbicide or spray injury, heat, cold, frost or sun scorch, and mechanical damage. Several look alike: yellow rust vs nitrogen deficiency, viral mosaic vs zinc or iron deficiency, blight vs scorch.
5. The list of common problems you receive is a HINT only. NEVER force-fit the photo to it. If the photo shows something else, name that.
6. If you cannot decide, say so honestly: give a descriptive name (e.g. "पत्तियों पर भूरे धब्बे (कारण साफ़ नहीं)"), a confidence below 50, and put the possible causes in "causes".
7. If the plant looks healthy, set healthy=true, a short "issue" such as "स्वस्थ फसल", and give prevention and monitoring tips; immediate, organic and chemical may be empty.

CONFIDENCE (0–100): an honest estimate of how sure you are of the main issue from this single photo. Use 80 or more only for very characteristic symptoms that are clearly visible. Early symptoms, viral diseases and nutrient problems usually deserve 60 or less.

ADVICE RULES
- Never name a chemical pesticide, fungicide, insecticide, bactericide or herbicide, or its dose, in immediate, organic or prevention. Put every chemical option ONLY in chemical, where the safety note is shown.
- immediate: 2–4 practical non-chemical steps for today or this week (remove and destroy affected parts, stop extra urea, drain standing water, scout the whole field, isolate infected plants…). If a spray is needed, say "see the chemical or organic options" instead of naming it.
- organic: 2–4 biological, botanical or cultural options a village farmer can get (Trichoderma, Pseudomonas fluorescens, Beauveria, neem oil 1500 ppm at 3–5 ml per litre, yellow or blue sticky traps, pheromone traps…) with simple doses.
- chemical: 1–3 options. Use ONLY active ingredients registered by CIB&RC for use in India, preferably labelled for this crop and problem. Give the common name and formulation, the dose per litre and per acre (about 150–200 litres of water per acre for a knapsack sprayer), and the spray interval or waiting period when known. Never suggest banned or withdrawn products (monocrotophos, endosulfan, methyl parathion, phorate, phosphamidon, dichlorvos, triazophos, trichlorfon, carbaryl, benomyl, dicofol, dinocap, methomyl, alachlor). If you are not sure of a dose, tell the farmer to confirm it with the KVK instead of guessing. For a viral disease say plainly that no spray cures the virus and give only vector control. For a nutrient problem give the fertiliser or micronutrient spray instead of a pesticide. Leave chemical empty for a healthy plant.
- prevention: 2–4 points for this season and the next (resistant varieties, seed treatment, spacing, crop rotation, field hygiene, balanced fertiliser as per soil test).
- causes: the likely cause and the weather or field conditions that favour it; mention a look-alike if one is possible.
- Every list item is ONE short sentence (at most about 140 characters) in simple words. No markdown, no numbering.
- Keep crop, disease and chemical names recognisable: add the English name in brackets where it helps.`;

function placeText(p: GeoPlace): string {
  const parts = [p.nameEn || p.name, p.district && p.district !== p.name ? p.district : '', p.state].filter(Boolean);
  return `${parts.join(', ')}, India`;
}

/**
 * The farmer's current record of this crop: the most recently updated one that is not harvested
 * yet. Last season's harvested field is ignored (undefined → the prompt uses the current season).
 */
export function activeCropRecord(crops: readonly Crop[], cropKey: string, today = todayISO()): Crop | undefined {
  return crops
    .filter(c => c.cropKey === cropKey && stageForCrop(c, today).stage !== 'harvested')
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0];
}

/** activeCropRecord() over the stored crops (non-reactive; screens pass their own list). */
export function farmerCropFor(cropKey: string): Crop | undefined {
  return activeCropRecord(collection<Crop>(KEYS.crops).all(), cropKey);
}

function buildPrompt(cropKey: string, note?: string): string {
  const info = getCropInfo(cropKey);
  const crop = farmerCropFor(cropKey);
  const today = todayISO();
  const name = info ? `${info.nameEn} (${info.nameHi})` : cropName(cropKey, 'en');
  const lines: string[] = [`Date: ${today}.`, `Crop selected by the farmer: ${name}.`];

  if (crop) {
    const st = stageForCrop(crop, today);
    const season = SEASON_NAMES[seasonForCrop(crop)].en;
    const from = info?.transplanted ? 'transplanting' : 'sowing';
    lines.push(
      !crop.sowingDate && !crop.transplantDate
        ? `The farmer grows this crop (${season} season); sowing date not recorded.`
        : st.stage === 'planned'
          ? `The farmer's field: ${season} season, stage: ${st.labelEn} (${from} not done yet; may still be in the nursery).`
          : `The farmer's field: ${season} season, day ${st.day} after ${from}, current stage: ${st.labelEn}.`,
    );
    if (crop.irrigation) lines.push(`Irrigation: ${crop.irrigation}.`);
    if (crop.soilType && crop.soilType !== 'unknown') lines.push(`Soil: ${crop.soilType}.`);
  } else {
    lines.push(`Season now: ${SEASON_NAMES[currentSeason(today)].en}.`);
  }
  lines.push(`Location: ${placeText(crop?.place || getPlace())}.`);

  const hints = diseasesForCrop(cropKey)
    .slice(0, 14)
    .map(d => `${d.nameEn} (${d.nameHi})`);
  if (hints.length) {
    lines.push(`Common problems of this crop in India — hints only, do NOT force-fit: ${hints.join('; ')}.`);
  }
  const cleanNote = (note || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  if (cleanNote) lines.push(`What the farmer says they see: "${cleanNote}"`);

  lines.push(
    '',
    'Examine the attached photo and reply with this JSON object:',
    `{
  "healthy": boolean,
  "issue": "main problem in the farmer's language, short (e.g. पीला रतुआ)",
  "issueEn": "the same in English (e.g. Yellow rust)",
  "confidence": integer 0-100,
  "symptoms": ["what is visible in this photo"],
  "causes": ["likely cause / favourable conditions / look-alikes"],
  "immediate": ["what to do now"],
  "organic": ["biological / botanical / cultural option with dose"],
  "chemical": ["India-registered active, formulation, dose per litre and per acre, interval"],
  "prevention": ["for the future"],
  "unusableReason": null
}`,
    'Write all text values except issueEn in the farmer\'s language. Set "unusableReason" to a short sentence ONLY when the photo cannot be analysed; otherwise null.',
  );
  return lines.join('\n');
}

// ---------------- Validation ----------------

/** Actives banned or withdrawn in India: a line naming one is dropped, whatever the model says. */
const BANNED =
  /monocrotophos|मोनोक्रोटोफॉस|मोनोक्रोटोफास|endosulfan|एंडोसल्फान|एन्डोसल्फान|methyl[\s-]*parathion|मिथाइल\s*पैराथियान|phorate|फोरेट|phosphamidon|फॉस्फामिडॉन|dichlorvos|ddvp|डाइक्लोरवॉस|triazophos|ट्राइजोफॉस|ट्राइएजोफॉस|trichlorfon|carbaryl|कार्बेरिल|benomyl|बेनोमिल|dicofol|डाइकोफॉल|dinocap|methomyl|मिथोमिल|alachlor|\bddt\b|डीडीटी|\bbhc\b|lindane|aldrin|chlordane|heptachlor/i;

const EMPTY_WORDS = /^(null|none|n\/a|na|undefined|false|no|nil|-|not applicable|कोई नहीं|नहीं|लागू नहीं)$/i;

/** "unusableReason" fillers that mean the photo WAS usable ("N/A - photo is clear", "फोटो साफ़ है"). */
const USABLE_FILLER =
  /^(n\/?a\b|none\b|nil\b|null\b|not applicable|not needed|no issue|no problem|(the )?photo is (clear|fine|good|ok|usable)|लागू नहीं|कोई (समस्या|दिक्कत|कारण) नहीं|फोटो (साफ़|साफ|ठीक|सही|अच्छी) है)/i;

/** An issue name that itself says the plant is fine. */
const HEALTHY_WORDS = /healthy|no (disease|problem|issue)|स्वस्थ|कोई (रोग|बीमारी|समस्या) नहीं/i;

/** A dose such as "2.5 ग्राम/लीटर", "3 ml per litre" or "400 मिली प्रति एकड़". */
const DOSE =
  /\d+(?:[.,]\d+)?\s*(?:मि\.?\s*ली\.?|मिली(?:लीटर)?|ml|ग्राम|ग्रा\.?|gms?|grams?|g|किलो(?:ग्राम)?|kg)\s*(?:\/|प्रति|per)\s*(?:लीटर|ली\.?|litre|liter|l\b|एकड़|acre|हेक्टेयर|ha\b|किलो|kg)/i;

/** True when an advice line names a spray dose (the result screen then shows the safety note). */
export function mentionsDose(line: string): boolean {
  return DOSE.test(line);
}

/** Objects in a list (e.g. {"active": "Mancozeb 75% WP", "dose": "2.5 g/L"}) become one line. */
function flatten(x: unknown): unknown {
  if (x && typeof x === 'object' && !Array.isArray(x)) {
    return Object.values(x as Record<string, unknown>)
      .filter(val => typeof val === 'string' || typeof val === 'number')
      .map(val => String(val).trim())
      .filter(Boolean)
      .join(', ');
  }
  return x;
}

function cleanText(x: unknown, max = 300): string {
  const s = toPlainText(v.str(flatten(x)))
    .replace(/^[\s•*\-–—·]+/, '')
    .replace(/^\(?\d{1,2}[.)]\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return EMPTY_WORDS.test(s) ? '' : s.slice(0, max);
}

function cleanList(x: unknown, max = 6): string[] {
  const raw = Array.isArray(x) ? x : typeof x === 'string' && x.trim() ? x.split(/\n+/) : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const s = cleanText(item);
    const key = s.toLowerCase();
    if (!s || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

/** Advice lines without banned or withdrawn actives (checked in every advice list, not just chemical). */
const safeList = (x: unknown, max = 6) => cleanList(x, max).filter(line => !BANNED.test(line));

function toBool(x: unknown): boolean | undefined {
  if (typeof x === 'boolean') return x;
  if (typeof x === 'string') {
    if (/^(true|yes|हाँ|हां)$/i.test(x.trim())) return true;
    if (/^(false|no|नहीं)$/i.test(x.trim())) return false;
  }
  return undefined;
}

/** 0–100, or NaN when missing. Some replies give 0–1 instead of 0–100. */
function toConfidence(x: unknown): number {
  let n = v.num(x, NaN);
  if (!Number.isFinite(n)) return NaN;
  if (n > 0 && n <= 1 && String(x).includes('.')) n *= 100;
  return Math.round(Math.min(100, Math.max(0, n)));
}

type Parsed = Omit<CropDiagnosis, 'id' | 'cropKey' | 'cropName' | 'image' | 'createdAt'>;

function validateDiagnosis(raw: any): Parsed {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Not a JSON object');

  const issue = cleanText(raw.issue, 120);
  const issueEn = cleanText(raw.issueEn ?? raw.issue_en, 120);
  const symptoms = cleanList(raw.symptoms);
  const causes = cleanList(raw.causes);
  const immediate = safeList(raw.immediate);
  const confidence = toConfidence(raw.confidence);

  // "Photo not usable" only when the reply really has no diagnosis: a filled-in unusableReason
  // next to a complete analysis ("N/A - photo is clear") must not throw the analysis away.
  const reason = cleanText(raw.unusableReason ?? raw.unusable_reason, 240);
  const unusableReason = USABLE_FILLER.test(reason) ? '' : reason;
  const noFindings = !issue && !issueEn && !symptoms.length;
  if (unusableReason && (noFindings || !(confidence > 10))) {
    return {
      healthy: false,
      issue: tNow('doctor.svc.unusable'),
      issueEn: 'Photo not usable',
      confidence: 0,
      symptoms: [],
      causes: [],
      immediate: [],
      organic: [],
      chemical: [],
      prevention: [],
      unusableReason,
    };
  }

  if (!Number.isFinite(confidence)) throw new Error('Missing "confidence"');

  const chemicalAll = safeList(raw.chemical, 4);
  // A reply that names a problem with findings but forgets the flag is a disease report.
  let healthy = toBool(raw.healthy) ?? ((issue || issueEn) && (symptoms.length || immediate.length) ? false : undefined);
  if (healthy === undefined) throw new Error('Missing "healthy"');
  // "healthy": true next to a disease name and treatment steps is a disease report too.
  if (healthy && (issue || issueEn) && !HEALTHY_WORDS.test(`${issue} ${issueEn}`) && (immediate.length || chemicalAll.length)) {
    healthy = false;
  }

  const organic = safeList(raw.organic);
  const chemical = healthy ? [] : chemicalAll;
  const prevention = safeList(raw.prevention);

  if (!healthy) {
    if (!issue && !issueEn) throw new Error('Missing "issue"');
    if (!symptoms.length && !immediate.length && !causes.length) throw new Error('No findings');
  }

  return {
    healthy,
    issue: issue || issueEn || tNow('doctor.svc.healthy'),
    issueEn: issueEn || undefined,
    confidence,
    symptoms,
    causes,
    immediate,
    organic,
    chemical,
    prevention,
  };
}

// ---------------- Analysis ----------------

export interface AnalyzeInput {
  cropKey: string;
  /** Any image data URL; it is compressed to a 1280px JPEG before sending. */
  imageDataUrl: string;
  /** Farmer's own words ("क्या दिख रहा है?"). Sent to the AI only, never logged. */
  note?: string;
  signal?: AbortSignal;
}

/**
 * Analyse one crop photo and save the result to the history (newest first, max 40).
 * Throws AIError (show t(err.messageKey)) or DiagnosisError for an unreadable photo.
 * An aborted request throws and saves nothing.
 */
export async function analyzeCropPhoto({ cropKey, imageDataUrl, note, signal }: AnalyzeInput): Promise<CropDiagnosis> {
  let image: string;
  try {
    image = imageDataUrl === lastPrepared ? imageDataUrl : await compressImage(imageDataUrl, { maxDim: 1280, quality: 0.82 });
  } catch (e) {
    throw new DiagnosisError('photo', String(e));
  }

  const { data } = await ai.generateJSON<Parsed>(
    {
      task: 'diagnosis',
      system: SYSTEM,
      prompt: buildPrompt(cropKey, note),
      images: [image],
      signal,
    },
    validateDiagnosis,
  );
  if (signal?.aborted) throw new AIError('timeout', 'aborted');

  let thumb = '';
  try {
    // ~12–18 KB instead of makeThumbnail()'s 480 px: 40 of these share one storage key.
    thumb = await compressImage(image, THUMB);
  } catch {
    /* keep the result without a picture; screens fall back to crop art */
  }
  // "जांच रोकें" (or leaving) while the thumbnail was being made: save nothing.
  if (signal?.aborted) throw new AIError('timeout', 'aborted');

  const lang = getSettings().languageCode;
  const result: CropDiagnosis = {
    id: newId('dx'),
    cropKey,
    cropName: cropName(cropKey, lang),
    image: thumb,
    createdAt: new Date().toISOString(),
    ...data,
  };
  if (!result.unusableReason) delete result.unusableReason;
  if (!result.issueEn) delete result.issueEn;
  saveDiagnosis(result);

  track('crop_diagnosis', {
    cropKey,
    healthy: result.healthy,
    unusable: !!result.unusableReason,
    confidence: result.confidence >= HIGH_CONFIDENCE ? 'high' : result.confidence >= LOW_CONFIDENCE ? 'medium' : 'low',
  });
  return result;
}

function saveDiagnosis(d: CropDiagnosis) {
  const col = diagnoses();
  const all = [d, ...col.all().filter(x => x.id !== d.id)].sort(newestFirst);
  const keep = all.slice(0, MAX_DIAGNOSES);
  const dropped = all.slice(MAX_DIAGNOSES).map(x => x.id);
  for (const id of dropped) unsave(id);
  forgetRechecks(dropped);
  col.setAll(keep);
}

function unsave(id: string) {
  if (isSaved('diagnosis', id)) toggleSaved({ type: 'diagnosis', refId: id, title: '', snippet: '' });
}

/** Drops the "3 दिन बाद दोबारा जांचें" links of checks that no longer exist (the tasks stay). */
function forgetRechecks(ids: string[]) {
  if (!ids.length) return;
  store.set<Record<string, string>>(RECHECKS_KEY, prev => {
    if (!ids.some(id => prev[id])) return prev;
    const next = { ...prev };
    for (const id of ids) delete next[id];
    return next;
  }, {});
}

// ---------------- History ----------------

export function getDiagnosis(id: string): CropDiagnosis | undefined {
  return diagnoses().get(id);
}

/** Deletes a check, its saved bookmark and its recheck link. */
export function deleteDiagnosis(id: string) {
  diagnoses().remove(id);
  unsave(id);
  forgetRechecks([id]);
}

/** Reactive history, newest first. */
export function useDiagnoses() {
  const col = useCollection<CropDiagnosis>(KEYS.diagnoses);
  return useMemo(
    () => ({
      items: [...col.items].sort(newestFirst),
      get: (id: string) => col.items.find(d => d.id === id),
      remove: deleteDiagnosis,
    }),
    [col],
  );
}

/** Display name in the current language (catalog crops follow a language switch). */
export function diagnosisCropName(d: Pick<CropDiagnosis, 'cropKey' | 'cropName'>, lang = getSettings().languageCode): string {
  return isCropKey(d.cropKey) ? cropName(d.cropKey, lang) : d.cropName;
}

// ---------------- Knowledge base link ----------------

const STOP = new Set(['of', 'the', 'and', 'on', 'in', 'a', 'an', 'or', 'with', 'disease', 'infection', 'attack', 'damage', 'problem', 'possible', 'likely', 'probable', 'suspected', 'severe', 'mild', 'symptoms', 'virus', 'viral', 'fungal', 'fungus', 'bacterial', 'pest', 'insect', 'रोग', 'की', 'का', 'के', 'में', 'और', 'संभावित', 'समस्या', 'प्रकोप']);

const nameText = (d: DiseaseInfo) => normalizeSearch([d.nameHi, d.nameEn, d.scientificName || '', ...(d.aliases || [])].join(' | '));
const cropText = (d: DiseaseInfo) => normalizeSearch(d.cropKeys.map(k => `${k} ${cropName(k, 'hi')} ${cropName(k, 'en')}`).join(' | '));

/**
 * A search hit counts only when the issue's own words name it: every word that is not a crop
 * name must appear in the entry's names or aliases (one miss allowed in longer names). Symptom-
 * text hits alone (e.g. "नाइट्रोजन की कमी" inside the yellow-rust look-alike note) are not enough.
 */
function namedBy(entry: DiseaseInfo, query: string): boolean {
  const names = nameText(entry);
  const crops = cropText(entry);
  const words = query.split(' ').filter(w => !crops.includes(w));
  const hits = words.filter(w => names.includes(w)).length;
  return hits >= 1 && hits >= (words.length >= 3 ? words.length - 1 : words.length);
}

function queryVariants(text: string): string[] {
  const out: string[] = [];
  const add = (s: string) => {
    const words = normalizeSearch(s.replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' '))
      .split(' ')
      .filter(w => w.length > 1 && !STOP.has(w));
    const q = words.join(' ');
    if (q && !out.includes(q)) out.push(q);
  };
  add(text);
  add(text.replace(/\([^)]*\)/g, ' '));
  for (const m of text.matchAll(/\(([^)]+)\)/g)) add(m[1]);
  return out;
}

/**
 * The knowledge-base entry for an AI result, when its issue clearly names one of this crop's
 * known diseases or pests. Healthy and unusable results never match.
 */
export function knowledgeFor(d: Pick<CropDiagnosis, 'cropKey' | 'healthy' | 'issue' | 'issueEn' | 'unusableReason'>): DiseaseInfo | undefined {
  if (d.healthy || d.unusableReason) return undefined;
  const allowed = diseasesForCrop(d.cropKey);
  if (!allowed.length) return undefined;
  const ids = new Set(allowed.map(x => x.id));

  for (const text of [d.issueEn, d.issue]) {
    if (!text) continue;
    for (const q of queryVariants(text)) {
      // Rank across the whole catalog: generic words ("blight", "माहू") can push this crop's
      // own entry far down a short list.
      const hit = searchDiseases(q, DISEASES.length).find(x => ids.has(x.id) && namedBy(x, q));
      if (hit) return hit;
    }
  }

  // Fallback: a known name or alias appears as whole words inside the issue text
  // ("पछेती झुलसा का प्रकोप", "Late blight on potato leaves").
  const words = (s: string) => normalizeSearch(s.replace(/[^\p{L}\p{M}\p{N}]+/gu, ' '));
  const hay = ` ${words(`${d.issueEn || ''} ${d.issue || ''}`)} `;
  let best: { d: DiseaseInfo; len: number } | undefined;
  for (const entry of allowed) {
    for (const name of [entry.nameEn, entry.nameHi, ...(entry.aliases || [])]) {
      for (const variant of [name, name.replace(/\([^)]*\)/g, ' '), ...[...name.matchAll(/\(([^)]+)\)/g)].map(m => m[1])]) {
        const n = words(variant);
        if (n.length >= 5 && hay.includes(` ${n} `) && (!best || n.length > best.len)) best = { d: entry, len: n.length };
      }
    }
  }
  return best?.d;
}

// ---------------- "3 दिन बाद दोबारा जांचें" ----------------

const RECHECKS_KEY = 'doctor.rechecks';

/** Adds a pest-scouting task `days` from today for the farmer's matching crop (once per check). */
export function scheduleRecheck(d: CropDiagnosis, days = 3): { task: FarmingTask; created: boolean } {
  const existing = recheckTaskOf(d.id);
  if (existing) return { task: existing, created: false };
  const crop = farmerCropFor(d.cropKey);
  const name = diagnosisCropName(d);
  const task = addUserTask({
    title: tNow('doctor.svc.recheckTitle', { crop: name, issue: d.issue }),
    note: tNow('doctor.svc.recheckNote'),
    type: 'pest-scouting',
    dueDate: addDays(todayISO(), days),
    cropId: crop?.id,
  });
  store.set<Record<string, string>>(RECHECKS_KEY, prev => ({ ...prev, [d.id]: task.id }), {});
  return { task, created: true };
}

function recheckTaskOf(diagnosisId: string, tasks?: FarmingTask[]): FarmingTask | undefined {
  const taskId = store.get<Record<string, string>>(RECHECKS_KEY, {})[diagnosisId];
  if (!taskId) return undefined;
  return (tasks || collection<FarmingTask>(KEYS.tasks).all()).find(t => t.id === taskId);
}

/** The recheck task added for a check, while it still exists in the calendar. */
export function useRecheckTask(diagnosisId: string | undefined): FarmingTask | undefined {
  const tasks = useCollection<FarmingTask>(KEYS.tasks).items;
  const [map] = usePersisted<Record<string, string>>(RECHECKS_KEY, {});
  return useMemo(() => {
    const id = diagnosisId ? map[diagnosisId] : undefined;
    return id ? tasks.find(t => t.id === id) : undefined;
  }, [tasks, map, diagnosisId]);
}
