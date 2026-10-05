// 07 Weather Details ('weather-day', params { date }): one forecast day — summary card, that day's
// alerts, the best spray windows (services/weather spray rules), day advice and hourly rows.
// Day chips switch between forecast days without leaving the screen. A date outside the forecast
// (past, or beyond 7 days) shows an empty state that leads back to today. When an old cached
// forecast runs out before today or tomorrow is covered, the screen says so and offers a refresh.
import './strings';
import { useCallback, useMemo, useRef, useState } from 'react';
import { CalendarDays, Clock, RefreshCw, SprayCan } from 'lucide-react';
import {
  Button,
  Callout,
  ChipGroup,
  EmptyState,
  ErrorState,
  LastUpdated,
  ListGroup,
  ListenButton,
  OfflineBanner,
  Screen,
  SectionHeader,
  WeatherCard,
} from '../../components/ui';
import { EmptyArt } from '../../components/illustrations';
import { usePlace } from '../../lib/app-state';
import { useOnline } from '../../lib/cache';
import { addDays, daysBetween, formatUpdated, parseISODate, toISODate, todayISO } from '../../lib/format';
import { useLanguage, useT } from '../../lib/i18n';
import { useNav, useRoute } from '../../lib/nav';
import {
  SPRAY_MAX_TEMP_C,
  SPRAY_RAIN_FREE_HOURS,
  SPRAY_WIND_IDEAL_MAX_KMH,
  SPRAY_WIND_IDEAL_MIN_KMH,
  SPRAY_WIND_MAX_KMH,
  deriveAlerts,
  placeToday,
  useWeather,
  weatherCodeInfo,
  type DailyForecastExt,
} from '../../services/weather';
import { useSpeaker } from '../../services/voice';
import type { WeatherSnapshot } from '../../types/models';
import { useTrackWeatherView, useWeatherAutoRefresh } from './hooks';
import {
  clockLabel,
  dayLabel,
  dayTips,
  daySpeech,
  daySprayWindows,
  hoursOn,
  placeHourNow,
  shortDayLabel,
  sprayHourSet,
} from './logic';
import { AlertList, DayChips, DaySkeleton, HourRow, SprayWindowList, TipList } from './parts';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Speech started on this screen (summary, or an alert of the shown day). */
const SPEECH_ID = 'weather-day';

/** A real calendar date: "2026-02-30" or "2026-13-01" would roll over to another day. */
const isRealDate = (d: unknown): d is string =>
  typeof d === 'string' && ISO_DATE.test(d) && toISODate(parseISODate(d)) === d;

export default function WeatherDayScreen() {
  const t = useT();
  const nav = useNav();
  const online = useOnline();
  const { params } = useRoute<{ date?: unknown }>();
  const [place] = usePlace();
  const { language } = useLanguage();
  const placeName = language.code === 'en' ? place.nameEn || place.name : place.name;
  const res = useWeather(place);
  const w = res.data;
  const { speakingId, stop } = useSpeaker();
  const scrollRef = useRef<HTMLDivElement>(null);
  // Day chips switch the day in place; the route param is only the starting day (else today).
  const [date, setDate] = useState<string>(() => (isRealDate(params.date) ? params.date : ''));

  useTrackWeatherView('day');
  useWeatherAutoRefresh(res, online);

  const now = useMemo(() => Date.now(), [w]);
  const today = useMemo(() => (w ? placeToday(w, now) : todayISO()), [w, now]);
  const selected = date || today;
  const isToday = selected === today;
  const day = w?.daily.find(d => d.date === selected) as DailyForecastExt | undefined;
  const hours = useMemo(() => (w ? hoursOn(w.hourly, selected) : []), [w, selected]);
  // language.code: window labels and alert texts are written with tNow in the current language.
  const spray = useMemo(
    () => (w && day ? daySprayWindows(selected, w.daily, w.hourly, now) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [w, day, selected, now, language.code],
  );
  const sprayHours = useMemo(() => sprayHourSet(spray?.windows ?? []), [spray]);
  // Alerts worked out for this day alone, with the same IMD rules as the overview.
  const alerts = useMemo(
    () =>
      w && day
        ? deriveAlerts([day], w.hourly, { elevationM: (w as WeatherSnapshot & { elevationM?: number }).elevationM })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [w, day, language.code],
  );
  const nowHour = w && isToday ? placeHourNow(w, now) : undefined;
  const tips = useMemo(() => (day ? dayTips(day, hours, t, nowHour) : []), [day, hours, t, nowHour]);
  const label = dayLabel(selected, today, t);
  const speech = useMemo(
    () => (day && spray ? daySpeech(day, label, placeName, spray, alerts, t) : ''),
    [day, spray, label, placeName, alerts, t],
  );
  const dayOptions = useMemo(
    () => (w ? w.daily.map(d => ({ value: d.date, label: shortDayLabel(d.date, today, t) })) : []),
    [w, today, t],
  );

  // Switching days: stop speech about the old day and start the new day from the top.
  const selectDay = useCallback(
    (next: string) => {
      if (next === selected) return;
      if (speakingId === SPEECH_ID || speakingId?.startsWith('weather-alert-')) stop();
      setDate(next);
      scrollRef.current?.scrollTo({ top: 0 });
    },
    [selected, speakingId, stop],
  );

  const goOverview = useCallback(() => {
    if (nav.stack[nav.stack.length - 2]?.screen === 'weather') nav.pop();
    else nav.replace('weather');
  }, [nav]);

  const tomorrow = addDays(today, 1);
  const tomorrowKnown = !!w?.daily.some(d => d.date === tomorrow);
  const refreshFailed = !!res.error && online && res.fetchedAt != null && (
    <ErrorState
      compact
      error={res.error}
      title={t('weather.refreshFailed.title')}
      message={t('weather.refreshFailed.body', { time: formatUpdated(res.fetchedAt) })}
      onRetry={res.refresh}
      retrying={res.refreshing}
    />
  );

  let body;
  if (w && day && spray) {
    const info = weatherCodeInfo(day.weatherCode, true);
    const max = Math.round(day.tempMaxC);
    const min = Math.round(day.tempMinC);
    const rise = clockLabel(day.sunrise);
    const set = clockLabel(day.sunset);
    // Hourly data reaches ~2 days ahead. Missing hours for today or tomorrow mean the cached
    // forecast is old (not that the forecast is "not out yet"), and a refresh will bring them.
    const oldData = res.stale && daysBetween(today, selected) <= 1;
    const oldGap = oldData && (hours.length === 0 || spray.status === 'noData' || spray.partial);
    body = (
      <>
        <ChipGroup ariaLabel={t('weather.day.pick')} value={selected} onChange={selectDay} options={dayOptions} />

        <div className="flex items-center gap-3">
          <LastUpdated at={res.fetchedAt} stale={res.stale} refreshing={res.refreshing} className="min-w-0 flex-1" />
          <ListenButton id={SPEECH_ID} text={speech} />
        </div>
        {refreshFailed}
        {oldGap && (
          <Callout
            tone="warning"
            icon={Clock}
            action={
              refreshFailed ? undefined : (
                <Button variant="secondary" icon={RefreshCw} loading={res.refreshing} onClick={() => void res.refresh()}>
                  {t('common.refresh')}
                </Button>
              )
            }
          >
            {t('weather.day.oldData')}
          </Callout>
        )}

        <WeatherCard
          title={label}
          temperature={
            <>
              <span aria-hidden>
                {max}°<span className="text-[1.75rem] font-semibold"> / {min}°</span>
              </span>
              <span className="sr-only">{t('weather.day.maxMin', { max, min })}</span>
            </>
          }
          condition={t(info.key)}
          code={day.weatherCode}
          isDay
          chips={<DayChips day={day} />}
          footer={rise && set ? t('weather.day.sunTimes', { rise, set }) : undefined}
        />

        <AlertList alerts={alerts} title={t('weather.day.alerts')} />

        <section className="flex flex-col gap-3">
          <SectionHeader title={t('weather.day.spray.title')} icon={SprayCan} />
          {spray.status === 'ok' && <SprayWindowList windows={spray.windows} bestStartIso={spray.bestStartIso} />}
          {spray.status === 'blocked' && spray.blocker && (
            <Callout tone="warning">{t('weather.day.spray.none', { why: t(`weather.spray.why.${spray.blocker}`) })}</Callout>
          )}
          {spray.status === 'passed' && (
            <Callout
              tone="neutral"
              icon={Clock}
              action={
                tomorrowKnown && isToday ? (
                  <Button variant="secondary" icon={CalendarDays} onClick={() => selectDay(tomorrow)}>
                    {t('weather.sprayCard.seeTomorrow')}
                  </Button>
                ) : undefined
              }
            >
              {t('weather.day.spray.passed')}
            </Callout>
          )}
          {spray.status === 'noData' && (
            <Callout tone="info">{t(oldData ? 'weather.day.spray.noDataOld' : 'weather.day.spray.noData')}</Callout>
          )}
          {spray.partial && spray.status !== 'noData' && (
            <p className="px-1 text-caption text-ink-2">
              {t(oldData ? 'weather.day.spray.partialOld' : 'weather.day.spray.partial')}
            </p>
          )}
          <p className="px-1 text-caption text-ink-2">
            {t('weather.day.spray.rules', {
              hours: SPRAY_RAIN_FREE_HOURS,
              min: SPRAY_WIND_IDEAL_MIN_KMH,
              max: SPRAY_WIND_IDEAL_MAX_KMH,
              limit: SPRAY_WIND_MAX_KMH,
              temp: SPRAY_MAX_TEMP_C,
            })}
          </p>
        </section>

        <TipList tips={tips} title={t('weather.day.tips.title')} onOpenDoctor={() => nav.push('crop-doctor')} />

        <section className="flex flex-col gap-3">
          <SectionHeader
            title={t('weather.day.hourly.title')}
            subtitle={isToday ? t('weather.day.hourly.remaining') : undefined}
            icon={Clock}
          />
          {hours.length > 0 ? (
            <ListGroup ariaLabel={t('weather.day.hourly.title')}>
              {hours.map(h => (
                <HourRow key={h.time} h={h} daily={w.daily} sprayOk={sprayHours.has(Date.parse(h.time))} />
              ))}
            </ListGroup>
          ) : (
            <Callout tone="info" icon={Clock}>
              {t(oldData ? 'weather.day.hourly.noneOld' : 'weather.day.hourly.none')}
            </Callout>
          )}
        </section>
      </>
    );
  } else if (w && w.daily.length === 0) {
    // Every cached day has passed: nothing on this screen would be current.
    body = (
      <>
        <LastUpdated at={res.fetchedAt} stale refreshing={res.refreshing} />
        {refreshFailed}
        <EmptyState
          art={<EmptyArt kind="calendar" tone="sky" />}
          title={t('weather.daily.empty.title')}
          body={t('weather.daily.empty.body')}
          action={{ label: t('common.refresh'), icon: RefreshCw, onPress: () => void res.refresh() }}
        />
      </>
    );
  } else if (w) {
    // The date is not in the forecast: in the past, or beyond the 7 days.
    const past = selected < today;
    body = (
      <>
        {dayOptions.length > 0 && (
          <ChipGroup ariaLabel={t('weather.day.pick')} value={selected} onChange={selectDay} options={dayOptions} />
        )}
        <EmptyState
          art={<EmptyArt kind="calendar" tone="sky" />}
          title={past ? t('weather.day.past.title') : t('weather.day.empty.title')}
          body={t('weather.day.empty.body')}
          action={{ label: t('weather.day.empty.today'), icon: CalendarDays, onPress: () => selectDay(w.daily[0].date) }}
          secondaryAction={{ label: t('weather.day.empty.overview'), onPress: goOverview }}
        />
      </>
    );
  } else if (res.error && !res.loading) {
    body = <ErrorState error={res.error} onRetry={res.refresh} retrying={res.refreshing} />;
  } else {
    body = <DaySkeleton />;
  }

  return (
    <Screen
      title={w && w.daily.length > 0 ? label : t('weather.title')}
      subtitle={t('weather.day.subtitle', { place: placeName })}
      onRefresh={res.refresh}
      refreshing={res.refreshing}
      scrollRef={scrollRef}
    >
      {/* Only with saved data on screen: "showing saved information" would contradict an empty error. */}
      {w && <OfflineBanner />}
      {body}
    </Screen>
  );
}
