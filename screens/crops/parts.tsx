// Shared pieces of the My Crops screens: crop header card, stage timeline, health summary,
// risk list, advice source badge, catalog accordion item and the "crop not found" screen.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CalendarDays, Check, ChevronDown, CircleCheck, CloudOff, Pencil, Sparkles, Stethoscope } from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Card,
  Disclaimer,
  EmptyState,
  ErrorState,
  LastUpdated,
  ListRow,
  ProgressBar,
  Screen,
  SkeletonList,
  Spinner,
  Thumbnail,
  ToneIcon,
  TONE_TEXT,
  cx,
  type IconLike,
  type Tone,
} from '../../components/ui';
import { CropArt, EmptyArt } from '../../components/illustrations';
import { isCropKey } from '../../data/crop-keys';
import { timelineFor, type StageStatus } from '../../data/crops';
import type { Resource } from '../../lib/cache';
import { daysBetween, formatDate, todayISO } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { useNav, useRoute } from '../../lib/nav';
import type { Crop, CropAdvisory, CropDiagnosis, ISODate, WeatherSnapshot } from '../../types/models';
import {
  DIAGNOSIS_FRESH_DAYS,
  RISK_TONE,
  STAGE_TONE,
  areaText,
  cropLabel,
  cropRoutesOnTop,
  diagnosisAgeDays,
  hasForecast,
  localDay,
  stagePhrase,
  subStageLabel,
  type CropProgress,
  type CropRisk,
} from './helpers';
import './strings';

// ---------- Today ----------

/**
 * Today's date, updated just after midnight and when the app comes back to the front, so a
 * screen left open overnight moves on to the new day (day N, %, "N दिन बाकी", due labels).
 */
export function useToday(): ISODate {
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => setToday(todayISO());
    const schedule = () => {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5).getTime();
      // Capped, because timers can drift while the phone sleeps.
      timer = setTimeout(() => {
        check();
        schedule();
      }, Math.min(midnight - now.getTime(), 60 * 60_000));
    };
    schedule();
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return today;
}

// ---------- Not found ----------

/** Shown when a crop id no longer exists (deleted, or a stale saved link). */
export function MissingCrop({ title }: { title: string }) {
  const t = useT();
  const nav = useNav();
  const { params } = useRoute<{ id?: string }>();
  const toList = () => {
    // Leave every screen of the missing crop (details, advice, edit), not just this one.
    const n = Math.max(1, cropRoutesOnTop(nav.stack, params.id));
    const below = nav.stack[nav.stack.length - 1 - n];
    if (below?.screen === 'crops') {
      for (let i = 0; i < n; i++) nav.pop();
      return;
    }
    for (let i = 0; i < n - 1; i++) nav.pop();
    nav.replace('crops');
  };
  return (
    <Screen title={title}>
      <EmptyState
        art={<EmptyArt kind="crops" />}
        title={t('crops.notFound.title')}
        body={t('crops.notFound.body')}
        action={{ label: t('crops.notFound.action'), onPress: toList }}
      />
    </Screen>
  );
}

// ---------- Header ----------

export interface CropHeaderCardProps {
  crop: Crop;
  status: StageStatus;
  lang: string;
  artSize?: number;
  /** Extra lines under "2 एकड़ • बढ़वार अवस्था". */
  children?: ReactNode;
  /** Right side (e.g. the advice source badge). */
  aside?: ReactNode;
}

/** Crop art, name (+ variety) and "2 एकड़ • बढ़वार अवस्था" in the stage colour. */
export function CropHeaderCard({ crop, status, lang, artSize = 64, children, aside }: CropHeaderCardProps) {
  const t = useT();
  return (
    <Card className="flex items-center gap-4">
      <CropArt crop={crop.cropKey} size={artSize} />
      <div className="min-w-0 flex-1">
        <h2 className="text-section leading-snug font-bold text-ink">
          {cropLabel(crop, lang)}
          {crop.variety ? <span className="text-body font-medium text-ink-2"> ({crop.variety})</span> : null}
        </h2>
        <p className="mt-0.5 text-small text-ink-2">
          {areaText(crop.area, crop.unit, t)}
          {' • '}
          <span className={cx('font-semibold', TONE_TEXT[STAGE_TONE[status.stage]])}>{stagePhrase(status, lang, t)}</span>
        </p>
        {children}
      </div>
      {aside}
    </Card>
  );
}

/** "AI सलाह तैयार हो रही है…" while the calendar advice is shown in the meantime. */
export function AdvicePreparing() {
  const t = useT();
  return (
    <p role="status" className="flex items-center gap-2 text-small text-ink-2">
      <Spinner size="sm" />
      <span className="pt-0.5">{t('crops.advice.preparing')}</span>
    </p>
  );
}

/** "AI सलाह" (lavender) or "कैलेंडर के अनुसार" (green). */
export function SourceBadge({ source }: { source: CropAdvisory['source'] }) {
  const t = useT();
  return source === 'ai' ? (
    <Badge tone="tech" icon={Sparkles}>
      {t('crops.advice.source.ai')}
    </Badge>
  ) : (
    <Badge tone="green" icon={CalendarDays}>
      {t('crops.advice.source.rules')}
    </Badge>
  );
}

// ---------- Stage timeline ----------

type StepState = 'done' | 'current' | 'next';

interface Step {
  key: string;
  label: string;
  sub: string;
  state: StepState;
}

export interface StageTimelineProps {
  crop: Crop;
  status: StageStatus;
  progress: CropProgress;
  lang: string;
}

/** Catalog sub-stages with the current one highlighted, day N, % to harvest and the next stage. */
export function StageTimeline({ crop, status, progress, lang }: StageTimelineProps) {
  const t = useT();
  const nav = useNav();
  const timeline = useMemo(() => timelineFor(crop), [crop]);
  const nursery = timeline.profile.transplanted;
  const hasDate = !!timeline.day0;
  const inField = hasDate && status.stage !== 'planned' && status.stage !== 'harvested';
  const harvested = status.stage === 'harvested';

  const steps = useMemo<Step[]>(() => {
    const stages = timeline.profile.stages;
    let current = -1;
    if (inField) stages.forEach((s, i) => s.startDay <= status.day && (current = i));
    const list: Step[] = stages.map((s, i) => {
      const state: StepState = harvested || (inField && i < current) ? 'done' : inField && i === current ? 'current' : 'next';
      const inDays = s.startDay - status.day;
      const sub = hasDate && state === 'next' && inDays > 0 ? t('crops.detail.inDays', { n: inDays }) : t('crops.detail.fromDay', { n: s.startDay });
      return { key: `${i}-${s.startDay}`, label: subStageLabel(s, lang), sub, state };
    });
    const harvestDay = progress.day0 && progress.harvest ? daysBetween(progress.day0, progress.harvest) : timeline.profile.harvestDay;
    const left = progress.daysLeft;
    list.push({
      key: 'harvest',
      label: t('crops.detail.harvestStep'),
      sub: hasDate && left != null && left > 0 ? t('crops.detail.inDays', { n: left }) : t('crops.detail.harvestStepDay', { n: harvestDay }),
      state: harvested || (hasDate && left != null && left <= 0) ? 'done' : 'next',
    });
    return list;
  }, [timeline, inField, harvested, hasDate, status.day, progress, lang, t]);

  const editDates = () => nav.push('crop-edit', { id: crop.id });
  const next = status.nextStage;

  return (
    <div>
      {!hasDate ? (
        <Callout
          tone="neutral"
          icon={CalendarDays}
          action={
            <Button variant="secondary" icon={Pencil} onClick={editDates}>
              {t('crops.detail.addDate')}
            </Button>
          }
        >
          {t(nursery ? 'crops.detail.plannedNoteTransplant' : 'crops.detail.plannedNote')}
        </Callout>
      ) : status.stage === 'planned' ? (
        <p className="text-body font-semibold text-ink">
          {t(nursery ? 'crops.detail.beforeTransplant' : 'crops.detail.beforeSowing', { n: Math.max(1, -status.day) })}
        </p>
      ) : harvested ? (
        <Callout tone="neutral" icon={CircleCheck}>
          {t('crops.detail.harvestedNote')}
        </Callout>
      ) : (
        <div className="flex flex-col gap-2">
          <ProgressBar
            tone={STAGE_TONE[status.stage]}
            label={t(nursery ? 'crops.detail.dayFromTransplant' : 'crops.detail.dayFromSowing', { n: progress.day })}
            valueLabel={t('crops.detail.progress', { pct: progress.pct })}
            value={progress.pct}
          />
          {next && next.inDays > 0 ? (
            <p className="text-small text-ink-2">{t('crops.detail.nextStage', { stage: subStageLabel(next, lang), n: next.inDays })}</p>
          ) : null}
        </div>
      )}

      <ol className="mt-4" aria-label={t('crops.detail.stage.title')}>
        {steps.map((s, i) => (
          <li key={s.key} aria-current={s.state === 'current' ? 'step' : undefined} className="relative flex gap-3 pb-3 last:pb-0">
            {i < steps.length - 1 && (
              <span aria-hidden className={cx('absolute top-8 bottom-0 left-[0.9375rem] w-0.5', s.state === 'done' ? 'bg-brand-600' : 'bg-line')} />
            )}
            <span
              aria-hidden
              className={cx(
                'relative z-[1] mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full',
                s.state === 'done' && 'bg-brand-700 text-white',
                s.state === 'current' && 'bg-brand-700 ring-4 ring-brand-100',
                s.state === 'next' && 'border-2 border-control bg-surface',
              )}
            >
              {s.state === 'done' ? <Check className="size-4.5" strokeWidth={3} /> : s.state === 'current' ? <span className="size-2.5 rounded-full bg-white" /> : null}
            </span>
            <div className={cx('min-w-0 flex-1', s.state === 'current' ? 'rounded-xl bg-brand-50 px-3 py-1.5' : 'pt-1')}>
              <p className={cx('text-body leading-snug', s.state === 'current' ? 'font-semibold text-ink' : s.state === 'done' ? 'text-ink-2' : 'text-ink')}>
                {s.label}
                {s.state === 'current' ? (
                  <Badge tone="green" className="ml-2 align-middle">
                    {t('crops.detail.now')}
                  </Badge>
                ) : null}
              </p>
              <p className="text-caption text-ink-2">{s.sub}</p>
            </div>
          </li>
        ))}
      </ol>
      {hasDate && <p className="mt-3 text-caption text-ink-3">{t('crops.detail.estimateNote')}</p>}
    </div>
  );
}

// ---------- Health ----------

export interface HealthSummaryProps {
  crop: Crop;
  diagnosis?: CropDiagnosis;
  aiHealth?: CropAdvisory['health'];
  lang: string;
}

const HEALTH_TONE = { good: 'brand', watch: 'warning', risk: 'danger' } as const;

/**
 * A recent photo diagnosis first, then the AI advisory's health note, then an older diagnosis;
 * always ends with the "फसल डॉक्टर से जांचें" link.
 */
export function HealthSummary({ crop, diagnosis, aiHealth, lang }: HealthSummaryProps) {
  const t = useT();
  const nav = useNav();
  const fresh = !!diagnosis && diagnosisAgeDays(diagnosis) <= DIAGNOSIS_FRESH_DAYS;
  const doctor = () => nav.push('crop-doctor', isCropKey(crop.cropKey) ? { cropKey: crop.cropKey } : {});

  let body: ReactNode;
  if (diagnosis && (fresh || !aiHealth)) {
    const issue = lang === 'en' && diagnosis.issueEn ? diagnosis.issueEn : diagnosis.issue;
    body = (
      <>
        <ListRow
          variant="plain"
          className="-mx-4"
          leading={<Thumbnail src={diagnosis.image} alt="" fallback={<CropArt crop={crop.cropKey} size={56} />} />}
          title={diagnosis.healthy ? t('crops.health.healthy') : t('crops.health.issue', { issue })}
          subtitle={t('crops.health.checkedOn', { date: formatDate(localDay(diagnosis.createdAt)), pct: Math.round(diagnosis.confidence) })}
          meta={!fresh ? <span className="font-semibold text-tone-amber">{t('crops.health.old')}</span> : undefined}
          onPress={() => nav.push('diagnosis', { id: diagnosis.id })}
        />
        <Disclaimer kind="ai" />
      </>
    );
  } else if (aiHealth) {
    body = (
      <>
        <Callout tone={HEALTH_TONE[aiHealth.status]} title={t(`crops.health.status.${aiHealth.status}`)}>
          <p>{aiHealth.note}</p>
          <p className="mt-1 text-caption text-ink-3">{t('crops.health.aiNote')}</p>
        </Callout>
        <Disclaimer kind="ai" />
      </>
    );
  } else {
    body = (
      <div>
        <p className="text-body font-semibold text-ink">{t('crops.health.none')}</p>
        <p className="mt-0.5 text-small text-ink-2">{t('crops.health.noneBody')}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {body}
      <Button variant="secondary" fullWidth icon={Stethoscope} onClick={doctor}>
        {t('crops.health.check')}
      </Button>
    </div>
  );
}

// ---------- Risks ----------

export function RiskList({ risks }: { risks: CropRisk[] }) {
  const t = useT();
  return (
    <ul className="flex flex-col divide-y divide-line">
      {risks.map(r => (
        <li key={r.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
          <ToneIcon icon={r.icon} tone={RISK_TONE[r.level]} size="sm" className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-body leading-snug font-semibold text-ink">
              <span className="sr-only">{t(`crops.risk.level.${r.level}`)}: </span>
              {r.title}
            </p>
            <p className="mt-0.5 text-small text-ink-2">{r.text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function NoRisk({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2.5 text-small text-ink-2">
      <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-tone-green" />
      <span className="pt-0.5">{text}</span>
    </p>
  );
}

export interface WeatherRiskBodyProps {
  weather: Resource<WeatherSnapshot>;
  /** Risks worked out from the weather (alerts + stage rules). */
  risks: CropRisk[];
  /** Risks that do not depend on today's weather view (the AI advisory's own list). */
  otherRisks?: CropRisk[];
  /** "No major risk" line, shown only when the forecast is known and nothing was found. */
  noneText: string;
  today: ISODate;
}

/**
 * Body of a risk card. Unknown weather is never shown as "no risk": a skeleton while it loads,
 * a friendly error with retry when it failed, and a note when the saved forecast has no days
 * left. Always says how old the weather is.
 */
export function WeatherRiskBody({ weather, risks, otherRisks = [], noneText, today }: WeatherRiskBodyProps) {
  const t = useT();
  const data = weather.data;
  const all = data ? [...otherRisks, ...risks] : otherRisks;
  let status: ReactNode = null;
  if (!data) {
    status = weather.loading ? (
      <SkeletonList rows={2} variant="plain" media="circle" />
    ) : (
      <ErrorState compact error={weather.error} onRetry={() => void weather.refresh()} retrying={weather.refreshing} />
    );
  } else if (!hasForecast(data, today)) {
    status = (
      <p role="status" className="flex items-start gap-2.5 text-small text-ink-2">
        <CloudOff aria-hidden className="mt-0.5 size-5 shrink-0 text-tone-amber" />
        <span className="pt-0.5">{t('crops.risk.noForecast')}</span>
      </p>
    );
  } else if (!all.length) {
    status = <NoRisk text={noneText} />;
  }
  return (
    <>
      {all.length ? <RiskList risks={all} /> : null}
      {status}
      {data ? <LastUpdated at={weather.fetchedAt} stale={weather.stale} refreshing={weather.refreshing} onRefresh={() => void weather.refresh()} /> : null}
    </>
  );
}

// ---------- Accordion item (native <details>, no JS) ----------

export interface InfoSectionProps {
  icon: IconLike;
  tone: Tone;
  title: ReactNode;
  children: ReactNode;
}

export function InfoSection({ icon, tone, title, children }: InfoSectionProps) {
  return (
    <details className="group border-t border-line first:border-t-0">
      <summary className="press flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <ToneIcon icon={icon} tone={tone} size="sm" />
        <span className="min-w-0 flex-1 pt-0.5 text-body leading-snug font-semibold text-ink">{title}</span>
        <ChevronDown aria-hidden className="size-5 shrink-0 text-ink-3 transition-transform duration-150 group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4 text-small leading-relaxed text-ink-2">{children}</div>
    </details>
  );
}

/** Bulleted list for catalog text inside an InfoSection. */
export function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((x, i) => (
        <li key={i} className="flex gap-2">
          <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-ink-3" />
          <span>{x}</span>
        </li>
      ))}
    </ul>
  );
}
