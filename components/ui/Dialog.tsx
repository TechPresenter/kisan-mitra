import { useId, useLayoutEffect, useRef, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useBackHandler } from '../../lib/back';
import { useT } from '../../lib/i18n';
import { Button } from './Button';
import { cx } from './cx';
import { useModalFocus, usePresence } from './hooks';
import { DUOTONE, renderIcon, type IconLike } from './icon';
import { TINT_BG, TONE_TEXT, type Tone } from './tones';
import './strings';
import '../../lib/common-strings';

export type DialogTone = 'default' | 'danger' | 'tech';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
  /** Buttons row; use <Button fullWidth/> pairs. */
  actions?: ReactNode;
  icon?: IconLike;
  tone?: DialogTone;
  /** Default true: scrim tap / back / Escape close it. */
  dismissible?: boolean;
  /** 'alertdialog' for confirmations that need an answer. */
  role?: 'dialog' | 'alertdialog';
}

const ICON_TONE: Record<DialogTone, Tone> = { default: 'green', danger: 'red', tech: 'tech' };
const noop = () => {};

/** Centered modal card for short decisions. Prefer Sheet for anything with more than a sentence. */
export function Dialog({ open, onClose, title, children, actions, icon, tone = 'default', dismissible = true, role = 'dialog' }: DialogProps) {
  const { mounted, closing } = usePresence(open, 150);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const bodyId = useId();
  useBackHandler(dismissible ? onClose : noop, open);
  const trapTab = useModalFocus(open, panelRef);

  if (!mounted || typeof document === 'undefined') return null;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (dismissible) onClose();
      return;
    }
    trapTab(e);
  };

  return createPortal(
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-6" onKeyDown={onKeyDown}>
      <div
        aria-hidden
        onClick={dismissible ? onClose : undefined}
        className={cx('absolute inset-0 bg-[var(--scrim)] transition-opacity duration-150', closing ? 'opacity-0' : 'animate-fade-in')}
      />
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={children != null ? bodyId : undefined}
        tabIndex={-1}
        className={cx(
          'relative w-full max-w-sm rounded-card bg-surface p-5 shadow-float outline-none',
          'transition-[opacity,scale] duration-150 ease-out',
          closing ? 'scale-95 opacity-0' : 'animate-pop-in',
        )}
      >
        {icon && (
          <span className={cx('mb-3 inline-flex size-12 items-center justify-center rounded-full', TINT_BG[ICON_TONE[tone]], TONE_TEXT[ICON_TONE[tone]])}>
            {renderIcon(icon, { className: 'size-6', strokeWidth: 2, ...DUOTONE })}
          </span>
        )}
        <h2 id={titleId} className="text-section font-bold text-ink">
          {title}
        </h2>
        {children != null && (
          <div id={bodyId} className="mt-1.5 text-body text-ink-2">
            {children}
          </div>
        )}
        {actions != null && <div className="mt-5 flex gap-3">{actions}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ---------- confirm() / showAlert() promise API ----------

export interface ConfirmOptions {
  title: string;
  message?: string;
  /** Default "ठीक है". */
  confirmLabel?: string;
  /** Default "रद्द करें". */
  cancelLabel?: string;
  tone?: DialogTone;
  icon?: IconLike;
}

interface Pending extends ConfirmOptions {
  id: number;
  kind: 'confirm' | 'alert';
  resolve: (ok: boolean) => void;
}

let queue: Pending[] = [];
let seq = 0;
let hosts = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

function enqueue(kind: Pending['kind'], opts: ConfirmOptions): Promise<boolean> {
  if (!hosts && typeof window !== 'undefined') {
    // No <DialogHost/> mounted (e.g. during early boot): fall back to the native dialog.
    const text = opts.message ? `${opts.title}\n\n${opts.message}` : opts.title;
    if (kind === 'alert') {
      window.alert(text);
      return Promise.resolve(true);
    }
    return Promise.resolve(window.confirm(text));
  }
  return new Promise(resolve => {
    queue = [...queue, { ...opts, kind, id: ++seq, resolve }];
    emit();
  });
}

/** `if (await confirm({ title: t('common.confirmDelete'), tone: 'danger' })) …` */
export function confirm(opts: ConfirmOptions | string): Promise<boolean> {
  return enqueue('confirm', typeof opts === 'string' ? { title: opts } : opts);
}

/** One-button notice; resolves when dismissed. */
export function showAlert(opts: Omit<ConfirmOptions, 'cancelLabel'> | string): Promise<void> {
  return enqueue('alert', typeof opts === 'string' ? { title: opts } : opts).then(() => undefined);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const snapshot = () => queue;

/** Mount once in the app shell; renders confirm()/showAlert() requests one at a time. */
export function DialogHost() {
  const t = useT();
  const list = useSyncExternalStore(subscribe, snapshot, snapshot);
  const current = list[0];
  // Keep showing the last request while the dialog animates out.
  const lastRef = useRef<Pending | undefined>(current);
  if (current) lastRef.current = current;
  const view = current ?? lastRef.current;

  // Layout effect: registers before any screen's passive effect can call confirm() on mount.
  useLayoutEffect(() => {
    hosts++;
    return () => {
      hosts--;
    };
  }, []);

  const settle = (ok: boolean) => {
    if (!current) return;
    queue = queue.filter(p => p.id !== current.id);
    emit();
    current.resolve(ok);
  };

  return (
    <Dialog
      open={!!current}
      onClose={() => settle(false)}
      title={view?.title ?? ''}
      icon={view?.icon}
      tone={view?.tone}
      role="alertdialog"
      actions={
        view ? (
          <>
            {view.kind === 'confirm' && (
              <Button variant="secondary" fullWidth onClick={() => settle(false)}>
                {view.cancelLabel ?? t('common.cancel')}
              </Button>
            )}
            <Button
              variant={view.tone === 'danger' ? 'danger' : view.tone === 'tech' ? 'tech' : 'primary'}
              fullWidth
              onClick={() => settle(true)}
            >
              {view.confirmLabel ?? (view.kind === 'confirm' && view.tone === 'danger' ? t('common.delete') : t('ui.dialog.ok'))}
            </Button>
          </>
        ) : null
      }
    >
      {view?.message}
    </Dialog>
  );
}
