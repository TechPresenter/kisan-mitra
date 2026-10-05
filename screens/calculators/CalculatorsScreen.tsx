// खेती कैलकुलेटर (reference screen 14): tinted tiles for every calculator and unit converter,
// plus a link to the farmer's own accounts.
import './strings';
import { Wallet } from 'lucide-react';
import { IconTile, ListRow, SectionHeader, Screen, TileGrid, ToneIcon } from '../../components/ui';
import { useT } from '../../lib/i18n';
import { useNav } from '../../lib/nav';
import { CALCULATORS } from './catalog';

export default function CalculatorsScreen() {
  const t = useT();
  const nav = useNav();
  const open = (kind: string) => nav.push('calculator', { kind });

  const tiles = (group: 'farm' | 'units') =>
    CALCULATORS.filter(c => c.group === group).map(c => (
      <IconTile
        key={c.kind}
        variant="card"
        icon={c.icon}
        tone={c.tone}
        label={t(`calc.k.${c.kind}.title`)}
        description={t(`calc.k.${c.kind}.desc`)}
        onPress={() => open(c.kind)}
      />
    ));

  return (
    <Screen title={t('calc.title')} subtitle={t('calc.subtitle')}>
      <section className="flex flex-col gap-3">
        <SectionHeader title={t('calc.section.farm')} />
        <TileGrid columns={2}>{tiles('farm')}</TileGrid>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader title={t('calc.section.units')} />
        <TileGrid columns={2}>{tiles('units')}</TileGrid>
      </section>

      <ListRow
        leading={<ToneIcon icon={Wallet} tone="green" />}
        title={t('calc.hisabLink.title')}
        subtitle={t('calc.hisabLink.body')}
        onPress={() => nav.push('hisab')}
      />

      <p className="text-caption text-ink-2">{t('calc.listNote')}</p>
    </Screen>
  );
}
