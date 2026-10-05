// खाद कैलकुलेटर: N/P/K need per acre (catalog or soil-test values) × land → urea, DAP and MOP.
import { useState } from 'react';
import { FlaskConical, TestTube } from 'lucide-react';
import { Button, Callout, Card, Disclaimer, NumberField, SegmentedTabs } from '../../../components/ui';
import { catalogText, getCropInfo, npkPerAcre } from '../../../data/crops';
import { SQM_PER_ACRE, SQM_PER_HECTARE } from '../../../data/units';
import { getProfile, useSettings } from '../../../lib/app-state';
import { useLanguage, useT } from '../../../lib/i18n';
import { useNav } from '../../../lib/nav';
import { BAG_KG, fertilizerPlan, type NPK } from '../calc-math';
import {
  AreaField,
  CropSelect,
  HowItWorks,
  ResultCard,
  acresOf,
  defaultArea,
  fmtKg,
  num,
  useTrackOnce,
  type AreaValue,
} from '../parts';

type Mode = 'crop' | 'custom';
/** Nutrient amounts (N, P₂O₅, K₂O), per acre or per hectare as `Basis` says. */
type Custom = { n: number | null; p: number | null; k: number | null };
/** Soil Health Card doses are usually printed per hectare. */
type Basis = 'acre' | 'hectare';

const ACRES_PER_HECTARE = SQM_PER_HECTARE / SQM_PER_ACRE; // 2.471
const round1 = (n: number) => Math.round(n * 10) / 10;
const scale = (c: Custom, f: number): Custom => ({
  n: c.n == null ? null : round1(c.n * f),
  p: c.p == null ? null : round1(c.p * f),
  k: c.k == null ? null : round1(c.k * f),
});

function firstProfileCrop(): string | null {
  return getProfile()?.cropKeys?.find(k => !!getCropInfo(k)) ?? null;
}

export default function FertilizerCalc() {
  const t = useT();
  const nav = useNav();
  const { language } = useLanguage();
  const lang = language.code;
  const [settings] = useSettings();

  const [cropKey, setCropKey] = useState<string | null>(firstProfileCrop);
  const [mode, setMode] = useState<Mode>('crop');
  const [custom, setCustom] = useState<Custom>({ n: null, p: null, k: null });
  const [basis, setBasis] = useState<Basis>('acre');
  const [area, setArea] = useState<AreaValue>(defaultArea);

  const info = getCropInfo(cropKey);
  const cropNeed = info ? npkPerAcre(info) : null;
  const customFilled = (custom.n ?? 0) + (custom.p ?? 0) + (custom.k ?? 0) > 0;
  // The plan always works per acre; per-hectare card values are divided by 2.471.
  const perAcreOf = (v: number | null) => (v ?? 0) / (basis === 'hectare' ? ACRES_PER_HECTARE : 1);
  const need: NPK | null =
    mode === 'crop' ? cropNeed : customFilled ? { n: perAcreOf(custom.n), p: perAcreOf(custom.p), k: perAcreOf(custom.k) } : null;
  const acres = acresOf(area, settings.bighaSqm);
  const plan = need && acres != null ? fertilizerPlan(need, acres) : null;
  const edit = useTrackOnce('fertilizer', !!plan);

  const switchMode = (m: Mode) => {
    // Start "my own dose" from the crop's general dose, so the farmer only edits what differs.
    if (m === 'custom' && !customFilled && cropNeed) setCustom(basis === 'hectare' ? scale(cropNeed, ACRES_PER_HECTARE) : { ...cropNeed });
    setMode(m);
  };

  // Switching the unit converts the numbers, so the same dose never silently becomes 2.5x bigger.
  const switchBasis = (b: Basis) => {
    if (b === basis) return;
    setCustom(c => scale(c, b === 'hectare' ? ACRES_PER_HECTARE : 1 / ACRES_PER_HECTARE));
    setBasis(b);
  };

  const rows = plan
    ? ([
        { key: 'urea', name: t('calc.fert.urea'), kg: plan.total.urea, bags: plan.bags.urea, size: BAG_KG.urea },
        { key: 'dap', name: t('calc.fert.dap'), kg: plan.total.dap, bags: plan.bags.dap, size: BAG_KG.dap },
        { key: 'mop', name: t('calc.fert.mop'), kg: plan.total.mop, bags: plan.bags.mop, size: BAG_KG.mop },
      ] as const)
    : [];

  const splitNote =
    mode === 'crop' && info?.npkNoteHi ? catalogText(lang, info.npkNoteHi, info.npkNoteEn ?? info.npkNoteHi) : t('calc.fert.splitGeneric');

  const kgPerAcre = t('calc.unit.perAcre');
  const kgPerHa = t('calc.unit.perHa');
  const basisUnit = basis === 'hectare' ? kgPerHa : kgPerAcre;

  return (
    <>
      <Card className="flex flex-col gap-4">
        <CropSelect value={cropKey} onChange={edit(setCropKey)} />

        <div className="flex flex-col gap-2">
          <span className="text-small font-semibold text-ink">{t('calc.fert.mode')}</span>
          <SegmentedTabs
            ariaLabel={t('calc.fert.mode')}
            size="sm"
            value={mode}
            onChange={edit(switchMode)}
            options={[
              { value: 'crop', label: t('calc.fert.modeCrop') },
              { value: 'custom', label: t('calc.fert.modeCustom') },
            ]}
          />
        </div>

        {mode === 'crop' ? (
          cropNeed ? (
            <div className="flex flex-col gap-2">
              <span className="text-small font-semibold text-ink">
                {t('calc.fert.need')} ({kgPerAcre})
              </span>
              <dl className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['n', t('calc.fert.n'), cropNeed.n],
                    ['p', t('calc.fert.p'), cropNeed.p],
                    ['k', t('calc.fert.k'), cropNeed.k],
                  ] as const
                ).map(([key, label, value]) => (
                  <div key={key} className="rounded-xl bg-surface-2 px-2.5 py-2.5 hc:border hc:border-line">
                    <dt className="text-caption leading-snug text-ink-2">{label}</dt>
                    <dd className="mt-1 text-card-title font-bold text-ink tabular-nums">{num(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <p className="text-small text-ink-2">{t('calc.fert.pickCropFirst')}</p>
          )
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-caption text-ink-2">{t('calc.fert.customHint')}</p>
            <div className="flex flex-col gap-2">
              <span className="text-small font-semibold text-ink">{t('calc.fert.basis')}</span>
              <SegmentedTabs
                ariaLabel={t('calc.fert.basis')}
                size="sm"
                value={basis}
                onChange={edit(switchBasis)}
                options={[
                  { value: 'acre', label: kgPerAcre },
                  { value: 'hectare', label: kgPerHa },
                ]}
              />
            </div>
            <NumberField
              label={t('calc.fert.n')}
              value={custom.n}
              onChange={edit((n: number | null) => setCustom(c => ({ ...c, n })))}
              unit={basisUnit}
              min={0}
              max={2500}
            />
            <NumberField
              label={t('calc.fert.p')}
              value={custom.p}
              onChange={edit((p: number | null) => setCustom(c => ({ ...c, p })))}
              unit={basisUnit}
              min={0}
              max={2500}
            />
            <NumberField
              label={t('calc.fert.k')}
              value={custom.k}
              onChange={edit((k: number | null) => setCustom(c => ({ ...c, k })))}
              unit={basisUnit}
              min={0}
              max={2500}
            />
            {basis === 'hectare' && need && (
              <p className="text-caption text-ink-2">
                {t('calc.fert.perAcreIs', { n: num(need.n, 1), p: num(need.p, 1), k: num(need.k, 1) })}
              </p>
            )}
          </div>
        )}

        <AreaField value={area} onChange={edit(setArea)} error={area.value === 0 ? t('calc.area.error') : undefined} />
      </Card>

      <ResultCard
        label={t('calc.fert.result')}
        ready={!!plan}
        waiting={!need ? t('calc.fert.pickCropFirst') : undefined}
        announce={rows
          .map(r => `${r.name}: ${r.kg > 0.05 ? t('calc.fert.bags', { n: Math.ceil(r.bags), size: r.size }) : t('calc.fert.none')}`)
          .join(', ')}
      >
        {rows.map(r => (
          <div key={r.key} className="flex items-start justify-between gap-3 py-1">
            <span className="pt-1 text-body font-semibold text-ink">{r.name}</span>
            <span className="text-right">
              {r.kg > 0.05 ? (
                <>
                  <span className="block text-[1.375rem] leading-snug font-bold text-brand">
                    {t('calc.fert.bags', { n: Math.ceil(r.bags), size: r.size })}
                  </span>
                  <span className="block text-caption text-ink-2">
                    {t('calc.fert.exactKg', { kg: fmtKg(t, r.kg) })}
                    {Math.ceil(r.bags) * r.size - r.kg >= 1 && ` • ${t('calc.fert.left', { kg: fmtKg(t, Math.ceil(r.bags) * r.size - r.kg) })}`}
                  </span>
                </>
              ) : (
                <span className="block pt-1 text-body text-ink-2">{t('calc.fert.none')}</span>
              )}
            </span>
          </div>
        ))}
        {plan && plan.extraN > 0.5 && <p className="text-small text-ink-2">{t('calc.fert.extraN')}</p>}
      </ResultCard>

      <Disclaimer kind="fertilizer" />

      <Callout tone="neutral" icon={FlaskConical} title={t('calc.fert.splitTitle')}>
        {splitNote}
      </Callout>

      <Callout
        tone="warning"
        icon={TestTube}
        title={t('calc.fert.soilTitle')}
        action={
          <Button size="md" variant="secondary" onClick={() => nav.push('soil')}>
            {t('calc.fert.soilAction')}
          </Button>
        }
      >
        {t('calc.fert.soilBody')}
      </Callout>

      <HowItWorks
        steps={
          plan && need
            ? [
                t('calc.fert.howDap', { p: num(need.p), dap: num(plan.perAcre.dap, 1) }),
                t('calc.fert.howNDap', { dap: num(plan.perAcre.dap, 1), nDap: num(plan.perAcre.nFromDap, 1) }),
                t('calc.fert.howUrea', { n: num(need.n), nDap: num(plan.perAcre.nFromDap, 1), urea: num(plan.perAcre.urea, 1) }),
                t('calc.fert.howMop', { k: num(need.k), mop: num(plan.perAcre.mop, 1) }),
                t('calc.fert.howTotal', { acres: num(acres!, 3) }),
                mode === 'crop' && t('calc.fert.howSource'),
              ]
            : [t('calc.fert.howSource')]
        }
      />
    </>
  );
}
