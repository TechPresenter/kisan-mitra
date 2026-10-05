// Home: 4-column quick-action grid (reference screen 4).
import './strings';
import { memo } from 'react';
import { Bug, CalendarDays, CloudSun, Headset, IndianRupee, Landmark, Shovel, Sprout } from 'lucide-react';
import { IconTile, SectionHeader, TileGrid, type IconLike, type Tone } from '../../components/ui';
import { useT } from '../../lib/i18n';
import type { HomeNav } from './util';

interface QuickAction {
  key: string;
  label: string;
  icon: IconLike;
  tone: Tone;
  go: (nav: HomeNav) => void;
}

const ACTIONS: QuickAction[] = [
  { key: 'advice', label: 'home.quick.advice', icon: Sprout, tone: 'green', go: nav => nav.switchTab('ai') },
  { key: 'mandi', label: 'home.quick.mandi', icon: IndianRupee, tone: 'orange', go: nav => nav.switchTab('mandi') },
  { key: 'weather', label: 'home.quick.weather', icon: CloudSun, tone: 'sky', go: nav => nav.push('weather') },
  { key: 'doctor', label: 'home.quick.doctor', icon: Bug, tone: 'red', go: nav => nav.push('crop-doctor') },
  { key: 'soil', label: 'home.quick.soil', icon: Shovel, tone: 'amber', go: nav => nav.push('soil') },
  { key: 'schemes', label: 'home.quick.schemes', icon: Landmark, tone: 'teal', go: nav => nav.push('schemes') },
  { key: 'calendar', label: 'home.quick.calendar', icon: CalendarDays, tone: 'rose', go: nav => nav.push('calendar') },
  { key: 'experts', label: 'home.quick.experts', icon: Headset, tone: 'indigo', go: nav => nav.push('experts') },
];

export const QuickActions = memo(function QuickActions({ go }: { go: HomeNav }) {
  const t = useT();
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title={t('home.quick.title')} />
      <TileGrid columns={4}>
        {ACTIONS.map(a => (
          <IconTile key={a.key} icon={a.icon} tone={a.tone} label={t(a.label)} onPress={() => a.go(go)} />
        ))}
      </TileGrid>
    </section>
  );
});
