// Canonical crop keys shared by the catalog (data/crops.ts), illustrations, mandi and AI features.
export const CROP_KEYS = [
  'wheat',
  'paddy',
  'maize',
  'bajra',
  'jowar',
  'barley',
  'gram',
  'arhar',
  'moong',
  'urad',
  'masoor',
  'mustard',
  'soybean',
  'groundnut',
  'cotton',
  'sugarcane',
  'potato',
  'onion',
  'tomato',
  'brinjal',
  'cauliflower',
  'chilli',
  'okra',
  'garlic',
] as const;

export type CropKey = (typeof CROP_KEYS)[number];

export const CROP_NAMES: Record<CropKey, { hi: string; en: string }> = {
  wheat: { hi: 'गेहूं', en: 'Wheat' },
  paddy: { hi: 'धान', en: 'Paddy' },
  maize: { hi: 'मक्का', en: 'Maize' },
  bajra: { hi: 'बाजरा', en: 'Pearl millet' },
  jowar: { hi: 'ज्वार', en: 'Sorghum' },
  barley: { hi: 'जौ', en: 'Barley' },
  gram: { hi: 'चना', en: 'Chickpea' },
  arhar: { hi: 'अरहर', en: 'Pigeon pea' },
  moong: { hi: 'मूंग', en: 'Green gram' },
  urad: { hi: 'उड़द', en: 'Black gram' },
  masoor: { hi: 'मसूर', en: 'Lentil' },
  mustard: { hi: 'सरसों', en: 'Mustard' },
  soybean: { hi: 'सोयाबीन', en: 'Soybean' },
  groundnut: { hi: 'मूंगफली', en: 'Groundnut' },
  cotton: { hi: 'कपास', en: 'Cotton' },
  sugarcane: { hi: 'गन्ना', en: 'Sugarcane' },
  potato: { hi: 'आलू', en: 'Potato' },
  onion: { hi: 'प्याज', en: 'Onion' },
  tomato: { hi: 'टमाटर', en: 'Tomato' },
  brinjal: { hi: 'बैंगन', en: 'Brinjal' },
  cauliflower: { hi: 'फूलगोभी', en: 'Cauliflower' },
  chilli: { hi: 'मिर्च', en: 'Chilli' },
  okra: { hi: 'भिंडी', en: 'Okra' },
  garlic: { hi: 'लहसुन', en: 'Garlic' },
};

export const isCropKey = (k: string): k is CropKey => (CROP_KEYS as readonly string[]).includes(k);

/** Display name for a key in the given language ('hi' default); unknown keys pass through. */
export function cropName(key: string, lang = 'hi'): string {
  if (!isCropKey(key)) return key;
  return lang === 'hi' || lang !== 'en' ? CROP_NAMES[key].hi : CROP_NAMES[key].en;
}
