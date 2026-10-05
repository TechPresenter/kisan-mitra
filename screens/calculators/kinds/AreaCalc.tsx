// क्षेत्र बदलें: acre ↔ bigha ↔ hectare ↔ sq m (plus sq ft and gaj in the table), with the local
// bigha preset / custom size (settings.bighaSqm), which the whole app uses.
import { useState } from 'react';
import { Card, SectionHeader, cx } from '../../../components/ui';
import { SQM_PER_SQFT, SQM_PER_SQYD, convertArea, toSqm, type LandUnit } from '../../../data/units';
import { useSettings } from '../../../lib/app-state';
import { formatNumber } from '../../../lib/format';
import { useLanguage, useT } from '../../../lib/i18n';
import {
  AreaField,
  BighaSettings,
  HowItWorks,
  ResultCard,
  areaText,
  bighaName,
  currentBigha,
  defaultArea,
  num,
  unitLabel,
  useTrackOnce,
  type AreaValue,
} from '../parts';

const UNITS: readonly LandUnit[] = ['acre', 'bigha', 'hectare', 'sqm'];
type Row = { key: string; unit: LandUnit | 'sqft' | 'sqyd'; value: number };

/** More decimals for small values so "0.0247 हेक्टेयर" does not read as 0. */
const fmt = (n: number) => {
  const a = Math.abs(n);
  if (a === 0) return '0';
  if (a >= 1000) return formatNumber(n, 0);
  if (a >= 1) return num(n, 3);
  return formatNumber(n, a < 0.01 ? 5 : 4);
};

export default function AreaCalc() {
  const t = useT();
  const { language } = useLanguage();
  const [settings] = useSettings();
  const [area, setArea] = useState<AreaValue>(defaultArea);
  const { preset, sqm: bighaSqm } = currentBigha(settings);

  const ok = area.value != null && area.value > 0;
  const sqm = ok ? toSqm(area.value!, area.unit, bighaSqm) : 0;
  const rows: Row[] = ok
    ? [
        ...UNITS.map(u => ({ key: u, unit: u, value: convertArea(area.value!, area.unit, u, bighaSqm) })),
        { key: 'sqft', unit: 'sqft' as const, value: sqm / SQM_PER_SQFT },
        { key: 'sqyd', unit: 'sqyd' as const, value: sqm / SQM_PER_SQYD },
      ]
    : [];
  const edit = useTrackOnce('area', ok);

  // The headline answer: acres, or bighas when the farmer typed acres.
  const target: LandUnit = area.unit === 'acre' ? 'bigha' : 'acre';
  const headline = ok ? convertArea(area.value!, area.unit, target, bighaSqm) : 0;

  return (
    <>
      <Card className="flex flex-col gap-4">
        <AreaField value={area} onChange={edit(setArea)} units={UNITS} bighaLink={false} error={area.value === 0 ? t('calc.area.error') : undefined} />
      </Card>

      <ResultCard
        label={t('calc.areaConv.result')}
        ready={ok}
        value={ok ? `${fmt(headline)} ${unitLabel(t, target)}` : undefined}
        sub={ok ? `= ${areaText(t, area)}` : undefined}
      >
        {ok && (
          <dl aria-label={t('calc.areaConv.table')} className="-my-1 flex flex-col">
            {rows.map((r, i) => (
              <div
                key={r.key}
                className={cx('flex min-h-11 items-center justify-between gap-3 py-1.5', i > 0 && 'border-t border-brand-100')}
              >
                <dt className={cx('text-body', r.unit === area.unit ? 'font-semibold text-ink' : 'text-ink-2')}>{unitLabel(t, r.unit)}</dt>
                <dd className="text-body font-bold text-ink tabular-nums">{fmt(r.value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </ResultCard>

      <Card className="flex flex-col gap-4">
        <SectionHeader title={t('calc.bigha.title')} as="h2" />
        <BighaSettings onEdit={edit(() => {})} />
      </Card>

      <HowItWorks
        steps={[
          t('calc.areaConv.how1'),
          t('calc.areaConv.how2'),
          t('calc.areaConv.how3', { sqm: formatNumber(bighaSqm, 1), name: bighaName(t, language.code, preset.id) }),
          t('calc.areaConv.how4'),
        ]}
      />
    </>
  );
}
