// फसल विवरण. Params: { id }. Header, quick actions, stage timeline, today's advice preview,
// next task, weather risk, crop health, expected harvest and the catalog guide.
import './strings';
import { useMemo } from 'react';
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  CloudLightning,
  Droplets,
  ExternalLink,
  FlaskConical,
  HeartPulse,
  IndianRupee,
  Info,
  Mountain,
  Pencil,
  Ruler,
  Scale,
  Sparkles,
  Sprout,
  Stethoscope,
  Bug,
  Tractor,
  Wheat,
} from 'lucide-react';
import {
  Button,
  Card,
  Checkbox,
  DateTile,
  Disclaimer,
  IconTile,
  LastUpdated,
  ListRow,
  Screen,
  SectionHeader,
  SkeletonText,
  StatCard,
  TileGrid,
  ToneIcon,
  toast,
} from '../../components/ui';
import { isCropKey } from '../../data/crop-keys';
import { getDiseases } from '../../data/diseases';
import { SEASON_NAMES, catalogText, expectedHarvestForCrop, getCropInfo, npkPerAcre, seasonForCrop, stageForCrop, type CropInfo } from '../../data/crops';
import { placeLabel, usePlace } from '../../lib/app-state';
import { useOnline } from '../../lib/cache';
import { formatDate, formatNumber } from '../../lib/format';
import { useLanguage, useT, type TFunction } from '../../lib/i18n';
import { useNav, useRoute } from '../../lib/nav';
import { KEYS, useCollection } from '../../lib/store';
import { useCropAdvisory } from '../../services/advisory';
import { nextTaskForCrop, taskText, useTasks } from '../../services/tasks';
import { useWeather } from '../../services/weather';
import type { Crop, CropDiagnosis, Farm } from '../../types/models';
import {
  activeCropTasks,
  adviceFallbackNote,
  adviceItems,
  cropLabel,
  cropProgress,
  cropWeatherRisks,
  dueLabel,
  latestDiagnosis,
  mentionsFertilizer,
  plantingLine,
  type AdviceItem,
} from './helpers';
import { AdvicePreparing, Bullets, CropHeaderCard, HealthSummary, InfoSection, MissingCrop, SourceBadge, StageTimeline, WeatherRiskBody, useToday } from './parts';

export default function CropDetailScreen() {
  const t = useT();
  const { params } = useRoute<{ id?: string }>();
  const crops = useCollection<Crop>(KEYS.crops).items;
  const crop = params.id ? crops.find(c => c.id === params.id) : undefined;
  if (!crop) return <MissingCrop title={t('crops.title')} />;
  return <CropDetail crop={crop} />;
}

function CropDetail({ crop }: { crop: Crop }) {
  const t = useT();
  const nav = useNav();
  const { language } = useLanguage();
  const lang = language.code;
  const online = useOnline();
  const [appPlace] = usePlace();
  const place = crop.place || appPlace;
  const farms = useCollection<Farm>(KEYS.farms).items;
  const farm = crop.farmId ? farms.find(f => f.id === crop.farmId) : undefined;
  const info = getCropInfo(crop.cropKey);
  const name = cropLabel(crop, lang);
  // Moves on at midnight, so a screen left open overnight shows the new day N, % and due labels.
  const today = useToday();

  const status = useMemo(() => stageForCrop(crop, today), [crop, today]);
  const progress = useMemo(() => cropProgress(crop, status, today), [crop, status, today]);
  const weather = useWeather(place);
  const risks = useMemo(() => cropWeatherRisks(crop, status, weather.data, t, { alerts: true, today }), [crop, status, weather.data, t, today]);
  const { tasks, setDone } = useTasks();
  const cropTasks = useMemo(() => activeCropTasks(tasks, crop), [tasks, crop]);
  // `today` is a dependency so the next task rolls over with the date.
  const next = useMemo(() => nextTaskForCrop(crop.id, cropTasks), [crop.id, cropTasks, today]);
  const diagnoses = useCollection<CropDiagnosis>(KEYS.diagnoses).items;
  const diagnosis = useMemo(() => latestDiagnosis(diagnoses, crop), [diagnoses, crop]);
  const adv = useCropAdvisory(crop);
  const advisory = adv.advisory;
  const source = adv.data ? 'ai' : 'rules';
  const preview = useMemo<AdviceItem[]>(() => adviceItems(advisory, 'today', cropTasks, t, today).slice(0, 2), [advisory, cropTasks, t, today]);
  // While the AI advice is being made, the calendar advice is shown (marked as such) instead of a blank.
  const aiPreparing = adv.loading && !adv.data;
  const fallbackNote = source === 'rules' && !aiPreparing && adv.error ? adviceFallbackNote(adv.error, true, online, t) : null;

  const cropKeyParam = isCropKey(crop.cropKey) ? { cropKey: crop.cropKey } : {};
  // Editing lives in the app bar (and the timeline's "तारीख डालें"), so four tiles fit the row.
  const actions = [
    { key: 'doctor', icon: Stethoscope, tone: 'red' as const, label: t('crops.action.doctor'), onPress: () => nav.push('crop-doctor', cropKeyParam) },
    { key: 'expense', icon: IndianRupee, tone: 'orange' as const, label: t('crops.action.expense'), onPress: () => nav.push('hisab-entry', { kind: 'expense', cropId: crop.id }) },
    { key: 'ai', icon: Sparkles, tone: 'tech' as const, label: t('crops.action.ai'), onPress: () => nav.switchTab('ai', { screen: 'ai', params: { cropId: crop.id } }) },
    { key: 'calendar', icon: CalendarDays, tone: 'sky' as const, label: t('crops.action.calendar'), onPress: () => nav.push('calendar', { cropId: crop.id }) },
  ];

  const markDone = (id: string, done: boolean) => {
    setDone(id, done);
    if (done) toast.success(t('crops.task.doneToast'), { id: 'crop-task', action: { label: t('crops.task.undo'), onPress: () => setDone(id, false) } });
  };

  const harvestHint =
    progress.daysLeft == null
      ? t('crops.harvest.noDate')
      : status.stage === 'harvested' || progress.daysLeft < -14
        ? t('crops.harvest.past')
        : progress.daysLeft <= 0
          ? t('crops.harvest.due')
          : t('crops.harvest.daysLeft', { n: progress.daysLeft });
  // The calendar's harvest task follows the catalog estimate, so say where it is when the farmer's own date differs.
  const autoHarvest = expectedHarvestForCrop(crop);
  const customHarvest = !!crop.expectedHarvestDate && !!autoHarvest && crop.expectedHarvestDate !== autoHarvest;

  return (
    <Screen
      title={name}
      subtitle={farm ? t('crops.detail.farmLine', { farm: farm.name }) : undefined}
      actions={[{ icon: Pencil, label: t('crops.detail.edit'), onPress: () => nav.push('crop-edit', { id: crop.id }) }]}
    >
      <CropHeaderCard crop={crop} status={status} lang={lang} artSize={72}>
        <p className="mt-1 text-caption text-ink-2">{plantingLine(crop, t)}</p>
      </CropHeaderCard>

      {/* Quick actions */}
      <div role="group" aria-label={t('crops.detail.actions')}>
        <TileGrid columns={4}>
          {actions.map(a => (
            <IconTile key={a.key} icon={a.icon} tone={a.tone} label={a.label} onPress={a.onPress} />
          ))}
        </TileGrid>
      </div>

      {/* Stage timeline */}
      <Card as="section">
        <SectionHeader title={t('crops.detail.stage.title')} icon={Sprout} className="mb-3" />
        <StageTimeline crop={crop} status={status} progress={progress} lang={lang} />
      </Card>

      {/* Today's advice preview */}
      <Card as="section" className="flex flex-col gap-3">
        <SectionHeader title={t('crops.advice.title')} icon={Sparkles} action={<SourceBadge source={source} />} />
        {aiPreparing ? <AdvicePreparing /> : null}
        {preview.length ? (
          <ul className="flex flex-col gap-3">
            {preview.map(item => (
              <li key={item.key} className="flex items-start gap-3">
                <ToneIcon icon={item.topic.icon} tone={item.topic.tone} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-body leading-snug font-semibold text-ink">{item.title}</p>
                  <p className="text-small text-ink-2">{item.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : aiPreparing ? (
          <SkeletonText lines={2} />
        ) : (
          <p className="text-small text-ink-2">{t(progress.day0 ? 'crops.advice.empty.today' : 'crops.advice.emptyNoDate')}</p>
        )}
        {source === 'ai' ? <LastUpdated at={adv.fetchedAt} stale={adv.stale} refreshing={adv.refreshing} /> : null}
        {fallbackNote ? <p className="text-caption text-ink-2">{fallbackNote}</p> : null}
        {source === 'ai' ? <Disclaimer kind="ai" /> : null}
        {preview.some(i => mentionsFertilizer(`${i.title} ${i.desc}`)) ? <Disclaimer kind="fertilizer" /> : null}
        <Button variant="soft" fullWidth iconRight={ChevronRight} onClick={() => nav.push('crop-advisory', { id: crop.id })}>
          {t('crops.advice.seeAll')}
        </Button>
      </Card>

      {/* Next task */}
      <Card as="section" className="flex flex-col gap-2">
        <SectionHeader
          title={t('crops.task.title')}
          icon={ClipboardList}
          action={{ label: t('crops.task.calendar'), onPress: () => nav.push('calendar', { cropId: crop.id }) }}
        />
        {next ? (
          <ListRow
            variant="plain"
            className="-mx-4"
            leading={<DateTile date={next.dueDate} />}
            title={taskText(next).title}
            subtitle={taskText(next).desc}
            meta={dueLabel(next.dueDate, t, today)}
            trailing={<Checkbox checked={next.done} onChange={done => markDone(next.id, done)} aria-label={`${t('crops.task.markDone')}: ${taskText(next).title}`} />}
          />
        ) : (
          <p className="text-small text-ink-2">{t(progress.day0 || cropTasks.length ? 'crops.task.none' : 'crops.task.noDate')}</p>
        )}
      </Card>

      {/* Weather risk */}
      <Card as="section" className="flex flex-col gap-3">
        <SectionHeader title={t('crops.risk.title')} icon={CloudLightning} action={{ label: t('crops.risk.seeWeather'), onPress: () => nav.push('weather') }} />
        <WeatherRiskBody weather={weather} risks={risks} noneText={t('crops.risk.none')} today={today} />
      </Card>

      {/* Health */}
      <Card as="section" className="flex flex-col gap-3">
        <SectionHeader title={t('crops.health.title')} icon={HeartPulse} />
        <HealthSummary crop={crop} diagnosis={diagnosis} aiHealth={adv.data?.health} lang={lang} />
      </Card>

      {/* Expected harvest */}
      <section className="flex flex-col gap-2" aria-label={t('crops.harvest.title')}>
        <StatCard
          size="lg"
          tone="amber"
          icon={Wheat}
          label={t('crops.harvest.title')}
          value={progress.harvest ? formatDate(progress.harvest, { year: true }) : t('crops.harvest.noDateShort')}
          hint={harvestHint}
        />
        {progress.harvest ? (
          <div className="flex flex-col gap-1 px-1 text-caption text-ink-2">
            {customHarvest && autoHarvest ? (
              <>
                <p className="font-semibold text-ink">{t('crops.harvest.custom')}</p>
                <p>{t('crops.harvest.calendarNote', { date: formatDate(autoHarvest) })}</p>
              </>
            ) : null}
            {info?.harvestSpanDays ? <p>{t('crops.harvest.picking', { n: info.harvestSpanDays })}</p> : null}
            <p>{t('crops.harvest.note')}</p>
          </div>
        ) : null}
      </section>

      {/* Catalog guide */}
      <section className="flex flex-col gap-3">
        <SectionHeader title={t('crops.info.title')} subtitle={t('crops.info.subtitle')} icon={BookOpen} />
        <CatalogGuide crop={crop} info={info} farm={farm} placeText={placeLabel(place)} lang={lang} t={t} />
      </section>
    </Screen>
  );
}

interface GuideProps {
  crop: Crop;
  info?: CropInfo;
  farm?: Farm;
  placeText: string;
  lang: string;
  t: TFunction;
}

/** Accordion: the farmer's own details, then the catalog's general guidance for this crop. */
function CatalogGuide({ crop, info, farm, placeText, lang, t }: GuideProps) {
  const tx = (hi: string, en: string) => catalogText(lang, hi, en);
  const diseases = useMemo(() => (info ? getDiseases(info.majorPestsDiseases) : []), [info]);
  const notSet = t('crops.info.notSet');
  // Older records have no season field; it follows from the dates when they exist.
  const season = crop.season ?? (crop.sowingDate || crop.transplantDate ? seasonForCrop(crop) : undefined);
  const mine: [string, string][] = [
    [t('crops.info.variety'), crop.variety || notSet],
    [t('crops.info.season'), season ? tx(SEASON_NAMES[season].hi, SEASON_NAMES[season].en) : notSet],
    [t('crops.info.farm'), farm?.name || notSet],
    [t('crops.info.place'), placeText],
    [t('crops.info.soilMine'), crop.soilType ? t(`crops.soil.${crop.soilType}`) : notSet],
    [t('crops.info.irrigationMine'), crop.irrigation ? t(`crops.irrigation.${crop.irrigation}`) : notSet],
  ];
  const npk = info ? npkPerAcre(info) : null;
  const seed = info?.seedRateKgPerAcre;

  return (
    <div className="overflow-hidden rounded-list border border-line bg-surface">
      <InfoSection icon={Tractor} tone="green" title={t('crops.info.mine')}>
        <dl className="flex flex-col gap-2">
          {mine.map(([k, v]) => (
            <div key={k} className="flex gap-3">
              <dt className="w-24 shrink-0 text-ink-3">{k}</dt>
              <dd className="min-w-0 flex-1 text-ink">{v}</dd>
            </div>
          ))}
          {crop.notes ? (
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 text-ink-3">{t('crops.info.notes')}</dt>
              <dd className="min-w-0 flex-1 whitespace-pre-line text-ink">{crop.notes}</dd>
            </div>
          ) : null}
        </dl>
      </InfoSection>

      {info ? (
        <>
          <InfoSection icon={CalendarDays} tone="sky" title={t('crops.info.sowing')}>
            <p className="text-ink">{tx(info.sowingWindowHi, info.sowingWindowEn)}</p>
            <p className="mt-1">{t('crops.info.seasons', { list: info.seasons.map(s => tx(SEASON_NAMES[s].hi, SEASON_NAMES[s].en)).join(', ') })}</p>
            <p className="mt-1">{t('crops.info.duration', { min: info.durationDays.min, max: info.durationDays.max })}</p>
          </InfoSection>
          {seed ? (
            <InfoSection icon={Scale} tone="teal" title={t('crops.info.seed')}>
              <p className="text-ink">
                {seed.min === seed.max
                  ? t('crops.info.seedRateOne', { min: formatNumber(seed.min) })
                  : t('crops.info.seedRate', { min: formatNumber(seed.min), max: formatNumber(seed.max) })}
              </p>
              {tx(seed.noteHi || '', seed.noteEn || '') ? <p className="mt-1">{tx(seed.noteHi || '', seed.noteEn || '')}</p> : null}
              {info.seedOptions?.length ? (
                <div className="mt-2">
                  <Bullets
                    items={info.seedOptions.map(o =>
                      `${tx(o.labelHi, o.labelEn)}: ${o.min === o.max ? t('crops.info.seedRateOne', { min: formatNumber(o.min) }) : t('crops.info.seedRate', { min: formatNumber(o.min), max: formatNumber(o.max) })}`,
                    )}
                  />
                </div>
              ) : null}
            </InfoSection>
          ) : null}
          <InfoSection icon={Ruler} tone="gray" title={t('crops.info.spacing')}>
            <p className="text-ink">{tx(info.spacingHi, info.spacingEn)}</p>
          </InfoSection>
          <InfoSection icon={Droplets} tone="sky" title={t('crops.info.irrigation')}>
            <Bullets items={lang === 'en' ? info.criticalIrrigationEn : info.criticalIrrigationHi} />
            <p className="mt-2">{tx(info.irrigationCountHi, info.irrigationCountEn)}</p>
          </InfoSection>
          {npk ? (
            <InfoSection icon={FlaskConical} tone="indigo" title={t('crops.info.npk')}>
              <p className="font-semibold text-ink">{t('crops.info.npkLine', { n: npk.n, p: npk.p, k: npk.k })}</p>
              <p className="mt-1">{t('crops.info.npkHint')}</p>
              {tx(info.npkNoteHi || '', info.npkNoteEn || '') ? <p className="mt-1">{tx(info.npkNoteHi || '', info.npkNoteEn || '')}</p> : null}
              <Disclaimer kind="fertilizer" className="mt-3" />
            </InfoSection>
          ) : null}
          <InfoSection icon={Mountain} tone="amber" title={t('crops.info.soil')}>
            <p className="text-ink">{tx(info.soilHi, info.soilEn)}</p>
          </InfoSection>
          {info.commonVarietiesHi.length ? (
            <InfoSection icon={Sprout} tone="green" title={t('crops.info.varieties')}>
              <Bullets items={lang === 'en' ? info.commonVarietiesEn : info.commonVarietiesHi} />
              <p className="mt-2 text-caption">{t('crops.info.varietiesNote')}</p>
            </InfoSection>
          ) : null}
          {diseases.length ? (
            <InfoSection icon={Bug} tone="orange" title={t('crops.info.diseases')}>
              <Bullets items={diseases.map(d => (lang === 'en' ? d.nameEn : d.nameHi))} />
              <p className="mt-2 text-caption">{t('crops.info.diseasesNote')}</p>
            </InfoSection>
          ) : null}
          {info.sources.length ? (
            <InfoSection icon={Info} tone="gray" title={t('common.sources')}>
              <ul className="flex flex-col gap-1">
                {info.sources.map(url => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-12 items-center gap-1.5 font-medium break-all text-brand underline underline-offset-2"
                    >
                      <span>{hostOf(url)}</span>
                      <ExternalLink aria-hidden className="size-4 shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            </InfoSection>
          ) : null}
        </>
      ) : (
        <div className="flex items-start gap-3 border-t border-line p-4">
          <ToneIcon icon={Info} tone="gray" size="sm" />
          <p className="min-w-0 flex-1 pt-1.5 text-small text-ink-2">{t('crops.info.notAvailable')}</p>
        </div>
      )}
    </div>
  );
}

function hostOf(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.split('/').filter(Boolean).pop();
    return path ? `${u.hostname.replace(/^www\./, '')} › ${decodeURIComponent(path).slice(0, 40)}` : u.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
