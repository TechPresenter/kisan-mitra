import type { Ref } from 'react';
import { useT } from '../../lib/i18n';
import { CountBadge } from './Badge';
import { cx } from './cx';
import { renderIcon, type IconLike } from './icon';
import type { NativeButtonProps } from './types';
import './strings';

export type IconButtonVariant = 'ghost' | 'soft' | 'solid' | 'outline' | 'onDark';

export interface IconButtonProps extends NativeButtonProps {
  icon: IconLike;
  /** Required: icon-only buttons need a (Hindi) accessible name. */
  label: string;
  variant?: IconButtonVariant;
  /** sm 44px, md 48px (default), lg 56px — all meet the touch-target minimum. */
  size?: 'sm' | 'md' | 'lg';
  /** Unread count or `true` for a dot; added to the accessible name too. */
  badge?: number | boolean;
  iconClassName?: string;
  ref?: Ref<HTMLButtonElement>;
}

const VARIANT: Record<IconButtonVariant, string> = {
  ghost: 'text-ink-2 hover:bg-surface-2 active:bg-surface-3',
  soft: 'bg-surface-2 text-ink hover:bg-surface-3',
  solid: 'bg-brand-700 text-white hover:bg-brand-800',
  outline: 'border border-line bg-surface text-ink-2 hover:bg-surface-2',
  onDark: 'text-white hover:bg-white/10 active:bg-white/15',
};

const SIZE = { sm: 'size-11', md: 'size-12', lg: 'size-14' } as const;
const ICON = { sm: 'size-5', md: 'size-6', lg: 'size-6' } as const;

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  badge,
  iconClassName,
  className,
  type = 'button',
  ref,
  ...rest
}: IconButtonProps) {
  const t = useT();
  const count = typeof badge === 'number' ? badge : 0;
  const name = count > 0 ? `${label}, ${t('ui.badge.count', { n: count })}` : badge === true ? `${label}, ${t('ui.badge.new')}` : label;
  return (
    <button
      ref={ref}
      type={type}
      aria-label={name}
      title={label}
      className={cx(
        'press relative inline-flex shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-40',
        SIZE[size],
        VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {renderIcon(icon, { className: cx(ICON[size], iconClassName), strokeWidth: 2 })}
      {badge ? (
        <CountBadge
          count={count}
          dot={badge === true}
          ring={variant === 'onDark' ? 'appbar' : 'surface'}
          className={cx('absolute', badge === true ? 'top-2.5 right-2.5' : 'top-1 right-0.5')}
        />
      ) : null}
    </button>
  );
}
