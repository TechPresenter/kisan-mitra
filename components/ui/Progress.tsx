import type { ReactNode } from 'react';
import { useT } from '../../lib/i18n';
import { cx } from './cx';
import { LEVEL_TONE, TINT_BG, TONE_FILL, TONE_TEXT, type LevelStatus, type Tone } from './tones';
import './strings';

export interface ProgressBarProps {
  value: number;
  max?: number;
  tone?: Tone;
  size?: 'sm' | 'md';
  /** Visible label above the bar. */
  label?: ReactNode;
  /** Right side of the label row ("3/5", "60%"). */
  valueLabel?: ReactNode;
  /** Accessible name when there's no visible label. */
  ariaLabel?: string;
  className?: string;
}

/** Thin bar; the track is a lighter step of the same tone so state reads across the whole bar. */
export function ProgressBar({ value, max = 100, tone = 'green', size = 'md', label, valueLabel, ariaLabel, className }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div className={cx('w-full', className)}>
      {(label != null || valueLabel != null) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-small">
          {label != null && <span className="font-medium text-ink">{label}</span>}
          {valueLabel != null && <span className="text-ink-2 tabular-nums">{valueLabel}</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={typeof label === 'string' ? label : ariaLabel}
        className={cx('w-full overflow-hidden rounded-full', size === 'sm' ? 'h-1.5' : 'h-2.5', TINT_BG[tone])}
      >
        <div className={cx('h-full rounded-full transition-[width] duration-300', TONE_FILL[tone])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export interface LevelBarProps {
  /** Nutrient / parameter name ("नाइट्रोजन (N)"). */
  label: ReactNode;
  /** Fill 0–100 (position of the reading on its scale). */
  value: number;
  status: LevelStatus;
  /** Status word; defaults to उचित / मध्यम / कम / ज़्यादा. */
  statusLabel?: string;
  /** Reading under the label ("6.8", "280 kg/ha"). */
  detail?: ReactNode;
  className?: string;
}

/** Soil nutrient row: label, short coloured bar and a status word (green उचित, red कम, orange मध्यम). */
export function LevelBar({ label, value, status, statusLabel, detail, className }: LevelBarProps) {
  const t = useT();
  const tone = LEVEL_TONE[status];
  const word = statusLabel ?? t(`ui.status.${status}`);
  const pct = Math.max(4, Math.min(100, value));
  return (
    <div className={cx('flex min-h-14 items-center gap-3 py-2', className)}>
      <div className="min-w-0 flex-1">
        <div className="text-body leading-snug font-medium text-ink">{label}</div>
        {detail != null && <div className="text-caption text-ink-2 tabular-nums">{detail}</div>}
      </div>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value)}
        aria-valuetext={word}
        aria-label={typeof label === 'string' ? label : undefined}
        className={cx('h-2 w-20 shrink-0 overflow-hidden rounded-full', TINT_BG[tone])}
      >
        <div className={cx('h-full rounded-full', TONE_FILL[tone])} style={{ width: `${pct}%` }} />
      </div>
      <span className={cx('w-16 shrink-0 text-right text-small font-semibold', TONE_TEXT[tone])}>{word}</span>
    </div>
  );
}
