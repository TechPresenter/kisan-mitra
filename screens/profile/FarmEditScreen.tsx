// Add / edit a farm ('farm-edit', { id? }): name, place, area + unit, soil type and irrigation.
// Deleting is allowed only when no crop is linked to the farm.
import './strings';
import { useMemo, useState } from 'react';
import { Info, MapPin, Trash2 } from 'lucide-react';
import {
  Button,
  Callout,
  EmptyState,
  ListRow,
  MicButton,
  NumberField,
  SegmentedTabs,
  SelectField,
  Screen,
  TextField,
  ToneIcon,
  confirm,
  toast,
} from '../../components/ui';
import { EmptyArt } from '../../components/illustrations';
import { LocationSheet } from '../../components/shared/LocationSheet';
import { placeLabel, usePlace, useProfile, useSettings } from '../../lib/app-state';
import { formatNumber } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { useNav, useRoute } from '../../lib/nav';
import { KEYS, newId, useCollection } from '../../lib/store';
import type { AreaUnit, Crop, Farm, GeoPlace, IrrigationType, SoilType } from '../../types/models';
import { AREA_UNITS, IRRIGATION_TYPES, SOIL_TYPES, syncProfileLand, unitLabel } from './helpers';

export default function FarmEditScreen() {
  const t = useT();
  const nav = useNav();
  const { params } = useRoute<{ id?: string }>();
  const farmsCol = useCollection<Farm>(KEYS.farms);
  const crops = useCollection<Crop>(KEYS.crops).items;
  const [profile] = useProfile();
  const [currentPlace] = usePlace();
  const [settings] = useSettings();

  const existing = params.id ? farmsCol.get(params.id) : undefined;
  const isNew = !params.id;
  // The very first farm starts from what the farmer told us during onboarding.
  const prefill = isNew && farmsCol.items.length === 0 && !!(profile?.landArea || profile?.soilType || profile?.irrigation);

  const [name, setName] = useState(() => existing?.name ?? t('profile.farms.defaultName', { n: farmsCol.items.length + 1 }));
  const [place, setPlace] = useState<GeoPlace | undefined>(() => (existing ? existing.place : currentPlace));
  // 0 means "not entered" (onboarding when the land question was skipped): start empty.
  const [area, setArea] = useState<number | null>(() =>
    existing ? (existing.area > 0 ? existing.area : null) : prefill ? profile?.landArea ?? null : null,
  );
  const [unit, setUnit] = useState<AreaUnit>(() => existing?.unit ?? (prefill ? profile?.landUnit : undefined) ?? 'acre');
  const [soil, setSoil] = useState<string>(() => existing?.soilType ?? (prefill ? profile?.soilType : undefined) ?? '');
  const [irrigation, setIrrigation] = useState<string>(() => existing?.irrigation ?? (prefill ? profile?.irrigation : undefined) ?? '');
  const [errors, setErrors] = useState<{ name?: string; area?: string }>({});
  const [placeOpen, setPlaceOpen] = useState(false);

  const soilOptions = useMemo(() => SOIL_TYPES.map(s => ({ value: s, label: t(`profile.soil.${s}`) })), [t]);
  const irrigationOptions = useMemo(() => IRRIGATION_TYPES.map(i => ({ value: i, label: t(`profile.irrigation.${i}`) })), [t]);
  const linkedCrops = useMemo(() => (existing ? crops.filter(c => c.farmId === existing.id).length : 0), [crops, existing]);

  if (params.id && !existing) {
    return (
      <Screen title={t('profile.farms.editTitle')}>
        <EmptyState
          art={<EmptyArt kind="search" />}
          title={t('profile.farms.notFound')}
          body={t('profile.farms.notFoundBody')}
          action={{ label: t('profile.farms.backToList'), onPress: () => nav.replace('farms') }}
        />
      </Screen>
    );
  }

  const save = () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('profile.farms.error.name');
    if (!area || area <= 0) next.area = t('profile.farms.error.area');
    setErrors(next);
    if (next.name || next.area) return;

    const farm: Farm = {
      id: existing?.id ?? newId('f'),
      name: name.trim(),
      place,
      area: area!,
      unit,
      // "पता नहीं" is stored as not set, the same way onboarding stores it.
      soilType: soil && soil !== 'unknown' ? (soil as SoilType) : undefined,
      irrigation: (irrigation || undefined) as IrrigationType | undefined,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    farmsCol.upsert(farm);
    syncProfileLand();
    toast.success(t('profile.farms.saved'));
    nav.pop();
  };

  const remove = async () => {
    if (!existing) return;
    if (linkedCrops > 0) {
      const openCrops = await confirm({
        title: t('profile.farms.blockedTitle'),
        message: t(linkedCrops === 1 ? 'profile.farms.blockedBody' : 'profile.farms.blockedBodyMany', { n: linkedCrops }),
        confirmLabel: t('profile.menu.crops'),
        cancelLabel: t('common.close'),
        icon: Info,
      });
      if (openCrops) nav.push('crops');
      return;
    }
    const ok = await confirm({
      title: t('common.confirmDelete'),
      message: t('profile.farms.deleteBody', { name: existing.name }),
      tone: 'danger',
      icon: Trash2,
    });
    if (!ok) return;
    // Leave first so this screen never flashes its "farm not found" state.
    nav.pop();
    farmsCol.remove(existing.id);
    syncProfileLand();
    toast(t('profile.farms.deleted'));
  };

  return (
    <Screen
      title={isNew ? t('profile.farms.newTitle') : t('profile.farms.editTitle')}
      subtitle={existing?.name}
      actions={existing ? [{ icon: Trash2, label: t('profile.farms.delete'), onPress: remove }] : undefined}
      footer={
        <Button fullWidth size="lg" onClick={save}>
          {t('common.save')}
        </Button>
      }
    >
      {prefill && <Callout tone="info">{t('profile.farms.prefilled')}</Callout>}

      <TextField
        label={t('profile.farms.field.name')}
        value={name}
        onValueChange={v => {
          setName(v);
          if (errors.name) setErrors(e => ({ ...e, name: undefined }));
        }}
        placeholder={t('profile.farms.field.namePlaceholder')}
        maxLength={40}
        error={errors.name}
        trailing={<MicButton size="sm" variant="ghost" onResult={text => setName(text)} />}
      />

      <div className="flex flex-col gap-1.5">
        <p id="farm-place-label" className="text-small font-semibold text-ink">
          {t('profile.farms.field.place')}
        </p>
        <ListRow
          leading={<ToneIcon icon={MapPin} tone="green" size="sm" />}
          title={place ? place.name : t('profile.farms.field.placeChoose')}
          subtitle={place ? [place.district !== place.name ? place.district : null, place.state].filter(Boolean).join(', ') || undefined : undefined}
          ariaLabel={t('profile.farms.field.placeAria', { place: place ? placeLabel(place) : t('profile.farms.noPlace') })}
          chevron
          onPress={() => setPlaceOpen(true)}
        />
        <p className="text-caption text-ink-2">{t('profile.farms.field.placeHint')}</p>
      </div>

      <div className="flex flex-col gap-2">
        <NumberField
          label={t('profile.farms.field.area')}
          value={area}
          onChange={v => {
            setArea(v);
            if (errors.area) setErrors(e => ({ ...e, area: undefined }));
          }}
          min={0}
          max={100000}
          step={0.5}
          unit={unitLabel(t, unit)}
          stepper
          error={errors.area}
          hint={unit === 'bigha' ? t('profile.farms.bighaHint', { sqm: formatNumber(settings.bighaSqm, 0) }) : undefined}
        />
        <SegmentedTabs
          ariaLabel={t('profile.field.unit')}
          size="sm"
          value={unit}
          onChange={setUnit}
          options={AREA_UNITS.map(u => ({ value: u, label: unitLabel(t, u) }))}
        />
      </div>

      <SelectField label={t('profile.farms.field.soil')} optional value={soil} onChange={setSoil} options={soilOptions} />
      <SelectField
        label={t('profile.farms.field.irrigation')}
        optional
        value={irrigation}
        onChange={setIrrigation}
        options={irrigationOptions}
      />

      <LocationSheet
        open={placeOpen}
        onClose={() => setPlaceOpen(false)}
        setAsCurrent={false}
        title={t('profile.farms.placeSheet')}
        onSelect={setPlace}
      />
    </Screen>
  );
}
