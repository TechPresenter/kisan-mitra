// "मेरे खेत" (spec §15): the farmer's farms with place, area and how many crops each one has.
import './strings';
import { useMemo } from 'react';
import { Lightbulb, Plus, Tractor } from 'lucide-react';
import { Button, Callout, EmptyState, ListRow, Screen, ToneIcon, type Tone } from '../../components/ui';
import { EmptyArt } from '../../components/illustrations';
import { useSettings } from '../../lib/app-state';
import { formatNumber } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { useNav } from '../../lib/nav';
import { KEYS, useCollection } from '../../lib/store';
import type { Crop, Farm } from '../../types/models';
import { cropCountLabel, formatArea, totalAcres } from './helpers';

const FARM_TONES: Tone[] = ['green', 'amber', 'teal', 'orange', 'sky', 'indigo'];

export default function FarmsScreen() {
  const t = useT();
  const nav = useNav();
  const [settings] = useSettings();
  const farms = useCollection<Farm>(KEYS.farms).items;
  const crops = useCollection<Crop>(KEYS.crops).items;

  const rows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of crops) if (c.farmId) counts.set(c.farmId, (counts.get(c.farmId) || 0) + 1);
    // Oldest first, so "खेत 1" stays at the top.
    return [...farms]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((farm, i) => ({ farm, crops: counts.get(farm.id) || 0, tone: FARM_TONES[i % FARM_TONES.length] }));
  }, [farms, crops]);

  const total = useMemo(() => totalAcres(farms, settings.bighaSqm), [farms, settings.bighaSqm]);
  const add = () => nav.push('farm-edit');

  return (
    <Screen
      title={t('profile.farms.title')}
      subtitle={
        farms.length
          ? total > 0
            ? t('profile.farms.subtitle', { n: farms.length, area: `${formatNumber(total, 1)} ${t('common.acre')}` })
            : t('profile.farms.subtitleCount', { n: farms.length })
          : undefined
      }
      footer={
        farms.length ? (
          <Button fullWidth size="lg" icon={Plus} onClick={add}>
            {t('profile.farms.add')}
          </Button>
        ) : undefined
      }
    >
      {!rows.length ? (
        <EmptyState
          art={<EmptyArt kind="crops" />}
          title={t('profile.farms.empty.title')}
          body={t('profile.farms.empty.body')}
          action={{ label: t('profile.farms.add'), icon: Plus, onPress: add }}
        />
      ) : (
        <>
          <ul aria-label={t('profile.farms.listAria')} className="flex flex-col gap-3">
            {rows.map(({ farm, crops: n, tone }) => (
              <li key={farm.id}>
                <ListRow
                  leading={<ToneIcon icon={Tractor} tone={tone} shape="rounded" />}
                  title={farm.name}
                  subtitle={[
                    farm.place?.name || t('profile.farms.noPlace'),
                    farm.area > 0 ? formatArea(t, farm.area, farm.unit) : t('profile.farms.noArea'),
                  ].join(' — ')}
                  meta={[
                    cropCountLabel(t, n),
                    farm.soilType && farm.soilType !== 'unknown' ? t(`profile.soil.${farm.soilType}`) : null,
                    farm.irrigation ? t(`profile.irrigation.${farm.irrigation}`) : null,
                  ]
                    .filter(Boolean)
                    .join(' • ')}
                  onPress={() => nav.push('farm-edit', { id: farm.id })}
                />
              </li>
            ))}
          </ul>
          <Callout tone="neutral" icon={Lightbulb}>
            {t('profile.farms.tip')}
          </Callout>
        </>
      )}
    </Screen>
  );
}
