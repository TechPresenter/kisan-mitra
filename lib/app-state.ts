// App-wide persisted state: session, farmer profile, settings and the selected location.
import { useCallback } from 'react';
import type { AppSettings, GeoPlace, UserProfile } from '../types/models';
import { KEYS, store, usePersisted } from './store';

export interface Session {
  loggedIn: boolean;
  method?: 'email' | 'google' | 'phone';
  loggedInAt?: string;
}

export const DEFAULT_PLACE: GeoPlace = {
  name: 'वाराणसी',
  nameEn: 'Varanasi',
  district: 'वाराणसी',
  state: 'उत्तर प्रदेश',
  lat: 25.3176,
  lon: 82.9739,
};

export const DEFAULT_SETTINGS: AppSettings = {
  languageCode: 'hi',
  theme: 'light',
  textScale: 1,
  highContrast: false,
  voiceURI: null,
  notifications: {
    enabled: true,
    weather: true,
    crop: true,
    mandi: true,
    government: true,
    reminders: true,
  },
  // Uttar Pradesh "pucca bigha" (≈ 0.625 acre). Configurable in Settings / calculators.
  bighaSqm: 2529.3,
  bighaPreset: 'up',
};

const EMPTY_SESSION: Session = { loggedIn: false };

export function getSettings(): AppSettings {
  const s = store.get<Partial<AppSettings>>(KEYS.settings, {});
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    notifications: { ...DEFAULT_SETTINGS.notifications, ...(s.notifications || {}) },
  };
}

export function useSettings(): [AppSettings, (patch: Partial<AppSettings>) => void] {
  const [raw] = usePersisted<Partial<AppSettings>>(KEYS.settings, {});
  const settings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...raw,
    notifications: { ...DEFAULT_SETTINGS.notifications, ...(raw.notifications || {}) },
  };
  const update = useCallback((patch: Partial<AppSettings>) => {
    store.set<Partial<AppSettings>>(KEYS.settings, prev => ({ ...prev, ...patch }), {});
  }, []);
  return [settings, update];
}

export function getProfile(): UserProfile | null {
  return store.get<UserProfile | null>(KEYS.profile, null);
}

export function useProfile(): [UserProfile | null, (patch: Partial<UserProfile>) => void] {
  const [profile] = usePersisted<UserProfile | null>(KEYS.profile, null);
  const update = useCallback((patch: Partial<UserProfile>) => {
    store.set<UserProfile | null>(KEYS.profile, prev => ({ name: '', ...(prev || {}), ...patch }), null);
  }, []);
  return [profile, update];
}

export function useSession(): [Session, (s: Session) => void] {
  const [session, setSession] = usePersisted<Session>(KEYS.session, EMPTY_SESSION);
  return [session, setSession];
}

export function getPlace(): GeoPlace {
  return store.get<GeoPlace>(KEYS.place, DEFAULT_PLACE);
}

/** The farmer's selected location (drives weather, mandi and advisory). */
export function usePlace(): [GeoPlace, (p: GeoPlace) => void] {
  return usePersisted<GeoPlace>(KEYS.place, DEFAULT_PLACE);
}

/** "वाराणसी, उत्तर प्रदेश" */
export function placeLabel(p: GeoPlace): string {
  return p.state && p.state !== p.name ? `${p.name}, ${p.state}` : p.name;
}

/** Signs out and wipes all on-device data (the app has no server-side account yet). */
export function logoutAndClear() {
  store.clearAll();
}
