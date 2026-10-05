// Farm landscape for splash, onboarding and login: dawn sky, mustard and wheat fields with
// furrows, trees and a palm on the horizon, and a farmer looking out over his field.
// The SVG has no width/height, so it fills its container's width; size it with className.
import type { CSSProperties } from 'react';
import { Birds, Cloud, Farmer, Hut, Palm, Tree, WheatTuft } from './parts';
import { a11y, pure, useSvgId } from './svg';
import type { ArtProps } from './svg';
import type { FarmSceneVariant } from './kinds';

export interface FarmSceneProps extends ArtProps {
  /**
   * splash: portrait, full-bleed, calm sky on top for the logo and title (anchored to the bottom).
   * welcome: 4:3 card for onboarding. header: 5:2 strip on brand-green sky for white text.
   */
  variant?: FarmSceneVariant;
  /** cover (default) crops to fill the box, keeping the ground in view; contain letterboxes. */
  fit?: 'cover' | 'contain';
}

const VIEW: Record<FarmSceneVariant, [w: number, h: number, align: string]> = {
  splash: [360, 640, 'xMidYMax'],
  welcome: [320, 240, 'xMidYMid'],
  header: [400, 160, 'xMidYMax'],
};

/** Furrow rows radiating from a vanishing point down to the bottom edge. */
function furrows(vx: number, vy: number, bottom: number, from: number, to: number, step: number): string {
  let d = '';
  for (let x = from; x <= to; x += step) d += `M${vx} ${vy}L${x} ${bottom}`;
  return d;
}

function Splash({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cdeefc" />
          <stop offset=".55" stopColor="#e8f6f0" />
          <stop offset=".72" stopColor="#fff1d2" />
        </linearGradient>
        <clipPath id={`${id}f`}>
          <path d="M0 476c90-16 190-10 280 2 40 6 60 6 80 4v158H0z" />
        </clipPath>
        <clipPath id={`${id}g`}>
          <path d="M0 534c90-18 210-12 360 10v96H0z" />
        </clipPath>
      </defs>
      <rect width="360" height="640" fill={`url(#${id}s)`} />
      <circle cx="262" cy="392" r="72" fill="#fff0c4" fillOpacity=".55" />
      <circle cx="262" cy="392" r="48" fill="#ffe08a" fillOpacity=".55" />
      <circle cx="262" cy="392" r="31" fill="#ffc94d" />
      {/* Clouds and birds stay below ~y 300 so the logo and title band above remains calm. */}
      <Cloud x={18} y={352} s={1} opacity={0.9} />
      <Cloud x={250} y={318} s={0.7} opacity={0.75} />
      <Birds x={96} y={372} />
      <path d="M0 404c50-20 110-18 170-6 50 10 100-6 150-8 20-1 32 2 40 4v246H0z" fill="#bfe0c6" />
      <Tree x={58} y={402} s={0.9} tones={['#6aa87c', '#7fb88f', '#9ccaa6']} />
      <Hut x={222} y={406} />
      <Palm x={300} y={394} s={1.1} color="#5f9e70" trunk="#86705a" />
      <Palm x={318} y={398} s={0.8} color="#5f9e70" trunk="#86705a" />
      <path d="M0 430c70-20 150-16 220-6 60 8 100-4 140-8v224H0z" fill="#9ccf97" />
      <Tree x={150} y={424} s={1.4} />
      <path d="M0 452c80-14 170-10 250 0 50 6 80 4 110-2v50H0z" fill="#f4cf3e" />
      <path d="M0 462c90-12 180-10 360 0" stroke="#f9e27e" strokeWidth="2" fill="none" />
      <path d="M0 476c90-16 190-10 280 2 40 6 60 6 80 4v158H0z" fill="#7cc062" />
      <path d={furrows(250, 470, 640, -260, 760, 40)} stroke="#6aae52" strokeWidth="2.2" clipPath={`url(#${id}f)`} />
      <path d="M0 534c90-18 210-12 360 10v96H0z" fill="#4ea44a" />
      <path d={furrows(250, 470, 640, -900, 1400, 70)} stroke="#43974a" strokeWidth="3" clipPath={`url(#${id}g)`} />
      <path d="M118 640c12-40 50-68 96-88 26-12 38-20 44-30l7 1c-3 11-13 23-33 35-36 22-62 48-66 82z" fill="#d8b07c" />
      <path d="M150 640c6-24 30-46 62-62" stroke="#e8c898" strokeWidth="3" fill="none" strokeLinecap="round" />
      <Farmer x={146} y={616} s={1.1} />
      <WheatTuft x={296} y={640} s={1.3} />
      <WheatTuft x={334} y={640} s={1.05} />
      <WheatTuft x={14} y={640} s={1.1} />
    </>
  );
}

function Welcome({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d6f1fc" />
          <stop offset=".55" stopColor="#fff3d8" />
        </linearGradient>
        <clipPath id={`${id}f`}>
          <path d="M0 156c80-10 170-6 250 4 35 4 55 4 70 3v77H0z" />
        </clipPath>
      </defs>
      <rect width="320" height="240" fill={`url(#${id}s)`} />
      <circle cx="244" cy="70" r="42" fill="#fff0c4" fillOpacity=".6" />
      <circle cx="244" cy="70" r="29" fill="#ffe08a" fillOpacity=".6" />
      <circle cx="244" cy="70" r="19" fill="#ffc94d" />
      <Cloud x={28} y={62} s={0.75} opacity={0.95} />
      <Cloud x={136} y={40} s={0.5} opacity={0.8} />
      <Birds x={92} y={86} s={0.8} />
      <path d="M0 128c40-16 90-14 140-6 50 8 100-8 150-10 15 0 25 2 30 3v125H0z" fill="#bfe0c6" />
      <Tree x={44} y={126} s={0.75} tones={['#6aa87c', '#7fb88f', '#9ccaa6']} />
      <Hut x={196} y={124} s={0.75} />
      <Palm x={276} y={116} s={0.85} color="#5f9e70" trunk="#86705a" />
      <path d="M0 140c70-10 150-8 230 0 40 4 70 3 90 0v30H0z" fill="#f4cf3e" />
      <path d="M0 156c80-10 170-6 250 4 35 4 55 4 70 3v77H0z" fill="#7cc062" />
      <path d={furrows(150, 140, 240, -200, 520, 34)} stroke="#6aae52" strokeWidth="1.8" clipPath={`url(#${id}f)`} />
      <path d="M0 196c80-10 200-6 320 8v36H0z" fill="#4ea44a" />
      <path d="M150 240c6-20 24-36 46-48 12-7 18-12 20-18l5 .6c-1 7-7 14-19 22-20 13-32 27-36 44z" fill="#d8b07c" />
      <Farmer x={236} y={222} s={0.82} />
      <WheatTuft x={18} y={240} s={0.95} />
      <WheatTuft x={46} y={240} s={0.75} />
      <WheatTuft x={298} y={240} s={0.8} />
    </>
  );
}

function Header({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#14532d" />
          <stop offset="1" stopColor="#1b6a3a" />
        </linearGradient>
        <clipPath id={`${id}c`}>
          <path d="M0 128c70-12 150-10 230-2 60 6 120-2 170-6v40H0z" />
        </clipPath>
      </defs>
      <rect width="400" height="160" fill={`url(#${id}s)`} />
      <circle cx="306" cy="104" r="44" fill="#f6c35a" fillOpacity=".08" />
      <circle cx="306" cy="104" r="29" fill="#f6c35a" fillOpacity=".16" />
      <circle cx="306" cy="104" r="17" fill="#f6c35a" fillOpacity=".95" />
      <path d="M0 112c50-14 110-12 170-4 60 8 120-10 180-10 20 0 40 3 50 5v57H0z" fill="#1e7039" />
      <Tree x={64} y={110} s={0.75} tones={['#165a30', '#1a6334', '#22713d']} />
      <Palm x={352} y={100} s={0.8} color="#1a6334" trunk="#1a6334" />
      <Palm x={366} y={102} s={0.6} color="#1a6334" trunk="#1a6334" />
      <path d="M0 128c70-12 150-10 230-2 60 6 120-2 170-6v40H0z" fill="#268443" />
      <path d={furrows(200, 118, 160, -300, 700, 34)} stroke="#2f954d" strokeWidth="1.6" clipPath={`url(#${id}c)`} />
      <path d="M0 146c90-10 210-8 400 4v10H0z" fill="#34a055" />
    </>
  );
}

function FarmSceneBase({ variant = 'splash', fit = 'cover', className, style, title }: FarmSceneProps) {
  const id = useSvgId();
  const [w, h, align] = VIEW[variant];
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio={`${align} ${fit === 'cover' ? 'slice' : 'meet'}`}
      className={className}
      style={{ display: 'block', ...(style as CSSProperties | undefined) }}
      xmlns="http://www.w3.org/2000/svg"
      {...a11y(title)}
    >
      {variant === 'splash' ? <Splash id={id} /> : variant === 'welcome' ? <Welcome id={id} /> : <Header id={id} />}
    </svg>
  );
}

export const FarmScene = pure(FarmSceneBase);
