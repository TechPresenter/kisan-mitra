// फसल सलाह (reference 9). Params: { id, tab?: 'today' | 'week' | 'month', savedRef?, savedSource? }.
// AI advisory when available (cached per crop per day), otherwise the live rule-based advice
// from the crop calendar and weather — the screen always says which one it is showing.
// Opened from a saved item (savedRef), the saved copy is shown on top with its date.
import './strings';
import { useMemo, useState } from 'react';
import { Bookmark, BookmarkCheck, BookmarkX, CalendarDays, ClipboardList, HeartPulse, Share2, Sparkles, TriangleAlert } from 'lucide-react';
import {
  Button,
  Callout,
  Card,
  Disclaimer,
  EmptyState,
  LastUpdated,
  ListRow,
  ListenButton,
  Screen,
  SectionHeader,
  SegmentedTabs,
  Sheet,
  SkeletonList,
  ToneIcon,
  toast,
} from '../../components/ui';
import { EmptyArt } from '../../components/illustrations';
import { stageForCrop } from '../../data/crops';
import { track } from '../../lib/analytics';
import { useOnline } from '../../lib/cache';
import { usePlace } from '../../lib/app-state';
import { formatDate } from '../../lib/format';
import { useLanguage, useT } from '../../lib/i18n';
import { useNav, useRoute } from '../../lib/nav';
import { KEYS, useCollection } from '../../lib/store';
import { useCropAdvisory } from '../../services/advisory';
import { ai, toPlainText } from '../../services/ai';
import { shareText } from '../../services/native';
import { useSaved } from '../../services/saved';
import { nextTaskForCrop, taskText, useTasks } from '../../services/tasks';
import { useWeather } from '../../services/weather';
import type { Crop, CropAdvisory, CropDiagnosis } from '../../types/models';
import {
  ADVICE_TABS,
  activeCropTasks,
  adviceFallbackNote,
  adviceItems,
  advisoryRisks,
  cropLabel,
  cropWeatherRisks,
  dueLabel,
  joinSentences,
  latestDiagnosis,
  localDay,
  mentionsFertilizer,
  stageShort,
  type AdviceItem,
  type AdviceTab,
} from './helpers';
import { AdvicePreparing, CropHeaderCard, HealthSummary, MissingCrop, SourceBadge, WeatherRiskBody, useToday } from './parts';

interface AdvisoryParams {
  id?: string;
  tab?: string;
  /** refId of a saved advice item this screen was opened from. */
  savedRef?: string;
  /** Source of that saved advice, for the right disclaimer. */
  savedSource?: CropAdvisory['source'];
}

export default function CropAdvisoryScreen() {
  const t = useT();
  const { params } = useRoute<AdvisoryParams>();
  const crops = useCollection<Crop>(KEYS.crops).items;
  const crop = params.id ? crops.find(c => c.id === params.id) : undefined;
  if (!crop) return <MissingCrop title={t('crops.advice.screenTitle')} />;
  const tab = ADVICE_TABS.includes(params.tab as AdviceTab) ? (params.tab as AdviceTab) : 'today';
  return <Advisory crop={crop} initialTab={tab} savedRef={params.savedRef} savedSource={params.savedSource} />;
}

interface AdvisoryProps {
  crop: Crop;
  initialTab: AdviceTab;
  savedRef?: string;
  savedSource?: CropAdvisory['source'];
}

/** The next task to show: the calendar's first; the AI's suggestion only when the calendar has none. */
interface NextTaskView {
  title: string;
  due?: string;
  fromAi: boolean;
}

function Advisory({ crop, initialTab, savedRef, savedSource }: AdvisoryProps) {
  const t = useT();
  const nav = useNav();
  const { language } = useLanguage();
  const lang = language.code;
  const online = useOnline();
  const [tab, setTab] = useState<AdviceTab>(initialTab);
  // The row stays in the sheet while it slides closed: only `sheetOpen` changes on close.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetItem, setSheetItem] = useState<AdviceItem | null>(null);
  const openSheet = (item: AdviceItem) => {
    setSheetItem(item);
    setSheetOpen(true);
  };
  const [appPlace] = usePlace();
  const place = crop.place || appPlace;
  // Moves on at midnight, so a screen left open overnight shows the new day's advice and labels.
  const today = useToday();

  const status = useMemo(() => stageForCrop(crop, today), [crop, today]);
  const adv = useCropAdvisory(crop);
  const weather = useWeather(place);
  const { tasks } = useTasks();
  const cropTasks = useMemo(() => activeCropTasks(tasks, crop), [tasks, crop]);
  const diagnoses = useCollection<CropDiagnosis>(KEYS.diagnoses).items;
  const diagnosis = useMemo(() => latestDiagnosis(diagnoses, crop), [diagnoses, crop]);
  const saved = useSaved();

  // While the AI advice is being made, the calendar advice (adv.advisory = the fallback) is shown,
  // marked "कैलेंडर के अनुसार", and swapped for the AI advice when it arrives.
  const advisory = adv.advisory;
  const source = adv.data ? 'ai' : 'rules';
  const aiPreparing = adv.loading && !adv.data;
  const name = cropLabel(crop, lang);
  const stage = stageShort(status, lang);
  const hasDate = !!(crop.sowingDate || crop.transplantDate);

  const items = useMemo(() => adviceItems(advisory, tab, cropTasks, t, today), [advisory, tab, cropTasks, t, today]);
  // AI risks were written when the advice was made; live weather adds urgent alerts and stage rules.
  const aiRisks = useMemo(() => (source === 'ai' ? advisoryRisks(advisory, t) : []), [source, advisory, t]);
  const weatherRisks = useMemo(
    () => cropWeatherRisks(crop, status, weather.data, t, { alerts: source === 'ai' ? 'urgent' : true, today }),
    [source, crop, status, weather.data, t, today],
  );

  // Same "next task" as on crop details: the calendar's. The AI's suggestion only fills a gap,
  // and a date it gives that has already passed is dropped.
  const calendarNext = useMemo(() => nextTaskForCrop(crop.id, cropTasks), [crop.id, cropTasks, today]);
  const nextTask = useMemo<NextTaskView | undefined>(() => {
    if (calendarNext) return { title: taskText(calendarNext).title, due: calendarNext.dueDate, fromAi: false };
    const aiNext = source === 'ai' ? advisory?.nextTask : undefined;
    const title = aiNext ? toPlainText(aiNext.title) : '';
    if (!aiNext || !title) return undefined;
    return { title, due: aiNext.due && aiNext.due >= today ? aiNext.due : undefined, fromAi: true };
  }, [calendarNext, source, advisory, today]);

  const period = t(`crops.advice.tab.${tab}`);
  const heading = t(`crops.advice.heading.${tab}`);
  const fertilizer = items.some(i => mentionsFertilizer(`${i.title} ${i.desc}`)) || (!!nextTask && mentionsFertilizer(nextTask.title));

  // Why the calendar version is showing (only once AI has had its chance).
  const fallbackNote = source === 'ai' || aiPreparing ? null : adviceFallbackNote(adv.error, ai.available(), online, t);

  // ---- Listen / save / share ----
  const listenText = joinSentences([heading, ...items.map(i => `${i.title}: ${i.desc}`)], t);
  const refId = `crop-advice:${crop.id}:${today}:${tab}`;
  const isSaved = saved.isSaved('advice', refId);
  const bodyLines = items.map(i => `• ${i.title}: ${i.desc}`);

  const toggleSave = () => {
    if (!items.length) return;
    const now = saved.toggle({
      type: 'advice',
      refId,
      title: t('crops.advice.saveTitle', { crop: name, period, date: formatDate(today) }),
      snippet: bodyLines.join('\n').slice(0, 400),
      // Opens this screen with the saved copy on top, so it can still be read (and removed) later.
      target: { screen: 'crop-advisory', params: { id: crop.id, tab, savedRef: refId, savedSource: source } },
    });
    toast(now ? t('common.saved') : t('crops.advice.unsaved'), { id: 'advice-save' });
  };

  // The saved copy this screen was opened from (not shown when it is today's own bookmark).
  const savedItem = savedRef && savedRef !== refId ? saved.items.find(i => i.type === 'advice' && i.refId === savedRef) : undefined;
  const removeSaved = () => {
    if (!savedItem) return;
    saved.remove(savedItem.id);
    toast(t('crops.advice.unsaved'), { id: 'advice-save' });
  };

  const share = async () => {
    const title = t('crops.advice.shareTitle', { crop: name, period });
    const lines = [
      `${title} (${formatDate(today)})`,
      ...bodyLines,
      nextTask ? `${t('crops.advice.nextTask')}: ${nextTask.title}` : null,
      '',
      t(source === 'ai' ? 'common.disclaimer.ai' : 'crops.advice.rulesBasis'),
      fertilizer ? t('common.disclaimer.fertilizer') : null,
      t('crops.advice.shareFooter'),
    ].filter((l): l is string => l != null);
    const result = await shareText(title, lines.join('\n'));
    if (result === 'copied') toast(t('common.copied'));
    if (result !== 'failed') track('share', { type: 'advice', source });
  };

  const refresh = () => {
    void adv.refresh();
    void weather.refresh();
  };

  const askAi = (prompt: string) => nav.switchTab('ai', { screen: 'ai', params: { cropId: crop.id, prompt } });
  const openCalendar = () => nav.push('calendar', { cropId: crop.id });

  return (
    <Screen
      title={t('crops.advice.screenTitle')}
      subtitle={name}
      actions={[
        { key: 'save', icon: isSaved ? BookmarkCheck : Bookmark, label: isSaved ? t('common.unsave') : t('crops.advice.save'), onPress: toggleSave, disabled: !items.length },
        { key: 'share', icon: Share2, label: t('common.share'), onPress: () => void share(), disabled: !items.length },
      ]}
      onRefresh={refresh}
      refreshing={adv.refreshing || weather.refreshing}
    >
      <CropHeaderCard crop={crop} status={status} lang={lang} artSize={56}>
        <div className="mt-1.5">
          <SourceBadge source={source} />
        </div>
      </CropHeaderCard>

      {savedItem ? (
        <Card as="section" className="flex flex-col gap-3">
          <SectionHeader title={t('crops.advice.savedTitle')} icon={BookmarkCheck} as="h2" />
          <p className="text-body leading-snug font-semibold text-ink">{savedItem.title}</p>
          <p className="text-small whitespace-pre-line text-ink-2">{savedItem.snippet}</p>
          <p className="text-caption text-ink-2">{t('crops.advice.savedNote', { date: formatDate(localDay(savedItem.savedAt), { year: true }) })}</p>
          {savedSource === 'ai' ? <Disclaimer kind="ai" /> : null}
          {mentionsFertilizer(savedItem.snippet) ? <Disclaimer kind="fertilizer" /> : null}
          <Button variant="secondary" fullWidth icon={BookmarkX} onClick={removeSaved}>
            {t('crops.advice.savedRemove')}
          </Button>
        </Card>
      ) : null}

      {fallbackNote ? (
        <Callout
          tone="info"
          role="status"
          action={
            adv.error && ai.available() ? (
              <Button variant="secondary" loading={adv.refreshing || adv.loading} onClick={() => void adv.refresh()}>
                {t('common.retry')}
              </Button>
            ) : undefined
          }
        >
          {fallbackNote}
        </Callout>
      ) : null}

      <div className="flex flex-col gap-4">
        <SegmentedTabs
          ariaLabel={t('crops.advice.tabs')}
          idPrefix="crop-adv"
          value={tab}
          onChange={v => setTab(v)}
          options={ADVICE_TABS.map(v => ({ value: v, label: t(`crops.advice.tab.${v}`) }))}
        />

        <section role="tabpanel" id={`crop-adv-panel-${tab}`} aria-labelledby={`crop-adv-tab-${tab}`} className="flex flex-col gap-3">
          <SectionHeader title={heading} as="h2" action={items.length ? <ListenButton id={`crop-adv-${crop.id}-${tab}`} text={listenText} /> : undefined} />
          {aiPreparing ? <AdvicePreparing /> : null}
          {items.length ? (
            <ul className="flex flex-col gap-3">
              {items.map(item => (
                <li key={item.key}>
                  <ListRow
                    leading={<ToneIcon icon={item.topic.icon} tone={item.topic.tone} />}
                    title={item.title}
                    subtitle={item.desc}
                    subtitleLines={2}
                    meta={item.task ? dueLabel(item.task.dueDate, t, today) : undefined}
                    ariaLabel={t('crops.advice.openLine', { title: item.title })}
                    onPress={() => openSheet(item)}
                  />
                </li>
              ))}
            </ul>
          ) : aiPreparing ? (
            <SkeletonList rows={3} media="circle" />
          ) : (
            <Card padding="none">
              <EmptyState
                compact
                art={<EmptyArt kind="calendar" size={128} />}
                title={t(`crops.advice.empty.${tab}`)}
                body={hasDate ? undefined : t('crops.advice.emptyNoDate')}
                action={hasDate ? undefined : { label: t('crops.detail.addDate'), icon: CalendarDays, onPress: () => nav.push('crop-edit', { id: crop.id }) }}
              />
            </Card>
          )}
          {source === 'ai' ? (
            <LastUpdated at={adv.fetchedAt} stale={adv.stale} refreshing={adv.refreshing} />
          ) : (
            <div className="flex flex-col gap-1">
              <p className="text-caption text-ink-2">{t('crops.advice.rulesBasis')}</p>
              <LastUpdated at={weather.fetchedAt} stale={weather.stale} refreshing={weather.refreshing} />
            </div>
          )}
        </section>
      </div>

      {/* Next important task */}
      <Callout
        tone="brand"
        icon={ClipboardList}
        title={t('crops.advice.nextTask')}
        action={
          <Button variant="secondary" icon={CalendarDays} onClick={openCalendar}>
            {t('crops.advice.openCalendar')}
          </Button>
        }
      >
        {nextTask ? (
          <>
            {nextTask.fromAi ? (
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <SourceBadge source="ai" />
                <span>{t('crops.advice.nextTaskAi')}</span>
              </div>
            ) : null}
            <p className="text-body font-semibold text-ink">{nextTask.title}</p>
            {nextTask.due ? <p>{`${formatDate(nextTask.due)} • ${dueLabel(nextTask.due, t, today)}`}</p> : null}
          </>
        ) : (
          <p>{t('crops.advice.noNextTask')}</p>
        )}
      </Callout>

      {/* Risks: the AI's own list first, then live weather. Unknown weather is never "no risk". */}
      <Card as="section" className="flex flex-col gap-3">
        <SectionHeader title={t('crops.advice.risks')} icon={TriangleAlert} as="h2" />
        <WeatherRiskBody weather={weather} risks={weatherRisks} otherRisks={aiRisks} noneText={t('crops.risk.noneAdvisory')} today={today} />
      </Card>

      {/* Health */}
      <Card as="section" className="flex flex-col gap-3">
        <SectionHeader title={t('crops.health.title')} icon={HeartPulse} as="h2" />
        <HealthSummary crop={crop} diagnosis={diagnosis} aiHealth={adv.data?.health} lang={lang} />
      </Card>

      {source === 'ai' ? <Disclaimer kind="ai" /> : null}
      {fertilizer ? <Disclaimer kind="fertilizer" /> : null}

      <Button variant="tech" size="lg" fullWidth icon={Sparkles} onClick={() => askAi(t('crops.advice.askCrop', { crop: name, stage }))}>
        {t('crops.advice.askMore')}
      </Button>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={sheetItem?.title}
        footer={
          sheetItem ? (
            <div className="flex flex-col gap-2">
              <Button
                variant="tech"
                fullWidth
                icon={Sparkles}
                onClick={() => {
                  const line = sheetItem.task ? `${sheetItem.title} — ${sheetItem.desc}` : sheetItem.desc;
                  setSheetOpen(false);
                  askAi(t('crops.advice.askPrompt', { crop: name, stage, line }));
                }}
              >
                {t('crops.advice.askAi')}
              </Button>
              {sheetItem.task ? (
                <Button
                  variant="secondary"
                  fullWidth
                  icon={CalendarDays}
                  onClick={() => {
                    setSheetOpen(false);
                    openCalendar();
                  }}
                >
                  {t('crops.advice.openCalendar')}
                </Button>
              ) : null}
            </div>
          ) : undefined
        }
      >
        {sheetItem ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <ToneIcon icon={sheetItem.topic.icon} tone={sheetItem.topic.tone} />
              <div className="min-w-0 flex-1">
                <p className="text-body leading-relaxed text-ink">{sheetItem.desc}</p>
                {sheetItem.task ? <p className="mt-1 text-small font-semibold text-ink-2">{dueLabel(sheetItem.task.dueDate, t, today)}</p> : null}
              </div>
            </div>
            <ListenButton id={`crop-adv-line-${sheetItem.key}`} text={joinSentences([sheetItem.title, sheetItem.desc], t)} className="self-start" />
            {source === 'ai' ? <Disclaimer kind="ai" /> : null}
            {mentionsFertilizer(`${sheetItem.title} ${sheetItem.desc}`) ? <Disclaimer kind="fertilizer" /> : null}
          </div>
        ) : null}
      </Sheet>
    </Screen>
  );
}
