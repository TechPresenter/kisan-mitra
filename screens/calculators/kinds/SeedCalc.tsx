// बीज कैलकुलेटर: crop → per-acre seed rate (catalog, editable) × land → kg of seed (min–max).
import { useMemo, useState } from 'react';
import { Sprout } from 'lucide-react';
import { Callout, Card, Disclaimer, NumberField, RadioCards } from '../../../components/ui';
import { catalogText, getCropInfo } from '../../../data/crops';
import { templatesFor } from '../../../data/task-templates';
import { useSettings, getProfile } from '../../../lib/app-state';
import { useLanguage, useT } from '../../../lib/i18n';
import { seedNeed } from '../calc-math';
import {
  AreaField,
  Bullets,
  CropSelect,
  HowItWorks,
  ResultCard,
  acresOf,
  areaText,
  defaultArea,
  fmtKgRange,
  num,
  useTrackOnce,
  type AreaValue,
} from '../parts';

const RANGE = 'range';
const round = (n: number) => Math.round(n * 1000) / 1000;

/** Rate fields for a crop: in grams per acre for nursery crops (< 1 kg/acre), else kg. */
function ratesFor(cropKey: string | null, option: string) {
  const info = getCropInfo(cropKey);
  if (!info) return null;
  const grams = info.seedRateKgPerAcre.max < 1;
  const f = grams ? 1000 : 1;
  const idx = Number(option);
  const r = option !== RANGE && info.seedOptions?.[idx] ? info.seedOptions[idx] : info.seedRateKgPerAcre;
  return { grams, min: round(r.min * f), max: round(r.max * f) };
}

function firstProfileCrop(): string | null {
  const key = getProfile()?.cropKeys?.find(k => !!getCropInfo(k));
  return key ?? null;
}

export default function SeedCalc() {
  const t = useT();
  const { language } = useLanguage();
  const lang = language.code;
  const [settings] = useSettings();

  // Start from the farmer's first catalog crop (onboarding), with its usual seed rate.
  const [init] = useState(() => {
    const key = firstProfileCrop();
    const opt = getCropInfo(key)?.seedOptions?.length ? '0' : RANGE;
    return { key, opt, rates: ratesFor(key, opt) };
  });
  const [cropKey, setCropKey] = useState<string | null>(init.key);
  const info = getCropInfo(cropKey);
  const [option, setOption] = useState<string>(init.opt);
  const [grams, setGrams] = useState(init.rates?.grams ?? false);
  const [rateMin, setRateMin] = useState<number | null>(init.rates?.min ?? null);
  const [rateMax, setRateMax] = useState<number | null>(init.rates?.max ?? null);
  const [area, setArea] = useState<AreaValue>(defaultArea);

  const apply = (key: string | null, opt: string) => {
    const r = ratesFor(key, opt);
    if (!r) return;
    setGrams(r.grams);
    setRateMin(r.min);
    setRateMax(r.max);
  };

  const pickCrop = (key: string) => {
    setCropKey(key);
    const opt = getCropInfo(key)?.seedOptions?.length ? '0' : RANGE;
    setOption(opt);
    apply(key, opt);
  };

  const pickOption = (opt: string) => {
    setOption(opt);
    apply(cropKey, opt);
  };

  const f = grams ? 1000 : 1;
  const acres = acresOf(area, settings.bighaSqm);
  // A single filled rate counts for both ends.
  const lo = rateMin ?? rateMax;
  const hi = rateMax ?? rateMin;
  const need = acres != null && lo != null && hi != null ? seedNeed(acres, lo / f, hi / f) : null;
  const edit = useTrackOnce('seed', !!need);

  const treatment = useMemo(() => {
    if (!cropKey) return null;
    const tpl = templatesFor(cropKey).find(x => x.type === 'seed-treatment');
    return tpl ? (lang === 'en' ? tpl.descEn : tpl.descHi) : null;
  }, [cropKey, lang]);

  const unit = grams ? t('calc.unit.gPerAcre') : t('calc.unit.perAcre');
  const catalogNote = info?.seedRateKgPerAcre.noteHi
    ? catalogText(lang, info.seedRateKgPerAcre.noteHi, info.seedRateKgPerAcre.noteEn ?? info.seedRateKgPerAcre.noteHi)
    : null;
  const perAcreKg = lo != null && hi != null ? fmtKgRange(t, Math.min(lo, hi) / f, Math.max(lo, hi) / f) : '';

  return (
    <>
      <Card className="flex flex-col gap-4">
        <CropSelect value={cropKey} onChange={edit(pickCrop)} />

        {info?.seedOptions && info.seedOptions.length > 0 && (
          <RadioCards
            label={t('calc.seed.option')}
            value={option}
            onChange={edit(pickOption)}
            options={info.seedOptions.map((o, i) => ({
              value: String(i),
              label: lang === 'en' ? o.labelEn : o.labelHi,
              description: t('calc.seed.perAcre', { range: fmtKgRange(t, o.min, o.max) }),
            }))}
          />
        )}

        <div className="grid grid-cols-2 items-start gap-3">
          <NumberField
            label={t('calc.seed.rateMin')}
            value={rateMin}
            onChange={edit(setRateMin)}
            unit={unit}
            min={0}
            max={grams ? 100_000 : 10_000}
            error={rateMin === 0 ? t('calc.seed.rateError') : undefined}
          />
          <NumberField
            label={t('calc.seed.rateMax')}
            value={rateMax}
            onChange={edit(setRateMax)}
            unit={unit}
            min={0}
            max={grams ? 100_000 : 10_000}
            error={rateMax === 0 ? t('calc.seed.rateError') : undefined}
          />
        </div>
        <p className="-mt-2 text-caption text-ink-2">
          {catalogNote ? t('calc.seed.catalogNote', { note: catalogNote }) : t('calc.seed.rateHint')}
        </p>

        <AreaField value={area} onChange={edit(setArea)} error={area.value === 0 ? t('calc.area.error') : undefined} />
      </Card>

      <ResultCard
        label={t('calc.seed.result')}
        ready={!!need}
        value={need ? fmtKgRange(t, need.min, need.max) : undefined}
        sub={need ? t('calc.seed.forArea', { area: areaText(t, area) }) : undefined}
      >
        {need && <p>{t('calc.seed.perAcre', { range: perAcreKg })}</p>}
      </ResultCard>

      <Callout tone="brand" icon={Sprout} title={t('calc.seed.treatTitle')}>
        <Bullets items={[treatment ?? t('calc.seed.treatGeneric'), t('calc.seed.germination')]} className="mt-1" />
      </Callout>

      <HowItWorks
        steps={[
          need && area.unit !== 'acre' && t('calc.seed.howArea', { area: areaText(t, area), acres: num(acres!, 3) }),
          need &&
            t('calc.seed.howCalc', {
              acres: num(acres!, 3),
              rate: perAcreKg,
              total: fmtKgRange(t, need.min, need.max),
            }),
          t('calc.seed.howSource'),
        ]}
      />

      <Disclaimer>{t('calc.listNote')}</Disclaimer>
    </>
  );
}
