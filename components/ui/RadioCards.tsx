import { useId, type ReactNode } from 'react';
import { Check, CircleAlert } from 'lucide-react';
import { cx } from './cx';
import { DUOTONE, renderIcon, type IconLike } from './icon';
import { TINT_BG, TONE_TEXT, type Tone } from './tones';

export interface RadioCardOption<T extends string = string> {
  value: T;
  label: ReactNode;
  description?: ReactNode;
  icon?: IconLike;
  tone?: Tone;
  /** Custom media instead of an icon (e.g. a crop illustration). */
  media?: ReactNode;
  disabled?: boolean;
}

interface BaseProps<T extends string> {
  options: RadioCardOption<T>[];
  /** Visible group label (rendered as the fieldset legend). */
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** 1 = full-width rows; 2/3 = tiles in a grid. */
  columns?: 1 | 2 | 3;
  name?: string;
  className?: string;
}

interface SingleProps<T extends string> extends BaseProps<T> {
  multiple?: false;
  value: T | null;
  onChange: (value: T) => void;
}

interface MultiProps<T extends string> extends BaseProps<T> {
  multiple: true;
  value: T[];
  onChange: (value: T[]) => void;
}

export type RadioCardsProps<T extends string = string> = SingleProps<T> | MultiProps<T>;

const GRID = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' } as const;

/** Option cards for onboarding and filters: single (radio) or multiple (checkbox) choice. */
export function RadioCards<T extends string = string>(props: RadioCardsProps<T>) {
  const { options, label, hint, error, columns = 1, name, className } = props;
  const autoName = useId();
  const groupName = name ?? autoName;
  const isSelected = (v: T) => (props.multiple ? props.value.includes(v) : props.value === v);

  const toggle = (v: T) => {
    if (props.multiple === true) {
      const set = props.value;
      props.onChange(set.includes(v) ? set.filter(x => x !== v) : [...set, v]);
      return;
    }
    (props as SingleProps<T>).onChange(v);
  };

  const tile = columns > 1;

  return (
    <fieldset className={cx('min-w-0', className)} aria-describedby={error ? `${groupName}-err` : hint ? `${groupName}-hint` : undefined}>
      {label != null && <legend className="mb-2 text-small font-semibold text-ink">{label}</legend>}
      {hint != null && !error && (
        <p id={`${groupName}-hint`} className="-mt-1 mb-2 text-caption text-ink-2">
          {hint}
        </p>
      )}
      <div className={cx('grid gap-3', GRID[columns])}>
        {options.map(o => {
          const selected = isSelected(o.value);
          const tone = o.tone ?? 'green';
          const visual =
            o.media ??
            (o.icon ? (
              <span
                className={cx(
                  'inline-flex shrink-0 items-center justify-center rounded-xl',
                  tile ? 'size-12' : 'size-11',
                  TINT_BG[tone],
                  TONE_TEXT[tone],
                )}
              >
                {renderIcon(o.icon, { className: 'size-6', strokeWidth: 2, ...DUOTONE })}
              </span>
            ) : null);
          return (
            <label
              key={o.value}
              className={cx(
                'press relative flex cursor-pointer rounded-list border-2 bg-surface',
                tile ? 'min-h-28 flex-col items-center justify-center gap-2 px-2 pt-5 pb-3 text-center' : 'min-h-16 items-center gap-3 px-4 py-3',
                selected ? 'border-brand-600 bg-brand-50' : 'border-line hover:border-line-strong',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] has-[:focus-visible]:outline-solid',
                o.disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              <input
                type={props.multiple ? 'checkbox' : 'radio'}
                name={groupName}
                value={o.value}
                checked={selected}
                disabled={o.disabled}
                onChange={() => toggle(o.value)}
                className="sr-only"
              />
              {visual}
              <span className={cx('min-w-0', !tile && 'flex-1')}>
                <span className="block text-body leading-snug font-semibold text-ink">{o.label}</span>
                {o.description != null && <span className="mt-0.5 block text-small text-ink-2">{o.description}</span>}
              </span>
              <span
                aria-hidden
                className={cx(
                  'inline-flex shrink-0 items-center justify-center border-2 transition-colors duration-150',
                  props.multiple ? 'rounded-md' : 'rounded-full',
                  selected ? 'border-brand-700 bg-brand-700 text-white' : 'border-control bg-surface text-transparent',
                  tile ? 'absolute top-1.5 right-1.5 size-5' : 'size-6',
                )}
              >
                <Check className={tile ? 'size-3.5' : 'size-4'} strokeWidth={3} />
              </span>
            </label>
          );
        })}
      </div>
      {error != null && (
        <p id={`${groupName}-err`} className="mt-2 flex items-start gap-1.5 text-caption font-medium text-tone-red">
          <CircleAlert aria-hidden className="mt-px size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </fieldset>
  );
}
