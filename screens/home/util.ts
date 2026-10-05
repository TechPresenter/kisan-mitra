// Small helpers shared by the Home sections.
import { useMemo, useRef } from 'react';
import { cropName, isCropKey } from '../../data/crop-keys';
import type { Resource } from '../../lib/cache';
import type { NavApi } from '../../lib/nav';

/**
 * The farmer's name for a crop. A catalog crop still carrying its default name (Hindi or English,
 * whichever language onboarding ran in) follows the UI language ("गेहूं" ↔ "Wheat"); a name the
 * farmer typed is kept as is.
 */
export function displayCropName(crop: { cropKey: string; name?: string }, lang: string): string {
  const name = crop.name?.trim();
  if (!name) return cropName(crop.cropKey, lang);
  if (isCropKey(crop.cropKey) && (name === cropName(crop.cropKey, 'hi') || name === cropName(crop.cropKey, 'en'))) {
    return cropName(crop.cropKey, lang);
  }
  return name;
}

/** The navigation Home's sections need. */
export type HomeNav = Pick<NavApi, 'push' | 'switchTab'>;

/**
 * Navigation that keeps the same identity across renders. The nav context changes on every push
 * and pop, and Home stays mounted under pushed screens; handing the sections this stable object
 * (instead of each calling useNav) lets their React.memo skip those re-renders on low-end phones.
 */
export function useStableNav(nav: NavApi): HomeNav {
  const ref = useRef(nav);
  ref.current = nav;
  return useMemo<HomeNav>(
    () => ({
      push: (screen, params) => ref.current.push(screen, params),
      switchTab: (tab, target) => ref.current.switchTab(tab, target),
    }),
    [],
  );
}

/** The same Resource object while none of its fields changed (the hooks return a new one per render). */
export function useStableResource<T>(r: Resource<T>): Resource<T> {
  const { data, fetchedAt, loading, refreshing, error, stale, refresh } = r;
  return useMemo(
    () => ({ data, fetchedAt, loading, refreshing, error, stale, refresh }),
    [data, fetchedAt, loading, refreshing, error, stale, refresh],
  );
}
