// Stack navigation per bottom tab (no URL router: this is a Capacitor app).
// Each tab keeps its own history; the Android back button pops it (see app/AppShell.tsx).
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { NavTarget } from '../types/models';
import { track } from './analytics';

export type TabKey = 'home' | 'mandi' | 'kheti' | 'ai' | 'profile';

export const TAB_ROOTS: Record<TabKey, string> = {
  home: 'home',
  mandi: 'mandi',
  kheti: 'kheti',
  ai: 'ai',
  profile: 'profile',
};

export interface Route {
  key: string;
  screen: string;
  params: Record<string, any>;
}

export interface NavApi {
  tab: TabKey;
  /** Routes of the active tab, root first. */
  stack: Route[];
  /** Topmost route of the active tab. */
  route: Route;
  canGoBack: boolean;
  /** Open a screen on top of the active tab. */
  push: (screen: string, params?: Record<string, any>) => void;
  /** Replace the topmost screen (e.g. add-crop form → crop details after saving). */
  replace: (screen: string, params?: Record<string, any>) => void;
  /** Returns false when already at the tab root. */
  pop: () => boolean;
  popToRoot: () => void;
  /** Switch tabs; optionally open `target` on top of that tab's root. */
  switchTab: (tab: TabKey, target?: NavTarget) => void;
  /** Open a stored target (notification, saved item, search hit) on the active tab. */
  open: (target: NavTarget) => void;
}

let keySeq = 0;
const makeRoute = (screen: string, params: Record<string, any> = {}): Route => ({
  key: `${screen}-${++keySeq}`,
  screen,
  params,
});

const initialStacks = (): Record<TabKey, Route[]> => ({
  home: [makeRoute(TAB_ROOTS.home)],
  mandi: [makeRoute(TAB_ROOTS.mandi)],
  kheti: [makeRoute(TAB_ROOTS.kheti)],
  ai: [makeRoute(TAB_ROOTS.ai)],
  profile: [makeRoute(TAB_ROOTS.profile)],
});

/** Which tab a screen naturally belongs to when opened from a notification/search. */
const TAB_OF_ROOT: Record<string, TabKey> = {
  home: 'home',
  mandi: 'mandi',
  kheti: 'kheti',
  ai: 'ai',
  profile: 'profile',
};

const NavContext = createContext<NavApi | null>(null);
const RouteContext = createContext<Route | null>(null);

export function NavProvider({ children }: { children: React.ReactNode }) {
  const [tab, setTab] = useState<TabKey>('home');
  const [stacks, setStacks] = useState(initialStacks);

  const push = useCallback(
    (screen: string, params?: Record<string, any>) => {
      track('screen_view', { screen });
      setStacks(s => ({ ...s, [tab]: [...s[tab], makeRoute(screen, params)] }));
    },
    [tab],
  );

  const replace = useCallback(
    (screen: string, params?: Record<string, any>) => {
      track('screen_view', { screen });
      setStacks(s => {
        const stack = s[tab];
        // Never replace a tab's root screen; at the root this behaves like push.
        const base = stack.length > 1 ? stack.slice(0, -1) : stack;
        return { ...s, [tab]: [...base, makeRoute(screen, params)] };
      });
    },
    [tab],
  );

  const pop = useCallback(() => {
    if (stacks[tab].length <= 1) return false;
    setStacks(s => (s[tab].length <= 1 ? s : { ...s, [tab]: s[tab].slice(0, -1) }));
    return true;
  }, [tab, stacks]);

  const popToRoot = useCallback(() => {
    setStacks(s => ({ ...s, [tab]: s[tab].slice(0, 1) }));
  }, [tab]);

  const switchTab = useCallback((next: TabKey, target?: NavTarget) => {
    track('tab_view', { tab: next });
    setTab(next);
    if (target) {
      setStacks(s => ({
        ...s,
        [next]: target.screen === TAB_ROOTS[next] ? [makeRoute(target.screen, target.params as any)] : [s[next][0], makeRoute(target.screen, target.params as any)],
      }));
    }
  }, []);

  const open = useCallback(
    (target: NavTarget) => {
      const rootTab = TAB_OF_ROOT[target.screen];
      if (rootTab) {
        switchTab(rootTab, target);
        return;
      }
      push(target.screen, target.params as any);
    },
    [push, switchTab],
  );

  const stack = stacks[tab];
  const api = useMemo<NavApi>(
    () => ({
      tab,
      stack,
      route: stack[stack.length - 1],
      canGoBack: stack.length > 1,
      push,
      replace,
      pop,
      popToRoot,
      switchTab,
      open,
    }),
    [tab, stack, push, replace, pop, popToRoot, switchTab, open],
  );

  return <NavContext.Provider value={api}>{children}</NavContext.Provider>;
}

export function useNav(): NavApi {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used inside <NavProvider>');
  return ctx;
}

/** Provided by the shell around each rendered screen. */
export function RouteProvider({ route, children }: { route: Route; children: React.ReactNode }) {
  return <RouteContext.Provider value={route}>{children}</RouteContext.Provider>;
}

/** The route the current screen was opened with (params live in `route.params`). */
export function useRoute<P extends Record<string, any> = Record<string, any>>(): { screen: string; params: P; key: string } {
  const ctx = useContext(RouteContext);
  if (!ctx) throw new Error('useRoute must be used inside a screen');
  return ctx as { screen: string; params: P; key: string };
}

/** True when this screen is the visible (topmost) one — pause polling/animations otherwise. */
export function useIsActiveScreen(): boolean {
  const nav = useContext(NavContext);
  const route = useContext(RouteContext);
  return !!nav && !!route && nav.route.key === route.key;
}
