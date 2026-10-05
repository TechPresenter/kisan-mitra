// Expert consultation ('experts'). FEATURES.experts is false until verified experts and payments
// exist, so farmers see a "जल्द आ रहा है" preview with AI and Kisan Call Centre as help right now.
// The full list (name, specialization, experience, languages, availability, fee, चैट/कॉल) is wired
// to services/community's ExpertAdapter and never shows invented experts.
import './strings';
import '../community/strings';
import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, CalendarClock, CircleCheck, IndianRupee, MessageCircle, Phone, ShieldCheck, Sparkles, Video } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  ChipGroup,
  EmptyState,
  ErrorState,
  LastUpdated,
  MicButton,
  Screen,
  SectionHeader,
  Sheet,
  SkeletonList,
  TextArea,
  toast,
  type IconLike,
} from '../../components/ui';
import { EmptyArt } from '../../components/illustrations';
import { HOUR, useResource } from '../../lib/cache';
import { FEATURES } from '../../lib/features';
import { formatDate, formatINR, formatTime, toISODate } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { useNav } from '../../lib/nav';
import { experts, type ConsultationBooking, type ConsultationMode } from '../../services/community';
import type { Expert } from '../../types/models';
import { ComingSoonHero, FeatureList, HelpNow, communityErrorKey, type FeatureItem } from '../community/parts';

const MODE_ICON: Record<ConsultationMode, IconLike> = { chat: MessageCircle, voice: Phone, video: Video };
const PLANNED_SPECS = ['pests', 'soil', 'horticulture', 'irrigation', 'organic', 'livestock'] as const;

export default function ExpertsScreen() {
  const t = useT();
  // The preview also covers "flag on, backend not plugged in yet" (setExpertAdapter not called).
  if (!FEATURES.experts || !experts.available) {
    return (
      <Screen title={t('experts.title')} subtitle={t('experts.subtitle')}>
        <ExpertsComingSoon />
      </Screen>
    );
  }
  return <ExpertsList />;
}

function ExpertsComingSoon() {
  const t = useT();
  const items = useMemo<FeatureItem[]>(
    () => [
      { key: 'chat', icon: MessageCircle, tone: 'green', title: t('experts.soon.f.chat'), description: t('experts.soon.f.chatDesc') },
      { key: 'voice', icon: Phone, tone: 'sky', title: t('experts.soon.f.voice'), description: t('experts.soon.f.voiceDesc') },
      { key: 'video', icon: Video, tone: 'indigo', title: t('experts.soon.f.video'), description: t('experts.soon.f.videoDesc') },
      { key: 'fee', icon: IndianRupee, tone: 'amber', title: t('experts.soon.f.fee'), description: t('experts.soon.f.feeDesc') },
      { key: 'verified', icon: ShieldCheck, tone: 'teal', title: t('experts.soon.f.verified'), description: t('experts.soon.f.verifiedDesc') },
    ],
    [t],
  );
  return (
    <>
      <ComingSoonHero title={t('experts.soon.title')} body={t('experts.soon.body')} art="chat" />
      <FeatureList id="experts-features" title={t('experts.soon.features')} items={items} />
      <section aria-labelledby="experts-specs" className="flex flex-col gap-3">
        <SectionHeader title={<span id="experts-specs">{t('experts.soon.specsTitle')}</span>} />
        <ul className="flex flex-wrap gap-2">
          {PLANNED_SPECS.map(s => (
            <li key={s}>
              <Badge tone="gray" size="md">
                {t(`experts.spec.${s}`)}
              </Badge>
            </li>
          ))}
        </ul>
      </section>
      <HelpNow />
    </>
  );
}

// ---------- Full UI (FEATURES.experts) ----------

function ExpertCard({ expert, onBook }: { expert: Expert; onBook: (mode: ConsultationMode) => void }) {
  const t = useT();
  // A partial or cached payload may leave lists out.
  const languages = Array.isArray(expert.languages) ? expert.languages : [];
  const modes = (Array.isArray(expert.modes) ? expert.modes : []).filter(m => m in MODE_ICON);
  const fee = typeof expert.feeInr === 'number' && expert.feeInr > 0 ? expert.feeInr : 0;
  return (
    <Card as="li" className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Avatar name={expert.name} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-card-title leading-snug font-semibold text-ink">{expert.name}</p>
          <p className="text-small text-ink-2">{expert.specialization}</p>
          <Badge tone="green" icon={BadgeCheck} className="mt-1.5">
            {t('experts.verified')}
          </Badge>
        </div>
      </div>
      <ul className="flex flex-col gap-1 text-small text-ink-2">
        {expert.experienceYears > 0 && <li>{t('experts.experience', { n: expert.experienceYears })}</li>}
        {languages.length > 0 && <li>{t('experts.languages', { list: languages.join(', ') })}</li>}
        {expert.availability && <li>{t('experts.availability', { text: expert.availability })}</li>}
      </ul>
      <p className="text-body font-bold text-brand">
        {fee > 0 ? t('experts.fee', { fee: formatINR(fee) }) : t('experts.free')}
      </p>
      <div className="flex flex-wrap gap-2">
        {modes.map((mode, i) => (
          <Button
            key={mode}
            variant={i === 0 ? 'primary' : 'secondary'}
            icon={MODE_ICON[mode]}
            className="min-w-24 flex-1"
            aria-label={t('experts.modeAria', { name: expert.name, mode: t(`experts.mode.${mode}`) })}
            onClick={() => onBook(mode)}
          >
            {t(`experts.mode.${mode}`)}
          </Button>
        ))}
      </div>
    </Card>
  );
}

function BookSheet({ booking, onClose }: { booking: { expert: Expert; mode: ConsultationMode } | null; onClose: () => void }) {
  const t = useT();
  const [question, setQuestion] = useState('');
  const [sending, setSending] = useState(false);
  /** What the backend confirmed (fee, status, time): shown to the farmer before the sheet closes. */
  const [result, setResult] = useState<ConsultationBooking | null>(null);

  // A new expert or mode starts with a blank request (never a question typed for someone else).
  const expertId = booking?.expert.id;
  const mode = booking?.mode;
  useEffect(() => {
    setQuestion('');
    setResult(null);
  }, [expertId, mode]);

  const listedFee = booking && booking.expert.feeInr > 0 ? booking.expert.feeInr : 0;

  const send = async () => {
    if (!booking || sending) return;
    setSending(true);
    try {
      const res = await experts.requestConsultation({
        expertId: booking.expert.id,
        mode: booking.mode,
        question: question.trim() || undefined,
      });
      if (!res || typeof res.feeInr !== 'number') throw new Error('bad booking');
      setResult(res);
    } catch (e) {
      toast.error(t(communityErrorKey(e)));
    } finally {
      setSending(false);
    }
  };

  const done = () => {
    toast.success(t(result?.status === 'confirmed' ? 'experts.book.confirmedToast' : 'experts.book.sent'));
    onClose();
  };

  const modeLabel = booking ? t(`experts.mode.${booking.mode}`) : '';
  const feeText = (fee: number) => (fee > 0 ? formatINR(fee) : t('experts.free'));
  const scheduled = result?.scheduledAt ? new Date(result.scheduledAt) : null;
  const when = scheduled && !Number.isNaN(scheduled.getTime()) ? scheduled : null;
  const confirmed = result?.status === 'confirmed';

  return (
    <Sheet
      open={!!booking}
      onClose={onClose}
      title={result ? t('experts.book.reviewTitle') : t('experts.book.title', { mode: modeLabel })}
      description={booking ? t('experts.book.with', { name: booking.expert.name, spec: booking.expert.specialization }) : undefined}
      footer={
        result ? (
          <Button fullWidth size="lg" icon={CircleCheck} onClick={done}>
            {t('experts.book.done')}
          </Button>
        ) : (
          <Button fullWidth size="lg" loading={sending} onClick={send}>
            {t('experts.book.send')}
          </Button>
        )
      }
    >
      {booking && !result && (
        <div className="flex flex-col gap-4">
          <Card tone="brand" className="flex items-center justify-between gap-3">
            <span className="text-body font-semibold text-ink">{t('experts.book.fee')}</span>
            <span className="text-section font-bold text-brand">{feeText(listedFee)}</span>
          </Card>
          <Callout tone="info">{t('experts.book.feeNote')}</Callout>
          <TextArea
            label={t('experts.book.question')}
            optional
            value={question}
            onChange={setQuestion}
            placeholder={t('experts.book.questionPlaceholder')}
            maxLength={500}
            trailing={<MicButton size="sm" onResult={text => setQuestion(prev => (prev.trim() ? `${prev.trim()} ${text}` : text))} />}
          />
        </div>
      )}
      {booking && result && (
        <div className="flex flex-col gap-4">
          <Card tone="brand" className="flex items-center justify-between gap-3">
            <span className="text-body font-semibold text-ink">{t('experts.book.confirmedFee')}</span>
            <span className="text-section font-bold text-brand">{feeText(result.feeInr)}</span>
          </Card>
          {result.feeInr !== listedFee && (
            <Callout tone="warning" title={t('experts.book.feeChangedTitle')}>
              {t('experts.book.feeChanged', { listed: feeText(listedFee), fee: feeText(result.feeInr) })}
            </Callout>
          )}
          <Callout tone={confirmed ? 'brand' : 'info'} icon={confirmed ? CircleCheck : CalendarClock} role="status">
            {t(confirmed ? 'experts.book.status.confirmed' : 'experts.book.status.requested')}
            {when && (
              <span className="mt-1 block font-semibold">
                {t('experts.book.when', { date: formatDate(toISODate(when), { weekday: true }), time: formatTime(when) })}
              </span>
            )}
          </Callout>
          <p className="text-small text-ink-2">{t('experts.book.noCharge')}</p>
        </div>
      )}
    </Sheet>
  );
}

function ExpertsList() {
  const t = useT();
  const nav = useNav();
  const [spec, setSpec] = useState('all');
  const [booking, setBooking] = useState<{ expert: Expert; mode: ConsultationMode } | null>(null);
  const res = useResource<Expert[]>('experts.list', () => experts.listExperts(), { maxAgeMs: HOUR });

  const list = res.data || [];
  const specOptions = useMemo(
    () => [{ value: 'all', label: t('experts.filter.all') }, ...[...new Set(list.map(e => e.specialization))].map(s => ({ value: s, label: s }))],
    [list, t],
  );
  const shown = useMemo(() => (spec === 'all' ? list : list.filter(e => e.specialization === spec)), [list, spec]);

  return (
    <Screen title={t('experts.title')} subtitle={t('experts.subtitle')} onRefresh={res.refresh} refreshing={res.refreshing}>
      {res.loading ? (
        <SkeletonList rows={4} media="circle" />
      ) : res.error && !res.data ? (
        <ErrorState error={res.error} onRetry={res.refresh} retrying={res.refreshing} />
      ) : !list.length ? (
        <EmptyState
          art={<EmptyArt kind="chat" />}
          title={t('experts.empty')}
          body={t('experts.emptyBody')}
          action={{ label: t('experts.emptyAction'), icon: Sparkles, onPress: () => nav.switchTab('ai') }}
        />
      ) : (
        <>
          <LastUpdated at={res.fetchedAt} stale={res.stale || !!res.error} refreshing={res.refreshing} onRefresh={res.refresh} />
          {specOptions.length > 2 && <ChipGroup ariaLabel={t('experts.filter')} value={spec} onChange={setSpec} options={specOptions} />}
          <ul aria-label={t('experts.listAria')} className="flex flex-col gap-3">
            {shown.map(expert => (
              <ExpertCard key={expert.id} expert={expert} onBook={mode => setBooking({ expert, mode })} />
            ))}
          </ul>
        </>
      )}
      <BookSheet booking={booking} onClose={() => setBooking(null)} />
    </Screen>
  );
}
