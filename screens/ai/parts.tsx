// Message UI shared by the AI chat and voice screens: bubbles, the structured answer card with
// its action row, sources, disclaimers, typing and error bubbles.
import { memo, useMemo, useState, type ReactNode } from 'react';
import {
  Ban,
  Bookmark,
  BookmarkCheck,
  CalendarClock,
  CircleCheck,
  CloudOff,
  Copy,
  ExternalLink,
  ImageOff,
  MessageCirclePlus,
  Mic,
  RefreshCw,
  ScanSearch,
  Share2,
  Stethoscope,
} from 'lucide-react';
import {
  Badge,
  Button,
  Chip,
  Disclaimer,
  ListenButton,
  SkeletonText,
  TONE_FILL,
  ToneIcon,
  cx,
  renderIcon,
  toast,
  type IconLike,
  type Tone,
} from '../../components/ui';
import { BrandLogo } from '../../components/brand/BrandLogo';
import { track } from '../../lib/analytics';
import { formatUpdated } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { copyText, shareText } from '../../services/native';
import { toggleSaved } from '../../services/saved';
import type { GroundingSource, StructuredAnswer } from '../../types/models';
import { answerText, disclaimerText, disclaimersFor, hostOf, previewOf, spokenAnswer, type ChatMessage, type DisclaimerKind } from './engine';
import './strings';

/**
 * Chips whose text may be long (suggestions, AI follow-ups): they wrap onto a second line instead
 * of running off a 360px screen, and stay 48px tall at least.
 */
export const WRAP_CHIP = 'min-h-12! max-w-full shrink! whitespace-normal! rounded-3xl! py-2 text-left leading-snug';

/** "किसान मित्र" with the brand mark, at the top of every assistant card. */
function AssistantHeader() {
  const t = useT();
  return (
    <div className="mb-2 flex items-center gap-2">
      <BrandLogo variant="mark" size={28} alt="" />
      <span className="text-small font-semibold text-brand">{t('ai.chat.assistant')}</span>
    </div>
  );
}

/** Splits plain text into paragraphs on blank lines; single newlines stay as line breaks. */
export function Paragraphs({ text, className }: { text: string; className?: string }) {
  const paras = useMemo(
    () =>
      text
        .split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(Boolean),
    [text],
  );
  if (!paras.length) return null;
  return (
    <div className={cx('flex flex-col gap-2.5 text-body leading-relaxed text-ink', className)}>
      {paras.map((p, i) => (
        <p key={i} className="break-words whitespace-pre-line">
          {p}
        </p>
      ))}
    </div>
  );
}

// ---------- Farmer's message ----------

export const UserBubble = memo(function UserBubble({ m }: { m: ChatMessage }) {
  const t = useT();
  return (
    <div className="flex flex-col items-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-700 px-4 py-3 text-white">
        {m.image ? (
          <img
            src={m.image}
            alt={t('ai.answer.photoAlt')}
            decoding="async"
            className={cx('max-h-56 w-full rounded-xl object-cover', m.text && 'mb-2')}
          />
        ) : m.imageDropped ? (
          <p className={cx('flex items-center gap-1.5 text-caption', m.text && 'mb-1.5')}>
            <ImageOff aria-hidden className="size-4 shrink-0" />
            <span>{t('ai.answer.photoDropped')}</span>
          </p>
        ) : null}
        {m.text && <p className="text-body leading-relaxed break-words whitespace-pre-line">{m.text}</p>}
      </div>
      <p className="mt-1 flex items-center gap-1 px-1 text-caption text-ink-3">
        {m.viaVoice && (
          <>
            <Mic aria-hidden className="size-3.5" />
            <span>{t('ai.answer.viaVoice')} •</span>
          </>
        )}
        <time dateTime={m.createdAt}>{formatUpdated(m.createdAt)}</time>
      </p>
    </div>
  );
});

// ---------- Assistant pieces ----------

/**
 * Left-aligned white answer card. It spans the column (no avatar gutter) so the action row and
 * structured sections keep their width on 360px phones at large text sizes.
 */
export function AssistantShell({ children, footer, role, live }: { children: ReactNode; footer?: ReactNode; role?: string; live?: 'polite' }) {
  return (
    <div className="min-w-0 pr-2" role={role} aria-live={live}>
      <div className="rounded-2xl rounded-tl-md border border-line bg-surface p-4">
        <AssistantHeader />
        {children}
      </div>
      {footer}
    </div>
  );
}

const SECTIONS: { key: keyof StructuredAnswer; icon: IconLike; tone: Tone; title: string }[] = [
  { key: 'problem', icon: Stethoscope, tone: 'red', title: 'ai.answer.problem' },
  { key: 'causes', icon: ScanSearch, tone: 'amber', title: 'ai.answer.causes' },
  { key: 'doList', icon: CircleCheck, tone: 'green', title: 'ai.answer.do' },
  { key: 'dontList', icon: Ban, tone: 'red', title: 'ai.answer.dont' },
  { key: 'recheck', icon: CalendarClock, tone: 'sky', title: 'ai.answer.recheck' },
];

/** समस्या / संभावित कारण / क्या करें / क्या न करें / कब दोबारा जांचें */
export function StructuredSections({ s }: { s: StructuredAnswer }) {
  const t = useT();
  return (
    <div className="mt-4 flex flex-col gap-4 border-t border-line pt-4">
      {SECTIONS.map(sec => {
        const value = s[sec.key];
        if (!value || (Array.isArray(value) && !value.length)) return null;
        return (
          <section key={sec.key} className="flex gap-3">
            <ToneIcon icon={sec.icon} tone={sec.tone} size="sm" />
            <div className="min-w-0 flex-1 pt-1">
              <h3 className="text-small font-semibold text-ink-2">{t(sec.title)}</h3>
              {Array.isArray(value) ? (
                <ul className="mt-1 flex flex-col gap-1.5">
                  {value.map((item, i) => (
                    <li key={i} className="flex gap-2 text-body leading-relaxed text-ink">
                      <span aria-hidden className={cx('mt-[0.6875rem] size-1.5 shrink-0 rounded-full', TONE_FILL[sec.tone])} />
                      <span className="min-w-0 break-words">{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={cx('mt-0.5 text-body leading-relaxed text-ink break-words', sec.key === 'problem' && 'font-semibold')}>{value}</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function SourceLinks({ sources }: { sources: GroundingSource[] }) {
  const t = useT();
  if (!sources.length) return null;
  return (
    <div className="mt-4">
      {/* Unvetted web search results: named as internet sources, never as "trusted". */}
      <p className="text-caption font-semibold text-ink-2">{t('ai.answer.sources')}</p>
      <ul className="mt-1.5 flex flex-wrap gap-2">
        {sources.map(s => {
          const label = s.title && s.title.length <= 60 ? s.title : hostOf(s.uri);
          return (
            <li key={s.uri} className="max-w-full">
              <a
                href={s.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="press inline-flex min-h-12 max-w-full items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 text-caption font-medium text-brand"
              >
                <ExternalLink aria-hidden className="size-4 shrink-0" />
                <span className="min-w-0 truncate leading-snug">{label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AnswerDisclaimers({ kinds }: { kinds: DisclaimerKind[] }) {
  const t = useT();
  if (!kinds.length) return null;
  return (
    <div className="mt-4 flex flex-col gap-2">
      {kinds.map(k =>
        k === 'scheme' || k === 'weather' ? (
          <Disclaimer key={k} variant="info">
            {t(k === 'scheme' ? 'ai.answer.schemeNote' : 'ai.answer.weatherNote')}
          </Disclaimer>
        ) : (
          <Disclaimer key={k} kind={k} />
        ),
      )}
    </div>
  );
}

// ---------- Full answer card ----------

export interface AnswerCardProps {
  m: ChatMessage;
  /** The farmer's question this answers (for share text, saved title and disclaimers). */
  question?: ChatMessage;
  conversationId: string;
  /** Latest answer: its follow-up chips are shown by default. */
  isLatest: boolean;
  saved: boolean;
  /** A request is running: follow-ups are hidden. */
  busy: boolean;
  onFollowUp: (q: string) => void;
  /** "और पूछें" when there are no follow-ups to show: focus the composer. */
  onAskMore: () => void;
}

const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

const clip = (s: string, max: number) => {
  const chars = Array.from(s.replace(/\s+/g, ' ').trim());
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : chars.join('');
};

/** Icon with a short caption under it, for the answer's copy / share / save actions. */
function CaptionButton({ icon, label, pressed, onClick }: { icon: IconLike; label: string; pressed?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="press flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-btn px-1 py-1.5 text-caption font-semibold text-ink-2 hover:bg-surface-2 active:bg-surface-3"
    >
      {renderIcon(icon, { className: cx('size-5 shrink-0', pressed && 'text-brand'), strokeWidth: 2 })}
      <span className="max-w-full text-center leading-tight break-words">{label}</span>
    </button>
  );
}

export const AnswerCard = memo(function AnswerCard({ m, question, conversationId, isLatest, saved, busy, onFollowUp, onAskMore }: AnswerCardProps) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const kinds = useMemo(() => disclaimersFor(m, question), [m, question]);
  // Copied and shared answers carry their disclaimers outside the app too.
  const fullText = useMemo(() => [answerText(m, t), ...kinds.map(k => disclaimerText(k, t))].join('\n\n'), [m, t, kinds]);
  // Read-aloud includes the AI / fertilizer / price disclaimers.
  const speech = useMemo(() => spokenAnswer(m, t, question), [m, t, question]);
  const followUps = m.followUps || [];
  const showFollowUps = (isLatest || expanded) && !busy && followUps.length > 0;
  // Prices and forecasts age quickly: label old ones instead of letting them look current.
  const stale = (kinds.includes('price') || kinds.includes('weather')) && Date.now() - Date.parse(m.createdAt) > STALE_AFTER_MS;

  const copy = async () => {
    if (await copyText(fullText)) toast.success(t('common.copied'), { id: 'ai-copy' });
    else toast.error(t('common.error.generic'), { id: 'ai-copy' });
  };

  const share = async () => {
    const text = [question?.text ? `${t('ai.answer.question')}: ${question.text}` : '', fullText, t('ai.answer.shareFooter')]
      .filter(Boolean)
      .join('\n\n');
    const result = await shareText(t('ai.answer.shareTitle'), text);
    if (result === 'copied') toast.success(t('common.copied'), { id: 'ai-copy' });
    if (result !== 'failed') track('share', { area: 'ai-answer' });
  };

  const toggleSave = () => {
    const nowSaved = toggleSaved({
      type: 'ai-answer',
      refId: m.id,
      title: clip(question?.text || t('ai.chat.photoTitle'), 80),
      snippet: clip(previewOf(m), 160),
      // messageId: the chat scrolls to this answer when it is opened from the saved list.
      target: { screen: 'ai', params: { conversationId, messageId: m.id } },
    });
    toast.success(nowSaved ? t('common.saved') : t('ai.answer.unsaved'), { id: 'ai-save' });
  };

  const askMore = () => {
    if (followUps.length && !showFollowUps && !busy) setExpanded(true);
    else onAskMore();
  };

  return (
    <AssistantShell
      footer={
        <>
          {showFollowUps && (
            <div className="mt-3">
              <p className="text-caption font-semibold text-ink-2">{t('ai.answer.followTitle')}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {followUps.map(f => (
                  <Chip key={f} label={f} aria-pressed={undefined} className={WRAP_CHIP} onClick={() => onFollowUp(f)} />
                ))}
              </div>
            </div>
          )}
          <p className="mt-1 flex flex-wrap items-center gap-2 px-1 text-caption text-ink-3">
            <time dateTime={m.createdAt}>{formatUpdated(m.createdAt)}</time>
            {stale && <Badge tone="amber">{t('common.staleData')}</Badge>}
          </p>
        </>
      }
    >
      <Paragraphs text={m.text} />
      {m.structured && <StructuredSections s={m.structured} />}
      <SourceLinks sources={m.sources || []} />
      <AnswerDisclaimers kinds={kinds} />
      <div role="group" aria-label={t('ai.answer.actions')} className="mt-3 border-t border-line pt-3">
        {/* Every action has a visible label: first-time smartphone users do not read bare icons. */}
        <div className="flex flex-wrap items-center gap-2">
          <ListenButton id={m.id} text={speech} />
          <Button variant="secondary" icon={MessageCirclePlus} onClick={askMore}>
            {t('ai.answer.more')}
          </Button>
        </div>
        <div className="-mx-1 mt-2 grid grid-cols-3 gap-1">
          <CaptionButton icon={Copy} label={t('common.copy')} onClick={copy} />
          <CaptionButton icon={Share2} label={t('common.share')} onClick={share} />
          <CaptionButton icon={saved ? BookmarkCheck : Bookmark} label={saved ? t('common.saved') : t('common.save')} pressed={saved} onClick={toggleSave} />
        </div>
      </div>
    </AssistantShell>
  );
});

// ---------- Typing / error / welcome ----------

export function TypingBubble() {
  const t = useT();
  return (
    <AssistantShell role="status" live="polite">
      <p className="text-small font-medium text-ink-2">{t('ai.chat.typing')}</p>
      <SkeletonText lines={2} className="mt-3" />
    </AssistantShell>
  );
}

/**
 * A failed answer. `live` (only the newest one) announces it to screen readers; older error
 * bubbles in a reopened conversation stay quiet.
 */
export function ErrorBubble({
  message,
  onRetry,
  retryDisabled,
  live = false,
}: {
  message: string;
  onRetry?: () => void;
  retryDisabled?: boolean;
  live?: boolean;
}) {
  const t = useT();
  return (
    <AssistantShell role={live ? 'alert' : undefined}>
      <div className="flex items-start gap-3 pt-1">
        <ToneIcon icon={CloudOff} tone="red" size="sm" />
        <p className="min-w-0 flex-1 pt-1.5 text-body leading-relaxed text-ink">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" icon={RefreshCw} className="mt-3" disabled={retryDisabled} onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </AssistantShell>
  );
}

export function WelcomeBubble() {
  const t = useT();
  const text = t('ai.chat.welcome');
  return (
    <AssistantShell>
      <p className="text-body leading-relaxed text-ink">{text}</p>
      <ListenButton id="ai-welcome" text={text} className="mt-3" />
    </AssistantShell>
  );
}
