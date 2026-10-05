// Calendar task templates per crop, timed from day 0: the field sowing date, or the
// transplanting date for nursery crops (see CropInfo.transplanted in data/crops.ts). Timings
// follow the package of practices cited in data/crops.ts; fertilizer doses stay general and
// always defer to a soil test.
//
// Offsets are written for the crop's base season and resolved per sowing window:
// - nursery work is anchored to nursery sowing, so it moves with the window's nursery length;
// - harvest and "N days before harvest" tasks are anchored to the expected harvest, so the
//   calendar always agrees with expectedHarvestDate();
// - other tasks are tied to crop stages and are mapped onto a variant's stage days (rabi maize),
//   unless a season has its own calendar-bound offset (`at`, e.g. sugarcane tying before the rains).
import type { ISODate, TaskType } from '../types/models';
import { addDays } from '../lib/format';
import { CROP_KEYS, isCropKey, type CropKey } from './crop-keys';
import {
  getCropInfo,
  isValidISODate,
  profileFor,
  sowingWindowsFor,
  timelineFor,
  type CropInfo,
  type CropProfile,
  type CropTiming,
  type Season,
} from './crops';

export interface TaskTemplate {
  /** Stable within a crop (e.g. 'irr-cri'), for de-duplicating auto-created tasks. */
  id: string;
  type: TaskType;
  /** Days relative to day 0; negative = before it (field prep, seed treatment, nursery). */
  dayOffset: number;
  titleHi: string;
  titleEn: string;
  descHi: string;
  descEn: string;
}

export interface DatedTaskTemplate extends TaskTemplate {
  /**
   * `${cropKey}:${id}` ('generic:<id>' outside the catalog). Store it on the FarmingTask and
   * render the text with findTemplate() + templateText(), so it follows the UI language.
   */
  templateId: string;
  dueDate: ISODate;
}

type Txt = readonly [hi: string, en: string];
type Anchor = 'day0' | 'nursery' | 'harvest';

interface Spec extends TaskTemplate {
  anchor: Anchor;
  /** Only in these seasons; the offset is then literal in that season's own timeline. */
  only?: Season[];
  /** Calendar-bound offsets for other seasons, literal in that season's own timeline. */
  at?: Partial<Record<Season, number>>;
}

interface SpecOpts {
  anchor?: Anchor;
  only?: Season[];
  at?: Partial<Record<Season, number>>;
}

const t = (id: string, type: TaskType, dayOffset: number, [titleHi, titleEn]: Txt, [descHi, descEn]: Txt, o: SpecOpts = {}): Spec => ({
  id,
  type,
  dayOffset,
  titleHi,
  titleEn,
  descHi,
  descEn,
  anchor: o.anchor ?? 'day0',
  only: o.only,
  at: o.at,
});

/** Nursery work: offset from nursery sowing (0 = sowing the nursery). */
const nursery = (id: string, type: TaskType, dayOffset: number, title: Txt, desc: Txt) =>
  t(id, type, dayOffset, title, desc, { anchor: 'nursery' });
/** Offset from the expected harvest (negative = before it, positive = after the first picking). */
const fromHarvest = (id: string, type: TaskType, dayOffset: number, title: Txt, desc: Txt) =>
  t(id, type, dayOffset, title, desc, { anchor: 'harvest' });
const harvest = (title: Txt, desc: Txt) => fromHarvest('harvest', 'harvest', 0, title, desc);
const prep = (dayOffset: number, desc: Txt) => t('prep', 'other', dayOffset, ['खेत की तैयारी', 'Field preparation'], desc);
const ifDry = ([hi, en]: Txt): Txt => [`${hi} — सूखा हो तो`, `${en} — if dry`];

// Shared wording keeps the bundle small and the advice consistent.
const SOIL_HI = 'मिट्टी जांच के अनुसार';
const SOIL_EN = 'as per soil test';
const EXPERT_HI = 'ज़रूरत हो तो KVK/कृषि विशेषज्ञ की सलाह से अनुशंसित दवा छिड़कें।';
const EXPERT_EN = 'spray a recommended product if needed, as advised by your KVK or an agriculture expert.';
const PULSE_SEED: Txt = [
  'पहले ट्राइकोडर्मा 4 ग्राम/किलो या फफूंदनाशक, फिर राइज़ोबियम व PSB कल्चर से बीज उपचार करें; छाया में सुखाकर बोएं।',
  'Treat seed first with Trichoderma 4 g/kg or a fungicide, then with Rhizobium and PSB culture; dry in shade before sowing.',
];
const NURSERY_SEED: Txt = [
  'थायरम/कैप्टान 2–3 ग्राम या ट्राइकोडर्मा 5 ग्राम प्रति किलो बीज से उपचार करें।',
  'Treat with thiram/captan 2–3 g or Trichoderma 5 g per kg of seed.',
];
const NURSERY_BED: Txt = [
  'उठी हुई क्यारियां बनाकर सड़ी गोबर खाद मिलाएं; पौध गलन से बचाने को जल निकासी रखें।',
  'Make raised beds with well-rotted FYM; keep them well drained against damping-off.',
];
const NET_COVER: Txt = [' हो सके तो नेट से ढकें (वायरस से बचाव)।', ' If possible, cover with net (protects from virus vectors).'];
const NURSERY_SOW: Txt = [
  'कतारों में पतला बोएं; हल्की सिंचाई करें। सर्दी की नर्सरी को पाले से (पॉलीथीन/सरकंडा) ढकें।',
  'Sow thinly in lines and water lightly. Cover winter nurseries against frost (polythene/thatch).',
];
const YMV: Txt = [
  'पीले चितकबरे पत्तों वाले पौधे उखाड़कर नष्ट करें; सफ़ेद मक्खी के लिए पीले चिपचिपे ट्रैप लगाएं।',
  'Uproot and destroy plants with yellow mottled leaves; put up yellow sticky traps for whitefly.',
];
// Pre-emergence herbicides only work in the first days after sowing, so this is its own task.
const PRE_EMERGENCE: Txt = [
  'बुवाई के 0–3 दिन में नम मिट्टी पर अनुशंसित खरपतवारनाशी (जैसे पेंडिमेथालिन) छिड़कें; दवा व मात्रा KVK से पूछें।',
  'Within 0–3 days of sowing, spray a recommended pre-emergence herbicide (e.g. pendimethalin) on moist soil; ask your KVK for the product and dose.',
];
const PRE_EM_TITLE: Txt = ['खरपतवारनाशी (बुवाई के तुरंत बाद)', 'Pre-emergence herbicide'];
const seedTreat = (dayOffset: number, desc: Txt) => t('seed-treat', 'seed-treatment', dayOffset, ['बीज उपचार', 'Seed treatment'], desc);
const sowBasal = (desc: Txt) => t('sow', 'sowing', 0, ['बुवाई व बेसल खाद', 'Sowing & basal fertilizer'], desc);
const sowAll = (desc: Txt) => t('sow', 'sowing', 0, ['बुवाई व खाद', 'Sowing & fertilizer'], desc);
const transplant = (desc: Txt) => t('transplant', 'sowing', 0, ['रोपाई व बेसल खाद', 'Transplanting & basal fertilizer'], desc);
const NURSERY_PREP_TITLE: Txt = ['नर्सरी क्यारी तैयार करना', 'Prepare nursery beds'];
const NURSERY_SOW_TITLE: Txt = ['नर्सरी बुवाई', 'Sow the nursery'];
const EVENING_TRANSPLANT: Txt = [
  `शाम को रोपाई कर तुरंत सिंचाई करें; ${SOIL_HI} पूरा फॉस्फोरस-पोटाश और आधा नाइट्रोजन।`,
  `Transplant in the evening and irrigate at once; ${SOIL_EN}, all the P and K and half the N.`,
];

const SPECS: Record<CropKey, Spec[]> = {
  wheat: [
    prep(-10, ['पराली न जलाएं; पलेवा (रौनी) देकर 2–3 जुताई और पाटा लगाएं।', 'Do not burn stubble; give a pre-sowing irrigation, then 2–3 ploughings and planking.']),
    seedTreat(-1, [
      'कंडुआ (लूज़ स्मट) से बचाव के लिए कार्बोक्सिन या टेबुकोनाज़ोल से; दीमक वाले खेत में अनुशंसित कीटनाशक से भी।',
      'With carboxin or tebuconazole against loose smut; in termite-prone fields also with a recommended insecticide.',
    ]),
    sowBasal([
      `सीड ड्रिल से 20–22.5 सेमी कतार में बोएं; ${SOIL_HI} पूरा फॉस्फोरस-पोटाश और आधा नाइट्रोजन कूंड़ में।`,
      `Sow with a seed drill in rows 20–22.5 cm apart; ${SOIL_EN}, drill all the P and K and half the N.`,
    ]),
    t('irr-cri', 'irrigation', 21, ['पहली सिंचाई (शिखर जड़ / CRI)', 'First irrigation (crown root initiation)'], [
      'सबसे ज़रूरी सिंचाई — 20–25 दिन पर हल्की सिंचाई करें।',
      'The most important irrigation — give a light irrigation at 20–25 days.',
    ]),
    t('n-1', 'fertilizer', 22, ['यूरिया — पहली टॉप ड्रेसिंग', 'Urea — first top dressing'], [
      `${SOIL_HI} बाकी नाइट्रोजन का आधा भाग पहली सिंचाई के बाद छिड़कें।`,
      `After the first irrigation, broadcast half of the remaining N, ${SOIL_EN}.`,
    ]),
    t('weed', 'weeding', 30, ['खरपतवार नियंत्रण', 'Weed control'], [
      'गुल्ली डंडा व चौड़ी पत्ती के खरपतवार के लिए 30–35 दिन पर अनुशंसित खरपतवारनाशी या निराई।',
      'At 30–35 days, use a recommended herbicide or hand weeding against Phalaris (gulli danda) and broadleaf weeds.',
    ]),
    t('irr-2', 'irrigation', 43, ['दूसरी सिंचाई (कल्ले पूरे होना)', 'Second irrigation (end of tillering)'], [
      '40–45 दिन पर, जब कल्ले पूरे निकल रहे हों।',
      'At 40–45 days, as tillering completes.',
    ]),
    t('n-2', 'fertilizer', 44, ['यूरिया — दूसरी टॉप ड्रेसिंग', 'Urea — second top dressing'], [
      `${SOIL_HI} बाकी नाइट्रोजन दूसरी सिंचाई के साथ दें।`,
      `Apply the rest of the N with the second irrigation, ${SOIL_EN}.`,
    ]),
    t('scout-rust', 'pest-scouting', 55, ['पीला रतुआ की निगरानी', 'Yellow rust watch'], [
      'जनवरी–फरवरी में हर हफ्ते देखें; पत्तियों पर पीले पाउडर की धारियां दिखें तो तुरंत पहचान कराएं।',
      'Check every week in January–February; if leaves show stripes of yellow powder, get it identified at once.',
    ]),
    t('irr-joint', 'irrigation', 62, ['सिंचाई (गांठ बनना)', 'Irrigation (jointing)'], [
      '60–65 दिन पर; पानी कम हो तब भी यह सिंचाई ज़रूर करें।',
      'At 60–65 days; do not skip it even when water is short.',
    ]),
    t('irr-flower', 'irrigation', 83, ['सिंचाई (बाली निकलना/फूल)', 'Irrigation (heading/flowering)'], [
      '80–85 दिन पर; तेज़ हवा में सिंचाई न करें, फसल गिर सकती है।',
      'At 80–85 days; do not irrigate in strong wind, the crop may lodge.',
    ]),
    t('scout-aphid', 'pest-scouting', 88, ['माहू (चेपा) की जांच', 'Aphid check'], [
      `बालियों व पत्तियों पर माहू ज़्यादा दिखे तो ${EXPERT_HI}`,
      `If many aphids appear on ears and leaves, ${EXPERT_EN}`,
    ]),
    t('irr-milk', 'irrigation', 103, ['सिंचाई (दूधिया दाना)', 'Irrigation (milk stage)'], [
      '100–105 दिन पर; गर्मी बढ़े तो दाना भरते समय हल्की सिंचाई से उपज बचती है।',
      'At 100–105 days; a light irrigation during grain filling protects yield when it turns hot.',
    ]),
    harvest(['कटाई', 'Harvest'], [
      'दाने सख्त और बालियां सुनहरी होने पर कटाई करें; देरी से दाने झड़ते हैं। भूसा/पराली न जलाएं।',
      'Harvest when grains are hard and ears golden; delay causes shattering. Do not burn straw or stubble.',
    ]),
  ],

  paddy: [
    nursery('seed-treat', 'seed-treatment', -2, ['बीज उपचार व अंकुरण', 'Seed treatment & sprouting'], [
      'पानी में डुबोकर हल्के/खोखले बीज निकालें; कार्बेन्डाजिम 2 ग्राम/किलो या ट्राइकोडर्मा से उपचार कर 24 घंटे भिगोएं, फिर अंकुरित करें।',
      'Float off light/empty seeds in water; treat with carbendazim 2 g/kg or Trichoderma, soak for 24 hours, then sprout.',
    ]),
    nursery('nursery-sow', 'sowing', 0, ['नर्सरी तैयार कर बुवाई', 'Prepare and sow the nursery'], [
      'एक एकड़ रोपाई के लिए 300–400 वर्ग मीटर क्यारी में गोबर खाद मिलाएं; अंकुरित बीज समान रूप से बिखेरें और पानी की पतली परत रखें।',
      'For one acre, prepare 300–400 sq m of beds with FYM; broadcast the sprouted seed evenly and keep a thin film of water.',
    ]),
    t('field-prep', 'other', -3, ['खेत की तैयारी (कद्दू/पडलिंग)', 'Field preparation (puddling)'], [
      'पानी भरकर जुताई व पाटा लगाएं; मेड़ मज़बूत करें ताकि पानी रुके।',
      'Plough and plank in standing water; strengthen bunds to hold water.',
    ]),
    transplant([
      `21–30 दिन की पौध 20×15 सेमी पर, एक जगह 2–3 पौधे; ${SOIL_HI} पूरा फॉस्फोरस-पोटाश, जिंक और 1/3 नाइट्रोजन।`,
      `Plant 21–30-day seedlings at 20×15 cm, 2–3 per hill; ${SOIL_EN}, all the P, K and zinc and 1/3 of the N.`,
    ]),
    t('herbicide-pre', 'weeding', 2, ['खरपतवारनाशी (रोपाई के तुरंत बाद)', 'Pre-emergence herbicide'], [
      'रोपाई के 0–3 दिन में, खेत में पानी खड़ा रहते, अनुशंसित खरपतवारनाशी डालें (दवा व मात्रा KVK से पूछें)।',
      'Within 0–3 days of transplanting, with water standing, apply a recommended herbicide (ask your KVK for the product and dose).',
    ]),
    t('n-1', 'fertilizer', 21, ['नाइट्रोजन — पहली टॉप ड्रेसिंग (कल्ले)', 'Nitrogen — first top dressing (tillering)'], [
      `${SOIL_HI}; खेत से पानी कम करके यूरिया छिड़कें।`,
      `Lower the water level, then broadcast urea, ${SOIL_EN}.`,
    ]),
    t('weed', 'weeding', 22, ['हाथ से निराई', 'Hand weeding'], [
      '20–25 दिन पर बचे हुए खरपतवार हाथ से निकालें।',
      'At 20–25 days, pull out the remaining weeds by hand.',
    ]),
    t('scout-borer', 'pest-scouting', 30, ['तना छेदक व पत्ती लपेटक की जांच', 'Stem borer & leaf folder check'], [
      'सूखी गोभ (डेड हार्ट) या लिपटी पत्तियां देखें; फेरोमोन ट्रैप लगाएं।',
      'Look for dead hearts or folded leaves; put up pheromone traps.',
    ]),
    t('n-2', 'fertilizer', 42, ['नाइट्रोजन — दूसरी टॉप ड्रेसिंग (बाली बनना)', 'Nitrogen — second top dressing (panicle initiation)'], [
      `${SOIL_HI}; ज़्यादा यूरिया से झुलसा और कीट बढ़ते हैं।`,
      `Apply ${SOIL_EN}; excess urea increases blight and pests.`,
    ]),
    t('scout-bph', 'pest-scouting', 55, ['भूरा फुदका (BPH) व झुलसा की जांच', 'Brown planthopper (BPH) & blight check'], [
      'पौधों के निचले हिस्से पर भूरे फुदके या पत्तियों के किनारे सूखना देखें।',
      'Look for brown hoppers at the plant base and for leaf edges drying up.',
    ]),
    t('irr-flower', 'irrigation', 65, ['फूल के समय पानी बनाए रखें', 'Keep water at flowering'], [
      'बाली निकलने और फूल आने पर खेत में पानी की कमी न होने दें।',
      'Do not let the field run short of water at heading and flowering.',
    ]),
    t('protect-blast', 'crop-protection', 68, ['गर्दन तोड़ (ब्लास्ट) से बचाव', 'Neck blast protection'], [
      `बाली की गर्दन पर भूरे धब्बे या सफ़ेद बालियां दिखें तो ${EXPERT_HI}`,
      `If panicle necks show brown lesions or panicles turn white, ${EXPERT_EN}`,
    ]),
    fromHarvest('drain', 'irrigation', -15, ['खेत से पानी निकालें', 'Drain the field'], [
      'कटाई से 10–15 दिन पहले पानी निकाल दें।',
      'Drain the water 10–15 days before harvest.',
    ]),
    harvest(['कटाई', 'Harvest'], ['80–85% दाने सुनहरे होने पर कटाई करें; पराली न जलाएं।', 'Harvest when 80–85% of grains are golden; do not burn the stubble.']),
  ],

  maize: [
    prep(-7, ['गहरी जुताई कर मेड़-नाली बनाएं; पानी निकासी का इंतज़ाम करें।', 'Plough deep and make ridges and furrows; arrange drainage.']),
    seedTreat(-1, [
      'फफूंदनाशक (जैसे कार्बेन्डाजिम 2 ग्राम/किलो) से; हाइब्रिड बीज अक्सर पहले से उपचारित होता है।',
      'With a fungicide (e.g. carbendazim 2 g/kg); hybrid seed is often pre-treated.',
    ]),
    sowBasal([
      `60×20 सेमी पर 3–5 सेमी गहरा बोएं; ${SOIL_HI} पूरा फॉस्फोरस-पोटाश, जिंक और 1/3 नाइट्रोजन।`,
      `Sow 3–5 cm deep at 60×20 cm; ${SOIL_EN}, all the P, K and zinc and 1/3 of the N.`,
    ]),
    t('herbicide-pre', 'weeding', 1, PRE_EM_TITLE, [
      'बुवाई के 0–3 दिन में नम मिट्टी पर अनुशंसित खरपतवारनाशी (जैसे एट्राज़िन) छिड़कें; दवा व मात्रा KVK से पूछें।',
      'Within 0–3 days of sowing, spray a recommended pre-emergence herbicide (e.g. atrazine) on moist soil; ask your KVK for the product and dose.',
    ]),
    t('scout-faw', 'pest-scouting', 15, ['फॉल आर्मीवर्म की जांच', 'Fall armyworm check'], [
      `पत्तियों में छेद और गोभ में बुरादा देखें; हर हफ्ते 20 पौधे जांचें। 5% पौधों पर नुकसान हो तो ${EXPERT_HI}`,
      `Look for holes in leaves and sawdust-like frass in the whorl; check 20 plants every week. If 5% of plants are damaged, ${EXPERT_EN}`,
    ]),
    t('weed', 'weeding', 20, ['निराई-गुड़ाई', 'Weeding & hoeing'], [
      '20–25 दिन पर बचे खरपतवार निकालें, साथ में हल्की मिट्टी चढ़ाएं।',
      'At 20–25 days, remove the remaining weeds and earth up lightly.',
    ]),
    t('irr-winter', 'irrigation', 40, ['पाले से बचाव की सिंचाई', 'Frost-protection irrigation'], [
      'दिसंबर–जनवरी में पाले की आशंका हो तो हल्की सिंचाई करें; रबी मक्का को 20–25 दिन पर पानी देते रहें।',
      'In December–January, give a light irrigation when frost is likely; keep irrigating rabi maize every 20–25 days.',
    ], { only: ['rabi'] }),
    t('n-1', 'fertilizer', 30, ['नाइट्रोजन — घुटने तक ऊँचाई', 'Nitrogen — knee-high'], [
      `${SOIL_HI} 1/3 नाइट्रोजन देकर मिट्टी चढ़ाएं।`,
      `Apply 1/3 of the N ${SOIL_EN} and earth up.`,
    ]),
    t('irr-knee', 'irrigation', 32, ['सिंचाई (घुटने तक ऊँचाई)', 'Irrigation (knee-high)'], [
      'खरीफ में बारिश न हो तब; रबी/बसंत में ज़रूर करें। खेत में पानी न रुकने दें।',
      'In kharif only if there is no rain; always in rabi/spring. Do not let water stand in the field.',
    ]),
    t('n-2', 'fertilizer', 45, ['नाइट्रोजन — नर मंजरी से पहले', 'Nitrogen — before tasseling'], [
      `${SOIL_HI} बाकी 1/3 नाइट्रोजन।`,
      `The last 1/3 of the N, ${SOIL_EN}.`,
    ]),
    t('irr-tassel', 'irrigation', 50, ['सिंचाई (नर मंजरी व रेशे)', 'Irrigation (tasseling & silking)'], [
      'सबसे ज़रूरी सिंचाई — इस समय सूखा पड़ने से दाने कम बनते हैं।',
      'The most important irrigation — drought now means fewer grains.',
    ]),
    t('scout-blight', 'pest-scouting', 55, ['पत्ती झुलसा व तना सड़न की जांच', 'Leaf blight & stalk rot check'], [
      'पत्तियों पर लंबे भूरे धब्बे या तने का सड़ना/गिरना देखें।',
      'Look for long brown leaf lesions or rotting, falling stalks.',
    ]),
    t('irr-grain', 'irrigation', 70, ['सिंचाई (दाना भरना)', 'Irrigation (grain filling)'], [
      'दाना भरते समय नमी बनाए रखें; खरीफ में बारिश न हो तब।',
      'Keep the soil moist during grain filling; in kharif only if there is no rain.',
    ]),
    harvest(['कटाई', 'Harvest'], [
      'भुट्टे का छिलका सूखकर पीला हो और दाने सख्त हों तब तोड़ें; अच्छी तरह सुखाकर रखें।',
      'Pick when the husk is dry and yellow and the grains are hard; dry well before storing.',
    ]),
  ],

  bajra: [
    prep(-7, ['1–2 जुताई कर खेत समतल करें; गर्मी की गहरी जुताई से कीट कम होते हैं।', 'Plough 1–2 times and level the field; deep summer ploughing reduces pests.']),
    seedTreat(-1, [
      'अर्गट के दाने हटाने को बीज 10% नमक के घोल में धोकर सुखाएं; जोगिया (डाउनी मिल्ड्यू) से बचाव को मेटालैक्सिल से उपचार।',
      'Wash seed in 10% salt solution to remove ergot bodies and dry it; treat with metalaxyl against downy mildew.',
    ]),
    sowBasal([
      `अच्छी बारिश के बाद 45–50 सेमी कतार में बोएं; ${SOIL_HI} पूरा फॉस्फोरस और आधा नाइट्रोजन।`,
      `Sow after good rain in rows 45–50 cm apart; ${SOIL_EN}, all the P and half the N.`,
    ]),
    t('thin', 'other', 18, ['छंटाई व खाली जगह भरना', 'Thinning & gap filling'], [
      '15 सेमी पर एक पौधा रखें; निकाले पौधों से बारिश के दिन खाली जगह भरें।',
      'Keep one plant every 15 cm; use the thinned plants to fill gaps on a rainy day.',
    ]),
    t('weed', 'weeding', 20, ['निराई-गुड़ाई', 'Weeding & hoeing'], ['20–25 दिन पर एक-दो बार निराई करें।', 'Weed once or twice at 20–25 days.']),
    t('scout-dm', 'pest-scouting', 25, ['जोगिया (हरी बाली) रोग की जांच', 'Downy mildew (green ear) check'], [
      'पत्तियों के नीचे सफ़ेद फफूंद या पीली धारियां वाले पौधे उखाड़कर नष्ट करें।',
      'Uproot and destroy plants with white mould under the leaves or yellow streaks.',
    ]),
    t('n-top', 'fertilizer', 30, ['नाइट्रोजन टॉप ड्रेसिंग', 'Nitrogen top dressing'], [
      `${SOIL_HI} बाकी आधा नाइट्रोजन, खेत में नमी होने पर।`,
      `The other half of the N ${SOIL_EN}, when the soil is moist.`,
    ]),
    t('irr-flower', 'irrigation', 45, ifDry(['सिंचाई (फूल आना)', 'Irrigation (flowering)']), [
      'लंबा सूखा हो तो फूल के समय एक सिंचाई करें।',
      'In a long dry spell, give one irrigation at flowering.',
    ]),
    t('scout-ergot', 'pest-scouting', 50, ['अर्गट (चेपा) की जांच', 'Ergot check'], [
      `बाली से शहद जैसा चिपचिपा रस टपके तो प्रभावित बालियां हटाएं; ${EXPERT_HI}`,
      `If ears ooze sticky honeydew, remove them; ${EXPERT_EN}`,
    ]),
    t('irr-grain', 'irrigation', 58, ifDry(['सिंचाई (दाना भरना)', 'Irrigation (grain filling)']), [
      'दाना भरते समय नमी की कमी से दाने हल्के रहते हैं।',
      'Moisture stress during grain filling gives light grains.',
    ]),
    harvest(['कटाई', 'Harvest'], ['दाने सख्त होने पर बालियां काटकर सुखाएं, फिर गहाई करें।', 'When grains are hard, cut the ears, dry them, then thresh.']),
  ],

  jowar: [
    prep(-7, ['जुताई कर खेत समतल करें; पानी निकासी रखें।', 'Plough and level the field; keep drainage.']),
    seedTreat(-1, [
      'प्ररोह मक्खी (शूट फ्लाई) और बीज सड़न से बचाव के लिए अनुशंसित कीटनाशक व फफूंदनाशक से बीज उपचार।',
      'Treat seed with a recommended insecticide and fungicide against shoot fly and seed rot.',
    ]),
    sowBasal([
      `45×15 सेमी पर बोएं; ${SOIL_HI} पूरा फॉस्फोरस-पोटाश और आधा नाइट्रोजन।`,
      `Sow at 45×15 cm; ${SOIL_EN}, all the P and K and half the N.`,
    ]),
    t('scout-shootfly', 'pest-scouting', 10, ['प्ररोह मक्खी की जांच', 'Shoot fly check'], [
      `बीच की पत्ती सूखना (डेड हार्ट) 7–25 दिन में दिखे तो ${EXPERT_HI}`,
      `If the central leaf dries (dead heart) at 7–25 days, ${EXPERT_EN}`,
    ]),
    t('thin', 'other', 15, ['छंटाई', 'Thinning'], ['15 सेमी पर एक स्वस्थ पौधा रखें।', 'Keep one healthy plant every 15 cm.']),
    t('weed', 'weeding', 20, ['निराई-गुड़ाई', 'Weeding & hoeing'], ['20–25 दिन पर निराई करें।', 'Weed at 20–25 days.']),
    t('n-top', 'fertilizer', 30, ['नाइट्रोजन टॉप ड्रेसिंग', 'Nitrogen top dressing'], [`${SOIL_HI} बाकी आधा नाइट्रोजन।`, `The other half of the N, ${SOIL_EN}.`]),
    t('irr-pi', 'irrigation', 35, ifDry(['सिंचाई (बाली बनना)', 'Irrigation (panicle initiation)']), [
      'रबी ज्वार में यह सिंचाई ज़रूरी है।',
      'Essential for rabi sorghum.',
    ]),
    t('scout-borer', 'pest-scouting', 40, ['तना छेदक की जांच', 'Stem borer check'], [
      'पत्तियों में कतार में छेद या सूखी गोभ देखें।',
      'Look for rows of holes in leaves or dead hearts.',
    ]),
    t('irr-flower', 'irrigation', 65, ifDry(['सिंचाई (फूल आना)', 'Irrigation (flowering)']), [
      'फूल के समय नमी की कमी से दाने कम बनते हैं।',
      'Moisture stress at flowering means fewer grains.',
    ]),
    t('scout-midge', 'pest-scouting', 66, ['मिज व दाना फफूंद की जांच', 'Midge & grain mould check'], [
      'फूल के समय नारंगी मक्खी (मिज) और पकते दानों पर फफूंद देखें।',
      'Look for orange midge flies at flowering and mould on ripening grain.',
    ]),
    harvest(['कटाई', 'Harvest'], [
      'दाने सख्त हों और दाने के निचले सिरे पर काला धब्बा बने तब कटाई करें।',
      'Harvest when grains are hard and show a black spot at the base.',
    ]),
  ],

  barley: [
    prep(-7, ['पलेवा देकर 2–3 जुताई व पाटा लगाएं।', 'Give a pre-sowing irrigation, then 2–3 ploughings and planking.']),
    seedTreat(-1, ['कंडुआ (स्मट) से बचाव के लिए कार्बोक्सिन 1.5–2 ग्राम/किलो बीज।', 'Carboxin 1.5–2 g/kg seed against smut.']),
    sowBasal([
      `22.5 सेमी कतार में बोएं; ${SOIL_HI} फॉस्फोरस-पोटाश और आधा नाइट्रोजन बुवाई पर।`,
      `Sow in rows 22.5 cm apart; ${SOIL_EN}, the P and K and half the N at sowing.`,
    ]),
    t('irr-1', 'irrigation', 30, ['पहली सिंचाई (कल्ले)', 'First irrigation (tillering)'], ['30–35 दिन पर पहली सिंचाई।', 'First irrigation at 30–35 days.']),
    t('weed', 'weeding', 31, ['खरपतवार नियंत्रण', 'Weed control'], [
      'पहली सिंचाई के बाद निराई या अनुशंसित खरपतवारनाशी।',
      'After the first irrigation, hand weeding or a recommended herbicide.',
    ]),
    t('n-top', 'fertilizer', 32, ['नाइट्रोजन टॉप ड्रेसिंग', 'Nitrogen top dressing'], [
      `${SOIL_HI} बाकी नाइट्रोजन पहली सिंचाई के बाद।`,
      `The rest of the N after the first irrigation, ${SOIL_EN}.`,
    ]),
    t('scout-rust', 'pest-scouting', 50, ['पीला रतुआ व माहू की जांच', 'Yellow rust & aphid check'], [
      'पत्तियों पर पीली धारियां या माहू की कॉलोनी देखें।',
      'Look for yellow stripes on leaves or aphid colonies.',
    ]),
    t('irr-2', 'irrigation', 62, ['दूसरी सिंचाई (झंडा पत्ती)', 'Second irrigation (flag leaf)'], ['60–65 दिन पर।', 'At 60–65 days.']),
    t('irr-3', 'irrigation', 87, ifDry(['तीसरी सिंचाई (दूधिया दाना)', 'Third irrigation (milk stage)']), [
      '85–90 दिन पर; तेज़ हवा में न करें।',
      'At 85–90 days; not in strong wind.',
    ]),
    harvest(['कटाई', 'Harvest'], ['पकते ही काटें, वरना फसल गिरती है और दाने झड़ते हैं।', 'Cut as soon as it is ripe, or the crop lodges and grains shatter.']),
  ],

  gram: [
    prep(-7, ['हल्की जुताई कर ढेले तोड़ें; खेत में पानी न रुके।', 'Plough lightly and break clods; water must not stand in the field.']),
    seedTreat(-1, PULSE_SEED),
    sowAll([
      `30×10 सेमी पर 8–10 सेमी गहरा बोएं; ${SOIL_HI} पूरी खाद (नाइट्रोजन, फॉस्फोरस, सल्फर) बुवाई पर।`,
      `Sow 8–10 cm deep at 30×10 cm; ${SOIL_EN}, all the fertilizer (N, P, sulphur) at sowing.`,
    ]),
    t('weed', 'weeding', 25, ['निराई-गुड़ाई', 'Weeding & hoeing'], ['25–30 दिन पर पहली निराई करें।', 'First weeding at 25–30 days.']),
    t('scout-wilt', 'pest-scouting', 30, ['उकठा (विल्ट) की जांच', 'Wilt check'], [
      'मुरझाते पौधे उखाड़कर नष्ट करें; अगली बार फसल चक्र अपनाएं।',
      'Uproot and destroy wilting plants; rotate crops next season.',
    ]),
    t('nip', 'other', 35, ['खुटाई (ऊपरी कोंपल तोड़ना)', 'Nipping (pinching the shoot tips)'], [
      'अच्छी बढ़वार वाली फसल में 30–40 दिन पर ऊपरी कोंपलें तोड़ने से शाखाएं बढ़ती हैं।',
      'In a vigorous crop, pinching the tips at 30–40 days gives more branches.',
    ]),
    t('irr-1', 'irrigation', 45, ifDry(['सिंचाई (फूल से पहले)', 'Irrigation (before flowering)']), [
      'हल्की सिंचाई करें; फूल खिलते समय सिंचाई न करें।',
      'Irrigate lightly; never while flowers are open.',
    ]),
    t('pheromone', 'crop-protection', 55, ['फेरोमोन ट्रैप व पक्षी ठिकाने', 'Pheromone traps & bird perches'], [
      'फली छेदक के लिए 2 फेरोमोन ट्रैप और 15–20 "T" आकार के पक्षी ठिकाने प्रति एकड़ लगाएं।',
      'For pod borer, set 2 pheromone traps and 15–20 T-shaped bird perches per acre.',
    ]),
    t('scout-podborer', 'pest-scouting', 65, ['फली छेदक की जांच', 'Pod borer check'], [
      `हर हफ्ते देखें; 1 सूंडी प्रति मीटर कतार दिखे तो NPV/नीम आधारित दवा या ${EXPERT_HI}`,
      `Check weekly; at 1 larva per metre of row, use NPV/neem products or ${EXPERT_EN}`,
    ]),
    t('irr-2', 'irrigation', 85, ifDry(['सिंचाई (फली बनना)', 'Irrigation (pod formation)']), [
      'हल्की सिंचाई; भारी सिंचाई से पौधे पीले पड़ते हैं।',
      'Light irrigation only; heavy watering yellows the plants.',
    ]),
    harvest(['कटाई', 'Harvest'], [
      'पौधे सूखकर पीले-भूरे हों और दाने सख्त हों तब काटें।',
      'Cut when plants dry to yellow-brown and the seeds are hard.',
    ]),
  ],

  arhar: [
    prep(-10, ['गहरी जुताई करें; मेड़/रिज बनाएं ताकि पानी न रुके।', 'Plough deep; make ridges so water does not stand.']),
    seedTreat(-1, PULSE_SEED),
    sowAll([`75×20–25 सेमी पर बोएं; ${SOIL_HI} पूरी खाद बुवाई पर।`, `Sow at 75×20–25 cm; ${SOIL_EN}, all the fertilizer at sowing.`]),
    t('thin', 'other', 20, ['छंटाई', 'Thinning'], ['एक जगह एक स्वस्थ पौधा रखें।', 'Keep one healthy plant per spot.']),
    t('weed', 'weeding', 25, ['पहली निराई-गुड़ाई', 'First weeding & hoeing'], ['25–30 दिन पर निराई करें।', 'Weed at 25–30 days.']),
    t('weed-2', 'weeding', 50, ['दूसरी निराई', 'Second weeding'], [
      '45–50 दिन पर; उसके बाद फसल खुद खरपतवार दबा लेती है।',
      'At 45–50 days; after that the crop smothers weeds itself.',
    ]),
    t('scout-wilt', 'pest-scouting', 60, ['उकठा व बांझपन मोज़ेक की जांच', 'Wilt & sterility mosaic check'], [
      'मुरझाए या झाड़ीनुमा, बिना फूल वाले पौधे उखाड़कर नष्ट करें।',
      'Uproot and destroy wilted plants and bushy plants without flowers.',
    ]),
    t('pheromone', 'crop-protection', 100, ['फेरोमोन ट्रैप लगाएं', 'Set pheromone traps'], [
      'फूल शुरू होते ही फली छेदक की निगरानी के लिए 2 ट्रैप/एकड़ लगाएं।',
      'As flowering starts, set 2 traps per acre to monitor pod borer.',
    ]),
    t('irr-flower', 'irrigation', 105, ifDry(['सिंचाई (फूल आना)', 'Irrigation (flowering)']), ['हल्की सिंचाई; पानी भराव न हो।', 'Light irrigation; no waterlogging.']),
    t('scout-pod', 'pest-scouting', 115, ['फली छेदक व फली मक्खी की जांच', 'Pod borer & pod fly check'], [
      `फलियों में छेद और फूलों पर जाले (मारुका) देखें; ${EXPERT_HI}`,
      `Look for holes in pods and webbed flowers (Maruca); ${EXPERT_EN}`,
    ]),
    t('irr-pod', 'irrigation', 125, ifDry(['सिंचाई (फली बनना)', 'Irrigation (pod formation)']), [
      'फली भरते समय नमी की कमी से दाने छोटे रहते हैं।',
      'Moisture stress during pod filling gives small seeds.',
    ]),
    harvest(['कटाई', 'Harvest'], ['75–80% फलियां भूरी होने पर कटाई करें।', 'Harvest when 75–80% of pods are brown.']),
  ],

  moong: [
    prep(-5, ['1–2 जुताई व पाटा; गेहूं के बाद गर्मी की फसल हो तो पलेवा देकर बोएं।', 'Plough 1–2 times and plank; after wheat, sow the summer crop after a pre-sowing irrigation.']),
    seedTreat(-1, PULSE_SEED),
    sowAll([
      `खरीफ में 30–45 सेमी, गर्मी में 22.5–30 सेमी कतार; ${SOIL_HI} पूरी खाद बुवाई पर।`,
      `Rows 30–45 cm apart in kharif, 22.5–30 cm in summer; ${SOIL_EN}, all the fertilizer at sowing.`,
    ]),
    t('herbicide-pre', 'weeding', 1, PRE_EM_TITLE, PRE_EMERGENCE),
    t('weed', 'weeding', 20, ['निराई-गुड़ाई', 'Weeding & hoeing'], ['20–25 दिन पर हाथ से निराई करें।', 'Hand weed at 20–25 days.']),
    t('scout-ymv', 'pest-scouting', 20, ['पीला मोज़ेक व सफ़ेद मक्खी की जांच', 'Yellow mosaic & whitefly check'], YMV),
    t('irr-1', 'irrigation', 22, ['पहली सिंचाई (गर्मी की फसल)', 'First irrigation (summer crop)'], [
      'गर्मी की फसल में 20–25 दिन पर; खरीफ में ज़रूरत पर ही।',
      'At 20–25 days for the summer crop; in kharif only if needed.',
    ]),
    t('irr-flower', 'irrigation', 30, ifDry(['सिंचाई (फूल आना)', 'Irrigation (flowering)']), ['फूल झड़ने से बचाने को हल्की सिंचाई।', 'A light irrigation to stop flower drop.']),
    t('scout-thrips', 'pest-scouting', 32, ['थ्रिप्स व फली छेदक की जांच', 'Thrips & pod borer check'], [
      `फूल झड़ना या फलियों में छेद दिखे तो ${EXPERT_HI}`,
      `If flowers drop or pods have holes, ${EXPERT_EN}`,
    ]),
    t('irr-pod', 'irrigation', 42, ifDry(['सिंचाई (फली भरना)', 'Irrigation (pod filling)']), [
      '55 दिन के बाद सिंचाई न करें, ताकि फसल एक साथ पके।',
      'No irrigation after 55 days, so the crop matures evenly.',
    ]),
    harvest(['कटाई / तुड़ाई', 'Harvest / picking'], [
      '80% फलियां काली होने पर कटाई करें; देरी से फलियां चटकती हैं।',
      'Harvest when 80% of pods turn black; delay makes pods shatter.',
    ]),
  ],

  urad: [
    prep(-5, ['1–2 जुताई व पाटा; जल निकासी के लिए नाली बनाएं।', 'Plough 1–2 times and plank; make drains.']),
    seedTreat(-1, PULSE_SEED),
    sowAll([`30–45 सेमी कतार में बोएं; ${SOIL_HI} पूरी खाद बुवाई पर।`, `Sow in rows 30–45 cm apart; ${SOIL_EN}, all the fertilizer at sowing.`]),
    t('herbicide-pre', 'weeding', 1, PRE_EM_TITLE, PRE_EMERGENCE),
    t('weed', 'weeding', 20, ['निराई-गुड़ाई', 'Weeding & hoeing'], ['20–25 दिन पर हाथ से निराई करें।', 'Hand weed at 20–25 days.']),
    t('scout-ymv', 'pest-scouting', 20, ['पीला मोज़ेक व सफ़ेद मक्खी की जांच', 'Yellow mosaic & whitefly check'], YMV),
    t('irr-1', 'irrigation', 22, ['पहली सिंचाई (गर्मी की फसल)', 'First irrigation (summer crop)'], [
      'गर्मी की फसल में 20–25 दिन पर; खरीफ में ज़रूरत पर ही।',
      'At 20–25 days for the summer crop; in kharif only if needed.',
    ]),
    t('irr-flower', 'irrigation', 35, ifDry(['सिंचाई (फूल आना)', 'Irrigation (flowering)']), ['हल्की सिंचाई करें।', 'Irrigate lightly.']),
    t('scout-leafspot', 'pest-scouting', 40, ['पत्ती धब्बा व फली छेदक की जांच', 'Leaf spot & pod borer check'], [
      `पत्तियों पर भूरे गोल धब्बे या फलियों में छेद दिखें तो ${EXPERT_HI}`,
      `If leaves show round brown spots or pods have holes, ${EXPERT_EN}`,
    ]),
    t('irr-pod', 'irrigation', 45, ifDry(['सिंचाई (फली भरना)', 'Irrigation (pod filling)']), ['फली भरते समय नमी बनाए रखें।', 'Keep the soil moist during pod filling.']),
    harvest(['कटाई', 'Harvest'], ['70–80% फलियां काली होने पर कटाई करें।', 'Harvest when 70–80% of pods turn black.']),
  ],

  masoor: [
    prep(-7, ['पलेवा देकर भुरभुरी मिट्टी करें; धान के बाद उतेरा बुवाई भी कर सकते हैं।', 'Give a pre-sowing irrigation and make a fine tilth; relay sowing in paddy also works.']),
    seedTreat(-1, PULSE_SEED),
    sowAll([`22.5–30 सेमी कतार में बोएं; ${SOIL_HI} पूरी खाद बुवाई पर।`, `Sow in rows 22.5–30 cm apart; ${SOIL_EN}, all the fertilizer at sowing.`]),
    t('weed', 'weeding', 30, ['निराई-गुड़ाई', 'Weeding & hoeing'], ['30 और 60 दिन पर निराई करें।', 'Weed at 30 and 60 days.']),
    t('scout-wilt', 'pest-scouting', 40, ['उकठा की जांच', 'Wilt check'], ['मुरझाते पौधे उखाड़कर नष्ट करें।', 'Uproot and destroy wilting plants.']),
    t('irr-1', 'irrigation', 42, ifDry(['सिंचाई (शाखाएं बनना)', 'Irrigation (branching)']), ['एक ही सिंचाई हो तो 6 हफ्ते पर दें।', 'If only one irrigation, give it at 6 weeks.']),
    t('scout-aphid', 'pest-scouting', 50, ['माहू की जांच', 'Aphid check'], [
      `टहनियों पर माहू की कॉलोनी ज़्यादा हो तो ${EXPERT_HI}`,
      `If shoots carry heavy aphid colonies, ${EXPERT_EN}`,
    ]),
    t('scout-rust', 'pest-scouting', 70, ['रतुआ व झुलसा की जांच', 'Rust & blight check'], [
      'कोहरे/नमी में पत्तियों पर भूरे-नारंगी धब्बे देखें।',
      'In fog or humid weather, look for brown-orange spots on leaves.',
    ]),
    t('irr-2', 'irrigation', 75, ifDry(['सिंचाई (फली बनना)', 'Irrigation (pod formation)']), ['हल्की सिंचाई करें।', 'Irrigate lightly.']),
    harvest(['कटाई', 'Harvest'], ['पौधे और फलियां भूरी होने पर कटाई करें।', 'Harvest when plants and pods turn brown.']),
  ],

  mustard: [
    prep(-7, ['पलेवा देकर मिट्टी भुरभुरी करें; छोटे बीज के लिए बारीक तैयारी ज़रूरी।', 'Give a pre-sowing irrigation and make a fine tilth; the small seed needs it.']),
    seedTreat(-1, [
      'सफ़ेद रतुआ व तना सड़न से बचाव के लिए मेटालैक्सिल या ट्राइकोडर्मा से बीज उपचार।',
      'Treat seed with metalaxyl or Trichoderma against white rust and stem rot.',
    ]),
    sowBasal([
      `45 सेमी कतार में 2–3 सेमी गहरा बोएं; ${SOIL_HI} पूरा फॉस्फोरस-पोटाश, सल्फर (जिप्सम) और आधा नाइट्रोजन।`,
      `Sow 2–3 cm deep in rows 45 cm apart; ${SOIL_EN}, all the P, K and sulphur (gypsum) and half the N.`,
    ]),
    t('thin', 'other', 18, ['घने पौधे निकालना', 'Thinning'], ['15–20 दिन पर पौधों में 10–15 सेमी दूरी रखें।', 'At 15–20 days, keep plants 10–15 cm apart.']),
    t('weed', 'weeding', 25, ['निराई-गुड़ाई', 'Weeding & hoeing'], ['25–30 दिन पर निराई करें।', 'Weed at 25–30 days.']),
    t('irr-1', 'irrigation', 30, ['पहली सिंचाई (शाखाएं)', 'First irrigation (branching)'], ['फूल आने से पहले 30–35 दिन पर।', 'At 30–35 days, before flowering.']),
    t('n-top', 'fertilizer', 31, ['नाइट्रोजन टॉप ड्रेसिंग', 'Nitrogen top dressing'], [
      `${SOIL_HI} बाकी आधा नाइट्रोजन पहली सिंचाई के बाद।`,
      `The other half of the N after the first irrigation, ${SOIL_EN}.`,
    ]),
    t('scout-aphid', 'pest-scouting', 45, ['माहू (चेपा) की जांच', 'Aphid check'], [
      `दिसंबर–जनवरी में हर हफ्ते देखें; 10% पौधों पर माहू हो तो ${EXPERT_HI} छिड़काव शाम को करें ताकि मधुमक्खियां बचें।`,
      `Check weekly in December–January; if 10% of plants have aphids, ${EXPERT_EN} Spray in the evening to spare bees.`,
    ]),
    t('scout-blight', 'pest-scouting', 55, ['झुलसा व सफ़ेद रतुआ की जांच', 'Blight & white rust check'], [
      'पत्तियों पर भूरे गोल धब्बे या नीचे की ओर सफ़ेद फफोले देखें।',
      'Look for round brown leaf spots or white blisters under the leaves.',
    ]),
    t('irr-2', 'irrigation', 65, ifDry(['दूसरी सिंचाई (फलियां भरना)', 'Second irrigation (pod filling)']), [
      'फलियां भरते समय नमी बनाए रखें।',
      'Keep the soil moist while pods fill.',
    ]),
    harvest(['कटाई', 'Harvest'], [
      '75% फलियां पीली-भूरी होने पर सुबह के समय काटें, दाने कम झड़ते हैं।',
      'Cut in the morning when 75% of pods are yellow-brown; fewer seeds shatter.',
    ]),
  ],

  soybean: [
    prep(-7, ['गहरी जुताई व पाटा; रिज-फरो या चौड़ी क्यारी (BBF) बनाएं।', 'Plough deep and plank; make ridge-furrows or broad beds (BBF).']),
    seedTreat(-1, [
      `${PULSE_SEED[0]} बोने से पहले अंकुरण जांच लें (70% से ऊपर)।`,
      `${PULSE_SEED[1]} Check germination before sowing (above 70%).`,
    ]),
    sowAll([
      `लगभग 100 मिमी बारिश के बाद 45 सेमी कतार में 3 सेमी गहरा बोएं; ${SOIL_HI} पूरी खाद बुवाई पर।`,
      `After about 100 mm of rain, sow 3 cm deep in rows 45 cm apart; ${SOIL_EN}, all the fertilizer at sowing.`,
    ]),
    t('herbicide-pre', 'weeding', 1, PRE_EM_TITLE, PRE_EMERGENCE),
    t('weed', 'weeding', 20, ['पहली निराई', 'First weeding'], ['20 दिन पर हाथ से निराई या डोरा चलाएं।', 'Hand weed or run a blade hoe at 20 days.']),
    t('scout-stemfly', 'pest-scouting', 22, ['तना मक्खी व गर्डल बीटल की जांच', 'Stem fly & girdle beetle check'], [
      'मुरझाते पौधे और तने पर दो गोल छल्ले देखें; प्रभावित हिस्से तोड़कर नष्ट करें।',
      'Look for wilting plants and two rings girdling the stem; remove and destroy affected parts.',
    ]),
    t('drain', 'other', 30, ['पानी निकासी', 'Drainage'], ['तेज़ बारिश के बाद खेत में पानी न रुकने दें।', 'Do not let water stand after heavy rain.']),
    t('scout-ymv', 'pest-scouting', 35, ['पीला मोज़ेक व इल्लियों की जांच', 'Yellow mosaic & caterpillar check'], [
      `${YMV[0]} पत्ती खाने वाली इल्लियां ज़्यादा हों तो ${EXPERT_HI}`,
      `${YMV[1]} If leaf-eating caterpillars are many, ${EXPERT_EN}`,
    ]),
    t('weed-2', 'weeding', 40, ['दूसरी निराई', 'Second weeding'], ['फूल आने से पहले निराई पूरी करें।', 'Finish weeding before flowering.']),
    t('irr-pod', 'irrigation', 60, ifDry(['सिंचाई (फली भरना)', 'Irrigation (pod filling)']), [
      'लंबा सूखा हो तो एक सिंचाई से उपज बचती है।',
      'In a long dry spell, one irrigation saves the yield.',
    ]),
    harvest(['कटाई', 'Harvest'], [
      '95% फलियां भूरी होने पर कटाई करें; देरी से फलियां चटकती हैं।',
      'Harvest when 95% of pods are brown; delay makes pods shatter.',
    ]),
  ],

  groundnut: [
    prep(-7, ['गहरी जुताई कर मिट्टी भुरभुरी करें; सफ़ेद लट वाले खेत में गर्मी की जुताई करें।', 'Plough deep to a fine tilth; in white-grub fields, plough in summer.']),
    seedTreat(-1, [
      'टूटे दाने अलग करें; गिरी को ट्राइकोडर्मा या फफूंदनाशक, फिर राइज़ोबियम कल्चर से उपचारित करें।',
      'Remove broken kernels; treat with Trichoderma or a fungicide, then with Rhizobium culture.',
    ]),
    sowAll([`30×10 सेमी पर बोएं; ${SOIL_HI} पूरी खाद और आधा जिप्सम बुवाई पर।`, `Sow at 30×10 cm; ${SOIL_EN}, all the fertilizer and half the gypsum at sowing.`]),
    t('weed', 'weeding', 20, ['निराई-गुड़ाई', 'Weeding & hoeing'], [
      '20–25 दिन पर; 45 दिन बाद गुड़ाई न करें, सुइयां टूटती हैं।',
      'At 20–25 days; no hoeing after 45 days, it breaks the pegs.',
    ]),
    t('irr-flower', 'irrigation', 30, ifDry(['सिंचाई (फूल आना)', 'Irrigation (flowering)']), ['हल्की सिंचाई करें।', 'Irrigate lightly.']),
    t('scout-leaf', 'pest-scouting', 32, ['पत्ती सुरंगक व टिक्का रोग की जांच', 'Leaf miner & tikka check'], [
      'पत्तियों पर सुरंग/मुड़ना या भूरे-काले गोल धब्बे देखें।',
      'Look for mines or folded leaves and round brown-black spots.',
    ]),
    t('gypsum', 'fertilizer', 40, ['जिप्सम डालना', 'Apply gypsum'], [
      `${SOIL_HI} बाकी आधा जिप्सम पौधों के पास डालकर हल्की मिट्टी चढ़ाएं।`,
      `Place the other half of the gypsum near the plants ${SOIL_EN} and earth up lightly.`,
    ]),
    t('irr-peg', 'irrigation', 45, ['सिंचाई (सुइयां बनना)', 'Irrigation (pegging)'], [
      'इस समय नमी की कमी से फलियां कम बनती हैं।',
      'Moisture stress now means fewer pods.',
    ]),
    t('scout-rot', 'pest-scouting', 50, ['तना/कॉलर सड़न व सफ़ेद लट की जांच', 'Stem/collar rot & white grub check'], [
      'अचानक सूखते पौधे और जड़ के पास सफ़ेद फफूंद या लट देखें।',
      'Look for plants drying suddenly, white mould or grubs near the roots.',
    ]),
    t('irr-pod', 'irrigation', 70, ifDry(['सिंचाई (फली भरना)', 'Irrigation (pod filling)']), ['फली भरते समय नमी बनाए रखें।', 'Keep the soil moist while pods fill.']),
    harvest(['खुदाई', 'Digging'], [
      'पत्तियां पीली हों और फली के अंदर का छिलका काला दिखे तब खुदाई; फलियां अच्छी तरह सुखाएं।',
      'Dig when leaves yellow and the inside of the shell turns dark; dry the pods well.',
    ]),
  ],

  cotton: [
    prep(-10, [
      'पलेवा देकर जुताई करें; पिछली फसल की लकड़ियां व टिंडे हटाएं (गुलाबी सुंडी से बचाव)।',
      'Plough after a pre-sowing irrigation; remove old stalks and bolls (against pink bollworm).',
    ]),
    seedTreat(-1, [
      'Bt बीज अक्सर उपचारित आता है; देसी बीज को अनुशंसित फफूंदनाशक/कीटनाशक से उपचारित करें।',
      'Bt seed usually comes treated; treat desi seed with a recommended fungicide/insecticide.',
    ]),
    sowBasal([
      `अनुशंसित दूरी पर बोएं; Bt हाइब्रिड के पैकेट में रिफ्यूज बीज मिला होता है, Bt किस्मों के चारों ओर नॉन-Bt रिफ्यूज अलग से लगाएं; ${SOIL_HI} पूरा फॉस्फोरस-पोटाश।`,
      `Sow at the recommended spacing; Bt hybrid packets already contain refuge seed, but sow a separate non-Bt refuge around Bt varieties; ${SOIL_EN}, all the P and K.`,
    ]),
    t('thin', 'other', 20, ['छंटाई व खाली जगह भरना', 'Thinning & gap filling'], ['एक जगह एक स्वस्थ पौधा रखें।', 'Keep one healthy plant per spot.']),
    t('n-1', 'fertilizer', 30, ['नाइट्रोजन — पहली खुराक', 'Nitrogen — first dose'], [`${SOIL_HI} आधा नाइट्रोजन छंटाई के बाद।`, `Half the N after thinning, ${SOIL_EN}.`]),
    t('weed', 'weeding', 30, ['निराई-गुड़ाई', 'Weeding & hoeing'], ['30 और 50 दिन पर निराई-गुड़ाई करें।', 'Weed and hoe at 30 and 50 days.']),
    t('scout-sucking', 'pest-scouting', 35, ['रस चूसने वाले कीटों की जांच', 'Sucking pest check'], [
      'सफ़ेद मक्खी, जैसिड व थ्रिप्स के लिए पत्तियों के नीचे देखें; पीले चिपचिपे ट्रैप लगाएं।',
      'Check under the leaves for whitefly, jassid and thrips; put up yellow sticky traps.',
    ]),
    t('irr-square', 'irrigation', 45, ifDry(['सिंचाई (कलियां बनना)', 'Irrigation (squaring)']), [
      'कलियां झड़ने से बचाने को नमी बनाए रखें।',
      'Keep the soil moist so squares do not drop.',
    ]),
    t('pheromone', 'crop-protection', 50, ['गुलाबी सुंडी के लिए फेरोमोन ट्रैप', 'Pheromone traps for pink bollworm'], [
      '2–3 ट्रैप/एकड़ लगाएं; गुलाब जैसे मुड़े (रोज़ेट) फूल तोड़कर नष्ट करें।',
      'Set 2–3 traps per acre; pick and destroy rosetted flowers.',
    ]),
    t('n-2', 'fertilizer', 60, ['नाइट्रोजन — दूसरी खुराक (फूल आना)', 'Nitrogen — second dose (flowering)'], [`${SOIL_HI} बाकी नाइट्रोजन दें।`, `The rest of the N, ${SOIL_EN}.`]),
    t('irr-flower', 'irrigation', 65, ifDry(['सिंचाई (फूल आना)', 'Irrigation (flowering)']), [
      'फूल के समय पानी की कमी से टिंडे कम बनते हैं।',
      'Water stress at flowering means fewer bolls.',
    ]),
    t('scout-boll', 'pest-scouting', 80, ['टिंडों की जांच (गुलाबी सुंडी)', 'Boll check (pink bollworm)'], [
      `हर हफ्ते 20 हरे टिंडे तोड़कर अंदर देखें; नुकसान ज़्यादा हो तो ${EXPERT_HI}`,
      `Every week, open 20 green bolls and look inside; if damage is high, ${EXPERT_EN}`,
    ]),
    t('irr-boll', 'irrigation', 95, ifDry(['सिंचाई (टिंडे बनना)', 'Irrigation (boll formation)']), [
      'टिंडे खुलने लगें तो सिंचाई बंद करें।',
      'Stop irrigating once bolls start opening.',
    ]),
    harvest(['पहली चुनाई', 'First picking'], [
      'खिले टिंडों से सूखी कपास चुनें; गीली/गंदी कपास अलग रखें; 15–20 दिन पर अगली चुनाई।',
      'Pick dry cotton from open bolls; keep wet or dirty cotton separate; pick again every 15–20 days.',
    ]),
  ],

  // Base timeline = spring planting (Feb–Mar). Autumn cane (rabi) runs ~14–15 months, so its
  // weather-bound jobs (summer irrigation, earthing before the rains, tying in Aug–Sep, frost
  // irrigation in Dec–Jan) get their own offsets that land in the same calendar months.
  sugarcane: [
    prep(-15, ['गहरी जुताई कर 75–90 सेमी पर कूंड़/नाली बनाएं; सड़ी गोबर खाद मिलाएं।', 'Plough deep and open furrows 75–90 cm apart; mix in well-rotted FYM.']),
    t('seed-treat', 'seed-treatment', -1, ['बीज (टुकड़ों) का उपचार', 'Sett treatment'], [
      'स्वस्थ 2–3 आंख वाले टुकड़ों को कार्बेन्डाजिम 0.1% घोल में 10–15 मिनट डुबोएं।',
      'Dip healthy 2–3-bud setts in 0.1% carbendazim solution for 10–15 minutes.',
    ]),
    t('sow', 'sowing', 0, ['बुवाई व बेसल खाद', 'Planting & basal fertilizer'], [
      `कूंड़ में टुकड़े आंख बगल में रखकर बोएं; ${SOIL_HI} पूरा फॉस्फोरस-पोटाश (शरदकालीन में 1/3 नाइट्रोजन भी); दीमक वाले खेत में अनुशंसित उपचार। शरदकालीन गन्ने में गेहूं, आलू या सरसों की अंतर-फसल ले सकते हैं।`,
      `Lay setts in the furrow with buds to the side; ${SOIL_EN}, all the P and K (plus 1/3 of the N for autumn cane); recommended treatment in termite-prone fields. Autumn cane can carry an intercrop of wheat, potato or mustard.`,
    ]),
    t('irr-1', 'irrigation', 25, ['पहली सिंचाई', 'First irrigation'], [
      'बसंतकालीन में जमाव के समय हल्की सिंचाई; शरदकालीन में बुवाई के लगभग एक महीने बाद।',
      'Spring cane: a light irrigation during germination; autumn cane: about a month after planting.',
    ], { at: { rabi: 30 } }),
    t('n-1', 'fertilizer', 26, ['नाइट्रोजन — पहली टॉप ड्रेसिंग', 'Nitrogen — first top dressing'], [
      `${SOIL_HI}: बसंतकालीन में आधा नाइट्रोजन जमाव के बाद पहली सिंचाई के साथ; शरदकालीन में दूसरी 1/3 खुराक मार्च के आखिर में।`,
      `${SOIL_EN}: spring cane gets half the N with the first irrigation after germination; autumn cane gets its second 1/3 at the end of March.`,
    ], { at: { rabi: 175 } }),
    t('weed', 'weeding', 30, ['निराई-गुड़ाई', 'Weeding & hoeing'], [
      '30, 60 और 90 दिन पर गुड़ाई करें; सूखी पत्तियों की परत (मल्च) बिछाएं। अंतर-फसल हो तो उसकी निराई भी साथ करें।',
      'Hoe at 30, 60 and 90 days; spread a trash mulch. Weed any intercrop at the same time.',
    ]),
    t('irr-winter', 'irrigation', 290, ['सर्दी की सिंचाई व पाले से बचाव', 'Winter irrigation & frost protection'], [
      'नवंबर–जनवरी में महीने में एक सिंचाई; पाले से बचाने को मध्य दिसंबर और जनवरी के पहले हफ्ते में हल्की सिंचाई।',
      'Irrigate once a month in November–January; give light irrigations in mid December and the first week of January against frost.',
    ], { at: { rabi: 70 } }),
    t('scout-borer', 'pest-scouting', 45, ['अंकुर बेधक (अर्ली शूट बोरर) की जांच', 'Early shoot borer check'], [
      'अप्रैल–जून में सूखी गोभ (डेड हार्ट) वाले पौधे ज़मीन से काटकर नष्ट करें; पत्तियों की मल्च से हमला कम होता है।',
      'In April–June, cut plants with dead hearts at ground level and destroy them; trash mulch reduces attack.',
    ], { at: { rabi: 185 } }),
    t('irr-summer', 'irrigation', 55, ['गर्मी में नियमित सिंचाई', 'Regular summer irrigation'], [
      'अप्रैल–जून सबसे नाज़ुक समय है: 7–12 दिन पर सिंचाई करें, कल्ले बनते समय पानी की कमी न हो।',
      'April–June is the most critical period: irrigate every 7–12 days and never let the tillering crop go short of water.',
    ], { at: { rabi: 190 } }),
    t('n-2', 'fertilizer', 90, ['नाइट्रोजन — आखिरी खुराक', 'Nitrogen — last dose'], [
      `${SOIL_HI}: बसंतकालीन में बाकी आधा नाइट्रोजन मई–जून में; शरदकालीन में आखिरी 1/3 अप्रैल के आखिर तक।`,
      `${SOIL_EN}: spring cane gets the other half of the N in May–June; autumn cane gets its last 1/3 by the end of April.`,
    ], { at: { rabi: 205 } }),
    t('earthing', 'other', 110, ['मिट्टी चढ़ाना', 'Earthing up'], [
      'मई–जून में, बरसात से पहले मिट्टी चढ़ाएं ताकि गन्ना न गिरे।',
      'Earth up in May–June, before the rains, so the cane does not lodge.',
    ], { at: { rabi: 240 } }),
    t('scout-redrot', 'pest-scouting', 150, ['लाल सड़न व पायरिला की जांच', 'Red rot & pyrilla check'], [
      'जुलाई–सितंबर में ऊपरी पत्तियां सूखना और तने में लाल धारियां देखें; रोगी झुंड उखाड़कर नष्ट करें।',
      'In July–September, look for drying top leaves and red streaks inside the cane; uproot and destroy diseased clumps.',
    ], { at: { rabi: 300 } }),
    t('tie', 'other', 185, ['गन्ना बांधना (बंधाई)', 'Propping (tying) the cane'], [
      'अगस्त के आखिर–सितंबर की शुरुआत में पत्तियों की रस्सी से कतार के गन्ने बांधें ताकि गिरें नहीं।',
      'In late August–early September, tie each cane row with twisted trash so it does not lodge.',
    ], { at: { rabi: 330 } }),
    harvest(['कटाई', 'Harvest'], [
      'ज़मीन से सटाकर काटें; पेड़ी (रैटून) लेनी हो तो जनवरी के आखिर से पहले न काटें।',
      'Cut close to the ground; for a ratoon crop, do not harvest before the end of January.',
    ]),
  ],

  potato: [
    prep(-10, ['गहरी जुताई करें, सड़ी गोबर खाद मिलाकर मिट्टी भुरभुरी बनाएं।', 'Plough deep and work in well-rotted FYM for a friable soil.']),
    t('seed-treat', 'seed-treatment', -2, ['बीज आलू का उपचार', 'Seed tuber treatment'], [
      '40–50 ग्राम के अंकुरित स्वस्थ कंद लें; ब्लैक स्कर्फ से बचाव को बोरिक एसिड 3% घोल या अनुशंसित फफूंदनाशक में डुबोकर छाया में सुखाएं।',
      'Use healthy sprouted 40–50 g tubers; dip in 3% boric acid or a recommended fungicide against black scurf and dry in shade.',
    ]),
    sowBasal([
      `60×20 सेमी पर मेड़ में बोएं; ${SOIL_HI} पूरा फॉस्फोरस-पोटाश और आधा नाइट्रोजन।`,
      `Plant on ridges at 60×20 cm; ${SOIL_EN}, all the P and K and half the N.`,
    ]),
    t('irr-1', 'irrigation', 8, ['पहली हल्की सिंचाई', 'First light irrigation'], [
      'बुवाई के 7–10 दिन पर हल्की सिंचाई; मेड़ आधी ही डूबे।',
      'A light irrigation 7–10 days after planting; water only half-way up the ridge.',
    ]),
    t('weed', 'weeding', 20, ['निराई', 'Weeding'], ['उथली निराई करें, कंद न कटें।', 'Weed shallowly so tubers are not cut.']),
    t('n-earth', 'fertilizer', 28, ['नाइट्रोजन व मिट्टी चढ़ाना', 'Nitrogen & earthing up'], [
      `${SOIL_HI} बाकी नाइट्रोजन देकर मेड़ पर मिट्टी चढ़ाएं ताकि कंद ढके रहें।`,
      `Apply the rest of the N ${SOIL_EN} and earth up the ridges so tubers stay covered.`,
    ]),
    t('irr-2', 'irrigation', 35, ['सिंचाई (कंद बनना)', 'Irrigation (tuber initiation)'], [
      'हर 10–12 दिन पर हल्की सिंचाई; पाले की आशंका हो तो सिंचाई करें।',
      'Light irrigation every 10–12 days; irrigate when frost is likely.',
    ]),
    t('protect-blight', 'crop-protection', 40, ['पछेती झुलसा से बचाव', 'Late blight protection'], [
      `ठंडा, नम, कोहरे वाला मौसम हो तो बचाव का छिड़काव करें; ${EXPERT_HI}`,
      `In cold, humid, foggy weather, give a protective spray; ${EXPERT_EN}`,
    ]),
    t('scout-blight', 'pest-scouting', 50, ['झुलसा व माहू की जांच', 'Blight & aphid check'], [
      'पत्तियों पर काले-भूरे धब्बे या माहू दिखें तो जल्द उपाय करें।',
      'Act early if leaves show dark brown spots or aphids.',
    ]),
    t('irr-3', 'irrigation', 60, ['सिंचाई (कंद बढ़ना)', 'Irrigation (tuber bulking)'], ['कंद बढ़ते समय नमी समान रखें।', 'Keep moisture even while tubers bulk.']),
    fromHarvest('dehaulm', 'other', -15, ['सिंचाई बंद कर डंठल काटना', 'Stop irrigation & cut haulms'], [
      'खुदाई से 10–15 दिन पहले सिंचाई बंद कर डंठल काटें, ताकि छिलका पक्का हो।',
      'Stop irrigating and cut the haulms 10–15 days before digging so the skin sets.',
    ]),
    harvest(['खुदाई', 'Digging'], [
      'छिलका पक्का होने पर खुदाई करें; कंद छाया में सुखाकर छांटें।',
      'Dig once the skin is set; dry tubers in shade and grade them.',
    ]),
  ],

  onion: [
    nursery('nursery-prep', 'other', -5, NURSERY_PREP_TITLE, [
      `एक एकड़ के लिए लगभग 200 वर्ग मीटर; ${NURSERY_BED[0]}`,
      `About 200 sq m for one acre. ${NURSERY_BED[1]}`,
    ]),
    nursery('seed-treat', 'seed-treatment', -1, ['बीज उपचार', 'Seed treatment'], NURSERY_SEED),
    nursery('nursery-sow', 'sowing', 0, NURSERY_SOW_TITLE, [
      'कतारों में पतला बोएं; पौध गलन से बचाने को पानी कम-कम दें।',
      'Sow thinly in lines; water little and often to avoid damping-off.',
    ]),
    prep(-3, ['जुताई कर गोबर खाद मिलाएं और समतल क्यारियां बनाएं।', 'Plough, mix in FYM and make level beds.']),
    transplant([
      `15×10 सेमी पर रोपें; ${SOIL_HI} पूरा फॉस्फोरस-पोटाश, सल्फर और आधा नाइट्रोजन; तुरंत हल्की सिंचाई।`,
      `Transplant at 15×10 cm; ${SOIL_EN}, all the P, K and sulphur and half the N; irrigate lightly at once.`,
    ]),
    t('irr-1', 'irrigation', 3, ['दूसरी हल्की सिंचाई', 'Second light irrigation'], ['रोपाई के 3 दिन बाद, फिर 7–10 दिन पर।', '3 days after transplanting, then every 7–10 days.']),
    t('weed', 'weeding', 25, ['निराई', 'Weeding'], ['25–30 और 50 दिन पर उथली निराई करें।', 'Weed shallowly at 25–30 and 50 days.']),
    t('n-1', 'fertilizer', 30, ['नाइट्रोजन टॉप ड्रेसिंग', 'Nitrogen top dressing'], [
      `${SOIL_HI} बाकी नाइट्रोजन 30 व 45 दिन पर; 60 दिन बाद न दें।`,
      `The rest of the N at 30 and 45 days, ${SOIL_EN}; none after 60 days.`,
    ]),
    t('scout-thrips', 'pest-scouting', 35, ['थ्रिप्स की जांच', 'Thrips check'], [
      `पत्तियों पर चांदी जैसी धारियां देखें; नीले चिपचिपे ट्रैप लगाएं; ${EXPERT_HI}`,
      `Look for silvery streaks on leaves; put up blue sticky traps; ${EXPERT_EN}`,
    ]),
    t('scout-blotch', 'pest-scouting', 55, ['बैंगनी धब्बा (पर्पल ब्लॉच) की जांच', 'Purple blotch check'], [
      `नम मौसम में पत्तियों पर बैंगनी धब्बे दिखें तो ${EXPERT_HI}`,
      `If purple spots appear on leaves in humid weather, ${EXPERT_EN}`,
    ]),
    t('irr-bulb', 'irrigation', 60, ['सिंचाई (गांठ बढ़ना)', 'Irrigation (bulb development)'], [
      'नियमित सिंचाई करें; इस समय पानी की कमी से गांठ छोटी रहती है।',
      'Irrigate regularly; water stress now keeps bulbs small.',
    ]),
    fromHarvest('stop-irr', 'irrigation', -12, ['सिंचाई बंद करें', 'Stop irrigation'], [
      'खुदाई से 10–15 दिन पहले, जब पत्तियां गिरने लगें।',
      '10–15 days before lifting, when the tops start to fall.',
    ]),
    harvest(['खुदाई व सुखाना', 'Lifting & curing'], [
      'गर्दन गिरने के बाद खुदाई करें; 3–4 दिन खेत में और 2–3 हफ्ते छाया में सुखाकर रखें।',
      'Lift after the necks fall; cure 3–4 days in the field and 2–3 weeks in shade before storing.',
    ]),
  ],

  tomato: [
    nursery('nursery-prep', 'other', -5, NURSERY_PREP_TITLE, [`${NURSERY_BED[0]}${NET_COVER[0]}`, `${NURSERY_BED[1]}${NET_COVER[1]}`]),
    nursery('seed-treat', 'seed-treatment', -1, ['बीज उपचार', 'Seed treatment'], NURSERY_SEED),
    nursery('nursery-sow', 'sowing', 0, NURSERY_SOW_TITLE, NURSERY_SOW),
    prep(-5, ['गहरी जुताई, सड़ी गोबर खाद; मेड़ या क्यारियां बनाएं।', 'Plough deep, add well-rotted FYM; make ridges or beds.']),
    transplant(EVENING_TRANSPLANT),
    t('scout-whitefly', 'pest-scouting', 10, ['सफ़ेद मक्खी व पत्ती मोड़क वायरस की जांच', 'Whitefly & leaf curl virus check'], [
      'मुड़ी-सिकुड़ी पत्तियों वाले पौधे उखाड़ें; पीले चिपचिपे ट्रैप लगाएं।',
      'Uproot plants with curled, crinkled leaves; put up yellow sticky traps.',
    ]),
    t('irr', 'irrigation', 15, ['नियमित सिंचाई', 'Regular irrigation'], [
      'सर्दी में 10–12, गर्मी में 5–7 दिन पर; फूल-फल के समय नमी समान रखें।',
      'Every 10–12 days in winter, 5–7 in summer; keep moisture even at flowering and fruiting.',
    ]),
    t('weed', 'weeding', 20, ['निराई-गुड़ाई व मिट्टी चढ़ाना', 'Weeding & earthing up'], [
      'खरपतवार निकालकर पौधों पर हल्की मिट्टी चढ़ाएं।',
      'Remove weeds and earth up the plants lightly.',
    ]),
    t('stake', 'other', 25, ['सहारा देना (स्टेकिंग)', 'Staking'], [
      'लकड़ी या तार से पौधों को सहारा दें ताकि फल मिट्टी से न लगें।',
      'Support plants with stakes or wire so fruits stay off the soil.',
    ]),
    t('n-1', 'fertilizer', 30, ['नाइट्रोजन — पहली टॉप ड्रेसिंग', 'Nitrogen — first top dressing'], [`${SOIL_HI} नाइट्रोजन दें।`, `Apply N ${SOIL_EN}.`]),
    t('pheromone', 'crop-protection', 35, ['फल छेदक के लिए फेरोमोन ट्रैप', 'Pheromone traps for fruit borer'], [
      '2–3 ट्रैप/एकड़ लगाएं; किनारे गेंदा लगाएं; छेद वाले फल तोड़कर नष्ट करें।',
      'Set 2–3 traps per acre; grow marigold on the borders; pick and destroy bored fruits.',
    ]),
    t('scout-blight', 'pest-scouting', 45, ['झुलसा (ब्लाइट) की जांच', 'Blight check'], [
      `पत्तियों पर छल्लेदार या पानी-भरे काले धब्बे दिखें तो ${EXPERT_HI}`,
      `If leaves show ringed or water-soaked dark spots, ${EXPERT_EN}`,
    ]),
    t('n-2', 'fertilizer', 50, ['नाइट्रोजन — दूसरी टॉप ड्रेसिंग', 'Nitrogen — second top dressing'], [`${SOIL_HI} बाकी नाइट्रोजन दें।`, `The rest of the N, ${SOIL_EN}.`]),
    harvest(['पहली तुड़ाई', 'First picking'], [
      'दूर बाज़ार के लिए रंग बदलते फल तोड़ें; 3–4 दिन पर तुड़ाई करें।',
      'For distant markets, pick fruits as they turn colour; pick every 3–4 days.',
    ]),
  ],

  brinjal: [
    nursery('nursery-prep', 'other', -5, NURSERY_PREP_TITLE, NURSERY_BED),
    nursery('seed-treat', 'seed-treatment', -1, ['बीज उपचार', 'Seed treatment'], NURSERY_SEED),
    nursery('nursery-sow', 'sowing', 0, NURSERY_SOW_TITLE, NURSERY_SOW),
    prep(-5, ['गहरी जुताई, सड़ी गोबर खाद; मेड़ या क्यारियां बनाएं।', 'Plough deep, add well-rotted FYM; make ridges or beds.']),
    transplant(EVENING_TRANSPLANT),
    t('irr', 'irrigation', 7, ['नियमित सिंचाई', 'Regular irrigation'], ['गर्मी में 4–6 दिन, सर्दी में 10–14 दिन पर।', 'Every 4–6 days in summer, 10–14 days in winter.']),
    t('weed', 'weeding', 20, ['निराई-गुड़ाई व मिट्टी चढ़ाना', 'Weeding & earthing up'], [
      'खरपतवार निकालकर पौधों पर हल्की मिट्टी चढ़ाएं।',
      'Remove weeds and earth up the plants lightly.',
    ]),
    t('scout-sfb', 'pest-scouting', 30, ['तना व फल छेदक की जांच', 'Shoot & fruit borer check'], [
      'मुरझाई टहनियां और छेद वाले फल तोड़कर नष्ट करें; फेरोमोन ट्रैप लगाएं।',
      'Cut and destroy wilted shoots and bored fruits; put up pheromone traps.',
    ]),
    t('n-1', 'fertilizer', 30, ['नाइट्रोजन टॉप ड्रेसिंग', 'Nitrogen top dressing'], [`${SOIL_HI} नाइट्रोजन दें।`, `Apply N ${SOIL_EN}.`]),
    t('scout-littleleaf', 'pest-scouting', 40, ['छोटी पत्ती रोग व रस चूसक कीटों की जांच', 'Little leaf & sucking pest check'], [
      'छोटी पत्तियों वाले झाड़ीनुमा पौधे उखाड़ें; जैसिड/सफ़ेद मक्खी पर नज़र रखें।',
      'Uproot bushy plants with tiny leaves; watch for jassids and whitefly.',
    ]),
    harvest(['पहली तुड़ाई', 'First picking'], ['चमकदार, कोमल फल तोड़ें; 7–10 दिन पर तुड़ाई करें।', 'Pick glossy, tender fruits; pick every 7–10 days.']),
    fromHarvest('n-2', 'fertilizer', 12, ['तुड़ाई के बाद नाइट्रोजन', 'Nitrogen after pickings'], [`${SOIL_HI} बाकी नाइट्रोजन दें।`, `The rest of the N, ${SOIL_EN}.`]),
  ],

  cauliflower: [
    nursery('nursery-prep', 'other', -5, NURSERY_PREP_TITLE, NURSERY_BED),
    nursery('seed-treat', 'seed-treatment', -1, ['बीज उपचार', 'Seed treatment'], NURSERY_SEED),
    nursery('nursery-sow', 'sowing', 0, NURSERY_SOW_TITLE, [
      'कतारों में पतला बोएं; तेज़ धूप/बारिश से पौध बचाएं।',
      'Sow thinly in lines; shield seedlings from harsh sun and rain.',
    ]),
    prep(-5, ['गहरी जुताई करें; भरपूर सड़ी गोबर खाद मिलाएं।', 'Plough deep; mix in plenty of well-rotted FYM.']),
    transplant(EVENING_TRANSPLANT),
    t('irr', 'irrigation', 7, ['नियमित सिंचाई', 'Regular irrigation'], ['गर्मी में 7–8 दिन, सर्दी में 10–15 दिन पर।', 'Every 7–8 days in summer, 10–15 days in winter.']),
    t('weed', 'weeding', 20, ['निराई व मिट्टी चढ़ाना', 'Weeding & earthing up'], [
      'खरपतवार निकालकर पौधों पर हल्की मिट्टी चढ़ाएं।',
      'Remove weeds and earth up the plants lightly.',
    ]),
    t('scout-dbm', 'pest-scouting', 20, ['हीरक पीठ पतंगा (DBM) व माहू की जांच', 'Diamondback moth (DBM) & aphid check'], [
      `पत्तियों में छोटे छेद या हरी सूंडियां दिखें तो ${EXPERT_HI}`,
      `If leaves have small holes or green caterpillars, ${EXPERT_EN}`,
    ]),
    t('n-1', 'fertilizer', 30, ['नाइट्रोजन टॉप ड्रेसिंग', 'Nitrogen top dressing'], [`${SOIL_HI} बाकी नाइट्रोजन दें।`, `The rest of the N, ${SOIL_EN}.`]),
    t('boron', 'fertilizer', 35, ['बोरॉन व मॉलिब्डेनम की जांच', 'Boron & molybdenum check'], [
      `${SOIL_HI}; कमी हो तो बोरेक्स/मॉलिब्डेनम दें, वरना फूल भूरा और तना खोखला होता है।`,
      `${SOIL_EN}, give borax/molybdenum if deficient; otherwise curds brown and stems turn hollow.`,
    ]),
    t('blanch', 'other', 60, ['फूल ढकना (ब्लांचिंग)', 'Blanching'], [
      'फूल दिखने पर ऊपर की पत्तियां मोड़कर ढकें ताकि सफ़ेद रहे।',
      'When curds appear, fold the inner leaves over them to keep them white.',
    ]),
    harvest(['कटाई', 'Harvest'], [
      'फूल कसा और सफ़ेद हो तब काटें (अगेती किस्में पहले); देरी से फूल बिखरता है।',
      'Cut when the curd is compact and white (early varieties sooner); delay makes it loose.',
    ]),
  ],

  chilli: [
    nursery('nursery-prep', 'other', -5, NURSERY_PREP_TITLE, [`${NURSERY_BED[0]}${NET_COVER[0]}`, `${NURSERY_BED[1]}${NET_COVER[1]}`]),
    nursery('seed-treat', 'seed-treatment', -1, ['बीज उपचार', 'Seed treatment'], NURSERY_SEED),
    nursery('nursery-sow', 'sowing', 0, NURSERY_SOW_TITLE, NURSERY_SOW),
    prep(-5, ['गहरी जुताई, सड़ी गोबर खाद; मेड़ बनाएं ताकि पानी न रुके।', 'Plough deep, add well-rotted FYM; make ridges so water drains.']),
    transplant([
      `मोटी, स्वस्थ पौध मेड़ पर रोपें; ${SOIL_HI} पूरा फॉस्फोरस-पोटाश और आधा नाइट्रोजन।`,
      `Transplant sturdy, healthy seedlings on ridges; ${SOIL_EN}, all the P and K and half the N.`,
    ]),
    t('irr', 'irrigation', 7, ['नियमित सिंचाई', 'Regular irrigation'], ['7–10 दिन पर; पानी भराव न हो, जड़ सड़ती है।', 'Every 7–10 days; no waterlogging, roots rot.']),
    t('scout-thrips', 'pest-scouting', 15, ['थ्रिप्स, माइट व पत्ती मोड़क की जांच', 'Thrips, mite & leaf curl check'], [
      `ऊपर/नीचे मुड़ती पत्तियां देखें; मुड़े पौधे उखाड़ें; नीले/पीले चिपचिपे ट्रैप लगाएं; ${EXPERT_HI}`,
      `Look for leaves curling up or down; uproot curled plants; put up blue/yellow sticky traps; ${EXPERT_EN}`,
    ]),
    t('weed', 'weeding', 20, ['निराई-गुड़ाई', 'Weeding & hoeing'], ['खरपतवार निकालकर पौधों पर हल्की मिट्टी चढ़ाएं।', 'Remove weeds and earth up the plants lightly.']),
    t('n-1', 'fertilizer', 30, ['नाइट्रोजन टॉप ड्रेसिंग', 'Nitrogen top dressing'], [`${SOIL_HI} नाइट्रोजन दें।`, `Apply N ${SOIL_EN}.`]),
    t('scout-anthracnose', 'pest-scouting', 60, ['फल सड़न (एन्थ्रेक्नोज़) की जांच', 'Fruit rot (anthracnose) check'], [
      `फलों पर धंसे काले धब्बे या टहनियां ऊपर से सूखना दिखे तो ${EXPERT_HI}`,
      `If fruits show sunken black spots or twigs die back from the tip, ${EXPERT_EN}`,
    ]),
    harvest(['पहली तुड़ाई', 'First picking'], ['हरी मिर्च 7–10 दिन पर तोड़ें; लाल मिर्च पूरी लाल होने पर।', 'Pick green chilli every 7–10 days; red chilli when fully red.']),
    fromHarvest('n-2', 'fertilizer', 5, ['तुड़ाई के बाद नाइट्रोजन', 'Nitrogen after picking starts'], [`${SOIL_HI} बाकी नाइट्रोजन दें।`, `The rest of the N, ${SOIL_EN}.`]),
  ],

  okra: [
    prep(-7, ['जुताई कर गोबर खाद मिलाएं; गर्मी में मेड़ पर बुवाई अच्छी।', 'Plough and mix in FYM; ridge sowing is better in summer.']),
    t('seed-treat', 'seed-treatment', -1, ['बीज भिगोना व उपचार', 'Seed soaking & treatment'], [
      'बीज 24 घंटे पानी में भिगोएं; ट्राइकोडर्मा या फफूंदनाशक से उपचार करें।',
      'Soak seed in water for 24 hours; treat with Trichoderma or a fungicide.',
    ]),
    sowBasal([
      `गर्मी में 45×15, बरसात में 60×30 सेमी; ${SOIL_HI} पूरा फॉस्फोरस-पोटाश और आधा नाइट्रोजन।`,
      `45×15 cm in summer, 60×30 cm in the rains; ${SOIL_EN}, all the P and K and half the N.`,
    ]),
    t('irr-1', 'irrigation', 5, ['पहली सिंचाई', 'First irrigation'], ['गर्मी में 4–5 दिन पर; बरसात में ज़रूरत पर।', 'At 4–5 days in summer; as needed in the rains.']),
    t('weed', 'weeding', 20, ['निराई-गुड़ाई', 'Weeding & hoeing'], ['20–25 दिन पर निराई करें।', 'Weed at 20–25 days.']),
    t('scout-ymv', 'pest-scouting', 20, ['पीला शिरा मोज़ेक व सफ़ेद मक्खी की जांच', 'Yellow vein mosaic & whitefly check'], YMV),
    t('irr', 'irrigation', 30, ['नियमित सिंचाई (फूल-फल)', 'Regular irrigation (flowering-fruiting)'], [
      'फूल और फल बनते समय नमी बनाए रखें।',
      'Keep the soil moist through flowering and fruiting.',
    ]),
    t('scout-borer', 'pest-scouting', 40, ['तना व फल छेदक की जांच', 'Shoot & fruit borer check'], [
      `मुरझाई चोटी और छेद वाले फल तोड़कर नष्ट करें; ${EXPERT_HI}`,
      `Remove and destroy wilted tips and bored fruits; ${EXPERT_EN}`,
    ]),
    harvest(['पहली तुड़ाई', 'First picking'], ['कोमल 6–8 सेमी फल हर 2–3 दिन पर तोड़ें।', 'Pick tender 6–8 cm pods every 2–3 days.']),
    fromHarvest('n-top', 'fertilizer', 2, ['नाइट्रोजन (पहली तुड़ाई के बाद)', 'Nitrogen (after the first picking)'], [
      `${SOIL_HI} बाकी नाइट्रोजन दें।`,
      `The rest of the N, ${SOIL_EN}.`,
    ]),
  ],

  garlic: [
    prep(-7, ['जुताई कर भरपूर सड़ी गोबर खाद मिलाएं; समतल क्यारियां बनाएं।', 'Plough, mix in plenty of well-rotted FYM; make level beds.']),
    t('seed-treat', 'seed-treatment', -1, ['कलियों का उपचार', 'Clove treatment'], [
      'मोटी स्वस्थ कलियां अलग करें; कार्बेन्डाजिम 0.1% घोल में डुबोकर बोएं।',
      'Separate bold, healthy cloves; dip in 0.1% carbendazim before planting.',
    ]),
    sowBasal([
      `15×7.5–10 सेमी पर 3–5 सेमी गहरी, नोक ऊपर रखें; ${SOIL_HI} पूरा फॉस्फोरस-पोटाश, सल्फर और 1/3 नाइट्रोजन।`,
      `Plant 3–5 cm deep at 15×7.5–10 cm, tip up; ${SOIL_EN}, all the P, K and sulphur and 1/3 of the N.`,
    ]),
    t('irr-1', 'irrigation', 1, ['पहली हल्की सिंचाई', 'First light irrigation'], ['बुवाई के तुरंत बाद, फिर 8–12 दिन पर।', 'Right after planting, then every 8–12 days.']),
    t('weed', 'weeding', 30, ['निराई', 'Weeding'], [
      '30 और 60 दिन पर उथली निराई; पुआल की परत (मल्च) से खरपतवार कम होते हैं।',
      'Weed shallowly at 30 and 60 days; a straw mulch keeps weeds down.',
    ]),
    t('n-1', 'fertilizer', 30, ['नाइट्रोजन — पहली टॉप ड्रेसिंग', 'Nitrogen — first top dressing'], [`${SOIL_HI} 1/3 नाइट्रोजन दें।`, `Apply 1/3 of the N, ${SOIL_EN}.`]),
    t('n-2', 'fertilizer', 45, ['नाइट्रोजन — दूसरी टॉप ड्रेसिंग', 'Nitrogen — second top dressing'], [`${SOIL_HI} बाकी नाइट्रोजन दें।`, `The rest of the N, ${SOIL_EN}.`]),
    t('scout-thrips', 'pest-scouting', 50, ['थ्रिप्स व बैंगनी धब्बा की जांच', 'Thrips & purple blotch check'], [
      `पत्तियों पर चांदी जैसी धारियां या बैंगनी धब्बे दिखें तो ${EXPERT_HI}`,
      `If leaves show silvery streaks or purple spots, ${EXPERT_EN}`,
    ]),
    t('irr-bulb', 'irrigation', 75, ['सिंचाई (गांठ बनना)', 'Irrigation (bulbing)'], [
      'गांठ बनते-बढ़ते समय 8–10 दिन पर नियमित सिंचाई करें।',
      'Irrigate regularly every 8–10 days while bulbs form and grow.',
    ]),
    fromHarvest('stop-irr', 'irrigation', -15, ['सिंचाई बंद करें', 'Stop irrigation'], ['खुदाई से लगभग 15 दिन पहले।', 'About 15 days before lifting.']),
    harvest(['खुदाई व सुखाना', 'Lifting & curing'], [
      'पत्तियां पीली-सूखी होने पर खुदाई; 5–7 दिन छाया में सुखाकर गुच्छों में रखें।',
      'Lift when the leaves yellow and dry; cure 5–7 days in shade and store in bunches.',
    ]),
  ],
};

/** Fallback specs for crops outside the catalog ('other' / free-text). */
const GENERIC_SPECS: Spec[] = [
  prep(-7, ['जुताई कर सड़ी गोबर खाद मिलाएं और खेत समतल करें।', 'Plough, mix in well-rotted FYM and level the field.']),
  seedTreat(-1, ['ट्राइकोडर्मा या अनुशंसित फफूंदनाशक से बीज उपचार करें।', 'Treat seed with Trichoderma or a recommended fungicide.']),
  sowBasal([`अनुशंसित दूरी पर बोएं; ${SOIL_HI} बेसल खाद डालें।`, `Sow at the recommended spacing; apply basal fertilizer ${SOIL_EN}.`]),
  t('irr-1', 'irrigation', 15, ['सिंचाई', 'Irrigation'], ['मिट्टी की नमी देखकर सिंचाई करें; पानी भराव न हो।', 'Irrigate by soil moisture; avoid waterlogging.']),
  t('weed', 'weeding', 25, ['निराई-गुड़ाई', 'Weeding & hoeing'], ['20–30 दिन पर खरपतवार निकालें।', 'Remove weeds at 20–30 days.']),
  t('n-top', 'fertilizer', 30, ['टॉप ड्रेसिंग', 'Top dressing'], [`${SOIL_HI} नाइट्रोजन की अगली खुराक दें।`, `Give the next dose of N, ${SOIL_EN}.`]),
  t('scout-1', 'pest-scouting', 35, ['कीट-रोग की जांच', 'Pest & disease check'], [
    'पत्तियों के ऊपर-नीचे कीट, धब्बे या मुरझाना देखें।',
    'Check both sides of leaves for pests, spots or wilting.',
  ]),
  t('irr-flower', 'irrigation', 50, ['सिंचाई (फूल आना)', 'Irrigation (flowering)'], ['फूल आने पर पानी की कमी न होने दें।', 'Do not let the crop go short of water at flowering.']),
  t('scout-2', 'pest-scouting', 60, ['कीट-रोग की जांच', 'Pest & disease check'], [`नुकसान बढ़ता दिखे तो ${EXPERT_HI}`, `If damage is spreading, ${EXPERT_EN}`]),
  harvest(['कटाई', 'Harvest'], ['फसल पकने पर समय से कटाई करें।', 'Harvest on time once the crop is ripe.']),
];

// ---------- Resolution ----------

const GENERIC_ID = 'generic';

/** Maps a base-timeline day onto a variant's stage days (piecewise linear between stage starts). */
function mapDay(info: CropInfo, p: CropProfile, d: number): number {
  const baseHarvest = Math.round((info.durationDays.min + info.durationDays.max) / 2);
  if (p.stages === info.stages && p.harvestDay === baseHarvest) return d;
  const from = info.stages.map(s => s.startDay).concat(baseHarvest);
  const to = p.stages.map(s => s.startDay).concat(p.harvestDay);
  if (from.length !== to.length) return Math.round((d * p.harvestDay) / baseHarvest);
  const last = from.length - 1;
  if (d >= from[last]) return to[last] + (d - from[last]);
  let i = 0;
  while (i < last - 1 && d >= from[i + 1]) i++;
  const span = from[i + 1] - from[i];
  return Math.round(to[i] + (span > 0 ? ((d - from[i]) * (to[i + 1] - to[i])) / span : 0));
}

function offsetFor(s: Spec, p: CropProfile, info: CropInfo | undefined): number {
  const fixed = s.at?.[p.season];
  const d = fixed ?? s.dayOffset;
  if (s.anchor === 'nursery') return d - p.nurseryMidDays;
  if (s.anchor === 'harvest') return p.harvestDay + d;
  return fixed !== undefined || s.only || d <= 0 || !info ? d : mapDay(info, p, d);
}

const resolved = new WeakMap<CropProfile, TaskTemplate[]>();

function resolve(specs: Spec[], p: CropProfile, info: CropInfo | undefined): TaskTemplate[] {
  return specs
    .filter(s => !s.only || s.only.includes(p.season))
    .map(s => ({ s, day: offsetFor(s, p, info) }))
    .sort((a, b) => a.day - b.day)
    .map(({ s, day }) => ({
      id: s.id,
      type: s.type,
      dayOffset: day,
      titleHi: s.titleHi,
      titleEn: s.titleEn,
      descHi: s.descHi,
      descEn: s.descEn,
    }));
}

/** Templates for one resolved timeline (from profileFor / timelineFor). Shared arrays: do not mutate. */
function templatesForProfile(cropKey: string, p: CropProfile): TaskTemplate[] {
  const cached = resolved.get(p);
  if (cached) return cached;
  const info = getCropInfo(cropKey);
  const list = resolve(info ? SPECS[info.key] : GENERIC_SPECS, p, info);
  resolved.set(p, list);
  return list;
}

/**
 * Templates for a crop key in a season (or the season implied by `day0`), sorted by dayOffset.
 * Unknown keys get the generic list. Returned arrays are shared: do not mutate.
 */
export function templatesFor(cropKey: string, season?: Season | null, day0?: ISODate | null): TaskTemplate[] {
  return templatesForProfile(cropKey, profileFor(cropKey, season, day0));
}

/** Base-season templates per crop (e.g. kharif maize, spring sugarcane). */
export const TASK_TEMPLATES: Record<CropKey, TaskTemplate[]> = Object.fromEntries(
  CROP_KEYS.map(k => [k, templatesFor(k)]),
) as Record<CropKey, TaskTemplate[]>;

/** Fallback for crops outside the catalog ('other' / free-text). */
export const GENERIC_TEMPLATES: TaskTemplate[] = templatesFor(GENERIC_ID);

export const templateIdFor = (cropKey: string, templateId: string): string =>
  `${isCropKey(cropKey) ? cropKey : GENERIC_ID}:${templateId}`;

function dated(cropKey: string, list: TaskTemplate[], day0: ISODate): DatedTaskTemplate[] {
  return list.map(tpl => ({ ...tpl, templateId: templateIdFor(cropKey, tpl.id), dueDate: addDays(day0, tpl.dayOffset) }));
}

/**
 * Templates with due dates from day 0 (sowing, or transplanting for nursery crops). The season
 * defaults to the one implied by day 0. Returns [] for an invalid date.
 */
export function datedTemplatesFor(cropKey: string, day0: ISODate | null | undefined, season?: Season | null): DatedTaskTemplate[] {
  if (!isValidISODate(day0)) return [];
  return dated(cropKey, templatesFor(cropKey, season, day0), day0);
}

/** datedTemplatesFor() for a crop record, using the same timeline as stageForCrop(). */
export function datedTemplatesForCrop(crop: CropTiming): DatedTaskTemplate[] {
  const tl = timelineFor(crop);
  return tl.day0 ? dated(crop.cropKey, templatesForProfile(crop.cropKey, tl.profile), tl.day0) : [];
}

/** Looks up a template by DatedTaskTemplate.templateId, e.g. to re-render a stored task's text. */
export function findTemplate(templateId: string): TaskTemplate | undefined {
  const i = templateId.indexOf(':');
  if (i < 0) return undefined;
  const key = templateId.slice(0, i);
  const id = templateId.slice(i + 1);
  const specs = isCropKey(key) ? SPECS[key] : key === GENERIC_ID ? GENERIC_SPECS : undefined;
  const spec = specs?.find(s => s.id === id);
  if (!spec) return undefined;
  return templatesFor(key, spec.only?.[0]).find(x => x.id === id);
}

/** Title and description in the UI language (English for 'en', Hindi otherwise). */
export function templateText(tpl: TaskTemplate, lang: string): { title: string; desc: string } {
  return lang === 'en' ? { title: tpl.titleEn, desc: tpl.descEn } : { title: tpl.titleHi, desc: tpl.descHi };
}

// ---------- Dev checks ----------

// The calendar's harvest row must equal expectedHarvestDate(), and ids must stay unique so
// stored templateIds keep resolving.
if (import.meta.env.DEV) {
  const check = (label: string, specs: Spec[], p: CropProfile, list: TaskTemplate[]) => {
    const problems: string[] = [];
    const ids = specs.map(s => s.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupes.length) problems.push(`duplicate ids ${dupes.join(', ')}`);
    const harvests = list.filter(x => x.type === 'harvest');
    if (harvests.length !== 1 || harvests[0].dayOffset !== p.harvestDay) problems.push('harvest task must be at the expected harvest day');
    if (list.length < 8 || list.length > 14) problems.push(`${list.length} tasks (expected 8–14)`);
    if (!p.transplanted && specs.some(s => s.anchor === 'nursery')) problems.push('nursery task on a direct-sown crop');
    if (problems.length) console.warn(`[task-templates] ${label}: ${problems.join('; ')}`);
  };
  for (const key of CROP_KEYS) {
    for (const w of sowingWindowsFor(key)) check(`${key}/${w.season}`, SPECS[key], w.profile, templatesForProfile(key, w.profile));
  }
  const generic = profileFor(GENERIC_ID);
  check(GENERIC_ID, GENERIC_SPECS, generic, templatesForProfile(GENERIC_ID, generic));
}
