import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudMoon,
  CloudMoonRain,
  CloudRain,
  CloudSnow,
  CloudSun,
  CloudSunRain,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { cx } from './cx';
import { DUOTONE } from './icon';

export type WeatherKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'heavyRain' | 'showers' | 'snow' | 'thunder';

/** Groups WMO weather codes (Open-Meteo) into the handful of states a farmer cares about. */
export function weatherKind(code: number): WeatherKind {
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code === 61 || code === 63 || code === 66) return 'rain';
  if (code === 65 || code === 67) return 'heavyRain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'showers';
  if (code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'thunder';
  return 'cloudy';
}

/** i18n key for the condition text ("धूप खिली है", "बारिश"…). */
export function weatherConditionKey(code: number, isDay = true): string {
  const kind = weatherKind(code);
  if (kind === 'clear' && !isDay) return 'ui.weather.clearNight';
  return `ui.weather.${kind}`;
}

function glyph(code: number, isDay: boolean): { Icon: LucideIcon; color: string } {
  const kind = weatherKind(code);
  switch (kind) {
    case 'clear':
      return isDay ? { Icon: Sun, color: 'text-sun' } : { Icon: Moon, color: 'text-tone-indigo' };
    case 'partly':
      return isDay ? { Icon: CloudSun, color: 'text-sun' } : { Icon: CloudMoon, color: 'text-tone-indigo' };
    case 'cloudy':
      return { Icon: Cloud, color: 'text-ink-3' };
    case 'fog':
      return { Icon: CloudFog, color: 'text-ink-3' };
    case 'drizzle':
      return { Icon: CloudDrizzle, color: 'text-sky' };
    case 'rain':
    case 'heavyRain':
      return { Icon: CloudRain, color: 'text-sky' };
    case 'showers':
      return isDay ? { Icon: CloudSunRain, color: 'text-sky' } : { Icon: CloudMoonRain, color: 'text-sky' };
    case 'snow':
      return code === 77 ? { Icon: CloudHail, color: 'text-tone-sky' } : { Icon: CloudSnow, color: 'text-tone-sky' };
    case 'thunder':
      return { Icon: CloudLightning, color: 'text-tone-tech' };
  }
}

export interface WeatherGlyphProps {
  /** WMO weather code. */
  code: number;
  isDay?: boolean;
  /** Size via classes (default size-6). */
  className?: string;
  /** false = inherit currentColor (e.g. white on the blue weather card). */
  colored?: boolean;
  /** Accessible name; without it the icon is decorative (the text beside it says the condition). */
  label?: string;
}

/** Weather icon with a sensible colour: amber sun, indigo moon, gray clouds, blue rain, violet storm. */
export function WeatherGlyph({ code, isDay = true, className, colored = true, label }: WeatherGlyphProps) {
  const { Icon, color } = glyph(code, isDay);
  return (
    <Icon
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cx('shrink-0', className ?? 'size-6', colored && color)}
      strokeWidth={2}
      {...DUOTONE}
    />
  );
}
