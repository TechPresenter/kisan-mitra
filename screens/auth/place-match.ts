// Matching a district the farmer typed by hand ("सीतापुर", "Lucknow") against a place, so a typed
// district can become the app's place (weather, mandi) without a second search.
import { POPULAR_PLACES, findState, normalizePlaceName } from '../../services/location';
import type { GeoPlace } from '../../types/models';

const key = (s?: string | null): string => (s ? normalizePlaceName(s) : '');

function sameState(a: string, b: string): boolean {
  const sa = findState(a);
  const sb = findState(b);
  return sa && sb ? sa.code === sb.code : key(a) === key(b);
}

/**
 * True when `place` is the typed district (by district, Hindi or English name, ignoring case,
 * nukta and spelling of nasals). When both sides name a state, the states must agree too.
 */
export function placeMatchesDistrict(place: GeoPlace, district: string | undefined | null, state?: string | null): boolean {
  const d = key(district);
  if (!d) return false;
  if (![place.district, place.name, place.nameEn].some(n => key(n) === d)) return false;
  return !state || !place.state || sameState(state, place.state);
}

/**
 * The best search result for a district typed at signup: an exact name match, else (when a
 * state was given) the first result in that state. The farmer still confirms it on screen.
 */
export function bestMatchFor(results: readonly GeoPlace[], district: string, state?: string | null): GeoPlace | null {
  return (
    results.find(p => placeMatchesDistrict(p, district, state)) ??
    (state ? results.find(p => !!p.state && sameState(state, p.state)) : undefined) ??
    null
  );
}

/** One of the well-known farming districts (services/location) matching the typed name, if any. */
export function findPopularDistrict(district: string | undefined | null, state?: string | null): GeoPlace | null {
  return POPULAR_PLACES.find(p => placeMatchesDistrict(p, district, state)) ?? null;
}
