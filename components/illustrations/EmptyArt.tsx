// Calm two-tone art for empty, offline and error states. Everything is drawn in currentColor at
// a few opacities plus a "paper" fill, so one set adapts to any tint and to dark mode:
//   color          → the drawing (the UI kit's tone text colour, so it follows dark / high contrast)
//   --ill-paper    → white surfaces inside the art; falls back to the theme's --surface
//   --ill-accent   → the single small warm highlight (defaults to sun amber)
import type { CSSProperties, ReactNode } from 'react';
import { cx } from '../ui/cx';
import { TONE_TEXT } from '../ui/tones';
import type { Tone } from '../ui/tones';
import { a11y, pure } from './svg';
import type { ArtProps } from './svg';
import type { EmptyArtKind } from './kinds';

export interface EmptyArtProps extends ArtProps {
  kind: EmptyArtKind;
  /** Rendered width in px; height follows the 4:3 artboard. */
  size?: number;
  /** Drawing colour as a UI-kit tone (same names as ToneIcon, Badge…). Default 'green'. */
  tone?: Tone;
  /**
   * Raw CSS colour that overrides `tone`, e.g. 'currentColor' to inherit the surrounding text.
   * Prefer `tone`: a fixed colour does not follow the dark and high-contrast token swaps.
   */
  color?: string;
}

const C = 'currentColor';
// Without an explicit --ill-paper the "white" parts follow the card surface, so they never glare
// in dark mode even before any app-level CSS exists.
const PAPER = 'var(--ill-paper, var(--surface, #ffffff))';
const ACCENT = 'var(--ill-accent, #f59e0b)';
const solid = { fill: C };
const soft = { fill: C, fillOpacity: 0.3 };
const paperStroke = (w = 3) => ({ fill: PAPER, stroke: C, strokeWidth: w, strokeLinejoin: 'round' as const });
const stroke = (w: number, opacity = 1) => ({ fill: 'none', stroke: C, strokeWidth: w, strokeLinecap: 'round' as const, strokeOpacity: opacity });

const CLOUD = 'M54 86c-11 0-18-7-18-16 0-8 6-15 15-16 3-12 13-20 26-20 11 0 20 6 24 16 11 0 21 8 21 19 0 10-8 17-19 17z';

const ART: Record<EmptyArtKind, () => ReactNode> = {
  crops: () => (
    <>
      <path d="M42 98c8-14 68-14 76 0z" {...soft} />
      <path d="M80 92c0-12-1-22 0-32" {...stroke(4)} />
      <path d="M79 72c-11 2-21-6-22-18 12-1 20 6 22 18z" {...soft} />
      <path d="M81 64c2-13 12-21 25-20-1 12-11 20-25 20z" {...solid} />
      <circle cx="117" cy="34" r="12" {...paperStroke(2.5)} strokeDasharray="4 3" />
      <path d="M117 28v12M111 34h12" {...stroke(3)} />
    </>
  ),
  notifications: () => (
    <>
      <circle cx="80" cy="25" r="4.5" {...solid} />
      <path d="M80 28c-14 0-22 11-22 24v15l-6 9h56l-6-9V52c0-13-8-24-22-24z" {...soft} />
      <path d="M67 52c0-8 4-14 10-16" stroke={PAPER} strokeWidth="4" strokeLinecap="round" fill="none" />
      <rect x="50" y="74" width="60" height="7" rx="3.5" {...solid} />
      <circle cx="80" cy="89" r="6" {...solid} />
      <circle cx="114" cy="36" r="3" fill={ACCENT} />
      <circle cx="46" cy="46" r="2.4" {...soft} />
    </>
  ),
  saved: () => (
    <>
      <rect x="50" y="26" width="60" height="70" rx="10" {...paperStroke(2.5)} strokeOpacity=".35" />
      <rect x="60" y="64" width="40" height="5" rx="2.5" {...soft} />
      <rect x="60" y="74" width="28" height="5" rx="2.5" {...soft} />
      <path d="M66 20h28v38l-14-10-14 10z" {...solid} />
      <circle cx="118" cy="40" r="3" fill={ACCENT} />
    </>
  ),
  search: () => (
    <>
      <path d="M92 76l18 18" {...stroke(11)} />
      <circle cx="73" cy="56" r="25" {...paperStroke(6)} />
      <path d="M64 66c-2-11 4-19 17-21 2 12-5 20-17 21z" {...soft} />
      <path d="M60 48c2-6 6-9 11-10" {...stroke(3, 0.35)} />
    </>
  ),
  offline: () => (
    <>
      <path d={CLOUD} {...paperStroke(4)} />
      <path d="M56 30l52 62" stroke={PAPER} strokeWidth="12" strokeLinecap="round" />
      <path d="M56 30l52 62" {...stroke(5)} />
      <circle cx="40" cy="44" r="2.4" {...soft} />
      <circle cx="124" cy="40" r="3" fill={ACCENT} />
    </>
  ),
  error: () => (
    <>
      <circle cx="80" cy="56" r="32" {...soft} />
      <rect x="75.5" y="36" width="9" height="26" rx="4.5" {...solid} />
      <circle cx="80" cy="73" r="5" {...solid} />
      <path d="M46 96c-2-9 3-15 12-16 1 9-4 15-12 16zM114 96c2-9-3-15-12-16-1 9 4 15 12 16z" {...soft} />
      <circle cx="120" cy="30" r="3" fill={ACCENT} />
    </>
  ),
  calendar: () => (
    <>
      <rect x="46" y="30" width="68" height="64" rx="10" {...paperStroke(2.5)} strokeOpacity=".35" />
      <path d="M46 40a10 10 0 0110-10h48a10 10 0 0110 10v8H46z" {...solid} />
      <rect x="60" y="22" width="6" height="14" rx="3" {...paperStroke(2)} />
      <rect x="94" y="22" width="6" height="14" rx="3" {...paperStroke(2)} />
      {[58, 70, 82].flatMap((y) =>
        [60, 73, 86, 99].filter((x) => !(x === 86 && y === 70)).map((x) => <circle key={`${x}.${y}`} cx={x} cy={y} r="3.2" {...soft} />),
      )}
      <circle cx="86" cy="70" r="6.5" fill={ACCENT} />
    </>
  ),
  money: () => (
    <>
      <rect x="38" y="36" width="68" height="40" rx="7" {...soft} />
      <circle cx="72" cy="56" r="9" fill={PAPER} />
      <circle cx="72" cy="56" r="4" {...soft} />
      {[86, 78, 70].map((y) => (
        <g key={y}>
          <path d={`M88 ${y}v5a17 6.5 0 0034 0v-5z`} {...solid} />
          <ellipse cx="105" cy={y} rx="17" ry="6.5" {...paperStroke(2.5)} />
        </g>
      ))}
      <circle cx="105" cy="70" r="2.4" fill={ACCENT} />
    </>
  ),
  community: () => (
    <>
      <circle cx="50" cy="52" r="9" {...soft} />
      <path d="M32 94c0-14 8-24 18-24 6 0 11 3 14 8l-4 16z" {...soft} />
      <circle cx="110" cy="52" r="9" {...soft} />
      <path d="M128 94c0-14-8-24-18-24-6 0-11 3-14 8l4 16z" {...soft} />
      <circle cx="80" cy="44" r="12" {...solid} stroke={PAPER} strokeWidth="3" />
      <path d="M56 96c0-18 10-30 24-30s24 12 24 30z" {...solid} stroke={PAPER} strokeWidth="3" strokeLinejoin="round" />
    </>
  ),
  chat: () => (
    <>
      <path d="M52 26h40a14 14 0 0114 14v12a14 14 0 01-14 14H62l-12 10 2-10a14 14 0 01-14-14V40a14 14 0 0114-14z" {...soft} />
      <path d="M78 50h38a14 14 0 0114 14v10a14 14 0 01-14 14h-2l2 10-12-10H78a14 14 0 01-14-14V64a14 14 0 0114-14z" {...solid} stroke={PAPER} strokeWidth="3" strokeLinejoin="round" />
      {[84, 97, 110].map((x) => (
        <circle key={x} cx={x} cy="69" r="3.6" fill={PAPER} />
      ))}
    </>
  ),
  soil: () => (
    <>
      <rect x="36" y="60" width="72" height="36" rx="9" {...soft} />
      <path d="M36 74c14-4 26 4 40 0s24-3 32 0M36 86c12-3 24 3 38 0s26-2 34 0" stroke={PAPER} strokeWidth="2.5" fill="none" />
      <circle cx="52" cy="68" r="2.4" {...solid} />
      <circle cx="92" cy="80" r="2" {...solid} />
      <circle cx="64" cy="91" r="1.8" {...solid} />
      <path d="M72 60c0-8-1-14 0-20" {...stroke(3.5)} />
      <path d="M71 48c-8 1-14-4-15-12 8-1 13 4 15 12z" {...solid} />
      <path d="M73 43c1-9 8-14 16-13-1 8-7 13-16 13z" {...soft} />
      <g transform="rotate(16 122 62)">
        <rect x="115" y="34" width="14" height="50" rx="7" {...paperStroke(2.5)} />
        <path d="M117.5 62h9v15a4.5 4.5 0 01-9 0z" {...solid} />
        <rect x="112" y="31" width="20" height="5" rx="2.5" {...solid} />
      </g>
      <circle cx="132" cy="96" r="3" fill={ACCENT} />
    </>
  ),
};

function EmptyArtBase({ kind, size = 160, tone = 'green', color, className, style, title }: EmptyArtProps) {
  const draw = ART[kind] ?? ART.crops;
  // An inline colour beats the tone class; the class is dropped then so the two never compete.
  const svgStyle: CSSProperties | undefined = color ? { ...style, color } : style;
  return (
    <svg
      viewBox="0 0 160 120"
      width={size}
      height={(size * 3) / 4}
      className={cx(!color && (TONE_TEXT[tone] ?? TONE_TEXT.green), className)}
      style={svgStyle}
      xmlns="http://www.w3.org/2000/svg"
      {...a11y(title)}
    >
      <path d="M84 10c30 2 54 22 54 50s-22 50-56 50S22 92 22 62 52 8 84 10z" fill={C} fillOpacity=".08" />
      <ellipse cx="80" cy="102" rx="44" ry="4" fill={C} fillOpacity=".12" />
      {draw()}
    </svg>
  );
}

export const EmptyArt = pure(EmptyArtBase);
