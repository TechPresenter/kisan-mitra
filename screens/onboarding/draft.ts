// Onboarding answers, persisted after every change (usePersisted('onboarding.draft')) so leaving
// the app mid-way does not lose progress, plus the finish step that turns them into a profile,
// a default farm and planned crop records.
import { cropName } from '../../data/crop-keys';
import { getCropInfo } from '../../data/crops';
import { collection, KEYS, newId } from '../../lib/store';
import type { AreaUnit, Crop, Farm, GeoPlace, IrrigationType, SoilType, UserProfile } from '../../types/models';
import { cleanName } from '../auth/validate';

export const DRAFT_KEY = 'onboarding.draft';

/** The eight questions, in order; index 8 is the "तैयार है" summary. */
export const STEPS = ['name', 'place', 'land', 'crops', 'irrigation', 'soil', 'language', 'notify'] as const;
export type StepKey = (typeof STEPS)[number];
export const QUESTION_COUNT = STEPS.length;
export const DONE_STEP = QUESTION_COUNT;

export type NotifyChoice = 'granted' | 'denied' | 'later';

export interface OnboardingDraft {
  step?: number;
  /** undefined = not touched yet (the profile name is shown). */
  name?: string;
  /** undefined = not touched yet; null = nothing chosen. */
  place?: GeoPlace | null;
  landArea?: number | null;
  landUnit?: AreaUnit;
  cropKeys?: string[];
  irrigation?: IrrigationType | null;
  soilType?: SoilType | null;
  notify?: NotifyChoice;
  /** Opened from the summary to change one answer: next/back/skip return to the summary. */
  editing?: boolean;
}

export const EMPTY_DRAFT: OnboardingDraft = {};

export const IRRIGATION_TYPES: readonly IrrigationType[] = ['canal', 'tubewell', 'drip', 'sprinkler', 'rainfed', 'pond', 'other'];
/** The soils offered in onboarding ('laterite' stays available in the farm editor). */
export const SOIL_CHOICES: readonly SoilType[] = ['alluvial', 'loamy', 'black', 'red', 'sandy', 'clay', 'unknown'];
export const AREA_UNITS: readonly AreaUnit[] = ['acre', 'bigha', 'hectare'];

export const clampStep = (n: unknown): number =>
  typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(DONE_STEP, Math.round(n))) : 0;

export const validLand = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** Only real catalog keys, without duplicates. */
export const cleanCropKeys = (keys: readonly string[] | undefined): string[] =>
  [...new Set((keys ?? []).filter(k => !!getCropInfo(k)))];

/** One decimal, never 0 for a positive share (a tiny plot split between crops). */
const shareOf = (total: number, n: number) => Math.max(0.1, Math.round((total / n) * 10) / 10);

export interface FinishInput {
  draft: OnboardingDraft;
  profile: UserProfile | null;
  /** The place shown on the place step (draft choice or the signup prefill). */
  place: GeoPlace | null;
  lang: string;
  farmName: string;
}

export interface FinishResult {
  profilePatch: Partial<UserProfile>;
  farmCreated: boolean;
  cropsCreated: number;
}

/**
 * Writes the default farm ("मेरा खेत") and one planned crop per chosen crop, and returns the
 * profile patch. Safe to run twice: an existing farm is reused and crops already on record
 * (same catalog key) are not duplicated. The caller writes the profile patch last, because
 * profile.onboardedAt is what moves the app shell on to the main app.
 */
export function completeOnboarding({ draft, profile, place, lang, farmName }: FinishInput): FinishResult {
  const now = new Date().toISOString();
  // A cleared or too-short name (e.g. skipped after deleting it) never replaces the login name.
  const name = cleanName(draft.name ?? '') ?? profile?.name?.trim() ?? '';
  const land = validLand(draft.landArea) ? draft.landArea : undefined;
  const unit: AreaUnit = draft.landUnit ?? profile?.landUnit ?? 'acre';
  const cropKeys = cleanCropKeys(draft.cropKeys);
  const irrigation = draft.irrigation ?? undefined;
  const soilType = draft.soilType ?? undefined;
  // Farm and crop records keep "unknown" soil as "not set".
  const recordSoil = soilType && soilType !== 'unknown' ? soilType : undefined;

  const farms = collection<Farm>(KEYS.farms);
  let farm = farms.all()[0];
  let farmCreated = false;
  if (!farm) {
    farm = farms.upsert({
      id: newId('farm_'),
      name: farmName,
      ...(place ? { place } : {}),
      // 0 = the farmer skipped the land question.
      area: land ?? 0,
      unit,
      ...(recordSoil ? { soilType: recordSoil } : {}),
      ...(irrigation ? { irrigation } : {}),
      createdAt: now,
    });
    farmCreated = true;
  }

  const crops = collection<Crop>(KEYS.crops);
  const existing = new Set(crops.all().map(c => c.cropKey));
  const fresh = cropKeys.filter(k => !existing.has(k));
  const area = land ? shareOf(land, cropKeys.length || 1) : 0;
  // Oldest first in the stored list (upsert puts new items on top), so the first chosen crop leads.
  [...fresh].reverse().forEach(key =>
    crops.upsert({
      id: newId('crop_'),
      cropKey: key,
      name: cropName(key, lang),
      farmId: farm.id,
      area,
      unit,
      ...(recordSoil ? { soilType: recordSoil } : {}),
      ...(irrigation ? { irrigation } : {}),
      ...(place ? { place } : {}),
      createdAt: now,
      updatedAt: now,
    }),
  );

  const profilePatch: Partial<UserProfile> = {
    ...(name ? { name } : {}),
    ...(land ? { landArea: land, landUnit: unit } : {}),
    ...(cropKeys.length ? { cropKeys } : {}),
    ...(irrigation ? { irrigation } : {}),
    ...(soilType ? { soilType } : {}),
    ...(place ? { district: place.district || place.name, ...(place.state ? { state: place.state } : {}) } : {}),
    onboardedAt: now,
  };

  return { profilePatch, farmCreated, cropsCreated: fresh.length };
}
