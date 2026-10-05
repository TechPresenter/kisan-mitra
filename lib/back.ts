// Back-press handlers for overlays (sheets, dialogs, pickers). The most recently registered
// enabled handler wins, so the Android back button / Escape closes the topmost overlay first.
import { useEffect, useRef } from 'react';

const handlers: { current: () => void }[] = [];

/** While `enabled`, a back press calls `onBack` instead of navigating. */
export function useBackHandler(onBack: () => void, enabled = true) {
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    if (!enabled) return;
    const entry = { current: () => ref.current() };
    handlers.push(entry);
    return () => {
      const i = handlers.lastIndexOf(entry);
      if (i >= 0) handlers.splice(i, 1);
    };
  }, [enabled]);
}

/** Runs the topmost handler; returns false when no overlay consumed the back press. */
export function runBackHandlers(): boolean {
  const top = handlers[handlers.length - 1];
  if (!top) return false;
  top.current();
  return true;
}
