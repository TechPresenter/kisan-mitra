// Task reminders. Android: scheduled local notifications (fire even when the app is closed).
// Web: a due reminder is turned into an in-app notification the next time the app is open.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { store } from '../lib/store';
import type { NavTarget } from '../types/models';
import { pushNotification } from './notifications';

const isNative = Capacitor.isNativePlatform();
const WEB_KEY = 'reminders.web';

interface WebReminder {
  id: string;
  title: string;
  body: string;
  at: string;
  target?: NavTarget;
}

/** Local-notification ids must be 32-bit ints; derive one from our string id. */
export function reminderNumericId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isNative) return true;
  try {
    let status = await LocalNotifications.checkPermissions();
    if (status.display !== 'granted') status = await LocalNotifications.requestPermissions();
    return status.display === 'granted';
  } catch {
    return false;
  }
}

/** Schedule (or reschedule) a reminder. Returns false if permission was denied or the time is past. */
export async function scheduleReminder(r: {
  id: string;
  title: string;
  body: string;
  at: Date;
  target?: NavTarget;
}): Promise<boolean> {
  if (r.at.getTime() <= Date.now()) return false;
  if (isNative) {
    if (!(await ensureNotificationPermission())) return false;
    const numericId = reminderNumericId(r.id);
    await LocalNotifications.cancel({ notifications: [{ id: numericId }] }).catch(() => {});
    await LocalNotifications.schedule({
      notifications: [
        {
          id: numericId,
          title: r.title,
          body: r.body,
          schedule: { at: r.at, allowWhileIdle: true },
          extra: r.target ? { target: r.target } : undefined,
        },
      ],
    });
    return true;
  }
  store.set<WebReminder[]>(
    WEB_KEY,
    prev => [...prev.filter(x => x.id !== r.id), { id: r.id, title: r.title, body: r.body, at: r.at.toISOString(), target: r.target }],
    [],
  );
  return true;
}

export async function cancelReminder(id: string): Promise<void> {
  if (isNative) {
    await LocalNotifications.cancel({ notifications: [{ id: reminderNumericId(id) }] }).catch(() => {});
    return;
  }
  store.set<WebReminder[]>(WEB_KEY, prev => prev.filter(x => x.id !== id), []);
}

/** Call on app start: delivers due web reminders into the notification center. */
export function flushDueWebReminders() {
  if (isNative) return;
  const now = Date.now();
  const all = store.get<WebReminder[]>(WEB_KEY, []);
  const due = all.filter(r => new Date(r.at).getTime() <= now);
  if (!due.length) return;
  due.forEach(r =>
    pushNotification({ category: 'reminder', priority: 'important', title: r.title, body: r.body, target: r.target, dedupeKey: `reminder:${r.id}:${r.at}` }),
  );
  store.set<WebReminder[]>(WEB_KEY, all.filter(r => !due.includes(r)));
}

/** Tapping an Android reminder opens its target screen. */
export function onReminderTapped(handler: (target: NavTarget) => void): () => void {
  if (!isNative) return () => {};
  const sub = LocalNotifications.addListener('localNotificationActionPerformed', e => {
    const target = e.notification.extra?.target as NavTarget | undefined;
    if (target) handler(target);
  });
  return () => {
    sub.then(s => s.remove());
  };
}
