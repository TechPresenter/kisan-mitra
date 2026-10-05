// One calculator ('calculator' { kind }): seed, fertilizer, pesticide, irrigation, cost, profit,
// area or weight. Each kind has its inputs with units, a live result, "कैसे निकाला?" and the
// disclaimers it needs.
import './strings';
import type { ComponentType } from 'react';
import { EmptyState, Screen } from '../../components/ui';
import { EmptyArt } from '../../components/illustrations';
import { useT } from '../../lib/i18n';
import { useNav, useRoute } from '../../lib/nav';
import { isCalcKind, type CalcKind } from './catalog';
import AreaCalc from './kinds/AreaCalc';
import CostCalc from './kinds/CostCalc';
import FertilizerCalc from './kinds/FertilizerCalc';
import IrrigationCalc from './kinds/IrrigationCalc';
import PesticideCalc from './kinds/PesticideCalc';
import ProfitCalc from './kinds/ProfitCalc';
import SeedCalc from './kinds/SeedCalc';
import WeightCalc from './kinds/WeightCalc';

const BODIES: Record<CalcKind, ComponentType> = {
  seed: SeedCalc,
  fertilizer: FertilizerCalc,
  pesticide: PesticideCalc,
  irrigation: IrrigationCalc,
  cost: CostCalc,
  profit: ProfitCalc,
  area: AreaCalc,
  weight: WeightCalc,
};

export default function CalculatorScreen() {
  const t = useT();
  const nav = useNav();
  const { params } = useRoute<{ kind?: string }>();
  const kind = isCalcKind(params.kind) ? params.kind : null;

  if (!kind) {
    return (
      <Screen title={t('calc.title')}>
        <EmptyState
          art={<EmptyArt kind="search" />}
          title={t('calc.notFound.title')}
          body={t('calc.notFound.body')}
          action={{ label: t('calc.notFound.action'), onPress: () => nav.replace('calculators') }}
        />
      </Screen>
    );
  }

  const Body = BODIES[kind];
  return (
    <Screen title={t(`calc.k.${kind}.title`)} subtitle={t(`calc.k.${kind}.desc`)}>
      <Body />
    </Screen>
  );
}
