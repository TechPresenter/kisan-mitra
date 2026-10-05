// The sun at the top-right of the Home weather card. White halos keep it soft on the sky-blue
// gradient; an optional cloud gives a "partly sunny" variant without a second asset.
import { Cloud } from './parts';
import { a11y, pure, useSvgId } from './svg';
import type { ArtProps } from './svg';

export interface SunGlyphProps extends ArtProps {
  /** Rendered width and height in px. */
  size?: number;
  /** Adds a cloud drifting across the lower left (partly cloudy). */
  cloud?: boolean;
}

// Alternating long/short rays, computed once at module load.
const RAYS = Array.from({ length: 12 }, (_, i) => {
  const a = (i * Math.PI) / 6;
  const [r1, r2] = i % 2 ? [34, 38.5] : [33, 42];
  const p = (r: number) => `${+(60 + r * Math.cos(a)).toFixed(1)} ${+(60 + r * Math.sin(a)).toFixed(1)}`;
  return `M${p(r1)}L${p(r2)}`;
}).join('');

function SunGlyphBase({ size = 96, cloud = false, className, style, title }: SunGlyphProps) {
  const id = useSvgId();
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={className} style={style} xmlns="http://www.w3.org/2000/svg" {...a11y(title)}>
      <defs>
        <radialGradient id={id} cx=".38" cy=".34" r=".72">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset=".45" stopColor="#ffd34d" />
          <stop offset="1" stopColor="#f59e0b" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="56" fill="#fff" fillOpacity=".1" />
      <circle cx="60" cy="60" r="45" fill="#fff" fillOpacity=".14" />
      <path d={RAYS} stroke="#ffd54f" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="60" cy="60" r="27" fill={`url(#${id})`} />
      <ellipse cx="50" cy="48" rx="8" ry="4.6" transform="rotate(-35 50 48)" fill="#fff" fillOpacity=".45" />
      {cloud && <Cloud x={6} y={101} s={1.5} shade="#dbe9f6" />}
    </svg>
  );
}

export const SunGlyph = pure(SunGlyphBase);
