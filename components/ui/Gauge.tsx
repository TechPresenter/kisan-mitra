import { useId, type ReactNode } from 'react';
import { cx } from './cx';
import { Badge } from './Badge';
import type { Tone } from './tones';

export interface GaugeProps {
  /** Score 0–max (default max 100). */
  value: number;
  max?: number;
  /** Status word under the number ("मध्यम"). */
  label?: string;
  /** Badge tone for the status; default derived from the score (red < 45 ≤ orange < 75 ≤ green). */
  tone?: Tone;
  /** Names the gauge for screen readers ("मिट्टी स्वास्थ्य स्कोर"). */
  caption: string;
  /** Extra node under the label (e.g. LastUpdated). */
  footer?: ReactNode;
  className?: string;
}

const R = 80;
const CX = 100;
const CY = 100;
const ARC = `M${CX - R},${CY} A${R},${R} 0 0 1 ${CX + R},${CY}`;

export function gaugeTone(pct: number): Tone {
  return pct < 45 ? 'red' : pct < 75 ? 'orange' : 'green';
}

/**
 * Semicircle score gauge (soil health "72/100 मध्यम"). The filled arc runs red → amber → green
 * along the scale, so its end colour reads as the score's severity; the track is a quiet step.
 */
export function Gauge({ value, max = 100, label, tone, caption, footer, className }: GaugeProps) {
  const gradId = useId();
  const pct = Math.max(0, Math.min(100, (value / (max || 100)) * 100));
  const angle = Math.PI * (pct / 100);
  const endX = CX - R * Math.cos(angle);
  const endY = CY - R * Math.sin(angle);
  const shown = Math.round(value);
  return (
    <div
      role="img"
      aria-label={`${caption}: ${shown}/${max}${label ? `, ${label}` : ''}`}
      className={cx('flex flex-col items-center', className)}
    >
      <div className="relative w-full max-w-[15rem]">
        <svg aria-hidden viewBox="0 0 200 112" className="block w-full overflow-visible">
          <defs>
            <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={CX - R} y1="0" x2={CX + R} y2="0">
              <stop offset="0%" style={{ stopColor: 'var(--danger)' }} />
              <stop offset="45%" style={{ stopColor: 'var(--sun)' }} />
              <stop offset="100%" style={{ stopColor: 'var(--brand-600)' }} />
            </linearGradient>
          </defs>
          <path d={ARC} fill="none" stroke="var(--surface-3)" strokeWidth={16} strokeLinecap="round" />
          {pct > 0 && (
            <path
              d={ARC}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth={16}
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${pct} 100`}
            />
          )}
          <circle cx={endX} cy={endY} r={9} fill={`url(#${gradId})`} stroke="var(--surface)" strokeWidth={3} />
        </svg>
        <div aria-hidden className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="leading-none">
            <span className="text-[2.5rem] font-bold text-ink">{shown}</span>
            <span className="text-small font-medium text-ink-2">/{max}</span>
          </span>
        </div>
      </div>
      {label && (
        <Badge tone={tone ?? gaugeTone(pct)} size="md" className="mt-2">
          {label}
        </Badge>
      )}
      {footer}
    </div>
  );
}
