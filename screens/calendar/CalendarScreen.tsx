// Screen 21 — खेती कैलेंडर (reference screen 12). Route 'calendar' { cropId?, taskId? }.
// Auto tasks come from each crop's sowing date (services/tasks), plus the farmer's own tasks.
// Everything is on-device, so the calendar works fully offline. `taskId` (from a reminder
// notification) opens the view that lists that task, with its details on top.
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import {
  Bell,
  CalendarPlus,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  History,
  Plus,
  Sprout,
  Trash2,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  ChipGroup,
  Disclaimer,
  EmptyState,
  ErrorState,
  ListGroup,
  ListRow,
  SectionHeader,
  SegmentedTabs,
  Screen,
  ToneIcon,
  confirm,
  cx,
  toast,
  type ChipOption,
  type Tone,
} from '../../components/ui';
import { CropArt, EmptyArt } from '../../components/illustrations';
import { day0For } from '../../data/crops';
import { addDays, formatDate, relativeDay } from '../../lib/format';
import { useLanguage, useT } from '../../lib/i18n';
import { useNav, useRoute } from '../../lib/nav';
import { KEYS, collection, useCollection } from '../../lib/store';
import { useNotifications } from '../../services/notifications';
import { dueBeforeCropAdded, reconcileAutoTasks, taskText, useTasks } from '../../services/tasks';
import type { Crop, FarmingTask, ISODate } from '../../types/models';
import {
  cropLabel,
  dayHeading,
  daysLate,
  doneDate,
  groupByDate,
  monthEnd,
  monthLabel,
  monthOf,
  monthRange,
  monthStart,
  useToday,
  type YearMonth,
} from './helpers';
import { ReminderSheet } from './ReminderSheet';
import { TaskDetailSheet } from './TaskDetailSheet';
import { TaskFormSheet } from './TaskFormSheet';
import { TaskRow } from './TaskRow';
import { taskGuidance } from './task-types';
import './strings';

type Period = 'today' | 'tomorrow' | 'week' | 'month';
const ALL = 'all';
/** Overdue rows shown before "सभी N बाकी काम देखें". */
const OVERDUE_PREVIEW = 3;
/** How far back "बाकी काम" looks (older open tasks are only listed in their month). */
const OVERDUE_DAYS = 30;

const byDue = (a: FarmingTask, b: FarmingTask) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id);
const byDoneDesc = (a: FarmingTask, b: FarmingTask) => (b.doneAt ?? b.dueDate).localeCompare(a.doneAt ?? a.dueDate);

export default function CalendarScreen() {
  const t = useT();
  const nav = useNav();
  const uid = useId();
  const { params } = useRoute<{ cropId?: string; taskId?: string }>();
  const { language } = useLanguage();
  const lang = language.code;
  const today = useToday();
  const crops = useCollection<Crop>(KEYS.crops).items;
  const { tasks, setDone, remove } = useTasks();
  const { unread } = useNotifications();

  const currentMonth = monthOf(today);
  const [cropFilter, setCropFilter] = useState<string>(params.cropId || ALL);
  const [period, setPeriod] = useState<Period>('today');
  const [month, setMonth] = useState<YearMonth>(currentMonth);
  const [showAllOverdue, setShowAllOverdue] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [reminderId, setReminderId] = useState<string | null>(null);
  const [form, setForm] = useState<{ editId?: string } | null>(null);
  const [syncError, setSyncError] = useState<unknown>(null);
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  // Backstop: crops whose auto tasks are missing or out of date get them (re)built, and tasks of
  // deleted crops are dropped. Runs before paint, and re-renders at once when it wrote (the store
  // subscription only starts after paint), so the first frame never says "no tasks today" while
  // the tasks are still being created.
  const syncTasks = useCallback(() => {
    try {
      if (reconcileAutoTasks(crops)) rerender();
      setSyncError(null);
    } catch (e) {
      setSyncError(e);
    }
  }, [crops]);
  useLayoutEffect(syncTasks, [syncTasks]);

  // The app left open over midnight into a new month: "इस महीने" follows, unless the farmer
  // had picked another month.
  const prevMonth = useRef(currentMonth);
  useEffect(() => {
    const was = prevMonth.current;
    if (was === currentMonth) return;
    prevMonth.current = currentMonth;
    setMonth(m => (m === was ? currentMonth : m));
  }, [currentMonth]);

  const cropsById = useMemo(() => new Map(crops.map(c => [c.id, c])), [crops]);
  const activeCrop = cropFilter !== ALL ? cropsById.get(cropFilter) : undefined;
  const filter = activeCrop ? activeCrop.id : ALL;

  /** Tasks in scope: the crop filter, minus auto tasks of crops that no longer exist. */
  const visible = useMemo(
    () =>
      tasks.filter(task => {
        if (task.source === 'auto' && !(task.cropId && cropsById.has(task.cropId))) return false;
        return filter === ALL || task.cropId === filter;
      }),
    [tasks, cropsById, filter],
  );

  const missingDate = useMemo(() => crops.filter(c => !day0For(c)), [crops]);
  const filteredCropMissingDate = !!activeCrop && missingDate.some(c => c.id === activeCrop.id);

  const browsingOtherMonth = period === 'month' && month !== currentMonth;

  /** [from, to] of the selected period; done tasks count from `doneFrom` (start of the month). */
  const range = useMemo(() => {
    switch (period) {
      case 'today':
        return { from: today, to: today, doneFrom: today };
      case 'tomorrow': {
        const d = addDays(today, 1);
        return { from: d, to: d, doneFrom: d };
      }
      case 'week':
        return { from: today, to: addDays(today, 6), doneFrom: today };
      case 'month':
        return month === currentMonth
          ? { from: today, to: monthEnd(month), doneFrom: monthStart(month) }
          : { from: monthStart(month), to: monthEnd(month), doneFrom: monthStart(month) };
    }
  }, [period, today, month, currentMonth]);

  /** Auto tasks that were already past when the farmer added the crop: history, not missed work. */
  const isHistory = useCallback(
    (task: FarmingTask) => dueBeforeCropAdded(task, task.cropId ? cropsById.get(task.cropId) : undefined),
    [cropsById],
  );
  /** Days late, except for history tasks. */
  const lateFor = useCallback((task: FarmingTask) => (isHistory(task) ? 0 : daysLate(task, today)), [isHistory, today]);

  const lists = useMemo(() => {
    const overdueFrom = addDays(today, -OVERDUE_DAYS);
    const overdue: FarmingTask[] = [];
    const open: FarmingTask[] = [];
    const done: FarmingTask[] = [];
    const history: FarmingTask[] = [];
    const inDoneWindow = (d: ISODate) => d >= range.doneFrom && d <= range.to;
    for (const task of visible) {
      if (task.done) {
        if (inDoneWindow(task.dueDate) || inDoneWindow(doneDate(task))) done.push(task);
      } else if (isHistory(task)) {
        if (inDoneWindow(task.dueDate)) history.push(task);
      } else if (task.dueDate >= range.from && task.dueDate <= range.to) {
        open.push(task);
      } else if (task.dueDate < today && task.dueDate >= overdueFrom) {
        overdue.push(task);
      }
    }
    open.sort(byDue);
    overdue.sort(byDue);
    done.sort(byDoneDesc);
    history.sort(byDue);
    const next = open.length ? undefined : visible.filter(x => !x.done && x.dueDate > range.to).sort(byDue)[0];
    return { overdue, open, done, history, groups: groupByDate(open), next };
  }, [visible, range, today, isHistory]);

  const months = useMemo(() => monthRange(visible, today, month), [visible, today, month]);
  const monthOptions = useMemo<ChipOption[]>(() => {
    const openByMonth = new Map<string, number>();
    for (const task of visible) {
      if (task.done || task.dueDate < today) continue;
      const m = monthOf(task.dueDate);
      openByMonth.set(m, (openByMonth.get(m) ?? 0) + 1);
    }
    return months.map(m => ({ value: m, label: monthLabel(m, lang, today), count: openByMonth.get(m) || undefined }));
  }, [months, visible, today, lang]);

  const cropOptions = useMemo<ChipOption[]>(
    () => [
      { value: ALL, label: t('calendar.all') },
      ...crops.map(c => ({ value: c.id, label: cropLabel(c, lang), icon: <CropArt crop={c.cropKey} size={24} background={false} /> })),
    ],
    [crops, lang, t],
  );

  const periodOptions = useMemo(
    () => [
      { value: 'today' as Period, label: t('calendar.tab.today') },
      { value: 'tomorrow' as Period, label: t('calendar.tab.tomorrow') },
      { value: 'week' as Period, label: t('calendar.tab.week') },
      { value: 'month' as Period, label: t('calendar.tab.month') },
    ],
    [t],
  );

  const showOverdue = !browsingOtherMonth && lists.overdue.length > 0;
  const overdueRows = useMemo(
    () => (showAllOverdue ? lists.overdue : lists.overdue.slice(0, OVERDUE_PREVIEW)),
    [lists.overdue, showAllOverdue],
  );

  /** Safety notes for the descriptions on screen (basal/top-dress doses, seed chemicals, sprays). */
  const guidance = useMemo(() => {
    const shown = [
      ...lists.open,
      ...(showOverdue ? overdueRows : []),
      ...(showDone ? lists.done : []),
      ...(showHistory ? lists.history : []),
    ];
    let fertilizer = false;
    let chemical = false;
    for (const task of shown) {
      const g = taskGuidance(task);
      fertilizer ||= g.fertilizer;
      chemical ||= g.chemical;
      if (fertilizer && chemical) break;
    }
    return { fertilizer, chemical };
  }, [lists, showOverdue, overdueRows, showDone, showHistory]);

  // ---------- actions (stable, so memoised rows don't re-render) ----------

  const toggle = useCallback(
    (id: string, done: boolean) => {
      const current = collection<FarmingTask>(KEYS.tasks).get(id);
      // Already in that state (a second tap while a sheet closes): no second toast.
      if (!current || current.done === done) return;
      setDone(id, done);
      if (done) {
        toast.success(t('calendar.toast.done'), {
          id: `cal-done-${id}`,
          action: { label: t('calendar.undo'), onPress: () => setDone(id, false) },
        });
      } else {
        toast(t('calendar.toast.reopened'), { id: `cal-done-${id}` });
      }
    },
    [setDone, t],
  );

  const openDetail = useCallback((id: string) => setDetailId(id), []);
  const openReminder = useCallback((id: string) => {
    setDetailId(null);
    setReminderId(id);
  }, []);

  const deleteTask = useCallback(
    async (task: FarmingTask) => {
      const { title } = taskText(task, lang);
      const ok = await confirm({
        title: t('calendar.delete.title'),
        message: t('calendar.delete.body', { task: title }),
        tone: 'danger',
        icon: Trash2,
        confirmLabel: t('common.delete'),
        cancelLabel: t('common.cancel'),
      });
      if (!ok) return;
      setDetailId(null);
      remove(task.id);
      toast(t('calendar.toast.deleted'));
    },
    [lang, remove, t],
  );

  const askAi = useCallback(
    (task: FarmingTask) => {
      const { title } = taskText(task, lang);
      const crop = task.cropId ? cropsById.get(task.cropId) : undefined;
      const prompt = crop
        ? t('calendar.detail.askAiPrompt', { task: title, crop: cropLabel(crop, lang) })
        : t('calendar.detail.askAiPromptNoCrop', { task: title });
      setDetailId(null);
      nav.open({ screen: 'ai', params: { prompt, ...(crop ? { cropId: crop.id } : {}) } });
    },
    [cropsById, lang, nav, t],
  );

  /** Switches to the view that lists a task: its tab or month, the overdue section, or a collapsed list. */
  const goToTask = useCallback(
    (task: FarmingTask) => {
      if (filter !== ALL && task.cropId !== filter) setCropFilter(ALL);
      const due = task.dueDate;
      const history = !task.done && isHistory(task);
      if (!task.done && !history && due < today && due >= addDays(today, -OVERDUE_DAYS)) {
        // Listed under "बाकी काम", which every view except another month shows.
        setShowAllOverdue(true);
        if (browsingOtherMonth) setPeriod('today');
        return;
      }
      if (due === today) setPeriod('today');
      else if (due === addDays(today, 1)) setPeriod('tomorrow');
      else if (due > today && due <= addDays(today, 6)) setPeriod('week');
      else {
        setPeriod('month');
        setMonth(monthOf(due));
      }
      if (task.done) setShowDone(true);
      else if (history) setShowHistory(true);
    },
    [filter, isHistory, today, browsingOtherMonth],
  );

  const onAdded = useCallback(
    (task: FarmingTask) => {
      // A task for another day (or crop) than the one on screen: go there, so it is seen saved.
      const shown = (filter === ALL || task.cropId === filter) && task.dueDate >= range.from && task.dueDate <= range.to;
      if (!shown) goToTask(task);
      toast.success(t('calendar.toast.added', { date: relativeDay(task.dueDate) }), {
        action: { label: t('calendar.toast.addReminder'), onPress: () => setReminderId(task.id) },
      });
    },
    [filter, range, goToTask, t],
  );

  // Opened from a reminder notification: show that task.
  const deepLinked = useRef(false);
  useLayoutEffect(() => {
    if (deepLinked.current || !params.taskId) return;
    deepLinked.current = true;
    const task = collection<FarmingTask>(KEYS.tasks).get(params.taskId);
    if (!task) return;
    goToTask(task);
    setDetailId(task.id);
  }, [params.taskId, goToTask]);

  const addCrop = () => nav.push('crop-edit');
  const editCrop = (id: string) => nav.push('crop-edit', { id });
  const openAdd = () => setForm({});

  const taskById = (id: string | null) => (id ? tasks.find(x => x.id === id) ?? null : null);
  const detailTask = taskById(detailId);
  const reminderTask = taskById(reminderId);
  const editingTask = form?.editId ? taskById(form.editId) : null;

  const formDefaultDate =
    period === 'tomorrow' ? addDays(today, 1) : browsingOtherMonth && monthStart(month) > today ? monthStart(month) : today;

  const renderRow = (task: FarmingTask, lateDays = 0, muted = false) => (
    <div role="listitem" key={task.id}>
      <TaskRow
        task={task}
        crop={task.cropId ? cropsById.get(task.cropId) : undefined}
        lang={lang}
        lateDays={lateDays}
        muted={muted}
        onToggle={toggle}
        onReminder={muted ? undefined : openReminder}
        onOpen={openDetail}
      />
    </div>
  );

  const countLabel = (n: number) => (n === 1 ? t('calendar.count1') : t('calendar.count', { n }));

  // ---------- empty app: no crops and no tasks of the farmer's own ----------

  const hasAnyTask = visible.length > 0;
  const noCropsAtAll = crops.length === 0 && !tasks.some(x => x.source === 'user');
  const noDatesAtAll = crops.length > 0 && missingDate.length === crops.length && !hasAnyTask && filter === ALL;

  const sheets = (
    <>
      <TaskDetailSheet
        task={detailTask}
        crop={detailTask?.cropId ? cropsById.get(detailTask.cropId) : undefined}
        lateDays={detailTask ? lateFor(detailTask) : 0}
        lang={lang}
        today={today}
        onClose={() => setDetailId(null)}
        onToggle={toggle}
        onReminder={openReminder}
        onEdit={id => {
          setDetailId(null);
          setForm({ editId: id });
        }}
        onDelete={deleteTask}
        onAskAi={askAi}
        onViewCrop={id => {
          setDetailId(null);
          nav.push('crop-detail', { id });
        }}
      />
      <ReminderSheet task={reminderTask} lang={lang} onClose={() => setReminderId(null)} />
      <TaskFormSheet
        open={form != null}
        onClose={() => setForm(null)}
        editing={editingTask}
        crops={crops}
        lang={lang}
        defaultCropId={filter !== ALL ? filter : undefined}
        defaultDate={formDefaultDate}
        onAdded={onAdded}
      />
    </>
  );

  const screenProps = {
    title: t('calendar.title'),
    subtitle: t('calendar.subtitle'),
    actions: [{ icon: Bell, label: t('ui.notifications'), badge: unread, onPress: () => nav.push('notifications') }],
  };

  if (noCropsAtAll) {
    return (
      <Screen {...screenProps}>
        <EmptyState
          art={<EmptyArt kind="calendar" />}
          title={t('calendar.noCrops.title')}
          body={t('calendar.noCrops.body')}
          action={{ label: t('calendar.noCrops.action'), icon: Sprout, onPress: addCrop }}
          secondaryAction={{ label: t('calendar.noCrops.secondary'), icon: CalendarPlus, onPress: openAdd }}
        />
        {sheets}
      </Screen>
    );
  }

  if (noDatesAtAll) {
    return (
      <Screen {...screenProps}>
        <EmptyState art={<EmptyArt kind="calendar" />} title={t('calendar.noSowing.allTitle')} body={t('calendar.noSowing.body')} compact />
        <MissingDates crops={missingDate} lang={lang} onEdit={editCrop} heading={false} />
        <Button variant="secondary" icon={CalendarPlus} fullWidth onClick={openAdd}>
          {t('calendar.noCrops.secondary')}
        </Button>
        {sheets}
      </Screen>
    );
  }

  // ---------- main view ----------

  const monthName = monthLabel(month, lang, today);
  const sectionTitle =
    period === 'month' ? t('calendar.section.month', { month: monthName }) : t(`calendar.section.${period}`);
  const summary =
    lists.open.length || lists.done.length
      ? lists.done.length
        ? t('calendar.summary', { open: lists.open.length, done: lists.done.length })
        : t('calendar.summaryOpen', { open: lists.open.length })
      : undefined;
  const emptyLine = period === 'month' ? t('calendar.empty.month', { month: monthName }) : t(`calendar.empty.${period}`);
  const grouped = period === 'week' || period === 'month';
  // A crop without a sowing date and no tasks of its own: only the "add the date" card makes sense.
  const cropWithoutTasks = filteredCropMissingDate && visible.length === 0;

  return (
    <Screen {...screenProps}>
      {crops.length > 0 && (
        <ChipGroup ariaLabel={t('calendar.filterCrops')} value={filter} onChange={setCropFilter} options={cropOptions} />
      )}

      {!cropWithoutTasks && (
        <div className="flex flex-col gap-3">
          <SegmentedTabs ariaLabel={t('calendar.period')} idPrefix={uid} value={period} onChange={setPeriod} options={periodOptions} />
          {period === 'month' && <ChipGroup ariaLabel={t('calendar.months')} value={month} onChange={setMonth} options={monthOptions} />}
        </div>
      )}

      {syncError != null && (
        <ErrorState compact error={syncError} title={t('calendar.syncError.title')} message={t('calendar.syncError.body')} onRetry={syncTasks} />
      )}

      {filteredCropMissingDate && activeCrop && (
        <Callout
          tone="info"
          icon={CalendarPlus}
          title={t('calendar.noSowing.title', { crop: cropLabel(activeCrop, lang) })}
          action={
            <Button variant="secondary" onClick={() => editCrop(activeCrop.id)}>
              {t('calendar.noSowing.action')}
            </Button>
          }
        >
          {t('calendar.noSowing.body')}
        </Callout>
      )}

      {showOverdue && (
        <section aria-labelledby={`${uid}-overdue-title`} className="rounded-card bg-tint-amber p-3 hc:border hc:border-line">
          <div className="flex items-center gap-2 px-1 pt-1">
            <TriangleAlert aria-hidden className="size-5 shrink-0 text-tone-amber" />
            <h2 id={`${uid}-overdue-title`} className="flex-1 text-card-title font-bold text-ink">
              {t('calendar.overdue.title')}
            </h2>
            <Badge tone="amber" variant="solid">
              {countLabel(lists.overdue.length)}
            </Badge>
          </div>
          <p className="px-1 pt-1 pb-3 text-small text-ink-2">{t('calendar.overdue.subtitle')}</p>
          <div role="list" className="flex flex-col gap-2">
            {overdueRows.map(task => renderRow(task, lateFor(task)))}
          </div>
          {lists.overdue.length > OVERDUE_PREVIEW && (
            <Button
              variant="ghost"
              fullWidth
              className="mt-2"
              aria-expanded={showAllOverdue}
              iconRight={showAllOverdue ? ChevronUp : ChevronDown}
              onClick={() => setShowAllOverdue(v => !v)}
            >
              {showAllOverdue ? t('calendar.overdue.showLess') : t('calendar.overdue.showAll', { n: lists.overdue.length })}
            </Button>
          )}
        </section>
      )}

      {!cropWithoutTasks && (
        <div role="tabpanel" id={`${uid}-panel-${period}`} aria-labelledby={`${uid}-tab-${period}`} className="flex flex-col gap-3">
          <SectionHeader title={sectionTitle} subtitle={summary} />

          {lists.open.length === 0 ? (
            !filteredCropMissingDate && (
              <PeriodEmpty
                line={lists.done.length ? t('calendar.empty.allDone') : emptyLine}
                allDone={lists.done.length > 0}
                next={lists.next}
                lang={lang}
                onView={goToTask}
              />
            )
          ) : grouped ? (
            lists.groups.map(group => {
              const late = group.date < today && group.tasks.some(x => lateFor(x) > 0);
              return (
                <section key={group.date} aria-label={formatDate(group.date, { weekday: true })}>
                  <div className="sticky top-0 z-10 -mx-4 flex items-baseline justify-between gap-3 bg-canvas px-4 pt-2 pb-2">
                    <h3 className={cx('text-small font-semibold', late ? 'text-tone-amber' : 'text-ink')}>
                      {dayHeading(group.date, today, t('common.today'), t('common.tomorrow'))}
                    </h3>
                    <span className="shrink-0 text-caption text-ink-2">{countLabel(group.tasks.length)}</span>
                  </div>
                  <div role="list" className="flex flex-col gap-2">
                    {group.tasks.map(task => renderRow(task, lateFor(task)))}
                  </div>
                </section>
              );
            })
          ) : (
            <div role="list" className="flex flex-col gap-2">
              {lists.open.map(task => renderRow(task))}
            </div>
          )}

          {lists.history.length > 0 && (
            <CollapsibleList
              id={`${uid}-history-list`}
              icon={History}
              tone="gray"
              title={t('calendar.history.title')}
              count={countLabel(lists.history.length)}
              hint={t('calendar.history.hint')}
              open={showHistory}
              onToggle={() => setShowHistory(v => !v)}
            >
              {lists.history.map(task => renderRow(task, 0, true))}
            </CollapsibleList>
          )}

          {lists.done.length > 0 && (
            <CollapsibleList
              id={`${uid}-done-list`}
              icon={CircleCheck}
              tone="green"
              title={t('calendar.done.title')}
              count={countLabel(lists.done.length)}
              open={showDone}
              onToggle={() => setShowDone(v => !v)}
            >
              {lists.done.map(task => renderRow(task))}
            </CollapsibleList>
          )}

          {guidance.fertilizer && guidance.chemical ? (
            <Disclaimer>{`${t('common.disclaimer.fertilizer')} ${t('calendar.guidance.chemical')}`}</Disclaimer>
          ) : guidance.fertilizer ? (
            <Disclaimer kind="fertilizer" />
          ) : guidance.chemical ? (
            <Disclaimer>{t('calendar.guidance.chemical')}</Disclaimer>
          ) : null}
        </div>
      )}

      {filter === ALL && missingDate.length > 0 && <MissingDates crops={missingDate} lang={lang} onEdit={editCrop} />}

      {crops.length === 0 && (
        <Callout
          tone="brand"
          icon={Sprout}
          action={
            <Button variant="secondary" icon={Plus} onClick={addCrop}>
              {t('calendar.noCrops.action')}
            </Button>
          }
        >
          {t('calendar.noCrops.hint')}
        </Callout>
      )}

      {/* Room so the floating button never hides the last row. */}
      <div aria-hidden className="h-16" />

      <div className="nav-bottom absolute right-4 z-20">
        <Button size="lg" icon={Plus} className="shadow-float" onClick={openAdd}>
          {t('calendar.add.fab')}
        </Button>
      </div>

      {sheets}
    </Screen>
  );
}

// ---------- pieces ----------

function CollapsibleList({
  id,
  icon,
  tone,
  title,
  count,
  hint,
  open,
  onToggle,
  children,
}: {
  id: string;
  icon: LucideIcon;
  tone: Tone;
  title: string;
  count: string;
  hint?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 pt-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className="press flex min-h-14 w-full items-center gap-3 rounded-list border border-line bg-surface px-4 py-2 text-left hover:bg-surface-2/60"
      >
        <ToneIcon icon={icon} tone={tone} size="sm" />
        <span className="flex-1 pt-0.5 text-body font-semibold text-ink">{title}</span>
        <Badge tone={tone}>{count}</Badge>
        <ChevronDown aria-hidden className={cx('size-5 shrink-0 text-ink-2 transition-transform duration-150', open && 'rotate-180')} />
      </button>
      {open && (
        <div id={id} className="flex flex-col gap-2">
          {hint && <p className="px-1 text-small text-ink-2">{hint}</p>}
          <div role="list" className="flex flex-col gap-2">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

function PeriodEmpty({
  line,
  allDone,
  next,
  lang,
  onView,
}: {
  line: string;
  allDone: boolean;
  next?: FarmingTask;
  lang: string;
  onView: (task: FarmingTask) => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3 rounded-list border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <ToneIcon icon={allDone ? CircleCheck : Sprout} tone="green" size="md" />
        <p className="min-w-0 flex-1 text-body text-ink">{line}</p>
      </div>
      {next && (
        <div className="flex items-center gap-3 border-t border-line pt-3">
          <div className="min-w-0 flex-1">
            <p className="text-small font-semibold text-ink">{t('calendar.empty.next', { task: taskText(next, lang).title })}</p>
            <p className="text-caption text-ink-2">{t('calendar.empty.nextWhen', { date: formatDate(next.dueDate, { weekday: true }) })}</p>
          </div>
          <Button variant="soft" onClick={() => onView(next)}>
            {t('calendar.empty.viewNext')}
          </Button>
        </div>
      )}
    </div>
  );
}

function MissingDates({
  crops,
  lang,
  onEdit,
  heading = true,
}: {
  crops: Crop[];
  lang: string;
  onEdit: (id: string) => void;
  /** false when the surrounding empty state already explains why dates matter. */
  heading?: boolean;
}) {
  const t = useT();
  const titleId = useId();
  const single = crops.length === 1;
  const title = single ? t('calendar.noSowing.title', { crop: cropLabel(crops[0], lang) }) : t('calendar.noSowing.titleMany');
  return (
    <section aria-labelledby={heading ? titleId : undefined} aria-label={heading ? undefined : title} className="flex flex-col gap-3">
      {heading && (
        <div>
          <h2 id={titleId} className="text-card-title font-semibold text-ink">
            {title}
          </h2>
          <p className="mt-0.5 text-small text-ink-2">{t('calendar.noSowing.body')}</p>
        </div>
      )}
      <ListGroup ariaLabel={title}>
        {crops.map(crop => (
          <ListRow
            key={crop.id}
            variant="plain"
            leading={<CropArt crop={crop.cropKey} size={44} />}
            title={cropLabel(crop, lang)}
            ariaLabel={t('calendar.noSowing.rowAction', { crop: cropLabel(crop, lang) })}
            trailing={<span className="text-small font-semibold text-brand">{t('calendar.noSowing.action')}</span>}
            chevron
            onPress={() => onEdit(crop.id)}
          />
        ))}
      </ListGroup>
    </section>
  );
}
