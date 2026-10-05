// Offline-first fetching: every network result is stored with its fetch time, served
// from cache while fresh, and still shown (clearly marked stale) when the network fails.
// Screens must display `fetchedAt` (see ui <LastUpdated/>) and never present stale data as current.
import { useCallback, useEffect, useRef, useState } from 'react';
import { store } from './store';

export interface CacheEntry<T> {
  data: T;
  /** epoch ms */
  fetchedAt: number;
}

export interface CachedResult<T> extends CacheEntry<T> {
  fromCache: boolean;
  /** Set when a refresh failed and the cached copy was returned instead. */
  error?: Error;
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

export function readCache<T>(name: string): CacheEntry<T> | undefined {
  return store.get<CacheEntry<T> | undefined>(store.cacheKey(name), undefined);
}

export function writeCache<T>(name: string, data: T, fetchedAt = Date.now()) {
  store.set<CacheEntry<T>>(store.cacheKey(name), { data, fetchedAt });
}

const inflight = new Map<string, Promise<CachedResult<unknown>>>();

/**
 * Returns cached data younger than `maxAgeMs`, otherwise fetches. If fetching fails and an
 * older copy exists, returns it with `error` set (caller shows it as stale); else rethrows.
 * Concurrent calls for the same name share one request.
 */
export async function fetchWithCache<T>(
  name: string,
  fetcher: () => Promise<T>,
  { maxAgeMs, force = false }: { maxAgeMs: number; force?: boolean },
): Promise<CachedResult<T>> {
  const cached = readCache<T>(name);
  if (!force && cached && Date.now() - cached.fetchedAt < maxAgeMs) {
    return { ...cached, fromCache: true };
  }
  const running = inflight.get(name);
  if (running) return running as Promise<CachedResult<T>>;

  const task = (async (): Promise<CachedResult<T>> => {
    try {
      const data = await fetcher();
      const fetchedAt = Date.now();
      writeCache(name, data, fetchedAt);
      return { data, fetchedAt, fromCache: false };
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      if (cached) return { ...cached, fromCache: true, error };
      throw error;
    } finally {
      inflight.delete(name);
    }
  })();
  inflight.set(name, task as Promise<CachedResult<unknown>>);
  return task;
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(isOnline());
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export interface Resource<T> {
  data?: T;
  fetchedAt?: number;
  /** First load with nothing cached to show — render a skeleton. */
  loading: boolean;
  /** A refresh is running while (possibly stale) data is visible. */
  refreshing: boolean;
  error?: Error;
  /** Data is older than maxAgeMs (e.g. offline) — label it, don't present it as current. */
  stale: boolean;
  refresh: () => Promise<void>;
}

/**
 * Hook wrapper around fetchWithCache. Pass `name = null` to stay idle.
 * Cached data renders instantly; a background refresh runs when it is older than maxAgeMs.
 */
export function useResource<T>(
  name: string | null,
  fetcher: () => Promise<T>,
  { maxAgeMs }: { maxAgeMs: number },
): Resource<T> {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const initial = name ? readCache<T>(name) : undefined;
  const [entry, setEntry] = useState<CacheEntry<T> | undefined>(initial);
  const [loading, setLoading] = useState(!!name && !initial);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error>();
  const nameRef = useRef(name);
  nameRef.current = name;

  const run = useCallback(
    async (force: boolean) => {
      const current = nameRef.current;
      if (!current) return;
      const hasData = !!readCache<T>(current);
      hasData ? setRefreshing(true) : setLoading(true);
      try {
        const result = await fetchWithCache(current, () => fetcherRef.current(), { maxAgeMs, force });
        if (nameRef.current !== current) return;
        setEntry({ data: result.data, fetchedAt: result.fetchedAt });
        setError(result.error);
      } catch (e) {
        if (nameRef.current !== current) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (nameRef.current === current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [maxAgeMs],
  );

  useEffect(() => {
    setEntry(name ? readCache<T>(name) : undefined);
    setError(undefined);
    if (name) run(false);
    else setLoading(false);
  }, [name, run]);

  const refresh = useCallback(() => run(true), [run]);

  return {
    data: entry?.data,
    fetchedAt: entry?.fetchedAt,
    loading,
    refreshing,
    error,
    stale: !!entry && Date.now() - entry.fetchedAt > maxAgeMs,
    refresh,
  };
}
