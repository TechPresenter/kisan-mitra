// Shared chart plumbing: series colours, nice scales, compact ticks and the hover tooltip.
import type { ReactNode } from 'react';
import { cx } from './cx';

/**
 * Categorical series colours in their validated order (green, blue, orange, violet).
 * Adjacent pairs stay distinguishable under protan/deutan colour blindness in both themes;
 * assign in order, never cycle — a 5th series should fold into "अन्य".
 */
export const VIZ_COLORS = ['var(--viz-1)', 'var(--viz-2)', 'var(--viz-3)', 'var(--viz-4)'] as const;

export type LineTone = 'brand' | 'up' | 'down' | 'stable' | 'neutral';

export const LINE_COLOR: Record<LineTone, string> = {
  brand: 'var(--viz-1)',
  up: 'var(--tone-green)',
  down: 'var(--tone-red)',
  stable: 'var(--tone-orange)',
  neutral: 'var(--ink-3)',
};

function niceStep(range: number, count: number): number {
  const raw = range / Math.max(1, count);
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * mag;
}

export interface Scale {
  lo: number;
  hi: number;
  ticks: number[];
}

/** Round-number axis: ~`count` intervals; `zero` anchors bars at 0. */
export function niceScale(min: number, max: number, count = 3, zero = false): Scale {
  let lo = zero ? Math.min(0, min) : min;
  let hi = max;
  if (hi === lo) {
    const pad = Math.abs(hi) * 0.05 || 1;
    lo = zero ? lo : lo - pad;
    hi = hi + pad;
  }
  const step = niceStep(hi - lo, count);
  lo = zero && lo >= 0 ? 0 : Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
  return { lo, hi, ticks };
}

const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
const plain = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

/** Compact Indian-system number: 72K, 1.2L, 1Cr. */
export function formatCompact(n: number): string {
  return compact.format(n);
}

/**
 * Default axis formatter for a scale: compact when that keeps ticks distinct (72K, 1.2L),
 * full digits otherwise (a ₹2,350–2,500 price range would collapse to "2.4K, 2.4K…").
 */
export function tickFormatter(scale: Scale): (n: number) => string {
  const labels = scale.ticks.map(formatCompact);
  return new Set(labels).size === labels.length ? formatCompact : n => plain.format(n);
}

/** Rounded-top bar path (4px data end, square at the baseline). */
export function barPath(x: number, yTop: number, w: number, yBase: number, r = 4): string {
  const h = yBase - yTop;
  if (h <= 0 || w <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${yBase}V${yTop + rr}Q${x},${yTop} ${x + rr},${yTop}H${x + w - rr}Q${x + w},${yTop} ${x + w},${yTop + rr}V${yBase}Z`;
}

export interface TooltipRow {
  color: string;
  label: string;
  value: string;
}

/**
 * Hover/focus readout: value first (strong), series name second, keyed by a short line of the
 * series colour. Positioned by the chart; `align` keeps it inside the card near the edges.
 */
export function ChartTooltip({
  title,
  rows,
  x,
  y,
  width,
}: {
  title: ReactNode;
  rows: TooltipRow[];
  x: number;
  y: number;
  width: number;
}) {
  const align = x < width * 0.3 ? 'left' : x > width * 0.7 ? 'right' : 'center';
  const style =
    align === 'left'
      ? { left: Math.max(0, x - 16), top: y }
      : align === 'right'
        ? { right: Math.max(0, width - x - 16), top: y }
        : { left: x, top: y };
  return (
    <div
      aria-hidden
      style={style}
      className={cx(
        'pointer-events-none absolute z-10 -translate-y-full rounded-xl border border-line bg-surface px-3 py-2 whitespace-nowrap shadow-float',
        align === 'center' && '-translate-x-1/2',
      )}
    >
      <div className="text-caption text-ink-2">{title}</div>
      {rows.map(r => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="h-[3px] w-3 shrink-0 rounded-full" style={{ background: r.color }} />
          <span className="text-small font-bold text-ink tabular-nums">{r.value}</span>
          {rows.length > 1 && <span className="text-caption text-ink-2">{r.label}</span>}
        </div>
      ))}
    </div>
  );
}
