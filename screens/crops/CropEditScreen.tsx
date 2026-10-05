// नई फसल जोड़ें / फसल की जानकारी बदलें. Params: { id?, cropKey? }.
// Picking the crop comes first (pictures, searchable, plus "अन्य फसल"); the rest of the form
// appears once a crop is chosen. Season and expected harvest follow the dates automatically
// until the farmer changes them. Saving re-creates the crop's calendar tasks.
import './strings';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, MapPin, Pencil, Plus, Sprout, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  Chip,
  ChipGroup,
  DateField,
  ListRow,
  MicButton,
  NumberField,
  Screen,
  SectionHeader,
  SelectField,
  TextArea,
  TextField,
  ToneIcon,
  confirm,
  toast,
} from '../../components/ui';
import { CropArt } from '../../components/illustrations';
import { CropPicker } from '../../components/shared/CropPicker';
import { LocationSheet } from '../../components/shared/LocationSheet';
import { CROP_NAMES, isCropKey } from '../../data/crop-keys';
import {
  SEASONS,
  SEASON_NAMES,
  catalogText,
  expectedHarvestForCrop,
  getCropInfo,
  isValidISODate,
  seasonFromDay0,
  seasonFromSowingDate,
  type Season,
} from '../../data/crops';
import { track } from '../../lib/analytics';
import { placeLabel, usePlace, useProfile, useSettings } from '../../lib/app-state';
import { useBackHandler } from '../../lib/back';
import { addDays, daysBetween, formatDate, formatNumber, todayISO } from '../../lib/format';
import { useLanguage, useT } from '../../lib/i18n';
import { useIsActiveScreen, useNav, useRoute } from '../../lib/nav';
import { KEYS, newId, useCollection } from '../../lib/store';
import { removeCropTasks, syncCropTasks } from '../../services/tasks';
import type { AreaUnit, Crop, Farm, GeoPlace, IrrigationType, SoilType, UserProfile } from '../../types/models';
import { AREA_UNITS, IRRIGATION_TYPES, SOIL_TYPES, cropLabel, cropRoutesOnTop, samePlace } from './helpers';
import { MissingCrop } from './parts';

interface FormState {
  /** Catalog key, 'other', or null while nothing is chosen. */
  cropKey: string | null;
  otherName: string;
  variety: string;
  area: number | null;
  unit: AreaUnit;
  /** '' = no farm. */
  farmId: string;
  sowingDate: string;
  transplantDate: string;
  /** null = follow the dates automatically (or no season yet when there is no date). */
  season: Season | null;
  /** null = the catalog estimate. */
  harvest: string | null;
  soilType: SoilType | '';
  irrigation: IrrigationType | '';
  /** null = follow the farm's place, else the app's place (nothing is pinned on the crop). */
  place: GeoPlace | null;
  notes: string;
}

type ErrorKey = keyof Pick<FormState, 'cropKey' | 'otherName' | 'area' | 'sowingDate' | 'transplantDate' | 'harvest'>;
type Errors = Partial<Record<ErrorKey, string>>;

/**
 * Fields filled in automatically (from a farm, or the profile's defaults); remembered so choosing
 * another farm replaces only these, never what the farmer typed.
 */
type FarmFilled = 'soilType' | 'irrigation' | 'place' | 'unit';

const AREA_MAX = 10000;
const NOTES_MAX = 500;

const valid = (d: string) => (isValidISODate(d) ? d : undefined);

/** Season implied by the dates; null without a date (it is not guessed from today). */
function autoSeason(cropKey: string, sowing: string, transplant: string): Season | null {
  if (isValidISODate(sowing)) return seasonFromSowingDate(cropKey, sowing);
  if (isValidISODate(transplant)) return seasonFromDay0(cropKey, transplant);
  return null;
}

function initialState(existing: Crop | undefined, paramKey: string | undefined, farms: Farm[], profile: UserProfile | null, appPlace: GeoPlace): FormState {
  if (existing) {
    const key = isCropKey(existing.cropKey) ? existing.cropKey : 'other';
    const sowing = existing.sowingDate ?? '';
    const transplant = existing.transplantDate ?? '';
    const auto = autoSeason(key, sowing, transplant);
    // The stored season is the farmer's own choice only when a date exists and it differs from the
    // date's season. Without a date it is not trusted (older versions saved today's season), so the
    // form follows the date once one is entered.
    const season = auto && existing.season && existing.season !== auto ? existing.season : null;
    const autoHarvest = expectedHarvestForCrop({ cropKey: key, sowingDate: valid(sowing), transplantDate: valid(transplant), season: season ?? auto });
    const harvest = isValidISODate(existing.expectedHarvestDate) && existing.expectedHarvestDate !== autoHarvest ? existing.expectedHarvestDate : null;
    // A deleted farm is dropped, so the select never holds an id that matches no option.
    const farm = existing.farmId ? farms.find(f => f.id === existing.farmId) : undefined;
    // A place equal to the farm's or the app's was filled in, not chosen: follow them again.
    const place = existing.place && !samePlace(existing.place, farm?.place) && !samePlace(existing.place, appPlace) ? existing.place : null;
    return {
      cropKey: key,
      otherName: key === 'other' ? existing.name : '',
      variety: existing.variety ?? '',
      // Onboarding stores 0 when the land question was skipped: show an empty field.
      area: existing.area > 0 ? existing.area : null,
      unit: existing.unit,
      farmId: farm ? farm.id : '',
      sowingDate: sowing,
      transplantDate: transplant,
      season,
      harvest,
      soilType: existing.soilType ?? '',
      irrigation: existing.irrigation ?? '',
      place,
      notes: existing.notes ?? '',
    };
  }
  const key = paramKey && (isCropKey(paramKey) || paramKey === 'other') ? paramKey : null;
  const farm = farms.length === 1 ? farms[0] : undefined;
  return {
    cropKey: key,
    otherName: '',
    variety: '',
    area: null,
    unit: farm?.unit ?? profile?.landUnit ?? 'acre',
    farmId: farm?.id ?? '',
    sowingDate: '',
    transplantDate: '',
    season: null,
    harvest: null,
    soilType: farm?.soilType ?? profile?.soilType ?? '',
    irrigation: farm?.irrigation ?? profile?.irrigation ?? '',
    place: farm?.place ?? null,
    notes: '',
  };
}

/** Fields of the initial form that were filled automatically (see FarmFilled). */
function initialAutoFilled(existing: Crop | undefined, initial: FormState, farms: Farm[], profile: UserProfile | null): FarmFilled[] {
  const farm = farms.find(f => f.id === initial.farmId);
  const out: FarmFilled[] = [];
  for (const k of ['soilType', 'irrigation'] as const) {
    const value = initial[k];
    if (value === '') continue;
    // In edit mode, a value equal to the current farm's came from that farm.
    if ((farm && farm[k] === value) || (!existing && profile?.[k] === value)) out.push(k);
  }
  if (!existing && farm) {
    if (initial.place && samePlace(initial.place, farm.place)) out.push('place');
    if (initial.unit === farm.unit) out.push('unit');
  }
  return out;
}

export default function CropEditScreen() {
  const t = useT();
  const { params } = useRoute<{ id?: string; cropKey?: string }>();
  const crops = useCollection<Crop>(KEYS.crops);
  const existing = params.id ? crops.items.find(c => c.id === params.id) : undefined;
  if (params.id && !existing) return <MissingCrop title={t('crops.edit.title')} />;
  return <CropForm existing={existing} paramKey={params.cropKey} />;
}

function CropForm({ existing, paramKey }: { existing?: Crop; paramKey?: string }) {
  const t = useT();
  const nav = useNav();
  const active = useIsActiveScreen();
  const { language } = useLanguage();
  const lang = language.code;
  const [profile] = useProfile();
  const [settings] = useSettings();
  const [appPlace] = usePlace();
  const cropsCol = useCollection<Crop>(KEYS.crops);
  const farms = useCollection<Farm>(KEYS.farms).items;

  const [initial] = useState(() => initialState(existing, paramKey, farms, profile, appPlace));
  const [initialJson] = useState(() => JSON.stringify(initial));
  const [form, setForm] = useState<FormState>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [focusName, setFocusName] = useState(false);
  const formRef = useRef<HTMLDivElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const [initialFilled] = useState(() => initialAutoFilled(existing, initial, farms, profile));
  const farmFilled = useRef(new Set<FarmFilled>(initialFilled));

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    if (key === 'soilType' || key === 'irrigation' || key === 'place' || key === 'unit') farmFilled.current.delete(key as FarmFilled);
    setForm(f => ({ ...f, [key]: value }));
  }, []);

  const today = todayISO();
  const minDate = addDays(today, -3 * 365);
  const maxDate = addDays(today, 183);
  const key = form.cropKey;
  const info = getCropInfo(key);
  const transplanted = !!info?.transplanted;
  const selectedFarm = farms.find(f => f.id === form.farmId);

  // ---- Season & harvest follow the dates until the farmer overrides them ----
  const seasonOptions = useMemo(
    () =>
      (info ? SEASONS.filter(s => info.seasons.includes(s)) : SEASONS).map(s => ({
        value: s,
        label: catalogText(lang, SEASON_NAMES[s].hi, SEASON_NAMES[s].en),
      })),
    [info, lang],
  );
  const sowingForCalc = form.sowingDate;
  const transplantForCalc = transplanted ? form.transplantDate : '';
  const hasDate = !!(valid(sowingForCalc) || valid(transplantForCalc));
  // Null without a date: the season is then saved only when the farmer picks a chip.
  const seasonAuto = key ? autoSeason(key, sowingForCalc, transplantForCalc) : null;
  const season = form.season && seasonOptions.some(o => o.value === form.season) ? form.season : seasonAuto;
  const harvestAuto = key
    ? expectedHarvestForCrop({ cropKey: key, sowingDate: valid(sowingForCalc), transplantDate: valid(transplantForCalc), season })
    : undefined;
  const harvestValue = form.harvest ?? harvestAuto ?? '';
  const startDate = valid(transplantForCalc) ?? valid(sowingForCalc);

  // ---- Validation ----
  const errors = useMemo<Errors>(() => {
    const e: Errors = {};
    const dateError = (d: string) => {
      if (!d) return undefined;
      if (!isValidISODate(d)) return 'crops.form.error.dateInvalid';
      if (d < minDate) return 'crops.form.error.dateOld';
      if (d > maxDate) return 'crops.form.error.dateFuture';
      return undefined;
    };
    if (!form.cropKey) e.cropKey = 'crops.form.error.crop';
    if (form.cropKey === 'other' && form.otherName.trim().length < 2) e.otherName = 'crops.form.error.name';
    if (form.area == null || !(form.area > 0)) e.area = 'crops.form.error.area';
    else if (form.area > AREA_MAX) e.area = 'crops.form.error.areaMax';
    e.sowingDate = dateError(form.sowingDate);
    if (transplanted) {
      e.transplantDate = dateError(form.transplantDate);
      const s = valid(form.sowingDate);
      const p = valid(form.transplantDate);
      if (!e.transplantDate && s && p) {
        if (p < s) e.transplantDate = 'crops.form.error.transplantBefore';
        else if (daysBetween(s, p) > 150) e.transplantDate = 'crops.form.error.transplantGap';
      }
    }
    if (form.harvest) {
      if (!isValidISODate(form.harvest)) e.harvest = 'crops.form.error.dateInvalid';
      else if (startDate && form.harvest <= startDate) e.harvest = 'crops.form.error.harvestBefore';
      else if (form.harvest > addDays(today, 730)) e.harvest = 'crops.form.error.harvestFar';
    }
    return e;
  }, [form, transplanted, startDate, minDate, maxDate, today]);
  const hasErrors = Object.values(errors).some(Boolean);
  // Dates are checked as soon as they are entered; required fields only after a save attempt.
  const err = (k: ErrorKey) => {
    const code = errors[k];
    if (!code) return undefined;
    const live = k === 'sowingDate' || k === 'transplantDate' || k === 'harvest';
    return live || submitted ? t(code) : undefined;
  };

  // ---- Leaving with unsaved changes ----
  const dirty = JSON.stringify(form) !== initialJson;
  const leave = useCallback(async () => {
    if (dirty) {
      const ok = await confirm({
        title: t('crops.form.discardTitle'),
        message: t('crops.form.discardBody'),
        confirmLabel: t('crops.form.discard'),
        cancelLabel: t('crops.form.keep'),
      });
      if (!ok) return;
    }
    nav.pop();
  }, [dirty, nav, t]);
  useBackHandler(() => void leave(), active && dirty);

  // ---- Crop choice ----
  const chooseCrop = (next: string) => {
    setForm(f => {
      if (f.cropKey === next) return f;
      const nextInfo = getCropInfo(next);
      return { ...f, cropKey: next, variety: '', season: null, harvest: null, transplantDate: nextInfo?.transplanted ? f.transplantDate : '' };
    });
    setPickerOpen(false);
    if (next === 'other') setFocusName(true);
  };
  useEffect(() => {
    if (!focusName) return;
    nameRef.current?.focus();
    setFocusName(false);
  }, [focusName]);

  // ---- Farms ----
  // Choosing a farm fills soil, irrigation and place (and the unit before an area is typed).
  // Values filled automatically follow the farm: another farm replaces them, and "no farm" (or a
  // farm without that detail) puts back the profile default, so the old farm's place or soil is
  // never left behind. What the farmer typed or chose is never replaced.
  const selectFarm = (id: string) => {
    const farm = farms.find(f => f.id === id);
    setForm(f => {
      const next: FormState = { ...f, farmId: farm ? farm.id : '' };
      const auto = farmFilled.current;
      const fill = <K extends FarmFilled>(k: K, fromFarm: FormState[K] | undefined, fallback: FormState[K]) => {
        const current = next[k];
        if (!(current === '' || current == null || auto.has(k))) return;
        if (fromFarm != null && fromFarm !== '') {
          next[k] = fromFarm;
          auto.add(k);
        } else if (auto.has(k)) {
          next[k] = fallback;
        }
      };
      fill('soilType', farm?.soilType, profile?.soilType ?? '');
      fill('irrigation', farm?.irrigation, profile?.irrigation ?? '');
      fill('place', farm?.place ?? null, null);
      if (farm && next.area == null) fill('unit', farm.unit, f.unit);
      return next;
    });
  };

  // A farm added from here (farm-edit on top of this screen) is selected on return.
  const farmIdsBefore = useRef<Set<string> | null>(null);
  const addFarm = () => {
    farmIdsBefore.current = new Set(farms.map(f => f.id));
    nav.push('farm-edit');
  };
  useEffect(() => {
    const before = farmIdsBefore.current;
    if (!before) return;
    const added = farms.find(f => !before.has(f.id));
    if (added) {
      farmIdsBefore.current = null;
      selectFarm(added.id);
    }
    // selectFarm only reads the latest farms list passed in through this effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farms]);

  // ---- Save / delete ----
  const save = () => {
    setSubmitted(true);
    if (hasErrors || !key) {
      toast.error(t('crops.form.fixErrors'), { id: 'crop-form' });
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const now = new Date().toISOString();
    const catalogKey = isCropKey(key) ? key : null;
    const keepCustomName =
      catalogKey && existing && existing.cropKey === catalogKey && existing.name && existing.name !== CROP_NAMES[catalogKey].hi && existing.name !== CROP_NAMES[catalogKey].en;
    const sowing = valid(form.sowingDate);
    const transplant = transplanted ? valid(form.transplantDate) : undefined;
    const crop: Crop = {
      id: existing?.id ?? newId('c'),
      cropKey: catalogKey ?? 'other',
      name: catalogKey ? (keepCustomName ? existing!.name : CROP_NAMES[catalogKey].hi) : form.otherName.trim(),
      variety: form.variety.trim() || undefined,
      farmId: form.farmId || undefined,
      area: form.area as number,
      unit: form.unit,
      sowingDate: sowing,
      transplantDate: transplant,
      // The farmer's pick, or the dates' season; nothing when neither exists (never today's season).
      season: season ?? undefined,
      // Only the farmer's own date: the estimate is worked out when needed, so it never goes stale.
      expectedHarvestDate: form.harvest && valid(form.harvest) && form.harvest !== harvestAuto ? form.harvest : undefined,
      soilType: form.soilType || undefined,
      irrigation: form.irrigation || undefined,
      // Only a chosen place (or the farm's). Otherwise the crop follows the app's place, so a crop
      // added before the farmer set their location does not stay on the default city.
      place: form.place ?? selectedFarm?.place ?? undefined,
      notes: form.notes.trim() || undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    cropsCol.upsert(crop);
    syncCropTasks(crop);
    const hasDate = !!(sowing || transplant);
    if (existing) {
      toast.success(t('crops.form.updated'));
      nav.pop();
    } else {
      track('crop_added', { crop: crop.cropKey, hasDate, withFarm: !!crop.farmId });
      toast.success(t(hasDate ? 'crops.form.saved' : 'crops.form.savedNoDate'));
      nav.replace('crop-detail', { id: crop.id });
    }
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirm({ title: t('crops.form.deleteTitle'), message: t('crops.form.deleteBody'), tone: 'danger', icon: Trash2 });
    if (!ok) return;
    // Leave every screen of the deleted crop (details, advice, this form), not just this one.
    const n = Math.max(1, cropRoutesOnTop(nav.stack, existing.id));
    removeCropTasks(existing.id);
    cropsCol.remove(existing.id);
    toast(t('crops.form.deleted'));
    for (let i = 0; i < n; i++) nav.pop();
  };

  // ---- View ----
  const showPicker = !key || pickerOpen;
  const name = key === 'other' ? form.otherName.trim() || t('crops.form.other') : key ? cropLabel({ cropKey: key, name: '' }, lang) : '';
  const varieties = info ? catalogVarieties(info, lang) : [];
  const shownPlace = form.place ?? selectedFarm?.place ?? appPlace;
  const bighaAcres = formatNumber(settings.bighaSqm / 4046.86, 2);

  return (
    <Screen
      title={existing ? t('crops.edit.title') : t('crops.add.title')}
      subtitle={existing ? cropLabel(existing, lang) : t('crops.add.subtitle')}
      back={leave}
      footer={
        key ? (
          <Button fullWidth size="lg" icon={Check} onClick={save}>
            {existing ? t('crops.form.saveChanges') : t('crops.form.save')}
          </Button>
        ) : undefined
      }
    >
      <div ref={formRef} className="flex flex-col gap-5">
        {/* Crop */}
        <Card as="section">
          {showPicker ? (
            <div className="flex flex-col gap-3">
              <CropPicker
                searchable
                value={key && isCropKey(key) ? key : null}
                onChange={chooseCrop}
                label={t('crops.form.whichCrop')}
                hint={t('crops.form.whichCropHint')}
                error={err('cropKey')}
              />
              <ListRow
                leading={<ToneIcon icon={Sprout} tone="gray" />}
                title={t('crops.form.other')}
                subtitle={t('crops.form.otherHint')}
                trailing={key === 'other' ? <Check aria-hidden className="size-6 text-brand" strokeWidth={2.5} /> : undefined}
                chevron={key !== 'other'}
                onPress={() => chooseCrop('other')}
              />
              {key ? (
                <Button variant="ghost" onClick={() => setPickerOpen(false)}>
                  {t('crops.form.keepCrop')}
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <CropArt crop={key} size={56} />
                <div className="min-w-0 flex-1">
                  <p className="text-caption text-ink-2">{t('crops.form.whichCrop')}</p>
                  <p className="text-card-title leading-snug font-semibold text-ink">{name}</p>
                </div>
                <Button variant="secondary" icon={Pencil} onClick={() => setPickerOpen(true)} aria-label={t('crops.form.changeCrop')}>
                  {t('crops.form.change')}
                </Button>
              </div>
              {key === 'other' ? (
                <TextField
                  ref={nameRef}
                  label={t('crops.form.otherName')}
                  value={form.otherName}
                  onValueChange={v => set('otherName', v)}
                  placeholder={t('crops.form.otherNamePh')}
                  maxLength={40}
                  error={err('otherName')}
                  trailing={<MicButton variant="ghost" onResult={txt => set('otherName', txt.slice(0, 40))} />}
                />
              ) : null}
            </div>
          )}
        </Card>

        {key ? (
          <>
            {/* Crop and land */}
            <Card as="section" className="flex flex-col gap-4">
              <SectionHeader title={t('crops.form.section.basic')} />
              <div className="flex flex-col gap-2">
                <TextField
                  label={t('crops.form.variety')}
                  optional
                  value={form.variety}
                  onValueChange={v => set('variety', v)}
                  placeholder={t('crops.form.varietyPh')}
                  hint={t('crops.form.varietyHint')}
                  maxLength={60}
                />
                {varieties.length ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-caption text-ink-2">{t('crops.form.varietyChips')}</p>
                    <div className="flex flex-wrap gap-2">
                      {varieties.map(v => (
                        <Chip key={v} label={v} selected={form.variety === v} onClick={() => set('variety', form.variety === v ? '' : v)} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <NumberField
                  label={t('crops.form.area')}
                  value={form.area}
                  onChange={v => set('area', v)}
                  min={0}
                  step={0.5}
                  stepper
                  unit={t(`common.${form.unit}`)}
                  error={err('area')}
                  hint={form.unit === 'bigha' ? t('crops.form.bighaHint', { n: bighaAcres }) : undefined}
                />
                <ChipGroup
                  ariaLabel={t('crops.form.unit')}
                  wrap
                  value={form.unit}
                  onChange={u => set('unit', u as AreaUnit)}
                  options={AREA_UNITS.map(u => ({ value: u, label: t(`common.${u}`) }))}
                />
              </div>

              {farms.length ? (
                <div className="flex flex-col gap-2">
                  <SelectField
                    label={t('crops.form.farm')}
                    optional
                    value={form.farmId || 'none'}
                    onChange={selectFarm}
                    options={[...farms.map(f => ({ value: f.id, label: f.name })), { value: 'none', label: t('crops.form.noFarm') }]}
                    hint={t('crops.form.farmHint')}
                  />
                  <Button variant="ghost" icon={Plus} onClick={addFarm} className="self-start">
                    {t('crops.form.newFarm')}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-small font-semibold text-ink">
                    {t('crops.form.farm')} <span className="font-normal text-ink-3">({t('common.optional')})</span>
                  </p>
                  <p className="text-caption text-ink-2">{t('crops.form.noFarmsYet')}</p>
                  <Button variant="secondary" icon={Plus} onClick={addFarm} className="self-start">
                    {t('crops.form.newFarm')}
                  </Button>
                </div>
              )}
            </Card>

            {/* Dates */}
            <Card as="section" className="flex flex-col gap-4">
              <SectionHeader title={t('crops.form.section.dates')} />
              {transplanted ? (
                <>
                  <DateField
                    label={t('crops.form.transplantDate')}
                    optional
                    value={form.transplantDate}
                    onChange={v => set('transplantDate', v)}
                    min={minDate}
                    max={maxDate}
                    hint={t('crops.form.transplantHint')}
                    error={err('transplantDate')}
                  />
                  <DateField
                    label={t('crops.form.nurseryDate')}
                    optional
                    value={form.sowingDate}
                    onChange={v => set('sowingDate', v)}
                    min={minDate}
                    max={maxDate}
                    hint={t('crops.form.nurseryHint')}
                    error={err('sowingDate')}
                  />
                </>
              ) : (
                <DateField
                  label={t('crops.form.sowingDate')}
                  optional
                  value={form.sowingDate}
                  onChange={v => set('sowingDate', v)}
                  min={minDate}
                  max={maxDate}
                  hint={t('crops.form.sowingHint')}
                  error={err('sowingDate')}
                />
              )}

              <div className="flex flex-col gap-1.5">
                <p className="text-small font-semibold text-ink">{t('crops.form.season')}</p>
                <ChipGroup<string> ariaLabel={t('crops.form.season')} wrap value={season ?? ''} onChange={s => set('season', s as Season)} options={seasonOptions} />
                <p className="text-caption text-ink-2">
                  {form.season ? t('crops.form.seasonManual') : hasDate ? t('crops.form.seasonAuto') : t('crops.form.seasonNoDate')}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <DateField
                  label={t('crops.form.harvest')}
                  optional
                  value={harvestValue}
                  onChange={v => set('harvest', v || null)}
                  min={startDate}
                  max={addDays(today, 730)}
                  hint={harvestAuto ? t('crops.form.harvestAuto') : t('crops.form.harvestNeedsDate')}
                  error={err('harvest')}
                />
                {form.harvest && harvestAuto && form.harvest !== harvestAuto ? (
                  <Button variant="ghost" className="self-start" onClick={() => set('harvest', null)}>
                    {t('crops.form.harvestReset', { date: formatDate(harvestAuto) })}
                  </Button>
                ) : null}
              </div>
            </Card>

            {/* Field */}
            <Card as="section" className="flex flex-col gap-4">
              <SectionHeader title={t('crops.form.section.field')} />
              <SelectField
                label={t('crops.form.soil')}
                optional
                value={form.soilType}
                onChange={v => set('soilType', v as SoilType)}
                options={SOIL_TYPES.map(s => ({ value: s, label: t(`crops.soil.${s}`) }))}
              />
              <SelectField
                label={t('crops.form.irrigation')}
                optional
                value={form.irrigation}
                onChange={v => set('irrigation', v as IrrigationType)}
                options={IRRIGATION_TYPES.map(s => ({ value: s, label: t(`crops.irrigation.${s}`) }))}
              />
              <div className="flex flex-col gap-1.5">
                <p className="text-small font-semibold text-ink">{t('crops.form.location')}</p>
                <ListRow
                  leading={<ToneIcon icon={MapPin} tone="green" size="sm" />}
                  title={placeLabel(shownPlace)}
                  subtitle={!form.place && !selectedFarm?.place ? t('crops.form.locationApp') : undefined}
                  ariaLabel={`${t('crops.form.changeLocation')}: ${placeLabel(shownPlace)}`}
                  onPress={() => setPlaceOpen(true)}
                />
                <p className="text-caption text-ink-2">{t('crops.form.locationHint')}</p>
              </div>
            </Card>

            <Card as="section">
              <TextArea
                label={t('crops.form.notes')}
                optional
                value={form.notes}
                onChange={v => set('notes', v)}
                maxLength={NOTES_MAX}
                placeholder={t('crops.form.notesPh')}
                trailing={
                  <MicButton
                    variant="ghost"
                    onResult={txt => setForm(f => ({ ...f, notes: (f.notes ? `${f.notes} ${txt}` : txt).slice(0, NOTES_MAX) }))}
                  />
                }
              />
            </Card>

            {existing ? (
              <Button variant="danger" fullWidth icon={Trash2} onClick={remove}>
                {t('crops.form.delete')}
              </Button>
            ) : null}
          </>
        ) : null}
      </div>

      <LocationSheet
        open={placeOpen}
        onClose={() => setPlaceOpen(false)}
        setAsCurrent={false}
        title={t('crops.form.locationTitle')}
        onSelect={p => set('place', p)}
      />
    </Screen>
  );
}

function catalogVarieties(info: NonNullable<ReturnType<typeof getCropInfo>>, lang: string): string[] {
  return lang === 'en' ? info.commonVarietiesEn : info.commonVarietiesHi;
}
