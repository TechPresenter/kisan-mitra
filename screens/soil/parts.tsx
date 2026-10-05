// Pieces shared by the soil screens: the score card (gauge + nutrient rows), the AI advice
// panel with all its states, the "how the score works" sheet, report rows and share text.
import { useId, useMemo } from 'react';
import { CircleCheck, CircleHelp, Leaf, RefreshCw, Sparkles, TriangleAlert, WifiOff } from 'lucide-react';
import './strings';
import {
  Button,
  Card,
  Disclaimer,
  ErrorState,
  Gauge,
  LastUpdated,
  LevelBar,
  ListenButton,
  Sheet,
  SkeletonText,
  TINT_BG,
  TONE_TEXT,
  cx,
  gaugeTone,
  renderIcon,
  type IconLike,
} from '../../components/ui';
import { cropName } from '../../data/crop-keys';
import { useOnline } from '../../lib/cache';
import { formatNumber } from '../../lib/format';
import { useLanguage, useT, type TFunction } from '../../lib/i18n';
import {
  ACRES_PER_HA,
  NUTRIENT_POINTS,
  PH_CLASSES,
  PH_NORMAL,
  SCORE_BANDS,
  SOIL_MIN_READINGS,
  SOIL_RATINGS,
  flattenRecommendations,
  perHaToPerAcre,
  reportScore,
  scoreLabelKey,
  soilAdviceAvailable,
  soilHealthScore,
  readingsOf,
  useSoilRecommendations,
  type NutrientInputUnit,
  type NutrientParam,
  type NutrientRating,
  type SoilHealthResult,
  type SoilRecommendations,
  type SoilReportExt,
} from '../../services/soil';
import { isDevanagariLang } from '../kheti/parts';

/**
 * Store key the report screen bumps (Date.now()) for "नई जांच के मान भरें", so the soil form
 * that stays mounted underneath clears itself instead of showing the old readings.
 */
export const SOIL_FORM_RESET_KEY = 'soil.reset';

// ---------- Readings ----------

/** "180 किलो/हे." / "6.8" / "0.42%" in the unit the farmer typed. */
export function formatReading(n: NutrientRating, unit: NutrientInputUnit, t: TFunction): string {
  if (n.key === 'ph') return formatNumber(n.value, 1);
  if (n.key === 'oc') return `${formatNumber(n.value, 2)}%`;
  const value = unit === 'acre' ? perHaToPerAcre(n.value) : n.value;
  return `${formatNumber(value, value >= 100 ? 0 : 1)} ${t(unit === 'acre' ? 'soil.unit.acreShort' : 'soil.unit.haShort')}`;
}

/**
 * "मध्यम: 280–560 किलो/हे." in the chosen unit. Per-acre edges are rounded inwards (low up, high
 * down), so a value typed at either shown edge is rated मध्यम too: 280 kg/ha is 113.3 kg/acre,
 * and 113 kg/acre (279.2 kg/ha) would be कम, so the hint starts at 114.
 */
export function mediumRangeText(key: NutrientParam, unit: NutrientInputUnit, t: TFunction): string {
  const r = SOIL_RATINGS[key];
  if (key === 'oc') return t('soil.form.rangeMedium', { low: r.low, high: `${r.high}%`, unit: '' }).trim();
  const acre = unit === 'acre';
  return t('soil.form.rangeMedium', {
    low: acre ? Math.ceil(r.low / ACRES_PER_HA) : r.low,
    high: acre ? Math.floor(r.high / ACRES_PER_HA) : r.high,
    unit: t(acre ? 'soil.unit.acreShort' : 'soil.unit.haShort'),
  });
}

export const phRangeText = (t: TFunction) => t('soil.form.rangePh', { low: PH_NORMAL.low, high: PH_NORMAL.high });

// ---------- Score card ----------

export interface SoilResultCardProps {
  result: SoilHealthResult;
  unit: NutrientInputUnit;
  onHow: () => void;
  className?: string;
}

/** Reference 18: "मिट्टी स्वास्थ्य स्कोर" gauge "72/100 मध्यम", then one LevelBar per reading. */
export function SoilResultCard({ result, unit, onHow, className }: SoilResultCardProps) {
  const t = useT();
  // Both soil screens can be mounted at once (the stack keeps hidden screens), so ids are unique.
  const titleId = useId();
  return (
    <Card as="section" aria-labelledby={titleId} className={className}>
      <h2 id={titleId} className="text-section font-bold text-ink">
        {t('soil.result.title')}
      </h2>
      {result.enough ? (
        <Gauge
          className="mt-3"
          value={result.score}
          label={t(result.labelKey)}
          tone={gaugeTone(result.score)}
          caption={t('soil.result.title')}
          footer={
            <p className="mt-2 text-caption text-ink-2">{t('soil.result.basis', { n: result.filled, total: result.total })}</p>
          }
        />
      ) : (
        // Too few readings for a meaningful score: say so instead of an alarming "0/100 कमज़ोर".
        <p className="mt-3 rounded-xl bg-surface-2 px-3.5 py-3 text-body text-ink">{t('soil.form.needMore')}</p>
      )}
      <div className="mt-2 flex justify-center">
        <Button variant="ghost" icon={CircleHelp} onClick={onHow}>
          {t('soil.result.how')}
        </Button>
      </div>
      <h3 className="mt-3 text-body font-semibold text-ink">{t('soil.result.nutrients')}</h3>
      <div className="mt-1 divide-y divide-line">
        {result.nutrients.map(n => (
          <LevelBar
            key={n.key}
            label={t(n.nameKey)}
            // pH adds its finer class ("6.0 · हल्की अम्लीय"); for N/P/K/OC the class is the status word.
            detail={
              n.key === 'ph'
                ? t('soil.result.reading', { value: formatReading(n, unit, t), cls: t(n.classKey) })
                : formatReading(n, unit, t)
            }
            value={n.fill}
            status={n.level}
            statusLabel={t(n.labelKey)}
          />
        ))}
      </div>
    </Card>
  );
}

// ---------- "How the score works" ----------

/** pH class edges for display (the table stores 7.5 + 1e-9 so that 7.5 itself is neutral). */
const phEdge = (n: number) => formatNumber(Math.round(n * 10) / 10, 1);

/** "4.5 से कम: बहुत ज़्यादा अम्लीय = 20" … one line per pH class, built from PH_CLASSES. */
function phClassLines(t: TFunction): { key: string; text: string }[] {
  return PH_CLASSES.map((c, i) => {
    const low = i > 0 ? phEdge(PH_CLASSES[i - 1].below) : null;
    const high = Number.isFinite(c.below) ? phEdge(c.below) : null;
    const range =
      low == null
        ? t('soil.info.phBelow', { v: high ?? '' })
        : high == null
          ? t('soil.info.phAbove', { v: low })
          : `${low}–${high}`;
    return { key: c.cls, text: t('soil.info.phLine', { range, cls: t(`soil.ph.${c.cls}`), points: c.points }) };
  });
}

export function ScoreInfoSheet({ open, onClose, unit }: { open: boolean; onClose: () => void; unit: NutrientInputUnit }) {
  const t = useT();
  const keys: NutrientParam[] = ['n', 'p', 'k', 'oc'];
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('soil.info.title')}
      footer={
        <Button fullWidth size="lg" onClick={onClose}>
          {t('common.close')}
        </Button>
      }
    >
      <div className="flex flex-col gap-3 text-body leading-relaxed text-ink">
        <p>{t('soil.info.weights')}</p>
        <p>{t('soil.info.points', NUTRIENT_POINTS)}</p>
        <div>
          <p>{t('soil.info.phPoints')}</p>
          <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5">
            {phClassLines(t).map(line => (
              <li key={line.key}>{line.text}</li>
            ))}
          </ul>
        </div>
        <p>{t('soil.info.missing', { min: SOIL_MIN_READINGS })}</p>
        <p>{t('soil.info.bands', { good: SCORE_BANDS.good, medium: SCORE_BANDS.medium, goodMinus: SCORE_BANDS.good - 1 })}</p>
        <div className="rounded-list border border-line bg-surface-2 p-4">
          <p className="text-small font-semibold text-ink">{t('soil.info.rangesTitle')}</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-small text-ink-2">
            <li>
              {t('soil.param.ph')}: {phRangeText(t)}
            </li>
            {keys.map(k => (
              <li key={k}>
                {t(`soil.param.${k}`)}: {mediumRangeText(k, unit, t)}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-small text-ink-2">{t('soil.info.units')}</p>
        <p className="text-small text-ink-2">{t('soil.info.source')}</p>
        <p className="text-small text-ink-2">{t('soil.info.micro')}</p>
      </div>
    </Sheet>
  );
}

// ---------- AI advice ----------

const sameKeys = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every(k => b.includes(k));

/** Scripts whose full stop is the danda "।" (Devanagari, Bengali/Assamese, Odia, Gurmukhi). */
const usesDanda = (lang: string) => isDevanagariLang(lang) || ['bn', 'as', 'or', 'pa'].includes(lang);

/** Trailing full stops ("।", "॥", ".", "۔") and spaces. */
const TRAILING_STOP = /[\s।॥.۔]+$/u;

/**
 * Advice as one text to read aloud, punctuated for the language's TTS voice: each item and
 * section ends in "।" or "." (never "।।"), so the voice pauses between them.
 */
export function recommendationsSpeech(r: SoilRecommendations, t: TFunction, lang: string): string {
  const stop = usesDanda(lang) ? '।' : '.';
  const bare = (s: string) => s.trim().replace(TRAILING_STOP, '');
  const items = (list: string[]) => list.map(bare).filter(Boolean).join(`${stop} `);
  const parts = [
    t('soil.ai.speechIntro'),
    r.summary,
    r.actions.length ? `${t('soil.ai.actions')}: ${items(r.actions)}` : '',
    r.organic.length ? `${t('soil.ai.organic')}: ${items(r.organic)}` : '',
    r.cautions.length ? `${t('soil.ai.cautions')}: ${items(r.cautions)}` : '',
  ]
    .map(bare)
    .filter(Boolean);
  return parts.length ? `${parts.join(`${stop} `)}${stop}` : '';
}

function AdviceList({ title, items, icon, iconClass }: { title: string; items: string[]; icon: IconLike; iconClass: string }) {
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <h3 className="text-body font-semibold text-ink">{title}</h3>
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((line, i) => (
          <li key={i} className="flex items-start gap-2.5">
            {renderIcon(icon, { className: cx('mt-0.5 size-5 shrink-0', iconClass), strokeWidth: 2.25 })}
            <span className="text-body leading-relaxed text-ink">{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface RecommendationsPanelProps {
  report: SoilReportExt;
  /** Crop keys the farmer wants advice for now. */
  cropKeys: string[];
  /** The farmer asked for advice (otherwise only cached advice shows). */
  requested: boolean;
  /** Show the "AI सुझाव देखें" call-to-action when there is no advice yet (report screen). */
  onRequest?: () => void;
}

/** Cached advice, skeleton while the AI works, friendly error with retry, or the CTA. */
export function RecommendationsPanel({ report, cropKeys, requested, onRequest }: RecommendationsPanelProps) {
  const t = useT();
  const { language } = useLanguage();
  const titleId = useId();
  const online = useOnline();
  const res = useSoilRecommendations(report, cropKeys, requested);
  const data = res.data;

  const cropsText = useMemo(
    () => (data?.cropKeys.length ? data.cropKeys.map(k => cropName(k, language.code)).join(', ') : ''),
    [data, language.code],
  );

  if (data) {
    const differs = !sameKeys(data.cropKeys, cropKeys);
    return (
      <Card as="section" tone="tech" aria-labelledby={titleId}>
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="flex items-center gap-2 text-section font-bold text-ink">
            <Sparkles aria-hidden className="size-5 text-tech" strokeWidth={2.25} />
            {t('soil.ai.title')}
          </h2>
          <ListenButton id={`soil-ai-${report.id}`} text={recommendationsSpeech(data, t, language.code)} />
        </div>
        <p className="mt-1 text-caption text-ink-2">
          {cropsText ? t('soil.ai.forCrops', { crops: cropsText }) : t('soil.ai.forGeneral')}
        </p>
        {data.summary && <p className="mt-3 text-body leading-relaxed text-ink">{data.summary}</p>}
        <AdviceList title={t('soil.ai.actions')} items={data.actions} icon={CircleCheck} iconClass="text-tone-green" />
        <AdviceList title={t('soil.ai.organic')} items={data.organic} icon={Leaf} iconClass="text-tone-teal" />
        <AdviceList title={t('soil.ai.cautions')} items={data.cautions} icon={TriangleAlert} iconClass="text-tone-amber" />
        {res.error && (
          // A refresh failed: keep the earlier advice and say so quietly.
          <ErrorState compact className="mt-4" error={res.error} onRetry={res.refresh} retrying={res.refreshing} />
        )}
        {differs && (
          <Button className="mt-4" variant="tech" icon={RefreshCw} loading={res.refreshing} onClick={res.refresh}>
            {t('soil.ai.regenerate')}
          </Button>
        )}
        <LastUpdated className="mt-3" at={res.fetchedAt} refreshing={res.refreshing} />
        <Disclaimer kind="fertilizer" className="mt-3" />
      </Card>
    );
  }

  if (res.loading) {
    return (
      <Card as="section" tone="tech" role="status" aria-busy>
        <p className="flex items-center gap-2 text-body font-semibold text-ink">
          <Sparkles aria-hidden className="size-5 text-tech" strokeWidth={2.25} />
          {t('soil.ai.loading')}
        </p>
        <SkeletonText lines={6} className="mt-4" />
      </Card>
    );
  }

  if (res.error) {
    return <ErrorState compact error={res.error} onRetry={res.refresh} retrying={res.refreshing} />;
  }

  // Not asked yet (report screen): advice kept on the record from an earlier run, then the CTA.
  const previous = report.recommendations ?? [];
  if (!onRequest) return null;
  const note = <AiAvailabilityNote online={online} className="mt-2" />;
  return (
    <Card as="section" tone="tech">
      {previous.length > 0 ? (
        <>
          <h2 className="flex items-center gap-2 text-section font-bold text-ink">
            <Sparkles aria-hidden className="size-5 text-tech" strokeWidth={2.25} />
            {t('soil.ai.previous')}
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {previous.map((line, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-tone-green" strokeWidth={2.25} />
                <span className="text-body leading-relaxed text-ink">{line}</span>
              </li>
            ))}
          </ul>
          {/* Kept from an earlier AI run: label its age so it never reads as current advice. */}
          <LastUpdated className="mt-3" at={report.recommendationsAt} stale />
          <Disclaimer kind="fertilizer" className="mt-3" />
          <Button className="mt-4" fullWidth variant="tech" icon={RefreshCw} onClick={onRequest}>
            {t('soil.ai.retryCrop')}
          </Button>
          {note}
        </>
      ) : (
        <>
          <h2 className="flex items-center gap-2 text-section font-bold text-ink">
            <Sparkles aria-hidden className="size-5 text-tech" strokeWidth={2.25} />
            {t('soil.ai.ctaTitle')}
          </h2>
          <p className="mt-1 text-small text-ink-2">{t('soil.ai.ctaBody')}</p>
          <Button className="mt-4" fullWidth size="lg" icon={Sparkles} onClick={onRequest}>
            {t('soil.ai.button')}
          </Button>
          {note}
        </>
      )}
    </Card>
  );
}

/**
 * Under an "AI सुझाव देखें" button: says up front when the advice cannot come (no internet, or
 * AI not set up in this build) instead of letting the farmer find out after tapping.
 */
export function AiAvailabilityNote({
  online,
  willSave = false,
  className,
}: {
  online: boolean;
  /** The tap also saves the report (soil form): add "रिपोर्ट फिर भी सेव हो जाएगी". */
  willSave?: boolean;
  className?: string;
}) {
  const t = useT();
  const text = !soilAdviceAvailable()
    ? t(willSave ? 'soil.ai.unavailable' : 'soil.ai.unavailableShort')
    : !online
      ? t(willSave ? 'soil.ai.offline' : 'soil.ai.offlineShort')
      : '';
  if (!text) return null;
  return (
    <p role="note" className={cx('flex items-start gap-2 text-small text-ink-2', className)}>
      <WifiOff aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
      <span>{text}</span>
    </p>
  );
}

// ---------- Report rows ----------

/** Round score badge in the score's colour, for report lists ("—" when there is no score). */
export function ScoreBadge({ score }: { score: number | null }) {
  const tone = score == null ? 'gray' : gaugeTone(score);
  return (
    <span
      aria-hidden
      className={cx(
        'inline-flex size-12 shrink-0 items-center justify-center rounded-full text-body font-bold tabular-nums',
        TINT_BG[tone],
        TONE_TEXT[tone],
      )}
    >
      {score ?? '—'}
    </span>
  );
}

// ---------- Share ----------

export function soilReportShareText(
  report: SoilReportExt,
  recs: SoilRecommendations | undefined,
  t: TFunction,
  dateLabel: string,
): { title: string; text: string } {
  const result = soilHealthScore(readingsOf(report));
  const score = reportScore(report);
  const unit = report.inputUnit ?? 'ha';
  const title = t('soil.share.title', { date: dateLabel });
  const lines = [
    title,
    score != null ? t('soil.share.score', { score, label: t(scoreLabelKey(score)) }) : t('soil.past.noScore'),
    '',
    ...result.nutrients.map(n => `${t(n.nameKey)}: ${formatReading(n, unit, t)} — ${t(n.labelKey)}`),
  ];
  const advice = recs ? flattenRecommendations(recs) : report.recommendations ?? [];
  if (advice.length) lines.push('', `${t('soil.ai.title')}:`, ...advice.map(a => `• ${a}`));
  lines.push('', t('common.disclaimer.fertilizer'), t('soil.share.footer'));
  return { title, text: lines.join('\n') };
}
