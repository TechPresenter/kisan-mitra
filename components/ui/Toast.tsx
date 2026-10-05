import { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { cx } from './cx';

export type ToastTone = 'default' | 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  message: string;
  tone?: ToastTone;
  /** ms; default 4000, or 6500 with an action. */
  duration?: number;
  action?: { label: string; onPress: () => void };
  /** Reusing an id replaces that toast instead of stacking a duplicate. */
  id?: string;
}

interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
  duration: number;
  action?: ToastOptions['action'];
}

const MAX_VISIBLE = 3;
let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

function show(input: string | ToastOptions, extra?: Omit<ToastOptions, 'message'>): string {
  const o: ToastOptions = typeof input === 'string' ? { ...extra, message: input } : { ...extra, ...input };
  const id = o.id ?? `toast-${++seq}`;
  const item: ToastItem = {
    id,
    message: o.message,
    tone: o.tone ?? 'default',
    duration: o.duration ?? (o.action ? 6500 : 4000),
    action: o.action,
  };
  items = [...items.filter(x => x.id !== id), item].slice(-MAX_VISIBLE);
  emit();
  return id;
}

function dismiss(id?: string) {
  items = id ? items.filter(x => x.id !== id) : [];
  emit();
}

type ToastFn = (message: string, opts?: Omit<ToastOptions, 'message' | 'tone'>) => string;

/**
 * Short, non-blocking message above the bottom nav. Works from anywhere (no hook):
 * toast('सेव हो गया'), toast.success(…), toast.error(…), toast({ message, action }).
 * Mount <Toaster/> once in the app shell.
 */
export const toast = Object.assign(show, {
  success: ((m, o) => show(m, { ...o, tone: 'success' })) as ToastFn,
  error: ((m, o) => show(m, { ...o, tone: 'error' })) as ToastFn,
  info: ((m, o) => show(m, { ...o, tone: 'info' })) as ToastFn,
  warning: ((m, o) => show(m, { ...o, tone: 'warning' })) as ToastFn,
  dismiss,
});

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const snapshot = () => items;

const ICON = {
  success: { Icon: CircleCheck, cls: 'text-[#4ade80]' },
  error: { Icon: CircleAlert, cls: 'text-[#fca5a5]' },
  info: { Icon: Info, cls: 'text-[#7cc0f7]' },
  warning: { Icon: TriangleAlert, cls: 'text-[#fcd34d]' },
} as const;

function ToastView({ item }: { item: ToastItem }) {
  useEffect(() => {
    const timer = setTimeout(() => dismiss(item.id), item.duration);
    return () => clearTimeout(timer);
  }, [item.id, item.duration, item.message]);
  const icon = item.tone !== 'default' ? ICON[item.tone] : null;
  return (
    <div
      className={cx(
        // Dark in both themes so it never blends into the page.
        'pointer-events-auto flex w-full max-w-md animate-toast-in items-center gap-3 rounded-2xl bg-[#1d2a22] py-3 pr-2 pl-4 text-white shadow-float',
        'dark:ring-1 dark:ring-white/10',
        !item.action && 'pr-4',
      )}
    >
      {icon && <icon.Icon aria-hidden className={cx('size-5 shrink-0', icon.cls)} />}
      <p className="min-w-0 flex-1 pt-0.5 text-small leading-snug">{item.message}</p>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            item.action?.onPress();
            dismiss(item.id);
          }}
          className="press min-h-11 shrink-0 rounded-xl px-3 text-small font-bold text-[#86efac] hover:bg-white/10"
        >
          {item.action.label}
        </button>
      )}
    </div>
  );
}

export interface ToasterProps {
  /**
   * 'nav' (default) floats above the bottom navigation; 'bottom' sits at the safe-area edge.
   * Both also clear a Screen's sticky footer (--footer-h), so a toast never covers its button.
   */
  offset?: 'nav' | 'bottom';
}

/** Mount once. Renders the live region for toast() messages. */
export function Toaster({ offset = 'nav' }: ToasterProps) {
  const list = useSyncExternalStore(subscribe, snapshot, snapshot);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className={cx(
        'pointer-events-none fixed inset-x-0 z-[70] flex flex-col items-center gap-2 px-4',
        offset === 'nav' ? 'nav-bottom' : 'bottom-[calc(1rem+var(--footer-h,0px)+var(--inset-bottom))]',
      )}
    >
      {list.map(item => (
        <ToastView key={item.id} item={item} />
      ))}
    </div>,
    document.body,
  );
}
