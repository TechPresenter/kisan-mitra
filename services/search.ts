// Global search ("खोजें"): one offline query over the crop catalog, the farmer's own crops,
// diseases & pests, farming techniques, government schemes, mandi crops, past AI chats,
// saved items and app features. Hindi and English, tolerant of case and common spelling
// variants (nukta, chandrabindu, joiners), plus simple Hinglish ("gehu", "aloo ki keemat", "khad").
//
// Everything is local and synchronous, so it works without internet and can run on every
// keystroke (screens should still pass the query through useDeferredValue).
import { useMemo } from 'react';
import { getSettings } from '../lib/app-state';
import { registerStrings, translate } from '../lib/i18n';
import { KEYS, store, usePersisted } from '../lib/store';
import { formatNumber } from '../lib/format';
import { CATEGORY_NAMES, CROP_LIST, catalogText } from '../data/crops';
import { CROP_NAMES, type CropKey } from '../data/crop-keys';
import { searchDiseases, type DiseaseInfo } from '../data/diseases';
import { searchTechniques, type Technique } from '../data/techniques';
import { SCHEMES, getSchemeCategory, searchSchemes } from '../data/schemes';
import type { AIConversation, Crop, GovernmentScheme, NavTarget, SavedItem } from '../types/models';
import { transliterateHindi } from './location';
import { diseaseTarget, diseaseTypeKey, isDiseaseSavedRef } from '../screens/search/disease-utils';
import '../lib/common-strings';

// Kept here too so existing imports from the search service keep working.
export { diseaseTarget, diseaseTypeKey };

// ---------- Strings used in result titles / subtitles ----------

registerStrings({
  hi: {
    'search.crop.add': 'अपनी फसल में जोड़ें',
    'search.crop.mine': 'आपकी फसल',
    'search.mandi.subtitle': 'मंडी भाव और रुझान देखें',
    'search.scheme.official': 'सरकारी योजना',
    'search.conversation.untitled': 'AI से बातचीत',
    'search.feature.weather': 'मौसम',
    'search.feature.weather.desc': 'आज का मौसम और 7 दिन का अनुमान',
    'search.feature.mandi': 'मंडी भाव',
    'search.feature.mandi.desc': 'आस-पास की मंडियों के भाव',
    'search.feature.crop-doctor': 'फसल डॉक्टर',
    'search.feature.crop-doctor.desc': 'फोटो से फसल की समस्या पहचानें',
    'search.feature.soil': 'मिट्टी जांच',
    'search.feature.soil.desc': 'मिट्टी की सेहत और रिपोर्ट',
    'search.feature.calendar': 'खेती कैलेंडर',
    'search.feature.calendar.desc': 'बुवाई से कटाई तक के काम',
    'search.feature.calculators': 'खेती कैलकुलेटर',
    'search.feature.calculators.desc': 'बीज, खाद और लागत का हिसाब',
    'search.feature.hisab': 'खर्च और आय',
    'search.feature.hisab.desc': 'खेती का हिसाब-किताब',
    'search.feature.schemes': 'सरकारी योजनाएं',
    'search.feature.schemes.desc': 'किसानों के लिए सरकारी मदद',
    'search.feature.crops': 'मेरी फसलें',
    'search.feature.crops.desc': 'अपनी फसलें देखें और नई जोड़ें',
    'search.feature.techniques': 'खेती तकनीक',
    'search.feature.techniques.desc': 'आधुनिक और जैविक तरीके',
    'search.feature.ai': 'AI सहायक',
    'search.feature.ai.desc': 'खेती का कोई भी सवाल पूछें',
    'search.feature.saved': 'सेव की गई जानकारी',
    'search.feature.saved.desc': 'आपकी सेव की हुई चीज़ें',
    'search.feature.notifications': 'सूचनाएं',
    'search.feature.notifications.desc': 'मौसम, मंडी और काम की सूचनाएं',
    'search.feature.settings': 'सेटिंग्स',
    'search.feature.settings.desc': 'भाषा, अक्षर का आकार और सूचनाएं',
    'search.feature.help': 'सहायता',
    'search.feature.help.desc': 'मदद और संपर्क',
    'search.feature.farms': 'मेरे खेत',
    'search.feature.farms.desc': 'खेत और ज़मीन की जानकारी',
  },
  en: {
    'search.crop.add': 'Add to my crops',
    'search.crop.mine': 'Your crop',
    'search.mandi.subtitle': 'See mandi prices and trend',
    'search.scheme.official': 'Government scheme',
    'search.conversation.untitled': 'AI chat',
    'search.feature.weather': 'Weather',
    'search.feature.weather.desc': "Today's weather and 7-day forecast",
    'search.feature.mandi': 'Mandi prices',
    'search.feature.mandi.desc': 'Prices at nearby mandis',
    'search.feature.crop-doctor': 'Crop doctor',
    'search.feature.crop-doctor.desc': 'Find crop problems from a photo',
    'search.feature.soil': 'Soil test',
    'search.feature.soil.desc': 'Soil health and reports',
    'search.feature.calendar': 'Farm calendar',
    'search.feature.calendar.desc': 'Tasks from sowing to harvest',
    'search.feature.calculators': 'Farm calculators',
    'search.feature.calculators.desc': 'Seed, fertilizer and cost',
    'search.feature.hisab': 'Expenses & income',
    'search.feature.hisab.desc': 'Your farm accounts',
    'search.feature.schemes': 'Government schemes',
    'search.feature.schemes.desc': 'Government support for farmers',
    'search.feature.crops': 'My crops',
    'search.feature.crops.desc': 'See your crops or add a new one',
    'search.feature.techniques': 'Farming techniques',
    'search.feature.techniques.desc': 'Modern and organic methods',
    'search.feature.ai': 'AI assistant',
    'search.feature.ai.desc': 'Ask any farming question',
    'search.feature.saved': 'Saved items',
    'search.feature.saved.desc': 'Things you have saved',
    'search.feature.notifications': 'Notifications',
    'search.feature.notifications.desc': 'Weather, mandi and task alerts',
    'search.feature.settings': 'Settings',
    'search.feature.settings.desc': 'Language, text size and notifications',
    'search.feature.help': 'Help',
    'search.feature.help.desc': 'Help and contact',
    'search.feature.farms': 'My farms',
    'search.feature.farms.desc': 'Your fields and land',
  },
});

// ---------- Public types ----------

export type SearchResultType =
  | 'feature'
  | 'my-crop'
  | 'crop'
  | 'mandi'
  | 'disease'
  | 'technique'
  | 'scheme'
  | 'conversation'
  | 'saved';

/** What a query is mainly about, from words like "रोग", "भाव", "योजना". */
export type SearchIntent = 'disease' | 'mandi' | 'scheme';

export interface SearchResult {
  type: SearchResultType;
  /** Stable within its type (crop key, disease id, scheme id, conversation id…). */
  id: string;
  title: string;
  subtitle?: string;
  /** Where tapping the result goes (nav.open). */
  target: NavTarget;
  /** Crop key for a CropArt leading (crop, my-crop, mandi). */
  cropKey?: string;
  /**
   * Sub-kind for the row's icon/tone: feature key, disease type, technique tone,
   * scheme category, or saved kind (a SavedType, or 'disease' for a saved disease guide).
   */
  kind?: string;
}

export interface SearchGroup {
  type: SearchResultType;
  /** The best matches, at most `limit` of them. */
  results: SearchResult[];
  /** How many matched in all (can be more than `results.length` when the group is capped). */
  found: number;
}

export interface SearchResponse {
  /** The query as typed (trimmed). */
  query: string;
  intent: SearchIntent | null;
  /** Groups in display order; empty groups are left out. */
  groups: SearchGroup[];
  /** Matches across all groups (sum of `found`). */
  total: number;
}

export interface SearchSources {
  crops?: Crop[];
  conversations?: AIConversation[];
  saved?: SavedItem[];
}

export interface SearchOptions {
  /** UI language for titles ('hi' default from settings). */
  lang?: string;
  /** Max results per group (default 20). */
  limit?: number;
  /** The farmer's data; read from the store when omitted. */
  sources?: SearchSources;
}

/** Minimum query length (in characters) before searching. */
export const MIN_QUERY_LENGTH = 2;

/** Popular searches shown before typing. */
export const SEARCH_SUGGESTIONS: readonly { hi: string; en: string }[] = [
  { hi: 'गेहूं रोग', en: 'Wheat disease' },
  { hi: 'PM-KISAN', en: 'PM-KISAN' },
  { hi: 'ड्रिप सिंचाई', en: 'Drip irrigation' },
  { hi: 'आलू भाव', en: 'Potato price' },
];

// ---------- Normalisation ----------

/**
 * Case-folded text with Hindi spelling variants folded: nukta (ज़ → ज), chandrabindu → anusvara
 * (गेहूँ → गेहूं), zero-width joiners, Devanagari digits, "6,000" → "6000"; punctuation → space.
 */
export function normalizeText(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[‌‍़]/g, '')
    .replace(/ँ/g, 'ं')
    .replace(/[०-९]/g, d => String(d.charCodeAt(0) - 0x0966))
    .replace(/(\d),(?=\d)/g, '$1')
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .trim();
}

const tokensOf = (s: string): string[] => normalizeText(s).split(' ').filter(Boolean);

const isLatin = (tok: string) => /^[a-z0-9]+$/.test(tok);

/**
 * Little words that never decide a match: postpositions, "my", "how", and the generic
 * "फसल"/"खेती"/"crop". "गेहूं की खेती" searches for गेहूं, "aloo ki keemat" for aloo (+ price intent).
 */
const STOP_WORDS = new Set(
  [
    // Hindi
    'का', 'की', 'के', 'में', 'मे', 'मैं', 'से', 'को', 'पर', 'और', 'या', 'है', 'हैं', 'था', 'थी', 'थे', 'हो', 'ने', 'भी', 'तो',
    'क्या', 'कैसे', 'कैसा', 'कब', 'कहां', 'कौन', 'कौनसा', 'कौनसी', 'कोई', 'कितना', 'कितनी', 'सा', 'सी', 'यह', 'ये', 'वह', 'वो',
    'मेरा', 'मेरी', 'मेरे', 'हमारा', 'हमारी', 'हमारे', 'अपना', 'अपनी', 'अपने', 'लिए', 'वाला', 'वाली', 'वाले',
    'रहा', 'रही', 'रहे', 'गया', 'गई', 'गए', 'लगा', 'लगी', 'लगे', 'करें', 'करे', 'करना', 'बताओ', 'बताएं', 'बताइए', 'जानकारी',
    'मिलेगा', 'मिलेगी', 'मिलेंगे', 'मिले', 'मिलता', 'मिलती', 'मिलना', 'चाहिए', 'करते', 'करता', 'करती', 'होता', 'होती', 'होते',
    'होगा', 'होगी', 'सकते', 'सकता', 'सकती', 'जाता', 'जाती', 'जाए',
    'फसल', 'फसलों', 'खेती', 'आज', 'कल', 'अभी', 'हाल',
    // Latin / Hinglish
    'ka', 'ki', 'ke', 'me', 'mein', 'main', 'mai', 'se', 'ko', 'par', 'aur', 'hai', 'hain', 'tha', 'kya', 'kaise', 'kab', 'kaun',
    'mera', 'meri', 'mere', 'apna', 'apni', 'liye', 'lie', 'wala', 'wali', 'raha', 'rahi', 'laga', 'lagi', 'karna', 'batao', 'jankari',
    'milega', 'milegi', 'milta', 'chahiye', 'karte', 'hota', 'hoti', 'hoga', 'sakte',
    'fasal', 'fasl', 'kheti', 'the', 'a', 'an', 'of', 'in', 'on', 'for', 'to', 'is', 'are', 'and', 'my', 'how', 'what', 'when',
    'which', 'about', 'with', 'crop', 'crops', 'farming', 'aaj', 'abhi', 'haal', 'today',
  ].map(normalizeText),
);

/** Drops stop words; keeps the full list when nothing else is left ("मेरी फसल"). */
function contentTokens(tokens: string[]): string[] {
  const kept = tokens.filter(tok => !STOP_WORDS.has(tok));
  return kept.length ? kept : tokens;
}

/** Words that must not match a longer word they start ("बीमा" insurance ≠ "बीमारी" disease). */
const BLOCKED_NEXT: Record<string, string> = { 'बीमा': 'र', bima: 'r', beema: 'r' };

/** Short Hindi words that also live inside compounds ("गोभी" → फूलगोभी, "फली" → मूंगफली). */
const HINDI_COMPOUND_PARTS = new Set(['गोभी', 'फली']);

function occurs(hay: string, needle: string, blockedNext: string | undefined): boolean {
  let i = hay.indexOf(needle);
  while (i !== -1) {
    if (!blockedNext || hay[i + needle.length] !== blockedNext) return true;
    i = hay.indexOf(needle, i + 1);
  }
  return false;
}

/**
 * Word-start match ("रोग" → रोगों, "whe" → wheat), so short words don't hit the middle of
 * longer ones ("धान" ≠ प्रधानमंत्री, "भाव" ≠ प्रभाव, "ai" ≠ maize). Hindi words of 4+ letters
 * and a few compound parts may also match inside a word, because Hindi compounds hide their parts.
 */
function has(text: string, tok: string): boolean {
  if (!text || !tok) return false;
  const blocked = BLOCKED_NEXT[tok];
  if (occurs(` ${text}`, ` ${tok}`, blocked)) return true;
  if (isLatin(tok)) return false;
  return (tok.length >= 4 || HINDI_COMPOUND_PARTS.has(tok)) && occurs(text, tok, blocked);
}

/**
 * Rough sound-alike key for Latin spellings, so "gehoon", "gehun" and "gehu" meet, and
 * "pyaaz" meets "pyaj". Aspirates lose their h, long vowels shorten, doubles collapse.
 */
export function phoneticKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/ph/g, 'f')
    .replace(/sh/g, 's')
    .replace(/([bcdgjkt])h/g, '$1')
    .replace(/z/g, 'j')
    .replace(/w/g, 'v')
    .replace(/q/g, 'k')
    .replace(/ee|ii/g, 'i')
    .replace(/oo|uu/g, 'u')
    .replace(/(.)\1+/g, '$1');
}

/** Endings that only inflect a word ("potatoes", "tamatars"); anything else is a different word. */
const LATIN_INFLECTION = /^(s|es|e|a|i|o|on|en)$/;

/**
 * 3 = same sound ("gehoon" = gehun); 2 = still typing ("tama" → tamatar) or an inflected form
 * ("potatoes"). Ordinary words that merely start with a short crop name ("rain" ≠ rai,
 * "dhaniya" ≠ dhan, "makhana" ≠ makka) don't match.
 */
function latinMatch(keys: readonly string[], tok: string): number {
  const k = phoneticKey(tok);
  if (k.length < 2) return 0;
  let best = 0;
  for (const key of keys) {
    if (!key) continue;
    if (key === k) return 3;
    if (key.startsWith(k)) best = Math.max(best, 2);
    else if (key.length >= 3 && k.startsWith(key)) {
      const rest = k.slice(key.length);
      if (LATIN_INFLECTION.test(rest) || (key.length >= 5 && rest.length <= 2)) best = Math.max(best, 2);
    }
  }
  return best;
}

// ---------- Intent words ----------

const INTENT_WORDS: Record<SearchIntent, string[]> = {
  disease: [
    'रोग', 'रोगों', 'बीमारी', 'बिमारी', 'बीमारियां', 'कीट', 'कीड़ा', 'कीड़े', 'कीटों', 'इलाज', 'उपचार',
    'disease', 'diseases', 'pest', 'pests', 'rog', 'bimari', 'beemari', 'keet', 'keeda', 'kida', 'ilaj', 'ilaaj',
  ],
  mandi: [
    'भाव', 'दाम', 'रेट', 'कीमत', 'मंडी', 'बाजार', 'बाज़ार',
    'bhav', 'bhaav', 'daam', 'dam', 'rate', 'rates', 'price', 'prices', 'mandi', 'keemat', 'kimat', 'market',
  ],
  scheme: ['योजना', 'योजनाएं', 'योजनाओं', 'स्कीम', 'सरकारी', 'yojana', 'yojna', 'scheme', 'schemes', 'sarkari'],
};

const INTENT_BY_WORD = new Map<string, SearchIntent>();
for (const [intent, words] of Object.entries(INTENT_WORDS) as [SearchIntent, string[]][]) {
  for (const w of words) INTENT_BY_WORD.set(normalizeText(w), intent);
}

// ---------- Crop catalog index ----------

/** Common Hinglish / regional spellings farmers type for each crop. */
const HINGLISH: Record<CropKey, string[]> = {
  wheat: ['gehun', 'gehu', 'gehoon', 'genhu', 'kanak'],
  paddy: ['dhan', 'dhaan', 'chawal', 'chaval', 'rice'],
  maize: ['makka', 'makki', 'makai', 'bhutta', 'corn'],
  bajra: ['bajra', 'bajri', 'millet'],
  jowar: ['jowar', 'jwar', 'jowari', 'jonhari'],
  barley: ['jau', 'jaun', 'jav'],
  gram: ['chana', 'channa', 'chhola', 'chickpea'],
  arhar: ['arhar', 'tur', 'toor', 'tuar', 'rahar'],
  moong: ['moong', 'mung'],
  urad: ['urad', 'udad', 'urd'],
  masoor: ['masoor', 'masur'],
  mustard: ['sarson', 'sarso', 'rai', 'toria'],
  soybean: ['soyabean', 'soya', 'soyabin'],
  groundnut: ['mungfali', 'moongfali', 'moongphali', 'peanut'],
  cotton: ['kapas', 'narma', 'rui'],
  sugarcane: ['ganna', 'ikh', 'ookh'],
  potato: ['aloo', 'alu', 'aalu', 'batata'],
  onion: ['pyaj', 'pyaz', 'pyaaz', 'kanda'],
  tomato: ['tamatar', 'tamater'],
  brinjal: ['baingan', 'baigan', 'bengan', 'eggplant'],
  cauliflower: ['gobhi', 'gobi', 'phool gobhi', 'phoolgobhi'],
  chilli: ['mirch', 'mirchi', 'chili', 'chilly'],
  okra: ['bhindi', 'bhendi', 'ladyfinger', 'lady finger'],
  garlic: ['lahsun', 'lehsun', 'lasun'],
};

/** Everyday Hinglish farming words, so "khad" finds खाद and "dawa" finds दवा. */
const HINGLISH_WORDS: Record<string, string> = {
  khad: 'खाद',
  urvarak: 'उर्वरक',
  dawa: 'दवा',
  dawai: 'दवा',
  beej: 'बीज',
  sinchai: 'सिंचाई',
  sichai: 'सिंचाई',
  mitti: 'मिट्टी',
  keet: 'कीट',
  keeda: 'कीड़ा',
  rog: 'रोग',
  bimari: 'रोग',
  ilaj: 'इलाज',
  yojana: 'योजना',
  yojna: 'योजना',
  bima: 'बीमा',
  beema: 'बीमा',
  mausam: 'मौसम',
  barish: 'बारिश',
  pani: 'पानी',
  khet: 'खेत',
  kharpatwar: 'खरपतवार',
  jaivik: 'जैविक',
  chidkav: 'छिड़काव',
  bhav: 'भाव',
  keemat: 'कीमत',
  kisan: 'किसान',
  karz: 'कर्ज',
  pension: 'पेंशन',
};

const HINGLISH_BY_KEY = new Map(Object.entries(HINGLISH_WORDS).map(([w, hi]) => [phoneticKey(w), hi]));

interface CropIndexRow {
  key: CropKey;
  /** Hindi + English main names. */
  main: string;
  /** Other names, key, category labels. */
  other: string;
  latin: string[];
}

let cropIndex: CropIndexRow[] | null = null;

function cropRows(): CropIndexRow[] {
  cropIndex ??= CROP_LIST.map(c => {
    const cat = CATEGORY_NAMES[c.category];
    const latinWords = [
      c.nameEn,
      c.key,
      ...HINGLISH[c.key],
      transliterateHindi(c.nameHi),
      ...c.otherNamesHi.map(n => transliterateHindi(n.replace(/\(.*?\)/g, ''))),
    ];
    return {
      key: c.key,
      main: normalizeText(`${c.nameHi} ${c.nameEn}`),
      other: normalizeText([...c.otherNamesHi, c.key, cat.hi, cat.en].join(' | ')),
      latin: latinWords.flatMap(w => w.split(/\s+/)).map(phoneticKey).filter(k => k.length >= 2),
    };
  });
  return cropIndex;
}

/** Score a catalog crop against every token (0 = no match). */
function scoreCrop(row: CropIndexRow, tokens: string[]): number {
  let score = 0;
  for (const tok of tokens) {
    let s = 0;
    if (` ${row.main} `.includes(` ${tok} `)) s = 5;
    else if (` ${row.main}`.includes(` ${tok}`)) s = 3;
    else if (has(row.main, tok)) s = 2;
    else if (has(row.other, tok)) s = 1;
    if (!s && isLatin(tok)) s = latinMatch(row.latin, tok);
    if (!s) return 0;
    score += s;
  }
  return score;
}

function matchCropTokens(tokens: string[]): CropKey[] {
  if (!tokens.length) return [];
  return cropRows()
    .map(row => ({ key: row.key, score: scoreCrop(row, tokens) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(r => r.key);
}

/** Catalog crops matching every word of the query (little words like "की" ignored), best first. */
export function matchCrops(query: string): CropKey[] {
  return matchCropTokens(contentTokens(tokensOf(query)));
}

/**
 * Hindi stand-ins for Latin words: crop names ("gehu" → गेहूं, "tur" → अरहर) and everyday
 * farming words ("khad" → खाद), so Hinglish queries also reach the Hindi-only disease,
 * technique and farmer text. Null when no word has a stand-in.
 */
function latinAlternates(tokens: string[]): (string | null)[] | null {
  let changed = false;
  const out = tokens.map(tok => {
    if (!isLatin(tok) || tok.length < 3) return null;
    const k = phoneticKey(tok);
    let best: { key: CropKey; s: number } | null = null;
    for (const row of cropRows()) {
      const s = latinMatch(row.latin, tok);
      if (s > (best?.s ?? 0)) best = { key: row.key, s };
    }
    // Only a sure crop: the same sound, or a longer prefix/inflection ("tamat", "potatoes").
    if (best && (best.s === 3 || (best.s === 2 && k.length >= 4))) {
      changed = true;
      return normalizeText(CROP_NAMES[best.key].hi);
    }
    const word = HINGLISH_BY_KEY.get(k);
    if (word) {
      changed = true;
      return normalizeText(word);
    }
    return null;
  });
  return changed ? out : null;
}

// ---------- App features ----------

interface FeatureDef {
  key: string;
  screen: string;
  words: string[];
}

const FEATURE_DEFS: FeatureDef[] = [
  { key: 'weather', screen: 'weather', words: ['मौसम', 'बारिश', 'बरसात', 'तापमान', 'आंधी', 'स्प्रे', 'weather', 'rain', 'mausam', 'barish', 'forecast', 'temperature'] },
  { key: 'mandi', screen: 'mandi', words: ['मंडी', 'भाव', 'दाम', 'रेट', 'कीमत', 'बाजार', 'mandi', 'bhav', 'price', 'rate', 'market'] },
  { key: 'crop-doctor', screen: 'crop-doctor', words: ['फसल डॉक्टर', 'डॉक्टर', 'रोग पहचान', 'फोटो', 'बीमारी', 'doctor', 'photo', 'diagnose', 'disease'] },
  { key: 'soil', screen: 'soil', words: ['मिट्टी', 'मृदा', 'मिट्टी जांच', 'soil', 'mitti', 'soil test'] },
  { key: 'calendar', screen: 'calendar', words: ['कैलेंडर', 'खेती का काम', 'रिमाइंडर', 'calendar', 'task', 'tasks', 'reminder'] },
  { key: 'calculators', screen: 'calculators', words: ['कैलकुलेटर', 'हिसाब लगाएं', 'मात्रा', 'बीज की मात्रा', 'खाद की मात्रा', 'calculator', 'dose'] },
  { key: 'hisab', screen: 'hisab', words: ['हिसाब', 'खर्च', 'खर्चा', 'आय', 'कमाई', 'मुनाफा', 'लाभ', 'hisab', 'kharcha', 'expense', 'income', 'profit'] },
  { key: 'schemes', screen: 'schemes', words: ['योजना', 'योजनाएं', 'सरकारी', 'सब्सिडी', 'बीमा', 'फसल बीमा', 'पेंशन', 'yojana', 'sarkari', 'scheme', 'subsidy', 'bima', 'insurance', 'pension'] },
  { key: 'crops', screen: 'crops', words: ['मेरी फसल', 'मेरी फसलें', 'फसलें', 'नई फसल', 'my crops', 'crops', 'fasal'] },
  { key: 'techniques', screen: 'techniques', words: ['तकनीक', 'खेती तकनीक', 'आधुनिक खेती', 'technique', 'techniques', 'technology', 'takneek'] },
  { key: 'ai', screen: 'ai', words: ['ai', 'एआई', 'सवाल', 'पूछें', 'सहायक', 'chat', 'question', 'ask', 'assistant'] },
  { key: 'saved', screen: 'saved', words: ['सेव', 'सहेजी', 'saved', 'bookmark', 'bookmarks'] },
  { key: 'notifications', screen: 'notifications', words: ['सूचना', 'सूचनाएं', 'अलर्ट', 'चेतावनी', 'notification', 'notifications', 'alert', 'alerts'] },
  { key: 'settings', screen: 'settings', words: ['सेटिंग', 'सेटिंग्स', 'भाषा', 'अक्षर', 'settings', 'setting', 'language', 'bhasha', 'theme', 'font'] },
  { key: 'help', screen: 'help', words: ['मदद', 'सहायता', 'हेल्पलाइन', 'help', 'support', 'helpline'] },
  { key: 'farms', screen: 'farms', words: ['खेत', 'मेरे खेत', 'ज़मीन', 'जमीन', 'farm', 'farms', 'land', 'khet'] },
];

/** Plural/oblique endings folded for whole-word Hindi matching (सूचनाएं → सूचना, योजनाओं → योजना). */
function hindiStem(w: string): string {
  if (w.length <= 3) return w;
  return w.replace(/ि(यां|यों)$/, 'ी').replace(/(एं|ओं|ें|ों)$/, '');
}

interface FeatureRow {
  def: FeatureDef;
  /** Hindi keyword stems (whole words). */
  hindi: Set<string>;
  /** Latin keywords (prefix match while typing). */
  latin: string[];
}

let featureIndex: FeatureRow[] | null = null;
function featureRows(): FeatureRow[] {
  featureIndex ??= FEATURE_DEFS.map(def => {
    const words = def.words.flatMap(tokensOf);
    return { def, hindi: new Set(words.filter(w => !isLatin(w)).map(hindiStem)), latin: words.filter(isLatin) };
  });
  return featureIndex;
}

/**
 * Features matching every token: Latin keywords by prefix ("wea" → weather); Hindi keywords as
 * whole words, so "बीमा" doesn't open Crop Doctor through "बीमारी".
 */
function searchFeatures(tokens: string[]): FeatureDef[] {
  if (!tokens.length) return [];
  return featureRows()
    .filter(row =>
      tokens.every(tok =>
        isLatin(tok)
          ? row.latin.some(w => w.startsWith(tok) && !(BLOCKED_NEXT[tok] && w[tok.length] === BLOCKED_NEXT[tok]))
          : row.hindi.has(hindiStem(tok)),
      ),
    )
    .map(row => row.def);
}

// ---------- Catalog text for word-start filtering ----------
// data/ searches match plain substrings; these rebuild the same fields so results can be
// re-checked with has() ("धान" must not match प्रधानमंत्री).

const diseaseTextCache = new Map<string, string>();
function diseaseText(d: DiseaseInfo): string {
  let text = diseaseTextCache.get(d.id);
  if (text === undefined) {
    text = normalizeText(
      [
        d.nameHi,
        d.nameEn,
        d.scientificName ?? '',
        ...(d.aliases ?? []),
        ...d.cropKeys.map(k => `${CROP_NAMES[k].hi} ${CROP_NAMES[k].en} ${k}`),
        ...d.symptomsHi,
        d.favourableConditionsHi,
      ].join(' | '),
    );
    diseaseTextCache.set(d.id, text);
  }
  return text;
}

const techniqueTextCache = new Map<string, string>();
function techniqueText(tq: Technique): string {
  let text = techniqueTextCache.get(tq.id);
  if (text === undefined) {
    text = normalizeText(
      [
        tq.titleHi,
        tq.titleEn,
        tq.tagHi,
        tq.tagEn,
        tq.id.replace(/-/g, ' '),
        tq.summaryHi,
        tq.summaryEn,
        tq.whatIsHi,
        ...(tq.forAllCrops ? [] : tq.suitableCropKeys.map(k => `${CROP_NAMES[k].hi} ${CROP_NAMES[k].en}`)),
      ].join(' | '),
    );
    techniqueTextCache.set(tq.id, text);
  }
  return text;
}

const schemeTextCache = new Map<string, string>();
function schemeText(s: GovernmentScheme): string {
  let text = schemeTextCache.get(s.id);
  if (text === undefined) {
    const cat = getSchemeCategory(s.category);
    text = normalizeText(
      [s.name, s.nameHi, s.id.replace(/-/g, ' '), s.id.replace(/-/g, ''), cat.labelHi, cat.labelEn, s.summaryHi, ...s.benefitsHi, ...s.eligibilityHi].join(' | '),
    );
    schemeTextCache.set(s.id, text);
  }
  return text;
}

/**
 * Short Latin words that are scheme search aliases in data/schemes (not in the visible text),
 * so "tur" and "dal" still find the pulses mission while "tur" no longer hits "Agriculture".
 */
const SCHEME_SHORT_ALIASES: Record<string, string[]> = {
  'pulses-mission': ['dal', 'tur', 'msp'],
  'soil-health-card': ['shc'],
  pkvy: ['pgs'],
};

function schemeTokenOk(s: GovernmentScheme, tok: string): boolean {
  const text = schemeText(s);
  if (has(text, tok)) return true;
  // Only inside other words of the visible text ("धान" in प्रधानमंत्री): not a real match.
  if (text.includes(tok)) return false;
  // Matched one of the catalog's own search aliases. Short Latin words need an alias that is that word.
  if (isLatin(tok) && tok.length <= 3) return SCHEME_SHORT_ALIASES[s.id]?.includes(tok) ?? false;
  return true;
}

const diseaseHits = (toks: string[], cap: number): DiseaseInfo[] =>
  toks.length ? searchDiseases(toks.join(' '), cap).filter(d => toks.every(tok => has(diseaseText(d), tok))) : [];

const techniqueHits = (toks: string[], cap: number): Technique[] =>
  toks.length ? searchTechniques(toks.join(' '), cap).filter(tq => toks.every(tok => has(techniqueText(tq), tok))) : [];

const schemeHits = (toks: string[]): GovernmentScheme[] =>
  toks.length ? searchSchemes(toks.join(' ')).filter(s => toks.every(tok => schemeTokenOk(s, tok))) : [];

const sameTokens = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

// ---------- Farmer data (cached normalised text) ----------

const convCache = new Map<string, { updatedAt: string; title: string; body: string }>();

function convText(c: AIConversation) {
  const hit = convCache.get(c.id);
  if (hit && hit.updatedAt === c.updatedAt) return hit;
  const entry = {
    updatedAt: c.updatedAt,
    title: normalizeText(c.title || ''),
    body: normalizeText((c.messages || []).map(m => m.text || '').join(' | ')),
  };
  convCache.set(c.id, entry);
  return entry;
}

/** A short plain excerpt of the first message that mentions `word` (or the last answer). */
function snippetFor(c: AIConversation, word: string | undefined): string {
  const messages = c.messages || [];
  const clean = (s: string) => s.replace(/[*#_`>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  let text = '';
  let at = -1;
  if (word) {
    for (const m of messages) {
      const plain = clean(m.text || '');
      if (normalizeText(plain).includes(word)) {
        text = plain;
        at = plain.toLowerCase().indexOf(word);
        break;
      }
    }
  }
  if (!text) {
    const last = [...messages].reverse().find(m => m.role === 'assistant' && m.text) ?? messages[messages.length - 1];
    text = clean(last?.text || '');
  }
  if (text.length <= 110) return text;
  const start = at > 40 ? at - 40 : 0;
  return `${start > 0 ? '…' : ''}${text.slice(start, start + 110).trim()}…`;
}

const UNIT_KEY = { acre: 'common.acre', bigha: 'common.bigha', hectare: 'common.hectare' } as const;

// ---------- Main entry ----------

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

const DEFAULT_ORDER: SearchResultType[] = ['feature', 'my-crop', 'crop', 'mandi', 'disease', 'technique', 'scheme', 'conversation', 'saved'];

/** Upper bound when asking data/ searches for candidates, so group counts are true totals. */
const CANDIDATE_CAP = 500;

/**
 * Searches everything the app knows offline. Little words ("की", "में", "ka", "my") are
 * ignored; every remaining word must match (AND). Intent words ("रोग", "भाव", "योजना" and their
 * English/Hinglish forms) steer which group comes first and are dropped from the query for the
 * data they don't describe ("आलू की कीमत" → potato prices).
 */
export function searchEverything(query: string, opts: SearchOptions = {}): SearchResponse {
  const lang = opts.lang ?? getSettings().languageCode;
  const limit = opts.limit ?? 20;
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const trimmed = query.trim();
  const allTokens = tokensOf(trimmed);
  const empty: SearchResponse = { query: trimmed, intent: null, groups: [], total: 0 };
  if (!allTokens.length || normalizeText(trimmed).replace(/ /g, '').length < MIN_QUERY_LENGTH) return empty;

  // Little words never decide a match ("गेहूं की खेती" → गेहूं); the full list stays when nothing else is left.
  const baseTokens = contentTokens(allTokens);

  // Intent: the first intent word wins; the remaining words are the "core" query.
  let intent: SearchIntent | null = null;
  const coreTokens: string[] = [];
  for (const tok of baseTokens) {
    const i = INTENT_BY_WORD.get(tok);
    if (i) intent ??= i;
    else coreTokens.push(tok);
  }
  const tokens = coreTokens.length ? coreTokens : baseTokens;
  const alts = latinAlternates(tokens);
  const rewriteTokens = alts ? tokens.flatMap((tok, i) => (alts[i] ? alts[i]!.split(' ') : [tok])) : null;
  /** Every core word matches the text, as typed or through its Hindi stand-in. */
  const matchesAll = (text: string) => tokens.every((tok, i) => has(text, tok) || (!!alts?.[i] && has(text, alts[i]!)));

  const crops = asArray<Crop>(opts.sources?.crops ?? store.get<Crop[]>(KEYS.crops, []));
  const conversations = asArray<AIConversation>(opts.sources?.conversations ?? store.get<AIConversation[]>(KEYS.conversations, []));
  const saved = asArray<SavedItem>(opts.sources?.saved ?? store.get<SavedItem[]>(KEYS.saved, []));

  const groups = new Map<SearchResultType, SearchGroup>();
  const add = (type: SearchResultType, list: SearchResult[]) => {
    if (list.length) groups.set(type, { type, results: list.slice(0, limit), found: list.length });
  };

  // App features (whole query minus little words, so "मंडी भाव" opens the Mandi tab).
  add(
    'feature',
    searchFeatures(baseTokens).map(f => ({
      type: 'feature' as const,
      id: f.key,
      title: t(`search.feature.${f.key}`),
      subtitle: t(`search.feature.${f.key}.desc`),
      target: { screen: f.screen },
      kind: f.key,
    })),
  );

  // The farmer's own crops: name, variety and the catalog names of their crop key.
  const cropMatches = matchCropTokens(tokens);
  const latinCropMatches = rewriteTokens ? matchCropTokens(rewriteTokens) : [];
  const catalogKeys = [...new Set([...cropMatches, ...latinCropMatches])];
  const matchedKeys = new Set<string>(catalogKeys);
  const myCrops: SearchResult[] = [];
  for (const c of crops) {
    if (!c || typeof c.id !== 'string') continue;
    const text = normalizeText([c.name, c.variety ?? '', CROP_NAMES[c.cropKey as CropKey]?.hi ?? '', CROP_NAMES[c.cropKey as CropKey]?.en ?? ''].join(' '));
    if (!matchesAll(text) && !(matchedKeys.has(c.cropKey) && tokens.length === 1)) continue;
    const area = typeof c.area === 'number' && c.area > 0 ? `${formatNumber(c.area)} ${t(UNIT_KEY[c.unit] ?? 'common.acre')}` : '';
    myCrops.push({
      type: 'my-crop',
      id: c.id,
      title: c.name || CROP_NAMES[c.cropKey as CropKey]?.hi || c.cropKey,
      subtitle: [t('search.crop.mine'), area, c.variety].filter(Boolean).join(' • '),
      target: { screen: 'crop-detail', params: { id: c.id } },
      cropKey: c.cropKey,
    });
  }
  add('my-crop', myCrops);

  // Catalog crops: open the farmer's own crop when they grow it, otherwise "add this crop".
  const ownedKeys = new Set(myCrops.map(r => r.cropKey));
  add(
    'crop',
    catalogKeys
      .filter(key => !ownedKeys.has(key))
      .map(key => {
        const info = CROP_LIST.find(c => c.key === key)!;
        const own = crops.find(c => c.cropKey === key);
        const category = catalogText(lang, CATEGORY_NAMES[info.category].hi, CATEGORY_NAMES[info.category].en);
        return {
          type: 'crop' as const,
          id: key,
          title: catalogText(lang, info.nameHi, info.nameEn),
          subtitle: own ? `${category} • ${t('search.crop.mine')}` : `${category} • ${t('search.crop.add')}`,
          target: own ? { screen: 'crop-detail', params: { id: own.id } } : { screen: 'crop-edit', params: { cropKey: key } },
          cropKey: key,
        };
      }),
  );

  // Mandi prices for the matched crops (every catalog crop is a mandi commodity).
  add(
    'mandi',
    catalogKeys.map(key => ({
      type: 'mandi' as const,
      id: key,
      title: catalogText(lang, CROP_NAMES[key as CropKey].hi, CROP_NAMES[key as CropKey].en),
      subtitle: t('search.mandi.subtitle'),
      target: { screen: 'mandi-detail', params: { commodityKey: key } },
      cropKey: key,
    })),
  );

  // A bare 1–2 letter Latin query ("ai", "pm") would hit random words in the knowledge base;
  // those go to features, crops and schemes (word-start only) instead.
  const tinyLatin = tokens.every(tok => isLatin(tok) && tok.length <= 2);
  const widerTokens = sameTokens(baseTokens, tokens) ? null : baseTokens;

  // Diseases & pests: Hinglish crop names first ("tur" → अरहर), then the core words, then with the intent words.
  let diseases: DiseaseInfo[] = [];
  if (!tinyLatin) {
    if (rewriteTokens) diseases = diseaseHits(rewriteTokens, CANDIDATE_CAP);
    if (!diseases.length) diseases = diseaseHits(tokens, CANDIDATE_CAP);
    if (!diseases.length && widerTokens) diseases = diseaseHits(widerTokens, CANDIDATE_CAP);
  }
  add(
    'disease',
    diseases.map(d => ({
      type: 'disease' as const,
      id: d.id,
      title: lang === 'en' ? d.nameEn : d.nameHi,
      subtitle: [
        d.cropKeys
          .slice(0, 3)
          .map(k => catalogText(lang, CROP_NAMES[k].hi, CROP_NAMES[k].en))
          .join(', ') + (d.cropKeys.length > 3 ? '…' : ''),
        t(diseaseTypeKey(d.type)),
      ].join(' • '),
      target: diseaseTarget(d.id, trimmed),
      cropKey: d.cropKeys[0],
      kind: d.type,
    })),
  );

  // Farming techniques.
  let techniques: Technique[] = [];
  if (!tinyLatin) {
    if (rewriteTokens) techniques = techniqueHits(rewriteTokens, CANDIDATE_CAP);
    if (!techniques.length) techniques = techniqueHits(tokens, CANDIDATE_CAP);
  }
  add(
    'technique',
    techniques.map(tq => ({
      type: 'technique' as const,
      id: tq.id,
      title: catalogText(lang, tq.titleHi, tq.titleEn),
      subtitle: catalogText(lang, tq.summaryHi, tq.summaryEn),
      target: { screen: 'technique', params: { id: tq.id } },
      kind: tq.tone,
    })),
  );

  // Government schemes: the query with intent words first (aliases include "भाव", "मंडी"…),
  // then the core, then Hinglish stand-ins. "सरकारी योजना" on its own lists every scheme.
  let schemes = baseTokens.every(tok => INTENT_BY_WORD.get(tok) === 'scheme') ? [...SCHEMES] : schemeHits(baseTokens);
  if (!schemes.length && widerTokens) schemes = schemeHits(tokens);
  if (!schemes.length && rewriteTokens) schemes = schemeHits(rewriteTokens);
  add(
    'scheme',
    schemes.map(s => {
      const cat = getSchemeCategory(s.category);
      return {
        type: 'scheme' as const,
        id: s.id,
        title: lang === 'en' ? s.name : s.nameHi,
        subtitle: lang === 'en' ? cat.labelEn : s.benefitsHi[0] || cat.labelHi,
        target: { screen: 'scheme', params: { id: s.id } },
        kind: s.category,
      };
    }),
  );

  // Past AI conversations: title first, then message text.
  const convs: { r: SearchResult; score: number; at: string }[] = [];
  for (const c of conversations) {
    if (!c || typeof c.id !== 'string') continue;
    const text = convText(c);
    let score = 0;
    let snippetWord: string | undefined;
    for (let i = 0; i < tokens.length; i++) {
      const forms = alts?.[i] ? [tokens[i], alts[i]!] : [tokens[i]];
      const inTitle = forms.find(f => has(text.title, f));
      const inBody = inTitle ? undefined : forms.find(f => has(text.body, f));
      if (inTitle) score += 2;
      else if (inBody) score += 1;
      else {
        score = 0;
        break;
      }
      snippetWord ??= inTitle ?? inBody;
    }
    if (!score) continue;
    convs.push({
      score,
      at: c.updatedAt || c.createdAt || '',
      r: {
        type: 'conversation',
        id: c.id,
        title: c.title?.trim() || t('search.conversation.untitled'),
        subtitle: snippetFor(c, snippetWord),
        target: { screen: 'ai', params: { conversationId: c.id } },
      },
    });
  }
  add(
    'conversation',
    convs.sort((a, b) => b.score - a.score || b.at.localeCompare(a.at)).map(x => x.r),
  );

  // Saved items.
  add(
    'saved',
    saved
      .filter(s => s && typeof s.id === 'string')
      .filter(s => matchesAll(normalizeText(`${s.title || ''} | ${s.snippet || ''}`)))
      .sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''))
      .map(s => ({
        type: 'saved' as const,
        id: s.id,
        title: s.title,
        subtitle: s.snippet,
        target: s.target ?? { screen: 'saved' },
        kind: s.type === 'guide' && isDiseaseSavedRef(s.refId) ? 'disease' : s.type,
      })),
  );

  // Order: features, then the intent's group, then the default order.
  const intentGroup: SearchResultType | null = intent === 'disease' ? 'disease' : intent === 'mandi' ? 'mandi' : intent === 'scheme' ? 'scheme' : null;
  const order = intentGroup ? ['feature' as const, intentGroup, ...DEFAULT_ORDER.filter(g => g !== 'feature' && g !== intentGroup)] : DEFAULT_ORDER;
  const ordered: SearchGroup[] = [];
  for (const type of order) {
    const group = groups.get(type);
    if (group?.results.length) ordered.push(group);
  }
  return { query: trimmed, intent, groups: ordered, total: ordered.reduce((n, g) => n + g.found, 0) };
}

// ---------- Recent searches (KEYS.recentSearches) ----------

export const RECENT_SEARCH_LIMIT = 10;
const NO_RECENT: string[] = [];

const readRecent = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : NO_RECENT);

/** Newest first, max 10, case/spelling-insensitive duplicates removed. */
export function addRecentSearch(q: string) {
  const query = q.trim().slice(0, 80);
  if (normalizeText(query).replace(/ /g, '').length < MIN_QUERY_LENGTH) return;
  const key = normalizeText(query);
  store.set<string[]>(
    KEYS.recentSearches,
    prev => [query, ...readRecent(prev).filter(x => normalizeText(x) !== key)].slice(0, RECENT_SEARCH_LIMIT),
    NO_RECENT,
  );
}

export function removeRecentSearch(q: string) {
  const key = normalizeText(q);
  store.set<string[]>(KEYS.recentSearches, prev => readRecent(prev).filter(x => normalizeText(x) !== key), NO_RECENT);
}

export function clearRecentSearches() {
  store.set<string[]>(KEYS.recentSearches, NO_RECENT);
}

/** Puts back a list returned by clear (undo). */
export function restoreRecentSearches(list: string[]) {
  store.set<string[]>(KEYS.recentSearches, readRecent(list).slice(0, RECENT_SEARCH_LIMIT));
}

/** Reactive recent searches, newest first. */
export function useRecentSearches(): string[] {
  const [raw] = usePersisted<unknown>(KEYS.recentSearches, NO_RECENT);
  return useMemo(() => readRecent(raw), [raw]);
}
