import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import { Calendar, ChevronDown, CircleAlert, Minus, Plus } from 'lucide-react';
import { useT } from '../../lib/i18n';
import { cx } from './cx';
import { IconButton } from './IconButton';
import { renderIcon, type IconLike } from './icon';
import type { NativeInputProps, NativeSelectProps, NativeTextAreaProps } from './types';
import './strings';
import '../../lib/common-strings';

// ---------- Shell: visible label, hint and error wired to the control ----------

export interface FieldShellProps {
  id: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Adds "(वैकल्पिक)" after the label. */
  optional?: boolean;
  /** Right side of the label row (e.g. a counter). */
  labelAside?: ReactNode;
  className?: string;
  children: ReactNode;
}

export const hintId = (id: string) => `${id}-hint`;
export const errorId = (id: string) => `${id}-error`;

export function describedBy(id: string, hint?: ReactNode, error?: ReactNode): string | undefined {
  const ids = [error ? errorId(id) : null, hint ? hintId(id) : null].filter(Boolean);
  return ids.length ? ids.join(' ') : undefined;
}

/** Label above, control, then hint / error below. Every field has a visible label, not just a placeholder. */
export function FieldShell({ id, label, hint, error, optional, labelAside, className, children }: FieldShellProps) {
  const t = useT();
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      {(label != null || labelAside != null) && (
        <div className="flex items-end justify-between gap-2">
          {label != null && (
            <label htmlFor={id} className="text-small font-semibold text-ink">
              {label}
              {optional && <span className="font-normal text-ink-3"> ({t('common.optional')})</span>}
            </label>
          )}
          {labelAside}
        </div>
      )}
      {children}
      {error ? (
        <p id={errorId(id)} className="flex items-start gap-1.5 text-caption font-medium text-tone-red">
          <CircleAlert aria-hidden className="mt-px size-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
      {hint && !error ? (
        <p id={hintId(id)} className="text-caption text-ink-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** The input box: tinted, 52px tall, 14px radius, green border on focus, red on error. */
export function inputFrameClass(error?: unknown, disabled?: boolean) {
  return cx(
    'flex min-h-13 w-full items-center rounded-input border bg-surface-2 transition-colors duration-150',
    'focus-within:bg-surface focus-within:ring-2 focus-within:ring-brand-600/20',
    error ? 'border-danger focus-within:border-danger' : 'border-line focus-within:border-brand-600',
    disabled && 'opacity-60',
  );
}

const INPUT = 'min-w-0 flex-1 bg-transparent py-3 text-body text-ink outline-none disabled:cursor-not-allowed';

// ---------- TextField ----------

export interface TextFieldProps extends NativeInputProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  /** Inside the box on the left: an icon or text such as "₹". */
  prefix?: ReactNode;
  /** Inside the box on the right: a unit such as "एकड़". */
  suffix?: ReactNode;
  /** After the suffix: a MicButton or another small control. */
  trailing?: ReactNode;
  leadingIcon?: IconLike;
  onValueChange?: (value: string) => void;
  containerClassName?: string;
  ref?: Ref<HTMLInputElement>;
}

export function TextField({
  label,
  hint,
  error,
  optional,
  prefix,
  suffix,
  trailing,
  leadingIcon,
  onValueChange,
  onChange,
  containerClassName,
  className,
  id: idProp,
  disabled,
  ref,
  ...rest
}: TextFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} className={containerClassName}>
      <div className={inputFrameClass(error, disabled)}>
        {renderIcon(leadingIcon, { className: 'ml-3.5 size-5 shrink-0 text-ink-3' })}
        {prefix != null && <span className="pl-4 text-body font-medium text-ink-2">{prefix}</span>}
        <input
          ref={ref}
          id={id}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          onChange={e => {
            onChange?.(e);
            onValueChange?.(e.target.value);
          }}
          className={cx(INPUT, prefix != null || leadingIcon ? 'pr-4 pl-2' : 'px-4', suffix != null && 'pr-2', className)}
          {...rest}
        />
        {suffix != null && <span className="pr-4 text-small font-medium whitespace-nowrap text-ink-2">{suffix}</span>}
        {trailing != null && <span className="flex shrink-0 items-center pr-1">{trailing}</span>}
      </div>
    </FieldShell>
  );
}

// ---------- NumberField ----------

const DEVANAGARI_DIGITS = /[०-९]/g;

/** Accepts Devanagari digits and Indian commas ("१,२००" → 1200). */
export function parseNumber(text: string): number | null {
  const latin = text.replace(DEVANAGARI_DIGITS, d => String(d.charCodeAt(0) - 0x0966)).replace(/[,\s]/g, '');
  if (!latin || latin === '-' || latin === '.') return null;
  const n = Number(latin);
  return Number.isFinite(n) ? n : null;
}

export interface NumberFieldProps
  extends Omit<TextFieldProps, 'value' | 'defaultValue' | 'onChange' | 'onValueChange' | 'type' | 'min' | 'max' | 'step' | 'suffix'> {
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  /** Stepper increment (default 1). */
  step?: number;
  /** Whole numbers only (numeric keypad without a decimal point). */
  integer?: boolean;
  /** Unit shown inside the box ("किलो", "एकड़"). */
  unit?: ReactNode;
  /** − / + buttons for quick adjustments. */
  stepper?: boolean;
}

/** Numeric keyboard, unit suffix, clamped to min/max when the field loses focus. */
export function NumberField({
  value,
  onChange,
  min,
  max,
  step = 1,
  integer = false,
  unit,
  stepper = false,
  onBlur,
  disabled,
  ...rest
}: NumberFieldProps) {
  const t = useT();
  const [text, setText] = useState(value == null ? '' : String(value));

  // Follow outside changes without clobbering in-progress typing such as "2.".
  useEffect(() => {
    setText(prev => (parseNumber(prev) === value ? prev : value == null ? '' : String(value)));
  }, [value]);

  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  const round = (n: number) => (integer ? Math.round(n) : Math.round(n * 1e6) / 1e6);

  const commit = (n: number | null) => {
    setText(n == null ? '' : String(n));
    if (n !== value) onChange(n);
  };

  const allowNegative = min == null || min < 0;
  const pattern = new RegExp(`[^0-9०-९,${integer ? '' : '.'}${allowNegative ? '\\-' : ''}]`, 'g');

  const minus = stepper ? (
    <IconButton
      icon={Minus}
      label={t('ui.number.decrease')}
      size="sm"
      variant="ghost"
      disabled={disabled || (min != null && value != null && value <= min)}
      onClick={() => commit(clamp(round((value ?? min ?? 0) - step)))}
    />
  ) : null;
  const plus = stepper ? (
    <IconButton
      icon={Plus}
      label={t('ui.number.increase')}
      size="sm"
      variant="ghost"
      disabled={disabled || (max != null && value != null && value >= max)}
      onClick={() => commit(clamp(round((value ?? min ?? 0) + step)))}
    />
  ) : null;

  return (
    <TextField
      {...rest}
      disabled={disabled}
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      autoComplete="off"
      value={text}
      prefix={minus ?? rest.prefix}
      suffix={unit}
      trailing={plus ?? rest.trailing}
      className={cx('tabular-nums', stepper && 'text-center', rest.className)}
      onChange={e => {
        const next = e.target.value.replace(pattern, '');
        setText(next);
        const n = parseNumber(next);
        if (n !== value) onChange(n);
      }}
      onBlur={e => {
        const n = parseNumber(text);
        commit(n == null ? null : clamp(round(n)));
        onBlur?.(e);
      }}
    />
  );
}

// ---------- SelectField ----------

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectFieldProps extends NativeSelectProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** Shown while nothing is chosen (value ''). Defaults to "चुनें". */
  placeholder?: string;
  leadingIcon?: IconLike;
  containerClassName?: string;
  ref?: Ref<HTMLSelectElement>;
}

/** Native select (best on low-end Android) styled like the other fields. */
export function SelectField({
  label,
  hint,
  error,
  optional,
  options,
  value,
  onChange,
  placeholder,
  leadingIcon,
  containerClassName,
  className,
  id: idProp,
  disabled,
  ref,
  ...rest
}: SelectFieldProps) {
  const t = useT();
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} className={containerClassName}>
      <div className={cx(inputFrameClass(error, disabled), 'relative')}>
        {renderIcon(leadingIcon, { className: 'pointer-events-none ml-3.5 size-5 shrink-0 text-ink-3' })}
        <select
          ref={ref}
          id={id}
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          onChange={e => onChange(e.target.value)}
          className={cx(
            INPUT,
            'min-h-13 cursor-pointer appearance-none pr-11',
            leadingIcon ? 'pl-2' : 'pl-4',
            value === '' && 'text-ink-3',
            className,
          )}
          {...rest}
        >
          <option value="" disabled hidden={value !== ''}>
            {placeholder ?? t('ui.select.placeholder')}
          </option>
          {options.map(o => (
            <option key={o.value} value={o.value} disabled={o.disabled} className="text-ink">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 size-5 text-ink-2" />
      </div>
    </FieldShell>
  );
}

// ---------- DateField ----------

export interface DateFieldProps extends Omit<NativeInputProps, 'value' | 'defaultValue' | 'onChange' | 'type' | 'min' | 'max'> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  /** YYYY-MM-DD or '' */
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  containerClassName?: string;
  ref?: Ref<HTMLInputElement>;
}

/** Native date picker (the Android picker is familiar and accessible). Value is YYYY-MM-DD. */
export function DateField({ value, onChange, min, max, ...rest }: DateFieldProps) {
  return (
    <TextField
      {...rest}
      type="date"
      value={value}
      min={min}
      max={max}
      leadingIcon={Calendar}
      onValueChange={onChange}
      className={cx('min-h-13 [&::-webkit-calendar-picker-indicator]:opacity-60', rest.className)}
    />
  );
}

// ---------- TextArea ----------

export interface TextAreaProps extends NativeTextAreaProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  value: string;
  onChange: (value: string) => void;
  /** Grow with the text up to `maxRows`. */
  autoGrow?: boolean;
  maxRows?: number;
  /** Bottom-right slot inside the box (e.g. a MicButton). */
  trailing?: ReactNode;
  /** Shows "12/500" when maxLength is set. */
  showCount?: boolean;
  containerClassName?: string;
  ref?: Ref<HTMLTextAreaElement>;
}

export function TextArea({
  label,
  hint,
  error,
  optional,
  value,
  onChange,
  autoGrow = true,
  maxRows = 8,
  rows = 3,
  trailing,
  showCount = true,
  maxLength,
  containerClassName,
  className,
  id: idProp,
  disabled,
  ref,
  ...rest
}: TextAreaProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!autoGrow || !el) return;
    el.style.height = 'auto';
    const line = parseFloat(getComputedStyle(el).lineHeight) || 24;
    el.style.height = `${Math.min(el.scrollHeight, line * maxRows + 24)}px`;
  }, [value, autoGrow, maxRows]);

  const counter =
    maxLength && showCount ? (
      <span className="text-caption text-ink-3 tabular-nums" aria-hidden>
        {value.length}/{maxLength}
      </span>
    ) : null;

  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} labelAside={counter} className={containerClassName}>
      <div className={cx(inputFrameClass(error, disabled), 'items-end')}>
        <textarea
          ref={el => {
            innerRef.current = el;
            if (typeof ref === 'function') ref(el);
            else if (ref) (ref as { current: HTMLTextAreaElement | null }).current = el;
          }}
          id={id}
          rows={rows}
          value={value}
          maxLength={maxLength}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          onChange={e => onChange(e.target.value)}
          className={cx(INPUT, 'resize-none px-4 leading-relaxed', className)}
          {...rest}
        />
        {trailing != null && <span className="shrink-0 p-1">{trailing}</span>}
      </div>
    </FieldShell>
  );
}
