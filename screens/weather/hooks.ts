// Small React hooks shared by the two Weather screens.
import { useEffect, useRef } from 'react';
import { track } from '../../lib/analytics';
import type { Resource } from '../../lib/cache';
import { useIsActiveScreen } from '../../lib/nav';
import type { WeatherSnapshot } from '../../types/models';

/** track('weather_view') once per mounted screen (StrictMode runs mount effects twice in dev). */
export function useTrackWeatherView(screen: 'overview' | 'day') {
  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    track('weather_view', { screen });
  }, [screen]);
}

/**
 * useResource only fetches on mount or place change. Refresh old or failed weather when:
 * - the network comes back (every mounted weather screen; fetchWithCache shares one request), or
 * - this screen becomes visible again with old data (another screen may have refreshed the cache,
 *   which this screen's resource would not pick up on its own).
 */
export function useWeatherAutoRefresh(res: Resource<WeatherSnapshot>, online: boolean) {
  const active = useIsActiveScreen();
  const resRef = useRef(res);
  resRef.current = res;
  const prev = useRef({ online, active });

  useEffect(() => {
    const was = prev.current;
    prev.current = { online, active };
    const r = resRef.current;
    if (!online || r.loading || r.refreshing) return;
    const cameOnline = !was.online;
    const cameBack = active && !was.active;
    if ((cameOnline || cameBack) && (r.stale || r.error)) void r.refresh();
  }, [online, active]);
}
