// In-app notification center (weather / crop / mandi / scheme / reminder / AI alerts).
import { useMemo } from 'react';
import { getSettings } from '../lib/app-state';
import { KEYS, collection, newId, useCollection } from '../lib/store';
import type { AppNotification, NotificationCategory } from '../types/models';

const MAX_ITEMS = 200;
const notifications = () => collection<AppNotification>(KEYS.notifications);

const categoryEnabled = (c: NotificationCategory): boolean => {
  const n = getSettings().notifications;
  if (!n.enabled) return false;
  switch (c) {
    case 'weather': return n.weather;
    case 'crop': return n.crop;
    case 'mandi': return n.mandi;
    case 'government': return n.government;
    case 'reminder': return n.reminders;
    default: return true;
  }
};

/**
 * Add a notification unless its category is switched off or an item with the same
 * `dedupeKey` already exists. Returns the stored item, or null when skipped.
 */
export function pushNotification(
  n: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & { createdAt?: string },
): AppNotification | null {
  if (!categoryEnabled(n.category)) return null;
  const col = notifications();
  const all = col.all();
  if (n.dedupeKey && all.some(x => x.dedupeKey === n.dedupeKey)) return null;
  const item: AppNotification = { ...n, id: newId('n'), createdAt: n.createdAt || new Date().toISOString(), read: false };
  col.setAll([item, ...all].slice(0, MAX_ITEMS));
  return item;
}

export function useNotifications() {
  const col = useCollection<AppNotification>(KEYS.notifications);
  return useMemo(() => {
    const items = [...col.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      items,
      unread: items.filter(i => !i.read).length,
      markRead: (id: string) => col.update(id, { read: true }),
      markAllRead: () => col.setAll(col.items.map(i => ({ ...i, read: true }))),
      remove: (id: string) => col.remove(id),
      clear: () => col.setAll([]),
    };
  }, [col]);
}
