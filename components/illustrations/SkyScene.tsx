// Weather-screen hero backgrounds: one sky per condition (with a night mood for each) over a
// shared strip of fields, so the header changes with the forecast while the place stays familiar.
// The artboard is composed for the Screen tone="hero" header (360×320, bottom-anchored):
//   - the top 80 units sit under the floating app bar and stay empty;
//   - the left 220 units above y 230 are kept free of clouds, fog and bright stars, and a built-in
//     left-to-right scrim darkens them further, so the white temperature, condition and chips stay
//     at AA contrast (measured; see docs/ILLUSTRATIONS.md);
//   - the sun, moon and clouds stay right of x 220 and below y 140: on wide phones the cover crop
//     trims ~75 units off the top, and anything higher would sit behind the app bar icons.
import type { CSSProperties } from 'react';
import { Cloud, Palm, Tree } from './parts';
import { a11y, pure, star, useSvgId } from './svg';
import type { ArtProps } from './svg';
import type { SkyCondition } from './kinds';

export interface SkySceneProps extends ArtProps {
  /** `weatherCodeInfo(code, isDay).scene` from services/weather. */
  condition: SkyCondition;
  /**
   * Night mood: moon instead of sun and darker sky and fields. 'clear-night' is always night;
   * pass `!isDay` so cloudy, rain, storm and fog skies follow the clock too.
   */
  night?: boolean;
  /** cover (default) fills the box keeping the fields at the bottom; contain letterboxes. */
  fit?: 'cover' | 'contain';
}

interface Mood {
  /** top, behind the text, horizon */
  sky: [string, string, string];
  /** back hill, front field, furrows */
  land: [string, string, string];
  tree: [string, string, string];
}

const NIGHT_LAND: Pick<Mood, 'land' | 'tree'> = {
  land: ['#1d3a2b', '#152c20', '#10241a'],
  tree: ['#0e2118', '#12281c', '#183324'],
};

const CLEAR_NIGHT: Mood = { sky: ['#081428', '#10264a', '#284a7a'], ...NIGHT_LAND };

/** [day, night] per condition. Skies stay dark behind the text; only the horizon lightens. */
const MOODS: Record<SkyCondition, [day: Mood, night: Mood]> = {
  'clear-day': [
    { sky: ['#0f57a6', '#1a6cbf', '#62aeea'], land: ['#7cc062', '#4ea44a', '#43974a'], tree: ['#3d7d4a', '#4f8f5a', '#67a872'] },
    CLEAR_NIGHT,
  ],
  'clear-night': [CLEAR_NIGHT, CLEAR_NIGHT],
  cloudy: [
    { sky: ['#3e5872', '#4a637c', '#8197ab'], land: ['#6fa86a', '#4f8f52', '#468649'], tree: ['#30583a', '#3b6a46', '#4d7d57'] },
    { sky: ['#1b2a40', '#22344c', '#3e5470'], ...NIGHT_LAND },
  ],
  rain: [
    { sky: ['#2f4458', '#3a5168', '#6f879d'], land: ['#5b8f63', '#437a4c', '#3b6e44'], tree: ['#284a31', '#30573a', '#3e6848'] },
    { sky: ['#131e2e', '#1b293b', '#344a62'], ...NIGHT_LAND },
  ],
  storm: [
    { sky: ['#161e2c', '#222d40', '#46566c'], land: ['#3f6b4b', '#2f5a3c', '#2a5136'], tree: ['#1c3825', '#22422c', '#2b4f36'] },
    { sky: ['#0a101b', '#121b29', '#2c394c'], ...NIGHT_LAND },
  ],
  fog: [
    { sky: ['#4f6273', '#56697a', '#8d9da8'], land: ['#86a690', '#6f937a', '#678b72'], tree: ['#5f8069', '#6c8c76', '#7c9a85'] },
    { sky: ['#1f2a36', '#283543', '#4c5b69'], land: ['#2c4236', '#22362b', '#1d3026'], tree: ['#1d3326', '#22392b', '#2b4535'] },
  ],
};

// Stars: bright ones only on the right; the few behind the text stay dim and small.
const STARS_BRIGHT: [number, number, number][] = [
  [236, 146, 1.1], [324, 150, 1.2], [348, 166, 0.9], [232, 196, 1], [318, 214, 0.8],
  [350, 238, 1], [262, 246, 0.8], [228, 258, 0.9], [300, 264, 0.7], [342, 194, 0.8],
];
const STARS_DIM: [number, number, number][] = [
  [30, 98, 0.8], [96, 88, 0.9], [160, 104, 0.7], [204, 90, 0.8], [62, 140, 0.7], [128, 152, 0.8],
  [190, 170, 0.7], [40, 196, 0.8], [104, 214, 0.7], [170, 236, 0.8], [22, 254, 0.7], [140, 262, 0.6],
];

const SUN_X = 276;
const SUN_Y = 168;

function Sun({ dim = false }: { dim?: boolean }) {
  if (dim) {
    return (
      <>
        <circle cx={SUN_X} cy={SUN_Y} r="34" fill="#fff6dc" fillOpacity=".08" />
        <circle cx={SUN_X} cy={SUN_Y} r="22" fill="#fff3d0" fillOpacity=".55" />
      </>
    );
  }
  return (
    <>
      <circle cx={SUN_X} cy={SUN_Y} r="46" fill="#fff" fillOpacity=".08" />
      <circle cx={SUN_X} cy={SUN_Y} r="32" fill="#fff" fillOpacity=".14" />
      <circle cx={SUN_X} cy={SUN_Y} r="22" fill="#ffd34d" />
      <circle cx={SUN_X - 4} cy={SUN_Y - 4} r="15" fill="#ffe68a" />
    </>
  );
}

function Moon({ dim = false }: { dim?: boolean }) {
  return (
    <g opacity={dim ? 0.55 : 1}>
      <circle cx={SUN_X} cy={SUN_Y} r="32" fill="#f5f0d8" fillOpacity=".08" />
      <circle cx={SUN_X} cy={SUN_Y} r="18" fill="#f5f0d8" />
      <circle cx={SUN_X - 6} cy={SUN_Y - 4} r="3.6" fill="#e3dcbc" />
      <circle cx={SUN_X + 4} cy={SUN_Y + 7} r="2.6" fill="#e3dcbc" />
      <circle cx={SUN_X + 6} cy={SUN_Y - 7} r="1.8" fill="#e3dcbc" />
    </g>
  );
}

function Stars({ few = false }: { few?: boolean }) {
  const bright = few ? STARS_BRIGHT.filter((_, i) => i % 2 === 0) : STARS_BRIGHT;
  const dim = few ? STARS_DIM.filter((_, i) => i % 3 === 0) : STARS_DIM;
  return (
    <>
      {bright.map(([x, y, r], i) => (
        <circle key={`b${i}`} cx={x} cy={y} r={r} fill="#fff" fillOpacity={0.7 + (i % 3) * 0.15} />
      ))}
      {dim.map(([x, y, r], i) => (
        <circle key={`d${i}`} cx={x} cy={y} r={r} fill="#fff" fillOpacity={0.35 + (i % 2) * 0.1} />
      ))}
    </>
  );
}

/** Deterministic rain streaks falling from the cloud bank on the right, down to the horizon. */
function rain(count: number, color: string, opacity: number) {
  let d = '';
  for (let i = 0; i < count; i++) {
    // R2 low-discrepancy sequence: evenly spread without lining up in rows, same on every render
    const x = Math.round(226 + ((0.5 + i * 0.7548777) % 1) * 134);
    const y = Math.round(226 + ((0.5 + i * 0.5698403) % 1) * 42);
    d += `M${x} ${y}l-4 11`;
  }
  return <path d={d} stroke={color} strokeOpacity={opacity} strokeWidth="1.5" strokeLinecap="round" />;
}

function Sky({ condition, night }: { condition: SkyCondition; night: boolean }) {
  switch (condition) {
    case 'clear-day':
    case 'clear-night':
      return night ? (
        <>
          <Stars />
          <path d={star(240, 228, 3.2, 0.8, 4) + star(336, 206, 2.6, 0.7, 4)} fill="#fff" fillOpacity=".85" />
          <Moon />
        </>
      ) : (
        <>
          <Sun />
          <Cloud x={234} y={222} s={0.75} opacity={0.85} />
          <Cloud x={306} y={242} s={0.5} opacity={0.7} />
        </>
      );
    case 'cloudy': {
      const [a, b, c] = night ? ['#4c5f77', '#5d708a', '#56697f'] : ['#c6d3df', '#eef3f7', '#e3eaf1'];
      const [sb, sc] = night ? ['#4a5c73', '#475a70'] : ['#d3dee8', '#cbd7e2'];
      return (
        <>
          {night ? (
            <>
              <Stars few />
              <Moon dim />
            </>
          ) : (
            <circle cx={SUN_X} cy={SUN_Y} r="20" fill="#ffe08a" fillOpacity=".75" />
          )}
          <Cloud x={318} y={172} s={0.8} fill={c} shade={sc} opacity={0.85} />
          <Cloud x={222} y={194} s={1.3} fill={a} />
          <Cloud x={262} y={222} s={1.6} fill={b} shade={sb} />
        </>
      );
    }
    case 'rain': {
      const [a, b, sb, c, sc, streak] = night
        ? ['#3a4a5e', '#4d5e73', '#405065', '#45576c', '#394a5e', '#9fb2c6']
        : ['#8c9eb0', '#aebcc9', '#97a8b8', '#a2b2c1', '#8ea0b2', '#dce8f3'];
      return (
        <>
          <Cloud x={222} y={184} s={1.5} fill={a} />
          <Cloud x={270} y={208} s={1.5} fill={b} shade={sb} />
          <Cloud x={236} y={228} s={1} fill={c} shade={sc} />
          {rain(26, streak, 0.6)}
        </>
      );
    }
    case 'storm': {
      const [a, b, sb, c, streak] = night
        ? ['#2c3747', '#3a4658', '#2f3a4b', '#344051', '#8fa2b6']
        : ['#566679', '#6f8095', '#5d6d82', '#66778b', '#dce8f3'];
      return (
        <>
          <Cloud x={222} y={182} s={1.6} fill={a} />
          <path d="M286 200l-12 26h9l-7 24 21-32h-9l7-18z" fill="#ffd34d" />
          <Cloud x={262} y={210} s={1.6} fill={b} shade={sb} />
          <Cloud x={306} y={238} s={0.8} fill={c} />
          {rain(34, streak, 0.6)}
        </>
      );
    }
    case 'fog':
      return night ? <Moon dim /> : <Sun dim />;
  }
}

/** Fog lies in the hollows: a haze that thickens toward the horizon plus thin banks on the right. */
function Fog({ id, night }: { id: string; night: boolean }) {
  const mist = night ? '#a9b6c3' : '#fff';
  return (
    <>
      <defs>
        <linearGradient id={`${id}h`} gradientUnits="userSpaceOnUse" x1="0" y1="262" x2="0" y2="320">
          <stop offset="0" stopColor={mist} stopOpacity="0" />
          <stop offset=".5" stopColor={mist} stopOpacity={night ? 0.4 : 0.55} />
          <stop offset="1" stopColor={mist} stopOpacity={night ? 0.2 : 0.3} />
        </linearGradient>
        {/* Banks fade in from their left tips, so they read as wisps rather than bars. */}
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={mist} stopOpacity="0" />
          <stop offset=".4" stopColor={mist} />
        </linearGradient>
      </defs>
      <rect y="262" width="360" height="58" fill={`url(#${id}h)`} />
      <g fill={`url(#${id}b)`}>
        <ellipse cx="392" cy="196" rx="170" ry="8" fillOpacity=".16" />
        <ellipse cx="404" cy="240" rx="180" ry="9" fillOpacity=".2" />
      </g>
      <ellipse cx="130" cy="282" rx="210" ry="8" fill={mist} fillOpacity=".22" />
    </>
  );
}

function SkySceneBase({ condition, night = false, fit = 'cover', className, style, title }: SkySceneProps) {
  const id = useSvgId();
  const isNight = night || condition === 'clear-night';
  const moods = MOODS[condition] ?? MOODS['clear-day'];
  const mood = moods[isNight ? 1 : 0];
  const [back, front, furrow] = mood.land;
  return (
    <svg
      viewBox="0 0 360 320"
      preserveAspectRatio={`xMidYMax ${fit === 'cover' ? 'slice' : 'meet'}`}
      className={className}
      style={{ display: 'block', ...(style as CSSProperties | undefined) }}
      xmlns="http://www.w3.org/2000/svg"
      {...a11y(title)}
    >
      <defs>
        <linearGradient id={`${id}s`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="320">
          <stop offset="0" stopColor={mood.sky[0]} />
          <stop offset=".78" stopColor={mood.sky[1]} />
          <stop offset=".92" stopColor={mood.sky[2]} />
        </linearGradient>
        {/* Text scrim: the readable side of the header is always the left. */}
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity=".28" />
          <stop offset=".65" stopColor="#000" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}f`}>
          <path d="M0 300c80-10 180-8 260 0 40 4 70 3 100 1v19H0z" />
        </clipPath>
      </defs>
      <rect width="360" height="320" fill={`url(#${id}s)`} />
      <Sky condition={condition} night={isNight} />
      <rect width="360" height="320" fill={`url(#${id}r)`} />
      <path d="M0 286c60-12 120-10 180-4 60 6 120-8 180-6v44H0z" fill={back} />
      <Tree x={58} y={285} s={0.7} tones={mood.tree} />
      <Palm x={312} y={280} s={0.72} color={mood.tree[1]} trunk={mood.tree[0]} />
      <Palm x={326} y={282} s={0.55} color={mood.tree[1]} trunk={mood.tree[0]} />
      <path d="M0 300c80-10 180-8 260 0 40 4 70 3 100 1v19H0z" fill={front} />
      <path
        d="M180 290L-160 320M180 290L-80 320M180 290L0 320M180 290L80 320M180 290L160 320M180 290L240 320M180 290L320 320M180 290L400 320M180 290L480 320M180 290L560 320"
        stroke={furrow}
        strokeWidth="2"
        clipPath={`url(#${id}f)`}
      />
      {condition === 'fog' && <Fog id={id} night={isNight} />}
    </svg>
  );
}

export const SkyScene = pure(SkySceneBase);
