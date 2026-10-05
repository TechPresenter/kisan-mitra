// Pure text rules for the AI module: keyword intent detection (live search, disclaimers, forecast
// context), list-marker cleanup for model output and the spoken-answer word limit. No app or
// browser imports, so these can be checked on their own (see the dev checks at the bottom).

export interface Intent {
  price: boolean;
  scheme: boolean;
  weather: boolean;
  /** Spraying questions depend on the forecast (rain washes a spray off, wind drifts it). */
  spray: boolean;
  fertilizer: boolean;
  problem: boolean;
  /** Time-sensitive facts (prices, schemes, weather) → allow live web search. */
  grounding: boolean;
}

type RuleKey = Exclude<keyof Intent, 'grounding'>;

interface Rule {
  /** Hindi stems, matched at the start of a word: "भाव" finds "भाव"/"भावों" but not "अभाव"/"प्रभाव". */
  hi: string[];
  /** Words that start like a stem but mean something else. */
  hiNot?: string[];
  /** English words (the text is lower-cased and tokens are joined by single spaces). */
  en: RegExp;
}

const RULES: Record<RuleKey, Rule> = {
  price: {
    hi: ['भाव', 'दाम', 'कीमत', 'रेट', 'मंडी', 'बेच', 'एमएसपी', 'समर्थन मूल्य'],
    hiNot: ['भावना'],
    // Bare "rate" is handled in detectIntent ("seed rate" and "application rate" are not prices).
    en: /\b(prices?|mandi|msp|sell(s|ing)?|market\w*)\b/,
  },
  scheme: {
    hi: ['योजना', 'सब्सिडी', 'अनुदान', 'सम्मान निधि', 'बीमा', 'क्रेडिट कार्ड', 'लोन', 'कर्ज'],
    en: /\b(schemes?|subsid\w*|yojana|pm ?kisan|pmfby|insurance|kcc|loans?)\b/,
  },
  weather: {
    hi: ['मौसम', 'बारिश', 'बरसात', 'वर्षा', 'तापमान', 'पाला', 'ठंड', 'गर्मी', 'आंधी', 'तूफान', 'ओले', 'ओला', 'ओलों'],
    en: /\b(weather|rain\w*|forecast|temperature|frost|storms?|heat ?wave|hail\w*)\b/,
  },
  spray: {
    hi: ['छिड़काव', 'छिड़कें', 'छिड़कना', 'स्प्रे', 'दवा डाल', 'दवाई डाल', 'दवा छिड़'],
    en: /\bspray\w*\b/,
  },
  fertilizer: {
    hi: [
      'खाद',
      'उर्वरक',
      'यूरिया',
      'डीएपी',
      'पोटाश',
      'एनपीके',
      'जिंक',
      'सल्फर',
      'जिप्सम',
      'नैनो',
      'नाइट्रोजन',
      'फास्फोरस',
      'फॉस्फोरस',
      'सुपर फास्फेट',
      'बोरॉन',
      'बोरान',
    ],
    en: /\b(fertili[sz]\w*|urea|dap|npk|potash|zinc|sulph?ur|sulfur|manure|compost|nitrogen|phosph\w*|boron)\b/,
  },
  problem: {
    hi: ['रोग', 'बीमारी', 'कीट', 'कीड़', 'इल्ली', 'सुंडी', 'माहू', 'दीमक', 'पीले', 'पीला', 'पीली', 'सूख', 'धब्ब', 'झुलस', 'मुरझा', 'सड़', 'फफूंद'],
    hiNot: ['सड़क'],
    en: /\b(disease\w*|pests?|yellow\w*|spots?|wilt\w*|blight|rust|rot|rotting|insects?|fung\w*|worms?|aphids?|termites?|caterpillars?|borers?)\b/,
  },
};

/** Folds Hindi spelling variants (nukta, chandrabindu, ZWJ/ZWNJ) and case, so "कीड़े" matches "कीडे". */
export const fold = (s: string) =>
  s
    .normalize('NFC')
    .toLowerCase()
    .replace(/़/g, '')
    .replace(/ँ/g, 'ं')
    .replace(/[‌‍]/g, '');

const TOKEN_SPLIT = /[\s,।॥?!.:;()[\]{}"'“”‘’\/|\\\-–—]+/;

function tokensOf(text: string): string[] {
  return fold(text).split(TOKEN_SPLIT).filter(Boolean);
}

interface FoldedRule {
  words: string[];
  phrases: string[];
  not: string[];
  en: RegExp;
}

const FOLDED = Object.fromEntries(
  Object.entries(RULES).map(([k, r]) => {
    const stems = r.hi.map(fold);
    return [
      k,
      {
        words: stems.filter(s => !s.includes(' ')),
        phrases: stems.filter(s => s.includes(' ')),
        not: (r.hiNot || []).map(fold),
        en: r.en,
      },
    ];
  }),
) as Record<RuleKey, FoldedRule>;

/** "seed rate", "application rate"… are amounts, not prices. */
const RATE_NOT_PRICE = new Set([
  'seed',
  'seeding',
  'sowing',
  'application',
  'dose',
  'dosage',
  'spray',
  'spraying',
  'growth',
  'germination',
  'flow',
  'water',
  'irrigation',
  'fertilizer',
  'fertiliser',
  'mixing',
  'dilution',
  'interest',
  'survival',
  'heart',
]);

function matches(rule: FoldedRule, tokens: string[], joined: string): boolean {
  if (rule.words.some(stem => tokens.some(tok => tok.startsWith(stem) && !rule.not.some(n => tok.startsWith(n))))) return true;
  if (rule.phrases.some(p => joined.includes(` ${p}`))) return true;
  return rule.en.test(joined);
}

export function detectIntent(text: string): Intent {
  const tokens = tokensOf(text);
  const joined = ` ${tokens.join(' ')} `;
  const has = (k: RuleKey) => matches(FOLDED[k], tokens, joined);
  const rate = tokens.some((tok, i) => (tok === 'rate' || tok === 'rates') && !RATE_NOT_PRICE.has(tokens[i - 1] || ''));
  const price = has('price') || rate;
  const scheme = has('scheme');
  const weather = has('weather');
  return {
    price,
    scheme,
    weather,
    spray: has('spray'),
    fertilizer: has('fertilizer'),
    problem: has('problem'),
    grounding: price || scheme || weather,
  };
}

/** What an answer itself talks about: doses of fertilizer, or prices in rupees. */
export function detectAnswerMentions(text: string): { price: boolean; fertilizer: boolean } {
  const intent = detectIntent(text);
  const tokens = tokensOf(text);
  const priceWord = tokens.some(
    tok => ['भाव', 'दाम', 'कीमत', 'एमएसपी', 'msp', 'price', 'prices'].some(stem => tok.startsWith(stem)) && !tok.startsWith('भावना'),
  );
  const rupees = /₹\s?\d|\d\s*(रु|रुपय|रुपए|rs\b|rupee)|\brs\.?\s?\d/i.test(text);
  return { price: priceWord || rupees, fertilizer: intent.fertilizer };
}

/**
 * Strips one leading list marker ("•", "*", "-", "1.", "2)") from a line. A number is only a
 * marker when no digit follows its "." or ")", so doses like "2.5 ग्राम" or "0.5% घोल" stay intact.
 */
export function stripListMarker(s: string): string {
  return s.replace(/^\s*(?:[•*·▪]\s*|[-–—](?![\d०-९])\s*|\(?[\d०-९]{1,2}[.)](?![\d०-९])\s*)/, '');
}

/**
 * Keeps spoken answers short: text up to `max + tolerance` words is left as it is; a longer one is
 * cut at the last sentence end within the first `max` words.
 */
export function limitWords(text: string, max: number, tolerance = 10): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= max + tolerance) return text;
  const head = words.slice(0, max).join(' ');
  const end = Math.max(head.lastIndexOf('।'), head.lastIndexOf('. '), head.lastIndexOf('?'), head.lastIndexOf('!'));
  return end > head.length / 2 ? head.slice(0, end + 1) : `${head}…`;
}

// ---------- Dev checks ----------

/** Cases that once went wrong (a dose read as a list number, "अभाव" read as a price word). */
export function checkRules(): string[] {
  const problems: string[] = [];
  const eq = (label: string, got: unknown, want: unknown) => {
    if (JSON.stringify(got) !== JSON.stringify(want)) problems.push(`${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  };
  eq('dose 2.5', stripListMarker('2.5 ग्राम मैंकोजेब प्रति लीटर'), '2.5 ग्राम मैंकोजेब प्रति लीटर');
  eq('dose 0.5%', stripListMarker('0.5% यूरिया का घोल'), '0.5% यूरिया का घोल');
  eq('dose 1.5', stripListMarker('1.5 किलो जिंक सल्फेट'), '1.5 किलो जिंक सल्फेट');
  eq('dose 12.5', stripListMarker('12.5 किलो प्रति एकड़'), '12.5 किलो प्रति एकड़');
  eq('numbered', stripListMarker('1. नीम का तेल छिड़कें'), 'नीम का तेल छिड़कें');
  eq('numbered paren', stripListMarker('2) खेत में पानी न भरें'), 'खेत में पानी न भरें');
  eq('numbered tight', stripListMarker('3.नीम की खली डालें'), 'नीम की खली डालें');
  eq('bullet', stripListMarker('• 2.5 ग्राम प्रति लीटर'), '2.5 ग्राम प्रति लीटर');
  eq('dash', stripListMarker('- पानी दें'), 'पानी दें');
  eq('negative temp', stripListMarker('-2 डिग्री पर पाला'), '-2 डिग्री पर पाला');
  eq('number then dose', stripListMarker('1) 0.5% घोल'), '0.5% घोल');

  const i1 = detectIntent('धान में जिंक के अभाव से पत्ते पीले क्यों?');
  eq('अभाव not price', i1.price, false);
  eq('अभाव fertilizer', i1.fertilizer, true);
  eq('अभाव problem', i1.problem, true);
  eq('प्रभाव not price', detectIntent('दवा का प्रभाव कितने दिन रहता है?').price, false);
  eq('बादाम not price', detectIntent('बादाम की खेती कैसे करें?').price, false);
  eq('भाव price', detectIntent('गेहूं का भाव क्या है?').price, true);
  eq('भावों price', detectIntent('सरसों के भावों में तेजी?').price, true);
  eq('seed rate', detectIntent('What is the seed rate for wheat?').price, false);
  eq('application rate', detectIntent('urea application rate per acre').price, false);
  eq('rate price', detectIntent('What is the rate of wheat today?').price, true);
  eq('spray', detectIntent('इस हफ्ते छिड़काव करूं या नहीं?').spray, true);
  eq('spray en', detectIntent('Should I spray this week?').spray, true);
  eq('weather', detectIntent('कल बारिश होगी क्या?').weather, true);
  eq('scheme', detectIntent('पीएम किसान सम्मान निधि की किस्त कब आएगी?').scheme, true);
  eq('सड़क not problem', detectIntent('मंडी तक सड़क').problem, false);
  eq('answer dose', detectAnswerMentions('प्रति एकड़ 50 किलो यूरिया डालें।').fertilizer, true);
  eq('answer rupees', detectAnswerMentions('आज भाव 2,450 रुपये प्रति क्विंटल है।').price, true);
  eq('answer no price', detectAnswerMentions('जिंक के अभाव से पत्ते पीले होते हैं।').price, false);

  const long = Array.from({ length: 140 }, (_, i) => (i % 10 === 9 ? 'शब्द।' : 'शब्द')).join(' ');
  const cut = limitWords(long, 120);
  if (cut.split(/\s+/).length > 120) problems.push('limitWords: spoken answer longer than 120 words');
  eq('limitWords short', limitWords('छोटा जवाब।', 120), 'छोटा जवाब।');
  return problems;
}
