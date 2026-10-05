// Home: "आज किसान के लिए" — what to do today. Live rule-based lines (weather alerts, spray window,
// overdue tasks) plus cached AI lines from services/advisory, with at-a-glance lines for the
// farmer's own crop: a recent photo diagnosis that found a problem (or a nudge to check one),
// and today's indicative price.
import './strings';
import { memo, useMemo, useState, type ReactNode } from 'react';
import {
  Bug,
  Camera,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  IndianRupee,
  Info,
  Plus,
  Sparkles,
  Sprout,
  TriangleAlert,
} from 'lucide-react';
import {
  Button,
  Callout,
  Card,
  Disclaimer,
  ErrorState,
  LastUpdated,
  ListenButton,
  Skeleton,
  SkeletonText,
  ToneIcon,
  TrendBadge,
  type IconLike,
  type Tone,
} from '../../components/ui';
import { cropName } from '../../data/crop-keys';
import type { Resource } from '../../lib/cache';
import { formatDate, formatINR, formatNumber, formatUpdated, relativeDay, toISODate } from '../../lib/format';
import { useLanguage, useT } from '../../lib/i18n';
import { KEYS, useCollection } from '../../lib/store';
import { rulesDailyRecommendations, useDailyRecommendations } from '../../services/advisory';
import type { MandiSnapshotExt } from '../../services/mandi';
import { taskText } from '../../services/tasks';
import type { Crop, CropDiagnosis, DailyRecommendation, FarmingTask, NavTarget, WeatherSnapshot } from '../../types/models';
import { displayCropName, type HomeNav } from './util';
import { soonAlerts } from './WeatherSection';

/** Lines shown before "और देखें". */
const COLLAPSED_LINES = 5;
/** A photo diagnosis stays on Home for a week. */
const DIAGNOSIS_DAYS = 7;

type Kind = DailyRecommendation['kind'];

const KIND_STYLE: Record<Kind, { icon: IconLike; tone: Tone }> = {
  do: { icon: CircleCheck, tone: 'green' },
  warn: { icon: TriangleAlert, tone: 'amber' },
  info: { icon: Info, tone: 'sky' },
};

interface Line {
  key: string;
  kind: Kind;
  /** What the row shows. */
  content: ReactNode;
  /** What "सुनें" reads: no on-screen hints ("इलाज देखें"), prices in words. Empty = not read. */
  speech: string;
  meta?: string;
  icon: IconLike;
  tone: Tone;
  target?: NavTarget;
  /** Accessible name when the row opens something. */
  ariaLabel?: string;
  /** Price change (only when the source gave a previous price). */
  trend?: { value: number; direction: 'up' | 'down' | 'stable' };
  /** Came from AI (needs the AI disclaimer). */
  ai: boolean;
  /** An AI line of the daily advice (not the photo diagnosis). */
  aiAdvice?: boolean;
}

export interface TodaySectionProps {
  /** Home's weather resource (the one its weather card shows). */
  weather: Resource<WeatherSnapshot>;
  tasks: FarmingTask[];
  crops: Crop[];
  mandi?: MandiSnapshotExt;
  /** The farmer's own crop keys (profile + crop records), in order of preference. */
  farmerKeys: string[];
  /** Tasks listed under "आने वाले काम" (with their tick box): not repeated here. */
  upcoming: FarmingTask[];
  /** Home's shared refresh (weather, mandi and this card together). */
  onRetry: () => void;
  retrying?: boolean;
  go: HomeNav;
}

function errorKey(err: unknown): string {
  const key = (err as { messageKey?: unknown } | null)?.messageKey;
  return typeof key === 'string' ? key : 'common.error.generic';
}

/**
 * Home remounts this card (React key) after each refresh: useDailyRecommendations holds its own
 * copy of the weather resource, which does not follow writes made through Home's copy.
 */
export const TodaySection = memo(function TodaySection({
  weather,
  tasks,
  crops,
  mandi,
  farmerKeys,
  upcoming,
  onRetry,
  retrying = false,
  go,
}: TodaySectionProps) {
  const t = useT();
  const { language } = useLanguage();
  const lang = language.code;
  const daily = useDailyRecommendations();
  const [expanded, setExpanded] = useState(false);
  const diagnoses = useCollection<CropDiagnosis>(KEYS.diagnoses).items;

  const cropById = useMemo(() => new Map(crops.map(c => [c.id, c])), [crops]);

  const recentDiagnosis = useMemo(() => {
    const since = Date.now() - DIAGNOSIS_DAYS * 86_400_000;
    return diagnoses
      .filter(d => !d.healthy && !d.unusableReason && d.issue && new Date(d.createdAt).getTime() >= since)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  }, [diagnoses]);

  const myPrice = useMemo(() => {
    if (!mandi) return undefined;
    const mine = new Set(farmerKeys);
    return mandi.prices.find(p => mine.has(p.commodityKey));
  }, [mandi, farmerKeys]);

  // Rule-based texts, to tell which of the hook's lines came from AI (those need the disclaimer).
  const ruleTexts = useMemo(() => new Set(rulesDailyRecommendations(weather.data, tasks).map(r => r.text)), [weather.data, tasks]);

  // Same text the advisory rules give a task line ("{title}" + its crop).
  const listedTasks = useMemo(() => new Set(upcoming.map(task => `${task.cropId ?? ''}|${taskText(task, lang).title}`)), [upcoming, lang]);

  // The alert strip right above already shows this alert: don't repeat it in the list, but keep it
  // first in what "सुनें" reads out.
  const bannerText = useMemo(() => {
    const a = soonAlerts(weather.data)[0];
    return a ? `${a.title}: ${a.message}` : undefined;
  }, [weather.data]);

  const lines = useMemo<Line[]>(() => {
    const advice: Line[] = [];
    daily.items.forEach((item, i) => {
      if (item.text === bannerText) return;
      if (listedTasks.has(`${item.cropId ?? ''}|${item.text}`)) return;
      const crop = item.cropId ? cropById.get(item.cropId) : undefined;
      const name = crop ? displayCropName(crop, lang) : undefined;
      const ai = !ruleTexts.has(item.text);
      advice.push({
        key: `rec-${i}-${item.kind}`,
        kind: item.kind,
        content: item.text,
        speech: item.text,
        meta: name,
        ...KIND_STYLE[item.kind],
        target: crop ? { screen: 'crop-detail', params: { id: crop.id } } : undefined,
        ariaLabel: name ? `${t(`home.kind.${item.kind}`)}: ${item.text}. ${t('home.today.cropLink', { crop: name })}` : undefined,
        ai,
        aiAdvice: ai,
      });
    });

    let diagnosis: Line | undefined;
    if (recentDiagnosis) {
      const crop = displayCropName({ cropKey: recentDiagnosis.cropKey, name: recentDiagnosis.cropName }, lang);
      const issue = lang === 'en' && recentDiagnosis.issueEn ? recentDiagnosis.issueEn : recentDiagnosis.issue;
      diagnosis = {
        key: `diag-${recentDiagnosis.id}`,
        kind: 'warn',
        content: t('home.today.diagnosis', { crop, issue }),
        speech: t('home.today.diagnosisSpeech', { crop, issue }),
        meta: t('home.today.diagnosisMeta', { date: relativeDay(toISODate(new Date(recentDiagnosis.createdAt))) }),
        icon: Bug,
        tone: 'red',
        target: { screen: 'diagnosis', params: { id: recentDiagnosis.id } },
        ai: true,
      };
    }

    let price: Line | undefined;
    if (myPrice) {
      const crop = cropName(myPrice.commodityKey, lang);
      const where = [myPrice.market, myPrice.ageDays > 0 ? t('mandi.priceDate', { date: formatDate(myPrice.priceDate) }) : null]
        .filter(Boolean)
        .join(' • ');
      price = {
        key: `price-${myPrice.commodityKey}`,
        kind: 'info',
        content: (
          <>
            {t('home.today.priceLead', { crop })}{' '}
            {/* Kept on one line: "₹2,480/क्विंटल" must never break after the slash. */}
            <span className="font-semibold whitespace-nowrap">
              {formatINR(myPrice.price)}
              {t('common.perQuintal')}
            </span>
          </>
        ),
        speech: t('home.today.priceSpeech', { crop, price: formatNumber(myPrice.price) }),
        meta: where || undefined,
        icon: IndianRupee,
        tone: 'green',
        target: { screen: 'mandi-detail', params: { commodityKey: myPrice.commodityKey } },
        trend: myPrice.changePct !== undefined ? { value: myPrice.changePct, direction: myPrice.trend } : undefined,
        ai: false,
      };
    }

    // Order: a found crop problem, the most urgent advice, the farmer's price, then a way to check
    // for disease when there is no recent photo check, then the rest of the advice.
    const out: Line[] = [];
    if (diagnosis) out.push(diagnosis);
    if (advice[0]) out.push(advice[0]);
    if (price) out.push(price);
    if (!diagnosis && daily.hasCrops) {
      out.push({
        key: 'check-disease',
        kind: 'info',
        content: t('home.today.checkDisease'),
        speech: '',
        icon: Camera,
        tone: 'sky',
        target: { screen: 'crop-doctor' },
        ai: false,
      });
    }
    out.push(...advice.slice(1));
    return out;
  }, [recentDiagnosis, myPrice, daily.items, daily.hasCrops, cropById, ruleTexts, listedTasks, bannerText, lang, t]);

  const visible = expanded ? lines : lines.slice(0, COLLAPSED_LINES);
  const hidden = lines.length - visible.length;
  const hasAi = lines.some(l => l.ai);
  const hasAiAdvice = lines.some(l => l.aiAdvice);
  const hasPrice = !!myPrice;
  const listenText = [bannerText, ...lines.map(l => l.speech)].filter(Boolean).join(lang === 'en' ? '. ' : '। ');
  const showAiLoading = daily.hasCrops && daily.aiLoading;
  // When AI lines are shown, the hook's fetchedAt is the AI copy's (its data is what we show).
  const aiAt = hasAiAdvice ? daily.fetchedAt : undefined;

  return (
    <Card as="section" padding="none" aria-labelledby="home-today-title">
      <div className="flex items-start gap-3 px-4 pt-4">
        <div className="min-w-0 flex-1">
          <h2 id="home-today-title" className="text-card-title leading-snug font-semibold text-ink">
            {t('home.today.title')}
          </h2>
          <p className="text-small text-ink-2">{t('home.today.subtitle')}</p>
        </div>
        <ListenButton id="home-today" text={listenText} />
      </div>

      <div className="px-4 pt-1">
        {lines.length > 0 ? (
          <ul className="flex flex-col">
            {visible.map(line => (
              <TodayLine key={line.key} line={line} onOpen={target => go.push(target.screen, target.params)} />
            ))}
          </ul>
        ) : daily.weatherLoading ? (
          <div role="status" aria-busy="true" className="py-3">
            <span className="sr-only">{t('common.loading')}</span>
            <SkeletonText lines={3} />
          </div>
        ) : daily.aiError && !showAiLoading ? (
          <ErrorState compact error={daily.aiError} onRetry={onRetry} retrying={retrying} className="my-3" />
        ) : !showAiLoading ? (
          <p className="py-3 text-small text-ink-2">{t('home.today.empty')}</p>
        ) : null}

        {showAiLoading && (
          <div role="status" className={lines.length ? 'flex items-start gap-3 border-t border-line py-3' : 'flex items-start gap-3 py-3'}>
            <ToneIcon icon={Sparkles} tone="tech" size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-small text-ink-2">{t('home.today.aiLoading')}</p>
              <Skeleton rounded="sm" className="mt-2 h-3.5 w-11/12" />
              <Skeleton rounded="sm" className="mt-2 h-3.5 w-2/3" />
            </div>
          </div>
        )}

        {/* Only when no AI line is on screen: cached AI lines can come back together with an error. */}
        {daily.aiError && !showAiLoading && lines.length > 0 && daily.hasCrops && !hasAiAdvice && (
          <div className="flex items-center gap-2 border-t border-line py-2">
            <p className="min-w-0 flex-1 text-caption text-ink-2">{t('home.today.aiError', { reason: t(errorKey(daily.aiError)) })}</p>
            <Button variant="ghost" loading={retrying} onClick={onRetry}>
              {t('common.retry')}
            </Button>
          </div>
        )}

        {lines.length > COLLAPSED_LINES && (
          <div className="border-t border-line py-1">
            <Button
              variant="ghost"
              fullWidth
              iconRight={expanded ? ChevronUp : ChevronDown}
              onClick={() => setExpanded(e => !e)}
              aria-expanded={expanded}
            >
              {expanded ? t('home.today.less') : t('home.today.more', { n: hidden })}
            </Button>
          </div>
        )}
      </div>

      {!daily.hasCrops && (
        <div className="px-4 pt-2">
          <Callout
            tone="brand"
            icon={Sprout}
            action={
              <Button icon={Plus} onClick={() => go.push('crop-edit')}>
                {t('home.today.addCropBtn')}
              </Button>
            }
          >
            {t('home.today.addCrop')}
          </Callout>
        </div>
      )}

      <div className="flex flex-col gap-2 px-4 pt-3 pb-3">
        {hasAi ? (
          <Disclaimer kind="ai">{hasPrice ? `${t('common.disclaimer.ai')} ${t('common.disclaimer.price')}` : undefined}</Disclaimer>
        ) : hasPrice ? (
          <Disclaimer kind="price" />
        ) : null}
        <div>
          <LastUpdated at={weather.fetchedAt} stale={weather.stale} refreshing={weather.refreshing || retrying} />
          {aiAt != null && <p className="text-caption text-ink-2">{t('home.today.aiUpdated', { time: formatUpdated(aiAt) })}</p>}
        </div>
      </div>
    </Card>
  );
});

function TodayLine({ line, onOpen }: { line: Line; onOpen: (target: NavTarget) => void }) {
  const t = useT();
  const body = (
    <>
      <ToneIcon icon={line.icon} tone={line.tone} size="sm" />
      <span className="min-w-0 flex-1 pt-1.5">
        <span className="sr-only">{t(`home.kind.${line.kind}`)}: </span>
        <span className="block text-body leading-snug text-ink">{line.content}</span>
        {(line.meta || line.trend) && (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-caption leading-snug text-ink-2">
            {line.trend && <TrendBadge value={line.trend.value} direction={line.trend.direction} size="sm" />}
            {line.meta && <span>{line.meta}</span>}
          </span>
        )}
      </span>
      {line.target && <ChevronRight aria-hidden className="mt-2 size-5 shrink-0 text-ink-3" />}
    </>
  );
  const target = line.target;
  return (
    <li className="border-t border-line first:border-t-0">
      {target ? (
        <button
          type="button"
          onClick={() => onOpen(target)}
          aria-label={line.ariaLabel}
          className="press flex min-h-12 w-full items-start gap-3 py-2.5 text-left"
        >
          {body}
        </button>
      ) : (
        <div className="flex items-start gap-3 py-2.5">{body}</div>
      )}
    </li>
  );
}
