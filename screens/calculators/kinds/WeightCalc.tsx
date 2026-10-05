// वज़न बदलें: quintal ↔ kg ↔ tonne.
import { useState } from 'react';
import { Card, NumberField, SelectField, cx } from '../../../components/ui';
import { convertWeight, type WeightUnit } from '../../../data/units';
import { formatNumber } from '../../../lib/format';
import { useT, type TFunction } from '../../../lib/i18n';
import { HowItWorks, ResultCard, num, useTrackOnce } from '../parts';

const UNITS: readonly WeightUnit[] = ['quintal', 'kg', 'tonne'];

const label = (t: TFunction, u: WeightUnit) => (u === 'tonne' ? t('calc.unit.tonne') : t(`common.${u}`));
const fmt = (n: number) => {
  const a = Math.abs(n);
  if (a === 0) return '0';
  if (a >= 1000) return formatNumber(n, 1);
  return a < 0.01 ? formatNumber(n, 5) : num(n, 3);
};

export default function WeightCalc() {
  const t = useT();
  const [value, setValue] = useState<number | null>(1);
  const [unit, setUnit] = useState<WeightUnit>('quintal');

  const ok = value != null && value > 0;
  const edit = useTrackOnce('weight', ok);
  const target: WeightUnit = unit === 'kg' ? 'quintal' : unit === 'quintal' ? 'kg' : 'quintal';
  const headline = ok ? convertWeight(value!, unit, target) : 0;

  return (
    <>
      <Card>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,8.5rem)] items-start gap-3">
          <NumberField
            label={t('calc.weight.value')}
            value={value}
            onChange={edit(setValue)}
            min={0}
            max={10_000_000}
            error={value === 0 ? t('calc.weight.error') : undefined}
          />
          <SelectField
            label={t('calc.weight.unit')}
            value={unit}
            onChange={edit((u: string) => setUnit(u as WeightUnit))}
            options={UNITS.map(u => ({ value: u, label: label(t, u) }))}
          />
        </div>
      </Card>

      <ResultCard
        label={t('calc.areaConv.result')}
        ready={ok}
        value={ok ? `${fmt(headline)} ${label(t, target)}` : undefined}
        sub={ok ? `= ${num(value!, 3)} ${label(t, unit)}` : undefined}
      >
        {ok && (
          <dl className="-my-1 flex flex-col">
            {UNITS.map((u, i) => (
              <div key={u} className={cx('flex min-h-11 items-center justify-between gap-3 py-1.5', i > 0 && 'border-t border-brand-100')}>
                <dt className={cx('text-body', u === unit ? 'font-semibold text-ink' : 'text-ink-2')}>{label(t, u)}</dt>
                <dd className="text-body font-bold text-ink tabular-nums">{fmt(convertWeight(value!, unit, u))}</dd>
              </div>
            ))}
          </dl>
        )}
      </ResultCard>

      <HowItWorks steps={[t('calc.weight.how1'), t('calc.weight.how2')]} />
    </>
  );
}
