// Typed lists of every illustration variant, so screens (and the docs contact sheet) can
// iterate them and TypeScript catches a missing or misspelt kind.
import { CROP_KEYS } from '../../data/crop-keys';
import type { CropKey } from '../../data/crop-keys';
import type { WeatherScene } from '../../services/weather';

export const CROP_ART_KEYS: readonly CropKey[] = CROP_KEYS;

export const FARM_SCENE_VARIANTS = ['splash', 'welcome', 'header'] as const;
export type FarmSceneVariant = (typeof FARM_SCENE_VARIANTS)[number];

/**
 * Text colour for words placed on a FarmScene. The scenes look the same in every theme, so the
 * text on them must not use a themed class either: dark mode remaps text-brand-900 to a light
 * green that is unreadable on the pale splash sky.
 */
export const SCENE_INK = {
  splash: '#14532d',
  welcome: '#14532d',
  header: '#ffffff',
} as const satisfies Record<FarmSceneVariant, string>;

/**
 * Weather scenes come from services/weather (`weatherCodeInfo(code, isDay).scene`), the one place
 * that maps WMO codes; this list only enumerates them for iteration.
 */
export const SKY_CONDITIONS = ['clear-day', 'clear-night', 'cloudy', 'rain', 'storm', 'fog'] as const satisfies readonly WeatherScene[];
export type SkyCondition = WeatherScene;

export const EMPTY_ART_KINDS = [
  'crops',
  'notifications',
  'saved',
  'search',
  'offline',
  'error',
  'calendar',
  'money',
  'community',
  'chat',
  'soil',
] as const;
export type EmptyArtKind = (typeof EMPTY_ART_KINDS)[number];

export const LEAF_EXAMPLE_KINDS = ['rust', 'blight', 'yellowing', 'healthy'] as const;
export type LeafExampleKind = (typeof LEAF_EXAMPLE_KINDS)[number];

export const ILLUSTRATION_KINDS = {
  crop: CROP_ART_KEYS,
  farmScene: FARM_SCENE_VARIANTS,
  sky: SKY_CONDITIONS,
  empty: EMPTY_ART_KINDS,
  leaf: LEAF_EXAMPLE_KINDS,
} as const;
