// 06 Weather (reference screen 10): current conditions over an illustrated sky, farm alerts, the
// next 24 hours, 7 days, today's spray verdict, rule-based farm tips and sun / UV / air.
// Offline-first through useWeather: the cached forecast renders instantly, re-viewed against the
// clock, and is labelled with its fetch time when it is older than 30 minutes. A stale forecast
// never shows its old "current" reading as now: the hero switches to this hour's forecast.
import './strings';
import { useCallback, useMemo, useState } from 'react';
import { Clock, MapPin, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  Button,
  EmptyState,
  ErrorState,
  LastUpdated,
  ListenButton,
  OfflineBanner,
  Screen,
  SectionHeader,
} from '../../components/ui';
import { EmptyArt } from '../../components/illustrations';
import { LocationSheet } from '../../components/shared/LocationSheet';
import { placeLabel, usePlace } from '../../lib/app-state';
import { useOnline } from '../../lib/cache';
import { addDays, formatUpdated, todayISO } from '../../lib/format';
import { useLanguage, useT } from '../../lib/i18n';
import { useNav } from '../../lib/nav';
import { placeToday, useWeather, weatherView } from '../../services/weather';
import { useTrackWeatherView, useWeatherAutoRefresh } from './hooks';
import { daySprayWindows, forecastTips, heroReading, isSprayNoData, overviewSpeech, todayOf } from './logic';
import {
  AlertList,
  CurrentHero,
  DailyList,
  HourlyStrip,
  OverviewSkeleton,
  PlaceholderHero,
  SprayCard,
  SunAirSection,
  TipList,
  TodayChips,
} from './parts';

export default function WeatherScreen() {
  const t = useT();
  const nav = useNav();
  const online = useOnline();
  const [place] = usePlace();
  const { language } = useLanguage();
  const res = useWeather(place);
  const [placeOpen, setPlaceOpen] = useState(false);

  useTrackWeatherView('overview');
  useWeatherAutoRefresh(res, online);

  const english = language.code === 'en';
  const label = english && place.nameEn ? place.nameEn : placeLabel(place);
  const spokenPlace = english ? place.nameEn || place.name : place.name;
  // useWeather rebuilds `data` every 15 minutes, so "now" and "today" move with it.
  const now = useMemo(() => Date.now(), [res.data]);
  // Re-viewed here as well: the service writes spray advice and alerts in the language of the moment
  // (tNow), and its own view only follows the clock, not a language switch made in Profile.
  const w = useMemo(
    () => (res.data ? weatherView(res.data, now) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [res.data, now, language.code],
  );
  const today = useMemo(() => (w ? placeToday(w, now) : todayISO()), [w, now]);
  const td = w ? todayOf(w, today) : undefined;
  const reading = useMemo(() => (w ? heroReading(w, res.stale, now, td) : undefined), [w, res.stale, now, td]);
  const hours24 = useMemo(() => (w ? w.hourly.slice(0, 24) : []), [w]);
  const tips = useMemo(
    () => (w ? forecastTips(w, today, t, now, reading?.kind === 'day' ? undefined : reading?.weatherCode) : []),
    [w, today, t, now, reading],
  );
  const staleTime = w && res.stale && res.fetchedAt ? formatUpdated(res.fetchedAt) : undefined;
  const speech = useMemo(
    () => (w && reading ? overviewSpeech(w, reading, spokenPlace, today, t, { staleTime }) : ''),
    [w, reading, spokenPlace, today, t, staleTime],
  );

  const openPlace = useCallback(() => setPlaceOpen(true), []);
  const openDay = useCallback((date: string) => nav.push('weather-day', { date }), [nav.push]);
  const openDoctor = useCallback(() => nav.push('crop-doctor'), [nav.push]);
  const refresh = res.refresh;

  // Today's and tomorrow's windows with the service's rules: they tell a "no data" answer apart
  // from "don't spray", and pick where the card's button leads.
  const spray = useMemo(() => {
    if (!w) return null;
    const tomorrow = addDays(today, 1);
    const todayStatus = daySprayWindows(today, w.daily, w.hourly, now).status;
    const tomorrowStatus = daySprayWindows(tomorrow, w.daily, w.hourly, now).status;
    // Card button: today's windows, tomorrow's suggested window, or — when neither day works —
    // the hourly view of the day that is still ahead.
    const link = w.spray.suitable
      ? { date: today, key: 'weather.sprayCard.seeToday' }
      : w.spray.bestWindow
        ? { date: tomorrow, key: 'weather.sprayCard.seeTomorrow' }
        : todayStatus === 'passed'
          ? { date: tomorrow, key: 'weather.sprayCard.hourlyTomorrow' }
          : { date: today, key: 'weather.sprayCard.hourlyToday' };
    return {
      noData: isSprayNoData(w.spray, todayStatus, tomorrowStatus),
      link: w.daily.some(d => d.date === link.date) ? link : null,
    };
  }, [w, today, now]);

  // A forecast so old that every day has passed says nothing about now: ask for a refresh instead.
  const outdated = !!w && w.daily.length === 0;
  const refreshFailed = !!res.error && online && res.fetchedAt != null && (
    <ErrorState
      compact
      error={res.error}
      title={t('weather.refreshFailed.title')}
      message={t('weather.refreshFailed.body', { time: formatUpdated(res.fetchedAt) })}
      onRetry={refresh}
      retrying={res.refreshing}
    />
  );

  const sprayLink = spray?.link;

  let hero;
  let body;
  if (w && reading && spray && !outdated) {
    hero = <CurrentHero reading={reading} today={td} placeLabel={label} onPlace={openPlace} staleTime={staleTime} />;
    body = (
      <>
        <div className="flex items-center gap-3">
          <LastUpdated at={res.fetchedAt} stale={res.stale} refreshing={res.refreshing} className="min-w-0 flex-1" />
          <ListenButton id="weather-summary" text={speech} />
        </div>
        {refreshFailed}
        <TodayChips day={td} aqi={w.aqi} />

        {w.alerts.length > 0 ? (
          <AlertList alerts={w.alerts} title={t('weather.alerts.title')} />
        ) : (
          <p className="flex items-center gap-2 px-1 text-small text-ink-2">
            <ShieldCheck aria-hidden className="size-5 shrink-0 text-brand" strokeWidth={2.25} />
            <span className="pt-0.5">{t('weather.alerts.none')}</span>
          </p>
        )}

        <section className="flex flex-col gap-3">
          <SectionHeader title={t('weather.hourly.title')} icon={Clock} />
          {hours24.length > 0 ? (
            <HourlyStrip hours={hours24} daily={w.daily} today={today} now={now} />
          ) : (
            <EmptyState
              compact
              icon={Clock}
              tone="sky"
              title={t('weather.hourly.empty')}
              action={{ label: t('common.refresh'), icon: RefreshCw, onPress: () => void refresh() }}
            />
          )}
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeader title={t('weather.daily.title')} subtitle={t('weather.daily.hint')} />
          <DailyList days={w.daily} today={today} onOpen={openDay} />
        </section>

        <SprayCard
          spray={w.spray}
          noData={spray.noData}
          onSeeTimes={sprayLink ? () => openDay(sprayLink.date) : undefined}
          seeLabel={sprayLink ? t(sprayLink.key) : undefined}
        />

        <TipList tips={tips} title={t('weather.tips.title')} subtitle={t('weather.tips.subtitle')} onOpenDoctor={openDoctor} />

        <SunAirSection day={td} aqi={w.aqi} />
      </>
    );
  } else if (outdated) {
    hero = <PlaceholderHero placeLabel={label} onPlace={openPlace} loading={false} />;
    body = (
      <>
        <LastUpdated at={res.fetchedAt} stale refreshing={res.refreshing} />
        {refreshFailed}
        <EmptyState
          art={<EmptyArt kind="calendar" tone="sky" />}
          title={t('weather.daily.empty.title')}
          body={t('weather.daily.empty.body')}
          action={{ label: t('common.refresh'), icon: RefreshCw, onPress: () => void refresh() }}
        />
      </>
    );
  } else if (res.error && !res.loading) {
    hero = <PlaceholderHero placeLabel={label} onPlace={openPlace} loading={false} />;
    body = (
      <>
        <ErrorState error={res.error} onRetry={refresh} retrying={res.refreshing} />
        <Button variant="secondary" icon={MapPin} className="mx-auto w-full max-w-xs" onClick={openPlace}>
          {t('weather.place.action')}
        </Button>
      </>
    );
  } else {
    hero = <PlaceholderHero placeLabel={label} onPlace={openPlace} loading />;
    body = <OverviewSkeleton />;
  }

  return (
    <>
      <Screen tone="hero" title={t('weather.title')} onRefresh={refresh} refreshing={res.refreshing} hero={hero}>
        {/* Only with saved data on screen: "showing saved information" would contradict an empty error. */}
        {w && <OfflineBanner />}
        {body}
      </Screen>
      <LocationSheet open={placeOpen} onClose={() => setPlaceOpen(false)} />
    </>
  );
}
