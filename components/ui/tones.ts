// Fixed soft palette for tinted tiles, round row icons, badges and stat cards.
// Class strings are spelled out in full so Tailwind can find them.

export type Tone = 'green' | 'orange' | 'sky' | 'red' | 'amber' | 'teal' | 'rose' | 'indigo' | 'tech' | 'gray';

export const TONES: Tone[] = ['green', 'orange', 'sky', 'red', 'amber', 'teal', 'rose', 'indigo', 'tech', 'gray'];

/** Tinted background (tile, chip, card wash). */
export const TINT_BG: Record<Tone, string> = {
  green: 'bg-tint-green',
  orange: 'bg-tint-orange',
  sky: 'bg-tint-sky',
  red: 'bg-tint-red',
  amber: 'bg-tint-amber',
  teal: 'bg-tint-teal',
  rose: 'bg-tint-rose',
  indigo: 'bg-tint-indigo',
  tech: 'bg-tint-tech',
  gray: 'bg-tint-gray',
};

/** Foreground for icons/text on the tint (≥ 4.5:1 on its tint and on the surface). */
export const TONE_TEXT: Record<Tone, string> = {
  green: 'text-tone-green',
  orange: 'text-tone-orange',
  sky: 'text-tone-sky',
  red: 'text-tone-red',
  amber: 'text-tone-amber',
  teal: 'text-tone-teal',
  rose: 'text-tone-rose',
  indigo: 'text-tone-indigo',
  tech: 'text-tone-tech',
  gray: 'text-tone-gray',
};

/** The tone colour as a fill (progress/level bars), paired with a TINT_BG track. */
export const TONE_FILL: Record<Tone, string> = {
  green: 'bg-tone-green',
  orange: 'bg-tone-orange',
  sky: 'bg-tone-sky',
  red: 'bg-tone-red',
  amber: 'bg-tone-amber',
  teal: 'bg-tone-teal',
  rose: 'bg-tone-rose',
  indigo: 'bg-tone-indigo',
  tech: 'bg-tone-tech',
  gray: 'bg-tone-gray',
};

/** Solid fills that keep white text ≥ 4.5:1 in both themes. */
export const SOLID_BG: Record<Tone, string> = {
  green: 'bg-[#15803d]',
  orange: 'bg-[#c2410c]',
  sky: 'bg-[#1565c0]',
  red: 'bg-[#c81e1e]',
  amber: 'bg-[#b45309]',
  teal: 'bg-[#0f766e]',
  rose: 'bg-[#be185d]',
  indigo: 'bg-[#4338ca]',
  tech: 'bg-[#6d28d9]',
  gray: 'bg-[#4b5a51]',
};

/** CSS colour value for SVG marks (charts, gauges). */
export const toneVar = (tone: Tone): string => `var(--tone-${tone})`;

// Pastel avatar colours: red/gray are left out so an initial never reads as an alert.
const AVATAR_TONES: Tone[] = ['green', 'sky', 'orange', 'teal', 'rose', 'indigo', 'amber', 'tech'];

/** Same input → same tone, so a farmer's avatar keeps its colour across screens. */
export function toneFor(key: string, palette: Tone[] = AVATAR_TONES): Tone {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

/** Nutrient / status levels used by LevelBar, Gauge and soil screens. */
export type LevelStatus = 'good' | 'medium' | 'low' | 'high';

export const LEVEL_TONE: Record<LevelStatus, Tone> = {
  good: 'green',
  medium: 'orange',
  low: 'red',
  high: 'amber',
};
