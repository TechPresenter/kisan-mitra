// Help centre: verified helpline, how-to guide tiles, FAQ accordion (with read-aloud) and feedback.
import './strings';
import './help-strings';
import { Bug, ChevronDown, CloudSun, FileText, IndianRupee, MessageSquareText, School, ShieldCheck, Sparkles, Sprout, Wallet } from 'lucide-react';
import {
  Button,
  Callout,
  Card,
  IconTile,
  ListGroup,
  ListRow,
  ListenButton,
  Screen,
  SectionHeader,
  TileGrid,
  ToneIcon,
  toast,
  type IconLike,
  type Tone,
} from '../../components/ui';
import { track } from '../../lib/analytics';
import { useLanguage, useT } from '../../lib/i18n';
import { useNav, type NavApi } from '../../lib/nav';
import { isNative, shareText } from '../../services/native';
import { APP_VERSION, SUPPORT_EMAIL } from './helpers';
import { FAQ_IDS } from './help-strings';
import { KisanCallCentreCard } from './helplines';

interface Guide {
  key: string;
  icon: IconLike;
  tone: Tone;
  go: (nav: NavApi) => void;
}

const GUIDES: Guide[] = [
  { key: 'addCrop', icon: Sprout, tone: 'green', go: nav => nav.push('crops') },
  { key: 'doctor', icon: Bug, tone: 'red', go: nav => nav.push('crop-doctor') },
  { key: 'ai', icon: Sparkles, tone: 'tech', go: nav => nav.switchTab('ai') },
  { key: 'mandi', icon: IndianRupee, tone: 'orange', go: nav => nav.switchTab('mandi') },
  { key: 'weather', icon: CloudSun, tone: 'sky', go: nav => nav.push('weather') },
  { key: 'hisab', icon: Wallet, tone: 'amber', go: nav => nav.push('hisab') },
];

export default function HelpScreen() {
  const t = useT();
  const nav = useNav();
  const { language } = useLanguage();

  // With an official support address the message goes straight to the team (email app);
  // without one the app only prepares it, and the copy never claims the team receives it.
  const sendFeedback = async () => {
    const text = t('profile.help.feedback.template', {
      version: APP_VERSION,
      lang: language.nameEn,
      platform: isNative ? 'Android' : 'Web',
    });
    track('share', { kind: 'feedback', direct: !!SUPPORT_EMAIL });
    if (SUPPORT_EMAIL) {
      const subject = encodeURIComponent(t('profile.help.feedback.shareTitle'));
      window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${encodeURIComponent(text)}`;
      return;
    }
    const result = await shareText(t('profile.help.feedback.shareTitle'), text);
    if (result === 'copied') toast.info(t('profile.help.feedback.copied'));
  };

  return (
    <Screen title={t('profile.help.title')} subtitle={t('profile.help.subtitle')}>
      {/* Talk to someone: verified helpline + KVK */}
      <section aria-labelledby="help-call" className="flex flex-col gap-3">
        <SectionHeader title={<span id="help-call">{t('profile.help.callTitle')}</span>} />
        <KisanCallCentreCard />
        <Callout tone="neutral" icon={School} title={t('profile.helpline.kvkTitle')}>
          {t('profile.helpline.kvkBody')}
        </Callout>
      </section>

      {/* How-to guides */}
      <section aria-labelledby="help-guides" className="flex flex-col gap-3">
        <SectionHeader title={<span id="help-guides">{t('profile.help.guides')}</span>} />
        <TileGrid columns={2}>
          {GUIDES.map(g => (
            <IconTile
              key={g.key}
              variant="card"
              icon={g.icon}
              tone={g.tone}
              label={t(`profile.help.guide.${g.key}`)}
              description={t(`profile.help.guide.${g.key}Desc`)}
              onPress={() => g.go(nav)}
            />
          ))}
        </TileGrid>
      </section>

      {/* FAQ accordion (native <details>: keyboard and screen-reader friendly, no JS state) */}
      <section aria-labelledby="help-faq" className="flex flex-col gap-3">
        <SectionHeader title={<span id="help-faq">{t('profile.help.faq')}</span>} />
        <div className="overflow-hidden rounded-list border border-line bg-surface">
          {FAQ_IDS.map((id, i) => {
            const q = t(`profile.help.faq.${id}.q`);
            const a = t(`profile.help.faq.${id}.a`);
            return (
              <details key={id} className={`group ${i > 0 ? 'border-t border-line' : ''}`}>
                <summary className="press flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 text-body leading-snug font-semibold text-ink hover:bg-surface-2/60 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-1">{q}</span>
                  <ChevronDown aria-hidden className="size-5 shrink-0 text-ink-3 transition-transform duration-150 group-open:rotate-180" />
                </summary>
                <div className="flex flex-col gap-3 px-4 pb-4">
                  <p className="text-body leading-relaxed text-ink-2">{a}</p>
                  <ListenButton id={`help-faq-${id}`} text={`${q} ${a}`} className="self-start" />
                </div>
              </details>
            );
          })}
        </div>
      </section>

      {/* Feedback */}
      <Card as="section" aria-labelledby="help-feedback" className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <ToneIcon icon={MessageSquareText} tone="indigo" />
          <div className="min-w-0 flex-1">
            <h2 id="help-feedback" className="text-card-title font-semibold text-ink">
              {t('profile.help.feedback.title')}
            </h2>
            <p className="mt-0.5 text-small text-ink-2">
              {SUPPORT_EMAIL ? t('profile.help.feedback.bodyDirect') : t('profile.help.feedback.body')}
            </p>
          </div>
        </div>
        <Button variant="secondary" fullWidth icon={MessageSquareText} onClick={sendFeedback}>
          {SUPPORT_EMAIL ? t('profile.help.feedback.buttonDirect') : t('profile.help.feedback.button')}
        </Button>
      </Card>

      <section aria-labelledby="help-more">
        <h2 id="help-more" className="mb-2 px-1 text-small font-semibold text-ink-2">
          {t('profile.help.more')}
        </h2>
        <ListGroup ariaLabel={t('profile.help.more')}>
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
    </Screen>
  );
}
