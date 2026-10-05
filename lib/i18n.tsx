// Scalable i18n: strings are registered per feature module (each module calls
// registerStrings() from its own strings.ts), looked up as
// current language → Hindi → English → key. Interpolation: t('x.y', { name: 'राम' }) with "{name}".
import { useCallback } from 'react';
import { translations as legacyTranslations } from '../translations';
import { getSettings, useSettings } from './app-state';

export interface LanguageDef {
  code: string;
  /** Native label shown in the picker. */
  label: string;
  nameEn: string;
  /** BCP-47 tag for speech recognition / TTS. */
  ttsCode: string;
  /** Whether the UI is fully translated (others fall back to Hindi/English). */
  complete: boolean;
  rtl?: boolean;
}

export const LANGUAGES: LanguageDef[] = [
  { code: 'hi', label: 'हिन्दी', nameEn: 'Hindi', ttsCode: 'hi-IN', complete: true },
  { code: 'en', label: 'English', nameEn: 'English', ttsCode: 'en-IN', complete: true },
  { code: 'bn', label: 'বাংলা', nameEn: 'Bengali', ttsCode: 'bn-IN', complete: false },
  { code: 'mr', label: 'मराठी', nameEn: 'Marathi', ttsCode: 'mr-IN', complete: false },
  { code: 'pa', label: 'ਪੰਜਾਬੀ', nameEn: 'Punjabi', ttsCode: 'pa-IN', complete: false },
  { code: 'gu', label: 'ગુજરાતી', nameEn: 'Gujarati', ttsCode: 'gu-IN', complete: false },
  { code: 'ta', label: 'தமிழ்', nameEn: 'Tamil', ttsCode: 'ta-IN', complete: false },
  { code: 'te', label: 'తెలుగు', nameEn: 'Telugu', ttsCode: 'te-IN', complete: false },
  { code: 'kn', label: 'ಕನ್ನಡ', nameEn: 'Kannada', ttsCode: 'kn-IN', complete: false },
  { code: 'ml', label: 'മലയാളം', nameEn: 'Malayalam', ttsCode: 'ml-IN', complete: false },
  { code: 'or', label: 'ଓଡ଼ିଆ', nameEn: 'Odia', ttsCode: 'or-IN', complete: false },
  { code: 'ur', label: 'اردو', nameEn: 'Urdu', ttsCode: 'ur-IN', complete: false, rtl: true },
  { code: 'as', label: 'অসমীয়া', nameEn: 'Assamese', ttsCode: 'as-IN', complete: false },
  { code: 'mai', label: 'मैथिली', nameEn: 'Maithili', ttsCode: 'mai-IN', complete: false },
  { code: 'ne', label: 'नेपाली', nameEn: 'Nepali', ttsCode: 'ne-NP', complete: false },
  { code: 'sd', label: 'سنڌي', nameEn: 'Sindhi', ttsCode: 'sd-IN', complete: false, rtl: true },
  { code: 'kok', label: 'कोंकणी', nameEn: 'Konkani', ttsCode: 'kok-IN', complete: false },
  { code: 'doi', label: 'डोगरी', nameEn: 'Dogri', ttsCode: 'doi-IN', complete: false },
  { code: 'mni', label: 'মৈতৈলোন্', nameEn: 'Manipuri', ttsCode: 'mni-IN', complete: false },
  { code: 'brx', label: 'बड़ो', nameEn: 'Bodo', ttsCode: 'brx-IN', complete: false },
  { code: 'sa', label: 'संस्कृतम्', nameEn: 'Sanskrit', ttsCode: 'sa-IN', complete: false },
  { code: 'ks', label: 'कॉशुर', nameEn: 'Kashmiri', ttsCode: 'ks-IN', complete: false },
  { code: 'sat', label: 'ᱥᱟᱱᱛᱟᱲᱤ', nameEn: 'Santali', ttsCode: 'sat-IN', complete: false },
];

export const getLanguage = (code: string): LanguageDef =>
  LANGUAGES.find(l => l.code === code) || LANGUAGES[0];

type Dict = Record<string, string>;
const registry: Record<string, Dict> = {};

/** Merge a module's strings, e.g. registerStrings({ hi: {'weather.title': 'मौसम'}, en: {...} }). */
export function registerStrings(dicts: Record<string, Dict>) {
  for (const [lang, dict] of Object.entries(dicts)) {
    registry[lang] = { ...(registry[lang] || {}), ...dict };
  }
}

// Strings from the original app (keys without a module prefix) stay available.
registerStrings(legacyTranslations);

const interpolate = (s: string, vars?: Record<string, string | number>) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;

export function translate(lang: string, key: string, vars?: Record<string, string | number>): string {
  const s = registry[lang]?.[key] ?? registry.hi?.[key] ?? registry.en?.[key];
  if (s === undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] missing key "${key}"`);
    return key;
  }
  return interpolate(s, vars);
}

export type TFunction = (key: string, vars?: Record<string, string | number>) => string;

/** Non-hook translate using the saved language (for services, notifications…). */
export const tNow: TFunction = (key, vars) => translate(getSettings().languageCode, key, vars);

export function useT(): TFunction {
  const [settings] = useSettings();
  const lang = settings.languageCode;
  return useCallback((key: string, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
}

export function useLanguage(): { language: LanguageDef; setLanguage: (code: string) => void } {
  const [settings, update] = useSettings();
  return {
    language: getLanguage(settings.languageCode),
    setLanguage: (code: string) => update({ languageCode: code }),
  };
}

/** Intl locale for formatting, always with Latin digits for consistency across scripts. */
export function localeFor(code: string): string {
  return `${code === 'ne' ? 'ne-NP' : `${code}-IN`}-u-nu-latn`;
}

/** Instruction appended to AI prompts so answers come back in the farmer's language. */
export function aiLanguageInstruction(code = getSettings().languageCode): string {
  const l = getLanguage(code);
  return `Respond in ${l.nameEn} (${l.label}) using simple, everyday words a farmer understands. Keep crop, chemical and scheme names recognisable (add the English name in brackets when helpful).`;
}
