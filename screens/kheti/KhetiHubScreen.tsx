// "खेती" tab home: today's tasks, every farming tool grouped by purpose, this season's crops and a
// featured technique. Everything here is on-device, so it renders instantly and works offline.
import { useMemo } from 'react';
import {
  Bell,
  Bookmark,
  Calculator,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  FlaskConical,
  GraduationCap,
  Landmark,
  Lightbulb,
  Search,
  Sprout,
  Stethoscope,
  Users,
  Wallet,
} from 'lucide-react';
import '../../lib/common-strings';
import './strings';
import { CropArt } from '../../components/illustrations';
import { Card, IconTile, Screen, SectionHeader, TileGrid, ToneIcon, type AppBarAction } from '../../components/ui';
import { SEASON_NAMES, catalogText, cropsBySeason, currentSeason } from '../../data/crops';
import { TECHNIQUES, techniquesForCrop } from '../../data/techniques';
import { useLanguage, useT } from '../../lib/i18n';
import { FEATURES } from '../../lib/features';
import { parseISODate, relativeDay, todayISO } from '../../lib/format';
import { useNav } from '../../lib/nav';
import { KEYS, useCollection } from '../../lib/store';
import { useNotifications } from '../../services/notifications';
import { taskText, tasksInRange, useTasks } from '../../services/tasks';
import type { Crop } from '../../types/models';
import { TechniqueCard } from './parts';

export default function KhetiHubScreen() {
  const t = useT();
  const nav = useNav();
  const { language } = useLanguage();
  const lang = language.code;
  const { unread } = useNotifications();

  const actions: AppBarAction[] = [
    { icon: Search, label: t('common.search'), onPress: () => nav.push('search') },
    {
      icon: Bell,
      label: unread ? `${t('ui.notifications')}, ${t('ui.badge.count', { n: unread })}` : t('ui.notifications'),
      badge: unread || undefined,
      onPress: () => nav.push('notifications'),
    },
  ];

  return (
    <Screen title={t('kheti.title')} subtitle={t('kheti.subtitle')} back={false} actions={actions}>
      <TodayBanner />

      <section aria-labelledby="kheti-my" className="flex flex-col gap-3">
        <SectionHeader title={<span id="kheti-my">{t('kheti.section.myFarming')}</span>} />
        <TileGrid columns={4}>
          <IconTile icon={Sprout} tone="green" label={t('kheti.tile.crops')} onPress={() => nav.push('crops')} />
          <IconTile icon={CalendarDays} tone="orange" label={t('kheti.tile.calendar')} onPress={() => nav.push('calendar')} />
          <IconTile icon={Stethoscope} tone="red" label={t('kheti.tile.doctor')} onPress={() => nav.push('crop-doctor')} />
          <IconTile icon={FlaskConical} tone="amber" label={t('kheti.tile.soil')} onPress={() => nav.push('soil')} />
        </TileGrid>
      </section>

      <section aria-labelledby="kheti-tools" className="flex flex-col gap-3">
        <SectionHeader title={<span id="kheti-tools">{t('kheti.section.tools')}</span>} />
        <TileGrid columns={2}>
          <IconTile
            variant="card"
            icon={Wallet}
            tone="teal"
            label={t('kheti.tile.hisab')}
            description={t('kheti.tile.hisabDesc')}
            onPress={() => nav.push('hisab')}
          />
          <IconTile
            variant="card"
            icon={Calculator}
            tone="indigo"
            label={t('kheti.tile.calculators')}
            description={t('kheti.tile.calculatorsDesc')}
            onPress={() => nav.push('calculators')}
          />
        </TileGrid>
      </section>

      <SeasonCrops lang={lang} />

      <section aria-labelledby="kheti-info" className="flex flex-col gap-3">
        <SectionHeader title={<span id="kheti-info">{t('kheti.section.info')}</span>} />
        <TileGrid columns={3}>
          <IconTile icon={Lightbulb} tone="sky" label={t('kheti.tile.techniques')} onPress={() => nav.push('techniques')} />
          <IconTile icon={Landmark} tone="rose" label={t('kheti.tile.schemes')} onPress={() => nav.push('schemes')} />
          <IconTile icon={Bookmark} tone="tech" label={t('kheti.tile.saved')} onPress={() => nav.push('saved')} />
        </TileGrid>
      </section>

      <FeaturedTechnique lang={lang} />

      <section aria-labelledby="kheti-community" className="flex flex-col gap-3">
        <SectionHeader title={<span id="kheti-community">{t('kheti.section.community')}</span>} />
        <TileGrid columns={2}>
          <IconTile
            variant="card"
            icon={Users}
            tone="green"
            label={t('kheti.tile.community')}
            description={FEATURES.community ? t('kheti.tile.communityDesc') : t('kheti.tile.soon')}
            onPress={() => nav.push('community')}
          />
          <IconTile
            variant="card"
            icon={GraduationCap}
            tone="tech"
            label={t('kheti.tile.experts')}
            description={FEATURES.experts ? t('kheti.tile.expertsDesc') : t('kheti.tile.soon')}
            onPress={() => nav.push('experts')}
          />
        </TileGrid>
      </section>
    </Screen>
  );
}

/** "आज 3 काम करने हैं" → calendar. Today's open tasks, leftovers from the last 30 days, else the next one. */
function TodayBanner() {
  const t = useT();
  const nav = useNav();
  const { tasks } = useTasks();
  const crops = useCollection<Crop>(KEYS.crops).items;

  const summary = useMemo(() => {
    const today = todayISO();
    const dueToday = tasksInRange(tasks, 'today', today);
    const overdue = tasksInRange(tasks, 'overdue', today);
    const upcoming = tasksInRange(tasks, 'month', today).find(x => x.dueDate > today);
    return { dueToday, overdue, upcoming, today };
  }, [tasks]);

  const { dueToday, overdue, upcoming, today } = summary;
  const noCrops = crops.length === 0 && tasks.length === 0;
  const overdueText = (n: number) => (n === 1 ? t('kheti.today.overdueOne') : t('kheti.today.overdue', { n }));

  let title: string;
  let body: string;
  if (noCrops) {
    title = t('kheti.today.noCrops');
    body = t('kheti.today.noCropsBody');
  } else if (dueToday.length) {
    title = dueToday.length === 1 ? t('kheti.today.one') : t('kheti.today.count', { n: dueToday.length });
    const first = taskText(dueToday[0]).title;
    const rest = dueToday.length - 1;
    const parts = [rest > 0 ? `${first} · ${rest === 1 ? t('kheti.today.moreOne') : t('kheti.today.more', { n: rest })}` : first];
    if (overdue.length) parts.push(overdueText(overdue.length));
    body = parts.join('\n');
  } else {
    title = t('kheti.today.none');
    body = overdue.length
      ? overdueText(overdue.length)
      : upcoming
        ? t('kheti.today.next', {
            title: taskText(upcoming).title,
            when: relativeDay(upcoming.dueDate),
          })
        : t('kheti.today.allClear');
  }

  const count = dueToday.length;
  return (
    // With no crops the calendar would be empty: take a first-time farmer to "add crop" instead.
    <Card tone="brand" padding="md" onPress={() => (noCrops ? nav.push('crop-edit') : nav.push('calendar'))}>
      <div className="flex items-center gap-3">
        {count > 0 ? (
          <span
            aria-hidden
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-700 text-[1.375rem] font-bold text-white tabular-nums"
          >
            {count}
          </span>
        ) : (
          <ToneIcon icon={CalendarCheck} tone="green" size="md" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-body leading-snug font-semibold text-ink">{title}</p>
          <p className="mt-0.5 line-clamp-3 text-small whitespace-pre-line text-ink-2">{body}</p>
        </div>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-3" />
      </div>
    </Card>
  );
}

/** Horizontal strip of this season's catalog crops; tapping one opens "add crop" with it chosen. */
function SeasonCrops({ lang }: { lang: string }) {
  const t = useT();
  const nav = useNav();
  const season = currentSeason();
  const crops = useMemo(() => cropsBySeason(season), [season]);
  if (!crops.length) return null;
  const seasonName = catalogText(lang, SEASON_NAMES[season].hi, SEASON_NAMES[season].en);
  return (
    <section aria-labelledby="kheti-season" className="flex flex-col gap-3">
      <SectionHeader
        title={<span id="kheti-season">{t('kheti.season.title')}</span>}
        subtitle={t('kheti.season.subtitle', { season: seasonName })}
      />
      <ul aria-label={t('kheti.season.list')} className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {crops.map(c => {
          const name = catalogText(lang, c.nameHi, c.nameEn);
          return (
            <li key={c.key} className="shrink-0">
              <button
                type="button"
                onClick={() => nav.push('crop-edit', { cropKey: c.key })}
                aria-label={t('kheti.season.add', { crop: name })}
                className="press flex w-21 flex-col items-center gap-1.5 rounded-tile border border-line bg-surface px-1 pt-2 pb-2.5 hover:border-line-strong"
              >
                <CropArt crop={c.key} size={56} />
                <span className="line-clamp-2 text-center text-caption leading-snug font-medium text-ink">{name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * One technique a day, rotating through those that suit the farmer's crops (all-crop ones when
 * there are none), so the card stays fresh but never random within a day.
 */
function FeaturedTechnique({ lang }: { lang: string }) {
  const t = useT();
  const nav = useNav();
  const crops = useCollection<Crop>(KEYS.crops).items;
  const firstKey = crops[0]?.cropKey;
  // The farmer's local calendar day (not UTC, which would flip the card at 05:30 IST).
  const today = todayISO();
  const tech = useMemo(() => {
    const pool = firstKey ? techniquesForCrop(firstKey) : TECHNIQUES;
    if (!pool.length) return undefined;
    const local = parseISODate(today);
    const day = Math.floor(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()) / 86_400_000);
    return pool[day % pool.length];
  }, [firstKey, today]);
  if (!tech) return null;
  return (
    <TechniqueCard
      tech={tech}
      lang={lang}
      eyebrow={t('kheti.featured.title')}
      onPress={() => nav.push('technique', { id: tech.id })}
    />
  );
}
