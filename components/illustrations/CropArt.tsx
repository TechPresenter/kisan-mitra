// Crop thumbnails: one hand-drawn flat vector per canonical crop key on a soft tinted tile,
// standing in for the stock photos of the reference lists. Every piece lives on a 64×64 grid,
// is lit from the top-left (light / base / shade tones) and avoids outlines, so the set reads
// as one family at 40–56px. Repeated small shapes (seeds, grains, florets) share one <path>
// per colour to keep each crop under ~2.5 KB of markup.
import type { ReactNode } from 'react';
import { isCropKey } from '../../data/crop-keys';
import type { CropKey } from '../../data/crop-keys';
import { a11y, pure, rot, star } from './svg';
import type { ArtProps } from './svg';

export interface CropArtProps extends ArtProps {
  /** Crop key from data/crop-keys.ts. Unknown keys get the sprout fallback. */
  crop: string;
  /** Rendered width and height in px. */
  size?: number;
  /** Rounded-square tile (12px at 56px). false gives square corners for callers that clip. */
  rounded?: boolean;
  /** false drops the tinted tile, leaving the crop (and its soft ground shadow) on transparent. */
  background?: boolean;
}

interface Art {
  bg: string;
  draw: () => ReactNode;
}

type Shape = [d: string, fill: string];

// ---------- drawing helpers ----------

const n1 = (v: number) => +v.toFixed(1);

/** Numbers in SVG path shorthand: 1 decimal, no leading zero, no space before a minus. */
const nums = (...v: number[]) =>
  v.reduce<string>((acc, x, i) => {
    const s = String(n1(x)).replace(/^(-?)0\./, '$1.');
    return acc + (i && s[0] !== '-' ? ' ' : '') + s;
  }, '');

const ov = (x: number, y: number, rx: number, ry: number, fill: string, deg = 0) => (
  <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={fill} transform={rot(deg, x, y)} />
);

const shadow = (rx = 16, cy = 56) => <ellipse cx="32" cy={cy} rx={rx} ry="2.6" fill="#000" fillOpacity=".07" />;

const line = (d: string, stroke: string, width = 1, extra?: { strokeDasharray?: string; strokeOpacity?: number }) => (
  <path d={d} stroke={stroke} strokeWidth={width} strokeLinecap="round" fill="none" {...extra} />
);

/** Circle as a path fragment. */
const circ = (x: number, y: number, r: number) =>
  `M${nums(x - r, y)}a${nums(r, r)} 0 1 0 ${nums(2 * r)} 0a${nums(r, r)} 0 1 0 ${nums(-2 * r)} 0`;

/** Rotated ellipse as a path fragment (two half-arcs along the rotated x axis). */
function ell(x: number, y: number, rx: number, ry: number, deg = 0): string {
  const a = (deg * Math.PI) / 180;
  // Pad the chord past the rounding error: a chord even slightly shorter than the diameter
  // makes the two large arcs bulge from offset centres and self-intersect into a ring.
  const dx = n1((2 * rx + 0.1) * Math.cos(a));
  const dy = n1((2 * rx + 0.1) * Math.sin(a));
  const arc = `a${nums(rx, ry, deg)} 1 0 `;
  return `M${nums(x - dx / 2, y - dy / 2)}${arc}${nums(dx, dy)}${arc}${nums(-dx, -dy)}`;
}

/** One <path> per colour, painted in order of first use. */
function byTone(shapes: Shape[], key = ''): ReactNode[] {
  const m = new Map<string, string>();
  for (const [d, f] of shapes) m.set(f, (m.get(f) ?? '') + d);
  return [...m].map(([f, d]) => <path key={key + f} d={d} fill={f} />);
}

/** Mound of small seeds (dals). Rows go back to front; rotation and jitter are deterministic. */
function pile(rows: [y: number, count: number][], rx: number, ry: number, tones: string[], eye?: string): ReactNode[] {
  const seeds: Shape[] = [];
  let eyes = '';
  const step = rx * 2;
  rows.forEach(([y, n], r) => {
    for (let i = 0; i < n; i++) {
      const x = 32 - ((n - 1) * step) / 2 + i * step + (((i * 3 + r) % 3) - 1) * 0.5;
      const yy = y + (((i + r) % 2) - 0.5) * 0.8;
      const deg = (((r * 5 + i * 7) % 9) - 4) * 20;
      seeds.push([ell(x, yy, rx, ry, deg), tones[(r + i * 2) % tones.length]]);
      // The hilum is a thin sliver near one edge; centred, it reads as a donut.
      const a = (deg * Math.PI) / 180;
      if (eye && (r + i) % 2) eyes += ell(x - Math.sin(a) * ry * 0.45, yy + Math.cos(a) * ry * 0.45, n1(rx * 0.55), 0.35, deg);
    }
  });
  const out = byTone(seeds, 'p');
  if (eye && eyes) out.push(<path key="eye" d={eyes} fill={eye} />);
  return out;
}

/** Grains strung along a cubic Bézier (x0 y0 x1 y1 x2 y2 x3 y3), alternating sides like a panicle. */
function beads(c: number[], n: number, rx: number, ry: number, tones: string[], spread = 1.4): Shape[] {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = c;
  const out: Shape[] = [];
  for (let i = 0; i < n; i++) {
    const t = 0.12 + (0.88 * i) / (n - 1);
    const u = 1 - t;
    const px = u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3;
    const py = u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3;
    const tx = 3 * u * u * (x1 - x0) + 6 * u * t * (x2 - x1) + 3 * t * t * (x3 - x2);
    const ty = 3 * u * u * (y1 - y0) + 6 * u * t * (y2 - y1) + 3 * t * t * (y3 - y2);
    const len = Math.hypot(tx, ty) || 1;
    const side = i % 2 ? 1 : -1;
    const deg = Math.round((Math.atan2(-tx, ty) * 180) / Math.PI + side * 18);
    // ell() rotates the x axis; grains are long along y, so turn a further 90°.
    out.push([ell(px - (ty / len) * spread * side, py + (tx / len) * spread * side, ry, rx, deg + 90), tones[i % tones.length]]);
  }
  return out;
}

/** Grass-family ear: paired grains up an axis, with optional awns [colour, length]. */
function ear(rows: number[], gx: number, rx: number, ry: number, tilt: number, tones: [string, string, string], awn?: [string, number]): ReactNode[] {
  const [light, base, back] = tones;
  const out: ReactNode[] = [];
  if (awn) {
    const s = Math.sin((tilt * Math.PI) / 180);
    const c = Math.cos((tilt * Math.PI) / 180);
    let d = '';
    for (const y of rows) {
      const tipY = n1(y - ry * c);
      d += `M${n1(32 - gx - ry * s)} ${tipY}l${n1(-awn[1] * s * 0.9)} ${n1(-awn[1] * c)}`;
      d += `M${n1(32 + gx + ry * s)} ${tipY}l${n1(awn[1] * s * 0.9)} ${n1(-awn[1] * c)}`;
    }
    out.push(<path key="a" d={d} stroke={awn[0]} strokeWidth=".8" strokeLinecap="round" fill="none" />);
  }
  const grains: Shape[] = [];
  for (const y of rows) {
    grains.push([ell(32, y - 1, n1(ry * 0.85), n1(rx * 0.8), 90), back]);
    grains.push([ell(32 - gx, y, ry, rx, 90 - tilt), light]);
    grains.push([ell(32 + gx, y, ry, rx, 90 + tilt), base]);
  }
  return out.concat(byTone(grains, 'g'));
}

/** Bumpy legume pod along +x: one bump per seed every 6.5 units, tip at the end. */
function pod(seeds: number, w = 3.4): string {
  return (
    `M0 0c0-${w} 2-${n1(w + 0.6)} 3.2-${w}` +
    'c1.3-1 4.3-1 6.5 0'.repeat(seeds - 1) +
    `l6.3 ${w}c-5 ${n1(w + 0.4)}-6 ${w}-6.3 ${w}` +
    'c-2.2 1-5.3 1-6.5 0'.repeat(seeds - 1) +
    `C1 ${w} 0 ${n1(w - 1)} 0 0z`
  );
}

/** Small leaflets, each [x, y, deg], sharing the given size. */
const leaflets = (pts: number[][], rx: number, ry: number, tones: string[]) =>
  byTone(pts.map(([x, y, d], i) => [ell(x, y, ry, rx, d + 90), tones[i % tones.length]]), 'lf');

const leafL = (fill: string) => <path d="M31 57c-4-7-11-11-21-12 9-2 17 1 22 7z" fill={fill} />;
const leafR = (fill: string) => <path d="M33 57c4-7 11-11 21-12-9-2-17 1-22 7z" fill={fill} />;

/** Chickpeas (round with a little beak) for one row; rows are drawn back to front. */
function peas(pts: number[][]): ReactNode {
  let base = '';
  let lit = '';
  let crease = '';
  for (const [x, y] of pts) {
    base += circ(x, y, 6) + `M${nums(x - 4.6, y - 3.4)}l-1.8-2.2 3.2.6z`;
    lit += circ(x - 1, y - 1.1, 4.7);
    crease += `M${n1(x - 3.6)} ${n1(y - 2.4)}c1.5 1.8 3.5 3 6 3.2`;
  }
  return (
    <>
      <path d={base} fill="#d3a465" />
      <path d={lit} fill="#ebc88c" />
      {line(crease, '#c09055', 0.7)}
    </>
  );
}

/** Soybeans: cream with a brown hilum; one row at a time for correct overlap. */
function beans(pts: number[][]): ReactNode {
  return byTone(
    pts.flatMap(([x, y]): Shape[] => [
      [circ(x, y, 5.6), '#d9b55a'],
      [circ(x - 0.9, y - 1, 4.3), '#f0d27e'],
      [ell(x + 2.4, y + 2.2, 1.5, 0.7, -40), '#8a6a3a'],
    ]),
    `b${pts[0][0]}`,
  );
}

const DOT = { strokeDasharray: '.01 3.4' };

// ---------- the crops ----------

const ART: Record<CropKey, Art> = {
  wheat: {
    bg: '#fbefcf',
    draw: () => (
      <>
        {shadow(12)}
        {line('M32 56c-1-9-.4-17 0-26', '#c48d2c', 2)}
        <path d="M31.5 50c-7-1-13-6-15-13 6 1 12 6 15 13z" fill="#e2b847" />
        <path d="M32.3 45c6-2 11-7 12-13-6 2-10 7-12 13z" fill="#cf9a2e" />
        {ear([31, 25.5, 20, 14.5], 3.6, 3.3, 5.3, 24, ['#f4cb5e', '#e0a83a', '#c58a22'], ['#d9a943', 8])}
        {ov(32, 9, 2.7, 4.8, '#f4cb5e')}
        {line('M32 4.5V1.8', '#d9a943', 0.8)}
      </>
    ),
  },
  paddy: {
    bg: '#e7f4dd',
    draw: () => (
      <>
        {shadow(13)}
        <path d="M30 58c-2-12-4-23-8-33 6 9 9 20 10 31z" fill="#7cbf55" />
        {line('M31 58c0-18 2-32 8-41 3-5 6-7 9-6M42.5 12.6c3 4 4 12 2 21M48 11c4 2 7 7 8 15M46 11.4c4 4 6 12 5 22', '#a3a63c', 1.2)}
        {byTone([
          ...beads([42.5, 12.6, 45.5, 16.6, 46.5, 24.6, 44.5, 33.6], 6, 1.8, 3.1, ['#e9c75c', '#d3a83a', '#c9c25a']),
          ...beads([46, 11.4, 50, 15.4, 52, 23.4, 51, 33.4], 7, 1.8, 3.1, ['#d3a83a', '#e9c75c', '#e0b84a']),
          ...beads([48, 11, 52, 13, 55, 18, 56, 26], 5, 1.7, 3, ['#e9c75c', '#c9c25a', '#d3a83a']),
        ])}
        <path d="M30 58c-4-12-12-21-21-24 10 1 18 8 23 21z" fill="#4f9d3a" />
        <path d="M32 58c3-9 9-15 18-18-8 4-13 10-16 18z" fill="#2f7a32" />
      </>
    ),
  },
  maize: {
    bg: '#fdf1c7',
    draw: () => (
      <>
        {shadow(15)}
        <g transform="rotate(28 32 34)">
          <path d="M32 6c5.5 0 8 5 8 13v17c0 6-3.5 10-8 10s-8-4-8-10V19c0-8 2.5-13 8-13z" fill="#e3a024" />
          {line('M27.4 14v26', '#fbd66c', 3.2, DOT)}
          {line('M30.8 10v32.5', '#f8cb4f', 3.2, DOT)}
          {line('M34.2 10v32.5', '#f2bd3c', 3.2, DOT)}
          {line('M37.4 14v26', '#e8ad30', 3.2, DOT)}
          <path d="M31 60c-9-6-12-18-9-34 2 12 5 20 11 24z" fill="#8fc35a" />
          <path d="M33 60c-11-4-16-15-13-32 3 14 7 21 14 26z" fill="#5fa53d" />
          <path d="M31 60c11-4 16-15 13-31-3 13-7 20-14 25z" fill="#3f8a35" />
        </g>
      </>
    ),
  },
  bajra: {
    bg: '#f1ecdc',
    draw: () => (
      <>
        {shadow(13)}
        {line('M39 38c1 7 0 13-4 19M30 38c0 7 0 13 2 19', '#7aa83f', 2)}
        <g transform="rotate(14 41 38)">
          <rect x="37.5" y="12" width="7.5" height="27" rx="3.75" fill="#8f7a48" />
          {line('M39.6 15v21M42.8 15v21', '#b19d68', 2, { strokeDasharray: '.01 2.3' })}
        </g>
        <g transform="rotate(-8 31 40)">
          <rect x="26.5" y="6" width="9" height="33" rx="4.5" fill="#a38d58" />
          {line('M28.8 9v27', '#d8c58f', 2.2, { strokeDasharray: '.01 2.4' })}
          {line('M31 8v29', '#c6b27a', 2.2, { strokeDasharray: '.01 2.4' })}
          {line('M33.2 9v27', '#b39e68', 2.2, { strokeDasharray: '.01 2.4' })}
        </g>
        {leafL('#5a9e3c')}
        {leafR('#3f8a35')}
      </>
    ),
  },
  jowar: {
    bg: '#fbeadc',
    draw: () => (
      <>
        {shadow(13)}
        {line('M32 34c1 8 0 15-1 22', '#7aa83f', 2.2)}
        {byTone(
          [
            [30, 10, 1], [34.5, 10.5, 2], [26.5, 14.5, 0], [31, 14, 1], [35.5, 14.5, 2], [24, 19, 0], [28.5, 18.5, 1],
            [33, 18.5, 1], [37.8, 19, 2], [25, 23.5, 0], [29.5, 23, 1], [34, 23, 2], [38.5, 23.5, 2], [27, 28, 1],
            [31.5, 27.5, 1], [36, 28, 2], [30, 32, 1], [34, 32, 2],
          ].map(([x, y, t]): Shape => [circ(x, y, 3.3), ['#e38a4b', '#cd6c34', '#ad5126'][t]]),
        )}
        {line('M27.5 13.6h0M24.2 18h0M25.2 22.6h0M29.8 9.2h0M29 18h0', '#f6b27c', 2)}
        <path d="M31.5 46c-5-6-12-9-21-8 8-3 16-1 22 4z" fill="#5a9e3c" />
        <path d="M32 52c5-7 12-11 22-11-9-2-17 1-23 7z" fill="#3f8a35" />
      </>
    ),
  },
  barley: {
    bg: '#eaf1dc',
    draw: () => (
      <>
        {shadow(12)}
        <g transform="rotate(10 32 50)">
          {line('M32 57c0-5 0-9 .5-13', '#a8933c', 2)}
          <path d="M31.5 55c-6-1-11-5-13-11 6 1 11 5 13 11z" fill="#8fae48" />
          {ear([44, 39.5, 35, 30.5, 26, 21.5], 2.9, 2.5, 4.3, 14, ['#e8cf72', '#cfae48', '#b08f32'], ['#c9ab4a', 17])}
          {ov(32, 17.5, 2.2, 4, '#e8cf72')}
          {line('M32 13.5V4', '#c9ab4a', 0.8)}
        </g>
      </>
    ),
  },
  gram: {
    bg: '#eef5e2',
    draw: () => (
      <>
        {shadow(19, 55)}
        {line('M12 28c10-4 22-10 36-18', '#6a9e3e', 1.4)}
        {leaflets([[18, 25, -40], [24, 22, 40], [26, 18.5, -40], [32, 16, 40], [35, 12, -30]], 1.6, 3.2, ['#6aac4c', '#4f9640'])}
        <g transform="rotate(-25 42 21)">
          {ov(42, 21, 7.5, 5, '#86b44e')}
          {ov(41, 19.8, 6, 3.6, '#a8cf6c')}
        </g>
        {peas([[22, 42], [35, 40], [46.5, 45]])}
        {peas([[28, 50], [40.5, 51]])}
      </>
    ),
  },
  arhar: {
    bg: '#fbf0d9',
    draw: () => {
      // Pods as strokes: a round-capped body plus dotted bumps gives arhar's constricted
      // "string of seeds" look, and all three pods share the same few paths.
      let body = '';
      let bumps = '';
      let shade = '';
      let shadeBumps = '';
      let lit = '';
      let blots = '';
      for (const [x, y, deg] of [[21, 11.6, 104], [31, 13, 86], [41, 12.8, 66]]) {
        const a = (deg * Math.PI) / 180;
        const [ux, uy] = [Math.cos(a), Math.sin(a)];
        // Point t along the pod, offset sideways (positive = shaded right-hand side).
        const p = (t: number, off: number): [number, number] => [x + ux * t + uy * off, y + uy * t - ux * off];
        const seg = (t0: number, t1: number, off: number) => `M${nums(...p(t0, off))}L${nums(...p(t1, off))}`;
        shade += seg(1, 27, 1);
        shadeBumps += seg(3.2, 22.7, 1);
        body += seg(1, 27, -0.4);
        bumps += seg(3.2, 22.7, -0.4);
        lit += seg(5, 24, -1.8);
        blots += ell(...p(9.7, 0), 2, 1.3, deg + 20) + ell(...p(22.7, 0.3), 1.7, 1.1, deg - 10);
      }
      const BUMP = { strokeDasharray: '.01 6.5' };
      return (
        <>
          {shadow(16, 56)}
          {line('M6 10c10 1 20 3 34 3 6 0 10-1 13-3', '#7c7a3a', 1.6)}
          {leaflets([[12, 6.5, -60], [9, 15, 50], [16.5, 15, -15]], 2.6, 4.6, ['#5a9e3c', '#4b8f35', '#6aac4c'])}
          {line(shade, '#6b993b', 4.6)}
          {line(shadeBumps, '#6b993b', 6.2, BUMP)}
          {line(body, '#8bb84d', 3.6)}
          {line(bumps, '#8bb84d', 5.2, BUMP)}
          {line(lit, '#b4d77a', 0.9)}
          <path d={blots} fill="#8a3550" />
          <path d={star(54, 10, 4.2, 2.1, 5)} fill="#f6c33b" />
          <circle cx="54" cy="10" r="1.3" fill="#d2552c" />
          {pile([[49, 3], [53, 5]], 2.6, 2, ['#f2c64a', '#e2a92e', '#f7d775'])}
        </>
      );
    },
  },
  moong: {
    bg: '#e5f3e0',
    draw: () => (
      <>
        {shadow(18, 55)}
        {line('M10 32c10-10 22-17 40-19', '#3c7d2c', 3.4)}
        {line('M11.5 30.6c9-9 20-15.3 36.5-17.3', '#5e9e3c', 1.8, { strokeDasharray: '3 1.4' })}
        {line('M18 36c8-11 17-19 30-24', '#336f27', 3)}
        {pile([[38, 3], [42, 5], [46, 6], [50.5, 7]], 2.6, 1.8, ['#4fae3a', '#3a922c', '#75c454'])}
      </>
    ),
  },
  urad: {
    bg: '#eceee6',
    draw: () => (
      <>
        {shadow(18, 55)}
        {line('M12 30c9-8 19-13 32-15', '#4d5b32', 3.6)}
        {line('M14 29c8-7 17-11 28-13', '#66744a', 1.4, { strokeDasharray: '2.6 1.6' })}
        {line('M20 34c7-9 15-15 26-18', '#3d4a28', 3.2)}
        {pile([[38, 3], [42, 5], [46, 6], [50.5, 7]], 2.6, 1.9, ['#2b2a27', '#3e3b36', '#1d1c1a'], '#efe9dc')}
      </>
    ),
  },
  masoor: {
    bg: '#fdebdf',
    draw: () => (
      <>
        {shadow(18, 55)}
        {line('M14 34c8-8 18-14 32-18', '#6aa04a', 1.3)}
        {leaflets([[20, 30, -40], [22.5, 25.5, 40], [28, 26, -40], [30, 21.5, 40], [36, 22, -40], [37.5, 17.6, 40]], 1.3, 2.8, ['#77b158', '#5b9a43'])}
        {ov(46, 15.5, 4, 2.6, '#a5c86a', -20)}
        {pile([[38, 3], [42, 5], [46, 6], [50.5, 7]], 2.7, 2.2, ['#f08a4b', '#e2703a', '#f6a76b'])}
      </>
    ),
  },
  mustard: {
    bg: '#fcf6cf',
    draw: () => {
      const flowers = [
        [32, 12.5, 0], [27, 15, 1], [37, 15.2, 0], [23.4, 19.5, 0], [29.6, 18.6, 0], [35.2, 19.4, 1], [41, 20.4, 0],
        [26, 23.6, 1], [32.4, 23.6, 0], [38.6, 24.4, 1], [20, 25.6, 0], [44, 17, 1],
      ];
      // Each floret is a round-capped "+" (four petals) with a dot centre.
      const petals = (tone: number) =>
        flowers.filter((f) => f[2] === tone).map(([x, y]) => `M${n1(x - 2.3)} ${y}h4.6M${x} ${n1(y - 2.3)}v4.6`).join('');
      return (
        <>
          {shadow(14)}
          {line('M32 56c0-12-1-24 0-36M32 40c-4-5-7-9-9-15M32 34c4-5 7-9 9-15', '#5f9a3a', 1.8)}
          {line('M31.6 47l-6-5M32.4 44l6-5.4M31.6 38.5l-5.5-6M32.4 51l5.6-4.2M23.6 30l-5-3M40.6 25l5-3', '#7cb04a', 1.4)}
          {line(petals(0), '#f5c21b', 2.7)}
          {line(petals(1), '#ffdd55', 2.7)}
          {line(flowers.map(([x, y]) => `M${x} ${y}h0`).join(''), '#d98e0b', 1.5)}
          {line('M29 9.5h0M35 10h0M32 8h0', '#d6d24a', 2.6)}
          <path d="M31 57c-6 0-13-4-15-11 6 0 12 3 15 9z" fill="#4f9d3a" />
          <path d="M33 57c6 0 13-4 15-11-6 0-12 3-15 9z" fill="#3f8a35" />
        </>
      );
    },
  },
  soybean: {
    bg: '#eff4dc',
    draw: () => {
      const shape = pod(3, 3.6);
      return (
        <>
          {shadow(18, 56)}
          {line('M6 8c4 6 12 12 28 18', '#7c8a3a', 1.6)}
          {leaflets([[11, 6.5, -75], [6.5, 15.5, 20], [15.5, 14.5, -35]], 3.4, 6.2, ['#5a9e3c', '#3f8a35', '#6aac4c'])}
          {[[20, 17, 70], [27, 21.4, 50], [33, 26, 25]].map(([x, y, d], i) => (
            <g key={i} transform={`translate(${x} ${y}) rotate(${d})`}>
              {/* A pale rim stroke reads as the pod's fuzz. */}
              <path d={shape} fill={['#9cb84e', '#87a83f', '#adc464'][i]} stroke="#d6e0a4" strokeWidth="1.4" />
              <path d="M1.5 1.8c6 2.2 12 2.4 18 .2" stroke="#7d9a37" strokeWidth="2" fill="none" />
            </g>
          ))}
          {beans([[31, 41.5], [44, 42]])}
          {beans([[26, 48], [37.5, 49.5]])}
        </>
      );
    },
  },
  groundnut: {
    bg: '#f6ebdc',
    draw: () => {
      const shell = (x: number, y: number, d: number) => (
        <g transform={`translate(${x} ${y}) rotate(${d})`}>
          <path d="M0-12c4 0 6.4 3 6.4 6.4 0 3-2.2 4-2.2 5.6s2.2 2.6 2.2 6c0 3.6-2.8 6-6.4 6s-6.4-2.4-6.4-6c0-3.4 2.2-4.4 2.2-6S-6.4-2.6-6.4-5.6C-6.4-9-4-12 0-12z" fill="#d7a76d" />
          <path d="M0-12c4 0 6.4 3 6.4 6.4 0 3-2.2 4-2.2 5.6s2.2 2.6 2.2 6c0 3.6-2.8 6-6.4 6 3-1.6 3.6-4 3.4-6.4-.2-2.4-1.8-3.6-1.8-5.2s1.8-2.6 1.8-5.4C3.4-8.6 2.4-11 0-12z" fill="#c18d55" />
          {line('M-3.6-7l2.4 1.8 2.6-1.8M-3.6-3.4l2.4 1.6 2.6-1.6M-3.6 4.4 1.2 6 3.8 4.4M-3.6 8l2.4 1.6 2.6-1.6', '#b07c45', 0.7)}
        </g>
      );
      // Two red-skinned kernels: skin, lit side, pale germ tip.
      const kernels: Shape[] = [
        [ell(29, 47, 5.2, 3.6, 30) + ell(38.5, 48, 5.2, 3.6, 160), '#b8503b'],
        [ell(27.7, 47.2, 3.6, 2.4, 30) + ell(39.2, 46.9, 3.6, 2.4, 160), '#d26b52'],
        [ell(25.2, 44.8, 1, 0.7, 30) + ell(42.6, 46.5, 1, 0.7, 160), '#f1d3b0'],
      ];
      return (
        <>
          {shadow(18, 55)}
          {shell(23, 30, -28)}
          {shell(40, 30, 22)}
          {byTone(kernels)}
        </>
      );
    },
  },
  cotton: {
    bg: '#e3effa',
    draw: () => {
      const lobes = [[25, 24.5, 7.6], [39, 24.5, 7.6], [26, 35, 7.6], [38, 35, 7.6], [32, 29.5, 6.6]];
      return (
        <>
          {shadow(14)}
          {line('M32 56c1-7 1-12 0-18', '#7a5235', 2)}
          <path d="M31 48c-6 2-13 0-16-5 3 0 5-1 6-3-3-1-5-4-5-7 4 1 7 3 8.5 6 .3-3 1.5-5.5 3.5-7.5 2 4 3 9 3 16.5z" fill="#4f9d3a" />
          <path d={star(32, 29, 17, 8, 5, -54)} fill="#7d4f33" />
          {lobes.map(([x, y, r], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={r} fill="#dfe7ef" />
              <circle cx={x - 1.1} cy={y - 1.2} r={r - 1.8} fill="#fff" />
            </g>
          ))}
        </>
      );
    },
  },
  sugarcane: {
    bg: '#e8f4e2',
    draw: () => {
      const cane = (x: number, w: number, deg: number, base: string, shade: string, node: string) => (
        <g transform={`rotate(${deg} ${x + w / 2} 40)`}>
          <rect x={x} y="10" width={w} height="56" rx="2" fill={base} />
          <rect x={x + w * 0.62} y="10" width={w * 0.38} height="56" fill={shade} />
          {line(`M${x} 22h${w}M${x} 33h${w}M${x} 44h${w}M${x} 55h${w}`, node, 1.6)}
        </g>
      );
      return (
        <>
          {cane(35, 6, 13, '#87405f', '#6a2f4b', '#4a1f35')}
          {cane(24, 7, -9, '#bfd35a', '#9cb743', '#7a9630')}
          <path d="M28 12c-7-5-15-4-21 2 8-3 14-2 21 1z" fill="#4f9d3a" />
          <path d="M28.5 11c4-7 12-9 21-6-8 0-14 3-19 8z" fill="#3f8a35" />
          <path d="M37 14c7-4 15-2 21 4-7-3-13-3-20-1z" fill="#6bb24a" />
          <path d="M27 13c-4-6-4-10-1-13-.4 5 .6 9 2.6 12z" fill="#5aa840" />
        </>
      );
    },
  },
  potato: {
    bg: '#f4eadb',
    draw: () => (
      <>
        {shadow(19, 54)}
        {ov(41, 32, 11, 8.5, '#bd8749', 20)}
        {ov(39.8, 30.6, 9, 6.6, '#d6a865', 20)}
        {ov(27, 41, 15.5, 11, '#c38d4d', -12)}
        {ov(25.4, 39.2, 12.8, 8.6, '#dcae6c', -12)}
        {line('M19 37.5q1.6-1 3.2 0M30 35q1.4-.9 2.8.2M25 45q1.5-.8 3 .2M36.5 42q1.2-1 2.6-.2M42 28q1.2-.9 2.6 0M45 35q1-.8 2.2.1', '#9d6a35', 1)}
        {ov(20.5, 34, 3, 1.6, '#fff', -20)}
        {line('M12 52h0M50 51h0M54 47h0', '#a87442', 1.6)}
      </>
    ),
  },
  onion: {
    bg: '#f8e7ee',
    draw: () => (
      <>
        {shadow(15, 57)}
        <path d="M31 16l1-8 1.8 8z" fill="#c9a06a" />
        <path d="M32 15c1.5 5 4 7 8 9.5 6 3.5 10 8.5 10 15.5 0 9-8 16-18 16s-18-7-18-16c0-7 4-12 10-15.5 4-2.5 6.5-4.5 8-9.5z" fill="#c94f74" />
        <path d="M32 56c10 0 18-7 18-16 0-7-4-12-10-15.5 4 5.5 5 11.5 4 17.5-1 7-6 12-12 14z" fill="#a83a5e" />
        {line('M32 17c-5 8-7 18-5 38M32 17c5 8 7 18 5 38', '#b2426a', 0.8, { strokeOpacity: 0.7 })}
        {line('M21.5 32c-3 4-3.5 9-2 13', '#ea8eaa', 2.2)}
        {line('M28 56l-1.2 3M31 56.5v3.4M34 56.4l1 3M37 55.8l2 2.6', '#cdb08a', 1)}
      </>
    ),
  },
  tomato: {
    bg: '#fde9e6',
    draw: () => (
      <>
        {shadow(18, 56)}
        <circle cx="45" cy="28" r="9" fill="#c9311f" />
        <circle cx="43.6" cy="26.8" r="7" fill="#e14431" />
        <path d={star(45, 20.5, 4.6, 1.4, 5)} fill="#3a8a3c" />
        {ov(29, 39, 17, 15, '#c8301f')}
        {ov(27, 37.4, 14.6, 12.8, '#e5452f')}
        {ov(21.5, 32, 4.6, 2.8, '#f47e6b', -35)}
        {ov(20.2, 31, 1.6, 1, '#fff', -35)}
        <path d={star(29, 25, 8.5, 2.4, 5)} fill="#3f9142" />
        {line('M29 25c0-3 1-5 3.4-6.4', '#2f7a32', 2)}
      </>
    ),
  },
  brinjal: {
    bg: '#efe8f9',
    draw: () => (
      <>
        {shadow(15, 57)}
        <g transform="rotate(-24 32 36)">
          <path d="M32 17c6 0 10 5 12 13 2 8 3 14 0 20-3 5-8 7-13 7-6 0-11-4-12-10-1-7 2-13 3-19 2-7 5-11 10-11z" fill="#4e1f6d" />
          <path d="M30.5 17c-5 1-8 5-9.5 11-1 6-4 12-3 19 1 6 5.6 9.4 11 10-5-3-7-8-7-14 0-7 3-11 4.5-17 1-4 2.4-7 4-9z" fill="#6c2e91" />
          {line('M24.5 31c-2 6-2.4 11-1 16', '#9b62c5', 2.4)}
          <path d="M21.5 25c2-7 6-11 10.5-11s8.5 4 10.5 11l-4.5-3-2 5-4-5-4 5-2-5z" fill="#4a8c3a" />
          {line('M32 14.5c0-4 1.6-7 4.6-9', '#3c7a2e', 2.8)}
        </g>
      </>
    ),
  },
  cauliflower: {
    bg: '#e8f4e8',
    draw: () => {
      const florets = [[22, 37, 7], [42, 37, 7], [27, 29.5, 7], [37, 29.5, 7], [32, 39, 8], [32, 24, 6.5]];
      return (
        <>
          {shadow(20, 57)}
          <path d="M32 46c-12 0-22-6-26-16 10 0 20 4 26 12z" fill="#4b9560" />
          <path d="M32 46c12 0 22-6 26-16-10 0-20 4-26 12z" fill="#3b8051" />
          {florets.map(([x, y, r], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={r} fill="#e8dbb2" />
              <circle cx={x - 0.9} cy={y - 1} r={r - 1.7} fill="#f8f1dc" />
            </g>
          ))}
          <path d="M32 57c-10 2-20-2-24-10 10-2 19 1 25 6z" fill="#5aa56c" />
          <path d="M32 57c10 2 20-2 24-10-10-2-19 1-25 6z" fill="#47905c" />
          {line('M12 48.5c7 1.6 13 3.6 19 7.4M52 48.5c-7 1.6-13 3.6-19 7.4', '#bfe0c3', 0.9)}
        </>
      );
    },
  },
  chilli: {
    bg: '#fdeae7',
    draw: () => {
      const chilli = (t: string, base: string, shade: string, hi: string) => (
        <g transform={t}>
          <path d="M0-3.6C10-4 22-2 30 4c3 2.5 5 5 6 8-3-2-6-3-9-4-9-3-18-4-27-4.6z" fill={base} />
          <path d="M0 1.2C9 2 18 3.4 27 6.4c3 1 6 2.5 9 5.6-3-2-6-3-9-4C18 5 9 4 0 3.4z" fill={shade} />
          {line('M3-1.6c7-.4 14 .4 19 2', hi, 1.2)}
          <path d="M-4-4c3-1.2 5-.6 6.4.8v6.4c-1.4 1.4-3.4 2-6.4.8z" fill="#3d8a3a" />
          {line('M-3 0c-4-1-6.4-4-7.4-8', '#3d8a3a', 1.8)}
        </g>
      );
      return (
        <>
          {shadow(17, 56)}
          {chilli('translate(16 41) rotate(-14)', '#3f9c3f', '#2c7a30', '#7cc76a')}
          {chilli('translate(21 18) rotate(32)', '#e1322b', '#b3221c', '#f47b70')}
        </>
      );
    },
  },
  okra: {
    bg: '#e7f4e0',
    draw: () => {
      const okra = (t: string) => (
        <g transform={t}>
          <path d="M0 0c4 0 6 3 6 8l-1 22c-.5 6-3 10-5 12-2-2-4.5-6-5-12L-6 8c0-5 2-8 6-8z" fill="#5aa040" />
          <path d="M0 0c4 0 6 3 6 8l-1 22c-.5 6-3 10-5 12 1-4 2-8 2.2-12L2.6 8C2.6 4 2 1.4 0 0z" fill="#468a32" />
          {line('M-2.4 5l.4 30M2.4 5 2 35', '#3f7f2c', 0.8)}
          {line('M-3.8 8l.3 21', '#8ec767', 1.2)}
          <path d="M-5 2c1-5 9-5 10 0-3 1.6-7 1.6-10 0z" fill="#a8c95a" />
          {line('M0-2v-5', '#6f9c3a', 2)}
        </g>
      );
      // Cross-section: ridged rim, pale star of chambers, five seeds.
      const seeds = [0, 72, 144, 216, 288]
        .map((a) => {
          const r = ((a - 90) * Math.PI) / 180;
          return `M${n1(45 + 3.4 * Math.cos(r))} ${n1(48 + 3.4 * Math.sin(r))}h0`;
        })
        .join('');
      return (
        <>
          {shadow(17, 56)}
          {okra('translate(23 12) rotate(-14)')}
          {okra('translate(37 10) rotate(10)')}
          <circle cx="45" cy="48" r="8.4" fill="#5aa040" />
          <circle cx="45" cy="48" r="7" fill="#dcedbb" />
          <path d={star(45, 48, 4.6, 2.6, 5)} fill="#b9da8a" />
          {line(seeds, '#fbfdf3', 2.2)}
        </>
      );
    },
  },
  garlic: {
    bg: '#e9e1f4',
    draw: () => (
      <>
        {shadow(17, 56)}
        <path d="M30.6 17l1.4-9 1.6 9z" fill="#cdb48a" />
        <path d="M32 16c2 5 6 7 11 10 6 4 9 9 8 16-1 8-9 13-19 13s-18-5-19-13c-1-7 2-12 8-16 5-3 9-5 11-10z" fill="#f8f3ea" />
        <path d="M32 55c10 0 18-5 19-13 1-7-2-12-8-16 3 5 4 10 3 16-1 7-6 11-14 13z" fill="#dccbb2" />
        {line('M32 18c-6 8-9 18-7 36M32 18c6 8 9 18 7 36M32 18v37', '#cbb89c', 1)}
        {line('M26.5 34c-1 6-1 11 .4 15M37.5 34c1 6 1 11-.4 15M21 38c0 4 .6 7 2 10', '#b585b8', 1.4, { strokeOpacity: 0.85 })}
        {line('M27 55l-1.4 3M31 55.6v3.4M35 55.4l1.2 3', '#bfa682', 1)}
        <path d="M49 45c4 2 6 7 4 11-3 1.2-8 .4-10-2.6 2.4-2 4.4-5 6-8.4z" fill="#f8f3ea" />
        <path d="M49 45c4 2 6 7 4 11-1.6.6-3.4.6-5 .2 2.6-2.6 3.4-6.6 1-11.2z" fill="#d8c6ad" />
      </>
    ),
  },
};

const SPROUT: Art = {
  bg: '#e6f4e2',
  draw: () => (
    <>
      <path d="M10 55c5-7 39-7 44 0z" fill="#a8743f" />
      <path d="M16 52c7-4 25-4 32 0-9-1.6-23-1.6-32 0z" fill="#c08a52" />
      {line('M32 52c0-8-1-14 0-21', '#3f8f38', 2.4)}
      <path d="M31.4 37c-7 1-13-4-14-12 8-1 13 4 14 12z" fill="#62b24c" />
      <path d="M32.4 32c1.6-9 8.4-14 16.6-13-1 8-7 13-16.6 13z" fill="#3f8f38" />
      {line('M30 34.6c-3-1.6-6-4.4-8-7.6M35 29.6c3-2 6.4-5 9-8.4', '#a5dc8c', 0.9)}
    </>
  ),
};

function CropArtBase({ crop, size = 56, rounded = true, background = true, className, style, title }: CropArtProps) {
  const art = isCropKey(crop) ? ART[crop] : SPROUT;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} style={style} xmlns="http://www.w3.org/2000/svg" {...a11y(title)}>
      {background && <rect width="64" height="64" rx={rounded ? 14 : 0} fill={art.bg} />}
      {art.draw()}
    </svg>
  );
}

/** Flat illustrated crop thumbnail. Pure and prop-only, so long lists can render many cheaply. */
export const CropArt = pure(CropArtBase);

/**
 * Dark-theme version of a tile tint: the pastel's hue at lightness 17% and muted saturation, so
 * dark-mode ink (#e8f0ea) stays above 7:1 on it while each crop keeps its own colour cast.
 */
function darkTint(hex: string): string {
  const v = parseInt(hex.slice(1), 16);
  const [r, g, b] = [v >> 16, (v >> 8) & 255, v & 255].map((c) => c / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  const l = max - d / 2;
  const sat = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  // hue in sextants (0–6)
  const h = !d ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const L = 0.17;
  const C = d ? (1 - Math.abs(2 * L - 1)) * Math.min(0.38, Math.max(0.12, sat * 0.45)) : 0;
  const X = C * (1 - Math.abs((h % 2) - 1));
  const rgb = h < 1 ? [C, X, 0] : h < 2 ? [X, C, 0] : h < 3 ? [0, C, X] : h < 4 ? [0, X, C] : h < 5 ? [X, 0, C] : [C, 0, X];
  return '#' + rgb.map((c) => Math.round((c + L - C / 2) * 255).toString(16).padStart(2, '0')).join('');
}

/**
 * Tile tint for a crop, so headers and chips can echo the thumbnail's colour. The light tints are
 * pastels made for dark ink; pass the app theme so dark mode gets a deep tint that light ink reads on.
 */
export const cropTint = (crop: string, scheme: 'light' | 'dark' = 'light'): string => {
  const bg = isCropKey(crop) ? ART[crop].bg : SPROUT.bg;
  return scheme === 'dark' ? darkTint(bg) : bg;
};
