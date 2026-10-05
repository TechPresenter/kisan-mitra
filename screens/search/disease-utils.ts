// Light helpers for disease guides, shared by the search service, the disease detail sheet and
// saved items. Kept apart from services/search so reusing the sheet doesn't pull in the whole
// search index (crop, technique and scheme catalogs).
import type { DiseaseType } from '../../data/diseases';
import { registerStrings } from '../../lib/i18n';
import type { NavTarget } from '../../types/models';

registerStrings({
  hi: {
    'search.disease.type.fungal': 'फफूंद रोग',
    'search.disease.type.bacterial': 'जीवाणु रोग',
    'search.disease.type.viral': 'वायरस रोग',
    'search.disease.type.pest': 'कीट',
    'search.disease.type.nutrient': 'पोषक तत्व की कमी',
    'search.disease.type.physiological': 'पौधे का विकार',
  },
  en: {
    'search.disease.type.fungal': 'Fungal disease',
    'search.disease.type.bacterial': 'Bacterial disease',
    'search.disease.type.viral': 'Viral disease',
    'search.disease.type.pest': 'Pest',
    'search.disease.type.nutrient': 'Nutrient deficiency',
    'search.disease.type.physiological': 'Physiological disorder',
  },
});

/** i18n key for a disease type label ("फफूंद रोग", "कीट"…). */
export const diseaseTypeKey = (type: DiseaseType): string => `search.disease.type.${type}`;

/** Nav target that opens a disease's detail sheet (there is no disease screen). */
export function diseaseTarget(id: string, q?: string): NavTarget {
  return { screen: 'search', params: q ? { q, disease: id } : { disease: id } };
}

const DISEASE_REF_PREFIX = 'disease:';

/** Saved-item ref for a disease guide (stored as type 'guide'), so it never clashes with technique guides. */
export const diseaseSavedRef = (id: string) => `${DISEASE_REF_PREFIX}${id}`;

/** True for a saved item that is a disease guide (saved from the disease sheet). */
export const isDiseaseSavedRef = (refId: unknown): boolean => typeof refId === 'string' && refId.startsWith(DISEASE_REF_PREFIX);
