// The eight onboarding questions and the "तैयार है" summary. Each step is one question on one
// screen with a big friendly visual; answers go straight into the persisted draft.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BellRing,
  CalendarCheck,
  Check,
  CircleHelp,
  CloudLightning,
  CloudRain,
  Droplet,
  Droplets,
  Ellipsis,
  Fish,
  LandPlot,
  Languages,
  LocateFixed,
  MapPin,
  Search,
  Shovel,
  ShowerHead,
  Sprout,
  UserRound,
  Waves,
} from 'lucide-react';
import { CropArt, FarmScene } from '../../components/illustrations';
import { LocationSheet } from '../../components/shared/LocationSheet';
import { CropPicker } from '../../components/shared/CropPicker';
import {
  Avatar,
  Button,
  Card,
  ChipGroup,
  ListGroup,
  ListRow,
  MicButton,
  NumberField,
  RadioCards,
  SearchBar,
  SelectField,
  TextField,
  TONE_TEXT,
  ToneIcon,
  cx,
  toast,
  type RadioCardOption,
  type Tone,
  type IconLike,
} from '../../components/ui';
import { cropName } from '../../data/crop-keys';
import { CROP_LIST, SEASON_NAMES, catalogText, cropsBySeason, currentSeason, type CropInfo } from '../../data/crops';
import { BIGHA_PRESETS, areaInAcres, bighaPresetById } from '../../data/units';
import { placeLabel, usePlace, useSettings } from '../../lib/app-state';
import { formatNumber } from '../../lib/format';
import { LANGUAGES, useLanguage, useT } from '../../lib/i18n';
import { LocationError, detectCurrentPlace, searchPlaces } from '../../services/location';
import type { AreaUnit, GeoPlace, IrrigationType, SoilType } from '../../types/models';
import { bestMatchFor } from '../auth/place-match';
import { AREA_UNITS, IRRIGATION_TYPES, SOIL_CHOICES, validLand, type OnboardingDraft } from './draft';
import '../../services/location-strings';
import './strings';

type Patch = (p: Partial<OnboardingDraft>) => void;
type HeadingRef = { current: HTMLHeadingElement | null };

// ---------- Shared layout ----------

/** Visual + the question as the page heading + one helpful line. */
export function StepIntro({ visual, title, help, headingRef }: { visual: ReactNode; title: ReactNode; help?: ReactNode; headingRef: HeadingRef }) {
  return (
    <div className="flex flex-col items-center gap-3 pt-2 text-center">
      {visual}
      <h2 ref={headingRef} tabIndex={-1} className="text-[1.5rem] leading-snug font-bold text-ink outline-none">
        {title}
      </h2>
      {help != null && <p className="max-w-sm text-body text-ink-2">{help}</p>}
    </div>
  );
}

const BigIcon = ({ icon, tone }: { icon: IconLike; tone: Tone }) => <ToneIcon icon={icon} tone={tone} size="xl" />;

// ---------- 1. Name ----------

export function NameStep({ name, patch, headingRef, inputRef }: { name: string; patch: Patch; headingRef: HeadingRef; inputRef: { current: HTMLInputElement | null } }) {
  const t = useT();
  return (
    <>
      <StepIntro
        headingRef={headingRef}
        visual={name.trim() ? <Avatar name={name} size="xl" /> : <BigIcon icon={UserRound} tone="green" />}
        title={t('onboarding.name.q')}
        help={t('onboarding.name.help')}
      />
      <TextField
        ref={inputRef}
        label={t('onboarding.name.label')}
        placeholder={t('onboarding.name.placeholder')}
        value={name}
        onValueChange={v => patch({ name: v })}
        autoComplete="name"
        autoCapitalize="words"
        enterKeyHint="next"
        maxLength={60}
        trailing={
          <MicButton variant="ghost" label={t('onboarding.name.voice')} onResult={text => patch({ name: text.replace(/\s+/g, ' ').trim().slice(0, 60) })} />
        }
      />
    </>
  );
}

// ---------- 2. Place ----------

/** District/state typed at signup that has not become a real (weather/mandi) place yet. */
export interface TypedPlace {
  district: string;
  state?: string;
}

export const typedPlaceLabel = (p: TypedPlace): string => (p.state && p.state !== p.district ? `${p.district}, ${p.state}` : p.district);

export function PlaceStep({
  place,
  typed,
  patch,
  headingRef,
}: {
  place: GeoPlace | null;
  typed: TypedPlace | null;
  patch: Patch;
  headingRef: HeadingRef;
}) {
  const t = useT();
  const [, setAppPlace] = usePlace();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [suggestion, setSuggestion] = useState<GeoPlace | null>(null);
  // GPS and search results must not change answers after the farmer has left this step.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Typed at signup: look that district up once and offer it for a one-tap confirm.
  const typedDistrict = place ? undefined : typed?.district;
  const typedState = typed?.state;
  useEffect(() => {
    if (!typedDistrict) return;
    let live = true;
    searchPlaces(typedDistrict)
      .then(found => {
        if (live) setSuggestion(bestMatchFor(found, typedDistrict, typedState));
      })
      .catch(() => {
        // Offline or not found: the farmer can still search or use GPS below.
      });
    return () => {
      live = false;
    };
  }, [typedDistrict, typedState]);

  /** A GPS find or a confirmed suggestion also becomes the app's place (the sheet does that itself). */
  const choose = (p: GeoPlace) => {
    setAppPlace(p);
    patch({ place: p });
  };

  const detect = async () => {
    setDetecting(true);
    try {
      const found = await detectCurrentPlace();
      if (alive.current) choose(found);
    } catch (e) {
      if (!alive.current) return;
      const code = e instanceof LocationError ? e.code : 'unavailable';
      toast.error(t(`location.error.${code}`), { id: 'onboarding-gps' });
    } finally {
      if (alive.current) setDetecting(false);
    }
  };

  const detail = place ? [place.district && place.district !== place.name ? place.district : null, place.state].filter(Boolean).join(', ') : '';

  return (
    <>
      <StepIntro headingRef={headingRef} visual={<BigIcon icon={MapPin} tone="green" />} title={t('onboarding.place.q')} help={t('onboarding.place.help')} />

      {place ? (
        <Card tone="brand" className="flex items-center gap-3" aria-live="polite">
          <ToneIcon icon={MapPin} tone="green" />
          <div className="min-w-0 flex-1">
            <p className="text-caption font-semibold text-ink-2">{t('onboarding.place.chosen')}</p>
            <p className="text-card-title leading-snug font-bold text-ink">{place.name}</p>
            {detail && <p className="text-small text-ink-2">{detail}</p>}
          </div>
        </Card>
      ) : typed ? (
        <Card tone="muted" className="flex flex-col gap-3 border-dashed! border-line-strong!" aria-live="polite">
          <div className="flex items-center gap-3">
            <ToneIcon icon={MapPin} tone="amber" />
            <div className="min-w-0 flex-1">
              <p className="text-caption font-semibold text-ink-2">{t('onboarding.place.typed')}</p>
              <p className="text-card-title leading-snug font-bold text-ink">{typedPlaceLabel(typed)}</p>
              <p className="text-small text-ink-2">{t(suggestion ? 'onboarding.place.suggestHelp' : 'onboarding.place.typedHelp')}</p>
            </div>
          </div>
          {suggestion && (
            <Button size="lg" fullWidth icon={Check} onClick={() => choose(suggestion)}>
              {t('onboarding.place.confirm', { place: suggestion.name })}
            </Button>
          )}
        </Card>
      ) : (
        <Card tone="muted" className="flex items-center gap-3 border-dashed! border-line-strong!" aria-live="polite">
          <ToneIcon icon={MapPin} tone="gray" />
          <div className="min-w-0 flex-1">
            <p className="text-body font-semibold text-ink">{t('onboarding.place.none')}</p>
            <p className="text-small text-ink-2">{t('onboarding.place.noneHelp')}</p>
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        <Button variant="secondary" size="lg" fullWidth icon={LocateFixed} loading={detecting} onClick={detect}>
          {detecting ? t('location.detecting') : t('onboarding.place.detect')}
        </Button>
        <Button variant="secondary" size="lg" fullWidth icon={Search} onClick={() => setSheetOpen(true)}>
          {place ? t('onboarding.place.change') : t('onboarding.place.search')}
        </Button>
      </div>

      <LocationSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onSelect={p => patch({ place: p })} title={t('onboarding.place.sheet')} />
    </>
  );
}

// ---------- 3. Land ----------

export function LandStep({
  draft,
  patch,
  headingRef,
  inputRef,
}: {
  draft: OnboardingDraft;
  patch: Patch;
  headingRef: HeadingRef;
  inputRef: { current: HTMLInputElement | null };
}) {
  const t = useT();
  const { language } = useLanguage();
  const [settings, updateSettings] = useSettings();
  const unit: AreaUnit = draft.landUnit ?? 'acre';
  const area = draft.landArea ?? null;
  const en = language.code === 'en';

  const bighaOptions = useMemo(
    () =>
      BIGHA_PRESETS.filter(p => p.id !== 'custom' || settings.bighaPreset === 'custom').map(p => ({
        value: p.id,
        label: p.id === 'custom' ? `${en ? p.labelEn : p.labelHi} (${formatNumber(areaInAcres(1, 'bigha', settings.bighaSqm), 3)} ${t('common.acre')})` : en ? p.labelEn : p.labelHi,
      })),
    [en, settings.bighaPreset, settings.bighaSqm, t],
  );

  const acres = validLand(area) && unit !== 'acre' ? areaInAcres(area, unit, settings.bighaSqm) : null;

  return (
    <>
      <StepIntro headingRef={headingRef} visual={<BigIcon icon={LandPlot} tone="amber" />} title={t('onboarding.land.q')} help={t('onboarding.land.help')} />

      <NumberField
        ref={inputRef}
        label={t('onboarding.land.label')}
        value={area}
        onChange={v => patch({ landArea: v })}
        unit={t(`common.${unit}`)}
        min={0}
        max={100000}
        step={0.5}
        stepper
        enterKeyHint="next"
        hint={acres != null ? t('onboarding.land.approx', { n: formatNumber(acres, 2) }) : undefined}
      />

      <div className="flex flex-col gap-2">
        <p className="text-small font-semibold text-ink">
          {t('onboarding.land.unit')}
        </p>
        <ChipGroup
          ariaLabel={t('onboarding.land.unit')}
          wrap
          bleed={false}
          value={unit}
          onChange={u => patch({ landUnit: u })}
          options={AREA_UNITS.map(u => ({ value: u, label: t(`common.${u}`) }))}
        />
      </div>

      {unit === 'bigha' && (
        <SelectField
          label={t('onboarding.land.bigha')}
          hint={t('onboarding.land.bighaHint')}
          value={settings.bighaPreset && bighaPresetById(settings.bighaPreset) ? settings.bighaPreset : ''}
          options={bighaOptions}
          onChange={id => {
            const preset = bighaPresetById(id);
            if (!preset || id === settings.bighaPreset) return;
            updateSettings(id === 'custom' ? { bighaPreset: id } : { bighaPreset: id, bighaSqm: preset.sqm });
          }}
        />
      )}
    </>
  );
}

// ---------- 4. Crops ----------

function CropCluster() {
  return (
    <span aria-hidden className="relative inline-flex h-18 w-36 items-center justify-center">
      <CropArt crop="mustard" size={56} className="absolute left-0 -rotate-6" />
      <CropArt crop="paddy" size={56} className="absolute right-0 rotate-6" />
      <CropArt crop="wheat" size={68} className="relative z-[1] ring-4 ring-canvas rounded-[14px]" />
    </span>
  );
}

/** Search form of a crop name: case, nukta and chandrabindu/anusvara spellings ignored (गेहूँ = गेहूं). */
const foldName = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f\u093c]/g, '').replace(/\u0901/g, '\u0902').toLowerCase();

const keysOf = (list: readonly CropInfo[]): string[] => list.map(c => c.key as string);

export function CropsStep({ draft, patch, headingRef }: { draft: OnboardingDraft; patch: Patch; headingRef: HeadingRef }) {
  const t = useT();
  const { language } = useLanguage();
  const season = useMemo(() => currentSeason(), []);
  // Every crop is shown: this season's first, then the rest (crops still standing from the
  // last season, like धान in October, must not look missing).
  const groups = useMemo(() => {
    const inSeason = new Set(keysOf(cropsBySeason(season)));
    return {
      season: keysOf(CROP_LIST.filter(c => inSeason.has(c.key))),
      others: keysOf(CROP_LIST.filter(c => !inSeason.has(c.key))),
    };
  }, [season]);
  const [query, setQuery] = useState('');
  const value = draft.cropKeys ?? [];
  const onChange = (keys: string[]) => patch({ cropKeys: keys });

  const matches = useMemo(() => {
    const q = foldName(query.trim());
    if (!q) return null;
    return keysOf(CROP_LIST.filter(c => [c.nameHi, c.nameEn, ...(c.otherNamesHi || [])].some(n => foldName(n).includes(q))));
  }, [query]);

  const seasonName = catalogText(language.code, SEASON_NAMES[season].hi, SEASON_NAMES[season].en);
  const names = value.map(k => cropName(k, language.code)).join(', ');

  return (
    <>
      <StepIntro headingRef={headingRef} visual={<CropCluster />} title={t('onboarding.crops.q')} help={t('onboarding.crops.help')} />

      <SearchBar voice value={query} onChange={setQuery} placeholder={t('onboarding.crops.search')} ariaLabel={t('onboarding.crops.search')} />

      <div aria-live="polite">
        {value.length > 0 && (
          <Card tone="brand" padding="sm" radius="list" className="flex items-start gap-2">
            <Sprout aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />
            <p className="text-small text-ink">
              <span className="font-semibold">
                {value.length === 1 ? t('onboarding.crops.selectedOne') : t('onboarding.crops.selected', { n: value.length })}:
              </span>{' '}
              {names}
            </p>
          </Card>
        )}
      </div>

      {matches ? (
        <CropPicker multiple label={t('onboarding.crops.results')} value={value} onChange={onChange} only={matches} columns={3} />
      ) : (
        <>
          <CropPicker
            multiple
            label={t('onboarding.crops.season', { season: seasonName })}
            value={value}
            onChange={onChange}
            only={groups.season}
            columns={3}
          />
          {groups.others.length > 0 && (
            <CropPicker multiple label={t('onboarding.crops.others')} value={value} onChange={onChange} only={groups.others} columns={3} />
          )}
        </>
      )}
    </>
  );
}

// ---------- 5. Irrigation ----------

const IRRIGATION_ICON: Record<IrrigationType, { icon: IconLike; tone: Tone }> = {
  canal: { icon: Waves, tone: 'teal' },
  tubewell: { icon: Droplets, tone: 'indigo' },
  drip: { icon: Droplet, tone: 'green' },
  sprinkler: { icon: ShowerHead, tone: 'sky' },
  rainfed: { icon: CloudRain, tone: 'tech' },
  pond: { icon: Fish, tone: 'orange' },
  other: { icon: Ellipsis, tone: 'gray' },
};

export function IrrigationStep({ draft, patch, headingRef }: { draft: OnboardingDraft; patch: Patch; headingRef: HeadingRef }) {
  const t = useT();
  const options: RadioCardOption<IrrigationType>[] = IRRIGATION_TYPES.map(k => ({
    value: k,
    label: t(`onboarding.irrigation.${k}`),
    icon: IRRIGATION_ICON[k].icon,
    tone: IRRIGATION_ICON[k].tone,
  }));
  return (
    <>
      <StepIntro headingRef={headingRef} visual={<BigIcon icon={Droplets} tone="sky" />} title={t('onboarding.irrigation.q')} help={t('onboarding.irrigation.help')} />
      <RadioCards
        label={<span className="sr-only">{t('onboarding.irrigation.label')}</span>}
        columns={2}
        value={draft.irrigation ?? null}
        onChange={v => patch({ irrigation: v })}
        options={options}
      />
    </>
  );
}

// ---------- 6. Soil ----------

/** Soil colour swatches (fixed colours, like a photo of the soil). */
const SOIL_SWATCH: Partial<Record<SoilType, [light: string, base: string]>> = {
  alluvial: ['#dcc7a4', '#b49572'],
  loamy: ['#a97d54', '#7b5534'],
  black: ['#5a524b', '#2e2925'],
  red: ['#d2714b', '#a2432a'],
  sandy: ['#f2e0b6', '#d9bb82'],
  clay: ['#b8a898', '#857263'],
};

function SoilSwatch({ soil }: { soil: SoilType }) {
  const c = SOIL_SWATCH[soil];
  if (!c) return <ToneIcon icon={CircleHelp} tone="gray" shape="rounded" />;
  return (
    <span
      aria-hidden
      className="inline-flex size-11 shrink-0 rounded-xl border border-black/10"
      style={{ background: `radial-gradient(circle at 30% 28%, ${c[0]}, ${c[1]} 72%)` }}
    />
  );
}

export function SoilStep({ draft, patch, headingRef }: { draft: OnboardingDraft; patch: Patch; headingRef: HeadingRef }) {
  const t = useT();
  const options: RadioCardOption<SoilType>[] = SOIL_CHOICES.map(k => ({
    value: k,
    label: t(`onboarding.soil.${k}`),
    description: t(`onboarding.soil.${k}.hint`),
    media: <SoilSwatch soil={k} />,
  }));
  return (
    <>
      <StepIntro headingRef={headingRef} visual={<BigIcon icon={Shovel} tone="orange" />} title={t('onboarding.soil.q')} help={t('onboarding.soil.help')} />
      <RadioCards
        label={<span className="sr-only">{t('onboarding.soil.label')}</span>}
        value={draft.soilType ?? null}
        onChange={v => patch({ soilType: v })}
        options={options}
      />
    </>
  );
}

// ---------- 7. Language ----------

const ORDERED_LANGUAGES = [...LANGUAGES].sort((a, b) => Number(b.complete) - Number(a.complete));

export function LanguageStep({ headingRef }: { headingRef: HeadingRef }) {
  const t = useT();
  const { language, setLanguage } = useLanguage();
  const options: RadioCardOption[] = ORDERED_LANGUAGES.map(l => ({
    value: l.code,
    label: (
      <span lang={l.code} dir={l.rtl ? 'rtl' : undefined}>
        {l.label}
      </span>
    ),
    description: l.complete ? l.nameEn : `${l.nameEn} · ${t('onboarding.language.partial')}`,
  }));
  return (
    <>
      <StepIntro headingRef={headingRef} visual={<BigIcon icon={Languages} tone="indigo" />} title={t('onboarding.language.q')} help={t('onboarding.language.help')} />
      <RadioCards
        label={<span className="sr-only">{t('onboarding.language.label')}</span>}
        columns={2}
        value={language.code}
        onChange={code => setLanguage(code)}
        options={options}
      />
    </>
  );
}

// ---------- 8. Notifications ----------

/** `native`: Android, where the system asks for permission. On the web reminders show in-app. */
export function NotifyStep({ headingRef, native }: { headingRef: HeadingRef; native: boolean }) {
  const t = useT();
  return (
    <>
      <StepIntro headingRef={headingRef} visual={<BigIcon icon={BellRing} tone="amber" />} title={t('onboarding.notify.q')} help={t('onboarding.notify.help')} />
      <ListGroup ariaLabel={t('onboarding.notify.list')}>
        <ListRow
          variant="plain"
          leading={<ToneIcon icon={CloudLightning} tone="sky" />}
          title={t('onboarding.notify.weather')}
          subtitle={t('onboarding.notify.weatherBody')}
        />
        <ListRow
          variant="plain"
          leading={<ToneIcon icon={CalendarCheck} tone="green" />}
          title={t('onboarding.notify.tasks')}
          subtitle={t('onboarding.notify.tasksBody')}
        />
      </ListGroup>
      <p className="text-center text-small text-ink-2">{t(native ? 'onboarding.notify.settings' : 'onboarding.notify.web')}</p>
    </>
  );
}

// ---------- Done ----------

export interface SummaryRow {
  key: 'name' | 'place' | 'land' | 'crops';
  step: number;
  value: string | null;
  leading: ReactNode;
  /** Shown, but still to be confirmed (a district typed at signup that is not a real place yet). */
  unconfirmed?: boolean;
}

export function DoneStep({
  name,
  place,
  typedPlace,
  draft,
  headingRef,
  onEdit,
}: {
  name: string;
  place: GeoPlace | null;
  typedPlace: TypedPlace | null;
  draft: OnboardingDraft;
  headingRef: HeadingRef;
  onEdit: (step: number) => void;
}) {
  const t = useT();
  const { language } = useLanguage();
  const crops = draft.cropKeys ?? [];
  const unit = draft.landUnit ?? 'acre';

  const rows: SummaryRow[] = [
    { key: 'name', step: 0, value: name.trim() || null, leading: <Avatar name={name.trim() || '?'} size="md" /> },
    {
      key: 'place',
      step: 1,
      value: place ? placeLabel(place) : typedPlace ? typedPlaceLabel(typedPlace) : null,
      unconfirmed: !place && !!typedPlace,
      leading: <ToneIcon icon={MapPin} tone={place ? 'green' : 'amber'} size="sm" />,
    },
    {
      key: 'land',
      step: 2,
      value: validLand(draft.landArea) ? `${formatNumber(draft.landArea, 2)} ${t(`common.${unit}`)}` : null,
      leading: <ToneIcon icon={LandPlot} tone="amber" size="sm" />,
    },
    {
      key: 'crops',
      step: 3,
      value: crops.length ? crops.map(k => cropName(k, language.code)).join(', ') : null,
      leading: crops.length ? <CropArt crop={crops[0]} size={40} /> : <ToneIcon icon={Sprout} tone="green" size="sm" />,
    },
  ];

  return (
    <>
      <div className="relative">
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-card border border-line">
          <FarmScene variant="welcome" className="absolute inset-0 size-full" />
        </div>
        <span className="absolute -bottom-7 left-1/2 inline-flex -translate-x-1/2 animate-pop-in rounded-full bg-canvas p-1.5">
          <span className="inline-flex size-14 items-center justify-center rounded-full bg-brand-700 text-white shadow-float">
            <Check aria-hidden className="size-8" strokeWidth={3} />
          </span>
        </span>
      </div>

      <div className="mt-6 flex flex-col items-center gap-1 text-center">
        <h2 ref={headingRef} tabIndex={-1} className="text-[1.5rem] leading-snug font-bold text-ink outline-none">
          {t('onboarding.done.title')}
        </h2>
        <p className="text-card-title font-semibold text-brand">
          {name.trim() ? t('onboarding.done.greet', { name: name.trim() }) : t('onboarding.done.greetNoName')}
        </p>
        <p className="max-w-sm text-body text-ink-2">{t('onboarding.done.help')}</p>
      </div>

      <section className="flex flex-col gap-2">
        <div className="px-1">
          <h3 className="text-section font-bold text-ink">{t('onboarding.done.summary')}</h3>
          <p className="text-small text-ink-2">{t('onboarding.done.editHint')}</p>
        </div>
        <ListGroup ariaLabel={t('onboarding.done.summary')}>
          {rows.map(r => {
            const label = t(`onboarding.done.${r.key}`);
            const value = r.value ?? t('onboarding.done.notSet');
            const confirmNote = r.unconfirmed ? t('onboarding.done.confirmPlace') : '';
            return (
              <ListRow
                key={r.key}
                variant="plain"
                leading={r.leading}
                title={
                  <span className={cx(!r.value && 'font-normal text-ink-3')}>
                    {value}
                    {confirmNote && <span className={cx('text-small font-semibold', TONE_TEXT.amber)}> · {confirmNote}</span>}
                  </span>
                }
                subtitle={label}
                subtitleLines={1}
                ariaLabel={t('onboarding.done.edit', { label, value: confirmNote ? `${value} (${confirmNote})` : value })}
                onPress={() => onEdit(r.step)}
              />
            );
          })}
        </ListGroup>
      </section>
    </>
  );
}
