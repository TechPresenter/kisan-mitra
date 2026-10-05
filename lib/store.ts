// Tiny persisted store: JSON values in localStorage under a versioned prefix, with
// in-memory snapshots so React can subscribe via useSyncExternalStore and every
// screen sees writes immediately. All app data lives here (offline-first).
import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';

const PREFIX = 'km:v2:';
const CACHE_PREFIX = 'cache:';

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();
const snapshots = new Map<string, unknown>();

/** Storage keys for app data. Feature-local keys may use their own `feature.name` strings. */
export const KEYS = {
  session: 'session',
  profile: 'profile',
  settings: 'settings',
  place: 'place',
  farms: 'farms',
  crops: 'crops',
  tasks: 'tasks',
  conversations: 'ai.conversations',
  diagnoses: 'ai.diagnoses',
  soilReports: 'soil.reports',
  expenses: 'hisab.expenses',
  incomes: 'hisab.incomes',
  notifications: 'notifications',
  saved: 'saved',
  mandiHistory: 'mandi.history',
  mandiWatchlist: 'mandi.watchlist',
  recentSearches: 'search.recent',
} as const;

const fullKey = (key: string) => PREFIX + key;

function notify(key: string) {
  listeners.get(key)?.forEach(l => l());
}

/** Marks a key that was read and found missing, so storage isn't re-parsed on every read. */
const MISSING = Symbol('missing');

/** The stored value, or `fallback` when nothing is stored (the fallback itself is never cached). */
function readRaw<T>(key: string, fallback: T): T {
  if (!snapshots.has(key)) {
    let value: unknown = MISSING;
    try {
      const raw = localStorage.getItem(fullKey(key));
      if (raw != null) value = JSON.parse(raw);
    } catch {
      // Unreadable / unavailable storage: fall back silently, the app still works in memory.
    }
    snapshots.set(key, value);
  }
  const value = snapshots.get(key);
  return value === MISSING ? fallback : (value as T);
}

/** Drop cached API responses (weather, mandi…) to make room for user data. */
function evictCaches(): number {
  let removed = 0;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX + CACHE_PREFIX)) {
        localStorage.removeItem(k);
        removed++;
      }
    }
  } catch {
    /* ignore */
  }
  return removed;
}

function writeRaw<T>(key: string, value: T) {
  snapshots.set(key, value);
  const serialized = JSON.stringify(value);
  try {
    localStorage.setItem(fullKey(key), serialized);
  } catch (e) {
    // Quota exceeded: free cache space once and retry; otherwise keep the value in memory.
    if (!key.startsWith(CACHE_PREFIX) && evictCaches() > 0) {
      try {
        localStorage.setItem(fullKey(key), serialized);
      } catch {
        console.warn(`[store] could not persist "${key}" (storage full)`);
      }
    } else {
      console.warn(`[store] could not persist "${key}"`, e);
    }
  }
  notify(key);
}

export const store = {
  get<T>(key: string, fallback: T): T {
    return readRaw(key, fallback);
  },
  set<T>(key: string, value: T | ((prev: T) => T), fallback?: T) {
    const next =
      typeof value === 'function'
        ? (value as (prev: T) => T)(readRaw(key, fallback as T))
        : value;
    writeRaw(key, next);
  },
  remove(key: string) {
    snapshots.delete(key);
    try {
      localStorage.removeItem(fullKey(key));
    } catch {
      /* ignore */
    }
    notify(key);
  },
  subscribe(key: string, listener: Listener): () => void {
    let set = listeners.get(key);
    if (!set) listeners.set(key, (set = new Set()));
    set.add(listener);
    return () => set!.delete(listener);
  },
  /** Removes every km:v2 key (used on logout / "delete my data"). */
  clearAll() {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX)) localStorage.removeItem(k);
      }
    } catch {
      /* ignore */
    }
    const keys = [...snapshots.keys()];
    snapshots.clear();
    keys.forEach(notify);
  },
  cacheKey(name: string) {
    return CACHE_PREFIX + name;
  },
};

/** React state persisted under `key`; all components using the same key stay in sync. */
export function usePersisted<T>(key: string, fallback: T): [T, (value: T | ((prev: T) => T)) => void] {
  // The first fallback is kept per hook instance so the snapshot stays referentially stable.
  const fallbackRef = useRef(fallback);
  const subscribe = useCallback((l: Listener) => store.subscribe(key, l), [key]);
  const value = useSyncExternalStore(subscribe, () => readRaw(key, fallbackRef.current));
  const setValue = useCallback(
    (v: T | ((prev: T) => T)) => store.set<T>(key, v, fallbackRef.current),
    // fallback is only used when nothing is stored yet; it is intentionally not a dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return [value, setValue];
}

let idCounter = 0;
/** Sortable, collision-resistant id ("<base36 time><counter><random>"). */
export function newId(prefix = ''): string {
  idCounter = (idCounter + 1) % 1296;
  return (
    prefix +
    Date.now().toString(36) +
    idCounter.toString(36).padStart(2, '0') +
    Math.random().toString(36).slice(2, 6)
  );
}

export interface Collection<T extends { id: string }> {
  all(): T[];
  get(id: string): T | undefined;
  /** Adds (or replaces, if the id exists) and returns the stored item. Newest first. */
  upsert(item: T): T;
  update(id: string, patch: Partial<T>): T | undefined;
  remove(id: string): void;
  setAll(items: T[]): void;
}

/** Non-hook access for services. */
export function collection<T extends { id: string }>(name: string): Collection<T> {
  const read = () => readRaw<T[]>(name, []);
  return {
    all: read,
    get: id => read().find(i => i.id === id),
    upsert(item) {
      const items = read();
      const idx = items.findIndex(i => i.id === item.id);
      const next = idx >= 0 ? items.map((i, n) => (n === idx ? item : i)) : [item, ...items];
      writeRaw(name, next);
      return item;
    },
    update(id, patch) {
      let updated: T | undefined;
      writeRaw(
        name,
        read().map(i => (i.id === id ? (updated = { ...i, ...patch }) : i)),
      );
      return updated;
    },
    remove(id) {
      writeRaw(name, read().filter(i => i.id !== id));
    },
    setAll(items) {
      writeRaw(name, items);
    },
  };
}

/** Reactive collection: `items` re-renders on any change to the collection. */
export function useCollection<T extends { id: string }>(name: string): Collection<T> & { items: T[] } {
  const [items] = usePersisted<T[]>(name, EMPTY as T[]);
  const api = useMemo(() => collection<T>(name), [name]);
  return useMemo(() => ({ ...api, items }), [api, items]);
}

const EMPTY: never[] = [];
