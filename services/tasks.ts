// Farming tasks: auto-generated from each crop's calendar templates (data/task-templates.ts)
// plus the farmer's own tasks. Used by Calendar, Home, Crop details and advisory.
import { useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { datedTemplatesForCrop, findTemplate, templateText } from '../data/task-templates';
import { track } from '../lib/analytics';
import { getSettings } from '../lib/app-state';
import { addDays, toISODate, todayISO } from '../lib/format';
import { KEYS, collection, newId, useCollection } from '../lib/store';
import type { Crop, FarmingTask } from '../types/models';
import { cancelReminder, scheduleReminder } from './reminders';

const tasks = () => collection<FarmingTask>(KEYS.tasks);
const isNative = Capacitor.isNativePlatform();

const autoId = (cropId: string, templateId: string) => `auto:${cropId}:${templateId}`;

/** Title/description in the current UI language (auto tasks follow language changes). */
export function taskText(task: FarmingTask, lang = getSettings().languageCode): { title: string; desc?: string } {
  if (task.templateId) {
    const tpl = findTemplate(task.templateId);
    if (tpl) {
      const { title, desc } = templateText(tpl, lang);
      return { title, desc };
    }
  }
  return { title: task.title, desc: task.note };
}

/** Auto tasks for a crop from its sowing/transplant date (none until a date is known). */
export function generateTasksForCrop(crop: Crop): FarmingTask[] {
  return datedTemplatesForCrop(crop).map(tpl => ({
    id: autoId(crop.id, tpl.templateId),
    title: tpl.titleHi,
    note: tpl.descHi,
    type: tpl.type,
    dueDate: tpl.dueDate,
    cropId: crop.id,
    done: false,
    source: 'auto' as const,
    templateId: tpl.templateId,
  }));
}

/**
 * Re-create a crop's auto tasks after it is added or edited. Completed tasks and reminders are
 * kept for templates that still exist; the farmer's own tasks are never touched.
 */
export function syncCropTasks(crop: Crop) {
  const col = tasks();
  const all = col.all();
  const previous = new Map(all.filter(t => t.cropId === crop.id && t.source === 'auto').map(t => [t.id, t]));
  const fresh = generateTasksForCrop(crop).map(t => {
    const old = previous.get(t.id);
    return old ? { ...t, done: old.done, doneAt: old.doneAt, reminderAt: old.dueDate === t.dueDate ? old.reminderAt : undefined } : t;
  });
  // Reminders for auto tasks that moved or disappeared must not fire.
  for (const old of previous.values()) {
    const next = fresh.find(t => t.id === old.id);
    if (old.reminderAt && (!next || !next.reminderAt)) cancelReminder(old.id);
  }
  const others = all.filter(t => !(t.cropId === crop.id && t.source === 'auto'));
  col.setAll([...others, ...fresh]);
}

/** Remove every task of a deleted crop (and cancel their reminders). */
export function removeCropTasks(cropId: string) {
  const col = tasks();
  const all = col.all();
  all.filter(t => t.cropId === cropId && t.reminderAt).forEach(t => cancelReminder(t.id));
  col.setAll(all.filter(t => t.cropId !== cropId));
}

/**
 * Backstop for screens that list tasks: re-syncs any crop whose stored auto tasks no longer match
 * its sowing/transplant dates (e.g. a date was edited without syncCropTasks, a crop was added
 * before tasks existed, or the catalog changed), and removes auto tasks whose crop no longer
 * exists (cancelling their reminders). Writes only when something differs, so it is cheap and
 * safe to call whenever the crop list changes (or at app start). Done state and reminders are
 * kept for templates that still exist. Returns true when tasks were updated.
 */
export function reconcileAutoTasks(crops: Crop[]): boolean {
  let changed = removeOrphanAutoTasks(crops);
  const all = tasks().all();
  for (const crop of crops) {
    const fresh = generateTasksForCrop(crop);
    const stored = new Map(all.filter(t => t.cropId === crop.id && t.source === 'auto').map(t => [t.id, t]));
    const same =
      stored.size === fresh.length &&
      fresh.every(f => {
        const s = stored.get(f.id);
        return !!s && s.dueDate === f.dueDate && s.type === f.type && s.templateId === f.templateId;
      });
    if (!same) {
      syncCropTasks(crop);
      changed = true;
    }
  }
  return changed;
}

/** Auto tasks of crops that are gone (deleted without removeCropTasks): drop them and their reminders. */
function removeOrphanAutoTasks(crops: Crop[]): boolean {
  // The stored list as well as the caller's, so a partial list never deletes another crop's tasks.
  const known = new Set([...crops, ...collection<Crop>(KEYS.crops).all()].map(c => c.id));
  const all = tasks().all();
  const orphans = new Set(all.filter(t => t.source === 'auto' && !(t.cropId && known.has(t.cropId))).map(t => t.id));
  if (!orphans.size) return false;
  for (const t of all) if (orphans.has(t.id) && t.reminderAt) cancelReminder(t.id);
  tasks().setAll(all.filter(t => !orphans.has(t.id)));
  return true;
}

export function addUserTask(task: Omit<FarmingTask, 'id' | 'source' | 'done'>): FarmingTask {
  const item: FarmingTask = { ...task, id: newId('t'), source: 'user', done: false };
  tasks().upsert(item);
  return item;
}

export function setTaskDone(id: string, done: boolean) {
  const task = tasks().get(id);
  // Already in that state (e.g. a second tap while a sheet closes): no new doneAt, toast or metric.
  if (!task || task.done === done) return;
  tasks().update(id, { done, doneAt: done ? new Date().toISOString() : undefined });
  if (done) {
    track('task_completed', { type: task.type, source: task.source });
    // The notification is cancelled but `reminderAt` is kept, so "undo" can bring it back.
    if (task.reminderAt) cancelReminder(id);
    return;
  }
  if (task.done && task.reminderAt) {
    // Re-opened (e.g. undo): restore a reminder that is still ahead, drop one that has passed.
    const at = new Date(task.reminderAt);
    if (at.getTime() > Date.now()) {
      scheduleTask({ ...task, done: false }, at)
        .then(ok => {
          if (!ok) tasks().update(id, { reminderAt: undefined });
        })
        .catch(() => tasks().update(id, { reminderAt: undefined }));
    } else {
      tasks().update(id, { reminderAt: undefined });
    }
  }
}

/** Notifications on, and task reminders on, in the app's Settings. */
function remindersAllowed(): boolean {
  const n = getSettings().notifications;
  return n.enabled && n.reminders;
}

/** Tapping the reminder opens the calendar on this task (CalendarScreen reads params.taskId). */
const reminderTarget = (task: FarmingTask) => ({
  screen: 'calendar',
  params: task.cropId ? { cropId: task.cropId, taskId: task.id } : { taskId: task.id },
});

async function scheduleTask(task: FarmingTask, at: Date): Promise<boolean> {
  if (at.getTime() <= Date.now()) return false;
  // Reminders switched off in Settings: keep the farmer's chosen time but do not put an Android
  // notification on the schedule (it would fire regardless of the setting); syncTaskReminders()
  // schedules it again when they are switched back on. On the web, due reminders already go
  // through pushNotification, which honours the setting.
  if (isNative && !remindersAllowed()) {
    await cancelReminder(task.id);
    return true;
  }
  const { title, desc } = taskText(task);
  return scheduleReminder({ id: task.id, title, body: desc || title, at, target: reminderTarget(task) });
}

/**
 * Schedule a reminder; returns false when notifications are not permitted or the time is past.
 * With reminders switched off in Settings the time is saved but nothing fires until they are
 * switched on again (see syncTaskReminders).
 */
export async function setTaskReminder(task: FarmingTask, at: Date): Promise<boolean> {
  const ok = await scheduleTask(task, at);
  if (ok) {
    tasks().update(task.id, { reminderAt: at.toISOString() });
    track('reminder_set', { type: task.type });
  }
  return ok;
}

/**
 * Re-sends an existing reminder after its task was edited (new date, name or note), without
 * counting a new 'reminder_set'. Returns false when it could not be scheduled (the caller then
 * clears it with clearTaskReminder).
 */
export async function rescheduleTaskReminder(task: FarmingTask, at: Date): Promise<boolean> {
  const ok = await scheduleTask(task, at);
  if (ok) tasks().update(task.id, { reminderAt: at.toISOString() });
  return ok;
}

/**
 * Brings scheduled task notifications in line with Settings. Call after the farmer switches
 * notifications or reminders on/off. Off: every pending task notification is cancelled (the
 * chosen times stay saved). On: each future reminder of an open task is scheduled again; one
 * that can no longer be scheduled (permission denied) is cleared so the calendar stops showing it.
 */
export async function syncTaskReminders(): Promise<void> {
  const allowed = remindersAllowed();
  const now = Date.now();
  for (const task of tasks().all()) {
    if (!task.reminderAt) continue;
    const at = new Date(task.reminderAt);
    if (!allowed || task.done || !(at.getTime() > now)) {
      await cancelReminder(task.id);
      continue;
    }
    const ok = await scheduleTask(task, at).catch(() => false);
    if (!ok) tasks().update(task.id, { reminderAt: undefined });
  }
}

export async function clearTaskReminder(task: FarmingTask) {
  await cancelReminder(task.id);
  tasks().update(task.id, { reminderAt: undefined });
}

const byDue = (a: FarmingTask, b: FarmingTask) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title);

/** Local date (YYYY-MM-DD) a crop was added to the app, or undefined when unknown. */
function cropAddedOn(crop: Pick<Crop, 'createdAt'> | undefined): string | undefined {
  if (!crop?.createdAt) return undefined;
  const d = new Date(crop.createdAt);
  return Number.isNaN(d.getTime()) ? undefined : toISODate(d);
}

/**
 * True for an auto task that was already in the past when the farmer added its crop (e.g. field
 * preparation and sowing for a crop added three weeks after sowing). Such tasks are history, not
 * missed work, so they never count as overdue ("बाकी") anywhere.
 */
export function dueBeforeCropAdded(task: FarmingTask, crop: Pick<Crop, 'createdAt'> | undefined): boolean {
  if (task.source !== 'auto') return false;
  const added = cropAddedOn(crop);
  return !!added && task.dueDate < added;
}

/**
 * Predicate over the stored crops, for callers that only pass tasks: drops auto tasks that were
 * history when their crop was added, and auto tasks whose crop no longer exists (the calendar
 * hides those too, so Home and Kheti counts match it).
 */
function notBeforeCropAdded(): (t: FarmingTask) => boolean {
  const crops = new Map(collection<Crop>(KEYS.crops).all().map(c => [c.id, c]));
  return t => {
    if (t.source !== 'auto') return true;
    const crop = t.cropId ? crops.get(t.cropId) : undefined;
    return !!crop && !dueBeforeCropAdded(t, crop);
  };
}

/** Next open task for a crop (overdue ones within the last 7 days count). */
export function nextTaskForCrop(cropId: string, all: FarmingTask[] = tasks().all()): FarmingTask | undefined {
  const today = todayISO();
  const from = addDays(today, -7);
  const keep = notBeforeCropAdded();
  return all.filter(t => t.cropId === cropId && !t.done && t.dueDate >= from && keep(t)).sort(byDue)[0];
}

export type TaskRange = 'overdue' | 'today' | 'tomorrow' | 'week' | 'month';

/** Open tasks in a range relative to today ('week' = next 7 days incl. today). */
export function tasksInRange(all: FarmingTask[], range: TaskRange, today = todayISO()): FarmingTask[] {
  const keep = notBeforeCropAdded();
  const open = all.filter(t => !t.done && keep(t));
  const tomorrow = addDays(today, 1);
  switch (range) {
    case 'overdue':
      return open.filter(t => t.dueDate < today && t.dueDate >= addDays(today, -30)).sort(byDue);
    case 'today':
      return open.filter(t => t.dueDate === today).sort(byDue);
    case 'tomorrow':
      return open.filter(t => t.dueDate === tomorrow).sort(byDue);
    case 'week':
      return open.filter(t => t.dueDate >= today && t.dueDate <= addDays(today, 6)).sort(byDue);
    case 'month':
      return open.filter(t => t.dueDate >= today && t.dueDate <= addDays(today, 30)).sort(byDue);
  }
}

/** Reactive task list with helpers. */
export function useTasks() {
  const col = useCollection<FarmingTask>(KEYS.tasks);
  return useMemo(
    () => ({
      tasks: [...col.items].sort(byDue),
      setDone: setTaskDone,
      remove: (id: string) => {
        cancelReminder(id);
        col.remove(id);
      },
      update: (id: string, patch: Partial<FarmingTask>) => col.update(id, patch),
      add: addUserTask,
    }),
    [col],
  );
}
