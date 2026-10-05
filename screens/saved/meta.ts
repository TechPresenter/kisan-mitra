// Visual metadata for saved item types (icon, tone, label keys). Shared with search results so a
// saved item looks the same everywhere. Importing this file registers the saved.* strings.
import { BookOpen, FlaskConical, Landmark, Leaf, Sparkles, Sprout, Stethoscope, TrendingUp, type LucideIcon } from 'lucide-react';
import type { Tone } from '../../components/ui';
import type { SavedItem, SavedType } from '../../types/models';
import { isDiseaseSavedRef } from '../search/disease-utils';
import './strings';

/** Chip order from the spec: AI जवाब, खेती गाइड, फसल सलाह, मंडी फसल, योजनाएं, फसल रोग जांच, मिट्टी रिपोर्ट. */
export const SAVED_TYPES: readonly SavedType[] = ['ai-answer', 'guide', 'advice', 'mandi-crop', 'scheme', 'diagnosis', 'soil-report'];

export interface SavedTypeMeta {
  icon: LucideIcon;
  tone: Tone;
  /** Plural label for the filter chip ("योजनाएं"). */
  labelKey: string;
  /** Singular label for one item ("योजना"). */
  kindKey: string;
}

export const SAVED_TYPE_META: Record<SavedType, SavedTypeMeta> = {
  'ai-answer': { icon: Sparkles, tone: 'tech', labelKey: 'saved.type.ai-answer', kindKey: 'saved.kind.ai-answer' },
  guide: { icon: BookOpen, tone: 'teal', labelKey: 'saved.type.guide', kindKey: 'saved.kind.guide' },
  advice: { icon: Sprout, tone: 'green', labelKey: 'saved.type.advice', kindKey: 'saved.kind.advice' },
  'mandi-crop': { icon: TrendingUp, tone: 'amber', labelKey: 'saved.type.mandi-crop', kindKey: 'saved.kind.mandi-crop' },
  scheme: { icon: Landmark, tone: 'indigo', labelKey: 'saved.type.scheme', kindKey: 'saved.kind.scheme' },
  diagnosis: { icon: Stethoscope, tone: 'red', labelKey: 'saved.type.diagnosis', kindKey: 'saved.kind.diagnosis' },
  'soil-report': { icon: FlaskConical, tone: 'orange', labelKey: 'saved.type.soil-report', kindKey: 'saved.kind.soil-report' },
};

/**
 * Disease guides saved from the disease sheet are stored as type 'guide' (there is no 'disease'
 * SavedType), but they look like crop-disease items and are listed under "फसल रोग जांच".
 */
const DISEASE_GUIDE_META: SavedTypeMeta = { icon: Leaf, tone: 'red', labelKey: 'saved.type.diagnosis', kindKey: 'saved.kind.disease' };

/** A SavedType, or 'disease' for a saved disease guide. */
export type SavedKind = SavedType | 'disease';

export function savedKindOf(item: Pick<SavedItem, 'type' | 'refId'>): SavedKind {
  return item.type === 'guide' && isDiseaseSavedRef(item.refId) ? 'disease' : item.type;
}

/** Meta for any stored kind string (unknown types fall back to the guide look). */
export const savedTypeMeta = (kind: string): SavedTypeMeta =>
  kind === 'disease' ? DISEASE_GUIDE_META : (SAVED_TYPE_META[kind as SavedType] ?? SAVED_TYPE_META.guide);

/** Meta for one saved item (disease guides get the disease look). */
export const savedItemMeta = (item: Pick<SavedItem, 'type' | 'refId'>): SavedTypeMeta => savedTypeMeta(savedKindOf(item));

/** The filter chip an item is listed under. */
export const savedFilterType = (item: Pick<SavedItem, 'type' | 'refId'>): SavedType => {
  const kind = savedKindOf(item);
  return kind === 'disease' ? 'diagnosis' : kind;
};
