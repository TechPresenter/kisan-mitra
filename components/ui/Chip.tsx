import { useEffect, useRef, type ReactNode, type Ref } from 'react';
import { ChevronDown } from 'lucide-react';
import { cx } from './cx';
import { useRoving } from './hooks';
import { renderIcon, type IconLike } from './icon';
import type { NativeButtonProps } from './types';

export interface ChipProps extends NativeButtonProps {
  label: ReactNode;
  selected?: boolean;
  icon?: IconLike;
  /** Small count after the label ("मौसम 3"). */
  count?: number;
  /** Shows ▾ — the chip opens a picker ("यह सीजन ▾"). */
  dropdown?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** Pill filter chip; selected = green filled. Standalone chips are toggle buttons (aria-pressed). */
export function Chip({ label, selected = false, icon, count, dropdown = false, className, type = 'button', role, ref, ...rest }: ChipProps) {
  const isRadio = role === 'radio' || role === 'tab';
  return (
    <button
      ref={ref}
      type={type}
      role={role}
      aria-pressed={!isRadio && !dropdown ? selected : undefined}
      aria-checked={role === 'radio' ? selected : undefined}
      aria-selected={role === 'tab' ? selected : undefined}
      aria-haspopup={dropdown ? 'dialog' : undefined}
      className={cx(
        'press inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-small font-medium whitespace-nowrap',
        'disabled:cursor-not-allowed disabled:opacity-50',
        selected
          ? 'border-brand-700 bg-brand-700 text-white'
          : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink',
        className,
      )}
      {...rest}
    >
      {renderIcon(icon, { className: 'size-4 shrink-0', strokeWidth: 2.25 })}
      <span className="pt-0.5">{label}</span>
      {count != null && (
        <span
          className={cx(
            'rounded-full px-1.5 text-caption leading-5 font-semibold tabular-nums',
            selected ? 'bg-white/20 text-white' : 'bg-surface-2 text-ink-2',
          )}
        >
          {count}
        </span>
      )}
      {dropdown && <ChevronDown aria-hidden className="-mr-1 size-4 shrink-0" strokeWidth={2.25} />}
    </button>
  );
}

export interface ChipOption<T extends string = string> {
  value: T;
  label: ReactNode;
  icon?: IconLike;
  count?: number;
}

export interface ChipGroupProps<T extends string = string> {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Hindi name of the filter group, for screen readers. */
  ariaLabel: string;
  /** Default: one horizontally scrolling row. `wrap` lays the chips out on multiple lines. */
  wrap?: boolean;
  /** Scroll edge-to-edge past the 16px page gutter (default true for scrolling rows). */
  bleed?: boolean;
  className?: string;
}

/** Single-select scrollable filter chips (सभी, मौसम, फसल, मंडी…). Arrow keys move the selection. */
export function ChipGroup<T extends string = string>({ options, value, onChange, ariaLabel, wrap = false, bleed = true, className }: ChipGroupProps<T>) {
  const active = options.findIndex(o => o.value === value);
  const roving = useRoving(options.length, active, i => onChange(options[i].value));
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Keep the selected chip visible horizontally (scrollIntoView would also scroll the page).
  useEffect(() => {
    const list = listRef.current;
    const chip = selectedRef.current;
    if (wrap || !list || !chip) return;
    const pad = 16;
    const left = chip.offsetLeft;
    const right = left + chip.offsetWidth;
    if (left - pad < list.scrollLeft) list.scrollLeft = Math.max(0, left - pad);
    else if (right + pad > list.scrollLeft + list.clientWidth) list.scrollLeft = right + pad - list.clientWidth;
  }, [value, wrap]);

  return (
    <div
      ref={listRef}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={roving.onKeyDown}
      className={cx(
        'relative flex gap-2',
        wrap ? 'flex-wrap' : 'scrollbar-none overflow-x-auto py-0.5',
        !wrap && bleed && '-mx-4 scroll-px-4 px-4',
        className,
      )}
    >
      {options.map((o, i) => (
        <Chip
          key={o.value}
          ref={el => {
            roving.setRef(i)(el);
            if (i === active) selectedRef.current = el;
          }}
          role="radio"
          tabIndex={roving.tabIndexFor(i)}
          label={o.label}
          icon={o.icon}
          count={o.count}
          selected={i === active}
          onClick={() => onChange(o.value)}
        />
      ))}
    </div>
  );
}
