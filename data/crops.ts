// Crop knowledge catalog: one researched, general-guidance profile per CropKey, plus
// stage / season helpers used by My Crops, Advisory, Calendar and AI prompts.
// Figures follow public package-of-practices (PAU, TNAU, ICAR institutes, Vikaspedia);
// sources are listed per crop and summarised in docs/CATALOG.md. They are general
// guidance for a mid-duration variety: local KVK advice and soil tests take precedence.
import type { CropStage, ISODate } from '../types/models';
import { addDays, daysBetween, parseISODate, toISODate, todayISO } from '../lib/format';
import { CROP_KEYS, CROP_NAMES, isCropKey, type CropKey } from './crop-keys';

export type CropCategory = 'cereal' | 'pulse' | 'oilseed' | 'vegetable' | 'cash' | 'millet';
export type Season = 'kharif' | 'rabi' | 'zaid';
export const SEASONS: readonly Season[] = ['kharif', 'rabi', 'zaid'];
/** The in-field stages (the catalog never stores 'planned' / 'harvested'). */
export type GrowthStage = Exclude<CropStage, 'planned' | 'harvested'>;

export interface Range {
  min: number;
  max: number;
}

export interface CropStageInfo {
  stage: GrowthStage;
  /** Day after sowing (or transplanting, see CropInfo.transplanted) when this sub-stage starts. */
  startDay: number;
  /** e.g. "कल्ले निकलना (Tillering)". Several entries may share one CropStage. */
  labelHi: string;
  labelEn: string;
}

/**
 * A season whose timeline differs from the base profile (rabi maize, autumn cane, a winter
 * nursery for spring chilli). Unset fields fall back to the base profile.
 */
export interface CropVariant {
  labelHi: string;
  labelEn: string;
  /**
   * Sowing months (subset of sowingMonths[season]) this variant covers; other months of the
   * season keep the base profile. Omitted = the whole season.
   */
  months?: number[];
  durationDays?: Range;
  /** Same number of entries as the base stages, so task timings can be mapped across. */
  stages?: CropStageInfo[];
  nurseryDays?: Range;
}

/** One seed type with its own rate (kg per acre), for seed calculators. */
export interface SeedOption extends Range {
  labelHi: string;
  labelEn: string;
}

export interface CropInfo {
  key: CropKey;
  nameHi: string;
  nameEn: string;
  otherNamesHi: string[];
  category: CropCategory;
  /** Seasons the crop is grown in, from sowingMonths. The first is the one the base profile describes. */
  seasons: Season[];
  /**
   * Months (1–12) when seed is usually sown, per season: field sowing, or the NURSERY for
   * transplanted crops. Drives cropsSowableIn() and which variant applies.
   */
  sowingMonths: Partial<Record<Season, number[]>>;
  sowingWindowHi: string;
  sowingWindowEn: string;
  /**
   * Nursery-raised crop: durationDays, stage days and task dayOffsets count from
   * TRANSPLANTING; nursery work has negative offsets.
   */
  transplanted?: boolean;
  /** Seedling age at transplanting. */
  nurseryDays?: Range;
  /** Typical days from sowing/transplanting to harvest (first picking for multi-pick crops). */
  durationDays: Range;
  /** Multi-pick crops: days pickings continue after the first harvest. */
  harvestSpanDays?: number;
  /** Ordered by startDay; the first entry starts at day 0. */
  stages: CropStageInfo[];
  /** Seasons whose timeline differs from the base profile. */
  variants?: Partial<Record<Season, CropVariant>>;
  /** kg per acre. For nursery crops: seed for the nursery that plants one acre; noteHi explains units. */
  seedRateKgPerAcre: Range & { noteHi?: string; noteEn?: string };
  /** Per-type rates where the seed type changes the rate a lot (cotton, paddy…). */
  seedOptions?: SeedOption[];
  spacingHi: string;
  spacingEn: string;
  /** General kg/ha of N, P2O5, K2O for a medium-fertility soil; soil-test advice overrides. See npkPerAcre(). */
  recommendedNPKKgPerHa: { n: number; p: number; k: number };
  /** Extra nutrients / split advice (sulphur, zinc, gypsum…), always per acre. */
  npkNoteHi?: string;
  npkNoteEn?: string;
  criticalIrrigationHi: string[];
  criticalIrrigationEn: string[];
  irrigationCountHi: string;
  irrigationCountEn: string;
  soilHi: string;
  soilEn: string;
  /** Well-known public varieties (examples only, not an endorsement). */
  commonVarietiesHi: string[];
  commonVarietiesEn: string[];
  /** Ids into data/diseases.ts (`<cropKey>-<issue>`). */
  majorPestsDiseases: string[];
  sources: string[];
}

/** Generic stage names, e.g. for "2 एकड़ • बढ़वार अवस्था". */
export const STAGE_NAMES: Record<CropStage, { hi: string; en: string }> = {
  planned: { hi: 'बुवाई से पहले', en: 'Not sown yet' },
  germination: { hi: 'अंकुरण', en: 'Germination' },
  vegetative: { hi: 'बढ़वार', en: 'Vegetative' },
  flowering: { hi: 'फूल', en: 'Flowering' },
  fruiting: { hi: 'फल/दाना बनना', en: 'Fruiting' },
  maturity: { hi: 'पकाव', en: 'Maturity' },
  harvested: { hi: 'कटाई हो चुकी', en: 'Harvested' },
};

/** 'planned' label for nursery crops, whose day 0 is transplanting. */
const PLANNED_TRANSPLANT = { hi: 'रोपाई से पहले', en: 'Not transplanted yet' };

export const SEASON_NAMES: Record<Season, { hi: string; en: string }> = {
  kharif: { hi: 'खरीफ', en: 'Kharif' },
  rabi: { hi: 'रबी', en: 'Rabi' },
  zaid: { hi: 'जायद', en: 'Zaid' },
};

export const CATEGORY_NAMES: Record<CropCategory, { hi: string; en: string }> = {
  cereal: { hi: 'अनाज', en: 'Cereals' },
  millet: { hi: 'मोटे अनाज', en: 'Millets' },
  pulse: { hi: 'दलहन', en: 'Pulses' },
  oilseed: { hi: 'तिलहन', en: 'Oilseeds' },
  cash: { hi: 'नकदी फसल', en: 'Cash crops' },
  vegetable: { hi: 'सब्ज़ी', en: 'Vegetables' },
};

/** Catalog text in the UI language: English for 'en', Hindi otherwise (same fallback as lib/i18n). */
export const catalogText = (lang: string, hi: string, en: string): string => (lang === 'en' ? en : hi);

type Txt = readonly [hi: string, en: string];

const st = (stage: GrowthStage, startDay: number, [labelHi, labelEn]: Txt): CropStageInfo => ({
  stage,
  startDay,
  labelHi,
  labelEn,
});
/** Same sub-stages on another timeline (variants keep labels, move days). */
const restage = (stages: CropStageInfo[], days: number[]): CropStageInfo[] =>
  stages.map((s, i) => ({ ...s, startDay: days[i] ?? s.startDay }));

const GERM: Txt = ['अंकुरण (Germination)', 'Germination'];
const EST: Txt = ['रोपाई के बाद जड़ जमना (Establishment)', 'Establishment after transplanting'];
const FLOWER: Txt = ['फूल आना (Flowering)', 'Flowering'];
const MATURE: Txt = ['पकाव (Maturity)', 'Maturity'];
const TILLER: Txt = ['कल्ले निकलना (Tillering)', 'Tillering'];
const PI: Txt = ['बाली बनना शुरू (Panicle initiation)', 'Panicle initiation'];
const HEADING: Txt = ['बाली निकलना व फूल (Heading/Flowering)', 'Heading & flowering'];
const GRAIN_MD: Txt = ['दाना भरना (Milk/Dough)', 'Grain filling (milk/dough)'];
const GRAIN: Txt = ['दाना भरना (Grain filling)', 'Grain filling'];
const BRANCH: Txt = ['शाखाएं बनना (Branching)', 'Branching'];
const LEAF_BRANCH: Txt = ['पत्तियां व शाखाएं बनना', 'Leaves & branches forming'];
const POD_FILL: Txt = ['फली बनना व भरना (Pod filling)', 'Pod formation & filling'];
const POD_MATURE: Txt = ['फलियां पकना (Maturity)', 'Pod maturity'];
const EARLY: Txt = ['शुरुआती बढ़वार', 'Early growth'];
const VEG_BRANCH: Txt = ['बढ़वार व शाखाएं', 'Growth & branching'];
const WINTER_NURSERY: Txt = ['बसंत फसल (सर्दी में नर्सरी)', 'Spring crop (winter nursery)'];

const MAIZE_STAGES: CropStageInfo[] = [
  st('germination', 0, GERM),
  st('vegetative', 10, ['शुरुआती बढ़वार (4–6 पत्ती)', 'Early growth (4–6 leaves)']),
  st('vegetative', 30, ['घुटने तक ऊँचाई (Knee-high)', 'Knee-high']),
  st('flowering', 50, ['नर मंजरी व रेशे निकलना (Tasseling/Silking)', 'Tasseling & silking']),
  st('fruiting', 62, GRAIN),
  st('maturity', 88, MATURE),
];

const CANE_STAGES: CropStageInfo[] = [
  st('germination', 0, ['जमाव (Germination)', 'Germination']),
  st('vegetative', 35, TILLER),
  st('vegetative', 120, ['तेज़ बढ़वार (Grand growth)', 'Grand growth']),
  st('maturity', 270, ['पकाव व मिठास बढ़ना (Ripening)', 'Ripening']),
];

const PAU_RABI = 'https://pau.edu/content/ccil/pf/pp_rabi.pdf';
const PAU_KHARIF = 'https://pau.edu/content/ccil/pf/pp_kharif.pdf';
const PAU_VEG = 'https://pau.edu/content/ccil/pf/pp_veg.pdf';
const TNAU = 'https://agritech.tnau.ac.in';
const VIKAS = 'https://agriculture.vikaspedia.in/viewcontent/agriculture/crop-production/package-of-practices';
const IIVR_SEED = 'https://iivr.icar.gov.in/seed-rate-list';

type CropDef = Omit<CropInfo, 'key' | 'nameHi' | 'nameEn' | 'seasons'>;
// Seasons come from sowingMonths so the two cannot drift apart; key order = base season first.
const def = (key: CropKey, d: CropDef): CropInfo => ({
  key,
  nameHi: CROP_NAMES[key].hi,
  nameEn: CROP_NAMES[key].en,
  seasons: Object.keys(d.sowingMonths) as Season[],
  ...d,
});

export const CROPS: Record<CropKey, CropInfo> = {
  wheat: def('wheat', {
    otherNamesHi: ['गेहूँ', 'कनक'],
    category: 'cereal',
    sowingMonths: { rabi: [10, 11, 12] },
    sowingWindowHi: 'नवंबर का पहला पखवाड़ा (उत्तर भारत); पछेती बुवाई दिसंबर के तीसरे हफ्ते तक',
    sowingWindowEn: 'First fortnight of November (North India); late sowing up to the third week of December',
    // Central India ~120–130 d, NW plains (PAU: PBW 826 148 d, DBW 187 153 d) up to ~160 d.
    durationDays: { min: 120, max: 160 },
    stages: [
      st('germination', 0, GERM),
      st('vegetative', 21, ['शिखर जड़ व कल्ले निकलना (CRI/Tillering)', 'Crown root initiation & tillering']),
      st('vegetative', 60, ['गांठ बनना (Jointing)', 'Jointing']),
      st('flowering', 85, HEADING),
      st('fruiting', 100, GRAIN_MD),
      st('maturity', 125, MATURE),
    ],
    seedRateKgPerAcre: {
      min: 40,
      max: 50,
      noteHi: 'समय पर बुवाई 40 किलो, पछेती में 50 किलो',
      noteEn: 'Timely sowing 40 kg, late sowing 50 kg',
    },
    seedOptions: [
      { labelHi: 'समय पर बुवाई', labelEn: 'Timely sown', min: 40, max: 40 },
      { labelHi: 'पछेती बुवाई', labelEn: 'Late sown', min: 50, max: 50 },
    ],
    spacingHi: 'कतार से कतार 20–22.5 सेमी; पछेती में 18 सेमी; गहराई 5 सेमी',
    spacingEn: 'Rows 20–22.5 cm apart (18 cm for late sowing); 5 cm deep',
    recommendedNPKKgPerHa: { n: 120, p: 60, k: 40 },
    npkNoteHi: 'आधा नाइट्रोजन और पूरा फॉस्फोरस-पोटाश बुवाई पर; बाकी नाइट्रोजन पहली व दूसरी सिंचाई पर',
    npkNoteEn: 'Half the N and all the P and K at sowing; the rest of the N with the first and second irrigations',
    criticalIrrigationHi: [
      'शिखर जड़ (CRI) — 20–25 दिन (सबसे ज़रूरी)',
      'कल्ले — 40–45 दिन',
      'गांठ बनना — 60–65 दिन',
      'फूल — 80–85 दिन',
      'दूधिया दाना — 100–105 दिन',
    ],
    criticalIrrigationEn: [
      'Crown root initiation (CRI) — 20–25 days (most important)',
      'Tillering — 40–45 days',
      'Jointing — 60–65 days',
      'Flowering — 80–85 days',
      'Milk stage — 100–105 days',
    ],
    irrigationCountHi: '4–6 सिंचाई; पानी कम हो तो CRI, गांठ और फूल पर ज़रूर',
    irrigationCountEn: '4–6 irrigations; if water is short, never skip CRI, jointing and flowering',
    soilHi: 'दोमट व बलुई दोमट, अच्छी जल निकासी वाली',
    soilEn: 'Well-drained loam and sandy loam',
    commonVarietiesHi: ['HD 2967', 'HD 3086', 'DBW 187 (करण वंदना)', 'PBW 826', 'GW 322 (मध्य भारत)'],
    commonVarietiesEn: ['HD 2967', 'HD 3086', 'DBW 187 (Karan Vandana)', 'PBW 826', 'GW 322 (Central India)'],
    majorPestsDiseases: ['wheat-yellow-rust', 'wheat-brown-rust', 'wheat-loose-smut', 'wheat-karnal-bunt', 'wheat-termite', 'wheat-aphid'],
    sources: [
      PAU_RABI,
      `${TNAU}/agriculture/agri_cropproduction_wheat_fieldpreparation.html`,
      `${VIKAS}/cereals-and-millets/wheat?lgn=en`,
    ],
  }),

  paddy: def('paddy', {
    otherNamesHi: ['चावल', 'धान (Rice)'],
    category: 'cereal',
    sowingMonths: { kharif: [5, 6, 7] },
    sowingWindowHi: 'नर्सरी: मई के आखिर से जून; रोपाई: 20 जून से 15 जुलाई',
    sowingWindowEn: 'Nursery: late May to June; transplanting: 20 June to 15 July',
    transplanted: true,
    nurseryDays: { min: 21, max: 30 },
    durationDays: { min: 95, max: 120 },
    stages: [
      st('germination', 0, EST),
      st('vegetative', 12, TILLER),
      st('vegetative', 40, PI),
      st('flowering', 68, HEADING),
      st('fruiting', 78, GRAIN_MD),
      st('maturity', 95, MATURE),
    ],
    seedRateKgPerAcre: {
      min: 6,
      max: 12,
      noteHi: 'एक एकड़ रोपाई के लिए नर्सरी बीज 8–12 किलो; हाइब्रिड 6–8 किलो; सीधी बुवाई (DSR) 8–10 किलो',
      noteEn: 'Nursery seed to transplant one acre 8–12 kg; hybrids 6–8 kg; direct-seeded rice (DSR) 8–10 kg',
    },
    seedOptions: [
      { labelHi: 'रोपाई (नर्सरी)', labelEn: 'Transplanted (nursery)', min: 8, max: 12 },
      { labelHi: 'हाइब्रिड (नर्सरी)', labelEn: 'Hybrid (nursery)', min: 6, max: 8 },
      { labelHi: 'सीधी बुवाई (DSR)', labelEn: 'Direct seeded (DSR)', min: 8, max: 10 },
    ],
    spacingHi: '20×15 सेमी, एक जगह 2–3 पौधे',
    spacingEn: '20×15 cm, 2–3 seedlings per hill',
    recommendedNPKKgPerHa: { n: 120, p: 60, k: 40 },
    npkNoteHi: 'नाइट्रोजन 3 हिस्सों में (रोपाई, कल्ले, बाली बनना); जिंक की कमी में जिंक सल्फेट (21%) 10–25 किलो/एकड़, मिट्टी जांच के अनुसार',
    npkNoteEn: 'N in 3 splits (transplanting, tillering, panicle initiation); if zinc is deficient, zinc sulphate (21%) 10–25 kg/acre as per soil test',
    criticalIrrigationHi: ['रोपाई के बाद जड़ जमना', 'कल्ले निकलना', 'बाली बनना (PI)', 'फूल आना', 'दाना भरना'],
    criticalIrrigationEn: ['Establishment after transplanting', 'Tillering', 'Panicle initiation (PI)', 'Flowering', 'Grain filling'],
    irrigationCountHi: 'खेत में 2–5 सेमी पानी रखें; पानी सूखने के 1–2 दिन बाद फिर भरें; कटाई से 10–15 दिन पहले पानी बंद',
    irrigationCountEn: 'Keep 2–5 cm of standing water; refill 1–2 days after it dries; stop 10–15 days before harvest',
    soilHi: 'चिकनी व चिकनी दोमट, पानी रोकने वाली मिट्टी',
    soilEn: 'Clay and clay loam soils that hold water',
    commonVarietiesHi: ['पूसा बासमती 1121', 'पूसा बासमती 1509', 'PR 126', 'स्वर्णा (MTU 7029)', 'स्वर्णा सब-1 (बाढ़ वाले क्षेत्र)'],
    commonVarietiesEn: ['Pusa Basmati 1121', 'Pusa Basmati 1509', 'PR 126', 'Swarna (MTU 7029)', 'Swarna Sub-1 (flood-prone areas)'],
    majorPestsDiseases: ['paddy-blast', 'paddy-bacterial-leaf-blight', 'paddy-sheath-blight', 'paddy-false-smut', 'paddy-stem-borer', 'paddy-brown-planthopper', 'paddy-leaf-folder'],
    sources: [
      PAU_KHARIF,
      `${TNAU}/expert_system/paddy/cultivationpractices2.html`,
      `${TNAU}/pdf/AGRICULTURE.pdf`,
    ],
  }),

  maize: def('maize', {
    otherNamesHi: ['मकई', 'भुट्टा'],
    category: 'cereal',
    sowingMonths: { kharif: [6, 7], rabi: [10, 11], zaid: [1, 2, 3] },
    sowingWindowHi: 'खरीफ: जून के आखिर से जुलाई पहला हफ्ता; रबी (बिहार/दक्षिण): अक्टूबर–नवंबर; बसंत: 20 जनवरी–15 फरवरी',
    sowingWindowEn: 'Kharif: late June to first week of July; rabi (Bihar/South): October–November; spring: 20 January–15 February',
    durationDays: { min: 90, max: 115 },
    stages: MAIZE_STAGES,
    variants: {
      // Winter slows everything: Oct–Nov sowings are harvested in April.
      rabi: {
        labelHi: 'रबी मक्का (सर्दी में धीमी बढ़वार)',
        labelEn: 'Rabi maize (slow winter growth)',
        durationDays: { min: 150, max: 175 },
        stages: restage(MAIZE_STAGES, [0, 15, 55, 105, 120, 148]),
      },
      // PAU spring maize (20 Jan–15 Feb) matures in ~115–120 d; March sowings follow the kharif profile.
      zaid: {
        labelHi: 'बसंत मक्का (जनवरी–फरवरी बुवाई)',
        labelEn: 'Spring maize (January–February sowing)',
        months: [1, 2],
        durationDays: { min: 105, max: 125 },
        stages: restage(MAIZE_STAGES, [0, 12, 35, 62, 75, 100]),
      },
    },
    seedRateKgPerAcre: { min: 8, max: 10 },
    spacingHi: '60×20 सेमी, गहराई 3–5 सेमी; मेड़ पर बुवाई अच्छी',
    spacingEn: '60×20 cm, 3–5 cm deep; ridge sowing is better',
    recommendedNPKKgPerHa: { n: 120, p: 60, k: 40 },
    npkNoteHi: 'हाइब्रिड में N 60 किलो/एकड़ तक; N तीन हिस्सों में (बुवाई, घुटने तक ऊँचाई, नर मंजरी से पहले); जिंक की कमी में जिंक सल्फेट (21%) 10 किलो/एकड़',
    npkNoteEn: 'Up to 60 kg N/acre for hybrids; N in 3 splits (sowing, knee-high, before tasseling); if zinc is deficient, zinc sulphate (21%) 10 kg/acre',
    criticalIrrigationHi: ['घुटने तक ऊँचाई', 'नर मंजरी व रेशे निकलना (सबसे ज़रूरी)', 'दाना भरना'],
    criticalIrrigationEn: ['Knee-high', 'Tasseling & silking (most important)', 'Grain filling'],
    irrigationCountHi: 'खरीफ में बारिश के अनुसार 2–4; रबी/बसंत में 5–8 सिंचाई',
    irrigationCountEn: 'Kharif: 2–4 depending on rain; rabi/spring: 5–8 irrigations',
    soilHi: 'अच्छी जल निकासी वाली दोमट; पानी भराव बिल्कुल नहीं सहती',
    soilEn: 'Well-drained loam; cannot stand waterlogging at all',
    commonVarietiesHi: ['HQPM 1', 'PMH 1', 'DHM 117', 'पूसा HM 4 (उन्नत)', 'विवेक QPM 9'],
    commonVarietiesEn: ['HQPM 1', 'PMH 1', 'DHM 117', 'Pusa HM 4 (Improved)', 'Vivek QPM 9'],
    majorPestsDiseases: ['maize-fall-armyworm', 'maize-stem-borer', 'maize-shoot-fly', 'maize-turcicum-leaf-blight', 'maize-maydis-leaf-blight', 'maize-stalk-rot'],
    sources: [
      PAU_KHARIF,
      PAU_RABI,
      'https://iimr.icar.gov.in/?page_id=148',
      `${TNAU}/agriculture/millets_maize_irrigated_maize_seedandsowing.html`,
    ],
  }),

  bajra: def('bajra', {
    otherNamesHi: ['बाजरी', 'पर्ल मिलेट'],
    category: 'millet',
    sowingMonths: { kharif: [6, 7], zaid: [2, 3] },
    sowingWindowHi: 'जुलाई का पहला पखवाड़ा (मानसून की पहली अच्छी बारिश पर); गर्मी (गुजरात/राजस्थान): फरवरी–मार्च',
    sowingWindowEn: 'First fortnight of July (with the first good monsoon rain); summer crop (Gujarat/Rajasthan): February–March',
    durationDays: { min: 75, max: 95 },
    stages: [
      st('germination', 0, GERM),
      st('vegetative', 12, TILLER),
      st('vegetative', 25, PI),
      st('flowering', 45, ['बाली निकलना व फूल (Flowering)', 'Ear emergence & flowering']),
      st('fruiting', 55, GRAIN),
      st('maturity', 72, MATURE),
    ],
    seedRateKgPerAcre: { min: 1.5, max: 2 },
    spacingHi: '45–50×12–15 सेमी; बहुत सूखे क्षेत्र में कतार 60 सेमी; 3 हफ्ते पर छंटाई',
    spacingEn: '45–50×12–15 cm; 60 cm rows in very dry areas; thin at 3 weeks',
    recommendedNPKKgPerHa: { n: 60, p: 30, k: 20 },
    npkNoteHi: 'सिंचित हाइब्रिड में N:P:K लगभग 32:16:16 किलो/एकड़; बारानी में 16:8:0 किलो/एकड़',
    npkNoteEn: 'Irrigated hybrids about 32:16:16 kg/acre N:P:K; rainfed 16:8:0 kg/acre',
    criticalIrrigationHi: ['कल्ले निकलना', 'फूल आना', 'दाना भरना'],
    criticalIrrigationEn: ['Tillering', 'Flowering', 'Grain filling'],
    irrigationCountHi: 'ज़्यादातर बारानी; लंबा सूखा पड़े तो फूल और दाना भरते समय 1–2 सिंचाई',
    irrigationCountEn: 'Mostly rainfed; in a long dry spell give 1–2 irrigations at flowering and grain filling',
    soilHi: 'हल्की बलुई दोमट; कम उपजाऊ व सूखे क्षेत्र में भी, पर पानी भराव नहीं',
    soilEn: 'Light sandy loam; grows in poor, dry areas too, but not in waterlogging',
    commonVarietiesHi: ['HHB 67 (उन्नत)', 'ICTP 8203', 'धनशक्ति (आयरन भरपूर)', 'RHB 177', 'पूसा 1201'],
    commonVarietiesEn: ['HHB 67 (Improved)', 'ICTP 8203', 'Dhanashakti (iron-rich)', 'RHB 177', 'Pusa 1201'],
    majorPestsDiseases: ['bajra-downy-mildew', 'bajra-ergot', 'bajra-smut', 'bajra-rust', 'bajra-shoot-fly', 'bajra-white-grub'],
    sources: [
      'https://millets.res.in/technologies/Recommended_package_of_practices-Pearl_millet.pdf',
      'http://www.aicpmip.res.in/technologies.html',
      PAU_KHARIF,
      `${TNAU}/agriculture/millets_cumbu.html`,
    ],
  }),

  jowar: def('jowar', {
    otherNamesHi: ['जोंधरी', 'चरी (चारे वाली ज्वार)'],
    category: 'millet',
    sowingMonths: { kharif: [6, 7], rabi: [9, 10] },
    sowingWindowHi: 'खरीफ: जून के आखिर से जुलाई पहला हफ्ता; रबी (महाराष्ट्र/कर्नाटक): सितंबर आखिर से अक्टूबर मध्य',
    sowingWindowEn: 'Kharif: late June to first week of July; rabi (Maharashtra/Karnataka): late September to mid October',
    durationDays: { min: 100, max: 120 },
    stages: [
      st('germination', 0, GERM),
      st('vegetative', 15, EARLY),
      st('vegetative', 35, PI),
      st('flowering', 65, ['बाली निकलना व फूल (Flowering)', 'Panicle emergence & flowering']),
      st('fruiting', 75, GRAIN),
      st('maturity', 100, MATURE),
    ],
    seedRateKgPerAcre: { min: 3, max: 5, noteHi: '3–4 किलो; देर से बुवाई पर 4–5 किलो', noteEn: '3–4 kg; 4–5 kg for late sowing' },
    spacingHi: '45×15 सेमी',
    spacingEn: '45×15 cm',
    recommendedNPKKgPerHa: { n: 80, p: 40, k: 40 },
    npkNoteHi: 'बारानी रबी ज्वार में कम मात्रा (लगभग 16:8:0 किलो/एकड़)',
    npkNoteEn: 'Rainfed rabi sorghum needs less (about 16:8:0 kg/acre)',
    criticalIrrigationHi: ['बाली बनना (PI)', 'फूल आना', 'दाना भरना'],
    criticalIrrigationEn: ['Panicle initiation (PI)', 'Flowering', 'Grain filling'],
    irrigationCountHi: 'खरीफ में बारानी; रबी में 2–3 सिंचाई (बाली बनना, फूल, दाना भरना)',
    irrigationCountEn: 'Kharif: rainfed; rabi: 2–3 irrigations (panicle initiation, flowering, grain filling)',
    soilHi: 'मध्यम से भारी काली व दोमट मिट्टी; रबी ज्वार के लिए नमी रोकने वाली गहरी काली मिट्टी',
    soilEn: 'Medium to heavy black and loam soils; rabi sorghum needs deep black soil that holds moisture',
    commonVarietiesHi: ['CSH 16', 'CSH 25', 'CSV 20', 'M 35-1 (मालदांडी, रबी)', 'फुले वसुधा (रबी)'],
    commonVarietiesEn: ['CSH 16', 'CSH 25', 'CSV 20', 'M 35-1 (Maldandi, rabi)', 'Phule Vasudha (rabi)'],
    majorPestsDiseases: ['jowar-shoot-fly', 'jowar-stem-borer', 'jowar-midge', 'jowar-grain-mold', 'jowar-charcoal-rot'],
    sources: [
      'https://www.millets.res.in/farmer/Recommended_package_of_Practices_Kharif.pdf',
      'https://www.millets.res.in/farmer/Recommended_packages_of_practices_Rabi_sorghum.pdf',
      `${TNAU}/agriculture/millets_sorghum.html`,
    ],
  }),

  barley: def('barley', {
    otherNamesHi: ['जव'],
    category: 'cereal',
    sowingMonths: { rabi: [10, 11] },
    sowingWindowHi: 'अक्टूबर के आखिर से नवंबर के तीसरे हफ्ते तक (उत्तर भारत)',
    sowingWindowEn: 'Late October to the third week of November (North India)',
    // PAU: PL 942 ~146 d; central India ~115–120 d.
    durationDays: { min: 115, max: 150 },
    stages: [
      st('germination', 0, GERM),
      st('vegetative', 20, TILLER),
      st('vegetative', 50, ['गांठ बनना (Jointing)', 'Jointing']),
      st('flowering', 75, ['बाली निकलना (Heading)', 'Heading']),
      st('fruiting', 90, GRAIN_MD),
      st('maturity', 115, MATURE),
    ],
    seedRateKgPerAcre: {
      min: 35,
      max: 50,
      noteHi: 'समय पर 35–40 किलो; बारानी/पछेती में 45–50 किलो',
      noteEn: 'Timely 35–40 kg; rainfed/late 45–50 kg',
    },
    spacingHi: 'कतार से कतार 22.5 सेमी; पछेती में 18 सेमी',
    spacingEn: 'Rows 22.5 cm apart; 18 cm for late sowing',
    recommendedNPKKgPerHa: { n: 60, p: 30, k: 20 },
    npkNoteHi: 'माल्ट जौ में N 32 किलो/एकड़ तक; बारानी में आधी मात्रा',
    npkNoteEn: 'Malt barley up to 32 kg N/acre; half the dose under rainfed conditions',
    criticalIrrigationHi: ['कल्ले — 30–35 दिन', 'झंडा पत्ती — 60–65 दिन', 'दूधिया दाना — 85–90 दिन'],
    criticalIrrigationEn: ['Tillering — 30–35 days', 'Flag leaf — 60–65 days', 'Milk stage — 85–90 days'],
    irrigationCountHi: '2–3 सिंचाई काफी; बारानी में भी हो जाता है',
    irrigationCountEn: '2–3 irrigations are enough; also grows rainfed',
    soilHi: 'बलुई दोमट; हल्की लवणीय/क्षारीय और कम उपजाऊ मिट्टी भी सह लेता है',
    soilEn: 'Sandy loam; tolerates mildly saline/alkaline and poor soils',
    commonVarietiesHi: ['RD 2552', 'RD 2794', 'DWRB 101 (माल्ट)', 'BH 393', 'PL 891 (छिलका रहित)'],
    commonVarietiesEn: ['RD 2552', 'RD 2794', 'DWRB 101 (malt)', 'BH 393', 'PL 891 (hulless)'],
    majorPestsDiseases: ['barley-yellow-rust', 'barley-covered-smut', 'barley-loose-smut', 'barley-stripe-disease', 'barley-aphid'],
    sources: [PAU_RABI, `${VIKAS}/cereals-and-millets/barley?lgn=en`],
  }),

  gram: def('gram', {
    otherNamesHi: ['छोला', 'काबुली चना', 'देसी चना'],
    category: 'pulse',
    sowingMonths: { rabi: [10, 11] },
    sowingWindowHi: 'बारानी: अक्टूबर का दूसरा–तीसरा हफ्ता; सिंचित: नवंबर का पहला पखवाड़ा',
    sowingWindowEn: 'Rainfed: second–third week of October; irrigated: first fortnight of November',
    // Central India ~100–110 d; PAU (PBG 10 153 d, GPF 2 ~170 d) much longer.
    durationDays: { min: 100, max: 170 },
    stages: [
      st('germination', 0, GERM),
      st('vegetative', 20, BRANCH),
      st('flowering', 65, FLOWER),
      st('fruiting', 90, ['फली व दाना बनना (Pod filling)', 'Pod formation & filling']),
      st('maturity', 120, MATURE),
    ],
    seedRateKgPerAcre: {
      min: 25,
      max: 40,
      noteHi: 'छोटे दाने वाली देसी किस्में 25–30 किलो; काबुली/बड़े दाने 35–40 किलो',
      noteEn: 'Small-seeded desi 25–30 kg; kabuli/bold-seeded 35–40 kg',
    },
    seedOptions: [
      { labelHi: 'देसी (छोटा दाना)', labelEn: 'Desi (small seed)', min: 25, max: 30 },
      { labelHi: 'काबुली / बड़ा दाना', labelEn: 'Kabuli / bold seed', min: 35, max: 40 },
    ],
    spacingHi: 'देसी 30×10 सेमी; काबुली 45×10 सेमी',
    spacingEn: 'Desi 30×10 cm; kabuli 45×10 cm',
    recommendedNPKKgPerHa: { n: 20, p: 40, k: 20 },
    npkNoteHi: 'सल्फर 8 किलो/एकड़; राइज़ोबियम व PSB कल्चर से बीज उपचार',
    npkNoteEn: 'Sulphur 8 kg/acre; treat seed with Rhizobium and PSB culture',
    criticalIrrigationHi: ['फूल आने से पहले (45–50 दिन)', 'फली बनना (75–90 दिन)'],
    criticalIrrigationEn: ['Before flowering (45–50 days)', 'Pod formation (75–90 days)'],
    irrigationCountHi: 'ज़्यादातर बारानी; 1–2 हल्की सिंचाई; फूल खिलते समय भारी सिंचाई न करें',
    irrigationCountEn: 'Mostly rainfed; 1–2 light irrigations; no heavy irrigation at flowering',
    soilHi: 'हल्की से मध्यम दोमट व काली मिट्टी, अच्छी जल निकासी; पानी भराव नहीं',
    soilEn: 'Light to medium loam and black soils with good drainage; no waterlogging',
    commonVarietiesHi: ['JG 11', 'JG 14', 'पूसा 372', 'GNG 1581', 'काबुली — KAK 2'],
    commonVarietiesEn: ['JG 11', 'JG 14', 'Pusa 372', 'GNG 1581', 'Kabuli — KAK 2'],
    majorPestsDiseases: ['gram-pod-borer', 'gram-wilt', 'gram-dry-root-rot', 'gram-ascochyta-blight', 'gram-cutworm'],
    sources: [
      PAU_RABI,
      `${VIKAS}/pulses/chick-pea?lgn=en`,
      `${TNAU}/agriculture/CropProduction/Pulses/pulses_bengalgram.html`,
      'https://iipr.icar.gov.in/mandate-crops-old/',
    ],
  }),

  arhar: def('arhar', {
    otherNamesHi: ['तूर', 'तुअर', 'रहर'],
    category: 'pulse',
    sowingMonths: { kharif: [5, 6, 7] },
    sowingWindowHi: 'जून मध्य से जुलाई पहला हफ्ता (मानसून के साथ); जल्दी पकने वाली किस्में मई आखिर–जून',
    sowingWindowEn: 'Mid June to first week of July (with the monsoon); early varieties late May–June',
    durationDays: { min: 150, max: 200 },
    stages: [
      st('germination', 0, GERM),
      st('vegetative', 20, EARLY),
      st('vegetative', 45, BRANCH),
      st('flowering', 105, FLOWER),
      st('fruiting', 125, ['फली बनना व दाना भरना (Pod filling)', 'Pod formation & grain filling']),
      st('maturity', 150, MATURE),
    ],
    seedRateKgPerAcre: {
      min: 5,
      max: 8,
      noteHi: 'मध्यम अवधि 5–6 किलो; जल्दी पकने वाली किस्मों में 6–8 किलो',
      noteEn: 'Medium duration 5–6 kg; early varieties 6–8 kg',
    },
    spacingHi: 'मध्यम अवधि 75×20–25 सेमी; जल्दी पकने वाली 45–60×15–20 सेमी; मेड़ पर बुवाई अच्छी',
    spacingEn: 'Medium duration 75×20–25 cm; early 45–60×15–20 cm; ridge sowing is better',
    recommendedNPKKgPerHa: { n: 20, p: 50, k: 20 },
    npkNoteHi: 'सल्फर 8 किलो/एकड़; राइज़ोबियम व PSB से बीज उपचार',
    npkNoteEn: 'Sulphur 8 kg/acre; treat seed with Rhizobium and PSB',
    criticalIrrigationHi: ['फूल आना', 'फली बनना'],
    criticalIrrigationEn: ['Flowering', 'Pod formation'],
    irrigationCountHi: 'आमतौर पर बारानी; सूखे में फूल व फली बनते समय 1–2 सिंचाई; पानी भराव से बचाएं',
    irrigationCountEn: 'Usually rainfed; in drought 1–2 irrigations at flowering and pod formation; avoid waterlogging',
    soilHi: 'अच्छी जल निकासी वाली दोमट या हल्की काली मिट्टी; पानी भराव से उकठा बढ़ता है',
    soilEn: 'Well-drained loam or light black soil; waterlogging increases wilt',
    commonVarietiesHi: ['ICPL 87119 (आशा)', 'पूसा 992', 'UPAS 120 (जल्दी)', 'BDN 711', 'नरेंद्र अरहर 1 (देर से)'],
    commonVarietiesEn: ['ICPL 87119 (Asha)', 'Pusa 992', 'UPAS 120 (early)', 'BDN 711', 'Narendra Arhar 1 (late)'],
    majorPestsDiseases: ['arhar-pod-borer', 'arhar-pod-fly', 'arhar-spotted-pod-borer', 'arhar-wilt', 'arhar-sterility-mosaic', 'arhar-phytophthora-blight'],
    sources: [
      PAU_KHARIF,
      `${VIKAS}/pulses/pigeon-pea?lgn=en`,
      `${TNAU}/agriculture/CropProduction/Pulses/pulses_redgram.html`,
    ],
  }),

  moong: def('moong', {
    otherNamesHi: ['मूँग', 'ग्रीन ग्राम'],
    category: 'pulse',
    sowingMonths: { kharif: [6, 7], zaid: [3, 4] },
    sowingWindowHi: 'खरीफ: जून आखिर से जुलाई मध्य; गर्मी: 20 मार्च से 10 अप्रैल (गेहूं कटने के बाद)',
    sowingWindowEn: 'Kharif: late June to mid July; summer: 20 March to 10 April (after the wheat harvest)',
    durationDays: { min: 60, max: 75 },
    stages: [
      st('germination', 0, GERM),
      st('vegetative', 10, LEAF_BRANCH),
      st('flowering', 30, FLOWER),
      st('fruiting', 40, POD_FILL),
      st('maturity', 55, POD_MATURE),
    ],
    seedRateKgPerAcre: { min: 6, max: 12, noteHi: 'खरीफ में 6–8 किलो; गर्मी में 10–12 किलो', noteEn: 'Kharif 6–8 kg; summer 10–12 kg' },
    seedOptions: [
      { labelHi: 'खरीफ', labelEn: 'Kharif', min: 6, max: 8 },
      { labelHi: 'गर्मी (जायद)', labelEn: 'Summer (zaid)', min: 10, max: 12 },
    ],
    spacingHi: 'खरीफ 30–45×10 सेमी; गर्मी 22.5–30×5–7 सेमी',
    spacingEn: 'Kharif 30–45×10 cm; summer 22.5–30×5–7 cm',
    recommendedNPKKgPerHa: { n: 20, p: 40, k: 20 },
    npkNoteHi: 'सल्फर 8 किलो/एकड़; राइज़ोबियम कल्चर से बीज उपचार',
    npkNoteEn: 'Sulphur 8 kg/acre; treat seed with Rhizobium culture',
    criticalIrrigationHi: ['फूल आना', 'फली भरना'],
    criticalIrrigationEn: ['Flowering', 'Pod filling'],
    irrigationCountHi: 'खरीफ में आमतौर पर नहीं; गर्मी में 3–5 सिंचाई, 55 दिन बाद बंद',
    irrigationCountEn: 'Kharif: usually none; summer: 3–5 irrigations, none after 55 days',
    soilHi: 'दोमट व बलुई दोमट, अच्छी जल निकासी वाली',
    soilEn: 'Well-drained loam and sandy loam',
    commonVarietiesHi: ['SML 668', 'IPM 02-3', 'पूसा विशाल', 'विराट (IPM 205-7)', 'MH 421'],
    commonVarietiesEn: ['SML 668', 'IPM 02-3', 'Pusa Vishal', 'Virat (IPM 205-7)', 'MH 421'],
    majorPestsDiseases: ['moong-yellow-mosaic', 'moong-whitefly', 'moong-thrips', 'moong-cercospora-leaf-spot', 'moong-powdery-mildew'],
    sources: [
      PAU_KHARIF,
      PAU_RABI,
      `${TNAU}/agriculture/English%20Version/Agriculture/CropProduction/Pulses/pulses_greengram.html`,
    ],
  }),

  urad: def('urad', {
    otherNamesHi: ['उरद', 'माश'],
    category: 'pulse',
    sowingMonths: { kharif: [6, 7], zaid: [3, 4] },
    sowingWindowHi: 'खरीफ: जुलाई का पहला–दूसरा हफ्ता (मानसून के साथ); गर्मी: मार्च–अप्रैल',
    sowingWindowEn: 'Kharif: first–second week of July (with the monsoon); summer: March–April',
    durationDays: { min: 70, max: 90 },
    stages: [
      st('germination', 0, GERM),
      st('vegetative', 12, LEAF_BRANCH),
      st('flowering', 35, FLOWER),
      st('fruiting', 45, POD_FILL),
      st('maturity', 65, POD_MATURE),
    ],
    seedRateKgPerAcre: { min: 6, max: 10, noteHi: 'खरीफ में 6–8 किलो; गर्मी में 8–10 किलो', noteEn: 'Kharif 6–8 kg; summer 8–10 kg' },
    spacingHi: '30–45×10 सेमी; गर्मी में 22.5–30 सेमी कतार',
    spacingEn: '30–45×10 cm; 22.5–30 cm rows in summer',
    recommendedNPKKgPerHa: { n: 20, p: 40, k: 20 },
    npkNoteHi: 'सल्फर 8 किलो/एकड़; राइज़ोबियम कल्चर से बीज उपचार',
    npkNoteEn: 'Sulphur 8 kg/acre; treat seed with Rhizobium culture',
    criticalIrrigationHi: ['फूल आना', 'फली भरना'],
    criticalIrrigationEn: ['Flowering', 'Pod filling'],
    irrigationCountHi: 'खरीफ में बारानी; गर्मी की फसल में 3–4 सिंचाई',
    irrigationCountEn: 'Kharif: rainfed; summer crop: 3–4 irrigations',
    soilHi: 'दोमट से भारी दोमट व काली मिट्टी; जल निकासी ज़रूरी',
    soilEn: 'Loam to heavy loam and black soils; drainage is essential',
    commonVarietiesHi: ['PU 31', 'IPU 2-43', 'मास 114', 'T 9'],
    commonVarietiesEn: ['PU 31', 'IPU 2-43', 'Mash 114', 'T 9'],
    majorPestsDiseases: ['urad-yellow-mosaic', 'urad-whitefly', 'urad-leaf-crinkle', 'urad-cercospora-leaf-spot', 'urad-pod-borer'],
    sources: [
      PAU_KHARIF,
      PAU_RABI,
      `${TNAU}/agriculture/CropProduction/Pulses/BlackgramIrrigated.html`,
      `${TNAU}/agriculture/CropProduction/Pulses/BlackgramRainfed.html`,
    ],
  }),

  masoor: def('masoor', {
    otherNamesHi: ['मसूरी', 'मसूर दाल'],
    category: 'pulse',
    sowingMonths: { rabi: [10, 11] },
    sowingWindowHi: 'अक्टूबर आखिर से नवंबर मध्य (उत्तर भारत); धान के बाद उतेरा/पैरा बुवाई भी',
    sowingWindowEn: 'Late October to mid November (North India); also relay (utera/paira) sowing after paddy',
    // PAU: LL 1373 ~140 d, LL 931 ~146 d; central/eastern India ~110–120 d.
    durationDays: { min: 110, max: 150 },
    stages: [
      st('germination', 0, GERM),
      st('vegetative', 20, BRANCH),
      st('flowering', 70, FLOWER),
      st('fruiting', 90, POD_FILL),
      st('maturity', 115, MATURE),
    ],
    seedRateKgPerAcre: {
      min: 12,
      max: 20,
      noteHi: 'छोटे दाने 12–15 किलो; बड़े दाने या पछेती में 18–20 किलो',
      noteEn: 'Small-seeded 12–15 kg; bold-seeded or late sown 18–20 kg',
    },
    spacingHi: 'कतार 22.5–30 सेमी; पछेती में 20 सेमी',
    spacingEn: 'Rows 22.5–30 cm; 20 cm for late sowing',
    recommendedNPKKgPerHa: { n: 20, p: 40, k: 20 },
    npkNoteHi: 'सल्फर 8 किलो/एकड़; राइज़ोबियम कल्चर से बीज उपचार',
    npkNoteEn: 'Sulphur 8 kg/acre; treat seed with Rhizobium culture',
    criticalIrrigationHi: ['शाखाएं बनना (40–45 दिन)', 'फली बनना (70–75 दिन)'],
    criticalIrrigationEn: ['Branching (40–45 days)', 'Pod formation (70–75 days)'],
    irrigationCountHi: '1–2 हल्की सिंचाई; एक ही हो तो 6 हफ्ते पर',
    irrigationCountEn: '1–2 light irrigations; if only one, give it at 6 weeks',
    soilHi: 'दोमट से हल्की चिकनी, उदासीन मिट्टी (pH 6.5–7.5)',
    soilEn: 'Loam to light clay, neutral soil (pH 6.5–7.5)',
    commonVarietiesHi: ['पूसा वैभव', 'IPL 316', 'LL 1373', 'HUL 57', 'पंत मसूर 8'],
    commonVarietiesEn: ['Pusa Vaibhav', 'IPL 316', 'LL 1373', 'HUL 57', 'Pant Masoor 8'],
    majorPestsDiseases: ['masoor-wilt', 'masoor-rust', 'masoor-stemphylium-blight', 'masoor-aphid', 'masoor-pod-borer'],
    sources: [PAU_RABI, `${VIKAS}/pulses/lentil-rabi?lgn=en`],
  }),

  mustard: def('mustard', {
    otherNamesHi: ['राई', 'लाही', 'तोरिया (जल्दी वाली)'],
    category: 'oilseed',
    sowingMonths: { rabi: [9, 10, 11] },
    sowingWindowHi: 'अक्टूबर का पहला से तीसरा हफ्ता (उत्तर भारत); तोरिया सितंबर में',
    sowingWindowEn: 'First to third week of October (North India); toria in September',
    durationDays: { min: 120, max: 150 },
    stages: [
      st('germination', 0, GERM),
      st('vegetative', 15, ['पत्तियां बनना (Rosette)', 'Rosette']),
      st('vegetative', 30, BRANCH),
      st('flowering', 45, FLOWER),
      st('fruiting', 70, ['फलियां बनना व दाना भरना (Siliqua)', 'Siliqua formation & filling']),
      st('maturity', 110, MATURE),
    ],
    seedRateKgPerAcre: { min: 1.5, max: 2 },
    spacingHi: '45×10–15 सेमी; 15–20 दिन पर घने पौधे निकालें',
    spacingEn: '45×10–15 cm; thin out crowded plants at 15–20 days',
    recommendedNPKKgPerHa: { n: 80, p: 40, k: 40 },
    npkNoteHi: 'सल्फर लगभग 16 किलो/एकड़ (जैसे जिप्सम लगभग 90 किलो) ज़रूर दें; बारानी में N:P:K लगभग 16:8:8 किलो/एकड़',
    npkNoteEn: 'Always give about 16 kg sulphur/acre (e.g. about 90 kg gypsum); rainfed N:P:K about 16:8:8 kg/acre',
    criticalIrrigationHi: ['शाखाएं बनना / फूल से पहले (30–35 दिन)', 'फलियां भरना (60–70 दिन)'],
    criticalIrrigationEn: ['Branching / before flowering (30–35 days)', 'Siliqua filling (60–70 days)'],
    irrigationCountHi: '1–2 सिंचाई; बारानी भी उगती है',
    irrigationCountEn: '1–2 irrigations; also grows rainfed',
    soilHi: 'हल्की से भारी दोमट; हल्की लवणीय मिट्टी भी सह लेती है',
    soilEn: 'Light to heavy loam; tolerates mild salinity',
    commonVarietiesHi: ['पूसा बोल्ड', 'RH 725', 'RH 749', 'गिरिराज (DRMRIJ 31)', 'NRCHB 101'],
    commonVarietiesEn: ['Pusa Bold', 'RH 725', 'RH 749', 'Giriraj (DRMRIJ 31)', 'NRCHB 101'],
    majorPestsDiseases: ['mustard-aphid', 'mustard-painted-bug', 'mustard-sawfly', 'mustard-alternaria-blight', 'mustard-white-rust', 'mustard-sclerotinia-rot'],
    sources: [
      PAU_RABI,
      `${VIKAS}/oilseeds/mustard-and-rapeseed?lgn=en`,
      'https://www.drmr.res.in/technologies_developed.php',
    ],
  }),

  soybean: def('soybean', {
    otherNamesHi: ['सोया'],
    category: 'oilseed',
    sowingMonths: { kharif: [6, 7] },
    sowingWindowHi: 'जून का तीसरा हफ्ता से जुलाई पहला हफ्ता (लगभग 100 मिमी बारिश होने पर)',
    sowingWindowEn: 'Third week of June to first week of July (after about 100 mm of rain)',
    durationDays: { min: 90, max: 110 },
    stages: [
      st('germination', 0, GERM),
      st('vegetative', 12, LEAF_BRANCH),
      st('flowering', 38, FLOWER),
      st('fruiting', 52, ['फली बनना व दाना भरना (Pod filling)', 'Pod formation & seed filling']),
      st('maturity', 85, MATURE),
    ],
    seedRateKgPerAcre: {
      min: 26,
      max: 32,
      noteHi: 'छोटे दाने 26 किलो; बड़े दाने 30–32 किलो (अंकुरण 70% से ऊपर हो)',
      noteEn: 'Small-seeded 26 kg; bold-seeded 30–32 kg (germination should be above 70%)',
    },
    spacingHi: 'कतार 45 सेमी, पौधे 4–5 सेमी; रिज-फरो या चौड़ी क्यारी (BBF) विधि अच्छी',
    spacingEn: 'Rows 45 cm, plants 4–5 cm; ridge-furrow or broad bed furrow (BBF) is better',
    recommendedNPKKgPerHa: { n: 20, p: 60, k: 40 },
    npkNoteHi: 'सल्फर 8–12 किलो/एकड़; राइज़ोबियम व PSB से बीज उपचार',
    npkNoteEn: 'Sulphur 8–12 kg/acre; treat seed with Rhizobium and PSB',
    criticalIrrigationHi: ['फूल आना', 'फली भरना'],
    criticalIrrigationEn: ['Flowering', 'Pod filling'],
    irrigationCountHi: 'आमतौर पर बारानी; फली भरते समय लंबा सूखा हो तो 1 सिंचाई',
    irrigationCountEn: 'Usually rainfed; one irrigation if a long dry spell hits pod filling',
    soilHi: 'अच्छी जल निकासी वाली दोमट व मध्यम काली मिट्टी; पानी भराव नुकसानदेह',
    soilEn: 'Well-drained loam and medium black soil; waterlogging is harmful',
    commonVarietiesHi: ['JS 20-34', 'JS 20-29', 'JS 95-60', 'RVS 2001-4', 'JS 335'],
    commonVarietiesEn: ['JS 20-34', 'JS 20-29', 'JS 95-60', 'RVS 2001-4', 'JS 335'],
    majorPestsDiseases: ['soybean-yellow-mosaic', 'soybean-girdle-beetle', 'soybean-stem-fly', 'soybean-semilooper', 'soybean-charcoal-rot', 'soybean-anthracnose'],
    sources: [
      PAU_KHARIF,
      'https://iisrindore.icar.gov.in/goodagripractices.html',
      'https://iisrindore.icar.gov.in/faq.html',
      `${TNAU}/agriculture/CropProduction/Pulses/pulses_soybean.html`,
    ],
  }),

  groundnut: def('groundnut', {
    otherNamesHi: ['सींगदाना', 'मूंगफली (Peanut)'],
    category: 'oilseed',
    sowingMonths: { kharif: [6, 7], zaid: [1, 2, 3] },
    sowingWindowHi: 'खरीफ: जून मध्य से जुलाई पहला हफ्ता; गर्मी (सिंचित): जनवरी आखिर–फरवरी',
    sowingWindowEn: 'Kharif: mid June to first week of July; summer (irrigated): late January–February',
    durationDays: { min: 100, max: 130 },
    stages: [
      st('germination', 0, GERM),
      st('vegetative', 12, LEAF_BRANCH),
      st('flowering', 30, FLOWER),
      st('fruiting', 45, ['सुइयां ज़मीन में जाना (Pegging)', 'Pegging']),
      st('fruiting', 65, ['फली भरना (Pod filling)', 'Pod filling']),
      st('maturity', 95, MATURE),
    ],
    seedRateKgPerAcre: {
      min: 40,
      max: 60,
      noteHi: 'छिली गिरी (दाने); गुच्छेदार 40–50 किलो, बड़े दाने वाली 55–60 किलो',
      noteEn: 'Shelled kernels; bunch types 40–50 kg, bold-seeded 55–60 kg',
    },
    seedOptions: [
      { labelHi: 'गुच्छेदार (गिरी)', labelEn: 'Bunch type (kernels)', min: 40, max: 50 },
      { labelHi: 'बड़े दाने / फैलने वाली (गिरी)', labelEn: 'Bold / spreading (kernels)', min: 55, max: 60 },
    ],
    spacingHi: 'गुच्छेदार 30×10 सेमी; फैलने वाली 45×10–15 सेमी',
    spacingEn: 'Bunch 30×10 cm; spreading 45×10–15 cm',
    recommendedNPKKgPerHa: { n: 20, p: 40, k: 40 },
    npkNoteHi: 'जिप्सम लगभग 50–160 किलो/एकड़ (राज्य की सिफ़ारिश व मिट्टी जांच के अनुसार): आधा बुवाई पर, आधा 40–45 दिन पर सुई बनते समय',
    npkNoteEn: 'Gypsum about 50–160 kg/acre (as per state advice and soil test): half at sowing, half at pegging (40–45 days)',
    criticalIrrigationHi: ['फूल आना', 'सुइयां बनना (Pegging)', 'फली भरना'],
    criticalIrrigationEn: ['Flowering', 'Pegging', 'Pod filling'],
    irrigationCountHi: 'खरीफ में बारानी, सूखा पड़े तो 1–2; गर्मी की फसल में 6–8 सिंचाई',
    irrigationCountEn: 'Kharif: rainfed, 1–2 in a dry spell; summer crop: 6–8 irrigations',
    soilHi: 'हल्की बलुई दोमट, भुरभुरी और अच्छी जल निकासी वाली; भारी चिकनी मिट्टी नहीं',
    soilEn: 'Light, friable, well-drained sandy loam; not heavy clay',
    commonVarietiesHi: ['TAG 24', 'TG 37A', 'GG 20', 'गिरनार 4', 'कदिरी 6 (K 6)'],
    commonVarietiesEn: ['TAG 24', 'TG 37A', 'GG 20', 'Girnar 4', 'Kadiri 6 (K 6)'],
    majorPestsDiseases: ['groundnut-tikka-leaf-spot', 'groundnut-rust', 'groundnut-collar-rot', 'groundnut-stem-rot', 'groundnut-white-grub', 'groundnut-leaf-miner'],
    sources: [
      PAU_KHARIF,
      `${TNAU}/agriculture/CropProduction/Oilseeds/oilseeds_groundnut01.html`,
      `${VIKAS}/oilseeds/groundnut-package-and-practices?lgn=en`,
    ],
  }),

  cotton: def('cotton', {
    otherNamesHi: ['नरमा (अमेरिकन कपास)', 'देसी कपास', 'रुई'],
    category: 'cash',
    sowingMonths: { kharif: [4, 5, 6, 7] },
    sowingWindowHi: 'उत्तर भारत (सिंचित): 1 अप्रैल से 15 मई; मध्य व दक्षिण भारत: जून–जुलाई मानसून के साथ',
    sowingWindowEn: 'North India (irrigated): 1 April to 15 May; Central and South India: June–July with the monsoon',
    durationDays: { min: 140, max: 160 },
    harvestSpanDays: 45,
    stages: [
      st('germination', 0, GERM),
      st('vegetative', 15, EARLY),
      st('flowering', 40, ['कलियां बनना (Squaring)', 'Squaring']),
      st('flowering', 60, FLOWER),
      st('fruiting', 80, ['टिंडे बनना व बढ़ना (Boll development)', 'Boll development']),
      st('maturity', 125, ['टिंडे खुलना व चुनाई (Boll opening)', 'Boll opening & picking']),
    ],
    // PAU Kharif 2026 seed table; the range spans every seed type, so calculators should use seedOptions.
    seedRateKgPerAcre: {
      min: 0.95,
      max: 5,
      noteHi: 'Bt हाइब्रिड: 475 ग्राम के 2 पैकेट/एकड़ (रिफ्यूज बीज मिला हुआ); Bt किस्में (PAU Bt 2/3): 4 किलो + 1 किलो रिफ्यूज; देसी/सीधी किस्में: 3–3.5 किलो',
      noteEn: 'Bt hybrids: 2 packets of 475 g per acre (refuge seed already mixed in); Bt varieties (PAU Bt 2/3): 4 kg + 1 kg refuge; desi/straight varieties: 3–3.5 kg',
    },
    seedOptions: [
      { labelHi: 'Bt हाइब्रिड (2 पैकेट, रिफ्यूज मिला हुआ)', labelEn: 'Bt hybrid (2 packets, refuge mixed in)', min: 0.95, max: 0.95 },
      { labelHi: 'Bt किस्म (PAU Bt 2/3) + रिफ्यूज', labelEn: 'Bt variety (PAU Bt 2/3) + refuge', min: 5, max: 5 },
      { labelHi: 'देसी / सीधी (नॉन-Bt) किस्म', labelEn: 'Desi / straight (non-Bt) variety', min: 3, max: 3.5 },
    ],
    spacingHi: 'उत्तर भारत Bt हाइब्रिड 67.5×75 सेमी; मध्य भारत 90–120×45–60 सेमी',
    spacingEn: 'North India Bt hybrids 67.5×75 cm; Central India 90–120×45–60 cm',
    recommendedNPKKgPerHa: { n: 120, p: 60, k: 60 },
    npkNoteHi: 'बारानी में N:P:K लगभग 32:16:16 किलो/एकड़; नाइट्रोजन आधा छंटाई पर व आधा फूल आने पर',
    npkNoteEn: 'Rainfed about 32:16:16 kg/acre N:P:K; half the N at thinning and half at flowering',
    criticalIrrigationHi: ['कलियां बनना (Squaring)', 'फूल आना', 'टिंडे बनना'],
    criticalIrrigationEn: ['Squaring', 'Flowering', 'Boll formation'],
    irrigationCountHi: 'उत्तर भारत में 4–6 सिंचाई; बारानी में बारिश पर निर्भर; टिंडे खुलने लगें तो सिंचाई बंद',
    irrigationCountEn: 'North India 4–6 irrigations; rainfed depends on rain; stop when bolls start opening',
    soilHi: 'गहरी काली मिट्टी व जल निकासी वाली दोमट; उत्तर भारत में बलुई दोमट',
    soilEn: 'Deep black soil and well-drained loam; sandy loam in North India',
    commonVarietiesHi: ['राज्य द्वारा अनुशंसित Bt हाइब्रिड', 'PAU Bt 2', 'PAU Bt 3', 'LD 949 (देसी)', 'सूरज (CICR, सीधी किस्म)'],
    commonVarietiesEn: ['State-recommended Bt hybrids', 'PAU Bt 2', 'PAU Bt 3', 'LD 949 (desi)', 'Suraj (CICR, straight variety)'],
    majorPestsDiseases: ['cotton-pink-bollworm', 'cotton-whitefly', 'cotton-jassid', 'cotton-thrips', 'cotton-leaf-curl-virus', 'cotton-boll-rot'],
    sources: [PAU_KHARIF, 'https://cicr.org.in/famers-corner/farm-corner-front-line-demo/'],
  }),

  sugarcane: def('sugarcane', {
    otherNamesHi: ['ईख', 'ऊख'],
    category: 'cash',
    // Base profile = spring planting; autumn cane is the rabi variant.
    sowingMonths: { zaid: [2, 3], rabi: [9, 10, 11] },
    sowingWindowHi: 'बसंतकालीन: मध्य फरवरी–मार्च; शरदकालीन: 20 सितंबर–अक्टूबर (उ.प्र. में नवंबर तक) (उत्तर भारत)',
    sowingWindowEn: 'Spring: mid February–March; autumn: 20 September–October (to November in UP) (North India)',
    durationDays: { min: 300, max: 365 },
    stages: CANE_STAGES,
    variants: {
      // PAU: plant 20 Sep–20 Oct, crush Plant (A) in Dec–Jan of the next year (~14–15 months).
      rabi: {
        labelHi: 'शरदकालीन गन्ना (14–15 महीने)',
        labelEn: 'Autumn-planted cane (14–15 months)',
        durationDays: { min: 400, max: 480 },
        stages: restage(CANE_STAGES, [0, 45, 230, 360]),
      },
    },
    seedRateKgPerAcre: {
      min: 2500,
      max: 3200,
      noteHi: '25–32 क्विंटल टुकड़े (लगभग 30,000 दो-आंख वाले)/एकड़; 6–8 महीने की स्वस्थ फसल से',
      noteEn: '25–32 quintals of setts (about 30,000 two-bud setts) per acre, from a healthy 6–8 month-old crop',
    },
    spacingHi: 'कतार से कतार 75–90 सेमी; ट्रेंच विधि में 120 सेमी',
    spacingEn: 'Rows 75–90 cm apart; 120 cm in the trench method',
    recommendedNPKKgPerHa: { n: 150, p: 60, k: 60 },
    npkNoteHi: 'पूरा फॉस्फोरस-पोटाश बुवाई पर। बसंतकालीन: आधा N जमाव के बाद पहली सिंचाई के साथ, आधा मई–जून में। शरदकालीन व पेड़ी: N लगभग डेढ़ गुना (PAU: 90 किलो N/एकड़), तीन हिस्सों में',
    npkNoteEn: 'All P and K at planting. Spring cane: half the N with the first irrigation after germination, half in May–June. Autumn cane and ratoon: about 1.5 times the N (PAU: 90 kg N/acre) in three splits',
    criticalIrrigationHi: ['जमाव', 'कल्ले निकलना (अप्रैल–जून की गर्मी में सबसे ज़रूरी)', 'तेज़ बढ़वार'],
    criticalIrrigationEn: ['Germination', 'Tillering (most critical in the April–June heat)', 'Grand growth'],
    irrigationCountHi: 'अप्रैल–जून में 7–12 दिन पर; बरसात में बारिश के अनुसार; सर्दी में महीने में एक',
    irrigationCountEn: 'Every 7–12 days in April–June; by rainfall in the monsoon; monthly in winter',
    soilHi: 'गहरी दोमट व चिकनी दोमट, अच्छी जल निकासी वाली',
    soilEn: 'Deep, well-drained loam and clay loam',
    commonVarietiesHi: ['Co 0118', 'CoLk 94184', 'Co 15023', 'CoS 13235', 'Co 86032 (दक्षिण भारत)'],
    commonVarietiesEn: ['Co 0118', 'CoLk 94184', 'Co 15023', 'CoS 13235', 'Co 86032 (South India)'],
    majorPestsDiseases: ['sugarcane-red-rot', 'sugarcane-smut', 'sugarcane-wilt', 'sugarcane-early-shoot-borer', 'sugarcane-top-borer', 'sugarcane-pyrilla'],
    sources: [
      PAU_RABI,
      PAU_KHARIF,
      'https://sugarcane.icar.gov.in/index.php/en/2014-04-28-06-09-34/schedule-of-operations',
      `${TNAU}/expert_system/sugar/cultivationpractices.html`,
      `${TNAU}/agriculture/agri_irrigationmgt_sugarcane.html`,
    ],
  }),

  potato: def('potato', {
    otherNamesHi: ['बटाटा'],
    category: 'vegetable',
    sowingMonths: { rabi: [9, 10, 11, 1] },
    sowingWindowHi: 'मैदानी क्षेत्र: अक्टूबर पहला पखवाड़ा से नवंबर मध्य; बसंत फसल जनवरी; पहाड़ों में मार्च–अप्रैल',
    sowingWindowEn: 'Plains: first fortnight of October to mid November; spring crop in January; hills March–April',
    durationDays: { min: 90, max: 120 },
    stages: [
      st('germination', 0, ['अंकुरण (Sprouting)', 'Sprouting']),
      st('vegetative', 20, ['पौधे बढ़ना व मिट्टी चढ़ाना', 'Plant growth & earthing up']),
      st('fruiting', 35, ['कंद बनना (Tuber initiation)', 'Tuber initiation']),
      st('fruiting', 55, ['कंद बढ़ना (Tuber bulking)', 'Tuber bulking']),
      st('maturity', 85, ['पकाव (पत्तियां पीली)', 'Maturity (leaves turn yellow)']),
    ],
    seedRateKgPerAcre: {
      min: 1200,
      max: 1800,
      noteHi: '12–18 क्विंटल बीज आलू (40–50 ग्राम के स्वस्थ कंद)/एकड़',
      noteEn: '12–18 quintals of seed tubers (healthy 40–50 g tubers) per acre',
    },
    spacingHi: 'मेड़ से मेड़ 60 सेमी, कंद से कंद 20 सेमी',
    spacingEn: 'Ridges 60 cm apart, tubers 20 cm apart',
    recommendedNPKKgPerHa: { n: 150, p: 80, k: 100 },
    npkNoteHi: 'आधा N और पूरा P-K बुवाई पर; बाकी N मिट्टी चढ़ाते समय; अच्छी सड़ी गोबर खाद भी',
    npkNoteEn: 'Half the N and all the P and K at planting; the rest of the N at earthing up; also well-rotted FYM',
    criticalIrrigationHi: ['स्टोलन बनना', 'कंद बनना', 'कंद बढ़ना'],
    criticalIrrigationEn: ['Stolon formation', 'Tuber initiation', 'Tuber bulking'],
    irrigationCountHi: '7–10 हल्की सिंचाई; मेड़ आधी ही डूबे; खुदाई से 10–15 दिन पहले बंद',
    irrigationCountEn: '7–10 light irrigations; water only half-way up the ridge; stop 10–15 days before digging',
    soilHi: 'भुरभुरी बलुई दोमट, अच्छी जल निकासी वाली (pH 5.5–7)',
    soilEn: 'Friable, well-drained sandy loam (pH 5.5–7)',
    commonVarietiesHi: ['कुफरी बहार', 'कुफरी पुखराज', 'कुफरी ज्योति', 'कुफरी मोहन', 'कुफरी चिपसोना 1'],
    commonVarietiesEn: ['Kufri Bahar', 'Kufri Pukhraj', 'Kufri Jyoti', 'Kufri Mohan', 'Kufri Chipsona 1'],
    majorPestsDiseases: ['potato-late-blight', 'potato-early-blight', 'potato-black-scurf', 'potato-common-scab', 'potato-aphid', 'potato-cutworm'],
    sources: [
      PAU_VEG,
      'https://cpri.icar.gov.in/Content/Index/?qlid=4190&Ls_is=5415&lngid=1',
      'https://nhb.gov.in/pdf/vegetable/potato/pot010.pdf',
      `${TNAU}/horticulture/horti_vegetables_potato.html`,
    ],
  }),

  onion: def('onion', {
    otherNamesHi: ['प्याज़', 'कांदा'],
    category: 'vegetable',
    sowingMonths: { rabi: [10, 11], kharif: [5, 6] },
    sowingWindowHi: 'रबी: नर्सरी अक्टूबर आखिर–नवंबर, रोपाई दिसंबर आखिर–जनवरी; खरीफ: नर्सरी मई–जून, रोपाई जुलाई–अगस्त',
    sowingWindowEn: 'Rabi: nursery late October–November, transplant late December–January; kharif: nursery May–June, transplant July–August',
    transplanted: true,
    nurseryDays: { min: 40, max: 50 },
    durationDays: { min: 100, max: 130 },
    stages: [
      st('germination', 0, EST),
      st('vegetative', 15, ['पत्तियां बढ़ना', 'Leaf growth']),
      st('fruiting', 50, ['गांठ बनना (Bulb initiation)', 'Bulb initiation']),
      st('fruiting', 70, ['गांठ बढ़ना (Bulb development)', 'Bulb development']),
      st('maturity', 100, ['पकाव (गर्दन गिरना)', 'Maturity (neck fall)']),
    ],
    seedRateKgPerAcre: { min: 3, max: 4, noteHi: 'एक एकड़ रोपाई के लिए नर्सरी बीज', noteEn: 'Nursery seed to transplant one acre' },
    spacingHi: '15×10 सेमी (क्यारी या चौड़ी मेड़ पर)',
    spacingEn: '15×10 cm (on beds or broad ridges)',
    recommendedNPKKgPerHa: { n: 100, p: 50, k: 50 },
    npkNoteHi: 'सल्फर 12 किलो/एकड़; आधा N रोपाई पर, बाकी 30 व 45 दिन पर; 60 दिन बाद N न दें',
    npkNoteEn: 'Sulphur 12 kg/acre; half the N at transplanting, the rest at 30 and 45 days; no N after 60 days',
    criticalIrrigationHi: ['रोपाई के बाद', 'गांठ बनना', 'गांठ बढ़ना'],
    criticalIrrigationEn: ['After transplanting', 'Bulb initiation', 'Bulb development'],
    irrigationCountHi: 'रबी में 12–15 सिंचाई (7–10 दिन पर); खुदाई से 10–15 दिन पहले बंद',
    irrigationCountEn: 'Rabi: 12–15 irrigations (every 7–10 days); stop 10–15 days before lifting',
    soilHi: 'भुरभुरी दोमट, अच्छी जल निकासी वाली (pH 6–7.5)',
    soilEn: 'Friable, well-drained loam (pH 6–7.5)',
    commonVarietiesHi: ['भीमा सुपर', 'भीमा शक्ति', 'भीमा रेड', 'एग्रीफाउंड लाइट रेड', 'N-53 (खरीफ)'],
    commonVarietiesEn: ['Bhima Super', 'Bhima Shakti', 'Bhima Red', 'Agrifound Light Red', 'N-53 (kharif)'],
    majorPestsDiseases: ['onion-thrips', 'onion-purple-blotch', 'onion-stemphylium-blight', 'onion-basal-rot', 'onion-damping-off'],
    sources: [
      PAU_VEG,
      'https://dogr.icar.gov.in/index.php?Itemid=189&id=118&lang=en&option=com_content&view=article',
      `${TNAU}/horticulture/horti_vegetables_bellaryonion.html`,
      'http://nhrdf.org/Onion.php',
    ],
  }),

  tomato: def('tomato', {
    otherNamesHi: ['टमाटो', 'बिलायती बैंगन'],
    category: 'vegetable',
    sowingMonths: { kharif: [7, 8], rabi: [9, 10], zaid: [11, 12] },
    sowingWindowHi: 'बरसात/शरद: नर्सरी जुलाई–अगस्त, रोपाई अगस्त–सितंबर; सर्दी (मुख्य): नर्सरी सितंबर–अक्टूबर, रोपाई नवंबर–दिसंबर (पाले से ढकें); बसंत: नर्सरी नवंबर आखिर–दिसंबर (पाले से बचाकर), रोपाई फरवरी',
    sowingWindowEn: 'Rainy/autumn: nursery July–August, transplant August–September; winter (main): nursery September–October, transplant November–December (cover against frost); spring: nursery late November–December (frost-protected), transplant February',
    transplanted: true,
    nurseryDays: { min: 25, max: 30 },
    durationDays: { min: 60, max: 75 },
    harvestSpanDays: 60,
    stages: [
      st('germination', 0, EST),
      st('vegetative', 10, VEG_BRANCH),
      st('flowering', 30, FLOWER),
      st('fruiting', 45, ['फल बनना व बढ़ना', 'Fruit set & development']),
      st('maturity', 60, ['फल पकना व तुड़ाई (कई बार)', 'Fruit ripening & repeated picking']),
    ],
    variants: {
      rabi: { labelHi: 'सर्दी की मुख्य फसल', labelEn: 'Winter main crop', nurseryDays: { min: 30, max: 40 } },
      // PAU: nursery end-November for February transplanting (polyhouse: last week of December → mid-February).
      zaid: { labelHi: WINTER_NURSERY[0], labelEn: WINTER_NURSERY[1], nurseryDays: { min: 50, max: 80 } },
    },
    seedRateKgPerAcre: {
      min: 0.06,
      max: 0.16,
      noteHi: 'नर्सरी के लिए 100–160 ग्राम (हाइब्रिड 60–80 ग्राम)/एकड़',
      noteEn: 'Nursery seed 100–160 g (hybrids 60–80 g) per acre',
    },
    spacingHi: '60×45 सेमी; हाइब्रिड/सहारा देकर 90×30 सेमी',
    spacingEn: '60×45 cm; hybrids/staked 90×30 cm',
    recommendedNPKKgPerHa: { n: 120, p: 80, k: 60 },
    npkNoteHi: 'आधा N रोपाई पर, बाकी 2 हिस्सों में 30 व 50 दिन पर; हाइब्रिड में ज़्यादा',
    npkNoteEn: 'Half the N at transplanting, the rest in 2 splits at 30 and 50 days; more for hybrids',
    criticalIrrigationHi: ['फूल आना', 'फल बनना व बढ़ना'],
    criticalIrrigationEn: ['Flowering', 'Fruit set & development'],
    irrigationCountHi: 'सर्दी में 10–12 दिन, गर्मी में 5–7 दिन पर; ड्रिप सबसे अच्छी; एकदम सूखा-गीला न होने दें (फल फटते हैं)',
    irrigationCountEn: 'Every 10–12 days in winter, 5–7 days in summer; drip is best; avoid dry-wet swings (fruits crack)',
    soilHi: 'अच्छी जल निकासी वाली बलुई दोमट/दोमट (pH 6–7)',
    soilEn: 'Well-drained sandy loam/loam (pH 6–7)',
    commonVarietiesHi: ['अर्का रक्षक (F1)', 'काशी अमन', 'काशी विशेष', 'पूसा रोहिणी', 'पंजाब छुहारा'],
    commonVarietiesEn: ['Arka Rakshak (F1)', 'Kashi Aman', 'Kashi Vishesh', 'Pusa Rohini', 'Punjab Chhuhara'],
    majorPestsDiseases: ['tomato-leaf-curl-virus', 'tomato-early-blight', 'tomato-late-blight', 'tomato-bacterial-wilt', 'tomato-fruit-borer', 'tomato-whitefly', 'tomato-pinworm'],
    sources: [
      PAU_VEG,
      `${TNAU}/horticulture/horti_vegetables_tomato_index.html`,
      'https://iivr.icar.gov.in/varieties/tomato',
      IIVR_SEED,
    ],
  }),

  brinjal: def('brinjal', {
    otherNamesHi: ['भंटा', 'बैगन'],
    category: 'vegetable',
    sowingMonths: { kharif: [5, 6, 7], rabi: [9, 10], zaid: [11, 12, 2, 3] },
    sowingWindowHi: 'खरीफ: नर्सरी मई–जुलाई, रोपाई जून–अगस्त; रबी: नर्सरी अक्टूबर, रोपाई नवंबर; बसंत: नर्सरी नवंबर (पाले से बचाकर), रोपाई फरवरी का पहला पखवाड़ा; गर्मी: नर्सरी फरवरी–मार्च, रोपाई अप्रैल',
    sowingWindowEn: 'Kharif: nursery May–July, transplant June–August; rabi: nursery October, transplant November; spring: nursery November (frost-protected), transplant first fortnight of February; summer: nursery February–March, transplant April',
    transplanted: true,
    nurseryDays: { min: 30, max: 35 },
    durationDays: { min: 55, max: 70 },
    harvestSpanDays: 90,
    stages: [
      st('germination', 0, EST),
      st('vegetative', 10, VEG_BRANCH),
      st('flowering', 35, FLOWER),
      st('fruiting', 45, ['फल बनना', 'Fruit set']),
      st('maturity', 55, ['तुड़ाई (हर 7–10 दिन)', 'Picking (every 7–10 days)']),
    ],
    variants: {
      // Only the winter (Nov–Dec) nursery overwinters; the Feb–Mar summer nursery keeps the base length.
      zaid: { labelHi: WINTER_NURSERY[0], labelEn: WINTER_NURSERY[1], months: [11, 12], nurseryDays: { min: 75, max: 90 } },
    },
    seedRateKgPerAcre: {
      min: 0.08,
      max: 0.2,
      noteHi: 'नर्सरी के लिए 160–200 ग्राम (हाइब्रिड 80–100 ग्राम)/एकड़',
      noteEn: 'Nursery seed 160–200 g (hybrids 80–100 g) per acre',
    },
    spacingHi: '60×60 सेमी; लंबी किस्में 60×45 सेमी; फैलने वाली 75×60 सेमी',
    spacingEn: '60×60 cm; long-fruited 60×45 cm; spreading types 75×60 cm',
    recommendedNPKKgPerHa: { n: 100, p: 60, k: 50 },
    npkNoteHi: 'आधा N रोपाई पर, बाकी 2 तुड़ाई के बाद',
    npkNoteEn: 'Half the N at transplanting, the rest after 2 pickings',
    criticalIrrigationHi: ['फूल आना', 'फल बनना'],
    criticalIrrigationEn: ['Flowering', 'Fruit set'],
    irrigationCountHi: 'गर्मी में 4–6 दिन, सर्दी में 10–14 दिन पर; कुल 10–16 सिंचाई',
    irrigationCountEn: 'Every 4–6 days in summer, 10–14 days in winter; 10–16 irrigations in all',
    soilHi: 'अच्छी जल निकासी वाली बलुई दोमट से चिकनी दोमट',
    soilEn: 'Well-drained sandy loam to clay loam',
    commonVarietiesHi: ['पूसा पर्पल लॉन्ग', 'पूसा हाइब्रिड 6', 'काशी तरु', 'पंत ऋतुराज', 'अर्का नवनीत (F1)'],
    commonVarietiesEn: ['Pusa Purple Long', 'Pusa Hybrid 6', 'Kashi Taru', 'Pant Rituraj', 'Arka Navneet (F1)'],
    majorPestsDiseases: ['brinjal-shoot-fruit-borer', 'brinjal-jassid', 'brinjal-whitefly', 'brinjal-little-leaf', 'brinjal-phomopsis-blight', 'brinjal-bacterial-wilt'],
    sources: [PAU_VEG, `${TNAU}/horticulture/horti_vegetables_brinjal_index.html`, IIVR_SEED],
  }),

  cauliflower: def('cauliflower', {
    otherNamesHi: ['गोभी', 'फूल गोभी'],
    category: 'vegetable',
    sowingMonths: { kharif: [5, 6, 7, 8], rabi: [9, 10] },
    sowingWindowHi: 'अगेती: नर्सरी मई–जून; मध्य: जुलाई–अगस्त; पछेती: सितंबर–अक्टूबर (रोपाई 4–5 हफ्ते बाद)',
    sowingWindowEn: 'Early: nursery May–June; mid: July–August; late: September–October (transplant 4–5 weeks later)',
    transplanted: true,
    nurseryDays: { min: 30, max: 40 },
    durationDays: { min: 75, max: 100 },
    stages: [
      st('germination', 0, EST),
      st('vegetative', 10, ['पत्तियां बढ़ना', 'Leaf growth']),
      st('fruiting', 45, ['फूल (कर्ड) बनना (Curd initiation)', 'Curd initiation']),
      st('fruiting', 60, ['फूल (कर्ड) बढ़ना', 'Curd development']),
      st('maturity', 75, ['कटाई योग्य फूल', 'Curd ready to harvest']),
    ],
    seedRateKgPerAcre: {
      min: 0.2,
      max: 0.5,
      noteHi: 'नर्सरी के लिए: मध्य/पछेती 200–250 ग्राम, अगेती 400–500 ग्राम/एकड़',
      noteEn: 'Nursery seed: mid/late 200–250 g, early 400–500 g per acre',
    },
    spacingHi: 'अगेती 45×30 सेमी; मध्य 45×45 सेमी; पछेती 60×45 सेमी',
    spacingEn: 'Early 45×30 cm; mid 45×45 cm; late 60×45 cm',
    recommendedNPKKgPerHa: { n: 120, p: 60, k: 60 },
    npkNoteHi: 'बोरॉन व मॉलिब्डेनम की कमी में बोरेक्स 4 किलो/एकड़ व अमोनियम मॉलिब्डेट 400 ग्राम/एकड़',
    npkNoteEn: 'If boron/molybdenum is deficient: borax 4 kg/acre and ammonium molybdate 400 g/acre',
    criticalIrrigationHi: ['रोपाई के बाद', 'फूल (कर्ड) बनना व बढ़ना'],
    criticalIrrigationEn: ['After transplanting', 'Curd initiation & development'],
    irrigationCountHi: '8–12 सिंचाई; गर्मी में 7–8 दिन, सर्दी में 10–15 दिन पर',
    irrigationCountEn: '8–12 irrigations; every 7–8 days in summer, 10–15 days in winter',
    soilHi: 'अच्छी जल निकासी वाली दोमट, जैविक खाद भरपूर (pH 6–7)',
    soilEn: 'Well-drained loam rich in organic matter (pH 6–7)',
    commonVarietiesHi: ['पूसा स्नोबॉल K-1 (पछेती)', 'पूसा शरद (मध्य)', 'पूसा दीपाली (अगेती)', 'पूसा मेघना (अगेती)', 'काशी कुंवारी (अगेती)'],
    commonVarietiesEn: ['Pusa Snowball K-1 (late)', 'Pusa Sharad (mid)', 'Pusa Deepali (early)', 'Pusa Meghna (early)', 'Kashi Kunwari (early)'],
    majorPestsDiseases: ['cauliflower-diamondback-moth', 'cauliflower-aphid', 'cauliflower-black-rot', 'cauliflower-downy-mildew', 'cauliflower-damping-off'],
    sources: [PAU_VEG, `${TNAU}/horticulture/horti_vegetables_cauliflower.html`, IIVR_SEED],
  }),

  chilli: def('chilli', {
    otherNamesHi: ['हरी मिर्च', 'लाल मिर्च', 'मिरची'],
    category: 'vegetable',
    sowingMonths: { kharif: [5, 6, 7, 8], rabi: [9], zaid: [10, 11] },
    sowingWindowHi: 'खरीफ: नर्सरी मई–जून (दक्षिण में जुलाई–अगस्त), रोपाई जुलाई–सितंबर; रबी (दक्षिण): नर्सरी सितंबर, रोपाई अक्टूबर–नवंबर; उत्तर भारत बसंत: नर्सरी अक्टूबर आखिर–मध्य नवंबर (पाले से बचाकर), रोपाई फरवरी–मार्च',
    sowingWindowEn: 'Kharif: nursery May–June (July–August in the South), transplant July–September; rabi (South): nursery September, transplant October–November; North Indian spring: nursery late October–mid November (frost-protected), transplant February–March',
    transplanted: true,
    nurseryDays: { min: 35, max: 45 },
    durationDays: { min: 60, max: 80 },
    harvestSpanDays: 90,
    stages: [
      st('germination', 0, EST),
      st('vegetative', 10, VEG_BRANCH),
      st('flowering', 35, FLOWER),
      st('fruiting', 50, ['फल बनना', 'Fruit set']),
      st('maturity', 60, ['तुड़ाई (हरी या लाल)', 'Picking (green or red)']),
    ],
    variants: {
      // PAU: nursery end Oct–mid Nov, transplant Feb–Mar (~100–120 d of frost-protected nursery).
      zaid: { labelHi: WINTER_NURSERY[0], labelEn: WINTER_NURSERY[1], nurseryDays: { min: 90, max: 120 } },
    },
    seedRateKgPerAcre: {
      min: 0.08,
      max: 0.2,
      noteHi: 'नर्सरी के लिए 200 ग्राम (हाइब्रिड 80–100 ग्राम)/एकड़',
      noteEn: 'Nursery seed 200 g (hybrids 80–100 g) per acre',
    },
    spacingHi: '60×45 सेमी; मेड़ पर 75×45 सेमी',
    spacingEn: '60×45 cm; 75×45 cm on ridges',
    recommendedNPKKgPerHa: { n: 100, p: 50, k: 50 },
    npkNoteHi: 'आधा N रोपाई पर, बाकी पहली तुड़ाई के आसपास',
    npkNoteEn: 'Half the N at transplanting, the rest around the first picking',
    criticalIrrigationHi: ['फूल आना', 'फल बनना'],
    criticalIrrigationEn: ['Flowering', 'Fruit set'],
    irrigationCountHi: '7–10 दिन पर, कुल 15–16; पानी भराव न हो (जड़ सड़ती है)',
    irrigationCountEn: 'Every 7–10 days, 15–16 in all; avoid waterlogging (roots rot)',
    soilHi: 'अच्छी जल निकासी वाली दोमट या काली मिट्टी',
    soilEn: 'Well-drained loam or black soil',
    commonVarietiesHi: ['पूसा ज्वाला', 'काशी अनमोल', 'पंजाब गुच्छेदार', 'काशी अर्ली (F1)', 'G 4 (भाग्यलक्ष्मी)'],
    commonVarietiesEn: ['Pusa Jwala', 'Kashi Anmol', 'Punjab Guchhedar', 'Kashi Early (F1)', 'G 4 (Bhagyalakshmi)'],
    majorPestsDiseases: ['chilli-thrips', 'chilli-mites', 'chilli-leaf-curl', 'chilli-anthracnose', 'chilli-fruit-borer', 'chilli-damping-off'],
    sources: [PAU_VEG, `${TNAU}/horticulture/horti_vegetables_chilly_index_New.html`, IIVR_SEED],
  }),

  okra: def('okra', {
    otherNamesHi: ['भिंडी (Lady finger)', 'भेंडी'],
    category: 'vegetable',
    sowingMonths: { zaid: [2, 3], kharif: [6, 7] },
    sowingWindowHi: 'गर्मी: फरवरी–मार्च; बरसात: जून–जुलाई',
    sowingWindowEn: 'Summer: February–March; rainy season: June–July',
    durationDays: { min: 45, max: 55 },
    harvestSpanDays: 50,
    stages: [
      st('germination', 0, GERM),
      st('vegetative', 10, ['बढ़वार', 'Vegetative growth']),
      st('flowering', 35, FLOWER),
      st('fruiting', 40, ['फलियां बनना', 'Pod set']),
      st('maturity', 45, ['तुड़ाई (हर 2–3 दिन)', 'Picking (every 2–3 days)']),
    ],
    seedRateKgPerAcre: {
      min: 4,
      max: 8,
      noteHi: 'गर्मी में 7–8 किलो (ठंड में जल्दी बुवाई पर ज़्यादा); बरसात में 4–5 किलो',
      noteEn: 'Summer 7–8 kg (more for early sowing in the cold); rainy season 4–5 kg',
    },
    spacingHi: 'गर्मी 45×15 सेमी; बरसात 60×30 सेमी',
    spacingEn: 'Summer 45×15 cm; rainy season 60×30 cm',
    recommendedNPKKgPerHa: { n: 100, p: 50, k: 50 },
    npkNoteHi: 'आधा N बुवाई पर, बाकी पहली तुड़ाई के बाद',
    npkNoteEn: 'Half the N at sowing, the rest after the first picking',
    criticalIrrigationHi: ['फूल आना', 'फलियां बनना'],
    criticalIrrigationEn: ['Flowering', 'Pod set'],
    irrigationCountHi: 'गर्मी में 4–6 दिन पर; बरसात में ज़रूरत पर; कुल 10–12',
    irrigationCountEn: 'Every 4–6 days in summer; as needed in the rains; 10–12 in all',
    soilHi: 'अच्छी जल निकासी वाली हर तरह की दोमट',
    soilEn: 'Any well-drained loam',
    commonVarietiesHi: ['काशी प्रगति', 'अर्का अनामिका', 'परभणी क्रांति', 'पूसा A-4', 'पंजाब पद्मिनी'],
    commonVarietiesEn: ['Kashi Pragati', 'Arka Anamika', 'Parbhani Kranti', 'Pusa A-4', 'Punjab Padmini'],
    majorPestsDiseases: ['okra-yellow-vein-mosaic', 'okra-enation-leaf-curl', 'okra-shoot-fruit-borer', 'okra-jassid', 'okra-whitefly', 'okra-powdery-mildew'],
    sources: [PAU_VEG, `${TNAU}/horticulture/horti_vegetables_bhendi_index.html`, IIVR_SEED],
  }),

  garlic: def('garlic', {
    otherNamesHi: ['लसुन', 'लशुन'],
    category: 'vegetable',
    sowingMonths: { rabi: [9, 10, 11] },
    sowingWindowHi: 'सितंबर आखिर से अक्टूबर (उत्तर भारत); मध्य भारत में अक्टूबर–नवंबर',
    sowingWindowEn: 'Late September to October (North India); October–November in Central India',
    durationDays: { min: 130, max: 170 },
    stages: [
      st('germination', 0, ['कलियां फूटना (Sprouting)', 'Sprouting']),
      st('vegetative', 15, ['पत्तियां बढ़ना', 'Leaf growth']),
      st('fruiting', 70, ['गांठ बनना (Bulb initiation)', 'Bulb initiation']),
      st('fruiting', 95, ['गांठ बढ़ना (Bulb development)', 'Bulb development']),
      st('maturity', 130, ['पकाव (पत्तियां सूखना)', 'Maturity (leaves dry)']),
    ],
    seedRateKgPerAcre: {
      min: 200,
      max: 250,
      noteHi: '200–250 किलो स्वस्थ कलियां (Cloves)/एकड़',
      noteEn: '200–250 kg healthy cloves per acre',
    },
    spacingHi: '15×7.5–10 सेमी; कलियां 3–5 सेमी गहरी',
    spacingEn: '15×7.5–10 cm; cloves 3–5 cm deep',
    recommendedNPKKgPerHa: { n: 100, p: 50, k: 50 },
    npkNoteHi: 'सल्फर 20 किलो/एकड़; N 3 हिस्सों में (बुवाई, 30 व 45 दिन)',
    npkNoteEn: 'Sulphur 20 kg/acre; N in 3 splits (sowing, 30 and 45 days)',
    criticalIrrigationHi: ['गांठ बनना', 'गांठ बढ़ना'],
    criticalIrrigationEn: ['Bulb initiation', 'Bulb development'],
    irrigationCountHi: '10–15 सिंचाई (8–12 दिन पर); खुदाई से 15 दिन पहले बंद',
    irrigationCountEn: '10–15 irrigations (every 8–12 days); stop 15 days before lifting',
    soilHi: 'भुरभुरी, अच्छी जल निकासी वाली दोमट, जैविक खाद भरपूर',
    soilEn: 'Friable, well-drained loam rich in organic matter',
    commonVarietiesHi: ['यमुना सफ़ेद (G-1)', 'यमुना सफ़ेद 3 (G-282)', 'भीमा ओंकार', 'भीमा पर्पल', 'एग्रीफाउंड पार्वती'],
    commonVarietiesEn: ['Yamuna Safed (G-1)', 'Yamuna Safed 3 (G-282)', 'Bhima Omkar', 'Bhima Purple', 'Agrifound Parvati'],
    majorPestsDiseases: ['garlic-thrips', 'garlic-purple-blotch', 'garlic-stemphylium-blight', 'garlic-basal-rot'],
    sources: [
      PAU_VEG,
      `${TNAU}/horticulture/horti_vegetables_garlic.html`,
      'https://dogr.icar.gov.in/index.php?Itemid=114&id=80&lang=en&option=com_content&view=article',
    ],
  }),
};

/** Catalog order follows CROP_KEYS: cereals and millets, pulses, oilseeds, cash crops, vegetables. */
export const CROP_LIST: CropInfo[] = CROP_KEYS.map(k => CROPS[k]);

/** Catalog entry for a key, or undefined for 'other' / free-text crops. */
export function getCropInfo(key: string | undefined | null): CropInfo | undefined {
  return key && isCropKey(key) ? CROPS[key] : undefined;
}

export function cropsBySeason(season: Season): CropInfo[] {
  return CROP_LIST.filter(c => c.seasons.includes(season));
}

/** Crops whose seed (or nursery) is normally sown in this calendar month (1–12): "अभी क्या बोएं". */
export function cropsSowableIn(month: number): CropInfo[] {
  if (!Number.isInteger(month) || month < 1 || month > 12) return [];
  return CROP_LIST.filter(c => Object.values(c.sowingMonths).some(ms => ms?.includes(month)));
}

// ---------- Dates ----------

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A real YYYY-MM-DD calendar date (rejects '15/11/2026', '', '2026-02-30'). */
export function isValidISODate(s: unknown): s is ISODate {
  return typeof s === 'string' && ISO_DATE_RE.test(s) && toISODate(parseISODate(s)) === s;
}

const monthOf = (iso: ISODate) => Number(iso.slice(5, 7));

/** Months apart on a 12-month circle (Dec→Jan is 1); 12 when there are no months to compare. */
function monthGap(m: number, months: number[]): number {
  let best = 12;
  for (const x of months) best = Math.min(best, Math.abs(m - x), 12 - Math.abs(m - x));
  return best;
}

/**
 * Season label for a calendar month: Mar–May zaid, Jun–Sep kharif, Oct–Feb rabi. A display
 * label only. It is NOT a sowing recommendation (spring maize, summer groundnut and okra are
 * sown in Jan–Feb, North Indian cotton in Apr–May); use cropsSowableIn() for that.
 * Invalid dates fall back to today.
 */
export function currentSeason(date?: string | null): Season {
  const month = monthOf(isValidISODate(date) ? date : todayISO());
  if (month >= 3 && month <= 5) return 'zaid';
  if (month >= 6 && month <= 9) return 'kharif';
  return 'rabi';
}

// ---------- Timelines (base profile or season variant) ----------

/** One crop's timeline for a sowing window: the base profile, or a season variant applied. */
export interface CropProfile {
  /** Season of this window; for crops outside the catalog, the calendar season label. */
  season: Season;
  /** Set when a variant replaces the base profile, e.g. "रबी मक्का". */
  variantLabelHi?: string;
  variantLabelEn?: string;
  transplanted: boolean;
  nurseryDays?: Range;
  /** Typical nursery length used to place nursery tasks; 0 for direct-sown crops. */
  nurseryMidDays: number;
  durationDays: Range;
  stages: CropStageInfo[];
  harvestSpanDays: number;
  /** Day (from day 0) of the expected harvest: the midpoint of durationDays. */
  harvestDay: number;
}

export interface SowingWindow {
  season: Season;
  /** Seed (or nursery) sowing months this window covers. */
  months: number[];
  profile: CropProfile;
}

/** Days after which a crop past its max duration is treated as harvested. */
const HARVEST_GRACE_DAYS = 15;

const midDuration = (r: Range) => Math.round((r.min + r.max) / 2);

// Used for crops outside the catalog so stage / harvest helpers still give sensible output.
const GENERIC_DURATION: Range = { min: 90, max: 130 };
const GENERIC_STAGES: CropStageInfo[] = [
  st('germination', 0, GERM),
  st('vegetative', 15, ['बढ़वार (Vegetative)', 'Vegetative growth']),
  st('flowering', 50, FLOWER),
  st('fruiting', 65, ['फल/दाना बनना (Fruiting)', 'Fruiting']),
  st('maturity', 95, MATURE),
];

function buildProfile(season: Season, info?: CropInfo, v?: CropVariant): CropProfile {
  const durationDays = v?.durationDays ?? info?.durationDays ?? GENERIC_DURATION;
  const baseStages = info?.stages ?? GENERIC_STAGES;
  // A variant that only changes duration stretches the base stages proportionally.
  const ratio = info && v?.durationDays ? midDuration(durationDays) / midDuration(info.durationDays) : 1;
  const stages = v?.stages ?? (ratio === 1 ? baseStages : baseStages.map(s => ({ ...s, startDay: Math.round(s.startDay * ratio) })));
  const nurseryDays = v?.nurseryDays ?? info?.nurseryDays;
  const transplanted = !!info?.transplanted;
  return {
    season,
    variantLabelHi: v?.labelHi,
    variantLabelEn: v?.labelEn,
    transplanted,
    nurseryDays,
    nurseryMidDays: transplanted && nurseryDays ? midDuration(nurseryDays) : 0,
    durationDays,
    stages,
    harvestSpanDays: info?.harvestSpanDays ?? 0,
    harvestDay: midDuration(durationDays),
  };
}

const GENERIC_PROFILES: Record<Season, CropProfile> = {
  kharif: buildProfile('kharif'),
  rabi: buildProfile('rabi'),
  zaid: buildProfile('zaid'),
};

const windowCache = new Map<CropKey, SowingWindow[]>();

/** Sowing windows of a crop in declaration order (variant window first within a season). */
function windowsOf(info: CropInfo): SowingWindow[] {
  const cached = windowCache.get(info.key);
  if (cached) return cached;
  const list: SowingWindow[] = [];
  for (const season of info.seasons) {
    const months = info.sowingMonths[season] ?? [];
    const v = info.variants?.[season];
    if (!v) {
      list.push({ season, months, profile: buildProfile(season, info) });
      continue;
    }
    const covered = v.months ?? months;
    list.push({ season, months: covered, profile: buildProfile(season, info, v) });
    const rest = months.filter(m => !covered.includes(m));
    if (rest.length) list.push({ season, months: rest, profile: buildProfile(season, info) });
  }
  windowCache.set(info.key, list);
  return list;
}

/** All sowing windows of a catalog crop (empty for unknown keys), e.g. for a season picker. */
export function sowingWindowsFor(cropKey: string): readonly SowingWindow[] {
  const info = getCropInfo(cropKey);
  return info ? windowsOf(info) : [];
}

/**
 * The window that best fits a date. `kind` says whether the date is the seed/nursery sowing
 * date or day 0 (transplanting for nursery crops, whose seed month is then day 0 − nursery).
 * Earlier windows win ties, so the base season is the default.
 */
function windowFor(info: CropInfo, season: Season | null | undefined, date: ISODate | null | undefined, kind: 'sowing' | 'day0'): SowingWindow {
  const all = windowsOf(info);
  const inSeason = season ? all.filter(w => w.season === season) : all;
  const pool = inSeason.length ? inSeason : all;
  if (!isValidISODate(date)) return pool[0];
  let best = pool[0];
  let bestGap = Infinity;
  for (const w of pool) {
    const seedDate = kind === 'day0' && w.profile.nurseryMidDays ? addDays(date, -w.profile.nurseryMidDays) : date;
    const gap = monthGap(monthOf(seedDate), w.months);
    if (gap < bestGap) {
      best = w;
      bestGap = gap;
    }
  }
  return best;
}

/**
 * Timeline for a crop in a season, or in the season implied by its day-0 date when no season
 * is given. Unknown keys get a generic 90–130 day profile.
 */
export function profileFor(cropKey: string, season?: Season | null, day0?: ISODate | null): CropProfile {
  const info = getCropInfo(cropKey);
  if (!info) return GENERIC_PROFILES[season ?? currentSeason(day0)];
  return windowFor(info, season, day0, 'day0').profile;
}

/** Season implied by the seed (nursery) sowing date. */
export function seasonFromSowingDate(cropKey: string, sowingDate: ISODate | null | undefined): Season {
  const info = getCropInfo(cropKey);
  return info ? windowFor(info, undefined, sowingDate, 'sowing').season : currentSeason(sowingDate);
}

/** Season implied by the day-0 date (sowing, or transplanting for nursery crops). */
export function seasonFromDay0(cropKey: string, day0: ISODate | null | undefined): Season {
  return profileFor(cropKey, undefined, day0).season;
}

/** Day after day 0 when the crop is expected to be harvested. */
export function harvestDayFor(cropKey: string, season?: Season | null, day0?: ISODate | null): number {
  return profileFor(cropKey, season, day0).harvestDay;
}

// ---------- Crop records ----------

/**
 * The timing fields of a Crop record. `sowingDate` is the seed sowing date, which for nursery
 * crops is the NURSERY sowing. `transplantDate` and `season` are optional extras (see the
 * shared-model note in docs/CATALOG.md); a Crop without them still works.
 */
export interface CropTiming {
  cropKey: string;
  sowingDate?: ISODate | null;
  transplantDate?: ISODate | null;
  season?: Season | null;
}

export interface CropTimeline {
  season: Season;
  /** Day 0 of the stage/task timeline: field sowing, or transplanting for nursery crops. */
  day0?: ISODate;
  profile: CropProfile;
}

/**
 * Resolves a crop record once, so stage, harvest and tasks agree. The seed date picks the
 * sowing window when known (it is unambiguous for nursery crops); a nursery crop without a
 * transplant date is assumed to be transplanted after the window's typical nursery length.
 */
export function timelineFor(crop: CropTiming): CropTimeline {
  const info = getCropInfo(crop.cropKey);
  const sown = isValidISODate(crop.sowingDate) ? crop.sowingDate : undefined;
  const planted = isValidISODate(crop.transplantDate) ? crop.transplantDate : undefined;
  const season = crop.season && (!info || info.seasons.includes(crop.season)) ? crop.season : undefined;
  if (!info) {
    const day0 = planted ?? sown;
    const profile = GENERIC_PROFILES[season ?? currentSeason(sown ?? day0)];
    return { season: profile.season, day0, profile };
  }
  const w = sown ? windowFor(info, season, sown, 'sowing') : windowFor(info, season, planted, 'day0');
  let day0: ISODate | undefined;
  if (!info.transplanted) day0 = sown ?? planted;
  else day0 = planted ?? (sown ? addDays(sown, w.profile.nurseryMidDays) : undefined);
  return { season: w.season, day0, profile: w.profile };
}

/** Day 0 of a crop record (see timelineFor). */
export const day0For = (crop: CropTiming): ISODate | undefined => timelineFor(crop).day0;

/** Season of a crop record (see timelineFor). */
export const seasonForCrop = (crop: CropTiming): Season => timelineFor(crop).season;

// ---------- Stage & harvest ----------

export interface StageStatus {
  stage: CropStage;
  labelHi: string;
  labelEn: string;
  /** Days after day 0 (sowing/transplanting); negative before it. */
  day: number;
  /** 0–100, against the expected (mid-duration) harvest day. */
  progressPct: number;
  nextStage?: { stage: CropStage; labelHi: string; labelEn: string; inDays: number };
  /** Days left to the expected harvest; ≤ 0 once harvest is due. */
  harvestInDays: number;
  season: Season;
}

function stageOn(p: CropProfile, day0: ISODate | null | undefined, today: ISODate): StageStatus {
  const now = isValidISODate(today) ? today : todayISO();
  const planned = p.transplanted ? PLANNED_TRANSPLANT : STAGE_NAMES.planned;
  const base = { season: p.season };
  if (!isValidISODate(day0)) {
    return { ...base, stage: 'planned', labelHi: planned.hi, labelEn: planned.en, day: 0, progressPct: 0, harvestInDays: p.harvestDay };
  }
  const day = daysBetween(day0, now);
  const first = p.stages[0];
  if (day < 0) {
    return {
      ...base,
      stage: 'planned',
      labelHi: planned.hi,
      labelEn: planned.en,
      day,
      progressPct: 0,
      nextStage: { stage: first.stage, labelHi: first.labelHi, labelEn: first.labelEn, inDays: -day },
      harvestInDays: p.harvestDay - day,
    };
  }
  if (day > p.durationDays.max + p.harvestSpanDays + HARVEST_GRACE_DAYS) {
    const h = STAGE_NAMES.harvested;
    return { ...base, stage: 'harvested', labelHi: h.hi, labelEn: h.en, day, progressPct: 100, harvestInDays: p.harvestDay - day };
  }
  let idx = 0;
  for (let i = 1; i < p.stages.length; i++) if (p.stages[i].startDay <= day) idx = i;
  const current = p.stages[idx];
  const next = p.stages[idx + 1];
  return {
    ...base,
    stage: current.stage,
    labelHi: current.labelHi,
    labelEn: current.labelEn,
    day,
    progressPct: Math.min(100, Math.round((day / p.harvestDay) * 100)),
    nextStage: next ? { stage: next.stage, labelHi: next.labelHi, labelEn: next.labelEn, inDays: next.startDay - day } : undefined,
    harvestInDays: p.harvestDay - day,
  };
}

/**
 * Where a crop stands today, counted from day 0 (sowing, or transplanting for nursery crops;
 * use day0For() for a Crop record). 'planned' before day 0 or without a valid date,
 * 'harvested' once past the longest duration (plus the picking span of multi-pick crops) and a
 * grace period. The season defaults to the one implied by day 0. Works for unknown keys.
 */
export function stageFor(cropKey: string, day0: ISODate | undefined | null, today: ISODate = todayISO(), season?: Season | null): StageStatus {
  return stageOn(profileFor(cropKey, season, day0), day0, today);
}

/** stageFor() for a crop record. */
export function stageForCrop(crop: CropTiming, today: ISODate = todayISO()): StageStatus {
  const tl = timelineFor(crop);
  return stageOn(tl.profile, tl.day0, today);
}

/** Expected harvest at the middle of the typical duration; undefined for an invalid date. */
export function expectedHarvestDate(cropKey: string, day0: ISODate | undefined | null, season?: Season | null): ISODate | undefined {
  if (!isValidISODate(day0)) return undefined;
  return addDays(day0, profileFor(cropKey, season, day0).harvestDay);
}

/** expectedHarvestDate() for a crop record. */
export function expectedHarvestForCrop(crop: CropTiming): ISODate | undefined {
  const tl = timelineFor(crop);
  return tl.day0 ? addDays(tl.day0, tl.profile.harvestDay) : undefined;
}

// ---------- Units ----------

export const ACRES_PER_HECTARE = 2.471;

/** recommendedNPKKgPerHa as whole kg per acre, so screens never have to show kg/ha. */
export function npkPerAcre(info: Pick<CropInfo, 'recommendedNPKKgPerHa'>): { n: number; p: number; k: number } {
  const { n, p, k } = info.recommendedNPKKgPerHa;
  const perAcre = (x: number) => Math.round(x / ACRES_PER_HECTARE);
  return { n: perAcre(n), p: perAcre(p), k: perAcre(k) };
}

// ---------- Dev checks ----------

// Catches data slips (unsorted stages, harvest before maturity, bad months) while editing.
if (import.meta.env.DEV) {
  for (const c of CROP_LIST) {
    const problems: string[] = [];
    if (!c.seasons.length) problems.push('no sowingMonths');
    if (c.transplanted && !c.nurseryDays) problems.push('transplanted crop without nurseryDays');
    if (c.variants?.[c.seasons[0]]) problems.push('base season must not have a variant');
    if (c.criticalIrrigationHi.length !== c.criticalIrrigationEn.length) problems.push('criticalIrrigation hi/en length');
    if (c.commonVarietiesHi.length !== c.commonVarietiesEn.length) problems.push('commonVarieties hi/en length');
    for (const s of SEASONS) {
      const v = c.variants?.[s];
      if (!v) continue;
      if (!c.seasons.includes(s)) problems.push(`variant for unused season ${s}`);
      if (v.stages && v.stages.length !== c.stages.length) problems.push(`${s} variant stage count`);
      if (v.months?.some(m => !c.sowingMonths[s]?.includes(m))) problems.push(`${s} variant months outside sowingMonths`);
    }
    for (const w of windowsOf(c)) {
      const s = w.profile.stages;
      if (s[0]?.startDay !== 0) problems.push(`${w.season}: first stage must start at day 0`);
      if (s.some((x, i) => i > 0 && x.startDay <= s[i - 1].startDay)) problems.push(`${w.season}: stage days not increasing`);
      if (w.profile.harvestDay <= s[s.length - 1].startDay) problems.push(`${w.season}: harvest before the last stage`);
      if (!w.months.length || w.months.some(m => !Number.isInteger(m) || m < 1 || m > 12)) problems.push(`${w.season}: bad months`);
    }
    if (problems.length) console.warn(`[crops] ${c.key}: ${problems.join('; ')}`);
  }
}
