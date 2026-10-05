// Farmer location: place search, reverse geocoding and GPS detection.
// - Search: Open-Meteo geocoding (GeoNames data; free, no key, CORS-enabled).
// - Reverse: BigDataCloud's client-side endpoint (free for on-device lookups, no key).
// Network results go through lib/cache so a repeated search or a known spot works offline.
// The selected place itself lives in lib/app-state (usePlace / getPlace).
import type { GeoPlace } from '../types/models';
import { HOUR, MINUTE, fetchWithCache } from '../lib/cache';
import { tNow } from '../lib/i18n';
import './location-strings';

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1';
const REVERSE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
const REQUEST_TIMEOUT_MS = 12_000;
/** Spec asks for 15 s; coarse (network) location keeps the battery cost low. */
const GPS_TIMEOUT_MS = 15_000;
/** Some WebViews never call back when the permission prompt is dismissed; give up eventually. */
const GPS_HARD_LIMIT_MS = 60_000;
const DAY = 24 * HOUR;
const MAX_RESULTS = 10;
/** A reverse-geocode miss falls back to the nearest popular district within this distance. */
const FALLBACK_RADIUS_KM = 40;

const DEVANAGARI = /[ऀ-ॿ]/;

export type LocationErrorCode = 'denied' | 'unavailable' | 'timeout' | 'search';

export class LocationError extends Error {
  constructor(public code: LocationErrorCode, message?: string) {
    super(message || code);
    this.name = 'LocationError';
  }
  /** i18n key for a friendly message (see services/location-strings.ts). */
  get messageKey(): string {
    return `location.error.${this.code}`;
  }
}

// ---------- States & union territories ----------

export interface IndianState {
  /** Short code, e.g. 'UP'. */
  code: string;
  /** ISO 3166-2 codes, current first; older codes kept because geocoders still return them. */
  iso: string[];
  /** Hindi name. */
  name: string;
  nameEn: string;
  type: 'state' | 'ut';
  /** Other spellings seen in geocoder output. */
  aliases?: string[];
}

export const INDIAN_STATES: IndianState[] = [
  { code: 'AP', iso: ['IN-AP'], name: 'आंध्र प्रदेश', nameEn: 'Andhra Pradesh', type: 'state' },
  { code: 'AR', iso: ['IN-AR'], name: 'अरुणाचल प्रदेश', nameEn: 'Arunachal Pradesh', type: 'state' },
  { code: 'AS', iso: ['IN-AS'], name: 'असम', nameEn: 'Assam', type: 'state' },
  { code: 'BR', iso: ['IN-BR'], name: 'बिहार', nameEn: 'Bihar', type: 'state' },
  { code: 'CG', iso: ['IN-CG', 'IN-CT'], name: 'छत्तीसगढ़', nameEn: 'Chhattisgarh', type: 'state' },
  { code: 'GA', iso: ['IN-GA'], name: 'गोवा', nameEn: 'Goa', type: 'state' },
  { code: 'GJ', iso: ['IN-GJ'], name: 'गुजरात', nameEn: 'Gujarat', type: 'state' },
  { code: 'HR', iso: ['IN-HR'], name: 'हरियाणा', nameEn: 'Haryana', type: 'state' },
  { code: 'HP', iso: ['IN-HP'], name: 'हिमाचल प्रदेश', nameEn: 'Himachal Pradesh', type: 'state' },
  { code: 'JH', iso: ['IN-JH'], name: 'झारखंड', nameEn: 'Jharkhand', type: 'state' },
  { code: 'KA', iso: ['IN-KA'], name: 'कर्नाटक', nameEn: 'Karnataka', type: 'state' },
  { code: 'KL', iso: ['IN-KL'], name: 'केरल', nameEn: 'Kerala', type: 'state', aliases: ['केरला'] },
  { code: 'MP', iso: ['IN-MP'], name: 'मध्य प्रदेश', nameEn: 'Madhya Pradesh', type: 'state' },
  { code: 'MH', iso: ['IN-MH'], name: 'महाराष्ट्र', nameEn: 'Maharashtra', type: 'state' },
  { code: 'MN', iso: ['IN-MN'], name: 'मणिपुर', nameEn: 'Manipur', type: 'state' },
  { code: 'ML', iso: ['IN-ML'], name: 'मेघालय', nameEn: 'Meghalaya', type: 'state' },
  { code: 'MZ', iso: ['IN-MZ'], name: 'मिज़ोरम', nameEn: 'Mizoram', type: 'state' },
  { code: 'NL', iso: ['IN-NL'], name: 'नगालैंड', nameEn: 'Nagaland', type: 'state', aliases: ['नागालैंड'] },
  { code: 'OD', iso: ['IN-OD', 'IN-OR'], name: 'ओडिशा', nameEn: 'Odisha', type: 'state', aliases: ['Orissa', 'उड़ीसा'] },
  { code: 'PB', iso: ['IN-PB'], name: 'पंजाब', nameEn: 'Punjab', type: 'state' },
  { code: 'RJ', iso: ['IN-RJ'], name: 'राजस्थान', nameEn: 'Rajasthan', type: 'state' },
  { code: 'SK', iso: ['IN-SK'], name: 'सिक्किम', nameEn: 'Sikkim', type: 'state' },
  { code: 'TN', iso: ['IN-TN'], name: 'तमिलनाडु', nameEn: 'Tamil Nadu', type: 'state' },
  { code: 'TS', iso: ['IN-TS', 'IN-TG'], name: 'तेलंगाना', nameEn: 'Telangana', type: 'state' },
  { code: 'TR', iso: ['IN-TR'], name: 'त्रिपुरा', nameEn: 'Tripura', type: 'state' },
  { code: 'UP', iso: ['IN-UP'], name: 'उत्तर प्रदेश', nameEn: 'Uttar Pradesh', type: 'state' },
  { code: 'UK', iso: ['IN-UK', 'IN-UT'], name: 'उत्तराखंड', nameEn: 'Uttarakhand', type: 'state', aliases: ['Uttaranchal'] },
  { code: 'WB', iso: ['IN-WB'], name: 'पश्चिम बंगाल', nameEn: 'West Bengal', type: 'state' },
  { code: 'AN', iso: ['IN-AN'], name: 'अंडमान और निकोबार द्वीपसमूह', nameEn: 'Andaman and Nicobar Islands', type: 'ut', aliases: ['Andaman and Nicobar', 'अंडमान और निकोबार'] },
  { code: 'CH', iso: ['IN-CH'], name: 'चंडीगढ़', nameEn: 'Chandigarh', type: 'ut' },
  {
    code: 'DH',
    iso: ['IN-DH'],
    name: 'दादरा और नगर हवेली और दमन और दीव',
    nameEn: 'Dadra and Nagar Haveli and Daman and Diu',
    type: 'ut',
    aliases: ['Dadra and Nagar Haveli', 'Daman and Diu'],
  },
  { code: 'DL', iso: ['IN-DL'], name: 'दिल्ली', nameEn: 'Delhi', type: 'ut', aliases: ['New Delhi', 'दिल्ली राष्ट्रीय राजधानी क्षेत्र'] },
  { code: 'JK', iso: ['IN-JK'], name: 'जम्मू और कश्मीर', nameEn: 'Jammu and Kashmir', type: 'ut', aliases: ['जम्मू-कश्मीर', 'जम्मू कश्मीर'] },
  { code: 'LA', iso: ['IN-LA'], name: 'लद्दाख', nameEn: 'Ladakh', type: 'ut' },
  { code: 'LD', iso: ['IN-LD'], name: 'लक्षद्वीप', nameEn: 'Lakshadweep', type: 'ut' },
  { code: 'PY', iso: ['IN-PY'], name: 'पुडुचेरी', nameEn: 'Puducherry', type: 'ut', aliases: ['Pondicherry', 'पांडिचेरी'] },
];

/**
 * Comparable form of a place name across scripts and spellings: folds Latin diacritics
 * ("Vāranāsi"), drops the nukta (ड़/ड) and writes nasal half-letters as anusvara
 * (झारखण्ड → झारखंड) so geocoder spellings match our table.
 */
export function normalizePlaceName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-़ͯ]/g, '')
    .replace(/ँ/g, 'ं')
    .replace(/[ङञणनम]्(?=[क-ह])/g, 'ं')
    .toLowerCase()
    .replace(/^(the\s+)?(state|union territory|national capital territory|nct)\s+of\s+/, '')
    .replace(/[^a-zऀ-ॿ]/g, '');
}

const STATE_INDEX = new Map<string, IndianState>();
for (const s of INDIAN_STATES) {
  for (const n of [s.name, s.nameEn, s.code, ...s.iso, ...(s.aliases || [])]) STATE_INDEX.set(normalizePlaceName(n), s);
}

/** Look up a state/UT by Hindi or English name, alias, short code or ISO code ("IN-UP"). */
export function findState(nameOrCode: string | undefined | null): IndianState | undefined {
  if (!nameOrCode) return undefined;
  return STATE_INDEX.get(normalizePlaceName(nameOrCode));
}

// ---------- Popular agricultural districts ----------

/** Major agricultural districts (district headquarters coordinates), shown before the farmer types. */
export const POPULAR_PLACES: GeoPlace[] = [
  { name: 'वाराणसी', nameEn: 'Varanasi', district: 'वाराणसी', state: 'उत्तर प्रदेश', lat: 25.3176, lon: 82.9739 },
  { name: 'लखनऊ', nameEn: 'Lucknow', district: 'लखनऊ', state: 'उत्तर प्रदेश', lat: 26.8467, lon: 80.9462 },
  { name: 'पटना', nameEn: 'Patna', district: 'पटना', state: 'बिहार', lat: 25.5941, lon: 85.1376 },
  { name: 'इंदौर', nameEn: 'Indore', district: 'इंदौर', state: 'मध्य प्रदेश', lat: 22.7196, lon: 75.8577 },
  { name: 'नागपुर', nameEn: 'Nagpur', district: 'नागपुर', state: 'महाराष्ट्र', lat: 21.1458, lon: 79.0882 },
  { name: 'जयपुर', nameEn: 'Jaipur', district: 'जयपुर', state: 'राजस्थान', lat: 26.9124, lon: 75.7873 },
  { name: 'भोपाल', nameEn: 'Bhopal', district: 'भोपाल', state: 'मध्य प्रदेश', lat: 23.2599, lon: 77.4126 },
  { name: 'पुणे', nameEn: 'Pune', district: 'पुणे', state: 'महाराष्ट्र', lat: 18.5204, lon: 73.8567 },
  { name: 'अमृतसर', nameEn: 'Amritsar', district: 'अमृतसर', state: 'पंजाब', lat: 31.634, lon: 74.8723 },
  { name: 'नाशिक', nameEn: 'Nashik', district: 'नाशिक', state: 'महाराष्ट्र', lat: 19.9975, lon: 73.7898 },
  { name: 'लुधियाना', nameEn: 'Ludhiana', district: 'लुधियाना', state: 'पंजाब', lat: 30.901, lon: 75.8573 },
  { name: 'करनाल', nameEn: 'Karnal', district: 'करनाल', state: 'हरियाणा', lat: 29.6857, lon: 76.9905 },
  { name: 'कोटा', nameEn: 'Kota', district: 'कोटा', state: 'राजस्थान', lat: 25.2138, lon: 75.8648 },
  { name: 'राजकोट', nameEn: 'Rajkot', district: 'राजकोट', state: 'गुजरात', lat: 22.3039, lon: 70.8022 },
  { name: 'गुंटूर', nameEn: 'Guntur', district: 'गुंटूर', state: 'आंध्र प्रदेश', lat: 16.3067, lon: 80.4365 },
  { name: 'बेलगावी', nameEn: 'Belagavi', district: 'बेलगावी', state: 'कर्नाटक', lat: 15.8497, lon: 74.4977 },
  { name: 'कोयंबटूर', nameEn: 'Coimbatore', district: 'कोयंबटूर', state: 'तमिलनाडु', lat: 11.0168, lon: 76.9558 },
  { name: 'बर्धमान', nameEn: 'Bardhaman', district: 'पूर्व बर्धमान', state: 'पश्चिम बंगाल', lat: 23.2324, lon: 87.8615 },
  { name: 'रायपुर', nameEn: 'Raipur', district: 'रायपुर', state: 'छत्तीसगढ़', lat: 21.2514, lon: 81.6296 },
  { name: 'कटक', nameEn: 'Cuttack', district: 'कटक', state: 'ओडिशा', lat: 20.4625, lon: 85.883 },
  { name: 'गोरखपुर', nameEn: 'Gorakhpur', district: 'गोरखपुर', state: 'उत्तर प्रदेश', lat: 26.7606, lon: 83.3732 },
  { name: 'मेरठ', nameEn: 'Meerut', district: 'मेरठ', state: 'उत्तर प्रदेश', lat: 28.9845, lon: 77.7064 },
  { name: 'आगरा', nameEn: 'Agra', district: 'आगरा', state: 'उत्तर प्रदेश', lat: 27.1767, lon: 78.0081 },
  { name: 'हिसार', nameEn: 'Hisar', district: 'हिसार', state: 'हरियाणा', lat: 29.1492, lon: 75.7217 },
];

/** Old / alternate spellings farmers commonly type for the popular districts (keyed by nameEn). */
const POPULAR_ALIASES: Record<string, string[]> = {
  Varanasi: ['Banaras', 'Benares', 'Kashi', 'बनारस', 'काशी'],
  Belagavi: ['Belgaum', 'बेलगाम'],
  Bardhaman: ['Burdwan', 'Barddhaman', 'बर्दवान', 'वर्धमान'],
  Cuttack: ['Katak'],
  Coimbatore: ['कोयम्बटूर', 'कोयंबतूर', 'Kovai'],
  Nashik: ['Nasik', 'नासिक'],
  Hisar: ['Hissar'],
  Guntur: ['गुन्टूर'],
};

const POPULAR_KEYS = POPULAR_PLACES.map(p => ({
  place: p,
  keys: [p.name, p.nameEn || '', ...(POPULAR_ALIASES[p.nameEn || ''] || [])].map(normalizePlaceName).filter(Boolean),
}));

function matchPopular(query: string): GeoPlace[] {
  const q = normalizePlaceName(query);
  if (!q) return [];
  return POPULAR_KEYS.filter(e => e.keys.some(k => k.startsWith(q))).map(e => e.place);
}

// ---------- Helpers ----------

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Closest popular district and its distance. */
export function nearestPopularPlace(lat: number, lon: number): { place: GeoPlace; km: number } {
  let best = { place: POPULAR_PLACES[0], km: Infinity };
  for (const p of POPULAR_PLACES) {
    const km = distanceKm({ lat, lon }, p);
    if (km < best.km) best = { place: p, km };
  }
  return best;
}

/** ASCII-friendly English name ("Vāranāsi" → "Varanasi") for prompts and display. */
const foldLatin = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const devanagariOrUndefined = (s?: string) => (s && DEVANAGARI.test(s) ? s.trim() : undefined);
// Geocoders append "जिला" / "district" / "Division" to admin areas; drop it for display.
const cleanDistrict = (s?: string) =>
  s
    ?.normalize('NFD')
    .replace(/\s+(ज़?िला|district|division|tahsil|tehsil)$/i, '')
    .normalize('NFC')
    .trim() || undefined;

async function getJSON<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Devanagari → Latin (for searching English GeoNames entries) ----------

const CONSONANTS: Record<string, string> = {
  क: 'k', ख: 'kh', ग: 'g', घ: 'gh', ङ: 'n', च: 'ch', छ: 'chh', ज: 'j', झ: 'jh', ञ: 'n',
  ट: 't', ठ: 'th', ड: 'd', ढ: 'dh', ण: 'n', त: 't', थ: 'th', द: 'd', ध: 'dh', न: 'n',
  प: 'p', फ: 'ph', ब: 'b', भ: 'bh', म: 'm', य: 'y', र: 'r', ल: 'l', ळ: 'l', व: 'v',
  श: 'sh', ष: 'sh', स: 's', ह: 'h',
};
// Nukta forms after NFD: base consonant + U+093C.
const NUKTA: Record<string, string> = { क: 'q', ख: 'kh', ग: 'g', ज: 'z', ड: 'r', ढ: 'rh', फ: 'f' };
const VOWELS: Record<string, string> = {
  अ: 'a', आ: 'a', इ: 'i', ई: 'i', उ: 'u', ऊ: 'u', ऋ: 'ri', ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au', ऑ: 'o',
};
const MATRAS: Record<string, string> = {
  'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o',
};

/**
 * Rough Hindi → Latin transliteration with schwa deletion ("गोरखपुर" → "gorakhpur",
 * "इंदौर" → "indaur"). Only used as an extra geocoder query, so "close enough" is fine.
 */
export function transliterateHindi(text: string): string {
  return text
    .normalize('NFD')
    .split(/\s+/)
    .map(word => {
      // Units: consonant (may be '') + vowel; 'A' marks an inherent schwa that may be dropped.
      const units: { c: string; v: string }[] = [];
      const chars = [...word];
      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        if (CONSONANTS[ch]) {
          const nukta = chars[i + 1] === '़';
          if (nukta) i++;
          units.push({ c: (nukta && NUKTA[ch]) || CONSONANTS[ch], v: 'A' });
        } else if (MATRAS[ch] !== undefined && units.length) {
          units[units.length - 1].v = MATRAS[ch];
        } else if (ch === '्' && units.length) {
          units[units.length - 1].v = '';
        } else if (VOWELS[ch]) {
          units.push({ c: '', v: VOWELS[ch] });
        } else if ((ch === 'ं' || ch === 'ँ') && units.length) {
          units[units.length - 1].v = (units[units.length - 1].v === 'A' ? 'a' : units[units.length - 1].v) + 'n';
        } else if (/[a-z0-9]/i.test(ch)) {
          units.push({ c: ch.toLowerCase(), v: '' });
        }
      }
      // Hindi drops the final schwa and a medial one in V C _ C V context.
      const last = units[units.length - 1];
      if (last && last.v === 'A' && units.length > 1) last.v = '';
      for (let i = units.length - 2; i >= 1; i--) {
        const prev = units[i - 1];
        const next = units[i + 1];
        if (units[i].v === 'A' && units[i].c && prev.v && next.c && next.v) units[i].v = '';
      }
      return units.map(u => u.c + (u.v === 'A' ? 'a' : u.v)).join('');
    })
    .join(' ');
}

// ---------- Search ----------

interface GeoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  feature_code?: string;
  country_code?: string;
  admin1?: string;
  admin2?: string;
  population?: number;
}

async function geocode(name: string, language: 'hi' | 'en'): Promise<GeoResult[]> {
  const url = `${GEOCODE_URL}/search?name=${encodeURIComponent(name)}&count=${MAX_RESULTS}&language=${language}&countryCode=IN&format=json`;
  const body = await getJSON<{ results?: GeoResult[] }>(url);
  return Array.isArray(body.results) ? body.results : [];
}

async function geocodeById(id: number, language: 'hi' | 'en'): Promise<GeoResult | undefined> {
  const r = await getJSON<GeoResult>(`${GEOCODE_URL}/get?id=${id}&language=${language}`);
  return r && typeof r.latitude === 'number' ? r : undefined;
}

/** Populated places and administrative areas only (skips airports, rivers, hotels…). */
const isPlaceFeature = (code?: string) => !code || code.startsWith('PPL') || code.startsWith('ADM');

const FEATURE_RANK: Record<string, number> = { PPLC: 0, PPLA: 1, PPLA2: 2, PPLA3: 3, PPLA4: 4, PPL: 5 };

function stateName(...candidates: (string | undefined)[]): string | undefined {
  for (const c of candidates) {
    const s = findState(c);
    if (s) return s.name;
  }
  return candidates.find(Boolean);
}

function toPlace(hi: GeoResult | undefined, en: GeoResult | undefined): GeoPlace {
  const r = (hi || en)!;
  const nameEn = en ? foldLatin(en.name) : hi && !DEVANAGARI.test(hi.name) ? foldLatin(hi.name) : undefined;
  const district =
    cleanDistrict(devanagariOrUndefined(hi?.admin2)) || cleanDistrict(en?.admin2 ? foldLatin(en.admin2) : undefined);
  const state = stateName(en?.admin1, hi?.admin1);
  return {
    name: devanagariOrUndefined(hi?.name) || nameEn || r.name,
    ...(nameEn ? { nameEn } : {}),
    ...(district ? { district } : {}),
    ...(state ? { state } : {}),
    lat: round(r.latitude, 4),
    lon: round(r.longitude, 4),
  };
}

async function searchRemote(query: string): Promise<GeoPlace[]> {
  const isHindi = DEVANAGARI.test(query);
  const latin = isHindi ? transliterateHindi(query) : query;
  // Hindi names come from language=hi; English names (for nameEn / prompts) from language=en.
  // GeoNames has Hindi alternate names only for bigger places, so a Hindi query is also tried
  // transliterated ("इंदौर" → "indaur").
  const calls = [geocode(query, 'hi'), latin.length >= 2 ? geocode(latin, 'en') : Promise.resolve([])];
  if (isHindi && latin.length >= 3) calls.push(geocode(latin, 'hi'));
  const settled = await Promise.allSettled(calls);
  if (settled.every(s => s.status === 'rejected')) {
    throw (settled[0] as PromiseRejectedResult).reason;
  }
  const [hiHits, enHits, hiLatinHits = []] = settled.map(s => (s.status === 'fulfilled' ? s.value : []));

  const hiById = new Map<number, GeoResult>();
  for (const r of [...hiHits, ...hiLatinHits]) if (!hiById.has(r.id)) hiById.set(r.id, r);
  const enById = new Map<number, GeoResult>(enHits.map(r => [r.id, r]));

  const ids = [...new Set([...hiById.keys(), ...enById.keys()])].filter(id => {
    const r = hiById.get(id) || enById.get(id)!;
    return (r.country_code ?? 'IN') === 'IN' && isPlaceFeature(r.feature_code);
  });

  // Hindi-only hits still need an English name for grounding prompts.
  const missing = ids.filter(id => !enById.has(id)).slice(0, 5);
  const extra = await Promise.allSettled(missing.map(id => geocodeById(id, 'en')));
  extra.forEach((s, i) => {
    if (s.status === 'fulfilled' && s.value) enById.set(missing[i], s.value);
  });

  const q = normalizePlaceName(query);
  const ql = normalizePlaceName(latin);
  const score = (r: GeoResult) => {
    const names = [hiById.get(r.id)?.name, enById.get(r.id)?.name].filter(Boolean).map(n => normalizePlaceName(n!));
    const exact = names.some(n => n === q || n === ql) ? 0 : 1;
    return { exact, feature: FEATURE_RANK[r.feature_code || ''] ?? 6, pop: r.population || 0 };
  };
  return ids
    .map(id => ({ id, r: hiById.get(id) || enById.get(id)! }))
    .map(x => ({ ...x, s: score(x.r) }))
    .sort((a, b) => a.s.exact - b.s.exact || a.s.feature - b.s.feature || b.s.pop - a.s.pop)
    .map(x => toPlace(hiById.get(x.id), enById.get(x.id)));
}

/** Drop near-duplicates (same name within 10 km), keeping the first occurrence. */
function dedupePlaces(places: GeoPlace[]): GeoPlace[] {
  const out: GeoPlace[] = [];
  for (const p of places) {
    const key = normalizePlaceName(p.nameEn || p.name);
    const dup = out.some(
      o => (normalizePlaceName(o.nameEn || o.name) === key || o.name === p.name) && distanceKm(o, p) < 10,
    );
    if (!dup) out.push(p);
  }
  return out;
}

/**
 * Search Indian places by Hindi or English name ("वाराणसी", "varanasi", "इंदौर").
 * Popular districts match instantly (also offline); network results are cached for 7 days.
 * Throws LocationError('search') only when the network fails and nothing matched locally.
 */
export async function searchPlaces(query: string): Promise<GeoPlace[]> {
  const q = query.trim().replace(/\s+/g, ' ');
  if (q.length < 2) return [];
  const local = matchPopular(q);
  let remote: GeoPlace[] = [];
  try {
    const res = await fetchWithCache(`geo.search:${normalizePlaceName(q) || q}`, () => searchRemote(q), {
      maxAgeMs: 7 * DAY,
    });
    remote = res.data;
  } catch (e) {
    if (!local.length) throw new LocationError('search', e instanceof Error ? e.message : String(e));
  }
  return dedupePlaces([...local, ...remote]).slice(0, MAX_RESULTS);
}

// ---------- Reverse geocoding ----------

interface BDCAdmin {
  name?: string;
  adminLevel?: number;
  order?: number;
}

interface BDCResponse {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  principalSubdivisionCode?: string;
  countryCode?: string;
  localityInfo?: { administrative?: BDCAdmin[] };
}

const bdc = (lat: number, lon: number, lang: 'hi' | 'en') =>
  getJSON<BDCResponse>(`${REVERSE_URL}?latitude=${lat}&longitude=${lon}&localityLanguage=${lang}`);

/** India's districts are adminLevel 5 in BigDataCloud's hierarchy (country 2, state 4). */
const bdcDistrict = (r?: BDCResponse) =>
  cleanDistrict(r?.localityInfo?.administrative?.find(a => a.adminLevel === 5)?.name);

async function reverseRemote(lat: number, lon: number): Promise<GeoPlace> {
  const [hiRes, enRes] = await Promise.allSettled([bdc(lat, lon, 'hi'), bdc(lat, lon, 'en')]);
  const hi = hiRes.status === 'fulfilled' ? hiRes.value : undefined;
  const en = enRes.status === 'fulfilled' ? enRes.value : undefined;
  const main = hi || en;
  if (!main) throw (hiRes as PromiseRejectedResult).reason;

  const district = bdcDistrict(hi) || bdcDistrict(en);
  const enName = en?.city || en?.locality || bdcDistrict(en);
  const name = main.city || main.locality || district;
  if (!name) throw new Error('No locality in reverse geocode');
  const state =
    findState(main.principalSubdivisionCode)?.name || stateName(en?.principalSubdivision, hi?.principalSubdivision);
  return {
    name,
    ...(enName ? { nameEn: foldLatin(enName) } : {}),
    ...(district ? { district } : {}),
    ...(state ? { state } : {}),
    lat,
    lon,
  };
}

function fallbackPlace(lat: number, lon: number): GeoPlace {
  const near = nearestPopularPlace(lat, lon);
  if (near.km <= FALLBACK_RADIUS_KM) return { ...near.place, lat, lon };
  return { name: tNow('location.myLocation'), lat, lon };
}

/**
 * Coordinates → named place (Hindi name, English name, district, state). Never throws:
 * when the lookup fails it falls back to the nearest popular district (≤ 40 km) or "मेरी जगह".
 * Coordinates are rounded to ~100 m; nothing finer is needed for weather or mandi.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<GeoPlace> {
  const la = round(lat, 3);
  const lo = round(lon, 3);
  try {
    const { data } = await fetchWithCache(`geo.reverse:${la.toFixed(2)},${lo.toFixed(2)}`, () => reverseRemote(la, lo), {
      maxAgeMs: 30 * DAY,
    });
    return { ...data, lat: la, lon: lo };
  } catch {
    return fallbackPlace(la, lo);
  }
}

// ---------- GPS ----------

/** Device position via navigator.geolocation (works in the Capacitor WebView). */
export function getCurrentPosition(): Promise<{ lat: number; lon: number; accuracyM?: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new LocationError('unavailable', 'Geolocation API missing'));
      return;
    }
    let settled = false;
    const hardLimit = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new LocationError('timeout', 'No geolocation callback'));
    }, GPS_HARD_LIMIT_MS);
    navigator.geolocation.getCurrentPosition(
      pos => {
        if (settled) return;
        settled = true;
        clearTimeout(hardLimit);
        resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracyM: pos.coords.accuracy });
      },
      err => {
        if (settled) return;
        settled = true;
        clearTimeout(hardLimit);
        // GeolocationPositionError codes: 1 PERMISSION_DENIED, 2 POSITION_UNAVAILABLE, 3 TIMEOUT.
        const code: LocationErrorCode = err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable';
        reject(new LocationError(code, err.message));
      },
      { enableHighAccuracy: false, timeout: GPS_TIMEOUT_MS, maximumAge: 10 * MINUTE },
    );
  });
}

/**
 * Detect the farmer's place from GPS and name it. Rejects with LocationError
 * ('denied' | 'unavailable' | 'timeout'); show `t(err.messageKey)` and offer search instead.
 */
export async function detectCurrentPlace(): Promise<GeoPlace> {
  const { lat, lon } = await getCurrentPosition();
  return reverseGeocode(lat, lon);
}
