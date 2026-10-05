// App shell: applies theme/accessibility settings, gates auth → onboarding → main app,
// renders the active tab's screen stack with the bottom navigation, and wires the
// Android back button, reminder taps and app-level hosts (toasts, dialogs).
import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { Home, Sparkles, Sprout, TrendingUp, UserRound } from 'lucide-react';
import { App as CapacitorApp } from '@capacitor/app';
import { BottomNav, DialogHost, Toaster, SkeletonCard, SkeletonText, useApplyAppearance } from '../components/ui';
import { useProfile, useSession, useSettings } from '../lib/app-state';
import { runBackHandlers } from '../lib/back';
import { useT } from '../lib/i18n';
import { NavProvider, RouteProvider, useNav, type TabKey } from '../lib/nav';
import { track } from '../lib/analytics';
import { isNative, syncSystemBars } from '../services/native';
import { flushDueWebReminders, onReminderTapped } from '../services/reminders';
import { runStartupChecks } from '../services/startup';
import { SCREENS } from './registry';
import './strings';

const AuthFlow = lazy(() => import('../screens/auth/AuthFlow'));
const OnboardingFlow = lazy(() => import('../screens/onboarding/OnboardingFlow'));

/** The handler the Android back button should run right now (set by whichever view is active). */
const backAction = { current: () => {} };

/** Theme / contrast / text size via the kit; language + direction on <html>. */
function useAppliedSettings() {
  useApplyAppearance();
  const [settings] = useSettings();
  useEffect(() => {
    const root = document.documentElement;
    root.lang = settings.languageCode;
    root.dir = ['ur', 'sd'].includes(settings.languageCode) ? 'rtl' : 'ltr';
  }, [settings.languageCode]);
  return settings;
}

function ScreenFallback() {
  return (
    <div className="h-full bg-canvas">
      <div className="bg-brand-900 safe-pt pt-4 pb-5 px-4">
        <div className="h-6 w-40 rounded-lg bg-white/20" />
      </div>
      <div className="p-4 space-y-4">
        <SkeletonCard />
        <SkeletonText lines={3} />
        <SkeletonCard />
      </div>
    </div>
  );
}

function TabStack() {
  const nav = useNav();
  return (
    <>
      {nav.stack.map((route, i) => {
        const Screen = SCREENS[route.screen] || SCREENS.home;
        const isTop = i === nav.stack.length - 1;
        return (
          <div key={route.key} className="absolute inset-0" hidden={!isTop} aria-hidden={!isTop}>
            <RouteProvider route={route}>
              <Suspense fallback={<ScreenFallback />}>
                <Screen />
              </Suspense>
            </RouteProvider>
          </div>
        );
      })}
    </>
  );
}

function MainApp() {
  const nav = useNav();
  const t = useT();
  const [settings] = useSettings();

  backAction.current = () => {
    if (runBackHandlers()) return;
    if (nav.pop()) return;
    if (nav.tab !== 'home') {
      nav.switchTab('home');
      return;
    }
    CapacitorApp.exitApp();
  };

  useEffect(() => {
    syncSystemBars(settings.theme === 'light');
  }, [settings.theme]);

  useEffect(() => onReminderTapped(target => nav.open(target)), [nav.open]);

  useEffect(() => {
    flushDueWebReminders();
    runStartupChecks();
  }, []);

  const items = [
    { key: 'home', label: t('shell.tab.home'), icon: Home },
    { key: 'mandi', label: t('shell.tab.mandi'), icon: TrendingUp },
    { key: 'kheti', label: t('shell.tab.kheti'), icon: Sprout },
    { key: 'ai', label: t('shell.tab.ai'), icon: Sparkles, highlight: true },
    { key: 'profile', label: t('shell.tab.profile'), icon: UserRound },
  ];

  return (
    <div className="relative h-full w-full max-w-[34rem] mx-auto bg-canvas overflow-hidden">
      <main className="absolute inset-0">
        <TabStack />
      </main>
      <BottomNav
        ariaLabel={t('shell.nav')}
        items={items}
        active={nav.tab}
        onSelect={(key: string) => {
          if (key === nav.tab) nav.popToRoot();
          else nav.switchTab(key as TabKey);
        }}
      />
    </div>
  );
}

function AuthGate() {
  const [session] = useSession();
  const [profile] = useProfile();

  if (!session.loggedIn) {
    backAction.current = () => {
      if (!runBackHandlers()) CapacitorApp.exitApp();
    };
    return (
      <Suspense fallback={<div className="h-full bg-brand-900" />}>
        <AuthFlow onDone={() => {}} />
      </Suspense>
    );
  }

  if (!profile?.onboardedAt) {
    backAction.current = () => {
      if (!runBackHandlers()) CapacitorApp.exitApp();
    };
    return (
      <Suspense fallback={<div className="h-full bg-canvas" />}>
        <OnboardingFlow onDone={() => {}} />
      </Suspense>
    );
  }

  return (
    <NavProvider>
      <MainApp />
    </NavProvider>
  );
}

export default function AppShell() {
  useAppliedSettings();
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    track('app_open');
    // Android hardware back; Escape closes overlays on the web.
    const listener = isNative ? CapacitorApp.addListener('backButton', () => backAction.current()) : null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') runBackHandlers();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      listener?.then(l => l.remove());
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const [session] = useSession();
  const [profile] = useProfile();
  const inMainApp = session.loggedIn && !!profile?.onboardedAt;
  return (
    <div className="h-full bg-canvas text-ink">
      <AuthGate />
      <Toaster offset={inMainApp ? 'nav' : 'bottom'} />
      <DialogHost />
    </div>
  );
}
