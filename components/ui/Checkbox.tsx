import { useId, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cx } from './cx';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  /** round = task done circle (calendar), square = classic checkbox. */
  shape?: 'round' | 'square';
  /** md 28px, lg 32px box; the hit area is always ≥ 48px. */
  size?: 'md' | 'lg';
  disabled?: boolean;
  id?: string;
  /** Required when there is no visible label. */
  'aria-label'?: string;
  className?: string;
}

/** Large checkbox on a native input (keyboard + screen readers for free). */
export function Checkbox({
  checked,
  onChange,
  label,
  description,
  shape = 'round',
  size = 'lg',
  disabled,
  id: idProp,
  className,
  ...aria
}: CheckboxProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const box = (
    <span
      aria-hidden
      className={cx(
        'inline-flex shrink-0 items-center justify-center border-2 transition-colors duration-150',
        size === 'lg' ? 'size-8' : 'size-7',
        shape === 'round' ? 'rounded-full' : 'rounded-lg',
        checked ? 'border-brand-700 bg-brand-700 text-white' : 'border-control bg-surface text-transparent',
        'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)] peer-focus-visible:outline-solid',
      )}
    >
      <Check className={size === 'lg' ? 'size-5' : 'size-4'} strokeWidth={3} />
    </span>
  );
  return (
    <label
      htmlFor={id}
      className={cx(
        'relative inline-flex min-h-12 cursor-pointer items-center gap-3',
        !label && 'min-w-12 justify-center',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        aria-label={label == null ? aria['aria-label'] : undefined}
        onChange={e => onChange(e.target.checked)}
      />
      {box}
      {label != null && (
        <span className="min-w-0">
          <span className={cx('block text-body text-ink', checked && shape === 'round' && 'text-ink-2 line-through decoration-ink-3')}>{label}</span>
          {description != null && <span className="block text-small text-ink-2">{description}</span>}
        </span>
      )}
    </label>
  );
}
