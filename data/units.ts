// Land and weight units used by calculators, Hisab (per-acre figures), crops and farms.
//
// The bigha is not a standard unit: its size changes from state to state and often from
// district to district (pucca vs kachcha bigha, plains vs hills). BIGHA_PRESETS lists TYPICAL
// values only. The farmer's own value lives in settings.bighaSqm / settings.bighaPreset
// (default: UP pucca bigha, see lib/app-state.ts) and can be changed from the area converter.
//
// Sources (checked 2026-10-05):
// - Wikipedia, "Bigha": https://en.wikipedia.org/wiki/Bigha
//   (UP/Bihar/Rajasthan pucca 27,225 sq ft; Rajasthan kachcha 17,424 sq ft; MP 12,000 sq ft;
//    Himachal 8,712 sq ft, 5 bigha = 1 acre; Uttarakhand hills 6,806.25 sq ft;
//    West Bengal / Assam 14,400 sq ft = 1,600 sq yd)
// - Kotak Mahindra Bank, "Understanding Bigha in India":
//   https://www.kotak.bank.in/en/stories-in-focus/loans/home-loan/understanding-bigha-in-india-convert-to-square-feet-acres-and-hectares.html
//   (Uttarakhand 6,804; Himachal 8,712; Punjab 9,090; MP 12,000; Assam and West Bengal 14,400;
//    Gujarat 17,424; UP 27,000; Bihar 27,220; Jharkhand 27,211; Haryana 27,225 sq ft)
// - Bajaj Finserv, "बीघा को वर्ग मीटर में बदलें": https://www.bajajfinserv.in/hindi/bigha-to-square-meter
//   (UP pucca bigha 3,025 sq yd = 165 ft × 165 ft; kachcha bigha 1,008.33 sq yd = 1/3 pucca)
// - 1acre.in, Haryana land units: https://1acre.in/land-unit-converter/haryana
//   (Punjab / Haryana bigha of 20 biswa ≈ 9,000 sq ft, i.e. the kachcha bigha)
//
// Conversions: 1 sq ft = 0.09290304 m², 1 sq yd (gaj) = 0.83612736 m²,
// 1 acre = 4,046.8564224 m², 1 hectare = 10,000 m², 1 quintal = 100 kg, 1 tonne = 1,000 kg.

export type LandUnit = 'acre' | 'bigha' | 'hectare' | 'sqm';

export const SQM_PER_ACRE = 4046.8564224;
export const SQM_PER_HECTARE = 10_000;
export const SQM_PER_SQFT = 0.09290304;
export const SQM_PER_SQYD = 0.83612736;

/** UP pucca bigha (3,025 sq yd), the app default (lib/app-state DEFAULT_SETTINGS.bighaSqm). */
export const DEFAULT_BIGHA_SQM = 2529.3;

const sqft = (n: number) => Math.round(n * SQM_PER_SQFT * 10) / 10;

export const BIGHA_PRESETS: { id: string; labelHi: string; labelEn: string; sqm: number; source?: string }[] = [
  // 3,025 sq yd = 27,225 sq ft = 2,529.3 m² ≈ 0.625 acre. Western and eastern UP plains.
  { id: 'up', labelHi: 'उत्तर प्रदेश (पक्का बीघा)', labelEn: 'Uttar Pradesh (pucca bigha)', sqm: DEFAULT_BIGHA_SQM, source: 'https://www.bajajfinserv.in/hindi/bigha-to-square-meter' },
  // 1/3 of the pucca bigha: 1,008.33 sq yd = 9,075 sq ft ≈ 843 m².
  { id: 'up-kachcha', labelHi: 'उत्तर प्रदेश (कच्चा बीघा)', labelEn: 'Uttar Pradesh (kachcha bigha)', sqm: sqft(9075), source: 'https://www.bajajfinserv.in/hindi/bigha-to-square-meter' },
  // 20 katha × 1,361 sq ft = 27,220 sq ft ≈ 2,528.8 m² (Jharkhand 27,211 sq ft is the same to 0.1%).
  { id: 'bihar', labelHi: 'बिहार / झारखंड', labelEn: 'Bihar / Jharkhand', sqm: sqft(27220), source: 'https://en.wikipedia.org/wiki/Bigha' },
  // Pucca bigha 27,225 sq ft (Rajasthan, and Haryana's pucca bigha).
  { id: 'rajasthan-pucca', labelHi: 'राजस्थान / हरियाणा (पक्का)', labelEn: 'Rajasthan / Haryana (pucca)', sqm: sqft(27225), source: 'https://en.wikipedia.org/wiki/Bigha' },
  // Kachcha bigha 17,424 sq ft ≈ 1,618.7 m² ≈ 0.4 acre.
  { id: 'rajasthan-kachcha', labelHi: 'राजस्थान (कच्चा)', labelEn: 'Rajasthan (kachcha)', sqm: sqft(17424), source: 'https://en.wikipedia.org/wiki/Bigha' },
  // 12,000 sq ft ≈ 1,114.8 m².
  { id: 'mp', labelHi: 'मध्य प्रदेश', labelEn: 'Madhya Pradesh', sqm: sqft(12000), source: 'https://en.wikipedia.org/wiki/Bigha' },
  // 20 biswa ≈ 9,000–9,090 sq ft; we use 9,075 sq ft (1,008.33 sq yd) ≈ 843 m².
  { id: 'punjab', labelHi: 'पंजाब / हरियाणा (कच्चा)', labelEn: 'Punjab / Haryana (kachcha)', sqm: sqft(9075), source: 'https://1acre.in/land-unit-converter/haryana' },
  // 17,424 sq ft ≈ 1,618.7 m².
  { id: 'gujarat', labelHi: 'गुजरात', labelEn: 'Gujarat', sqm: sqft(17424), source: 'https://www.kotak.bank.in/en/stories-in-focus/loans/home-loan/understanding-bigha-in-india-convert-to-square-feet-acres-and-hectares.html' },
  // 20 katha × 720 sq ft = 14,400 sq ft (1,600 sq yd) ≈ 1,337.8 m² ≈ 0.33 acre.
  { id: 'west-bengal', labelHi: 'पश्चिम बंगाल / त्रिपुरा', labelEn: 'West Bengal / Tripura', sqm: sqft(14400), source: 'https://en.wikipedia.org/wiki/Bigha' },
  // 5 katha × 2,880 sq ft = 14,400 sq ft ≈ 1,337.8 m².
  { id: 'assam', labelHi: 'असम', labelEn: 'Assam', sqm: sqft(14400), source: 'https://en.wikipedia.org/wiki/Bigha' },
  // 8,712 sq ft ≈ 809.4 m²; 5 bigha = 1 acre.
  { id: 'himachal', labelHi: 'हिमाचल प्रदेश', labelEn: 'Himachal Pradesh', sqm: sqft(8712), source: 'https://en.wikipedia.org/wiki/Bigha' },
  // Hills (Garhwal / Kumaon): 6,806.25 sq ft ≈ 632.3 m² (Kotak: 6,804 sq ft; 1 bigha = 12 nali).
  { id: 'uttarakhand', labelHi: 'उत्तराखंड (पहाड़ी)', labelEn: 'Uttarakhand (hills)', sqm: sqft(6806.25), source: 'https://en.wikipedia.org/wiki/Bigha' },
  // The farmer types their own value; `sqm` here is only the starting value.
  { id: 'custom', labelHi: 'अपना माप लिखें', labelEn: 'Enter your own', sqm: DEFAULT_BIGHA_SQM },
];

/** Preset by id ('up', 'custom', …); undefined for unknown ids. */
export function bighaPresetById(id: string | null | undefined) {
  return id ? BIGHA_PRESETS.find(p => p.id === id) : undefined;
}

/** A usable bigha size: falls back to the UP pucca bigha for missing or nonsensical values. */
export function safeBighaSqm(bighaSqm: number | null | undefined): number {
  return typeof bighaSqm === 'number' && Number.isFinite(bighaSqm) && bighaSqm > 0 ? bighaSqm : DEFAULT_BIGHA_SQM;
}

function sqmPerUnit(unit: LandUnit, bighaSqm: number): number {
  switch (unit) {
    case 'acre':
      return SQM_PER_ACRE;
    case 'hectare':
      return SQM_PER_HECTARE;
    case 'bigha':
      return safeBighaSqm(bighaSqm);
    case 'sqm':
    default:
      return 1;
  }
}

/** Area in square metres. `bighaSqm` is the local size of one bigha (settings.bighaSqm). */
export function toSqm(value: number, unit: LandUnit, bighaSqm: number): number {
  return value * sqmPerUnit(unit, bighaSqm);
}

/** Square metres in `unit`. */
export function fromSqm(sqm: number, unit: LandUnit, bighaSqm: number): number {
  return sqm / sqmPerUnit(unit, bighaSqm);
}

export function convertArea(value: number, from: LandUnit, to: LandUnit, bighaSqm: number): number {
  if (from === to) return value;
  return fromSqm(toSqm(value, from, bighaSqm), to, bighaSqm);
}

/** Land in acres, for "per acre" figures (crop and farm records use acre / bigha / hectare). */
export function areaInAcres(value: number, unit: 'acre' | 'bigha' | 'hectare', bighaSqm: number): number {
  return convertArea(value, unit, 'acre', bighaSqm);
}

// ---------- Weight ----------

export type WeightUnit = 'kg' | 'quintal' | 'tonne';

export const KG_PER_QUINTAL = 100;
export const KG_PER_TONNE = 1000;

export const quintalToKg = (quintal: number): number => quintal * KG_PER_QUINTAL;
export const kgToQuintal = (kg: number): number => kg / KG_PER_QUINTAL;
export const tonneToKg = (tonne: number): number => tonne * KG_PER_TONNE;
export const kgToTonne = (kg: number): number => kg / KG_PER_TONNE;
export const tonneToQuintal = (tonne: number): number => (tonne * KG_PER_TONNE) / KG_PER_QUINTAL;
export const quintalToTonne = (quintal: number): number => (quintal * KG_PER_QUINTAL) / KG_PER_TONNE;

const KG_PER_UNIT: Record<WeightUnit, number> = { kg: 1, quintal: KG_PER_QUINTAL, tonne: KG_PER_TONNE };

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  return (value * KG_PER_UNIT[from]) / KG_PER_UNIT[to];
}
