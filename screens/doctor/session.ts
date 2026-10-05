// Crop Doctor's running check and unsent draft, kept at module level.
//
// The shell renders only the ACTIVE tab's stack, so tapping another bottom tab unmounts
// CropDoctorScreen. The analysis therefore must not live in the component: it keeps running
// here, the crop/photo/note survive the remount, and a result that arrives while the screen is
// gone (or hidden under another screen) is announced with a toast and opened on the next visit
// through `doctor.pendingResult`. Only "जांच रोकें" aborts a check.
import { useSyncExternalStore } from 'react';
import { toast } from '../../components/ui';
import { tNow } from '../../lib/i18n';
import type { TabKey } from '../../lib/nav';
import { store } from '../../lib/store';
import { analyzeCropPhoto } from '../../services/diagnosis';
import type { CropDiagnosis, NavTarget } from '../../types/models';
import './strings';

export const PENDING_KEY = 'doctor.pendingResult';
export const LAST_CROP_KEY = 'doctor.lastCrop';

/** A finished check the farmer has not seen yet. */
export interface PendingResult {
  id: string;
  /** Date.now() when it finished. */
  at: number;
}

/** Older than this, a pending result is not opened by itself (it stays in "पिछली जांच"). */
const PENDING_FRESH_MS = 30 * 60_000;

/** Reads and clears the pending result; returns its id only while it is fresh. */
export function takePendingResult(): string | null {
  const p = store.get<PendingResult | null>(PENDING_KEY, null);
  if (!p) return null;
  store.set<PendingResult | null>(PENDING_KEY, null);
  return Date.now() - p.at < PENDING_FRESH_MS ? p.id : null;
}

/** i18n key of a caught error (AIError / DiagnosisError carry `messageKey`). */
export function errorKey(e: unknown): string {
  const k = (e as { messageKey?: unknown } | null)?.messageKey;
  return typeof k === 'string' ? k : 'common.error.generic';
}

// ---------------- Draft (per route) ----------------

export interface Draft {
  cropKey: string | null;
  photo: string | null;
  note: string;
}

const drafts = new Map<string, Draft>();
const MAX_DRAFTS = 3;

/** The draft of this route instance, if it was left by a tab switch. */
export function readDraft(routeKey: string): Draft | undefined {
  return drafts.get(routeKey);
}

export function writeDraft(routeKey: string, draft: Draft) {
  drafts.delete(routeKey);
  drafts.set(routeKey, draft);
  // Photos are ~100–250 KB each: keep only the latest few routes.
  while (drafts.size > MAX_DRAFTS) drafts.delete(drafts.keys().next().value as string);
}

// ---------------- Running check ----------------

export interface Job {
  routeKey: string;
  cropKey: string;
  startedAt: number;
  ctrl: AbortController;
}

let job: Job | null = null;
let failure: { routeKey: string; error: unknown } | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** The check in progress (one at a time, from any Crop Doctor screen), or null. */
export function useDoctorJob(): Job | null {
  return useSyncExternalStore(subscribe, () => job);
}

/** The last failed check of this route, until the farmer retries or changes the photo. */
export function useDoctorFailure(routeKey: string): unknown {
  return useSyncExternalStore(subscribe, () => (failure?.routeKey === routeKey ? failure.error : null));
}

export function clearFailure() {
  if (!failure) return;
  failure = null;
  emit();
}

// ---------------- Mounted Crop Doctor screens ----------------

export interface Host {
  routeKey: string;
  /** Visible (topmost) right now. */
  isActive: () => boolean;
  /** The check finished: clear the screen's own photo/note state. */
  onResult: (d: CropDiagnosis) => void;
  /** Push the result screen with the screen's current navigation. */
  open: (id: string) => void;
}

const hosts = new Set<Host>();

export function registerHost(host: Host): () => void {
  hosts.add(host);
  return () => {
    hosts.delete(host);
  };
}

const hostOf = (routeKey: string) => [...hosts].find(h => h.routeKey === routeKey);

export interface Origin {
  routeKey: string;
  /** The tab Crop Doctor was opened in. */
  tab: TabKey;
  /** nav.switchTab (stable): opens the result even after the screen unmounted. */
  switchTab: (tab: TabKey, target?: NavTarget) => void;
}

export interface StartInput {
  cropKey: string;
  photo: string;
  note?: string;
}

/** Starts a check unless one is already running. Never aborted by unmounting. */
export function startAnalysis(input: StartInput, origin: Origin) {
  if (job) return;
  const ctrl = new AbortController();
  const mine: Job = { routeKey: origin.routeKey, cropKey: input.cropKey, startedAt: Date.now(), ctrl };
  job = mine;
  failure = null;
  emit();
  analyzeCropPhoto({ cropKey: input.cropKey, imageDataUrl: input.photo, note: input.note, signal: ctrl.signal })
    .then(d => {
      if (!ctrl.signal.aborted) finish(d, origin);
    })
    .catch(e => {
      if (!ctrl.signal.aborted) fail(e, origin.routeKey);
    })
    .finally(() => {
      if (job === mine) {
        job = null;
        emit();
      }
    });
}

/** "जांच रोकें": the request is abandoned and nothing is saved. */
export function cancelAnalysis() {
  if (!job) return;
  job.ctrl.abort();
  job = null;
  emit();
}

function finish(d: CropDiagnosis, origin: Origin) {
  store.set<string | null>(LAST_CROP_KEY, d.cropKey);

  // The photo is used up. Keep the note when only the photo was bad, so "दोबारा फोटो लें"
  // does not make the farmer type or dictate it again.
  const draft = drafts.get(origin.routeKey);
  if (draft) writeDraft(origin.routeKey, { ...draft, photo: null, note: d.unusableReason ? draft.note : '' });

  const host = hostOf(origin.routeKey);
  host?.onResult(d);
  if (host?.isActive()) {
    host.open(d.id);
    return;
  }

  // Not visible: another screen is on top, or another tab is showing.
  store.set<PendingResult | null>(PENDING_KEY, { id: d.id, at: Date.now() });
  toast.success(tNow('doctor.done'), {
    id: 'doctor-done',
    action: {
      label: tNow('doctor.doneAction'),
      onPress: () => {
        // Already opened by a Crop Doctor screen that became visible meanwhile.
        if (store.get<PendingResult | null>(PENDING_KEY, null)?.id !== d.id) return;
        store.set<PendingResult | null>(PENDING_KEY, null);
        const live = hostOf(origin.routeKey);
        if (live) live.open(d.id);
        else origin.switchTab(origin.tab, { screen: 'diagnosis', params: { id: d.id } });
      },
    },
  });
}

function fail(error: unknown, routeKey: string) {
  failure = { routeKey, error };
  emit();
  // Shown on the screen when the farmer is back; tell them now if it is not visible.
  if (!hostOf(routeKey)?.isActive()) toast.error(`${tNow('doctor.failedAway')} ${tNow(errorKey(error))}`, { id: 'doctor-failed' });
}
