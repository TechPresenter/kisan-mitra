// Visual metadata for notifications (category icon + tone) and the short "2 घंटे पहले" label.
// Other modules may reuse these to show a notification consistently (e.g. a Home preview);
// importing this file registers the notifications.* strings they need.
import { AlarmClock, CloudLightning, CloudSun, Landmark, Sparkles, Sprout, TrendingUp, type LucideIcon } from 'lucide-react';
import type { Tone } from '../../components/ui';
import { daysBetween, formatDate, toISODate, todayISO } from '../../lib/format';
import type { TFunction } from '../../lib/i18n';
import type { AppNotification, NotificationCategory } from '../../types/models';
import './strings';

export const NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = ['weather', 'crop', 'mandi', 'government', 'reminder', 'ai'];

interface CategoryMeta {
  icon: LucideIcon;
  tone: Tone;
  /** i18n key of the short category label ("मौसम"). */
  labelKey: string;
}

export const NOTIFICATION_CATEGORY_META: Record<NotificationCategory, CategoryMeta> = {
  weather: { icon: CloudSun, tone: 'sky', labelKey: 'notifications.cat.weather' },
  crop: { icon: Sprout, tone: 'green', labelKey: 'notifications.cat.crop' },
  mandi: { icon: TrendingUp, tone: 'amber', labelKey: 'notifications.cat.mandi' },
  government: { icon: Landmark, tone: 'indigo', labelKey: 'notifications.cat.government' },
  reminder: { icon: AlarmClock, tone: 'orange', labelKey: 'notifications.cat.reminder' },
  ai: { icon: Sparkles, tone: 'tech', labelKey: 'notifications.cat.ai' },
};

/** Icon and tone for one notification: urgent weather turns red with a storm icon. */
export function notificationVisual(n: Pick<AppNotification, 'category' | 'priority'>): { icon: LucideIcon; tone: Tone } {
  const meta = NOTIFICATION_CATEGORY_META[n.category] ?? NOTIFICATION_CATEGORY_META.crop;
  if (n.category === 'weather' && n.priority === 'urgent') return { icon: CloudLightning, tone: 'red' };
  return { icon: meta.icon, tone: meta.tone };
}

/** Local calendar day of an ISO timestamp ('' when unparsable). */
export function localDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : toISODate(d);
}

/** "अभी" / "5 मिनट पहले" / "2 घंटे पहले" / "बीता कल" / "3 दिन पहले" / "12 सितंबर". */
export function timeAgoLabel(iso: string, t: TFunction, now: number = Date.now()): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const mins = Math.floor((now - ts) / 60_000);
  if (mins < 1) return t('common.justNow');
  if (mins < 60) return t('common.minutesAgo', { n: mins });
  const day = toISODate(new Date(ts));
  const days = daysBetween(day, todayISO());
  if (days <= 0) return t('notifications.hoursAgo', { n: Math.floor(mins / 60) });
  if (days === 1) return t('common.yesterday');
  if (days < 7) return t('notifications.daysAgo', { n: days });
  return formatDate(day);
}
