// रिजल्ट (reference screen 7): the AI's preliminary diagnosis for one photo, always labelled as
// an estimate with the AI disclaimer, plus the knowledge-base entry when the issue matches one.
import './strings';
import { useMemo, useState } from 'react';
import {
  BookOpen,
  Bookmark,
  BookmarkCheck,
  CalendarCheck,
  CalendarClock,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  ExternalLink,
  FlaskConical,
  History,
  Leaf,
  ScanSearch,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Zap,
} from 'lucide-react';
import { CropArt, EmptyArt } from '../../components/illustrations';
import {
  Badge,
  Button,
  Callout,
  Card,
  Disclaimer,
  EmptyState,
  ListRow,
  ListenButton,
  Screen,
  Sheet,
  TONE_TEXT,
  Thumbnail,
  ToneIcon,
  cx,
  toast,
  type IconLike,
  type Tone,
} from '../../components/ui';
import { DISEASES_REVIEWED_ON, type DiseaseInfo } from '../../data/diseases';
import { track } from '../../lib/analytics';
import { getSettings } from '../../lib/app-state';
import { addDays, formatDate, formatUpdated, parseISODate, todayISO } from '../../lib/format';
import { useLanguage, useT } from '../../lib/i18n';
import { useNav, useRoute } from '../../lib/nav';
import {
  LOW_CONFIDENCE,
  diagnosisCropName,
  farmerCropFor,
  knowledgeFor,
  mentionsDose,
  scheduleRecheck,
  useDiagnoses,
  useRecheckTask,
} from '../../services/diagnosis';
import { shareText } from '../../services/native';
import { useSaved } from '../../services/saved';
import { setTaskReminder } from '../../services/tasks';
import type { CropDiagnosis } from '../../types/models';
import { BulletList, ListSection, PhotoTips, confidenceTone } from './parts';

/** Reminder time for the recheck task: 8 AM on the due date. */
const MORNING_HOUR = 8;

export default function DiagnosisResultScreen() {
  const t = useT();
  const nav = useNav();
  const { params } = useRoute<{ id?: string }>();
  const { language } = useLanguage();
  const lang = language.code;
  const history = useDiagnoses();
  const d = params.id ? history.get(params.id) : undefined;

  const prevScreen = nav.stack[nav.stack.length - 2]?.screen;
  const goToDoctor = () => {
    if (prevScreen === 'crop-doctor') nav.pop();
    else nav.replace('crop-doctor', d ? { cropKey: d.cropKey } : {});
  };
  const goToHistory = () => {
    if (prevScreen === 'diagnosis-history') nav.pop();
    else nav.push('diagnosis-history');
  };

  const actions = [{ key: 'history', icon: History, label: t('doctor.historyAction'), onPress: goToHistory }];

  if (!d) {
    return (
      <Screen title={t('doctor.result.title')} subtitle={t('doctor.result.subtitle')} actions={actions}>
        <EmptyState
          art={<EmptyArt kind="search" />}
          title={t('doctor.result.notFound')}
          body={t('doctor.result.notFoundBody')}
          action={{ label: t('doctor.result.newCheck'), icon: ScanSearch, onPress: goToDoctor }}
        />
      </Screen>
    );
  }

  return (
    <Screen title={t('doctor.result.title')} subtitle={t('doctor.result.subtitle')} actions={actions}>
      <ResultBody d={d} lang={lang} onRetake={goToDoctor} />
    </Screen>
  );
}

function ResultBody({ d, lang, onRetake }: { d: CropDiagnosis; lang: string; onRetake: () => void }) {
  const t = useT();
  const nav = useNav();
  const saved = useSaved();
  const recheck = useRecheckTask(d.id);
  const kb = useMemo(() => knowledgeFor(d), [d]);
  const [expanded, setExpanded] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);

  const crop = diagnosisCropName(d, lang);
  const unusable = !!d.unusableReason;
  const low = !unusable && d.confidence < LOW_CONFIDENCE;
  const tone = confidenceTone(d.confidence);
  const showEn = !!d.issueEn && d.issueEn.toLowerCase() !== d.issue.toLowerCase() && !unusable;
  const issueLabel = showEn ? `${d.issue} (${d.issueEn})` : d.issue;
  const isSaved = saved.isSaved('diagnosis', d.id);
  const hasMore = !d.healthy && (d.organic.length > 0 || d.chemical.length > 0 || d.prevention.length > 0);
  // A spray dose outside the chemical card (the prompt forbids it, models still do it) gets the
  // same safety note there, on screen, in the spoken text and in the shared text.
  const doseInImmediate = useMemo(() => d.immediate.some(mentionsDose), [d.immediate]);
  const doseInPrevention = useMemo(() => d.prevention.some(mentionsDose), [d.prevention]);

  const confidenceText = t('doctor.result.confidence', { n: d.confidence });

  const speech = useMemo(() => {
    if (unusable) return '';
    const sep = lang === 'en' ? '. ' : '। ';
    const parts = [`${crop}: ${d.healthy ? t('doctor.result.healthyTitle') : d.issue}.`, t('doctor.result.speakConfidence', { n: d.confidence })];
    if (d.healthy) {
      parts.push(t('doctor.result.healthyBody'));
      if (d.prevention.length) parts.push(`${t('doctor.result.prevention')}: ${d.prevention.join(sep)}`);
    } else {
      if (d.symptoms.length) parts.push(`${t('doctor.result.symptoms')}: ${d.symptoms.join(sep)}`);
      if (d.immediate.length) parts.push(`${t('doctor.result.immediate')}: ${d.immediate.join(sep)}`);
    }
    if (doseInImmediate || (d.healthy && doseInPrevention)) parts.push(t('doctor.result.chemSafety'));
    parts.push(t('common.disclaimer.ai'));
    return parts.join(' ');
  }, [d, crop, unusable, lang, t, doseInImmediate, doseInPrevention]);

  const toggleSave = () => {
    const nowSaved = saved.toggle({
      type: 'diagnosis',
      refId: d.id,
      title: `${issueLabel} — ${crop}`,
      snippet: d.healthy ? t('doctor.result.healthyBody') : d.symptoms[0] || d.immediate[0] || confidenceText,
      target: { screen: 'diagnosis', params: { id: d.id } },
    });
    toast.success(nowSaved ? t('common.saved') : t('doctor.result.unsaved'), { id: 'doctor-save' });
  };

  const share = async () => {
    const bullet = (title: string, items: string[]) => (items.length ? ['', `${title}:`, ...items.map(i => `• ${i}`)] : []);
    const lines = [
      t('doctor.result.shareTitle', { crop }),
      d.healthy ? t('doctor.result.healthyTitle') : t('doctor.result.shareIssue', { issue: issueLabel }),
      `${confidenceText} (${t('doctor.result.estimate')})`,
      ...(d.healthy ? bullet(t('doctor.result.prevention'), d.prevention) : [...bullet(t('doctor.result.symptoms'), d.symptoms), ...bullet(t('doctor.result.immediate'), d.immediate)]),
      '',
      ...(doseInImmediate || (d.healthy && doseInPrevention) ? [t('doctor.result.chemSafety')] : []),
      t('common.disclaimer.ai'),
      t('doctor.result.shareFooter'),
    ];
    const result = await shareText(t('doctor.result.shareTitle', { crop }), lines.join('\n'));
    if (result === 'copied') toast.success(t('common.copied'));
    if (result !== 'failed') track('share', { type: 'diagnosis' });
  };

  const openCalendar = () => nav.push('calendar', recheck?.cropId ? { cropId: recheck.cropId } : {});

  const addRecheck = () => {
    const { task, created } = scheduleRecheck(d, 3);
    toast.success(t('doctor.result.recheckAdded', { date: formatDate(task.dueDate) }), {
      id: 'doctor-recheck',
      action: { label: t('doctor.result.openCalendar'), onPress: () => nav.push('calendar', task.cropId ? { cropId: task.cropId } : {}) },
    });
    const s = getSettings().notifications;
    if (created && s.enabled && s.reminders) {
      const at = parseISODate(task.dueDate);
      at.setHours(MORNING_HOUR, 0, 0, 0);
      setTaskReminder(task, at).catch(() => {});
    }
  };

  const askAI = () => {
    const symptoms = d.symptoms.length ? t('doctor.result.askSymptoms', { list: d.symptoms.slice(0, 3).join('; ') }) : '';
    const prompt = t('doctor.result.askPrompt', { crop, issue: issueLabel, symptoms });
    // The chat keeps the farmer's current field of this crop as context (when they track it).
    nav.switchTab('ai', { screen: 'ai', params: { prompt, cropId: farmerCropFor(d.cropKey)?.id } });
  };

  return (
    <>
      {/* Photo, crop, issue and confidence */}
      <Card as="section" padding="none" aria-label={t('doctor.result.title')}>
        <div className="flex gap-4 p-4">
          <Thumbnail
            src={d.image || null}
            alt={t('doctor.result.photoAlt', { crop })}
            size="xl"
            fallback={<CropArt crop={d.cropKey} size={96} />}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <CropArt crop={d.cropKey} size={28} />
              <span className="pt-0.5 text-small font-medium text-ink-2">{crop}</span>
            </div>
            <h2 className="mt-2 text-section leading-snug font-bold text-ink">
              {d.healthy && <CircleCheck aria-hidden className="mr-1.5 -mt-1 inline size-5 text-tone-green" />}
              {unusable ? t('doctor.history.unusable') : d.issue}
              {showEn && <span className="font-semibold text-ink-2"> ({d.issueEn})</span>}
            </h2>
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1 border-t border-line px-4 py-3">
          {!unusable && (
            <div>
              <p className={cx('text-[1.75rem] leading-snug font-bold', TONE_TEXT[tone])}>{confidenceText}</p>
              <p className="text-caption text-ink-2">{t('doctor.result.estimate')}</p>
            </div>
          )}
          <p className="text-caption text-ink-2">{t('doctor.result.checkedOn', { date: formatUpdated(d.createdAt) })}</p>
        </div>
      </Card>

      {unusable ? (
        <>
          <Callout
            tone="warning"
            role="alert"
            title={t('doctor.result.unusableTitle')}
            action={
              <Button icon={Camera} onClick={onRetake}>
                {t('doctor.result.retake')}
              </Button>
            }
          >
            <p>{d.unusableReason}</p>
            <p className="mt-1">{t('doctor.result.unusableHelp')}</p>
          </Callout>
          <PhotoTips />
        </>
      ) : (
        <>
          <div role="group" aria-label={t('doctor.result.actions')} className="grid grid-cols-3 gap-2">
            <ListenButton id={`diagnosis-${d.id}`} text={speech} className="w-full justify-center px-2" />
            <Button variant="soft" icon={isSaved ? BookmarkCheck : Bookmark} aria-pressed={isSaved} onClick={toggleSave} className="px-2 text-small">
              {isSaved ? t('common.saved') : t('common.save')}
            </Button>
            <Button variant="soft" icon={Share2} onClick={share} className="px-2 text-small">
              {t('common.share')}
            </Button>
          </div>

          {/* Mandatory AI disclaimer, with a clearer-photo/KVK line when the AI is unsure. */}
          <Callout tone={low ? 'warning' : 'tech'} title={t('doctor.result.notice')}>
            <p>{t('common.disclaimer.ai')}</p>
            {low && <p className="mt-2 font-medium text-ink">{t('doctor.result.lowConfidence')}</p>}
          </Callout>

          {d.healthy ? (
            <>
              <Callout tone="brand" icon={CircleCheck} title={t('doctor.result.healthyTitle')}>
                {t('doctor.result.healthyBody')}
              </Callout>
              <ListSection title={t('doctor.result.seen')} icon={Search} tone="sky" items={d.symptoms} />
              <ListSection title={t('doctor.result.prevention')} icon={ShieldCheck} tone="teal" items={d.prevention}>
                {doseInPrevention && <SafetyNote />}
              </ListSection>
              <ListSection title={t('doctor.result.immediate')} icon={Zap} tone="orange" items={d.immediate}>
                {doseInImmediate && <SafetyNote />}
              </ListSection>
              <ListSection title={t('doctor.result.organic')} icon={Leaf} tone="green" items={d.organic} />
            </>
          ) : (
            <>
              <ListSection title={t('doctor.result.symptoms')} icon={Stethoscope} tone="orange" items={d.symptoms} />
              <ListSection title={t('doctor.result.causes')} icon={Search} tone="sky" items={d.causes} />
              <ListSection title={t('doctor.result.immediate')} icon={Zap} tone="red" items={d.immediate}>
                {doseInImmediate && <SafetyNote />}
              </ListSection>

              {hasMore && (
                <Button
                  fullWidth
                  size="lg"
                  variant="secondary"
                  iconRight={expanded ? ChevronUp : ChevronDown}
                  aria-expanded={expanded}
                  aria-controls="diagnosis-more"
                  onClick={() => setExpanded(e => !e)}
                >
                  {expanded ? t('doctor.result.less') : t('doctor.result.more')}
                </Button>
              )}
              <div id="diagnosis-more" hidden={!expanded} className="flex flex-col gap-5">
                <ListSection title={t('doctor.result.organic')} icon={Leaf} tone="green" items={d.organic} />
                <ListSection title={t('doctor.result.chemical')} icon={FlaskConical} tone="amber" items={d.chemical}>
                  {d.chemical.length > 0 ? (
                    <SafetyNote />
                  ) : (
                    // Viral or nutrient problems, or every line dropped as a banned active.
                    <p className="text-small text-ink-2">{t('doctor.result.noChemical')}</p>
                  )}
                </ListSection>
                <ListSection title={t('doctor.result.prevention')} icon={ShieldCheck} tone="teal" items={d.prevention}>
                  {doseInPrevention && <SafetyNote />}
                </ListSection>
              </div>

              {kb && (
                <ListRow
                  leading={<ToneIcon icon={BookOpen} tone="teal" />}
                  title={t('doctor.result.kbTitle')}
                  subtitle={t('doctor.result.kbSubtitle', { name: lang === 'en' ? kb.nameEn : kb.nameHi })}
                  onPress={() => setKbOpen(true)}
                />
              )}

              <Callout
                tone="tech"
                title={t('doctor.result.askHeading')}
                action={
                  <Button variant="tech" icon={Sparkles} onClick={askAI}>
                    {t('doctor.result.askTitle')}
                  </Button>
                }
              >
                {t('doctor.result.askBody')}
              </Callout>

              <ListRow
                leading={<ToneIcon icon={recheck ? CalendarCheck : CalendarClock} tone="orange" />}
                title={t('doctor.result.recheck')}
                subtitle={
                  recheck
                    ? t('doctor.result.recheckSet', { date: formatDate(recheck.dueDate) })
                    : t('doctor.result.recheckHint', { date: formatDate(addDays(todayISO(), 3)) })
                }
                trailing={recheck ? <Badge tone="green" icon={Check}>{t('doctor.result.recheckBadge')}</Badge> : undefined}
                chevron
                onPress={recheck ? openCalendar : addRecheck}
              />
            </>
          )}

          <Button fullWidth variant="ghost" icon={ScanSearch} onClick={onRetake}>
            {t('doctor.result.newCheck')}
          </Button>
        </>
      )}

      {kb && <KnowledgeSheet open={kbOpen} onClose={() => setKbOpen(false)} entry={kb} lang={lang} />}
    </>
  );
}

/** Mask, gloves, label dose: shown wherever a spray dose appears. */
function SafetyNote() {
  const t = useT();
  return (
    <Disclaimer variant="warning" className="mt-4">
      {t('doctor.result.chemSafety')}
    </Disclaimer>
  );
}

function KbBlock({ title, icon, tone, items }: { title: string; icon: IconLike; tone: Tone; items: string[] }) {
  if (!items.length) return null;
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <ToneIcon icon={icon} tone={tone} size="sm" />
        <h3 className="text-card-title leading-snug font-semibold text-ink">{title}</h3>
      </div>
      <BulletList items={items} tone={tone} />
    </section>
  );
}

/** "और जानकारी": the offline knowledge-base entry (Hindi body text) with its sources. */
function KnowledgeSheet({ open, onClose, entry, lang }: { open: boolean; onClose: () => void; entry: DiseaseInfo; lang: string }) {
  const t = useT();
  const title = lang === 'en' ? `${entry.nameEn} (${entry.nameHi})` : `${entry.nameHi} (${entry.nameEn})`;
  return (
    <Sheet open={open} onClose={onClose} title={title} description={t('doctor.result.kbDesc')} size="tall">
      <div className="flex flex-col gap-6">
        {entry.scientificName && <p className="-mt-2 text-small text-ink-2 italic">{entry.scientificName}</p>}
        {/* The knowledge base is written in Hindi only. */}
        {lang !== 'hi' && (
          <Callout tone="info" icon={null} className="-mt-2">
            {t('doctor.result.kbHindiOnly')}
          </Callout>
        )}
        <KbBlock title={t('doctor.result.symptoms')} icon={Stethoscope} tone="orange" items={entry.symptomsHi} />
        <KbBlock title={t('doctor.result.organic')} icon={Leaf} tone="green" items={entry.organicHi} />
        <KbBlock title={t('doctor.result.chemical')} icon={FlaskConical} tone="amber" items={entry.chemicalHi} />
        <KbBlock title={t('doctor.result.prevention')} icon={ShieldCheck} tone="teal" items={entry.preventionHi} />
        {entry.sources.length > 0 && (
          <section>
            <h3 className="mb-2 text-card-title leading-snug font-semibold text-ink">{t('common.sources')}</h3>
            <ul className="overflow-hidden rounded-list border border-line">
              {entry.sources.map((s, i) => (
                <li key={s.uri} className={cx(i > 0 && 'border-t border-line')}>
                  <a
                    href={s.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('doctor.result.kbSourceOpen', { title: s.title })}
                    className="flex min-h-12 items-center gap-3 px-4 py-3 text-small text-brand hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1">{s.title}</span>
                    <ExternalLink aria-hidden className="size-4 shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
        <Disclaimer variant="info">{t('doctor.result.kbNote')}</Disclaimer>
        <p className="text-caption text-ink-2">{t('doctor.result.kbReviewed', { date: formatDate(DISEASES_REVIEWED_ON, { year: true }) })}</p>
      </div>
    </Sheet>
  );
}
