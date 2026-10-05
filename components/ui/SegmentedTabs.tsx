import type { ReactNode } from 'react';
import { CountBadge } from './Badge';
import { cx } from './cx';
import { useRoving } from './hooks';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: ReactNode;
  badge?: number;
}

export interface SegmentedTabsProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Hindi name for screen readers ("समय चुनें"). */
  ariaLabel: string;
  /**
   * When set, tabs get ids `${idPrefix}-tab-${value}` and aria-controls `${idPrefix}-panel-${value}`;
   * give the matching panel role="tabpanel" and that id.
   */
  idPrefix?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** Light-gray track with a solid green pill for the active segment (आज | इस सप्ताह | इस महीने). */
export function SegmentedTabs<T extends string = string>({
  options,
  value,
  onChange,
  ariaLabel,
  idPrefix,
  size = 'md',
  className,
}: SegmentedTabsProps<T>) {
  const active = options.findIndex(o => o.value === value);
  const roving = useRoving(options.length, active, i => onChange(options[i].value));
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={roving.onKeyDown}
      // Radii equal half the one-line height, so a single line still reads as a pill while a
      // wrapped label (large text on a narrow phone) gets a rounded box instead of a blob.
      className={cx('flex gap-1 rounded-[1.625rem] bg-surface-2 p-1 hc:border hc:border-line', className)}
    >
      {options.map((o, i) => {
        const selected = i === active;
        return (
          <button
            key={o.value}
            ref={roving.setRef(i)}
            type="button"
            role="tab"
            id={idPrefix ? `${idPrefix}-tab-${o.value}` : undefined}
            aria-controls={idPrefix ? `${idPrefix}-panel-${o.value}` : undefined}
            aria-selected={selected}
            tabIndex={roving.tabIndexFor(i)}
            onClick={() => onChange(o.value)}
            className={cx(
              // Labels wrap at spaces rather than truncate: at 130% text "इस सप्ताह" must stay whole.
              // Slim side padding leaves room for one-word labels ("सामान्य") before they break.
              'press inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[1.375rem] px-1 py-1.5 text-center leading-snug font-semibold',
              size === 'sm' ? 'text-caption' : 'text-small',
              selected ? 'bg-brand-700 text-white shadow-sm' : 'text-ink-2 hover:text-ink',
            )}
          >
            <span className="min-w-0 pt-0.5 [overflow-wrap:anywhere]">{o.label}</span>
            {o.badge ? <CountBadge count={o.badge} ring="none" className="shrink-0" /> : null}
          </button>
        );
      })}
    </div>
  );
}
