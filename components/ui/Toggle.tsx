import { useId, type ReactNode } from 'react';
import { cx } from './cx';
import { renderIcon, type IconLike } from './icon';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Visible label; renders a full settings row. Without it pass `aria-label`. */
  label?: ReactNode;
  description?: ReactNode;
  icon?: IconLike;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  className?: string;
}

/** Switch (role="switch"). With a label it is a whole tappable settings row. */
export function Toggle({ checked, onChange, label, description, icon, disabled, id: idProp, className, ...aria }: ToggleProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const descId = `${id}-desc`;
  // The button is the ≥ 48px hit area; the 52×32 track is drawn inside it.
  const control = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label == null ? aria['aria-label'] : undefined}
      aria-describedby={description != null ? descId : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-50',
        !label && className,
      )}
    >
      <span
        aria-hidden
        className={cx(
          'inline-flex h-8 w-13 items-center rounded-full p-1 transition-colors duration-150',
          checked ? 'bg-brand-700' : 'bg-control',
        )}
      >
        <span
          className={cx(
            'block size-6 rounded-full bg-white shadow-sm transition-transform duration-150',
            checked ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0',
          )}
        />
      </span>
    </button>
  );
  if (label == null) return control;
  return (
    <div className={cx('flex min-h-14 items-center gap-3 py-2', disabled && 'opacity-60', className)}>
      {icon && <span className="shrink-0 text-ink-2">{renderIcon(icon, { className: 'size-5.5' })}</span>}
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-body font-medium text-ink">{label}</span>
        {description != null && (
          <span id={descId} className="block text-small text-ink-2">
            {description}
          </span>
        )}
      </label>
      {control}
    </div>
  );
}
