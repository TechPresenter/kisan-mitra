// Building blocks shared by the Weather (06) and Weather Details (07) screens. Everything is made
// from the UI kit; these only arrange it for weather data.
import { memo, useMemo, type ReactNode } from 'react';
import {
  Bug,
  CalendarClock,
  ChevronDown,
  CircleCheck,
  Clock,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudRainWind,
  Droplet,
  Droplets,
  Info,
  Leaf,
  MapPin,
  Snowflake,
  Sprout,
  SunMedium,
  Sunrise,
  Sunset,
  ThermometerSnowflake,
  ThermometerSun,
  TriangleAlert,
  Wind,
} from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  ListGroup,
  ListRow,
  ListenButton,
  SectionHeader,
  Skeleton,
  SkeletonList,
  StatCard,
  ToneIcon,
  WeatherChip,
  WeatherGlyph,
  cx,
  type IconLike,
  type Tone,
} from '../../components/ui';
import { SkyScene } from '../../components/illustrations';
import { HOUR } from '../../lib/cache';
import { formatNumber } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { aqiInfo, weatherCodeInfo, type DailyForecastExt, type WeatherScene } from '../../services/weather';
import type { DailyForecast, HourlyForecast, SprayAdvice, WeatherAlert, WeatherAlertKind } from '../../types/models';
import {
  UV_TONE,
  clockLabel,
  conditionKey,
  dayLabel,
  hourLabel,
  isDaylightHour,
  localHourOf,
  notableGust,
  shortDayLabel,
  speechify,
  splitAlertMessage,
  uvLevel,
  type FarmTip,
  type HeroReading,
  type SprayWindow,
  type TipKind,
  type UvLevel,
} from './logic';
import './strings';

// ---------- Hero ----------

/**
 * Full-bleed header for Screen tone="hero". With a scene it draws the SkyScene (text stays in the
 * left 62%, fields kept clear by pb-16); without one it is the plain bg-weather block used while
 * loading or after an error.
 */
export function HeroShell({ scene, night, children }: { scene?: WeatherScene; night?: boolean; children: ReactNode }) {
  return (
    <div className={cx('relative overflow-hidden text-white', !scene && 'bg-weather')}>
      {scene && <SkyScene condition={scene} night={night} className="absolute inset-0 size-full" />}
      <div className={cx('relative appbar-pt px-4', scene ? 'pb-16' : 'pb-8')}>{children}</div>
    </div>
  );
}

/** "📍 वाराणसी, उत्तर प्रदेश ▾" on the sky: opens the LocationSheet. */
export function PlaceButton({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={t('weather.place.change', { place: label })}
      className="press mt-1 inline-flex min-h-12 max-w-[85%] items-center gap-1.5 rounded-full bg-black/25 px-3.5 text-small font-semibold text-white"
    >
      <MapPin aria-hidden className="size-4.5 shrink-0" strokeWidth={2.25} />
      <span className="min-w-0 truncate pt-0.5 leading-snug">{label}</span>
      <ChevronDown aria-hidden className="size-4 shrink-0" strokeWidth={2.5} />
    </button>
  );
}

export interface CurrentHeroProps {
  /** What may be shown as "now": the fresh reading, this hour's forecast, or only today's summary. */
  reading: HeroReading;
  today?: DailyForecastExt;
  placeLabel: string;
  onPlace: () => void;
  /** "आज 10:30 AM" when the data is older than its freshness window. */
  staleTime?: string;
}

/**
 * Weather screen header: place, big temperature, condition, feels-like / "this hour's forecast",
 * today's range and the humidity / wind chips. Everything but the place pill stays in the left 62%
 * of the sky, the band whose white-text contrast docs/ILLUSTRATIONS.md measured; today's rain
 * chance and AQI live in the body (TodayChips) so the chip row never runs over the sun or clouds.
 */
export function CurrentHero({ reading: r, today, placeLabel, onPlace, staleTime }: CurrentHeroProps) {
  const t = useT();
  const info = weatherCodeInfo(r.weatherCode, r.isDay);
  const range = today ? t('weather.hero.todayRange', { min: Math.round(today.tempMinC), max: Math.round(today.tempMaxC) }) : null;
  const subline = (
    r.kind === 'current'
      ? [r.feelsLikeC != null ? t('weather.hero.feelsLike', { temp: Math.round(r.feelsLikeC) }) : null, range]
      : r.kind === 'hour'
        ? [t('weather.hero.forecastNow'), range]
        : [t('weather.hero.todayForecast')]
  ).filter(Boolean);
  const gust = r.windKmh != null ? notableGust(r.windKmh, r.windGustKmh) : undefined;

  let big: ReactNode;
  if (r.temperatureC != null) {
    big = `${Math.round(r.temperatureC)}°C`;
  } else if (today) {
    const max = Math.round(today.tempMaxC);
    const min = Math.round(today.tempMinC);
    big = (
      <>
        <span aria-hidden>
          {max}°<span className="text-[1.75rem] font-semibold"> / {min}°</span>
        </span>
        <span className="sr-only">{t('weather.day.maxMin', { max, min })}</span>
      </>
    );
  }

  return (
    <HeroShell scene={info.scene} night={!r.isDay}>
      <PlaceButton label={placeLabel} onPress={onPlace} />
      <div className="mt-4 max-w-[62%]">
        {big != null && <p className="text-[2.75rem] leading-none font-bold">{big}</p>}
        <p className="mt-2 text-body leading-snug font-semibold">{t(info.key)}</p>
        {subline.length > 0 && <p className="mt-1 text-small leading-snug">{subline.join(' · ')}</p>}
        {staleTime && (
          <div className="mt-3">
            {/* May wrap to two lines ("बीता कल 10:30 PM की जानकारी") instead of losing the time. */}
            <WeatherChip icon={Clock} className="py-1 [&>span:last-child]:whitespace-normal">
              {t('weather.hero.stale', { time: staleTime })}
            </WeatherChip>
          </div>
        )}
        {(r.humidityPct != null || r.windKmh != null) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {r.humidityPct != null && <WeatherChip icon={Droplets}>{t('weather.chip.humidity', { n: r.humidityPct })}</WeatherChip>}
            {r.windKmh != null && <WeatherChip icon={Wind}>{t('weather.chip.wind', { n: r.windKmh })}</WeatherChip>}
            {gust != null && <WeatherChip icon={Wind}>{t('weather.chip.gust', { g: gust })}</WeatherChip>}
          </div>
        )}
      </div>
    </HeroShell>
  );
}

const AQI_TONE: Record<'good' | 'warn' | 'bad', Tone> = { good: 'green', warn: 'amber', bad: 'red' };

/** Today's rain chance and the AQI estimate, as tinted chips under "अपडेट" in the body. */
export function TodayChips({ day, aqi }: { day?: DailyForecast; aqi?: number }) {
  const t = useT();
  const info = aqi != null ? aqiInfo(aqi) : null;
  if (!day && !info) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {day && (
        <Badge size="md" tone="sky" icon={CloudRain}>
          {t('weather.chip.rainToday', { n: day.rainProbabilityPct })}
        </Badge>
      )}
      {info && aqi != null && (
        <Badge size="md" tone={AQI_TONE[info.tone]} icon={Leaf}>
          {t('weather.chip.aqi', { value: aqi, level: t(info.key) })}
        </Badge>
      )}
    </div>
  );
}

/** Loading / error header: the place stays changeable while nothing else is known yet. */
export function PlaceholderHero({ placeLabel, onPlace, loading }: { placeLabel: string; onPlace: () => void; loading: boolean }) {
  return (
    <HeroShell>
      <PlaceButton label={placeLabel} onPress={onPlace} />
      {loading && (
        <div aria-hidden>
          <span className="mt-4 block h-11 w-28 rounded-xl bg-white/20" />
          <span className="mt-3 block h-5 w-36 rounded-md bg-white/20" />
          <span className="mt-2 block h-4 w-48 rounded-md bg-white/15" />
          <span className="mt-4 flex gap-2">
            <span className="block h-8 w-20 rounded-full bg-white/20" />
            <span className="block h-8 w-24 rounded-full bg-white/20" />
            <span className="block h-8 w-16 rounded-full bg-white/20" />
          </span>
        </div>
      )}
    </HeroShell>
  );
}

// ---------- Next 24 hours ----------

function RainChance({ pct, className }: { pct: number; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 tabular-nums', pct >= 30 ? 'font-semibold text-tone-sky' : 'text-ink-3', className)}>
      <Droplet aria-hidden className="size-3.5 shrink-0" strokeWidth={2.25} fill="currentColor" fillOpacity={pct >= 30 ? 0.35 : 0.12} />
      <span className="pt-0.5">{pct}%</span>
    </span>
  );
}

export interface HourlyStripProps {
  hours: HourlyForecast[];
  daily: DailyForecast[];
  /** Today's date at the place, for "कल" at midnight. */
  today: string;
  now: number;
}

/** "अगले 24 घंटे": a horizontally scrolling row of hour cards (time, glyph, temperature, rain %). */
export const HourlyStrip = memo(function HourlyStrip({ hours, daily, today, now }: HourlyStripProps) {
  const t = useT();
  return (
    <div role="region" aria-label={t('weather.hourly.title')} tabIndex={0} className="-mx-4 overflow-x-auto scrollbar-none rounded-list">
      <ul className="flex w-max gap-2 px-4 py-0.5">
        {hours.map(h => {
          const start = Date.parse(h.time);
          const isNow = start <= now && now < start + HOUR;
          const isDay = isDaylightHour(h.time, daily);
          const label = isNow
            ? t('weather.hourly.now')
            : localHourOf(h.time) === 0
              ? shortDayLabel(h.time.slice(0, 10), today, t)
              : hourLabel(h.time);
          const temp = Math.round(h.temperatureC);
          const cond = t(conditionKey(h.weatherCode, isDay));
          return (
            <li
              key={h.time}
              className={cx(
                'flex w-[4.25rem] shrink-0 flex-col items-center gap-1 rounded-list border px-1 py-3',
                isNow ? 'border-brand-100 bg-brand-50' : 'border-line bg-surface',
              )}
            >
              <span className="sr-only">
                {t('weather.hourly.item', { time: isNow ? label : hourLabel(h.time), temp, cond, pct: h.rainProbabilityPct })}
              </span>
              <span aria-hidden className={cx('text-caption leading-snug', isNow ? 'font-semibold text-brand' : 'font-medium text-ink-2')}>
                {label}
              </span>
              <WeatherGlyph code={h.weatherCode} isDay={isDay} className="size-7" />
              <span aria-hidden className="text-body font-bold text-ink tabular-nums">
                {temp}°
              </span>
              <span aria-hidden className="text-caption">
                <RainChance pct={h.rainProbabilityPct} />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
});

// ---------- 7 days ----------

function RangeBar({ min, max, lo, hi }: { min: number; max: number; lo: number; hi: number }) {
  const span = Math.max(1, hi - lo);
  const left = ((min - lo) / span) * 100;
  const width = Math.max(6, ((max - min) / span) * 100);
  // Fits the ~166px text column of a 320px phone next to the rain chance (48 + 8 + 32 + 6 + 24 + 6 + 32).
  // No min-w-0: with large text the bar keeps its content width and wraps under the rain chance.
  return (
    <span className="flex flex-1 items-center gap-1.5">
      <span className="min-w-8 shrink-0 text-right text-small text-ink-2 tabular-nums">{min}°</span>
      <span aria-hidden className="relative h-1.5 min-w-6 flex-1 rounded-full bg-surface-3">
        <span
          className="absolute inset-y-0 rounded-full bg-linear-to-r from-sky to-sun"
          style={{ left: `${Math.min(left, 100 - width)}%`, width: `${width}%` }}
        />
      </span>
      <span className="min-w-8 shrink-0 text-small font-semibold text-ink tabular-nums">{max}°</span>
    </span>
  );
}

export interface DailyListProps {
  days: DailyForecast[];
  today: string;
  onOpen: (date: string) => void;
}

/** "अगले 7 दिन का अनुमान": one row per day with glyph, condition, rain chance and a min–max bar. */
export const DailyList = memo(function DailyList({ days, today, onOpen }: DailyListProps) {
  const t = useT();
  const lo = Math.round(Math.min(...days.map(d => d.tempMinC)));
  const hi = Math.round(Math.max(...days.map(d => d.tempMaxC)));
  return (
    <ListGroup ariaLabel={t('weather.daily.title')}>
      {days.map(d => {
        const label = dayLabel(d.date, today, t);
        const cond = t(conditionKey(d.weatherCode));
        const min = Math.round(d.tempMinC);
        const max = Math.round(d.tempMaxC);
        return (
          <ListRow
            key={d.date}
            variant="plain"
            leading={
              <span className="inline-flex size-11 items-center justify-center rounded-full bg-surface-2">
                <WeatherGlyph code={d.weatherCode} className="size-7" />
              </span>
            }
            title={label}
            subtitle={cond}
            subtitleLines={1}
            meta={
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <RainChance pct={d.rainProbabilityPct} className="min-w-12 shrink-0 text-small" />
                <RangeBar min={min} max={max} lo={lo} hi={hi} />
              </span>
            }
            onPress={() => onOpen(d.date)}
            ariaLabel={t('weather.daily.row', { day: label, cond, pct: d.rainProbabilityPct, min, max })}
          />
        );
      })}
    </ListGroup>
  );
});

// ---------- Spray verdict (today) ----------

export interface SprayCardProps {
  spray: SprayAdvice;
  /**
   * The advice is the service's "no data" answer (see logic isSprayNoData): neutral "can't say",
   * never an amber "don't spray".
   */
  noData: boolean;
  /** Opens the day screen with all of that day's windows. */
  onSeeTimes?: () => void;
  seeLabel?: string;
}

/** "क्या आज स्प्रे करना सही है?": ✓ green when today has a window, ⚠ amber when not. */
export function SprayCard({ spray, noData: noDataProp, onSeeTimes, seeLabel }: SprayCardProps) {
  const t = useT();
  const noData = !spray.suitable && noDataProp;
  const verdict = spray.suitable ? t('weather.sprayCard.yes') : noData ? t('weather.sprayCard.unsure') : t('weather.sprayCard.no');
  const windowLine = spray.bestWindow
    ? t(spray.suitable ? 'weather.sprayCard.best' : 'weather.sprayCard.next', { window: spray.bestWindow })
    : null;
  const speech = speechify([t('weather.spray.question'), verdict, spray.reason].join(' '), t);
  return (
    <Callout
      tone={spray.suitable ? 'brand' : noData ? 'neutral' : 'warning'}
      icon={spray.suitable ? CircleCheck : noData ? Info : TriangleAlert}
      title={
        <span role="heading" aria-level={2}>
          {t('weather.spray.question')}
        </span>
      }
      aside={<ListenButton id="weather-spray" text={speech} variant="icon" />}
      action={
        onSeeTimes && seeLabel ? (
          <Button variant="secondary" icon={CalendarClock} onClick={onSeeTimes}>
            {seeLabel}
          </Button>
        ) : undefined
      }
    >
      <p className={cx('text-body leading-snug font-semibold', spray.suitable ? 'text-tone-green' : noData ? 'text-ink' : 'text-tone-amber')}>
        {verdict}
      </p>
      {windowLine && (
        <p className="mt-1 flex items-center gap-1.5 font-semibold text-ink">
          <Clock aria-hidden className="size-4 shrink-0" strokeWidth={2.25} />
          <span className="pt-0.5">{windowLine}</span>
        </p>
      )}
      <p className="mt-1.5">{spray.reason}</p>
      <p className="mt-2 text-caption">{t('weather.sprayCard.label')}</p>
    </Callout>
  );
}

// ---------- Alerts ----------

const ALERT_ICON: Record<WeatherAlertKind, IconLike> = {
  'heavy-rain': CloudRainWind,
  heatwave: ThermometerSun,
  'cold-wave': ThermometerSnowflake,
  frost: Snowflake,
  'strong-wind': Wind,
  storm: CloudLightning,
};

/** One farm weather alert: severity styling, the forecast sentence and a "क्या करें" action line. */
export function AlertCallout({ alert }: { alert: WeatherAlert }) {
  const t = useT();
  const urgent = alert.severity === 'urgent';
  const { forecast, action } = useMemo(() => splitAlertMessage(alert.message), [alert.message]);
  const speech = speechify(`${alert.title}. ${alert.message}`, t);
  return (
    <Callout
      tone={urgent ? 'danger' : 'warning'}
      icon={ALERT_ICON[alert.kind]}
      title={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{alert.title}</span>
          <Badge tone={urgent ? 'red' : 'amber'} variant="solid">
            {urgent ? t('weather.alerts.urgent') : t('weather.alerts.important')}
          </Badge>
        </span>
      }
      aside={<ListenButton id={`weather-alert-${alert.kind}-${alert.date}`} text={speech} variant="icon" />}
    >
      <p>{forecast}</p>
      {action && (
        <p className="mt-1.5 text-ink">
          <span className="font-semibold">{t('weather.alerts.action')}</span> {action}
        </p>
      )}
    </Callout>
  );
}

export function AlertList({ alerts, title }: { alerts: WeatherAlert[]; title: string }) {
  if (!alerts.length) return null;
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title={title} icon={TriangleAlert} />
      {alerts.map(a => (
        <AlertCallout key={`${a.kind}-${a.date}`} alert={a} />
      ))}
    </section>
  );
}

// ---------- Farm tips ----------

const TIP_STYLE: Record<TipKind, { icon: IconLike; tone: Tone }> = {
  rain: { icon: CloudRain, tone: 'sky' },
  wind: { icon: Wind, tone: 'indigo' },
  heat: { icon: ThermometerSun, tone: 'orange' },
  humidity: { icon: Droplets, tone: 'teal' },
  fog: { icon: CloudFog, tone: 'gray' },
  cold: { icon: Snowflake, tone: 'sky' },
  dry: { icon: Sprout, tone: 'amber' },
  normal: { icon: Sprout, tone: 'green' },
  scout: { icon: Bug, tone: 'rose' },
};

export interface TipListProps {
  tips: FarmTip[];
  title: string;
  subtitle?: string;
  /** Humidity tips link to Crop Doctor. */
  onOpenDoctor?: () => void;
}

/** "मौसम के हिसाब से खेती सलाह": 2–4 local, rule-based lines. */
export function TipList({ tips, title, subtitle, onOpenDoctor }: TipListProps) {
  const t = useT();
  if (!tips.length) return null;
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title={title} subtitle={subtitle} icon={Sprout} />
      <ListGroup ariaLabel={title}>
        {tips.map(tip => {
          const s = TIP_STYLE[tip.kind];
          return (
            <ListRow
              key={tip.kind}
              variant="plain"
              leading={<ToneIcon icon={s.icon} tone={s.tone} size="md" />}
              title={t(`weather.tip.${tip.kind}.title`, tip.vars)}
              subtitle={t(`weather.tip.${tip.kind}.body`, tip.vars)}
              subtitleLines={3}
              onPress={tip.kind === 'humidity' ? onOpenDoctor : undefined}
            />
          );
        })}
      </ListGroup>
    </section>
  );
}

// ---------- Sun, UV and air ----------

const UV_HINT: Record<UvLevel, string> = {
  low: 'weather.uvHint.safe',
  moderate: 'weather.uvHint.moderate',
  high: 'weather.uvHint.high',
  veryHigh: 'weather.uvHint.high',
  extreme: 'weather.uvHint.high',
};

/** Sunrise / sunset, today's UV and the AQI estimate (with its CPCB-model note). */
export function SunAirSection({ day, aqi }: { day?: DailyForecast; aqi?: number }) {
  const t = useT();
  const rise = clockLabel(day?.sunrise);
  const set = clockLabel(day?.sunset);
  const uv = day?.uvIndexMax;
  const cards: ReactNode[] = [];
  if (rise) cards.push(<StatCard key="rise" label={t('weather.sun.sunrise')} value={rise} tone="amber" icon={Sunrise} />);
  if (set) cards.push(<StatCard key="set" label={t('weather.sun.sunset')} value={set} tone="orange" icon={Sunset} />);
  if (uv != null) {
    const lvl = uvLevel(uv);
    cards.push(
      <StatCard
        key="uv"
        label={t('weather.sun.uv')}
        value={`${Math.round(uv)} · ${t(`weather.uv.${lvl}`)}`}
        tone={UV_TONE[lvl]}
        icon={SunMedium}
        hint={t(UV_HINT[lvl])}
      />,
    );
  }
  if (aqi != null) {
    const info = aqiInfo(aqi);
    cards.push(
      <StatCard
        key="aqi"
        label={t('weather.sun.aqi')}
        value={`${aqi} · ${t(info.key)}`}
        tone={AQI_TONE[info.tone]}
        icon={Leaf}
        hint={t(`weather.aqiHint.${info.tone}`)}
      />,
    );
  }
  if (!cards.length) return null;
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title={t('weather.sun.title')} icon={SunMedium} />
      <div className="grid grid-cols-2 gap-3">{cards}</div>
      {aqi != null && <p className="px-1 text-caption text-ink-2">{t('weather.aqi.note')}</p>}
    </section>
  );
}

// ---------- Weather Details: hour rows and spray windows ----------

function Fact({ icon: Icon, children, className }: { icon: typeof Wind; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1', className)}>
      <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={2.25} />
      <span className="pt-0.5">{children}</span>
    </span>
  );
}

export interface HourRowProps {
  h: HourlyForecast;
  daily: DailyForecast[];
  /** Inside one of the day's best spray windows. */
  sprayOk?: boolean;
}

/** One hour on the day screen: time, temperature, condition, rain % / mm, wind and humidity. */
export function HourRow({ h, daily, sprayOk }: HourRowProps) {
  const t = useT();
  const isDay = isDaylightHour(h.time, daily);
  const cond = t(conditionKey(h.weatherCode, isDay));
  const wet = h.rainProbabilityPct >= 30 || h.rainMm > 0;
  return (
    <ListRow
      variant="plain"
      leading={
        <span className="inline-flex w-14 items-center justify-center rounded-xl bg-surface-2 py-2.5 text-small font-semibold text-ink tabular-nums">
          {hourLabel(h.time)}
        </span>
      }
      title={
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 tabular-nums">{Math.round(h.temperatureC)}°C</span>
          <span className="min-w-0 truncate text-small font-medium text-ink-2">{cond}</span>
        </span>
      }
      subtitle={
        <span className="flex flex-wrap gap-x-3 gap-y-0.5">
          <Fact icon={Droplet} className={wet ? 'font-semibold text-tone-sky' : undefined}>
            {t('weather.day.hourly.rain', { pct: h.rainProbabilityPct })}
            {h.rainMm > 0 ? ` · ${t('weather.day.hourly.mm', { mm: formatNumber(h.rainMm, 1) })}` : ''}
          </Fact>
          <Fact icon={Wind}>{t('weather.day.hourly.wind', { n: h.windKmh })}</Fact>
          <Fact icon={Droplets}>{t('weather.day.hourly.humidity', { n: h.humidityPct })}</Fact>
        </span>
      }
      subtitleLines={3}
      trailing={
        <span className="flex flex-col items-end gap-1">
          <WeatherGlyph code={h.weatherCode} isDay={isDay} className="size-7" />
          {sprayOk && <Badge tone="green">{t('weather.day.hourly.sprayOk')}</Badge>}
        </span>
      }
    />
  );
}

/**
 * The day's spray windows as rows: time, wind, temperature, rain chance and a badge. Only the single
 * best window (the one the overview card names) says "सबसे अच्छा"; other windows in the ideal
 * 3–10 km/h breeze say "अच्छा", the rest "ठीक" with a nozzle tip for still or breezy air.
 */
export function SprayWindowList({ windows, bestStartIso }: { windows: SprayWindow[]; bestStartIso?: string }) {
  const t = useT();
  return (
    <ListGroup ariaLabel={t('weather.day.spray.title')}>
      {windows.map(w => {
        const best = w.startIso === bestStartIso;
        const green = best || w.ideal;
        return (
          <ListRow
            key={w.startIso}
            variant="plain"
            leading={<ToneIcon icon={Clock} tone={green ? 'green' : 'amber'} size="md" />}
            title={w.label}
            subtitle={t('weather.day.spray.facts', { wind: w.windKmh, temp: w.tempC, pct: w.maxRainPct })}
            meta={w.calm ? t('weather.day.spray.calm') : w.breezy ? t('weather.day.spray.breezy') : undefined}
            trailing={
              <Badge tone={green ? 'green' : 'amber'} icon={best ? CircleCheck : undefined}>
                {best ? t('weather.day.spray.ideal') : w.ideal ? t('weather.day.spray.good') : t('weather.day.spray.ok')}
              </Badge>
            }
          />
        );
      })}
    </ListGroup>
  );
}

// ---------- Skeletons ----------

/** Weather screen body while the first forecast loads: hourly strip, 7 day rows, spray card. */
export function OverviewSkeleton() {
  return (
    <>
      <div aria-hidden className="flex flex-col gap-3">
        <Skeleton rounded="sm" className="h-5 w-32" />
        <div className="-mx-4 flex gap-2 overflow-hidden px-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} rounded="lg" className="h-32 w-[4.25rem] shrink-0" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton rounded="sm" className="h-5 w-44" />
        <SkeletonList rows={5} variant="plain" media="circle" />
      </div>
      <Skeleton rounded="lg" className="h-40 w-full" />
    </>
  );
}

/** Weather Details while loading: day chips, the summary card, spray windows and hour rows. */
export function DaySkeleton() {
  return (
    <>
      <div aria-hidden className="-mx-4 flex gap-2 overflow-hidden px-4">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} rounded="full" className="h-11 w-20 shrink-0" />
        ))}
      </div>
      <Skeleton rounded="card" className="h-48 w-full" />
      <div className="flex flex-col gap-3">
        <Skeleton rounded="sm" className="h-5 w-44" />
        <SkeletonList rows={2} variant="plain" media="circle" trailing />
      </div>
      <div aria-hidden className="flex flex-col gap-3">
        <Skeleton rounded="sm" className="h-5 w-32" />
        <Skeleton rounded="lg" className="h-64 w-full" />
      </div>
    </>
  );
}

/** Chip row for the day summary card: rain chance and amount, wind (+ gusts) and UV. */
export function DayChips({ day }: { day: DailyForecastExt }) {
  const t = useT();
  const gust = notableGust(day.windMaxKmh, day.windGustMaxKmh);
  const uv = day.uvIndexMax;
  return (
    <>
      <WeatherChip icon={CloudRain}>{t('weather.chip.rain', { n: day.rainProbabilityPct })}</WeatherChip>
      {day.rainMm > 0 && <WeatherChip icon={Droplet}>{t('weather.chip.rainMm', { mm: formatNumber(day.rainMm, 1) })}</WeatherChip>}
      <WeatherChip icon={Wind}>
        {gust != null ? t('weather.chip.windGust', { n: day.windMaxKmh, g: gust }) : t('weather.chip.wind', { n: day.windMaxKmh })}
      </WeatherChip>
      {uv != null && <WeatherChip icon={SunMedium}>{t('weather.chip.uv', { n: Math.round(uv), level: t(`weather.uv.${uvLevel(uv)}`) })}</WeatherChip>}
    </>
  );
}
