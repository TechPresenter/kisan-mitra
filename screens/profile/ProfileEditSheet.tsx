// "प्रोफाइल बदलें" sheet: name, phone, village, district, state, farming method and land.
import './strings';
import { useEffect, useMemo, useState } from 'react';
import { Leaf, Shuffle, Sprout, Tractor } from 'lucide-react';
import {
  Button,
  Card,
  MicButton,
  NumberField,
  RadioCards,
  SegmentedTabs,
  SelectField,
  Sheet,
  TextField,
  toast,
  type RadioCardOption,
} from '../../components/ui';
import { useProfile, useSettings } from '../../lib/app-state';
import { useLanguage, useT } from '../../lib/i18n';
import { useNav } from '../../lib/nav';
import { KEYS, useCollection } from '../../lib/store';
import { INDIAN_STATES, findState } from '../../services/location';
import type { AreaUnit, Farm, FarmingType } from '../../types/models';
import { AREA_UNITS, farmsLand, formatArea, unitLabel } from './helpers';

export interface ProfileEditSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Digits of a typed, pasted or autofilled number. The +91 / 0 prefixes are dropped, so
 * "+91 98765 43210" and "09876543210" both become "9876543210"; an extra digit typed at the end
 * of a full number is ignored.
 */
const normalizePhone = (p?: string) => {
  let d = (p || '').replace(/\D/g, '');
  if (d.length > 10) d = d.replace(/^0+/, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  return d.slice(0, 10);
};
const PHONE_RE = /^[6-9]\d{9}$/;
/** SelectField option that clears the state (its empty placeholder cannot be picked again). */
const NO_STATE = 'none';

const FARMING_ICONS: Record<FarmingType, { icon: typeof Tractor; tone: RadioCardOption['tone'] }> = {
  conventional: { icon: Tractor, tone: 'orange' },
  organic: { icon: Leaf, tone: 'green' },
  natural: { icon: Sprout, tone: 'teal' },
  mixed: { icon: Shuffle, tone: 'indigo' },
};

export function ProfileEditSheet({ open, onClose }: ProfileEditSheetProps) {
  const t = useT();
  const { language } = useLanguage();
  const nav = useNav();
  const [profile, updateProfile] = useProfile();
  const [settings] = useSettings();
  const farms = useCollection<Farm>(KEYS.farms).items;
  // Once farms exist, land is edited per farm (they are the one source; see syncProfileLand).
  const hasFarms = farms.length > 0;
  const farmTotal = useMemo(() => farmsLand(farms, settings.bighaSqm), [farms, settings.bighaSqm]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState('');
  const [district, setDistrict] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [farmingType, setFarmingType] = useState<FarmingType | null>(null);
  const [land, setLand] = useState<number | null>(null);
  const [unit, setUnit] = useState<AreaUnit>('acre');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  // Fresh draft every time the sheet opens.
  useEffect(() => {
    if (!open) return;
    setName(profile?.name || '');
    setPhone(normalizePhone(profile?.phone));
    setVillage(profile?.village || '');
    setDistrict(profile?.district || '');
    setStateCode(findState(profile?.state)?.code || '');
    setFarmingType(profile?.farmingType || null);
    setLand(profile?.landArea ?? null);
    setUnit(profile?.landUnit || 'acre');
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const stateOptions = useMemo(
    () => [
      { value: NO_STATE, label: t('profile.field.stateNone') },
      ...INDIAN_STATES.map(s => ({ value: s.code, label: language.code === 'en' ? s.nameEn : s.name })),
    ],
    [language.code, t],
  );

  const farmingOptions = useMemo<RadioCardOption<FarmingType>[]>(
    () =>
      (Object.keys(FARMING_ICONS) as FarmingType[]).map(ft => ({
        value: ft,
        label: t(`profile.farmingType.${ft}`),
        description: t(`profile.farmingType.${ft}Desc`),
        icon: FARMING_ICONS[ft].icon,
        tone: FARMING_ICONS[ft].tone,
      })),
    [t],
  );

  const save = () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('profile.error.name');
    if (phone && !PHONE_RE.test(phone)) next.phone = t('profile.field.phoneError');
    setErrors(next);
    if (next.name || next.phone) return;

    const st = INDIAN_STATES.find(s => s.code === stateCode);
    updateProfile({
      name: name.trim(),
      phone: phone || undefined,
      village: village.trim() || undefined,
      district: district.trim() || undefined,
      // '' = untouched and not a state we recognise: keep what was stored.
      state: st ? st.name : stateCode === NO_STATE ? undefined : profile?.state,
      farmingType: farmingType || undefined,
      ...(hasFarms
        ? {}
        : { landArea: land && land > 0 ? land : undefined, landUnit: land && land > 0 ? unit : profile?.landUnit }),
    });
    toast.success(t('profile.saved'));
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="tall"
      title={t('profile.edit')}
      description={t('profile.editSheet.desc')}
      footer={
        <Button fullWidth size="lg" onClick={save}>
          {t('common.save')}
        </Button>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        <TextField
          label={t('profile.field.name')}
          value={name}
          onValueChange={v => {
            setName(v);
            if (errors.name) setErrors(e => ({ ...e, name: undefined }));
          }}
          placeholder={t('profile.field.namePlaceholder')}
          autoComplete="name"
          maxLength={60}
          error={errors.name}
          trailing={<MicButton size="sm" variant="ghost" onResult={text => setName(text)} />}
        />
        <TextField
          label={t('profile.field.phone')}
          optional
          value={phone}
          onValueChange={v => {
            setPhone(normalizePhone(v));
            if (errors.phone) setErrors(e => ({ ...e, phone: undefined }));
          }}
          inputMode="tel"
          autoComplete="tel-national"
          prefix="+91"
          maxLength={16}
          error={errors.phone}
        />
        {profile?.email && (
          <TextField label={t('profile.field.email')} value={profile.email} readOnly disabled />
        )}
        <TextField
          label={t('profile.field.village')}
          optional
          value={village}
          onValueChange={setVillage}
          placeholder={t('profile.field.villagePlaceholder')}
          maxLength={60}
          trailing={<MicButton size="sm" variant="ghost" onResult={setVillage} />}
        />
        <TextField
          label={t('profile.field.district')}
          optional
          value={district}
          onValueChange={setDistrict}
          placeholder={t('profile.field.districtPlaceholder')}
          maxLength={60}
          trailing={<MicButton size="sm" variant="ghost" onResult={setDistrict} />}
        />
        <SelectField label={t('profile.field.state')} optional value={stateCode} onChange={setStateCode} options={stateOptions} />
        <RadioCards
          label={t('profile.field.farmingType')}
          columns={2}
          value={farmingType}
          onChange={v => setFarmingType(v)}
          options={farmingOptions}
        />
        {hasFarms ? (
          <Card as="section" aria-labelledby="profile-land-total" className="flex flex-col gap-2">
            <p id="profile-land-total" className="text-small font-semibold text-ink">
              {t('profile.field.landFarms')}
            </p>
            <p className="text-card-title font-bold text-ink">
              {farmTotal ? formatArea(t, farmTotal.area, farmTotal.unit) : t('profile.farms.noArea')}
            </p>
            <p className="text-small text-ink-2">{t('profile.field.landFarmsHint', { n: farms.length })}</p>
            <Button
              variant="secondary"
              fullWidth
              icon={Tractor}
              onClick={() => {
                onClose();
                nav.push('farms');
              }}
            >
              {t('profile.field.landFarmsEdit')}
            </Button>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            <NumberField
              label={t('profile.field.land')}
              optional
              value={land}
              onChange={setLand}
              min={0}
              max={100000}
              step={0.5}
              unit={unitLabel(t, unit)}
            />
            <SegmentedTabs
              ariaLabel={t('profile.field.unit')}
              size="sm"
              value={unit}
              onChange={setUnit}
              options={AREA_UNITS.map(u => ({ value: u, label: unitLabel(t, u) }))}
            />
          </div>
        )}
      </div>
    </Sheet>
  );
}

export default ProfileEditSheet;
