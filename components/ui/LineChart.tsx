import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { formatNumber } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { cx } from './cx';
import { useElementWidth } from './hooks';
import { ChartTooltip, LINE_COLOR, niceScale, tickFormatter, type LineTone } from './viz';
import './strings';

export interface LinePoint {
  /** X label ("सोम", "5 अक्टू"). */
  label: string;
  value: number;
}

export interface LineChartProps {
  data: LinePoint[];
  /** Names the chart in the screen-reader summary ("गेहूं का भाव, पिछले 7 दिन"). */
  title: string;
  formatValue?: (n: number) => string;
  /** Axis labels; default compact (72K, 1.2L) unless that would repeat a label. */
  formatTick?: (n: number) => string;
  /** brand (default) or the trend colour (up green / down red / stable orange). */
  tone?: LineTone;
  /** 10% wash under the line (default true). */
  area?: boolean;
  /** Plot height in px (x labels are added below). Default 160. */
  height?: number;
  className?: string;
}

const PAD_X = 14;
const PAD_TOP = 28; // room for the end label above the last point
const PAD_BOTTOM = 6;

/**
 * Single-series trend line (e.g. 7-day mandi price). 2px line, end dot with a surface ring,
 * value labelled at the end only; crosshair + tooltip on hover, tap and arrow keys.
 */
export function LineChart({
  data,
  title,
  formatValue = n => formatNumber(n),
  formatTick,
  tone = 'brand',
  area = true,
  height = 160,
  className,
}: LineChartProps) {
  const t = useT();
  const [setPlot, plotW] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const gradId = useId();
  const color = LINE_COLOR[tone];
  const values = data.map(d => d.value);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const scale = niceScale(min, max, 3, false);
  const fmtTick = formatTick ?? tickFormatter(scale);
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const y = (v: number) => PAD_TOP + plotH - ((v - scale.lo) / (scale.hi - scale.lo || 1)) * plotH;
  const x = (i: number) => (data.length <= 1 ? plotW / 2 : PAD_X + (i * (plotW - PAD_X * 2)) / (data.length - 1));

  const pts = data.map((d, i) => [x(i), y(d.value)] as const);
  const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join('');
  const baseY = PAD_TOP + plotH;
  const areaPath = pts.length > 1 ? `${line}L${pts[pts.length - 1][0].toFixed(1)},${baseY}L${pts[0][0].toFixed(1)},${baseY}Z` : '';

  const summary = data.length
    ? t('ui.chart.lineSummary', {
        title,
        from: data[0].label,
        to: data[data.length - 1].label,
        first: formatValue(data[0].value),
        last: formatValue(data[data.length - 1].value),
        max: formatValue(max),
        min: formatValue(min),
      })
    : title;

  const indexAt = (e: PointerEvent<HTMLDivElement>) => {
    if (!data.length) return null;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0;
    for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i][0] - px) < Math.abs(pts[best][0] - px)) best = i;
    return best;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!data.length) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      setActive(cur => (cur == null ? data.length - 1 : Math.min(data.length - 1, Math.max(0, cur + dir))));
    } else if (e.key === 'Escape') setActive(null);
  };

  const last = pts.length - 1;
  const step = data.length > 8 ? Math.ceil(data.length / 6) : 1;
  // A refresh can shrink `data` while a point is still active (touch scrub, hovering mouse):
  // an out-of-range index would crash the render, so treat it as no selection.
  const a = active != null && active < pts.length ? active : null;

  return (
    <figure className={cx('m-0 w-full', className)}>
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
          {plotW > 0 && pts.length > 0 && (
            <svg aria-hidden width={plotW} height={height} className="block overflow-visible">
              <defs>
                <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.16 }} />
                  <stop offset="100%" style={{ stopColor: color, stopOpacity: 0.02 }} />
                </linearGradient>
              </defs>
              {scale.ticks.map(tk => (
                <line
                  key={tk}
                  x1={0}
                  x2={plotW}
                  y1={Math.round(y(tk)) + 0.5}
                  y2={Math.round(y(tk)) + 0.5}
                  stroke="var(--line)"
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
              ))}
              {area && areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}
              <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {a != null && (
                <line
                  x1={Math.round(pts[a][0]) + 0.5}
                  x2={Math.round(pts[a][0]) + 0.5}
                  y1={PAD_TOP - 4}
                  y2={baseY}
                  stroke="var(--line-strong)"
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
              )}
              {a !== last && (
                <circle cx={pts[last][0]} cy={pts[last][1]} r={4} fill={color} stroke="var(--surface)" strokeWidth={2} />
              )}
              {a != null && (
                <circle cx={pts[a][0]} cy={pts[a][1]} r={5} fill={color} stroke="var(--surface)" strokeWidth={2} />
              )}
            </svg>
          )}
          {plotW > 0 && pts.length > 0 && a == null && (
            <span
              aria-hidden
              className="absolute -translate-x-full -translate-y-full pb-1.5 text-small font-bold whitespace-nowrap text-ink tabular-nums"
              style={{ left: pts[last][0] + 4, top: pts[last][1] - 4 }}
            >
              {formatValue(data[last].value)}
            </span>
          )}
          {a != null && (
            <ChartTooltip
              title={data[a].label}
              x={pts[a][0]}
              y={Math.min(pts[a][1], PAD_TOP) - 6}
              width={plotW}
              rows={[{ color, label: title, value: formatValue(data[a].value) }]}
            />
          )}
        </div>
      </div>
      <div aria-hidden className="relative mt-1.5 ml-12 h-5">
        {plotW > 0 &&
          data.map((d, i) =>
            i % step === 0 || i === last ? (
              <span
                key={d.label + i}
                className={cx(
                  'absolute top-0 -translate-x-1/2 text-caption leading-5 whitespace-nowrap',
                  a === i ? 'font-semibold text-ink' : 'text-ink-2',
                )}
                style={{ left: pts[i][0] }}
              >
                {d.label}
              </span>
            ) : null,
          )}
      </div>
    </figure>
  );
}

export interface SparklineProps {
  values: number[];
  tone?: LineTone;
  /** Height in px; width comes from the class (default w-20). */
  height?: number;
  area?: boolean;
  /** Accessible summary; without it the sparkline is decorative (pair it with a TrendBadge). */
  label?: string;
  className?: string;
}

/** Tiny trend line for rows and stat cards (7-day price). */
export function Sparkline({ values, tone = 'brand', height = 32, area = true, label, className }: SparklineProps) {
  const [setWrap, width] = useElementWidth<HTMLSpanElement>();
  const gradId = useId();
  const color = LINE_COLOR[tone];
  const pad = 5;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = Math.max(0, width - pad * 2);
  const h = height - pad * 2;
  const pts = values.map((v, i) => [pad + (values.length > 1 ? (i * w) / (values.length - 1) : w / 2), pad + h - ((v - min) / span) * h] as const);
  const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join('');
  const lastPt = pts[pts.length - 1];
  return (
    <span
      ref={setWrap}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cx('inline-block w-20 align-middle', className)}
      style={{ height }}
    >
      {width > 0 && values.length > 0 && (
        <svg aria-hidden width={width} height={height} className="block overflow-visible">
          <defs>
            <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.18 }} />
              <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          {area && pts.length > 1 && (
            <path d={`${line}L${lastPt[0].toFixed(1)},${height}L${pts[0][0].toFixed(1)},${height}Z`} fill={`url(#${gradId})`} />
          )}
          <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={lastPt[0]} cy={lastPt[1]} r={3.5} fill={color} stroke="var(--surface)" strokeWidth={2} />
        </svg>
      )}
    </span>
  );
}
