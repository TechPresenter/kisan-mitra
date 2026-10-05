// Home: compact "आज का मौसम" sky card (chips, a slim 5-day row, update time and AQI inside the
// card) and a one-line weather alert strip. Kept short on purpose: on a 360×640 phone the
// "आज किसान के लिए" card must still start within the first screenful.
import './strings';
import { memo, useMemo } from 'react';
import { ChevronRight, Clock, CloudRain, Droplets, TriangleAlert, Wind } from 'lucide-react';
import { Badge, Callout, ErrorState, IconButton, Skeleton, WeatherCard, WeatherChip, type IconLike } from '../../components/ui';
import { SunGlyph } from '../../components/illustrations';
import { HOUR, type Resource } from '../../lib/cache';
import { addDays, formatUpdated, formatWeekday } from '../../lib/format';
import { translate, useLanguage, useT } from '../../lib/i18n';
import { aqiInfo, placeToday, weatherCodeInfo } from '../../services/weather';
import type { WeatherAlert, WeatherSnapshot } from '../../types/models';

const FORECAST_DAYS = 5;
/** Once a snapshot is this old (or from another day), its "current" conditions no longer describe now. */
const OUTDATED_AFTER_MS = 3 * HOUR;

export interface WeatherFreshness {
  /** Past its freshness window: the last refresh failed or has not run yet. */
  stale: boolean;
  /** Current conditions are hours old or from another day: show today's forecast instead. */
  outdated: boolean;
}

/**
 * useWeather re-works days, alerts and spray advice for the current time, but `current` stays as it
 * was at fetch time, so an old snapshot must not be shown as "now".
 */
export function weatherFreshness(weather: Pick<Resource<WeatherSnapshot>, 'data' | 'fetchedAt' | 'stale'>, now = Date.now()): WeatherFreshness {
  const { data, fetchedAt } = weather;
  if (!data || fetchedAt == null || !weather.stale) return { stale: false, outdated: false };
  const outdated = now - fetchedAt > OUTDATED_AFTER_MS || placeToday(data, fetchedAt) !== placeToday(data, now);
  return { stale: true, outdated };
}

export interface WeatherSectionProps {
  weather: Resource<WeatherSnapshot>;
  /** Opens the Weather screen. */
  onOpen: () => void;
  /** Home's shared refresh, so the weather card and "आज किसान के लिए" always update together. */
  onRetry: () => void;
  retrying?: boolean;
}

function WeatherSkeleton() {
  const t = useT();
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{t('common.loading')}</span>
      <Skeleton rounded="card" className="h-56 w-full" />
    </div>
  );
}

interface ChipText {
  key: string;
  icon?: IconLike;
  text: string;
  /** Spoken form when the chip text alone is ambiguous. */
  aria?: string;
}

export const WeatherSection = memo(function WeatherSection({ weather, onOpen, onRetry, retrying = false }: WeatherSectionProps) {
  const t = useT();
  const { language } = useLanguage();
  const data = weather.data;
  const busy = retrying || weather.refreshing || weather.loading;

  if (!data) {
    if (weather.error && !weather.loading) {
      return <ErrorState compact title={t('home.weather.errorTitle')} error={weather.error} onRetry={onRetry} retrying={busy} />;
    }
    return <WeatherSkeleton />;
  }

  const { stale, outdated } = weatherFreshness(weather);
  const placeDay = placeToday(data);
  const today = data.daily[0]?.date === placeDay ? data.daily[0] : undefined;
  const tomorrow = data.daily.find(d => d.date === addDays(placeDay, 1));

  // Too old to say anything about today (the whole forecast has run out): ask for a refresh.
  if (outdated && !today) {
    return (
      <ErrorState
        compact
        title={t('home.weather.outdatedTitle')}
        message={t('home.weather.outdatedBody')}
        onRetry={onRetry}
        retrying={busy}
      />
    );
  }

  // Hero: the current reading while it is recent; otherwise today's forecast (max / min), never
  // yesterday evening's temperature presented as "now".
  const cur = data.current;
  const hero =
    outdated && today
      ? {
          title: t('home.weather.forecastTitle'),
          temp: `${Math.round(today.tempMaxC)}° / ${Math.round(today.tempMinC)}°`,
          tempAria: t('home.weather.maxMin', { max: Math.round(today.tempMaxC), min: Math.round(today.tempMinC) }),
          code: today.weatherCode,
          isDay: true,
        }
      : {
          title: t('home.weather.title'),
          temp: `${Math.round(cur.temperatureC)}°C`,
          tempAria: `${Math.round(cur.temperatureC)}°C`,
          code: cur.weatherCode,
          isDay: cur.isDay,
        };
  const info = weatherCodeInfo(hero.code, hero.isDay);
  const cond = t(info.key);
  // Reference style "धूप खिली है (Sunny)": the English word helps farmers who know it from radio/TV.
  const condition = language.code === 'en' || info.key === 'weather.cond.unknown' ? cond : `${cond} (${translate('en', info.key)})`;
  // The illustrated sun suits clear and partly cloudy days; other skies keep the kit glyph.
  const sunny = hero.isDay && (hero.code === 0 || hero.code === 1 || hero.code === 2);

  const chips: ChipText[] = [];
  if (!outdated) {
    chips.push({ key: 'hum', icon: Droplets, text: t('home.weather.humidity', { n: Math.round(cur.humidityPct) }) });
    const wind = Math.round(cur.windKmh);
    chips.push({ key: 'wind', icon: Wind, text: t('home.weather.windShort', { n: wind }), aria: t('home.weather.wind', { n: wind }) });
  }
  if (today) {
    // Icon + value keeps the three chips on one row at 360px; the word is in the card's label.
    const rain = Math.round(today.rainProbabilityPct);
    chips.push({ key: 'rain', icon: CloudRain, text: t('home.weather.rainShort', { n: rain }), aria: t('home.weather.rain', { n: rain }) });
  }

  const aqi = data.aqi != null ? t('home.weather.aqi', { value: Math.round(data.aqi), level: t(aqiInfo(data.aqi).key) }) : undefined;
  const updated = weather.fetchedAt != null ? t('common.lastUpdated', { time: formatUpdated(weather.fetchedAt) }) : undefined;
  const days = data.daily.slice(0, FORECAST_DAYS);

  // The card is one button: its label must carry what sighted farmers read on it.
  const ariaLabel = [
    `${hero.title}: ${hero.tempAria}, ${cond}`,
    chips.map(c => c.aria ?? c.text).join(', '),
    tomorrow
      ? t('home.weather.tomorrowAria', {
          max: Math.round(tomorrow.tempMaxC),
          min: Math.round(tomorrow.tempMinC),
          p: Math.round(tomorrow.rainProbabilityPct),
        })
      : '',
    aqi ?? '',
    updated ?? '',
    stale ? t('common.staleData') : '',
    t('home.weather.openHint'),
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <WeatherCard
      title={hero.title}
      temperature={hero.temp}
      condition={condition}
      code={hero.code}
      isDay={hero.isDay}
      art={sunny ? <SunGlyph size={92} cloud={hero.code === 2} /> : undefined}
      onPress={onOpen}
      ariaLabel={ariaLabel}
      className="py-4"
      chips={chips.map(c => (
        <WeatherChip key={c.key} icon={c.icon}>
          {c.text}
        </WeatherChip>
      ))}
      footer={
        <span className="flex flex-col gap-2 border-t border-white/30 pt-2">
          {days.length > 1 && (
            // One slim line: weekday + day's high (the Weather screen has the full forecast).
            <span className="flex justify-between gap-2 text-caption leading-snug">
              {days.map(d => (
                <span key={d.date} className="flex min-w-0 items-baseline gap-1 whitespace-nowrap">
                  <span className="min-w-0 truncate">{d.date === placeDay ? t('common.today') : formatWeekday(d.date)}</span>
                  <span className="shrink-0 font-bold tabular-nums">{Math.round(d.tempMaxC)}°</span>
                </span>
              ))}
            </span>
          )}
          {/* LastUpdated, in white for the blue card (the kit's grey caption would not be readable here). */}
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption leading-snug">
            {updated && (
              <span className="inline-flex items-center gap-1">
                <Clock aria-hidden className="size-3.5 shrink-0" />
                <span className="pt-0.5">{busy ? t('home.weather.updating') : updated}</span>
              </span>
            )}
            {aqi && <span className="pt-0.5">• {aqi}</span>}
            {stale && <Badge tone="amber">{t('common.staleData')}</Badge>}
          </span>
        </span>
      }
    />
  );
});

/** Alerts that start today or tomorrow at the forecast's place, most urgent first. */
export function soonAlerts(data: WeatherSnapshot | undefined): WeatherAlert[] {
  if (!data || !data.alerts.length) return [];
  const until = addDays(placeToday(data), 1);
  return data.alerts.filter(a => a.date <= until);
}

export interface WeatherAlertBannerProps {
  weather: Resource<WeatherSnapshot>;
  onOpen: () => void;
}

/**
 * One-line amber/red strip for weather alerts that start today or tomorrow at the farmer's place:
 * warning icon + title, the message clamped to one line, and a chevron to the Weather screen.
 */
export const WeatherAlertBanner = memo(function WeatherAlertBanner({ weather, onOpen }: WeatherAlertBannerProps) {
  const t = useT();
  const soon = useMemo(() => soonAlerts(weather.data), [weather.data]);
  if (!soon.length) return null;
  const alert = soon[0];
  const urgent = alert.severity === 'urgent';
  const more = soon.length - 1;
  // Alerts are worked out from the last forecast we have; say so when it could not be refreshed.
  const { stale } = weatherFreshness(weather);
  return (
    <Callout
      tone={urgent ? 'danger' : 'warning'}
      // A small inline icon instead of the 40px badge leaves the title room on a 360px phone.
      icon={null}
      className="py-2"
      title={
        <span className="flex items-center gap-1.5">
          <TriangleAlert aria-hidden className={urgent ? 'size-5 shrink-0 text-tone-red' : 'size-5 shrink-0 text-tone-amber'} />
          <span className="line-clamp-1 min-w-0">
            {alert.title}
            {more > 0 && <span className="font-medium text-ink-2"> {t('home.alert.more', { n: more })}</span>}
          </span>
        </span>
      }
      aside={
        <IconButton
          icon={ChevronRight}
          variant="outline"
          label={more > 0 ? t('home.alert.seeAllAria', { n: soon.length }) : t('home.alert.seeAria')}
          onClick={onOpen}
          className="-mr-1"
        />
      }
    >
      <span className="line-clamp-1">
        {stale && <span className="font-medium">{t('home.alert.oldForecast')}: </span>}
        {alert.message}
      </span>
    </Callout>
  );
});
