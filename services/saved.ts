// "मेरी सेव की गई जानकारी" — bookmarks for AI answers, guides, advice, mandi crops, schemes.
import { useMemo } from 'react';
import { track } from '../lib/analytics';
import { KEYS, collection, newId, useCollection } from '../lib/store';
import type { SavedItem, SavedType } from '../types/models';

const saved = () => collection<SavedItem>(KEYS.saved);

export function isSaved(type: SavedType, refId: string): boolean {
  return saved().all().some(i => i.type === type && i.refId === refId);
}

/** Saves if not saved yet, otherwise removes. Returns the new saved state. */
export function toggleSaved(item: Omit<SavedItem, 'id' | 'savedAt'>): boolean {
  const col = saved();
  const existing = col.all().find(i => i.type === item.type && i.refId === item.refId);
  if (existing) {
    col.remove(existing.id);
    return false;
  }
  col.upsert({ ...item, id: newId('s'), savedAt: new Date().toISOString() });
  track('saved', { type: item.type });
  return true;
}

export function useSaved() {
  const col = useCollection<SavedItem>(KEYS.saved);
  return useMemo(
    () => ({
      items: [...col.items].sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
      isSaved: (type: SavedType, refId: string) => col.items.some(i => i.type === type && i.refId === refId),
      toggle: toggleSaved,
      remove: (id: string) => col.remove(id),
    }),
    [col],
  );
}
