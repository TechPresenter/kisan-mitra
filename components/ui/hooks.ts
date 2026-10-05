// Small DOM hooks shared by the kit: optional nav, element size, roving focus, modal layers.
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react';
import { useNav, type NavApi } from '../../lib/nav';

/**
 * useNav() without the provider requirement, so kit screens also render on the login /
 * onboarding gate and in the gallery. useNav reads context before it throws, so the
 * hook order stays stable either way.
 */
export function useOptionalNav(): NavApi | null {
  try {
    return useNav();
  } catch {
    return null;
  }
}

/** Tracks an element's content width (charts render at real pixels so text and strokes stay crisp). */
export function useElementWidth<T extends HTMLElement>(): [(el: T | null) => void, number] {
  const [el, setEl] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w != null) setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width];
}

/**
 * Arrow-key navigation for single-select groups (chips, segmented tabs): one tab stop,
 * arrows move focus and selection together, Home/End jump to the ends.
 */
export function useRoving(count: number, activeIndex: number, onMove: (index: number) => void) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const setRef = useCallback(
    (i: number) => (el: HTMLElement | null) => {
      refs.current[i] = el;
    },
    [],
  );
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (!count) return;
    const rtl = typeof document !== 'undefined' && document.dir === 'rtl';
    const focused = refs.current.findIndex(el => el === document.activeElement);
    const from = focused >= 0 ? focused : Math.max(0, activeIndex);
    let next: number;
    switch (e.key) {
      case 'ArrowRight':
        next = rtl ? from - 1 : from + 1;
        break;
      case 'ArrowLeft':
        next = rtl ? from + 1 : from - 1;
        break;
      case 'ArrowDown':
        next = from + 1;
        break;
      case 'ArrowUp':
        next = from - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = count - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    next = (next + count) % count;
    refs.current[next]?.focus();
    onMove(next);
  };
  const tabIndexFor = (i: number) => (i === (activeIndex >= 0 ? activeIndex : 0) ? 0 : -1);
  return { setRef, onKeyDown, tabIndexFor };
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function focusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    el => !el.hasAttribute('inert') && el.getClientRects().length > 0,
  );
}

let modalCount = 0;

/** The app root goes inert while any modal is open, so screen readers and Tab stay in the overlay. */
function setBackgroundInert(on: boolean) {
  const root = typeof document !== 'undefined' ? document.getElementById('root') : null;
  if (!root) return;
  if (on) root.setAttribute('inert', '');
  else root.removeAttribute('inert');
}

/**
 * Focus management for sheets and dialogs: moves focus in when opened, keeps Tab inside,
 * and puts focus back on the opener when closed.
 */
export function useModalFocus(
  active: boolean,
  panelRef: RefObject<HTMLElement | null>,
  initialFocusRef?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!active) return;
    const opener = document.activeElement as HTMLElement | null;
    modalCount++;
    setBackgroundInert(true);
    // The panel is committed by now (effects run after the portal mounts).
    const panel = panelRef.current;
    if (panel) (initialFocusRef?.current || focusables(panel)[0] || panel).focus({ preventScroll: true });
    return () => {
      modalCount = Math.max(0, modalCount - 1);
      if (!modalCount) setBackgroundInert(false);
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, [active, panelRef, initialFocusRef]);

  /** Keep Tab / Shift+Tab cycling inside the panel. */
  return useCallback(
    (e: ReactKeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = focusables(panel);
      if (!items.length) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [panelRef],
  );
}

/**
 * Keeps an overlay mounted through its exit transition. Entering uses a CSS keyframe
 * animation (no requestAnimationFrame, which never fires while the page is hidden), so only
 * the exit needs state: `closing` is true for `exitMs` after `open` turns false.
 */
export function usePresence(open: boolean, exitMs = 200): { mounted: boolean; closing: boolean } {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const timer = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(timer);
  }, [open, exitMs]);
  return { mounted: mounted || open, closing: mounted && !open };
}
