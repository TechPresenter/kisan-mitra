import { isValidElement, type ReactNode } from 'react';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { useT } from '../../lib/i18n';
import { cx } from './cx';
import { IconButton } from './IconButton';
import { renderIcon, type IconLike } from './icon';
import '../../lib/common-strings';

export interface AppBarAction {
  icon: IconLike;
  /** Hindi accessible name, e.g. t('ui.notifications'). */
  label: string;
  onPress: () => void;
  /** Count or `true` for a red dot (bell). */
  badge?: number | boolean;
  disabled?: boolean;
  /** Spins the icon (e.g. refresh in progress). */
  busy?: boolean;
  key?: string;
}

export interface AppBarProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Shows the back arrow. */
  onBack?: () => void;
  /** Replaces the back arrow, e.g. the logo tile on Home. */
  leading?: ReactNode;
  /** Icon actions on the right, or any custom node. */
  actions?: AppBarAction[] | ReactNode;
  /** Extra content inside the green header under the title row (location pill, search…). */
  children?: ReactNode;
  /** Over an illustrated hero: no fill, a soft top scrim keeps white text readable. */
  transparent?: boolean;
  /** Float over the content below (hero screens) instead of taking space in the layout. */
  overlay?: boolean;
  className?: string;
}

export function isActionList(a: unknown): a is AppBarAction[] {
  return Array.isArray(a) && a.every(x => x && !isValidElement(x) && typeof x === 'object' && 'onPress' in x);
}

/** Deep green app bar under the status bar: back, white title/subtitle, white icon actions. */
export function AppBar({ title, subtitle, onBack, leading, actions, children, transparent = false, overlay = false, className }: AppBarProps) {
  const t = useT();
  const start = leading ?? (onBack ? <IconButton icon={ArrowLeft} label={t('common.back')} variant="onDark" onClick={onBack} /> : null);
  return (
    <header
      className={cx(
        'on-dark z-20 shrink-0 safe-pt text-white transition-colors duration-200',
        overlay ? 'absolute inset-x-0 top-0' : 'relative',
        transparent ? 'bg-transparent' : 'bg-appbar',
        className,
      )}
    >
      {transparent && (
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/35 via-black/10 to-transparent" />
      )}
      <div className={cx('relative flex min-h-14 items-center gap-1 pr-1', leading || !start ? 'pl-4' : 'pl-1')}>
        {start}
        <div className={cx('min-w-0 flex-1', leading ? 'pl-2' : start && 'pl-1')}>
          {title != null && <h1 className="truncate text-title font-semibold">{title}</h1>}
          {subtitle != null && <p className="-mt-0.5 truncate text-caption text-white/80">{subtitle}</p>}
        </div>
        {actions != null && (
          <div className="flex shrink-0 items-center">{isActionList(actions) ? <AppBarActions actions={actions} /> : actions}</div>
        )}
      </div>
      {children != null && <div className="relative px-4 pb-4">{children}</div>}
    </header>
  );
}

/** White icon buttons for the green header (also used by Screen to add its refresh action). */
export function AppBarActions({ actions }: { actions: AppBarAction[] }) {
  return (
    <>
      {actions.map((a, i) => (
        <IconButton
          key={a.key ?? i}
          icon={a.icon}
          label={a.label}
          badge={a.badge}
          disabled={a.disabled}
          variant="onDark"
          onClick={a.onPress}
          iconClassName={a.busy ? 'animate-spin' : undefined}
        />
      ))}
    </>
  );
}

export interface HeaderPillProps {
  icon?: IconLike;
  label: ReactNode;
  onPress?: () => void;
  /** Shows a chevron-down (it opens a picker). Default true when pressable. */
  chevron?: boolean;
  ariaLabel?: string;
  className?: string;
}

/** White rounded pill inside the green header, e.g. 📍 "वाराणसी, उत्तर प्रदेश" ▾ on Home. */
export function HeaderPill({ icon, label, onPress, chevron, ariaLabel, className }: HeaderPillProps) {
  const showChevron = chevron ?? !!onPress;
  const content = (
    <>
      {renderIcon(icon, { className: 'size-5 shrink-0 text-brand-700', strokeWidth: 2.25 })}
      <span className="min-w-0 flex-1 truncate pt-0.5 text-left">{label}</span>
      {showChevron && <ChevronDown aria-hidden className="size-5 shrink-0 text-ink-2" />}
    </>
  );
  const cls = cx(
    'flex min-h-12 w-full items-center gap-2 rounded-full bg-surface px-4 text-body font-medium text-ink shadow-float',
    className,
  );
  if (!onPress) return <div className={cls}>{content}</div>;
  return (
    <button type="button" aria-label={ariaLabel} onClick={onPress} className={cx('press', cls)}>
      {content}
    </button>
  );
}
