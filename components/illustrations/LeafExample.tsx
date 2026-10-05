// "उदाहरण देखें" thumbnails for Crop Doctor: how a good photo is framed (one leaf, filling the
// frame, in focus, even light, plain background). They illustrate framing, not diagnosis, so
// symptoms are drawn clearly but simply.
import type { ReactNode } from 'react';
import { a11y, pure, useSvgId } from './svg';
import type { ArtProps } from './svg';
import type { LeafExampleKind } from './kinds';

export interface LeafExampleProps extends ArtProps {
  kind: LeafExampleKind;
  /** Rendered width and height in px. */
  size?: number;
  /** Rounded "photo" corners (12px at 72px). */
  rounded?: boolean;
}

// Broad leaflet (tomato/potato style) on a 0,0-centred grid, tip up.
const BROAD = 'M0-36c15 11 20 27 18 42-2 15-10 25-18 30-8-5-16-15-18-30-2-15 3-31 18-42z';
const BROAD_HALF = 'M0-36c-15 11-20 27-18 42 2 15 10 25 18 30z';
const VEINS = 'M0-32c.5 22 .5 44 0 66M0-22c4-2 8-4 11-5M0-22c-4-2-8-4-11-5M0-9c5-2 10-5 15-7M0-9c-5-2-10-5-15-7M0 4c5-2 11-5 16-8M0 4c-5-2-11-5-16-8M0 17c5-2 9-4 13-7M0 17c-5-2-9-4-13-7';
// Long, narrow wheat blade.
const BLADE = 'M-10 40c-2-28 2-54 11-80 7 26 9 52 8 80z';

interface Look {
  bg: [string, string];
  draw: () => ReactNode;
}

function broad(base: string, shade: string, vein: string, extra?: ReactNode) {
  return (
    <g transform="translate(47 48) rotate(-32) scale(.9)">
      <path d={BROAD} transform="translate(3 4)" fill="#000" fillOpacity=".14" />
      <path d="M0 34c1 6 3 10 6 14" stroke={shade} strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d={BROAD} fill={base} />
      <path d={BROAD_HALF} fill={shade} />
      <path d={VEINS} stroke={vein} strokeWidth="1.3" strokeLinecap="round" fill="none" />
      {extra}
    </g>
  );
}

/** Blight: brown target-spot lesions with yellow halos. */
function Symptoms() {
  return (
    <>
      {[[7, -14, 6], [-8, 4, 5], [6, 15, 4.2], [-5, -22, 3.4]].map(([x, y, r], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r + 2.6} fill="#d8c440" fillOpacity=".8" />
          <circle cx={x} cy={y} r={r} fill="#7a4a24" />
          <circle cx={x} cy={y} r={r * 0.62} fill="none" stroke="#a3693a" strokeWidth="1" />
          <circle cx={x} cy={y} r={r * 0.25} fill="#4f3018" />
        </g>
      ))}
    </>
  );
}

// Pustules scattered between the veins, densest mid-blade like a real infection.
const PUSTULES: [number, number][] = [
  [-5, 28], [0, 31], [4, 25], [-2, 21], [3, 16], [-6, 14], [-1, 9], [5, 6], [-4, 3], [1, -1],
  [-3, -7], [4, -5], [0, -13], [-4, -18], [3, -21], [0, -28], [-6, 22], [6, 12], [-2, 36], [2, -34],
];

const LOOKS: Record<LeafExampleKind, Look> = {
  rust: {
    bg: ['#e2e7cf', '#b9c79c'],
    draw: () => (
      <g transform="translate(48 50) rotate(32)">
        <path d={BLADE} transform="translate(3 3)" fill="#000" fillOpacity=".14" />
        <path d={BLADE} fill="#6aa84a" />
        <path d="M-10 40c-2-28 2-54 11-80-4 26-6 54-5 80z" fill="#5a9640" />
        <path d="M-5 38c-1-26 1-50 5-72M1 38c0-26 0-50 0-74M5 38c0-24-1-48-3-70" stroke="#86c066" strokeWidth=".8" fill="none" />
        {PUSTULES.map(([x, y], i) => (
          <ellipse key={i} cx={x} cy={y} rx="1.3" ry="2.3" fill={i % 3 ? '#e2801f' : '#bf5f18'} />
        ))}
      </g>
    ),
  },
  blight: {
    bg: ['#e4e6d3', '#bcc6a2'],
    draw: () => broad('#5f9e45', '#518c3a', '#8cc067', <Symptoms />),
  },
  yellowing: {
    bg: ['#e6e7d5', '#c2c8a6'],
    draw: () =>
      broad(
        '#e4cf55',
        '#d6bd42',
        '#5f9e45',
        <path d="M0-30c.5 20 .5 42 0 62" stroke="#9fc04e" strokeWidth="5" strokeOpacity=".7" strokeLinecap="round" fill="none" />,
      ),
  },
  healthy: {
    bg: ['#e0ead6', '#b3c99c'],
    draw: () =>
      broad(
        '#4f9d3a',
        '#3f8a32',
        '#8cc76a',
        <ellipse cx="8" cy="-14" rx="3" ry="8" transform="rotate(20 8 -14)" fill="#fff" fillOpacity=".18" />,
      ),
  },
};

function LeafExampleBase({ kind, size = 72, rounded = true, className, style, title }: LeafExampleProps) {
  const id = useSvgId();
  const look = LOOKS[kind] ?? LOOKS.healthy;
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} className={className} style={style} xmlns="http://www.w3.org/2000/svg" {...a11y(title)}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2=".6" y2="1">
          <stop offset="0" stopColor={look.bg[0]} />
          <stop offset="1" stopColor={look.bg[1]} />
        </linearGradient>
        <clipPath id={`${id}c`}>
          <rect width="96" height="96" rx={rounded ? 16 : 0} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}c)`}>
        <rect width="96" height="96" fill={`url(#${id})`} />
        {/* Out-of-focus field behind the leaf, like a phone photo taken close up. */}
        <circle cx="14" cy="80" r="16" fill="#fff" fillOpacity=".14" />
        <circle cx="84" cy="14" r="12" fill="#fff" fillOpacity=".18" />
        <circle cx="80" cy="84" r="9" fill="#5f7d3e" fillOpacity=".12" />
        {look.draw()}
      </g>
    </svg>
  );
}

export const LeafExample = pure(LeafExampleBase);
