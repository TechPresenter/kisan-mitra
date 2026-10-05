import type { ReactNode } from 'react';
import { useT } from '../../lib/i18n';
import { CountBadge } from './Badge';
import { cx } from './cx';
import { renderIcon, type IconLike } from './icon';
import './strings';

export interface BottomNavItem<K extends string = string> {
  key: K;
  label: ReactNode;
  icon: IconLike;
  /** Count or `true` for a dot. */
  badge?: number | boolean;
  /** The raised green circle (AI tab). */
  highlight?: boolean;
  /** Accessible name when `label` isn't plain text. */
  ariaLabel?: string;
}

export interface BottomNavProps<K extends string = string> {
  items: BottomNavItem<K>[];
  active: K;
  onSelect: (key: K) => void;
  /** Hindi name of the navigation landmark. */
  ariaLabel?: string;
  /** Default true: fixed to the bottom of the viewport. */
  fixed?: boolean;
  className?: string;
}

/**
 * White tab bar with safe-area padding. Active = green with a filled icon; the highlighted
 * item (AI) sits on a raised green circle. Height matches --nav-h, which Screen reserves.
 */
export function BottomNav<K extends string = string>({ items, active, onSelect, ariaLabel, fixed = true, className }: BottomNavProps<K>) {
  const t = useT();
  return (
    <nav
      aria-label={ariaLabel}
      className={cx(
        'z-30 border-t border-line bg-surface safe-pb shadow-float',
        fixed && 'fixed inset-x-0 bottom-0',
        className,
      )}
    >
      <ul className="mx-auto flex h-[var(--nav-h)] max-w-lg items-stretch">
        {items.map(item => {
          const isActive = item.key === active;
          const count = typeof item.badge === 'number' ? item.badge : 0;
          const labelText = typeof item.label === 'string' ? item.label : (item.ariaLabel ?? '');
          const a11yName =
            count > 0 ? `${labelText}, ${t('ui.badge.count', { n: count })}` : item.badge === true ? `${labelText}, ${t('ui.badge.new')}` : undefined;
          const badge = item.badge ? (
            <CountBadge
              count={count}
              dot={item.badge === true}
              className={cx('absolute', item.badge === true ? '-top-0.5 -right-0.5' : '-top-1.5 -right-2.5')}
            />
          ) : null;
          return (
            <li key={item.key} className="flex min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onSelect(item.key)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={a11yName ?? item.ariaLabel}
                className={cx(
                  'press flex min-h-12 w-full flex-col items-center justify-center gap-0.5 px-1',
                  isActive ? 'text-brand' : 'text-ink-2 hover:text-ink',
                )}
              >
                {item.highlight ? (
                  <span
                    className={cx(
                      'relative -mt-6 inline-flex size-13 items-center justify-center rounded-full text-white shadow-float ring-4 ring-surface',
                      isActive ? 'bg-brand-700' : 'bg-brand-600',
                    )}
                  >
                    {renderIcon(item.icon, { className: 'size-6.5', strokeWidth: 2.25 })}
                    {badge}
                  </span>
                ) : (
                  <span className="relative inline-flex">
                    {renderIcon(item.icon, {
                      className: 'size-6',
                      strokeWidth: isActive ? 2.4 : 2,
                      ...(isActive ? { fill: 'currentColor', fillOpacity: 0.2 } : {}),
                    })}
                    {badge}
                  </span>
                )}
                <span
                  className={cx(
                    'max-w-full truncate text-caption leading-snug',
                    isActive ? 'font-bold' : 'font-medium',
                    item.highlight && !isActive && 'text-brand',
                  )}
                >
                  {item.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
