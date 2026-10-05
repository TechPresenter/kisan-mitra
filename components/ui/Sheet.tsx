import { useId, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import { useBackHandler } from '../../lib/back';
import { useT } from '../../lib/i18n';
import { cx } from './cx';
import { useModalFocus, usePresence } from './hooks';
import { IconButton } from './IconButton';
import { renderIcon, type IconLike } from './icon';
import '../../lib/common-strings';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Sticky actions at the bottom (safe-area aware). */
  footer?: ReactNode;
  /** auto = fits content up to 90% height; tall = 90%; full = whole screen below the status bar. */
  size?: 'auto' | 'tall' | 'full';
  /** Default true: scrim tap, back button and Escape close it. */
  dismissible?: boolean;
  /** Element to focus on open (default: first focusable, else the sheet). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Accessible name when there is no visible title. */
  ariaLabel?: string;
  /** Remove the body padding (for edge-to-edge lists). */
  flush?: boolean;
  className?: string;
}

const noop = () => {};

const HEIGHT = {
  auto: 'max-h-[90dvh]',
  tall: 'h-[90dvh]',
  full: 'h-[calc(100dvh-var(--inset-top)-0.5rem)]',
} as const;

/** Bottom sheet: scrim, slide-up panel, focus kept inside, Android back closes it first. */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'auto',
  dismissible = true,
  initialFocusRef,
  ariaLabel,
  flush = false,
  className,
}: SheetProps) {
  const t = useT();
  const { mounted, closing } = usePresence(open);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const descId = useId();

  // Back button: a non-dismissible sheet still swallows back so the screen below doesn't navigate away.
  useBackHandler(dismissible ? onClose : noop, open);
  const trapTab = useModalFocus(open, panelRef, initialFocusRef);

  if (!mounted || typeof document === 'undefined') return null;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      // Handled here so a global Escape → back handler doesn't close a second overlay.
      e.stopPropagation();
      if (dismissible) onClose();
      return;
    }
    trapTab(e);
  };

  return createPortal(
    <div className="fixed inset-0 z-[60]" onKeyDown={onKeyDown}>
      <div
        aria-hidden
        onClick={dismissible ? onClose : undefined}
        className={cx(
          'absolute inset-0 bg-[var(--scrim)] transition-opacity duration-200',
          closing ? 'opacity-0' : 'animate-fade-in',
        )}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title != null ? titleId : undefined}
        aria-label={title == null ? ariaLabel : undefined}
        aria-describedby={description != null ? descId : undefined}
        tabIndex={-1}
        className={cx(
          'absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-lg flex-col rounded-t-[1.5rem] bg-surface shadow-float outline-none',
          'transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)]',
          closing ? 'translate-y-full' : 'animate-sheet-in',
          HEIGHT[size],
          className,
        )}
      >
        <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line-strong" />
        {(title != null || dismissible) && (
          <div className="flex shrink-0 items-start gap-2 pt-2 pr-2 pl-5">
            <div className="min-w-0 flex-1 pt-2.5">
              {title != null && (
                <h2 id={titleId} className="text-section font-bold text-ink">
                  {title}
                </h2>
              )}
              {description != null && (
                <p id={descId} className="mt-0.5 text-small text-ink-2">
                  {description}
                </p>
              )}
            </div>
            {dismissible && <IconButton icon={X} label={t('common.close')} onClick={onClose} />}
          </div>
        )}
        <div
          className={cx(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain',
            !flush && 'px-5 pt-3',
            footer == null ? 'pb-[calc(1.25rem+var(--inset-bottom))]' : 'pb-4',
          )}
        >
          {children}
        </div>
        {footer != null && (
          <div className="shrink-0 border-t border-line px-5 pt-3 pb-[calc(0.75rem+var(--inset-bottom))]">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export interface SelectSheetOption<T extends string = string> {
  value: T;
  label: ReactNode;
  description?: ReactNode;
  icon?: IconLike;
}

export interface SelectSheetProps<T extends string = string> {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  options: SelectSheetOption<T>[];
  value: T | null;
  /** Called with the picked value; the sheet then closes itself. */
  onChange: (value: T) => void;
}

/** Picker behind dropdown chips ("यह सीजन ▾", "गेहूं ▾"): a sheet of options with a check on the current one. */
export function SelectSheet<T extends string = string>({ open, onClose, title, options, value, onChange }: SelectSheetProps<T>) {
  return (
    <Sheet open={open} onClose={onClose} title={title} flush>
      <div role="radiogroup" className="flex flex-col px-2 pt-1">
        {options.map(o => {
          const selected = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                onChange(o.value);
                onClose();
              }}
              className={cx(
                'press flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-surface-2',
                selected && 'bg-brand-50',
              )}
            >
              {renderIcon(o.icon, { className: 'size-5 shrink-0 text-ink-2' })}
              <span className="min-w-0 flex-1">
                <span className={cx('block text-body', selected ? 'font-semibold text-ink' : 'text-ink')}>{o.label}</span>
                {o.description != null && <span className="block text-caption text-ink-2">{o.description}</span>}
              </span>
              {selected && <Check aria-hidden className="size-5 shrink-0 text-brand-700" strokeWidth={2.5} />}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
