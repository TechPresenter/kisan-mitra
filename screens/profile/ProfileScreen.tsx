// Profile tab root (reference screen 19): farmer card, quick stats, menu, version and logout.
import './strings';
import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Bell,
  Bookmark,
  FileText,
  Languages,
  LifeBuoy,
  LogOut,
  MapPin,
  Pencil,
  Plus,
  Settings,
  ShieldCheck,
  Sprout,
  Tractor,
  Wallet,
} from 'lucide-react';
import { Avatar, Badge, Button, Card, ListGroup, ListRow, Screen, StatCard, ToneIcon, confirm } from '../../components/ui';
import { BrandLogo } from '../../components/brand/BrandLogo';
import { LanguageSheet } from '../../components/shared/LanguageSheet';
import { placeLabel, usePlace, useProfile, useSession, useSettings } from '../../lib/app-state';
import { areaInAcres } from '../../data/units';
import { formatNumber } from '../../lib/format';
import { useLanguage, useT } from '../../lib/i18n';
import { useNav } from '../../lib/nav';
import { KEYS, useCollection } from '../../lib/store';
import { useNotifications } from '../../services/notifications';
import type { Crop, Farm } from '../../types/models';
import { APP_VERSION, syncProfileLand, totalAcres, wipeDeviceAndRestart } from './helpers';
import { ProfileEditSheet } from './ProfileEditSheet';

/** "+91 98765 43210" for a 10-digit Indian mobile; anything else as stored. */
function formatPhone(p?: string): string | undefined {
  if (!p) return undefined;
  const d = p.replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : p;
}

function GroupLabel({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="mb-2 px-1 text-small font-semibold text-ink-2">
      {children}
    </h2>
  );
}

export default function ProfileScreen() {
  const t = useT();
  const nav = useNav();
  const [profile] = useProfile();
  const [session] = useSession();
  const [place] = usePlace();
  const [settings, updateSettings] = useSettings();
  const { language } = useLanguage();
  const farms = useCollection<Farm>(KEYS.farms).items;
  const crops = useCollection<Crop>(KEYS.crops).items;
  const { unread } = useNotifications();
  const [editOpen, setEditOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Keep profile.landArea (used by the AI, calculators and hisab) equal to the farms' total, also
  // for records saved before farms became the source and after the bigha size changes.
  useEffect(() => {
    syncProfileLand();
  }, [farms, settings.bighaSqm]);

  const displayName = profile?.name?.trim() || t('profile.farmer');
  const contact = formatPhone(profile?.phone) || profile?.email;

  // The farmer's own village/district/state when any is filled in (never mixed with the app's
  // weather place, which may be somewhere else); otherwise the selected place plus a prompt.
  const ownPlace = useMemo(() => {
    const parts = [profile?.village, profile?.district, profile?.state].map(p => p?.trim()).filter((p): p is string => !!p);
    return [...new Set(parts)].join(', ');
  }, [profile?.village, profile?.district, profile?.state]);

  // Farms are the source of the land figure; profile.landArea only when no farm has an area yet.
  const landLabel = useMemo(() => {
    let acres = totalAcres(farms, settings.bighaSqm);
    if (!(acres > 0) && profile?.landArea && profile.landArea > 0) {
      acres = areaInAcres(profile.landArea, profile.landUnit || 'acre', settings.bighaSqm);
    }
    if (!(acres > 0)) {
      return (
        <>
          <span aria-hidden>—</span>
          <span className="sr-only">{t('profile.farms.noArea')}</span>
        </>
      );
    }
    return `${formatNumber(acres, acres >= 10 ? 0 : 1)} ${t('common.acre')}`;
  }, [farms, profile?.landArea, profile?.landUnit, settings.bighaSqm, t]);

  // Only a Google sign-in proves anything (Google verified the email); v1 marked every login "verified".
  const googleLinked = session.method === 'google' && !!profile?.isVerified && !!profile?.email;

  const logout = async () => {
    const ok = await confirm({
      title: t('profile.logout.title'),
      message: t('profile.logout.body'),
      confirmLabel: t('profile.logout.confirm'),
      tone: 'danger',
      icon: LogOut,
    });
    if (!ok) return;
    setLeaving(true);
    await wipeDeviceAndRestart();
  };

  return (
    <Screen
      title={t('profile.title')}
      back={false}
      actions={[{ icon: Settings, label: t('profile.settingsAria'), onPress: () => nav.push('settings') }]}
    >
      {/* Farmer card */}
      <Card as="section" aria-labelledby="profile-name" padding="lg" className="flex flex-col items-center gap-1.5 text-center">
        <Avatar name={displayName} src={profile?.picture} size="xl" />
        <h2 id="profile-name" className="mt-2 text-section leading-snug font-bold text-ink">
          {displayName}
        </h2>
        {contact && (
          <p className="text-small text-ink-2" dir="ltr">
            {contact}
          </p>
        )}
        <p className="flex items-center justify-center gap-1 text-small text-ink-2">
          <MapPin aria-hidden className="size-4 shrink-0 text-brand" />
          <span>{ownPlace || placeLabel(place)}</span>
        </p>
        {!ownPlace && (
          <Button variant="ghost" icon={Plus} onClick={() => setEditOpen(true)}>
            {t('profile.addPlace')}
          </Button>
        )}
        {(googleLinked || profile?.farmingType) && (
          <div className="mt-1 flex flex-wrap justify-center gap-2">
            {googleLinked && (
              <Badge tone="green" icon={BadgeCheck}>
                {t('profile.verified')}
              </Badge>
            )}
            {profile?.farmingType && (
              <Badge tone="teal">{t('profile.farmingType.badge', { type: t(`profile.farmingType.${profile.farmingType}`) })}</Badge>
            )}
          </div>
        )}
        <Button variant="secondary" icon={Pencil} className="mt-3" onClick={() => setEditOpen(true)}>
          {t('profile.edit')}
        </Button>
      </Card>

      {/* Quick stats */}
      <section aria-label={t('profile.stats.aria')} className="grid grid-cols-3 gap-3">
        <StatCard label={t('profile.stats.farms')} value={String(farms.length)} tone="green" onPress={() => nav.push('farms')} />
        <StatCard label={t('profile.stats.crops')} value={String(crops.length)} tone="teal" onPress={() => nav.push('crops')} />
        <StatCard label={t('profile.stats.land')} value={landLabel} tone="amber" onPress={() => nav.push('farms')} />
      </section>

      {/* Menu */}
      <section aria-labelledby="profile-group-farming">
        <GroupLabel id="profile-group-farming">{t('profile.group.farming')}</GroupLabel>
        <ListGroup ariaLabel={t('profile.group.farming')}>
          <ListRow
            variant="plain"
            leading={<ToneIcon icon={Tractor} tone="green" size="sm" />}
            title={t('profile.menu.farms')}
            subtitle={t('profile.menu.farmsSub')}
            subtitleLines={1}
            trailing={farms.length ? <span className="text-small font-semibold text-ink-2">{farms.length}</span> : undefined}
            chevron
            onPress={() => nav.push('farms')}
          />
          <ListRow
            variant="plain"
            leading={<ToneIcon icon={Sprout} tone="teal" size="sm" />}
            title={t('profile.menu.crops')}
            subtitle={t('profile.menu.cropsSub')}
            subtitleLines={1}
            trailing={crops.length ? <span className="text-small font-semibold text-ink-2">{crops.length}</span> : undefined}
            chevron
            onPress={() => nav.push('crops')}
          />
          <ListRow
            variant="plain"
            leading={<ToneIcon icon={Bookmark} tone="amber" size="sm" />}
            title={t('profile.menu.saved')}
            subtitle={t('profile.menu.savedSub')}
            subtitleLines={1}
            onPress={() => nav.push('saved')}
          />
          <ListRow
            variant="plain"
            leading={<ToneIcon icon={Wallet} tone="orange" size="sm" />}
            title={t('profile.menu.hisab')}
            subtitle={t('profile.menu.hisabSub')}
            subtitleLines={1}
            onPress={() => nav.push('hisab')}
          />
          <ListRow
            variant="plain"
            leading={<ToneIcon icon={Bell} tone="sky" size="sm" />}
            title={t('profile.menu.notifications')}
            subtitle={t('profile.menu.notificationsSub')}
            subtitleLines={1}
            trailing={
              unread > 0 ? (
                <Badge tone="red" variant="solid">
                  {t('profile.menu.unread', { n: unread > 99 ? '99+' : unread })}
                </Badge>
              ) : undefined
            }
            chevron
            onPress={() => nav.push('notifications')}
          />
        </ListGroup>
      </section>

      <section aria-labelledby="profile-group-app">
        <GroupLabel id="profile-group-app">{t('profile.group.app')}</GroupLabel>
        <ListGroup ariaLabel={t('profile.group.app')}>
          <ListRow
            variant="plain"
            leading={<ToneIcon icon={Settings} tone="gray" size="sm" />}
            title={t('profile.menu.settings')}
            subtitle={t('profile.menu.settingsSub')}
            subtitleLines={1}
            onPress={() => nav.push('settings')}
          />
          <ListRow
            variant="plain"
            leading={<ToneIcon icon={Languages} tone="indigo" size="sm" />}
            title={t('profile.menu.language')}
            trailing={
              <span className="text-small text-ink-2" lang={language.code}>
                {language.label}
              </span>
            }
            chevron
            onPress={() => setLangOpen(true)}
          />
          <ListRow
            variant="plain"
            leading={<ToneIcon icon={LifeBuoy} tone="rose" size="sm" />}
            title={t('profile.menu.help')}
            subtitle={t('profile.menu.helpSub')}
            subtitleLines={1}
            onPress={() => nav.push('help')}
          />
        </ListGroup>
      </section>

      <section aria-labelledby="profile-group-legal">
        <GroupLabel id="profile-group-legal">{t('profile.group.legal')}</GroupLabel>
        <ListGroup ariaLabel={t('profile.group.legal')}>
          <ListRow
            variant="plain"
            leading={<ToneIcon icon={ShieldCheck} tone="teal" size="sm" />}
            title={t('profile.menu.privacy')}
            onPress={() => nav.push('privacy')}
          />
          <ListRow
            variant="plain"
            leading={<ToneIcon icon={FileText} tone="gray" size="sm" />}
            title={t('profile.menu.terms')}
            onPress={() => nav.push('terms')}
          />
        </ListGroup>
      </section>

      <div className="flex flex-col items-center gap-4 pb-2">
        <Button variant="danger" fullWidth icon={LogOut} loading={leaving} onClick={logout}>
          {t('profile.logout')}
        </Button>
        <div className="flex items-center gap-2 text-caption text-ink-3">
          <BrandLogo variant="mark" size={28} alt="" />
          <span>
            {t('profile.settings.about.name')} • {t('profile.version', { v: APP_VERSION })}
          </span>
        </div>
      </div>

      <ProfileEditSheet open={editOpen} onClose={() => setEditOpen(false)} />
      <LanguageSheet
        open={langOpen}
        onClose={() => setLangOpen(false)}
        // A saved voice belongs to the old language; fall back to the phone's default voice.
        onSelect={code => {
          if (code !== language.code && settings.voiceURI) updateSettings({ voiceURI: null });
        }}
      />
    </Screen>
  );
}
