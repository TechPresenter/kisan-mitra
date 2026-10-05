// "सूचनाएं" — the in-app notification center (reference screen 20): category filter chips,
// "सभी पढ़ा हुआ" / "सभी हटाएं" under them, rows grouped into आज / इससे पहले, urgent items marked
// in red, tap to open, ⋯ for details/delete.
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, CheckCheck, MoreHorizontal, Settings, Trash2, TriangleAlert } from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  ChipGroup,
  EmptyState,
  IconButton,
  ListRow,
  Screen,
  SectionHeader,
  Sheet,
  ToneIcon,
  confirm,
  cx,
  toast,
  type ChipOption,
} from '../../components/ui';
import { EmptyArt } from '../../components/illustrations';
import { useSettings } from '../../lib/app-state';
import { formatUpdated, toISODate } from '../../lib/format';
import { useT, type TFunction } from '../../lib/i18n';
import { useIsActiveScreen, useNav } from '../../lib/nav';
import { KEYS, collection } from '../../lib/store';
import { useNotifications } from '../../services/notifications';
import type { AppNotification, NavTarget, NotificationCategory } from '../../types/models';
import { canOpenTarget } from '../search/targets';
import { NOTIFICATION_CATEGORIES, NOTIFICATION_CATEGORY_META, localDay, notificationVisual, timeAgoLabel } from './meta';
import './strings';

type Filter = 'all' | NotificationCategory;

const canOpen = (target?: NavTarget): target is NavTarget => canOpenTarget(target, 'notifications');

/** Puts deleted notifications back (undo); the service keeps them sorted by time. */
function restore(removed: AppNotification[]) {
  const col = collection<AppNotification>(KEYS.notifications);
  const current = col.all();
  const ids = new Set(current.map(n => n.id));
  col.setAll([...current, ...removed.filter(n => !ids.has(n.id))]);
}

/** Re-renders once a minute while visible, so "5 मिनट पहले" stays true. */
function useMinuteClock(): number {
  const active = useIsActiveScreen();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

function priorityBadge(n: AppNotification, t: TFunction) {
  if (n.priority === 'urgent')
    return (
      <Badge tone="red" icon={TriangleAlert}>
        {t('notifications.urgent')}
      </Badge>
    );
  if (n.priority === 'important') return <Badge tone="amber">{t('notifications.important')}</Badge>;
  return null;
}

interface RowProps {
  n: AppNotification;
  now: number;
  t: TFunction;
  onOpen: (n: AppNotification) => void;
  onMore: (n: AppNotification) => void;
}

function NotificationRow({ n, now, t, onOpen, onMore }: RowProps) {
  const { icon, tone } = notificationVisual(n);
  const time = timeAgoLabel(n.createdAt, t, now);
  const urgent = n.priority === 'urgent';
  const badge = priorityBadge(n, t);
  return (
    <ListRow
      leading={<ToneIcon icon={icon} tone={tone} />}
      title={
        // The time floats top-right so a long title wraps under it instead of into a narrow column.
        <span className={cx('block', n.read && 'font-medium')}>
          <span className="float-right ml-2 inline-flex items-center gap-1.5 pt-0.5 text-caption font-normal whitespace-nowrap text-ink-3">
            {time}
            {!n.read && <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-brand-600" />}
          </span>
          {n.title}
        </span>
      }
      // Own clamp: ListRow's subtitle `block` class currently overrides its line-clamp.
      subtitle={<span className="line-clamp-2">{n.body}</span>}
      meta={badge ?? undefined}
      trailing={
        <IconButton icon={MoreHorizontal} label={`${t('notifications.more')}: ${n.title}`} className="-mr-2" onClick={() => onMore(n)} />
      }
      onPress={() => onOpen(n)}
      ariaLabel={[!n.read && t('notifications.new'), urgent && t('notifications.urgent'), n.title, time].filter(Boolean).join(', ')}
      className={cx(urgent && 'border-l-4 border-l-danger', !n.read && 'bg-brand-50!')}
    />
  );
}

export default function NotificationsScreen() {
  const t = useT();
  const nav = useNav();
  const [settings] = useSettings();
  const { items, unread, markRead, markAllRead, remove } = useNotifications();
  const [filter, setFilter] = useState<Filter>('all');
  const [sheetItem, setSheetItem] = useState<AppNotification | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const now = useMinuteClock();

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const n of items) c[n.category] = (c[n.category] ?? 0) + 1;
    return c;
  }, [items]);

  const chipOptions = useMemo<ChipOption<Filter>[]>(
    () => [
      { value: 'all', label: t('notifications.cat.all'), count: items.length || undefined },
      ...NOTIFICATION_CATEGORIES.map(c => ({ value: c, label: t(NOTIFICATION_CATEGORY_META[c].labelKey), count: counts[c] || undefined })),
    ],
    [t, items.length, counts],
  );

  const today = toISODate(new Date(now));
  const sections = useMemo(() => {
    const list = filter === 'all' ? items : items.filter(n => n.category === filter);
    const todays = list.filter(n => localDay(n.createdAt) === today);
    const earlier = list.filter(n => localDay(n.createdAt) !== today);
    return [
      { key: 'today', title: t('common.today'), items: todays },
      { key: 'earlier', title: t('notifications.earlier'), items: earlier },
    ].filter(s => s.items.length > 0);
  }, [items, filter, today, t]);

  // The sheet shows the live copy (read state) but keeps the last one while it animates out.
  const sheetLive = sheetItem ? (items.find(n => n.id === sheetItem.id) ?? sheetItem) : null;

  const showDetails = (n: AppNotification) => {
    setSheetItem(n);
    setSheetOpen(true);
  };

  const openItem = (n: AppNotification) => {
    if (!n.read) markRead(n.id);
    if (canOpen(n.target)) nav.open(n.target);
    else showDetails(n);
  };

  const deleteItem = (n: AppNotification) => {
    setSheetOpen(false);
    remove(n.id);
    toast(t('notifications.deleted'), { action: { label: t('notifications.undo'), onPress: () => restore([n]) } });
  };

  const readAll = () => {
    if (!unread) return;
    markAllRead();
    toast.success(t('notifications.markAllReadDone'));
  };

  const clearAll = async () => {
    const snapshot = [...items];
    if (!snapshot.length) return;
    const ok = await confirm({
      title: t('notifications.clearAllTitle'),
      message: snapshot.length === 1 ? t('notifications.clearAllBodyOne') : t('notifications.clearAllBody', { n: snapshot.length }),
      confirmLabel: t('common.delete'),
      tone: 'danger',
      icon: Trash2,
    });
    if (!ok) return;
    // Only what the farmer saw: a weather or mandi alert that arrived while the dialog was open stays.
    const ids = new Set(snapshot.map(n => n.id));
    const col = collection<AppNotification>(KEYS.notifications);
    col.setAll(col.all().filter(n => !ids.has(n.id)));
    setFilter('all');
    toast(t('notifications.cleared'), { action: { label: t('notifications.undo'), onPress: () => restore(snapshot) } });
  };

  const openSettings = () => nav.push('settings');

  const actions = [{ key: 'settings', icon: Settings, label: t('notifications.settings'), onPress: openSettings }];

  const subtitle = !items.length
    ? undefined
    : unread === 0
      ? t('notifications.allRead')
      : unread === 1
        ? t('notifications.unreadOne')
        : t('notifications.unreadMany', { n: unread });

  const sheetVisual = sheetLive ? notificationVisual(sheetLive) : null;
  const sheetCanOpen = !!sheetLive && canOpen(sheetLive.target);

  return (
    <Screen title={t('notifications.title')} subtitle={subtitle} actions={actions}>
      {!settings.notifications.enabled && (
        <Callout
          tone="warning"
          title={t('notifications.off.title')}
          action={
            <Button variant="secondary" icon={Settings} onClick={openSettings}>
              {t('notifications.off.action')}
            </Button>
          }
        >
          {t('notifications.off.body')}
        </Callout>
      )}

      {items.length === 0 ? (
        <EmptyState
          art={<EmptyArt kind="notifications" />}
          title={t('notifications.empty.title')}
          body={t('notifications.empty.body')}
          // When notifications are off, the callout above already links to settings.
          action={settings.notifications.enabled ? { label: t('notifications.empty.action'), icon: Settings, onPress: openSettings } : undefined}
        />
      ) : (
        <>
          <ChipGroup ariaLabel={t('notifications.filter')} value={filter} onChange={setFilter} options={chipOptions} />

          <div className="-my-2 flex flex-wrap items-center justify-between gap-x-2">
            {unread > 0 ? (
              <Button variant="ghost" icon={CheckCheck} className="-ml-3" onClick={readAll}>
                {t('notifications.markAllRead')}
              </Button>
            ) : (
              <span />
            )}
            <Button variant="ghost" icon={Trash2} className="-mr-3 text-danger! hover:bg-tint-red!" onClick={clearAll}>
              {t('notifications.clearAll')}
            </Button>
          </div>

          {sections.length === 0 ? (
            <EmptyState
              compact
              icon={NOTIFICATION_CATEGORY_META[filter as NotificationCategory]?.icon}
              tone={NOTIFICATION_CATEGORY_META[filter as NotificationCategory]?.tone ?? 'green'}
              title={t('notifications.emptyFilter.title')}
              body={t('notifications.emptyFilter.body')}
              action={{ label: t('notifications.emptyFilter.action'), onPress: () => setFilter('all') }}
            />
          ) : (
            sections.map(section => (
              <section key={section.key} aria-labelledby={`notif-${section.key}`} className="flex flex-col gap-3">
                <SectionHeader
                  title={<span id={`notif-${section.key}`}>{section.title}</span>}
                  action={<span className="text-small text-ink-2 tabular-nums">{section.items.length}</span>}
                />
                <ul className="flex flex-col gap-3">
                  {section.items.map(n => (
                    <li key={n.id}>
                      <NotificationRow n={n} now={now} t={t} onOpen={openItem} onMore={showDetails} />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={sheetLive?.title}
        description={sheetLive ? t('notifications.received', { time: formatUpdated(sheetLive.createdAt) }) : undefined}
        footer={
          sheetLive ? (
            <div className="flex flex-col gap-2">
              {sheetCanOpen && (
                <Button
                  fullWidth
                  size="lg"
                  iconRight={ArrowRight}
                  onClick={() => {
                    setSheetOpen(false);
                    openItem(sheetLive);
                  }}
                >
                  {t('notifications.open')}
                </Button>
              )}
              <div className="grid grid-cols-2 gap-2">
                {!sheetLive.read ? (
                  <Button variant="secondary" icon={Check} onClick={() => markRead(sheetLive.id)}>
                    {t('notifications.markRead')}
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => setSheetOpen(false)}>
                    {t('common.close')}
                  </Button>
                )}
                <Button variant="ghost" icon={Trash2} className="text-danger! hover:bg-tint-red!" onClick={() => deleteItem(sheetLive)}>
                  {t('common.delete')}
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        {sheetLive && sheetVisual && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <ToneIcon icon={sheetVisual.icon} tone={sheetVisual.tone} size="sm" />
              <span className="text-small font-semibold text-ink-2">
                {t(NOTIFICATION_CATEGORY_META[sheetLive.category]?.labelKey ?? 'notifications.cat.all')}
              </span>
              {priorityBadge(sheetLive, t)}
            </div>
            <p className="text-body whitespace-pre-line text-ink">{sheetLive.body}</p>
            {!sheetCanOpen && <p className="text-small text-ink-2">{t('notifications.infoOnly')}</p>}
          </div>
        )}
      </Sheet>
    </Screen>
  );
}
