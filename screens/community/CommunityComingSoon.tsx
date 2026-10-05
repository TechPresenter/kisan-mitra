// "जल्द आ रहा है" preview shown while FEATURES.community is false (no moderated backend yet).
// It describes what the community will do — it never shows sample posts or invented names.
import './strings';
import { useMemo } from 'react';
import { Bookmark, Camera, MapPin, MessageCircleQuestion, ShieldAlert, ShieldCheck, Wheat } from 'lucide-react';
import { Callout } from '../../components/ui';
import { useT } from '../../lib/i18n';
import { ComingSoonHero, FeatureList, HelpNow, VerifiedBadge, type FeatureItem } from './parts';

export function CommunityComingSoon() {
  const t = useT();
  const items = useMemo<FeatureItem[]>(
    () => [
      { key: 'ask', icon: MessageCircleQuestion, tone: 'green', title: t('community.soon.f.ask'), description: t('community.soon.f.askDesc') },
      { key: 'photo', icon: Camera, tone: 'sky', title: t('community.soon.f.photo'), description: t('community.soon.f.photoDesc') },
      { key: 'crop', icon: Wheat, tone: 'amber', title: t('community.soon.f.cropGroups'), description: t('community.soon.f.cropGroupsDesc') },
      { key: 'local', icon: MapPin, tone: 'orange', title: t('community.soon.f.localGroups'), description: t('community.soon.f.localGroupsDesc') },
      {
        key: 'verified',
        icon: ShieldCheck,
        tone: 'teal',
        title: t('community.soon.f.verified'),
        description: t('community.soon.f.verifiedDesc'),
        extra: <VerifiedBadge />,
      },
      { key: 'actions', icon: Bookmark, tone: 'rose', title: t('community.soon.f.actions'), description: t('community.soon.f.actionsDesc') },
    ],
    [t],
  );

  return (
    <>
      <ComingSoonHero title={t('community.soon.title')} body={t('community.soon.body')} />
      <FeatureList id="community-features" title={t('community.soon.features')} items={items} />
      <Callout tone="neutral" icon={ShieldAlert} title={t('community.soon.whyTitle')}>
        {t('community.soon.whyBody')}
      </Callout>
      <HelpNow />
    </>
  );
}

export default CommunityComingSoon;
