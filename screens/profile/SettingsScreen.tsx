// Settings: language, appearance (theme, text size, high contrast), read-aloud voice,
// notification categories, local bigha size, data export / delete, and about.
import './strings';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Bell,
  Check,
  CloudSun,
  Contrast,
  Download,
  FileText,
  Landmark,
  Languages,
  LifeBuoy,
  ListChecks,
  Moon,
  ShieldCheck,
  Sprout,
  Trash2,
  TrendingUp,
  Volume2,
} from 'lucide-react';
import {
  Callout,
  Card,
  ListGroup,
  ListRow,
  ListenButton,
  NumberField,
  Screen,
  SegmentedTabs,
  SelectField,
  Sheet,
  SkeletonList,
  Toggle,
  ToneIcon,
  confirm,
  toast,
} from '../../components/ui';
import { BrandLogo } from '../../components/brand/BrandLogo';
import { LanguageSheet } from '../../components/shared/LanguageSheet';
import { useSettings } from '../../lib/app-state';
import { track } from '../../lib/analytics';
import { formatNumber, todayISO } from '../../lib/format';
import { useLanguage, useT } from '../../lib/i18n';
import { useNav } from '../../lib/nav';
import { BIGHA_PRESETS, SQM_PER_ACRE } from '../../data/units';
import { getNativeVoices, isNative, shareText } from '../../services/native';
import { ensureNotificationPermission } from '../../services/reminders';
import { syncTaskReminders } from '../../services/tasks';
import { speak } from '../../services/voice';
import type { AppSettings } from '../../types/models';
import { APP_VERSION, SHARE_TEXT_LIMIT, buildDataExport, downloadJSON, wipeDeviceAndRestart } from './helpers';

type TextScale = AppSettings['textScale'];
type NotifKey = Exclude<keyof AppSettings['notifications'], 'enabled'>;

const TEXT_SCALES: { value: string; scale: TextScale; key: string }[] = [
  { value: '1', scale: 1, key: 'normal' },
  { value: '1.15', scale: 1.15, key: 'large' },
  { value: '1.3', scale: 1.3, key: 'xlarge' },
];

const NOTIF_ROWS: { key: NotifKey; icon: typeof Bell }[] = [
  { key: 'weather', icon: CloudSun },
  { key: 'crop', icon: Sprout },
  { key: 'mandi', icon: TrendingUp },
  { key: 'government', icon: Landmark },
  { key: 'reminders', icon: ListChecks },
];

/**
 * Categories some service actually sends today (services/weather, services/mandi, task reminders).
 * Nothing pushes 'crop' or 'government' alerts yet, so their switches stay hidden instead of
 * promising alerts that never come; add them here once a service produces them.
 */
const LIVE_NOTIF_KEYS = new Set<NotifKey>(['weather', 'mandi', 'reminders']);
const VISIBLE_NOTIF_ROWS = NOTIF_ROWS.filter(r => LIVE_NOTIF_KEYS.has(r.key));

const BIGHA_MIN_SQM = 100;
const BIGHA_MAX_SQM = 10000;
const bighaValid = (n: number | null): n is number => n != null && n >= BIGHA_MIN_SQM && n <= BIGHA_MAX_SQM;

const DEFAULT_VOICE = '__default';
const VOICE_TEST_ID = 'settings-voice-test';

interface VoiceInfo {
  voiceURI: string;
  name: string;
  lang: string;
}

/** Device voices for the app language. null while loading (Android binds its TTS engine lazily). */
function useVoices(langPrefix: string, reloadKey: unknown): VoiceInfo[] | null {
  const [all, setAll] = useState<VoiceInfo[] | null>(null);

  useEffect(() => {
    let alive = true;
    if (isNative) {
      getNativeVoices()
        .then(v => alive && setAll(v))
        .catch(() => alive && setAll(prev => prev ?? []));
      return () => {
        alive = false;
      };
    }
    const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
    if (!synth) {
      setAll([]);
      return;
    }
    const load = () => {
      const list = synth.getVoices();
      if (alive && list.length) setAll(list.map(v => ({ voiceURI: v.voiceURI, name: v.name, lang: v.lang })));
    };
    load();
    // Chrome fills the list asynchronously; stop showing "loading" if it never arrives.
    const timer = setTimeout(() => alive && setAll(prev => prev ?? []), 2000);
    synth.addEventListener('voiceschanged', load);
    return () => {
      alive = false;
      clearTimeout(timer);
      synth.removeEventListener('voiceschanged', load);
    };
  }, [reloadKey]);

  return useMemo(
    () => (all ? all.filter(v => v.lang.toLowerCase().replace('_', '-').startsWith(langPrefix)) : null),
    [all, langPrefix],
  );
}

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mb-2 px-1 text-small font-semibold text-ink-2">
      {children}
    </h2>
  );
}

export default function SettingsScreen() {
  const t = useT();
  const nav = useNav();
  const [settings, update] = useSettings();
  const { language } = useLanguage();
  const [langOpen, setLangOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [customSqm, setCustomSqm] = useState<number | null>(settings.bighaSqm);

  const langPrefix = language.ttsCode.split('-')[0].toLowerCase();
  const voices = useVoices(langPrefix, voiceOpen);

  // ---------- Voice ----------
  const voiceLabel = (v: VoiceInfo, i: number) => (isNative ? t('profile.settings.voice.numbered', { n: i + 1 }) : v.name);
  const voiceDetail = (v: VoiceInfo) => {
    if (!isNative) return v.lang;
    const quality = /local/i.test(v.name)
      ? t('profile.settings.voice.offline')
      : /network/i.test(v.name)
        ? t('profile.settings.voice.online')
        : null;
    return [v.name, quality].filter(Boolean).join(' • ');
  };
  const selectedIndex = voices ? voices.findIndex(v => v.voiceURI === settings.voiceURI) : -1;
  // A saved voice is only reported once the list has loaded; one missing from this phone's list
  // (e.g. the TTS engine changed) falls back to the phone voice, which is what speak() then uses.
  const currentVoice =
    selectedIndex >= 0 && voices
      ? voiceLabel(voices[selectedIndex], selectedIndex)
      : settings.voiceURI && voices === null
        ? t('profile.settings.voice.loading')
        : t('profile.settings.voice.default');
  const selectedAria = (title: string) => `${title}, ${t('ui.selected')}`;

  const chooseVoice = (uri: string) => {
    update({ voiceURI: uri === DEFAULT_VOICE ? null : uri });
    setVoiceOpen(false);
    toast.success(t('profile.settings.voice.changed'));
    // Let the farmer hear the new voice straight away (speak() reads the saved setting).
    speak(VOICE_TEST_ID, t('profile.settings.voice.sample')).catch(() => {});
  };

  // ---------- Notifications ----------
  const setNotif = async (patch: Partial<AppSettings['notifications']>) => {
    const before = settings.notifications;
    const next = { ...before, ...patch };
    update({ notifications: next });
    const remindersBefore = before.enabled && before.reminders;
    const remindersAfter = next.enabled && next.reminders;
    const turningOn = patch.enabled === true || (patch.reminders === true && before.enabled);
    const granted = turningOn ? await ensureNotificationPermission() : true;
    if (!granted) toast.warning(t('profile.settings.notif.denied'), { duration: 7000 });
    // Android keeps already-scheduled reminders even when the setting changes: cancel them when
    // reminders go off (their times stay saved) and schedule them again when they come back on.
    // Not after a refusal: re-scheduling would ask for the permission again once per task.
    if (remindersBefore !== remindersAfter && (!remindersAfter || granted)) syncTaskReminders().catch(() => {});
  };

  // ---------- Units ----------
  const bighaValue = useMemo(() => {
    if (settings.bighaPreset && BIGHA_PRESETS.some(p => p.id === settings.bighaPreset)) return settings.bighaPreset;
    const match = BIGHA_PRESETS.find(p => p.id !== 'custom' && Math.abs(p.sqm - settings.bighaSqm) < 0.5);
    return match ? match.id : 'custom';
  }, [settings.bighaPreset, settings.bighaSqm]);

  const bighaOptions = useMemo(
    () =>
      BIGHA_PRESETS.map(p => {
        const label = language.code === 'en' ? p.labelEn : p.labelHi;
        return {
          value: p.id,
          label: p.id === 'custom' ? label : `${label} — ${formatNumber(p.sqm, 0)} ${t('profile.settings.units.sqm')}`,
        };
      }),
    [language.code, t],
  );

  const chooseBigha = (id: string) => {
    const preset = BIGHA_PRESETS.find(p => p.id === id);
    if (!preset) return;
    if (id === 'custom') {
      update({ bighaPreset: 'custom' });
      setCustomSqm(settings.bighaSqm);
    } else {
      update({ bighaPreset: id, bighaSqm: preset.sqm });
    }
  };

  const changeCustomSqm = (n: number | null) => {
    setCustomSqm(n);
    // Only commit plausible sizes (a bigha is roughly 600–2,600 m² across India); others show an error.
    if (bighaValid(n)) update({ bighaSqm: n, bighaPreset: 'custom' });
  };
  const customSqmError = customSqm != null && !bighaValid(customSqm) ? t('profile.settings.units.customError') : undefined;

  // ---------- Data ----------
  const exportData = async () => {
    try {
      track('share', { kind: 'data-export', native: isNative });
      // Web: the full file, downloaded.
      if (!isNative && downloadJSON(buildDataExport().json, `kisan-mitra-data-${todayISO()}.json`)) {
        toast.success(t('profile.settings.data.exported'));
        return;
      }
      // Phone (or a browser that cannot download): the share sheet takes text only, and Android
      // limits its size, so send it compact and trimmed to fit.
      const data = buildDataExport({ compact: true, maxChars: SHARE_TEXT_LIMIT });
      if (data.tooLarge) {
        toast.error(t('profile.settings.data.tooLarge'), { duration: 8000 });
        return;
      }
      const result = await shareText(t('profile.settings.data.shareTitle'), data.json);
      // 'failed' is also what a cancelled share sheet returns: say nothing then.
      if (result === 'failed') return;
      if (result === 'copied') toast.info(t('profile.settings.data.copied'));
      if (data.omitted.length) {
        const list = data.omitted.map(o => t(`profile.settings.data.omit.${o}`)).join(', ');
        toast.info(t('profile.settings.data.omitted', { list }), { duration: 8000 });
      }
    } catch {
      toast.error(t('profile.settings.data.exportFailed'));
    }
  };

  const deleteAll = async () => {
    const first = await confirm({
      title: t('profile.settings.data.delete1Title'),
      message: t('profile.settings.data.delete1Body'),
      confirmLabel: t('common.continue'),
      tone: 'danger',
      icon: Trash2,
    });
    if (!first) return;
    const second = await confirm({
      title: t('profile.settings.data.delete2Title'),
      message: t('profile.settings.data.delete2Body'),
      confirmLabel: t('profile.settings.data.delete2Confirm'),
      tone: 'danger',
      icon: Trash2,
    });
    if (!second) return;
    await wipeDeviceAndRestart();
  };

  const notifOn = settings.notifications.enabled;

  return (
    <Screen title={t('profile.settings.title')}>
      {/* Language */}
      <section aria-labelledby="set-language">
        <SectionTitle id="set-language">{t('profile.settings.section.language')}</SectionTitle>
        <ListGroup ariaLabel={t('profile.settings.section.language')}>
          <ListRow
            variant="plain"
            leading={<ToneIcon icon={Languages} tone="indigo" size="sm" />}
            title={t('profile.settings.language.row')}
            subtitle={t('profile.settings.language.sub')}
            trailing={
              <span className="text-small font-semibold text-ink-2" lang={language.code}>
                {language.label}
              </span>
            }
            chevron
            onPress={() => setLangOpen(true)}
          />
        </ListGroup>
      </section>

      {/* Appearance */}
      <section aria-labelledby="set-appearance">
        <SectionTitle id="set-appearance">{t('profile.settings.section.appearance')}</SectionTitle>
        <Card className="flex flex-col gap-1">
          <Toggle
            checked={settings.theme === 'dark'}
            onChange={v => update({ theme: v ? 'dark' : 'light' })}
            label={t('profile.settings.darkMode')}
            description={t('profile.settings.darkModeDesc')}
            icon={Moon}
          />
          <div className="flex flex-col gap-3 border-t border-line py-4">
            <p id="set-text-size" className="text-body font-semibold text-ink">
              {t('profile.settings.textSize')}
            </p>
            <SegmentedTabs
              ariaLabel={t('profile.settings.textSize')}
              value={String(settings.textScale)}
              onChange={v => {
                const next = TEXT_SCALES.find(s => s.value === v);
                if (next) update({ textScale: next.scale });
              }}
              options={TEXT_SCALES.map(s => ({ value: s.value, label: t(`profile.settings.textSize.${s.key}`) }))}
            />
            <p className="rounded-input bg-surface-2 px-4 py-3 text-body text-ink">
              {t('profile.settings.textSize.preview')}
            </p>
          </div>
          <div className="border-t border-line pt-1">
            <Toggle
              checked={settings.highContrast}
              onChange={v => update({ highContrast: v })}
              label={t('profile.settings.highContrast')}
              description={t('profile.settings.highContrastDesc')}
              icon={Contrast}
            />
          </div>
        </Card>
      </section>

      {/* Voice */}
      <section aria-labelledby="set-voice">
        <SectionTitle id="set-voice">{t('profile.settings.section.voice')}</SectionTitle>
        <Card padding="none" className="overflow-hidden">
          <ListRow
            variant="plain"
            leading={<ToneIcon icon={Volume2} tone="teal" size="sm" />}
            title={t('profile.settings.voice.row')}
            subtitle={currentVoice}
            subtitleLines={1}
            chevron
            onPress={() => setVoiceOpen(true)}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
            <span className="text-small text-ink-2">{t('profile.settings.voice.test')}</span>
            <ListenButton id={VOICE_TEST_ID} text={t('profile.settings.voice.sample')} />
          </div>
        </Card>
      </section>

      {/* Notifications */}
      <section aria-labelledby="set-notifications">
        <SectionTitle id="set-notifications">{t('profile.settings.section.notifications')}</SectionTitle>
        <Card className="flex flex-col gap-1">
          <Toggle
            checked={notifOn}
            onChange={v => setNotif({ enabled: v })}
            label={t('profile.settings.notif.master')}
            description={t('profile.settings.notif.masterDesc')}
            icon={Bell}
          />
          <div className="flex flex-col gap-1 border-t border-line pt-1">
            {VISIBLE_NOTIF_ROWS.map(row => (
              <Toggle
                key={row.key}
                checked={notifOn && settings.notifications[row.key]}
                disabled={!notifOn}
                onChange={v => setNotif({ [row.key]: v })}
                label={t(`profile.settings.notif.${row.key}`)}
                description={t(`profile.settings.notif.${row.key}Desc`)}
                icon={row.icon}
              />
            ))}
          </div>
        </Card>
        {!notifOn && (
          <Callout tone="warning" className="mt-3">
            {t('profile.settings.notif.offNote')}
          </Callout>
        )}
      </section>

      {/* Units */}
      <section aria-labelledby="set-units">
        <SectionTitle id="set-units">{t('profile.settings.section.units')}</SectionTitle>
        <Card className="flex flex-col gap-4">
          <SelectField
            label={t('profile.settings.units.bigha')}
            hint={t('profile.settings.units.bighaHint')}
            value={bighaValue}
            onChange={chooseBigha}
            options={bighaOptions}
          />
          {bighaValue === 'custom' && (
            <NumberField
              label={t('profile.settings.units.custom')}
              value={customSqm}
              onChange={changeCustomSqm}
              min={BIGHA_MIN_SQM}
              max={BIGHA_MAX_SQM}
              step={1}
              unit={t('profile.settings.units.sqm')}
              error={customSqmError}
            />
          )}
          <p className="rounded-input bg-brand-50 px-4 py-3 text-small font-semibold text-brand">
            {t('profile.settings.units.equals', {
              sqm: formatNumber(settings.bighaSqm, 0),
              acre: formatNumber(settings.bighaSqm / SQM_PER_ACRE, 2),
            })}
          </p>
        </Card>
      </section>

      {/* Data & privacy */}
      <section aria-labelledby="set-data">
        <SectionTitle id="set-data">{t('profile.settings.section.data')}</SectionTitle>
        <Callout tone="brand" icon={ShieldCheck} className="mb-3">
          {t('profile.settings.data.explainer')}
        </Callout>
        <ListGroup ariaLabel={t('profile.settings.section.data')}>
          <ListRow
            variant="plain"
            leading={<ToneIcon icon={Download} tone="sky" size="sm" />}
            title={t('profile.settings.data.export')}
            subtitle={t('profile.settings.data.exportDesc')}
            onPress={exportData}
          />
          <ListRow
            variant="plain"
            leading={<ToneIcon icon={Trash2} tone="red" size="sm" />}
            title={t('profile.settings.data.delete')}
            subtitle={t('profile.settings.data.deleteDesc')}
            onPress={deleteAll}
          />
          <ListRow
            variant="plain"
            leading={<ToneIcon icon={ShieldCheck} tone="teal" size="sm" />}
            title={t('profile.settings.data.policy')}
            onPress={() => nav.push('privacy')}
          />
        </ListGroup>
      </section>

      {/* About */}
      <section aria-labelledby="set-about">
        <SectionTitle id="set-about">{t('profile.settings.section.about')}</SectionTitle>
        <Card className="mb-3 flex flex-col items-center gap-1 text-center" padding="lg">
          <BrandLogo variant="full" size={112} alt={t('profile.settings.about.name')} />
          <p className="mt-2 text-card-title font-semibold text-ink">{t('profile.settings.about.tagline')}</p>
          <p className="text-small text-ink-2">{t('profile.version', { v: APP_VERSION })}</p>
          <p className="text-caption text-ink-3">{t('profile.settings.about.madeFor')}</p>
        </Card>
        <ListGroup ariaLabel={t('profile.settings.section.about')}>
          <ListRow
            variant="plain"
            leading={<ToneIcon icon={FileText} tone="gray" size="sm" />}
            title={t('profile.menu.terms')}
            onPress={() => nav.push('terms')}
          />
          <ListRow
            variant="plain"
            leading={<ToneIcon icon={ShieldCheck} tone="teal" size="sm" />}
            title={t('profile.menu.privacy')}
            onPress={() => nav.push('privacy')}
          />
          <ListRow
            variant="plain"
            leading={<ToneIcon icon={LifeBuoy} tone="rose" size="sm" />}
            title={t('profile.menu.help')}
            onPress={() => nav.push('help')}
          />
        </ListGroup>
      </section>

      <LanguageSheet
        open={langOpen}
        onClose={() => setLangOpen(false)}
        onSelect={code => {
          // A saved voice belongs to the old language; fall back to the phone's default voice.
          if (code !== language.code && settings.voiceURI) update({ voiceURI: null });
        }}
      />

      <Sheet
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        size="tall"
        title={t('profile.settings.voice.sheet')}
        description={t('profile.settings.voice.sheetDesc', { lang: language.label })}
      >
        {voices === null ? (
          <SkeletonList rows={4} variant="plain" media="circle" />
        ) : (
          <div className="flex flex-col gap-4">
            <ListGroup ariaLabel={t('profile.settings.voice.sheet')}>
              {[
                <ListRow
                  key={DEFAULT_VOICE}
                  variant="plain"
                  leading={<ToneIcon icon={Volume2} tone="teal" size="sm" />}
                  title={t('profile.settings.voice.default')}
                  subtitle={t('profile.settings.voice.defaultDesc')}
                  ariaLabel={selectedIndex < 0 ? selectedAria(t('profile.settings.voice.default')) : undefined}
                  trailing={selectedIndex < 0 ? <SelectedMark /> : undefined}
                  onPress={() => chooseVoice(DEFAULT_VOICE)}
                />,
                ...voices.map((v, i) => (
                  <ListRow
                    key={v.voiceURI}
                    variant="plain"
                    leading={<ToneIcon icon={Volume2} tone="gray" size="sm" />}
                    title={voiceLabel(v, i)}
                    subtitle={voiceDetail(v)}
                    subtitleLines={1}
                    ariaLabel={i === selectedIndex ? selectedAria(voiceLabel(v, i)) : undefined}
                    trailing={i === selectedIndex ? <SelectedMark /> : undefined}
                    onPress={() => chooseVoice(v.voiceURI)}
                  />
                )),
              ]}
            </ListGroup>
            {voices.length === 0 && (
              <Callout tone="info">{t('profile.settings.voice.none', { lang: language.label })}</Callout>
            )}
          </div>
        )}
      </Sheet>
    </Screen>
  );
}

/** Visual tick only: the row's accessible name already says "चुना गया". */
function SelectedMark() {
  return <Check aria-hidden className="size-6 shrink-0 text-brand" />;
}
