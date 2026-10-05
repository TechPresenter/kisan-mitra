// कीटनाशक मिश्रण: label dose (per litre or per acre) → product per tank, tanks and total product.
// It only does the mixing arithmetic; the product and dose must come from the label / an expert.
import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Callout, Card, ChipGroup, Disclaimer, NumberField, SegmentedTabs } from '../../../components/ui';
import { useSettings } from '../../../lib/app-state';
import { formatNumber } from '../../../lib/format';
import { useT } from '../../../lib/i18n';
import { sprayPerAcre, sprayPerLitre } from '../calc-math';
import {
  AreaField,
  Bullets,
  HowItWorks,
  ResultCard,
  acresOf,
  defaultArea,
  fmtDose,
  num,
  useTrackOnce,
  type AreaValue,
} from '../parts';

type Mode = 'litre' | 'acre';
type Unit = 'ml' | 'g';

/** Above this many ml or g per litre of spray water a label dose is almost surely misread. */
const MAX_PLAUSIBLE_PER_LITRE = 20;

export default function PesticideCalc() {
  const t = useT();
  const [settings] = useSettings();
  const [mode, setMode] = useState<Mode>('litre');
  const [unit, setUnit] = useState<Unit>('ml');
  // One dose per mode: switching "प्रति लीटर" ↔ "प्रति एकड़" must never reuse the number typed
  // for the other (300 ml per acre is not 300 ml per litre).
  const [doses, setDoses] = useState<Record<Mode, number | null>>({ litre: null, acre: null });
  const dose = doses[mode];
  const setDose = (v: number | null) => setDoses(d => ({ ...d, [mode]: v }));
  const [tank, setTank] = useState<number | null>(16);
  const [water, setWater] = useState<number | null>(200);
  const [area, setArea] = useState<AreaValue>(defaultArea);

  const acres = acresOf(area, settings.bighaSqm);
  const plan =
    dose == null || tank == null
      ? null
      : mode === 'litre'
        ? sprayPerLitre(dose, tank, acres, water)
        : acres != null && water != null
          ? sprayPerAcre(dose, water, tank, acres)
          : null;
  const edit = useTrackOnce('pesticide', !!plan);
  // Strength of the spray: product per litre of water, whichever way the dose was given.
  const perLitre = plan && tank != null && tank > 0 ? plan.perTank / tank : null;
  const tooStrong = perLitre != null && perLitre > MAX_PLAUSIBLE_PER_LITRE;

  const unitShort = t(`calc.unit.${unit}`);
  const doseText = dose != null ? fmtDose(t, dose, unit) : '';
  const partialTank = plan?.tanksExact != null && Math.abs(plan.tanksExact - Math.round(plan.tanksExact)) > 0.05;

  const steps: (string | false | null | undefined)[] =
    plan && dose != null && tank != null
      ? mode === 'litre'
        ? [
            t('calc.pest.howTank', { dose: doseText, tank: num(tank), perTank: fmtDose(t, plan.perTank, unit) }),
            plan.water != null && acres != null && water != null
              ? t('calc.pest.howWater', { water: num(water), acres: num(acres, 3), total: formatNumber(Math.round(plan.water)) })
              : null,
            plan.water != null && plan.tanks != null
              ? t('calc.pest.howTanks', { total: formatNumber(Math.round(plan.water)), tank: num(tank), exact: num(plan.tanksExact!, 1), n: plan.tanks })
              : null,
            plan.total != null && plan.water != null
              ? t('calc.pest.howDose', { dose: doseText, water: formatNumber(Math.round(plan.water)), total: fmtDose(t, plan.total, unit) })
              : null,
          ]
        : [
            acres != null && t('calc.pest.howAcreTotal', { dose: doseText, acres: num(acres, 3), total: fmtDose(t, plan.total ?? 0, unit) }),
            water != null && t('calc.pest.howAcreTank', { dose: doseText, water: num(water), tank: num(tank), perTank: fmtDose(t, plan.perTank, unit) }),
            plan.water != null && plan.tanks != null
              ? t('calc.pest.howTanks', { total: formatNumber(Math.round(plan.water)), tank: num(tank), exact: num(plan.tanksExact!, 1), n: plan.tanks })
              : null,
          ]
      : [];

  return (
    <>
      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-small font-semibold text-ink">{t('calc.pest.mode')}</span>
          <SegmentedTabs
            ariaLabel={t('calc.pest.mode')}
            size="sm"
            value={mode}
            onChange={edit(setMode)}
            options={[
              { value: 'litre', label: t('calc.pest.modeLitre') },
              { value: 'acre', label: t('calc.pest.modeAcre') },
            ]}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-small font-semibold text-ink">{t('calc.pest.unit')}</span>
          <ChipGroup
            ariaLabel={t('calc.pest.unit')}
            wrap
            bleed={false}
            value={unit}
            onChange={edit(setUnit)}
            options={[
              { value: 'ml', label: t('calc.pest.ml') },
              { value: 'g', label: t('calc.pest.g') },
            ]}
          />
        </div>

        <NumberField
          label={mode === 'litre' ? t('calc.pest.dosePerL') : t('calc.pest.dosePerAcre')}
          hint={t('calc.pest.doseHint')}
          value={dose}
          onChange={edit(setDose)}
          unit={mode === 'litre' ? `${unitShort}/${t('calc.unit.litre')}` : `${unitShort}/${t('common.acre')}`}
          min={0}
          max={mode === 'litre' ? 1000 : 100_000}
        />

        <NumberField
          label={t('calc.pest.tank')}
          hint={t('calc.pest.tankHint')}
          value={tank}
          onChange={edit(setTank)}
          unit={t('calc.unit.litre')}
          min={0}
          max={5000}
        />

        <AreaField
          value={area}
          onChange={edit(setArea)}
          optional={mode === 'litre'}
          hint={mode === 'litre' ? t('calc.pest.areaOptional') : undefined}
          error={area.value === 0 ? t('calc.area.error') : undefined}
        />

        <NumberField
          label={t('calc.pest.water')}
          hint={t('calc.pest.waterHint')}
          value={water}
          onChange={edit(setWater)}
          unit={`${t('calc.unit.litre')}/${t('common.acre')}`}
          min={0}
          max={2000}
        />
      </Card>

      {tooStrong && (
        <Callout tone="danger" icon={ShieldAlert} role="status" title={t('calc.pest.checkLabelTitle')}>
          {t('calc.pest.checkLabel', { dose: fmtDose(t, perLitre!, unit), max: MAX_PLAUSIBLE_PER_LITRE })}
        </Callout>
      )}

      <ResultCard
        label={t('calc.pest.result')}
        ready={!!plan}
        value={plan ? fmtDose(t, plan.perTank, unit) : undefined}
        sub={plan && tank != null ? t('calc.pest.perTank', { tank: num(tank) }) : undefined}
      >
        {plan && plan.tanks != null && (
          <>
            <p className="font-semibold">{t('calc.pest.tanks', { n: plan.tanks })}</p>
            {plan.total != null && <p>{t('calc.pest.total', { total: fmtDose(t, plan.total, unit) })}</p>}
            {plan.water != null && <p>{t('calc.pest.totalWater', { n: formatNumber(Math.round(plan.water)) })}</p>}
            {partialTank && <p className="text-small text-ink-2">{t('calc.pest.lastTank')}</p>}
          </>
        )}
        {plan && plan.tanks == null && <p className="text-small text-ink-2">{t('calc.pest.areaOptional')}</p>}
      </ResultCard>

      <Disclaimer variant="warning">{t('calc.pest.disclaimer')}</Disclaimer>

      <Callout tone="warning" icon={ShieldAlert} title={t('calc.pest.safetyTitle')}>
        <Bullets
          className="mt-1"
          items={[
            t('calc.pest.safety1'),
            t('calc.pest.safety2'),
            t('calc.pest.safety3'),
            t('calc.pest.safety4'),
            t('calc.pest.safety5'),
            t('calc.pest.safety6'),
          ]}
        />
      </Callout>

      <HowItWorks steps={steps} />
    </>
  );
}
