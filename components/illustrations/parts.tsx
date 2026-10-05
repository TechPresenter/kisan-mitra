// Reusable scene pieces (farmer, trees, palm, hut, clouds). Each is drawn around its own
// ground point so scenes can place and scale it with one transform.

interface At {
  x: number;
  y: number;
  /** Uniform scale; 1 = the piece's design size noted on each component. */
  s?: number;
}

const at = ({ x, y, s = 1 }: At) => `translate(${x} ${y})${s === 1 ? '' : ` scale(${s})`}`;

const SKIN = '#8d5a3b';

/**
 * Farmer seen from behind, looking out over the field: kurta, dhoti, orange pagdi, red-check
 * gamchha on the shoulder and a lathi. Feet at (x, y); 108 units tall at s = 1.
 */
export function Farmer(p: At) {
  return (
    <g transform={at(p)}>
      <path d="M21 1l4.6-105" stroke="#8a5a2b" strokeWidth="2.6" strokeLinecap="round" />
      <ellipse cx="-5.5" cy="-1" rx="4.6" ry="2" fill="#4a3426" />
      <ellipse cx="5.5" cy="-1" rx="4.6" ry="2" fill="#4a3426" />
      <path d="M-8-16h5v14h-5zM3-16h5v14H3z" fill={SKIN} />
      <path d="M-13-50l1 36q4.5 2.5 9 0L0-30l3 16q4.5 2.5 9 0l1-36z" fill="#efe9dc" />
      <path d="M-6-46l-1 28M6-46l1 28" stroke="#dcd3c2" strokeWidth="1" />
      <path d="M-15-80c-3 10-4 28-3 40 10 3 26 3 36 0 1-12 0-30-3-40-7-4-23-4-30 0z" fill="#fbf9f3" />
      <path d="M6-82.5c4 .1 7 1.1 9 2.5 3 10 4 28 3 40-3.5 1-7 1.6-10.5 2 2-14 2-30-1.5-44.5z" fill="#e8e3d6" />
      <path d="M-15-80c-4.5 7-6.5 17-6.5 27l5 .5c0-8.5 1-15.5 4-21.5z" fill="#f3f0e8" />
      <path d="M-21.3-53.5l.3 7.5h4l.3-7z" fill={SKIN} />
      <circle cx="-19" cy="-45" r="2.6" fill={SKIN} />
      <path d="M15-80c4.5 7 6.5 16 6.5 24l-5 .5c0-7.5-1-13.5-4-18.5z" fill="#e8e3d6" />
      <path d="M16.6-56l5-.4 1.4 5.4-4 1z" fill={SKIN} />
      <ellipse cx="22.6" cy="-50" rx="2.8" ry="3" fill={SKIN} />
      <path d="M-14-81c5-2.5 9-2 11-.5L-6.5-60l-5-1.5z" fill="#d6453a" />
      <path d="M-10.5-79l-2 16M-6.5-79.5l-2.1 18M-13-72l7.5 1M-12.4-66l6 1" stroke="#f6d2c8" strokeWidth=".9" />
      {/* Seen from behind: neck, ears and a full pagdi wrapped down to the nape. */}
      <path d="M-4-90h8l.6 9h-9.2z" fill="#7f5034" />
      <circle cx="-7.6" cy="-92" r="1.9" fill={SKIN} />
      <circle cx="7.6" cy="-92" r="1.9" fill={SKIN} />
      <path d="M-5.6-88.6c-2-1.6-3.4-4-3.4-7.4 0-6.4 4-10.4 9-10.4s9 4 9 10.4c0 3.4-1.4 5.8-3.4 7.4-3.4 1.2-7.8 1.2-11.2 0z" fill="#f08c28" />
      <path d="M-8.6-92.4c5.4 1.6 11.8 1.6 17.2 0M-8.4-97.6c5.4-1.8 11.4-1.8 16.8 0M-6.2-102.6c4-1.6 8.4-1.6 12.4 0" stroke="#d26f17" strokeWidth="1.2" fill="none" />
      <path d="M-5.6-88.6c3.4 1.2 7.8 1.2 11.2 0l-.4 1.4c-3.4 1-7 1-10.4 0z" fill="#c9661a" />
      <path d="M2-91c2.4 4 2.4 8 .8 12h3c1.6-4.2 1.4-8.4-.6-12.2z" fill="#e07a1c" />
    </g>
  );
}

/** Neem/mango-style shade tree; ground at (x, y), ~34 units tall. */
export function Tree({ tones = ['#3d7d4a', '#4f8f5a', '#67a872'], ...p }: At & { tones?: [string, string, string] }) {
  const [dark, base, light] = tones;
  return (
    <g transform={at(p)}>
      <path d="M-1.6 0l.6-14-4-5 1-.6 3.6 3.6.6-5h1.4l.4 6 4-4 .8.8-4.2 5L1.6 0z" fill="#6b4a2e" />
      <path d="M-17-14c-4-4-2-11 4-12 0-6 6-10 12-8 3-5 11-5 14 0 6-1 10 5 7 10 4 3 2 10-3 10z" fill={base} />
      <circle cx="-8" cy="-26" r="4.6" fill={light} />
      <circle cx="2" cy="-31" r="3.6" fill={light} />
      <path d="M-17-14c10 3 24 3 34 0 0 3-6 5.4-17 5.4S-17-11-17-14z" fill={dark} />
    </g>
  );
}

/** Taad/coconut palm, the tell-tale skyline of rural India; ground at (x, y), ~38 units tall. */
export function Palm({ color = '#3d7d4a', trunk = '#7a5a3a', ...p }: At & { color?: string; trunk?: string }) {
  return (
    <g transform={at(p)} fill="none" strokeLinecap="round">
      <path d="M0 0c1-12 3-24 6-34" stroke={trunk} strokeWidth="2.2" />
      <path
        d="M6-34c-5-4-11-4-15 1M6-34c-3-6-8-8-13-7M6-34c1-6 5-9 10-9M6-34c5-3 11-2 14 3M6-34c4 0 8 3 9 8M6-34c-3 1-6 4-7 8"
        stroke={color}
        strokeWidth="2.4"
      />
    </g>
  );
}

/** Small thatched hut on the horizon; ground at (x, y), ~19 units tall. */
export function Hut(p: At) {
  return (
    <g transform={at(p)}>
      <path d="M-10 0v-10h20V0z" fill="#ecd3a9" />
      <path d="M3-10h7V0H3z" fill="#d9bc8c" />
      <path d="M-2 0v-6h4v6z" fill="#6b4a2e" />
      <path d="M-13-9l13-10 13 10z" fill="#b98544" />
      <path d="M-8-12.5l3-2.3M-2-15l2-1.5M4-14l3 2.2" stroke="#9a6b32" strokeWidth="1" />
    </g>
  );
}

/** Soft cloud, bottom-left at (x, y); 60×24 units at s = 1. */
export function Cloud({ fill = '#fff', opacity = 1, shade, ...p }: At & { fill?: string; opacity?: number; shade?: string }) {
  return (
    <g transform={at(p)} opacity={opacity}>
      <path d="M8 0C2 0 0-4 0-7c0-4 3.5-7 8-7 1-6 6-10 12-10 5 0 9 3 11 7 2-2 5-3 8-3 6 0 10 4 10.5 9 5.5 0 10.5 3 10.5 6.5S57.5 0 54 0z" fill={fill} />
      {shade && <path d="M8 0C4 0 1.6-1.6.6-4c8 2 44 2 58.8-.6C59 -1.4 57 0 54 0z" fill={shade} />}
    </g>
  );
}

/** Two distant birds; (x, y) is the first wingtip. */
export function Birds({ color = '#5b6f66', ...p }: At & { color?: string }) {
  return (
    <g transform={at(p)} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round">
      <path d="M0 0q5-4 9 0 4-4 9 0" />
      <path d="M24-10q3.5-3 7 0 3.5-3 7 0" />
    </g>
  );
}

/** Foreground wheat tuft so fields read as crops, not lawn; base at (x, y), ~40 units tall. */
export function WheatTuft(p: At) {
  return (
    <g transform={at(p)}>
      <path d="M0 0c-1-12-4-22-9-30M2 0c0-14 1-26 4-36M4 0c2-10 6-18 12-24" stroke="#c9963a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <ellipse cx="-9.5" cy="-33" rx="2.4" ry="5.6" transform="rotate(-24 -9.5 -33)" fill="#e9b949" />
      <ellipse cx="6.4" cy="-40" rx="2.4" ry="5.8" transform="rotate(6 6.4 -40)" fill="#f2c95c" />
      <ellipse cx="17" cy="-27" rx="2.2" ry="5.2" transform="rotate(40 17 -27)" fill="#dca83c" />
      <path d="M1 0C-4-6-10-9-16-9c6-2 12 0 17 6zM3 0c3-7 8-11 14-12-5 3-9 7-11 12z" fill="#7fae45" />
    </g>
  );
}
