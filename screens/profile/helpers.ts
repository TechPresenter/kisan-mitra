// Shared helpers for the Profile tab: labels for farm fields, area totals, the data export
// and the "wipe this phone" flow used by logout and "सारा डेटा हटाएं".
import { getSettings, logoutAndClear } from '../../lib/app-state';
import { formatNumber } from '../../lib/format';
import type { TFunction } from '../../lib/i18n';
import { KEYS, collection, store } from '../../lib/store';
import { areaInAcres } from '../../data/units';
import { cancelReminder } from '../../services/reminders';
import type { AIConversation, AreaUnit, Farm, FarmingTask, FarmingType, IrrigationType, SoilType, UserProfile } from '../../types/models';

/** Shown on Profile and Settings ("संस्करण 2.0.0"); keep in sync with package.json. */
export const APP_VERSION = '2.0.0';

/**
 * Official support email for feedback and privacy questions. null until the product owner gives
 * one: the Help centre then only prepares the message for the farmer to share wherever they like,
 * and never claims that the team receives it. Never fill this with a made-up address.
 */
export const SUPPORT_EMAIL: string | null = null;

export const AREA_UNITS: AreaUnit[] = ['acre', 'bigha', 'hectare'];
export const SOIL_TYPES: SoilType[] = ['alluvial', 'loamy', 'black', 'red', 'sandy', 'clay', 'laterite', 'unknown'];
export const IRRIGATION_TYPES: IrrigationType[] = ['tubewell', 'canal', 'rainfed', 'drip', 'sprinkler', 'pond', 'other'];
export const FARMING_TYPES: FarmingType[] = ['conventional', 'organic', 'natural', 'mixed'];

export const unitLabel = (t: TFunction, unit: AreaUnit) => t(`common.${unit}`);

/** "2.5 एकड़" */
export const formatArea = (t: TFunction, area: number, unit: AreaUnit) => `${formatNumber(area, 2)} ${unitLabel(t, unit)}`;

/** Sum of farm areas in acres, using the farmer's local bigha size. */
export function totalAcres(farms: Farm[], bighaSqm: number): number {
  return farms.reduce((sum, f) => sum + (f.area > 0 ? areaInAcres(f.area, f.unit, bighaSqm) : 0), 0);
}

/**
 * Total land of the farms, in their shared unit when all measured farms use the same one
 * (so "5 बीघा" stays bigha), otherwise in acres. null when no farm has an area yet.
 */
export function farmsLand(farms: Farm[], bighaSqm: number): { area: number; unit: AreaUnit } | null {
  const measured = farms.filter(f => f.area > 0);
  if (!measured.length) return null;
  const unit = measured[0].unit;
  const area = measured.every(f => f.unit === unit)
    ? measured.reduce((sum, f) => sum + f.area, 0)
    : totalAcres(measured, bighaSqm);
  return { area: Math.round(area * 100) / 100, unit: measured.every(f => f.unit === unit) ? unit : 'acre' };
}

/**
 * Once farms exist they are the one source of the farmer's land: profile.landArea (read by the AI,
 * calculators and hisab) is kept equal to their total. Call after a farm is added, edited or deleted.
 * With no measured farm the profile value is left alone (it may be the only figure we have).
 */
export function syncProfileLand(): void {
  const total = farmsLand(collection<Farm>(KEYS.farms).all(), getSettings().bighaSqm);
  if (!total) return;
  const profile = store.get<UserProfile | null>(KEYS.profile, null);
  if (!profile || (profile.landArea === total.area && profile.landUnit === total.unit)) return;
  store.set<UserProfile | null>(KEYS.profile, prev => (prev ? { ...prev, landArea: total.area, landUnit: total.unit } : prev), null);
}

/** "1 फसल" / "3 फसलें" / "अभी कोई फसल नहीं" */
export function cropCountLabel(t: TFunction, n: number): string {
  if (n <= 0) return t('profile.farms.cropsNone');
  if (n === 1) return t('profile.farms.cropsOne');
  return t('profile.farms.cropsMany', { n });
}

// ---------- Data export ----------

const PREFIX = 'km:v2:';
const SKIP_KEYS = new Set<string>([KEYS.session, 'ai.usage']);
const isDataUrl = (v: unknown) => typeof v === 'string' && v.startsWith('data:');

/** Deep copy without photos (data: URLs), which are large and personal. */
function withoutPhotos(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutPhotos);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isDataUrl(v)) continue;
      out[k] = withoutPhotos(v);
    }
    return out;
  }
  return value;
}

/**
 * Android passes shared text through a binder transaction (about 1 MB for the whole parcel, less in
 * practice; strings travel as UTF-16). Above this many characters the export is trimmed before
 * it is handed to the share sheet, so a long chat history cannot crash or silently fail the share.
 */
export const SHARE_TEXT_LIMIT = 200_000;

/** Parts left out to fit the share limit, in the order they are dropped. */
export type ExportOmission = 'chatsTrimmed' | 'chats' | 'history';

export interface DataExport {
  json: string;
  omitted: ExportOmission[];
  /** Still above maxChars after every trim: do not hand it to the share sheet. */
  tooLarge: boolean;
}

/** Most recent conversations, each with only its last messages. */
const CHAT_KEEP = { conversations: 20, messages: 12 };
/** Logs that are nice to have but not the farmer's own records. */
const HISTORY_KEYS: string[] = [KEYS.notifications, KEYS.mandiHistory, KEYS.recentSearches];

function collectExportData(): Record<string, unknown> {
  const names: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) names.push(k.slice(PREFIX.length));
  }
  const data: Record<string, unknown> = {};
  for (const name of names.sort()) {
    if (name.startsWith(store.cacheKey('')) || SKIP_KEYS.has(name)) continue;
    const value = store.get<unknown>(name, null);
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    data[name] = withoutPhotos(value);
  }
  return data;
}

/**
 * Everything the app stores on this phone (km:v2:*), minus cached API responses, the session
 * and photos, as JSON. Values are read through lib/store so unsaved in-memory changes win.
 * Only keys that exist in storage are read: store.get() on a missing key would cache the fallback
 * and hand it to every later usePersisted() of that key.
 *
 * `compact` drops the indentation. With `maxChars`, AI chats are trimmed to the latest ones, then
 * left out, then logs (notifications, price history, searches) are left out until it fits; the
 * farmer's own records (profile, farms, crops, tasks, hisab, soil, saved) are always kept.
 */
export function buildDataExport({ compact = false, maxChars = Infinity }: { compact?: boolean; maxChars?: number } = {}): DataExport {
  const data = collectExportData();
  const omitted: ExportOmission[] = [];
  const render = () =>
    JSON.stringify(
      {
        app: 'Kisan Mitra',
        version: APP_VERSION,
        exportedAt: new Date().toISOString(),
        note: 'Photos are not included. / फोटो शामिल नहीं हैं।',
        ...(omitted.length ? { omitted } : {}),
        data,
      },
      null,
      compact ? undefined : 2,
    );

  let json = render();
  if (json.length <= maxChars) return { json, omitted, tooLarge: false };

  const chats = data[KEYS.conversations];
  if (Array.isArray(chats) && chats.length) {
    data[KEYS.conversations] = (chats as AIConversation[])
      .slice()
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      .slice(0, CHAT_KEEP.conversations)
      .map(c => ({ ...c, messages: Array.isArray(c.messages) ? c.messages.slice(-CHAT_KEEP.messages) : [] }));
    omitted.push('chatsTrimmed');
    json = render();
    if (json.length <= maxChars) return { json, omitted, tooLarge: false };
  }

  if (KEYS.conversations in data || KEYS.diagnoses in data) {
    delete data[KEYS.conversations];
    delete data[KEYS.diagnoses];
    const trimmedAt = omitted.indexOf('chatsTrimmed');
    if (trimmedAt >= 0) omitted.splice(trimmedAt, 1);
    omitted.push('chats');
    json = render();
    if (json.length <= maxChars) return { json, omitted, tooLarge: false };
  }

  if (HISTORY_KEYS.some(k => k in data)) {
    HISTORY_KEYS.forEach(k => delete data[k]);
    omitted.push('history');
    json = render();
  }
  return { json, omitted, tooLarge: json.length > maxChars };
}

/** Web: save as a .json file. Returns false when the browser can't download files. */
export function downloadJSON(json: string, fileName: string): boolean {
  try {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch {
    return false;
  }
}

// ---------- Wipe ----------

/**
 * Logout / "delete all data": cancels scheduled task reminders (they would otherwise still fire
 * after the tasks are gone), clears every km:v2 key and restarts the app at the login screen.
 */
export async function wipeDeviceAndRestart(): Promise<void> {
  const tasks = store.get<FarmingTask[]>(KEYS.tasks, []);
  await Promise.all(tasks.filter(task => task.reminderAt).map(task => cancelReminder(task.id).catch(() => {})));
  logoutAndClear();
  window.location.reload();
}
