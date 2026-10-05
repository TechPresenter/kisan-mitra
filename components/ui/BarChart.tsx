import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import { formatNumber } from '../../lib/format';
import { cx } from './cx';
import { useElementWidth } from './hooks';
import { barPath, ChartTooltip, niceScale, tickFormatter, VIZ_COLORS } from './viz';

export interface BarSeries {
  key: string;
  label: string;
}

export interface BarDatum {
  /** Category label under the bars ("सितंबर"). */
  label: string;
  /** One value per series, same order as `series`. */
  values: number[];
}

export interface BarChartProps {
  data: BarDatum[];
  /** 1–4 series; colours follow the validated order (green, blue, orange, violet). */
  series: BarSeries[];
  /** Names the chart in the screen-reader summary ("खर्च और आय"). */
  title: string;
  formatValue?: (n: number) => string;
  /** Axis labels; default compact (72K, 1.2L) unless that would repeat a label. */
  formatTick?: (n: number) => string;
  /** Plot height in px (x labels are added below). Default 160. */
  height?: number;
  className?: string;
}

const GAP = 2;
const HEADROOM = 8;

/**
 * Small grouped (or single) column chart, hand-rolled SVG. Hover / tap / arrow keys show a
 * tooltip; the full data is in the aria-label so nothing depends on the tooltip.
 */
export function BarChart({
  data,
  series,
  title,
  formatValue = n => formatNumber(n),
  formatTick,
  height = 160,
  className,
}: BarChartProps) {
  const [setPlot, plotW] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const s = series.slice(0, VIZ_COLORS.length);
  if (import.meta.env.DEV && series.length > VIZ_COLORS.length) {
    console.warn('[BarChart] more than 4 series: fold the rest into "अन्य"');
  }

  const max = Math.max(0, ...data.flatMap(d => s.map((_, j) => d.values[j] ?? 0)));
  const scale = niceScale(0, max || 1, 3, true);
  const fmtTick = formatTick ?? tickFormatter(scale);
  const plotH = height - HEADROOM;
  const y = (v: number) => HEADROOM + plotH - ((v - scale.lo) / (scale.hi - scale.lo)) * plotH;
  const band = data.length ? plotW / data.length : 0;
  const k = Math.max(1, s.length);
  // Bars cap at 24px and leave the rest of the band as air; 2px surface gap between neighbours.
  const barW = Math.max(4, Math.min(24, (band * 0.7 - GAP * (k - 1)) / k));
  const groupW = barW * k + GAP * (k - 1);

  const summary = `${title}. ${data
    .map(d => `${d.label}: ${s.map((ser, j) => `${ser.label} ${formatValue(d.values[j] ?? 0)}`).join(', ')}`)
    .join('; ')}`;

  const indexAt = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (!band) return null;
    return Math.min(data.length - 1, Math.max(0, Math.floor(x / band)));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!data.length) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      setActive(cur => (cur == null ? 0 : Math.min(data.length - 1, Math.max(0, cur + dir))));
    } else if (e.key === 'Escape') setActive(null);
  };

  // A refresh can shrink `data` under a stale index; then nothing is active (and nothing dims).
  const a = active != null && active < data.length ? active : null;
  const activeDatum = a != null ? data[a] : null;
  const activeTop = activeDatum ? y(Math.max(0, ...s.map((_, j) => activeDatum.values[j] ?? 0))) : 0;

  return (
    <figure className={cx('m-0 w-full', className)}>
      {s.length > 1 && (
        <div aria-hidden className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
          {s.map((ser, j) => (
            <span key={ser.key} className="inline-flex items-center gap-1.5 text-caption text-ink-2">
              <span className="size-2.5 rounded-[3px]" style={{ background: VIZ_COLORS[j] }} />
              {ser.label}
            </span>
          ))}
        </div>
      )}
      <div className="relative" style={{ height }}>
        {/* y-axis labels: a rem-wide gutter so it grows with Settings → large text */}
        <div aria-hidden className="absolute inset-y-0 left-0 w-12">
          {scale.ticks.map(tk => (
            <span
              key={tk}
              className="absolute right-1.5 -translate-y-1/2 text-caption leading-none text-ink-3 tabular-nums"
              style={{ top: y(tk) }}
            >
              {fmtTick(tk)}
            </span>
          ))}
        </div>
        <div
          ref={setPlot}
          role="img"
          aria-label={summary}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
          onPointerMove={e => setActive(indexAt(e))}
          onPointerDown={e => setActive(indexAt(e))}
          onPointerLeave={e => {
            if (e.pointerType === 'mouse') setActive(null);
          }}
          className="absolute inset-y-0 right-0 left-12 touch-pan-y rounded-md"
        >
          {plotW > 0 && (
            <svg aria-hidden width={plotW} height={height} className="block overflow-visible">
              {scale.ticks.map(tk => (
                <line
                  key={tk}
                  x1={0}
                  x2={plotW}
                  y1={Math.round(y(tk)) + 0.5}
                  y2={Math.round(y(tk)) + 0.5}
                  stroke={tk === 0 ? 'var(--line-strong)' : 'var(--line)'}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
              ))}
              {data.map((d, i) => {
                const gx = band * i + (band - groupW) / 2;
                return (
                  <g key={d.label + i} style={{ opacity: a == null || a === i ? 1 : 0.45, transition: 'opacity 150ms' }}>
                    {s.map((ser, j) => (
                      <path
                        key={ser.key}
                        d={barPath(gx + j * (barW + GAP), y(Math.max(0, d.values[j] ?? 0)), barW, y(0))}
                        fill={VIZ_COLORS[j]}
                      />
                    ))}
                  </g>
                );
              })}
            </svg>
          )}
          {activeDatum && a != null && (
            <ChartTooltip
              title={activeDatum.label}
              x={band * (a + 0.5)}
              y={activeTop - 8}
              width={plotW}
              rows={s.map((ser, j) => ({ color: VIZ_COLORS[j], label: ser.label, value: formatValue(activeDatum.values[j] ?? 0) }))}
            />
          )}
        </div>
      </div>
      <div aria-hidden className="mt-1.5 flex pl-12">
        {data.map((d, i) => (
          <span
            key={d.label + i}
            className={cx('min-w-0 flex-1 truncate px-0.5 text-center text-caption', a === i ? 'font-semibold text-ink' : 'text-ink-2')}
          >
            {d.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
