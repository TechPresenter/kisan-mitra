// Screen 05 — Home: the farmer's personalised dashboard. Within the first screenful it answers
// today's weather, what to do today (with the farmer's crop price and any recent crop problem),
// then quick actions, my crops, nearby mandi prices, upcoming tasks and a voice shortcut.
// Everything renders from cache instantly (offline-first) and is refreshed in the background.
import './strings';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, MapPin, Search } from 'lucide-react';
import { HeaderPill, OfflineBanner, Screen } from '../../components/ui';
import { BrandLogo } from '../../components/brand/BrandLogo';
import { LanguageSheet } from '../../components/shared/LanguageSheet';
import { LocationSheet } from '../../components/shared/LocationSheet';
import { placeLabel, usePlace, useProfile } from '../../lib/app-state';
import { useOnline } from '../../lib/cache';
import { formatDate, todayISO } from '../../lib/format';
import { useLanguage, useT } from '../../lib/i18n';
import { useNav } from '../../lib/nav';
import { KEYS, useCollection } from '../../lib/store';
import { MANDI_MAX_AGE_MS, defaultCommodities, getMandiSnapshot, useMandi } from '../../services/mandi';
import { useNotifications } from '../../services/notifications';
import { tasksInRange, useTasks } from '../../services/tasks';
import { WEATHER_MAX_AGE_MS, useWeather } from '../../services/weather';
import type { Crop } from '../../types/models';
import { MandiSection } from './MandiSection';
import { MyCropsSection } from './MyCropsSection';
import { QuickActions } from './QuickActions';
import { TasksSection } from './TasksSection';
import { TodaySection } from './TodaySection';
import { useStableNav, useStableResource } from './util';
import { VoiceCta } from './VoiceCta';
import { WeatherAlertBanner, WeatherSection } from './WeatherSection';

/** Open tasks listed under "आने वाले काम". */
const UPCOMING_ROWS = 3;

/** pull = app-bar refresh, retry = any error state's retry, resume = app back in front / back online. */
type SyncReason = 'pull' | 'retry' | 'resume';

const Greeting = memo(function Greeting({ name, today }: { name?: string; today: string }) {
  const t = useT();
  // First name + "जी" is how a farmer is greeted ("नमस्ते, रामू जी").
  const first = name?.trim().split(/\s+/)[0];
  // One line (greeting left, date right) keeps the weather and today's advice higher on the page.
  return (
    <div className="flex items-baseline gap-3">
      <p className="min-w-0 flex-1 truncate text-section leading-snug font-bold text-ink">
        {first ? t('home.greeting', { name: first }) : t('home.greetingNoName')} <span aria-hidden>🙏</span>
      </p>
      <p className="shrink-0 text-small text-ink-2">{formatDate(today, { weekday: true })}</p>
    </div>
  );
});

/**
 * Services build some texts in the language of the moment and memoise them (weather alert titles,
 * spray window, advice lines). Remounting on a language change rebuilds them all from cache, so
 * nothing stays in the old language; no extra weather or price calls are made.
 */
export default function HomeScreen() {
  const { language } = useLanguage();
  return <HomeContent key={language.code} />;
}

function HomeContent() {
  const t = useT();
  const nav = useNav();
  const go = useStableNav(nav);
  const { language } = useLanguage();
  const [place] = usePlace();
  const [profile] = useProfile();
  const { unread } = useNotifications();
  const crops = useCollection<Crop>(KEYS.crops).items;
  const { tasks, setDone } = useTasks();
  const online = useOnline();
  const today = todayISO();

  const weather = useStableResource(useWeather(place));

  // The farmer's own crops (onboarding choices + crop records) lead the price list.
  const profileKeys = profile?.cropKeys;
  const farmerKeys = useMemo(() => {
    const keys: string[] = [];
    for (const k of [...(profileKeys ?? []), ...crops.map(c => c.cropKey)]) if (k && k !== 'other' && !keys.includes(k)) keys.push(k);
    return keys;
  }, [profileKeys, crops]);
  const commodityKeys = useMemo(() => defaultCommodities(farmerKeys), [farmerKeys]);
  const mandi = useStableResource(useMandi(place, commodityKeys));

  // Computed once for both "आने वाले काम" and "आज किसान के लिए" (which skips these tasks).
  const upcoming = useMemo(() => tasksInRange(tasks, 'week', today).slice(0, UPCOMING_ROWS), [tasks, today]);

  const [placeOpen, setPlaceOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  // Remounts "आज किसान के लिए" (see sync).
  const [todayKey, setTodayKey] = useState(0);

  const latest = useRef({ weather, mandi, place, commodityKeys });
  latest.current = { weather, mandi, place, commodityKeys };
  const running = useRef(false);
  const dayRef = useRef(today);

  /**
   * The one refresh path: app-bar refresh, every retry button, app resume and coming back online.
   * - Weather (Open-Meteo, free): fetched again; on resume only when stale or failed.
   * - Mandi (one AI + web search call per refresh): forced only on pull/retry when the prices are
   *   stale or failed; otherwise only crops whose cached price has expired are searched. useMandi
   *   follows the price cache, so the list updates either way.
   * - "आज किसान के लिए": useDailyRecommendations keeps its own copy of the weather resource, and
   *   lib/cache resources do not follow each other's writes. The card is remounted afterwards, so it
   *   re-reads weather from the cache; its AI lines are fetched again only when missing, expired or
   *   failed (never a forced AI call, so repeated taps cannot burn the AI quota).
   */
  const sync = useCallback(async (reason: SyncReason) => {
    if (running.current && reason === 'resume') return;
    running.current = true;
    const { weather: w, mandi: m, place: p, commodityKeys: keys } = latest.current;
    const day = todayISO();
    const newDay = day !== dayRef.current;
    dayRef.current = day;
    // Ages are worked out now, not read from `stale`: that flag dates from the last render, which can
    // be hours ago when the app comes back from the background.
    const now = Date.now();
    const weatherOld = w.fetchedAt == null || now - w.fetchedAt > WEATHER_MAX_AGE_MS;
    const mandiOld = m.fetchedAt != null && now - m.fetchedAt > MANDI_MAX_AGE_MS;
    const weatherDue = reason !== 'resume' || weatherOld || !!w.error;
    const jobs: Promise<unknown>[] = [];
    if (weatherDue) jobs.push(w.refresh());
    if (reason !== 'resume' && (mandiOld || m.error)) jobs.push(m.refresh());
    else if (keys.length) jobs.push(getMandiSnapshot(p, keys).catch(() => undefined));
    if (reason !== 'resume') setSyncing(true);
    try {
      await Promise.allSettled(jobs);
    } finally {
      running.current = false;
      if (reason !== 'resume') setSyncing(false);
      if (weatherDue || newDay) setTodayKey(k => k + 1);
    }
  }, []);

  const refresh = useCallback(() => void sync('pull'), [sync]);
  const retry = useCallback(() => void sync('retry'), [sync]);

  // Home is the home tab's root and can stay mounted for days: catch up when the app comes back to
  // the front (Android resume) and when the network returns.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void sync('resume');
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [sync]);

  const wasOnline = useRef(online);
  useEffect(() => {
    if (online && !wasOnline.current) void sync('resume');
    wasOnline.current = online;
  }, [online, sync]);

  const openWeather = useCallback(() => go.push('weather'), [go]);
  // Place names are stored in Hindi; the English UI uses the English name when we have it.
  const where = language.code === 'en' && place.nameEn ? place.nameEn : placeLabel(place);

  return (
    <Screen
      title={t('home.title')}
      back={false}
      leading={<BrandLogo variant="mark" size={40} alt="" className="ring-2 ring-white/70" />}
      actions={[
        { key: 'search', icon: Search, label: t('common.search'), onPress: () => go.push('search') },
        { key: 'bell', icon: Bell, label: t('ui.notifications'), badge: unread, onPress: () => go.push('notifications') },
      ]}
      onRefresh={refresh}
      refreshing={syncing || weather.refreshing || mandi.refreshing}
      headerContent={
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <HeaderPill icon={MapPin} label={where} onPress={() => setPlaceOpen(true)} ariaLabel={t('home.changePlace', { place: where })} />
          </div>
          {/* The language by name ("हिन्दी ▾"), which first-time users recognise better than an icon. */}
          <div className="shrink-0">
            <HeaderPill
              label={language.label}
              onPress={() => setLangOpen(true)}
              ariaLabel={t('home.changeLanguage', { lang: language.label })}
            />
          </div>
        </div>
      }
    >
      <OfflineBanner />
      <div className="flex flex-col gap-3">
        <Greeting name={profile?.name} today={today} />
        <WeatherSection weather={weather} onOpen={openWeather} onRetry={retry} retrying={syncing} />
        <WeatherAlertBanner weather={weather} onOpen={openWeather} />
      </div>
      <TodaySection
        key={todayKey}
        weather={weather}
        tasks={tasks}
        crops={crops}
        mandi={mandi.data}
        farmerKeys={farmerKeys}
        upcoming={upcoming}
        onRetry={retry}
        retrying={syncing}
        go={go}
      />
      <QuickActions go={go} />
      <MyCropsSection crops={crops} tasks={tasks} today={today} go={go} />
      <MandiSection mandi={mandi} go={go} />
      <TasksSection upcoming={upcoming} crops={crops} setDone={setDone} go={go} />
      <VoiceCta go={go} />

      <LocationSheet open={placeOpen} onClose={() => setPlaceOpen(false)} />
      <LanguageSheet open={langOpen} onClose={() => setLangOpen(false)} />
    </Screen>
  );
}
