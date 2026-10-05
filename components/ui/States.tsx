import type { ReactNode } from 'react';
import { Clock, CloudOff, RefreshCw, WifiOff } from 'lucide-react';
import { useOnline } from '../../lib/cache';
import { formatUpdated } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { Badge } from './Badge';
import { Button } from './Button';
import { cx } from './cx';
import type { IconLike } from './icon';
import { IconButton } from './IconButton';
import { ToneIcon } from './Media';
import type { Tone } from './tones';
import './strings';
import '../../lib/common-strings';

export interface StateAction {
  label: string;
  onPress: () => void;
  icon?: IconLike;
}

// ---------- EmptyState ----------

export interface EmptyStateProps {
  /** Illustration (components/illustrations). Falls back to a tinted icon. */
  art?: ReactNode;
  icon?: IconLike;
  tone?: Tone;
  title: ReactNode;
  body?: ReactNode;
  /** Primary action, e.g. "नई फसल जोड़ें". */
  action?: StateAction;
  secondaryAction?: StateAction;
  /** Smaller vertical padding for use inside a section. */
  compact?: boolean;
  className?: string;
}

export function EmptyState({ art, icon, tone = 'green', title, body, action, secondaryAction, compact = false, className }: EmptyStateProps) {
  return (
    <div className={cx('flex flex-col items-center text-center', compact ? 'px-4 py-6' : 'px-6 py-10', className)}>
      {art != null ? (
        <div className="mb-4 w-full max-w-[12rem]">{art}</div>
      ) : icon ? (
        <ToneIcon icon={icon} tone={tone} size="xl" className="mb-4" />
      ) : null}
      <h3 className="text-card-title font-semibold text-ink">{title}</h3>
      {body != null && <p className="mt-1 max-w-xs text-small text-ink-2">{body}</p>}
      {(action || secondaryAction) && (
        <div className="mt-5 flex w-full max-w-xs flex-col gap-2">
          {action && (
            <Button fullWidth icon={action.icon} onClick={action.onPress}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button fullWidth variant="ghost" icon={secondaryAction.icon} onClick={secondaryAction.onPress}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- ErrorState ----------

export interface ErrorStateProps {
  /** The caught error. Never shown raw: AI errors map to their messageKey, others to a friendly line. */
  error?: unknown;
  title?: ReactNode;
  message?: ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
  /** Inline card for a failed section instead of a full-height block. */
  compact?: boolean;
  className?: string;
}

function messageKeyOf(error: unknown): string | null {
  const key = (error as { messageKey?: unknown } | null)?.messageKey;
  return typeof key === 'string' ? key : null;
}

/** Friendly Hindi error with what to do and a "फिर कोशिश करें" button; knows when the phone is offline. */
export function ErrorState({ error, title, message, onRetry, retrying = false, compact = false, className }: ErrorStateProps) {
  const t = useT();
  const online = useOnline();
  const key = messageKeyOf(error);
  const resolvedTitle = title ?? (online ? t('ui.error.title') : t('ui.error.offlineTitle'));
  const resolvedMessage = message ?? (!online ? t('common.error.offline') : key ? t(key) : t('common.error.generic'));
  const Icon = online ? CloudOff : WifiOff;

  if (compact) {
    return (
      <div role="alert" className={cx('flex items-center gap-3 rounded-list border border-line bg-surface p-4', className)}>
        <ToneIcon icon={Icon} tone={online ? 'red' : 'amber'} size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-body font-semibold text-ink">{resolvedTitle}</p>
          <p className="text-small text-ink-2">{resolvedMessage}</p>
        </div>
        {onRetry && (
          <IconButton icon={RefreshCw} label={t('common.retry')} variant="soft" onClick={onRetry} disabled={retrying} iconClassName={retrying ? 'animate-spin' : undefined} />
        )}
      </div>
    );
  }
  return (
    <div role="alert" className={cx('flex flex-col items-center px-6 py-10 text-center', className)}>
      <ToneIcon icon={Icon} tone={online ? 'red' : 'amber'} size="xl" className="mb-4" />
      <h3 className="text-card-title font-semibold text-ink">{resolvedTitle}</h3>
      <p className="mt-1 max-w-xs text-small text-ink-2">{resolvedMessage}</p>
      {onRetry && (
        <Button className="mt-5 w-full max-w-xs" icon={RefreshCw} loading={retrying} onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}

// ---------- OfflineBanner ----------

export interface OfflineBannerProps {
  /** Force visibility (tests / gallery); default follows the network. */
  show?: boolean;
  className?: string;
}

/** Amber strip shown while the phone is offline: "इंटरनेट नहीं है — पिछली सेव जानकारी…". */
export function OfflineBanner({ show, className }: OfflineBannerProps) {
  const t = useT();
  const online = useOnline();
  if (!(show ?? !online)) return null;
  return (
    <div role="status" className={cx('flex items-start gap-2.5 rounded-list bg-tint-amber px-4 py-3 text-tone-amber hc:border hc:border-line', className)}>
      <WifiOff aria-hidden className="mt-0.5 size-5 shrink-0" />
      <p className="text-small font-medium">{t('common.offline')}</p>
    </div>
  );
}

// ---------- LastUpdated ----------

export interface LastUpdatedProps {
  /** fetchedAt (epoch ms or ISO). Nothing renders without it. */
  at?: number | string | null;
  /** Older than its freshness window (Resource.stale) → "पुरानी जानकारी" badge. */
  stale?: boolean;
  refreshing?: boolean;
  /** Adds a small refresh button. */
  onRefresh?: () => void;
  className?: string;
}

/** "अपडेट: आज 10:30 AM" (+ stale badge). Show it under every cached data block. */
export function LastUpdated({ at, stale = false, refreshing = false, onRefresh, className }: LastUpdatedProps) {
  const t = useT();
  if (at == null || at === '') return null;
  return (
    <div className={cx('flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-2', className)}>
      <span className="inline-flex items-center gap-1.5">
        <Clock aria-hidden className="size-4 shrink-0 text-ink-3" />
        <span className="pt-0.5">{refreshing && !onRefresh ? t('ui.refreshing') : t('common.lastUpdated', { time: formatUpdated(at) })}</span>
      </span>
      {stale && <Badge tone="amber">{t('common.staleData')}</Badge>}
      {onRefresh && (
        <IconButton
          icon={RefreshCw}
          label={t('common.refresh')}
          size="sm"
          className="-my-2 ml-auto"
          iconClassName={cx('size-4.5', refreshing && 'animate-spin')}
          disabled={refreshing}
          onClick={onRefresh}
        />
      )}
    </div>
  );
}

