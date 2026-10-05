import type { ReactNode, Ref } from 'react';
import { cx } from './cx';
import { renderIcon, type IconLike } from './icon';
import { Spinner } from './Spinner';
import type { NativeButtonProps } from './types';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'tech' | 'soft';

export interface ButtonProps extends NativeButtonProps {
  variant?: ButtonVariant;
  /** sm 44px (the touch-target floor), md 48px (default), lg 56px (main call-to-action). */
  size?: 'sm' | 'md' | 'lg';
  icon?: IconLike;
  iconRight?: IconLike;
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-brand-700 text-white font-bold hover:bg-brand-800 active:bg-brand-800',
  secondary: 'border-[1.5px] border-brand-700 bg-surface text-brand font-semibold hover:bg-brand-50 dark:border-brand-600',
  ghost: 'bg-transparent text-brand font-semibold hover:bg-brand-50 active:bg-brand-100',
  danger: 'bg-danger-fill text-white font-bold hover:brightness-95',
  tech: 'bg-tech-fill text-white font-bold hover:brightness-110',
  soft: 'bg-brand-50 text-brand font-semibold hover:bg-brand-100 active:bg-brand-100',
};

const SIZE = {
  sm: 'min-h-11 px-3.5 gap-1.5 text-small',
  md: 'min-h-12 px-5 gap-2 text-body',
  lg: 'min-h-14 px-6 gap-2.5 text-card-title',
} as const;

const ICON = { sm: 'size-4', md: 'size-5', lg: 'size-5.5' } as const;

/** Primary = solid green CTA ("आगे बढ़ें"), secondary = white with green border ("गैलरी से चुनें"). */
export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  fullWidth = false,
  disabled,
  className,
  children,
  type = 'button',
  ref,
  ...rest
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'press inline-flex items-center justify-center rounded-btn py-2 text-center leading-snug select-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        loading && 'disabled:opacity-80',
        VARIANT[variant],
        SIZE[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size={size === 'sm' ? 'sm' : 'md'} /> : renderIcon(icon, { className: cx('shrink-0', ICON[size]), strokeWidth: 2.25 })}
      {children != null && <span className="min-w-0 pt-0.5">{children}</span>}
      {!loading && renderIcon(iconRight, { className: cx('shrink-0', ICON[size]), strokeWidth: 2.25 })}
    </button>
  );
}
