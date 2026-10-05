// सिंचाई कैलकुलेटर: land × water depth → litres / m³; with the pump flow (L/s, HP estimate or a
// timed drum) → how long the pump must run.
import { useState } from 'react';
import { Droplets } from 'lucide-react';
import { Callout, Card, NumberField, SectionHeader, SegmentedTabs, SelectField } from '../../../components/ui';
import { toSqm } from '../../../data/units';
import { useSettings } from '../../../lib/app-state';
import { formatNumber } from '../../../lib/format';
import { useT, type TFunction } from '../../../lib/i18n';
import { flowFromDrum, flowFromHp, irrigationVolume, pumpSeconds } from '../calc-math';
import {
  AreaField,
  HowItWorks,
  ResultCard,
  areaText,
  defaultArea,
  num,
  useTrackOnce,
  type AreaValue,
} from '../parts';

type FlowMode = 'lps' | 'hp' | 'drum';
type DepthUnit = 'cm' | 'mm';

function duration(t: TFunction, seconds: number): string {
  const totalMin = Math.max(1, Math.round(seconds / 60));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? t('calc.irr.hm', { h: formatNumber(h), m }) : t('calc.irr.min', { m });
}

export default function IrrigationCalc() {
  const t = useT();
  const [settings] = useSettings();
  const [area, setArea] = useState<AreaValue>(defaultArea);
  const [depth, setDepth] = useState<number | null>(5);
  const [depthUnit, setDepthUnit] = useState<DepthUnit>('cm');
  const [flowMode, setFlowMode] = useState<FlowMode>('lps');
  const [lps, setLps] = useState<number | null>(null);
  const [hp, setHp] = useState<number | null>(5);
  const [head, setHead] = useState<number | null>(15);
  const [drum, setDrum] = useState<number | null>(200);
  const [drumSec, setDrumSec] = useState<number | null>(null);

  const areaSqm = area.value != null && area.value > 0 ? toSqm(area.value, area.unit, settings.bighaSqm) : null;
  const depthMm = depth != null ? (depthUnit === 'cm' ? depth * 10 : depth) : null;
  const volume = areaSqm != null && depthMm != null ? irrigationVolume(areaSqm, depthMm) : null;

  const flow =
    flowMode === 'lps'
      ? lps != null && lps > 0
        ? lps
        : null
      : flowMode === 'hp'
        ? hp != null && head != null
          ? flowFromHp(hp, head)
          : null
        : drum != null && drumSec != null
          ? flowFromDrum(drum, drumSec)
          : null;
  const seconds = volume && flow ? pumpSeconds(volume.litres, flow) : null;
  const edit = useTrackOnce('irrigation', !!volume);

  const litresText = volume ? t('calc.q.l', { n: formatNumber(Math.round(volume.litres)) }) : '';
  const flowText = flow != null ? num(flow, 1) : '';

  return (
    <>
      <Card className="flex flex-col gap-4">
        <AreaField value={area} onChange={edit(setArea)} error={area.value === 0 ? t('calc.area.error') : undefined} />
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,8.5rem)] items-start gap-3">
          <NumberField
            label={t('calc.irr.depth')}
            value={depth}
            onChange={edit(setDepth)}
            min={0}
            max={depthUnit === 'cm' ? 100 : 1000}
            hint={t('calc.irr.depthHint')}
          />
          <SelectField
            label={t('calc.irr.depthUnit')}
            value={depthUnit}
            onChange={edit((u: string) => {
              const next = u as DepthUnit;
              if (depth != null && next !== depthUnit) setDepth(next === 'mm' ? depth * 10 : depth / 10);
              setDepthUnit(next);
            })}
            options={[
              { value: 'cm', label: t('calc.irr.cm') },
              { value: 'mm', label: t('calc.irr.mm') },
            ]}
          />
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <SectionHeader title={t('calc.irr.flowTitle')} as="h2" />
        <div className="flex flex-col gap-2">
          <span className="text-small font-semibold text-ink">{t('calc.irr.flowMode')}</span>
          <SegmentedTabs
            ariaLabel={t('calc.irr.flowMode')}
            size="sm"
            value={flowMode}
            onChange={edit(setFlowMode)}
            options={[
              { value: 'lps', label: t('calc.irr.modeLps') },
              { value: 'hp', label: t('calc.irr.modeHp') },
              { value: 'drum', label: t('calc.irr.modeDrum') },
            ]}
          />
        </div>

        {flowMode === 'lps' && (
          <NumberField label={t('calc.irr.flow')} value={lps} onChange={edit(setLps)} unit={t('calc.irr.lps')} min={0} max={1000} />
        )}

        {flowMode === 'hp' && (
          <>
            <div className="grid grid-cols-2 items-start gap-3">
              <NumberField label={t('calc.irr.hp')} value={hp} onChange={edit(setHp)} unit={t('calc.irr.hpUnit')} min={0} max={100} step={0.5} />
              <NumberField label={t('calc.irr.head')} value={head} onChange={edit(setHead)} unit={t('calc.irr.metre')} min={0} max={500} />
            </div>
            <p className="-mt-2 text-caption text-ink-2">{t('calc.irr.headHint')}</p>
            <p className="rounded-xl bg-tint-amber px-3.5 py-3 text-caption text-ink-2 hc:border hc:border-line">{t('calc.irr.hpNote')}</p>
          </>
        )}

        {flowMode === 'drum' && (
          <>
            <div className="grid grid-cols-2 items-start gap-3">
              <NumberField label={t('calc.irr.drum')} value={drum} onChange={edit(setDrum)} unit={t('calc.unit.litre')} min={0} max={10_000} />
              <NumberField label={t('calc.irr.drumTime')} value={drumSec} onChange={edit(setDrumSec)} unit={t('calc.irr.seconds')} min={0} max={3600} />
            </div>
            <p className="-mt-2 text-caption text-ink-2">{t('calc.irr.drumHint')}</p>
          </>
        )}

        {flowMode !== 'lps' && flow != null && (
          <p className="text-body font-semibold text-ink">{t('calc.irr.flowCalc', { n: flowText })}</p>
        )}
      </Card>

      <ResultCard
        label={t('calc.irr.result')}
        ready={!!volume}
        value={litresText}
        sub={volume ? t('calc.irr.m3', { n: num(volume.m3, 1) }) : undefined}
      >
        {volume &&
          (seconds != null ? (
            <p className="font-semibold">{t('calc.irr.hours', { time: duration(t, seconds) })}</p>
          ) : (
            <p className="text-small text-ink-2">{t('calc.irr.addFlow')}</p>
          ))}
      </ResultCard>

      <Callout tone="info" icon={Droplets}>
        {t('calc.irr.loss')}
      </Callout>

      <HowItWorks
        steps={
          volume && areaSqm != null && depthMm != null
            ? [
                t('calc.irr.howArea', { area: areaText(t, area), sqm: formatNumber(Math.round(areaSqm)) }),
                t('calc.irr.howVolume', {
                  sqm: formatNumber(Math.round(areaSqm)),
                  depth: num(depthMm / 1000, 3),
                  m3: num(volume.m3, 1),
                  litres: formatNumber(Math.round(volume.litres)),
                }),
                flowMode === 'hp' && flow != null && t('calc.irr.howHp', { hp: num(hp ?? 0), head: num(head ?? 0), flow: flowText }),
                flowMode === 'drum' && flow != null && t('calc.irr.howDrum', { drum: num(drum ?? 0), sec: num(drumSec ?? 0), flow: flowText }),
                seconds != null &&
                  t('calc.irr.howTime', { litres: formatNumber(Math.round(volume.litres)), flow: flowText, time: duration(t, seconds) }),
              ]
            : []
        }
      />
    </>
  );
}
