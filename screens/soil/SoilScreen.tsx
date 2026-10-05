// "मिट्टी जांच" (reference 18): type in the Soil Health Card readings → score gauge and nutrient
// rows → AI fertilizer guidance (saved with the report) → past reports → where to get tested.
// The score works offline; only the AI advice needs the internet.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Building2,
  ClipboardList,
  FlaskConical,
  Gauge as GaugeIcon,
  Landmark,
  MapPin,
  Plus,
  Save,
  ScrollText,
  Sparkles,
} from 'lucide-react';
import '../../lib/common-strings';
import './strings';
import { EmptyArt } from '../../components/illustrations';
import {
  Button,
  Callout,
  Card,
  ChipGroup,
  DateField,
  EmptyState,
  ListGroup,
  ListRow,
  NumberField,
  Screen,
  SectionHeader,
  SelectField,
  ToneIcon,
  toast,
  type SelectOption,
} from '../../components/ui';
import { CROP_LIST, catalogText } from '../../data/crops';
import { useProfile } from '../../lib/app-state';
import { useOnline } from '../../lib/cache';
import { daysBetween, formatDate, todayISO } from '../../lib/format';
import { useLanguage, useT } from '../../lib/i18n';
import { useNav } from '../../lib/nav';
import { KEYS, store, useCollection, usePersisted } from '../../lib/store';
import {
  ACRES_PER_HA,
  SOIL_INPUT_LIMITS,
  SOIL_TYPES,
  perAcreToPerHa,
  readingsOutOfRange,
  reportScore,
  scoreLabelKey,
  soilHealthScore,
  soilTypeLabelKey,
  useSoilReports,
  type NutrientInputUnit,
  type SoilHealthResult,
  type SoilParam,
  type SoilReadings,
} from '../../services/soil';
import type { Crop, Farm, ID, SoilType } from '../../types/models';
import { ExternalLinkRow } from '../kheti/parts';
import {
  AiAvailabilityNote,
  RecommendationsPanel,
  SOIL_FORM_RESET_KEY,
  ScoreBadge,
  ScoreInfoSheet,
  SoilResultCard,
  mediumRangeText,
  phRangeText,
} from './parts';

const DRAFT_KEY = 'soil.draft';
const GENERAL = 'general';
/** The select's "no particular field" value (SelectField reserves '' for its placeholder). */
const NO_FARM = 'none';
const OLD_TEST_DAYS = 730;
const SHC_PORTAL = 'https://soilhealth.dac.gov.in';
const KVK_PORTAL = 'https://kvk.icar.gov.in';

interface Draft {
  ph: number | null;
  n: number | null;
  p: number | null;
  k: number | null;
  oc: number | null;
  soilType: SoilType | '';
  farmId: string;
  date: string;
  unit: NutrientInputUnit;
}

/** The draft fields that hold a lab reading (and so change the score). */
type ReadingField = 'ph' | 'n' | 'p' | 'k' | 'oc';

const emptyDraft = (soilType: SoilType | '' = ''): Draft => ({
  ph: null,
  n: null,
  p: null,
  k: null,
  oc: null,
  soilType,
  farmId: '',
  date: todayISO(),
  unit: 'ha',
});

/** Whole form, for keeping an unsaved draft across restarts. */
const keyOf = (d: Draft) => JSON.stringify(d);
/** Only what changes the score: the readings and their unit (not the field, date or soil type). */
const readingsKey = (d: Draft) => JSON.stringify([d.ph, d.n, d.p, d.k, d.oc, d.unit]);

function readDraft(): Draft | null {
  const d = store.get<Draft | null>(DRAFT_KEY, null);
  return d && typeof d === 'object' && 'unit' in d ? d : null;
}

/** Form values → readings in kg/ha (the unit SoilReport stores). */
function readingsFrom(d: Draft): SoilReadings {
  const toHa = (v: number | null) => (v == null ? null : d.unit === 'acre' ? perAcreToPerHa(v) : v);
  return { ph: d.ph, nitrogen: toHa(d.n), phosphorus: toHa(d.p), potassium: toHa(d.k), organicCarbon: d.oc };
}

interface Computed {
  /** readingsKey() of the draft the score was worked out from. */
  key: string;
  draft: Draft;
  result: SoilHealthResult;
}

type FieldErrors = Partial<Record<SoilParam, string>>;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export default function SoilScreen() {
  const t = useT();
  const nav = useNav();
  const { language } = useLanguage();
  const lang = language.code;
  const online = useOnline();
  const [profile] = useProfile();
  const farms = useCollection<Farm>(KEYS.farms).items;
  const crops = useCollection<Crop>(KEYS.crops).items;
  const reportsApi = useSoilReports();
  const formTitleId = useId();
  const pastTitleId = useId();
  const whereTitleId = useId();

  const [draft, setDraft] = useState<Draft>(() => readDraft() ?? emptyDraft(profile?.soilType ?? ''));
  const [computed, setComputed] = useState<Computed | null>(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [infoOpen, setInfoOpen] = useState(false);
  const [savedId, setSavedId] = useState<ID | null>(null);
  const [requested, setRequested] = useState(false);
  /** keyOf() the draft had when it was saved (then it need not be kept as a draft). */
  const savedKey = useRef<string | null>(null);
  /** The farmer picked a soil type themselves, so choosing a field must not overwrite it. */
  const soilTypeTouched = useRef(false);
  const formRef = useRef<HTMLElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const fieldRefs = useRef<Partial<Record<SoilParam, HTMLInputElement | null>>>({});

  const outdated = !!computed && computed.key !== readingsKey(draft);
  const savedReport = savedId ? reportsApi.get(savedId) : undefined;

  /** Field, date and soil type as stored on a report (a deleted field is dropped). */
  const metaOf = (d: Draft) => ({
    farmId: d.farmId && farms.some(f => f.id === d.farmId) ? d.farmId : undefined,
    date: d.date || todayISO(),
    soilType: d.soilType || undefined,
  });

  // The saved report was deleted (e.g. from its own screen while this one stayed mounted):
  // forget it, so "सेव हो गई" and "रिपोर्ट देखें" don't point at nothing and saving works again.
  useEffect(() => {
    if (savedId && !savedReport) {
      setSavedId(null);
      setRequested(false);
      savedKey.current = null;
      store.set(DRAFT_KEY, draft);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedId, savedReport]);

  // After saving, changing only the field, date or soil type updates that report in place
  // (no second report with the same readings). Runs before the draft effect below on purpose.
  useEffect(() => {
    if (!savedReport || outdated) return;
    const meta = metaOf(draft);
    if (meta.farmId !== savedReport.farmId || meta.date !== savedReport.date || meta.soilType !== savedReport.soilType) {
      reportsApi.update(savedReport.id, meta);
    }
    savedKey.current = keyOf(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, savedReport, outdated, farms]);

  // Keep an unfinished form across app restarts; forget it once it has been saved.
  useEffect(() => {
    if (savedKey.current === keyOf(draft)) store.remove(DRAFT_KEY);
    else store.set(DRAFT_KEY, draft);
  }, [draft]);

  // "नई जांच के मान भरें" on a report screen opened from here: start an empty form. Only a
  // change while mounted counts (the stored value survives restarts).
  const [resetAt] = usePersisted<number>(SOIL_FORM_RESET_KEY, 0);
  const seenReset = useRef(resetAt);
  useEffect(() => {
    if (resetAt === seenReset.current) return;
    seenReset.current = resetAt;
    startNew();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetAt]);

  const set = <K extends keyof Draft>(field: K, value: Draft[K]) => {
    setDraft(d => ({ ...d, [field]: value }));
    setError('');
  };

  /** A reading changed: clear its "check this value" message (the unit affects N, P and K). */
  const setReading = (field: ReadingField, value: number | null) => {
    set(field, value);
    setFieldErrors(e => (e[field] ? { ...e, [field]: undefined } : e));
  };

  // ----- Crop for the AI advice -----
  const myCropKeys = useMemo(() => {
    const onFarm = draft.farmId ? crops.filter(c => c.farmId === draft.farmId) : [];
    const ordered = [...onFarm, ...crops].map(c => c.cropKey);
    return [...new Set([...ordered, ...(profile?.cropKeys ?? [])])].filter(k => CROP_LIST.some(c => c.key === k));
  }, [crops, draft.farmId, profile?.cropKeys]);

  const [aiCrop, setAiCrop] = useState<string>(() => myCropKeys[0] ?? GENERAL);
  const aiCropKeys = aiCrop === GENERAL ? [] : [aiCrop];

  const cropOptions = useMemo<SelectOption[]>(() => {
    const name = (key: string) => {
      const c = CROP_LIST.find(x => x.key === key)!;
      return catalogText(lang, c.nameHi, c.nameEn);
    };
    const mine = myCropKeys.map(k => ({ value: k, label: name(k) }));
    const rest = CROP_LIST.filter(c => !myCropKeys.includes(c.key)).map(c => ({ value: c.key as string, label: name(c.key) }));
    return [{ value: GENERAL, label: t('soil.ai.general') }, ...mine, ...rest];
  }, [myCropKeys, lang, t]);

  // ----- Options -----
  const farmOptions = useMemo<SelectOption[]>(
    () => [{ value: NO_FARM, label: t('soil.form.farmNone') }, ...farms.map(f => ({ value: f.id, label: f.name }))],
    [farms, t],
  );
  const soilOptions = useMemo<SelectOption[]>(() => SOIL_TYPES.map(s => ({ value: s, label: t(soilTypeLabelKey(s)) })), [t]);
  const unitLabel = t(draft.unit === 'acre' ? 'soil.unit.acreShort' : 'soil.unit.haShort');
  const hint = (range: string) => t('soil.form.hint', { range });

  const oldTest = !!draft.date && daysBetween(draft.date, todayISO()) > OLD_TEST_DAYS;

  const scrollTo = (el: Element | null) => {
    el?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  };

  /** Friendly "check this value" text for a reading outside SOIL_INPUT_LIMITS. */
  const rangeError = (key: SoilParam): string => {
    const lim = SOIL_INPUT_LIMITS[key];
    if (key === 'ph') return t('soil.form.phRange', { min: lim.min, max: lim.max });
    if (key === 'oc') return t('soil.form.ocRange', { max: lim.max });
    const max = draft.unit === 'acre' ? Math.floor(lim.max / ACRES_PER_HA) : lim.max;
    return t('soil.form.tooHigh', { max, unit: unitLabel });
  };

  const compute = () => {
    const readings = readingsFrom(draft);
    // Never clamp a typo (pH "65" for 6.5) into a confident wrong score: ask to check it.
    const bad = readingsOutOfRange(readings);
    if (bad.length) {
      setFieldErrors(Object.fromEntries(bad.map(k => [k, rangeError(k)])) as FieldErrors);
      setError(t('soil.form.fixErrors'));
      fieldRefs.current[bad[0]]?.focus();
      return;
    }
    setFieldErrors({});
    if (computed && computed.key === readingsKey(draft)) {
      // Same readings as the score on screen (maybe already saved): just show it again.
      setError('');
      requestAnimationFrame(() => scrollTo(resultRef.current));
      return;
    }
    const result = soilHealthScore(readings);
    if (!result.enough) {
      setError(t('soil.form.needMore'));
      return;
    }
    setError('');
    setComputed({ key: readingsKey(draft), draft, result });
    setSavedId(null);
    setRequested(false);
    savedKey.current = null;
    requestAnimationFrame(() => scrollTo(resultRef.current));
  };

  const save = (): ID | null => {
    if (!computed || outdated) return null;
    if (savedId && reportsApi.get(savedId)) return savedId;
    // Not outdated, so the draft's readings are the computed ones; field/date/soil type are current.
    const report = reportsApi.save({
      ...readingsFrom(draft),
      ...metaOf(draft),
      cropKeys: aiCropKeys,
      inputUnit: draft.unit,
    });
    if (!report) return null;
    savedKey.current = keyOf(draft);
    store.remove(DRAFT_KEY);
    setSavedId(report.id);
    return report.id;
  };

  const saveOnly = () => {
    if (save()) toast.success(t('soil.saved'));
  };

  const askAI = () => {
    if (!save()) return;
    setRequested(true);
  };

  function startNew() {
    savedKey.current = null;
    soilTypeTouched.current = false;
    setDraft(d => emptyDraft(d.soilType));
    setComputed(null);
    setSavedId(null);
    setRequested(false);
    setError('');
    setFieldErrors({});
    requestAnimationFrame(() => {
      scrollTo(formRef.current);
      fieldRefs.current.ph?.focus({ preventScroll: true });
    });
  }

  const focusForm = () => {
    scrollTo(formRef.current);
    fieldRefs.current.ph?.focus({ preventScroll: true });
  };

  const chooseFarm = (value: string) => {
    const id = value === NO_FARM ? '' : value;
    const farm = farms.find(f => f.id === id);
    setDraft(d => ({
      ...d,
      farmId: id,
      // The profile's soil type is only a prefill: the chosen field's own type wins unless the
      // farmer picked one.
      soilType: soilTypeTouched.current ? d.soilType : (farm?.soilType ?? d.soilType),
    }));
    const farmCrop = id ? crops.find(c => c.farmId === id && CROP_LIST.some(x => x.key === c.cropKey))?.cropKey : undefined;
    if (farmCrop) setAiCrop(farmCrop);
  };

  // Past report rows: recomputing every score on each keystroke is wasted work on low-end phones.
  const reports = reportsApi.reports;
  const pastRows = useMemo(() => {
    const farmNames = new Map(farms.map(f => [f.id, f.name]));
    return reports.map(r => ({ r, score: reportScore(r), farm: r.farmId ? farmNames.get(r.farmId) : undefined }));
  }, [reports, farms]);

  const readingField = (key: ReadingField) => ({
    ref: (el: HTMLInputElement | null) => {
      fieldRefs.current[key] = el;
    },
    value: draft[key],
    onChange: (v: number | null) => setReading(key, v),
    // Only block negatives: an upper limit would be clamped silently on blur (see compute()).
    min: 0,
    error: fieldErrors[key],
  });

  return (
    <Screen title={t('soil.title')} subtitle={t('soil.subtitle')}>
      {/* ---------- Form ---------- */}
      <Card as="section" ref={formRef} aria-labelledby={formTitleId} className="scroll-mt-4">
        <SectionHeader title={<span id={formTitleId}>{t('soil.form.title')}</span>} icon={ClipboardList} />
        <p className="mt-1 text-small text-ink-2">{t('soil.form.intro')}</p>

        <div className="mt-4 flex flex-col gap-4">
          {farms.length > 0 ? (
            <SelectField
              label={t('soil.form.farm')}
              leadingIcon={MapPin}
              value={farms.some(f => f.id === draft.farmId) ? draft.farmId : NO_FARM}
              onChange={chooseFarm}
              options={farmOptions}
              hint={t('soil.form.farmHint')}
            />
          ) : (
            <Button variant="ghost" icon={Plus} className="self-start" onClick={() => nav.push('farm-edit')}>
              {t('soil.form.addFarm')}
            </Button>
          )}

          <DateField
            label={t('soil.form.date')}
            value={draft.date}
            onChange={v => set('date', v)}
            max={todayISO()}
            hint={t('soil.form.dateHint')}
          />
          {oldTest && <Callout tone="warning">{t('soil.form.oldDate')}</Callout>}

          <NumberField {...readingField('ph')} label={t('soil.param.ph')} step={0.1} hint={hint(phRangeText(t))} />

          <div className="flex flex-col gap-2">
            <p className="text-small font-semibold text-ink">{t('soil.form.unit')}</p>
            <ChipGroup
              ariaLabel={t('soil.form.unit')}
              wrap
              value={draft.unit}
              onChange={u => {
                set('unit', u as NutrientInputUnit);
                setFieldErrors(e => ({ ...e, n: undefined, p: undefined, k: undefined }));
              }}
              options={[
                { value: 'ha', label: t('soil.unit.ha') },
                { value: 'acre', label: t('soil.unit.acre') },
              ]}
            />
          </div>

          <NumberField
            {...readingField('n')}
            label={t('soil.param.n')}
            unit={unitLabel}
            hint={hint(mediumRangeText('n', draft.unit, t))}
          />
          <NumberField
            {...readingField('p')}
            label={t('soil.param.p')}
            unit={unitLabel}
            hint={hint(mediumRangeText('p', draft.unit, t))}
          />
          <NumberField
            {...readingField('k')}
            label={t('soil.param.k')}
            unit={unitLabel}
            hint={hint(mediumRangeText('k', draft.unit, t))}
          />
          <NumberField
            {...readingField('oc')}
            label={t('soil.param.oc')}
            step={0.01}
            unit="%"
            hint={hint(mediumRangeText('oc', draft.unit, t))}
          />
          <SelectField
            label={t('soil.form.soilType')}
            value={draft.soilType}
            onChange={v => {
              soilTypeTouched.current = true;
              set('soilType', v as SoilType);
            }}
            options={soilOptions}
            hint={t('soil.form.soilTypeHint')}
          />

          {error && (
            <p role="alert" className="rounded-xl bg-tint-red px-3.5 py-3 text-small font-medium text-tone-red">
              {error}
            </p>
          )}
          <Button fullWidth size="lg" icon={GaugeIcon} onClick={compute}>
            {t('soil.form.submit')}
          </Button>
        </div>
      </Card>

      {/* ---------- Result ---------- */}
      {computed && (
        <div ref={resultRef} className="flex scroll-mt-4 flex-col gap-5">
          {outdated && (
            <Callout tone="warning">
              {t('soil.result.changed')}
              {requested && savedReport ? ` ${t('soil.ai.outdated')}` : ''}
            </Callout>
          )}
          <SoilResultCard result={computed.result} unit={computed.draft.unit} onHow={() => setInfoOpen(true)} />

          {!outdated && !requested && (
            <Card as="section" aria-label={t('soil.ai.title')}>
              <SelectField
                label={t('soil.ai.crop')}
                value={aiCrop}
                onChange={setAiCrop}
                options={cropOptions}
                hint={t('soil.ai.cropHint')}
              />
              <Button className="mt-4" fullWidth size="lg" icon={Sparkles} onClick={askAI}>
                {t('soil.ai.button')}
              </Button>
              <AiAvailabilityNote online={online} willSave={!savedReport} className="mt-2" />
              {!savedReport && (
                <Button className="mt-2" fullWidth variant="secondary" icon={Save} onClick={saveOnly}>
                  {t('soil.ai.saveOnly')}
                </Button>
              )}
            </Card>
          )}

          {/* Advice for the readings on screen only: hidden once a reading changes (see the callout). */}
          {requested && savedReport && !outdated && (
            <>
              <Card as="section" aria-label={t('soil.ai.crop')}>
                <SelectField label={t('soil.ai.crop')} value={aiCrop} onChange={setAiCrop} options={cropOptions} />
              </Card>
              <RecommendationsPanel report={savedReport} cropKeys={aiCropKeys} requested />
            </>
          )}

          {savedReport && (
            <Callout
              tone="brand"
              role="status"
              title={t('soil.saved')}
              action={
                <>
                  <Button variant="secondary" onClick={() => nav.push('soil-report', { id: savedReport.id })}>
                    {t('soil.savedView')}
                  </Button>
                  <Button variant="ghost" icon={Plus} onClick={startNew}>
                    {t('soil.form.clear')}
                  </Button>
                </>
              }
            >
              {t('soil.savedBody')}
            </Callout>
          )}
        </div>
      )}

      {/* ---------- Past reports ---------- */}
      <section aria-labelledby={pastTitleId} className="flex flex-col gap-3">
        <SectionHeader title={<span id={pastTitleId}>{t('soil.past.title')}</span>} />
        {pastRows.length ? (
          <ListGroup ariaLabel={t('soil.past.list')}>
            {pastRows.map(({ r, score, farm }) => (
              <ListRow
                key={r.id}
                variant="plain"
                leading={<ScoreBadge score={score} />}
                title={formatDate(r.date, { year: true })}
                subtitle={[
                  score != null ? t('soil.past.score', { score, label: t(scoreLabelKey(score)) }) : t('soil.past.noScore'),
                  farm,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                onPress={() => nav.push('soil-report', { id: r.id })}
              />
            ))}
          </ListGroup>
        ) : (
          <Card padding="none">
            <EmptyState
              compact
              art={<EmptyArt kind="soil" tone="amber" />}
              title={t('soil.past.emptyTitle')}
              body={t('soil.past.emptyBody')}
              action={{ label: t('soil.past.emptyAction'), onPress: focusForm }}
            />
          </Card>
        )}
      </section>

      {/* ---------- Where to test ---------- */}
      <section aria-labelledby={whereTitleId} className="flex flex-col gap-3">
        <SectionHeader title={<span id={whereTitleId}>{t('soil.where.title')}</span>} />
        <p className="text-small text-ink-2">{t('soil.where.body')}</p>
        <div role="list" className="overflow-hidden rounded-list border border-line bg-surface">
          <div role="listitem">
            <ExternalLinkRow
              href={SHC_PORTAL}
              icon={Landmark}
              title={t('soil.where.portal')}
              subtitle={t('soil.where.portalSub')}
              tone="green"
            />
          </div>
          <div role="listitem" className="border-t border-line">
            <ExternalLinkRow href={KVK_PORTAL} icon={Building2} title={t('soil.where.kvk')} subtitle={t('soil.where.kvkSub')} tone="sky" />
          </div>
          <div role="listitem" className="border-t border-line">
            <ListRow
              variant="plain"
              leading={<ToneIcon icon={FlaskConical} tone="amber" size="sm" />}
              title={t('soil.where.howTo')}
              subtitle={t('soil.where.howToSub')}
              onPress={() => nav.push('technique', { id: 'soil-test' })}
            />
          </div>
          <div role="listitem" className="border-t border-line">
            <ListRow
              variant="plain"
              leading={<ToneIcon icon={ScrollText} tone="rose" size="sm" />}
              title={t('soil.where.scheme')}
              subtitle={t('soil.where.schemeSub')}
              onPress={() => nav.push('scheme', { id: 'soil-health-card' })}
            />
          </div>
        </div>
      </section>

      <ScoreInfoSheet open={infoOpen} onClose={() => setInfoOpen(false)} unit={computed?.draft.unit ?? draft.unit} />
    </Screen>
  );
}
