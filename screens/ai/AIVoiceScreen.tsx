// Screen 15 — voice-first AI flow (spec §17): tap the big mic → speak → the transcript appears →
// a short spoken-style answer is shown and read aloud. Every turn is saved into one conversation
// that can be opened in the chat. Falls back to typing when the mic is unsupported or fails.
import './strings';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, MessagesSquare, Mic, RotateCcw, SendHorizontal, Square } from 'lucide-react';
import { Button, Card, MicButton, Screen, SkeletonText, TextField, cx } from '../../components/ui';
import { useOnline } from '../../lib/cache';
import { useT } from '../../lib/i18n';
import { useNav } from '../../lib/nav';
import { ai } from '../../services/ai';
import { isVoiceInputSupported, speak, stopSpeaking, useSpeaker } from '../../services/voice';
import { disclaimersFor, openConversation, retryTurn, spokenAnswer, startTurn, type ChatMessage, type TurnResult } from './engine';
import { AnswerDisclaimers, AssistantShell, ErrorBubble, Paragraphs, SourceLinks, UserBubble } from './parts';

type Phase = 'idle' | 'listening' | 'thinking' | 'answer' | 'error';

/** Mic sessions in a row that heard nothing (cancelled, silent, denied) before typing is offered. */
const MIC_FAILURES_BEFORE_TYPING = 2;

export default function AIVoiceScreen() {
  const t = useT();
  const nav = useNav();
  const online = useOnline();
  const configured = ai.available();
  const canAsk = configured && online;
  const voiceSupported = useMemo(() => isVoiceInputSupported(), []);
  const { speakingId } = useSpeaker();

  const [phase, setPhase] = useState<Phase>('idle');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [question, setQuestion] = useState<ChatMessage | null>(null);
  const [answer, setAnswer] = useState<ChatMessage | null>(null);
  const [errorKey, setErrorKey] = useState('common.error.generic');
  const [typing, setTyping] = useState(!voiceSupported);
  const [micTrouble, setMicTrouble] = useState(false);
  const [typed, setTyped] = useState('');

  const alive = useRef(true);
  const gotResult = useRef(false);
  const micFailures = useRef(0);
  const micWrap = useRef<HTMLDivElement | null>(null);
  const typedRef = useRef<HTMLInputElement | null>(null);
  const latest = useRef({ answer, speakingId, conversationId, t });
  latest.current = { answer, speakingId, conversationId, t };

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      const { answer: a, speakingId: id } = latest.current;
      if (a && id === a.id) stopSpeaking();
    };
  }, []);

  const onResult = (res: TurnResult) => {
    if (!alive.current) return;
    if (res.message) {
      setAnswer(res.message);
      setPhase('answer');
      // Spoken with its disclaimers: many farmers only listen.
      speak(res.message.id, spokenAnswer(res.message, latest.current.t, res.question)).catch(() => {});
      return;
    }
    const key = (res.error as { messageKey?: unknown } | undefined)?.messageKey;
    setErrorKey(typeof key === 'string' ? key : 'common.error.generic');
    setPhase('error');
  };

  /** Asks the question; false when it could not be sent (empty, offline, AI unavailable). */
  const ask = (text: string, viaVoice: boolean): boolean => {
    const q = text.trim();
    if (!q || !canAsk) return false;
    stopSpeaking();
    setAnswer(null);
    setPhase('thinking');
    const turn = startTurn({ mode: 'voice', conversationId: latest.current.conversationId, text: q, viaVoice });
    setConversationId(turn.conversationId);
    setQuestion({ id: turn.userMessageId, role: 'user', text: q, viaVoice: viaVoice || undefined, createdAt: new Date().toISOString() });
    turn.done.then(onResult);
    return true;
  };

  const retry = () => {
    if (!conversationId || !canAsk) return;
    const turn = retryTurn(conversationId, 'voice');
    if (!turn) return;
    setPhase('thinking');
    turn.done.then(onResult);
  };

  // "फिर से पूछें" always reopens the mic when the phone has one; typing stays as a fallback below.
  const askAgain = () => {
    stopSpeaking();
    setAnswer(null);
    setQuestion(null);
    setPhase('idle');
    if (voiceSupported) micWrap.current?.querySelector('button')?.click();
    else typedRef.current?.focus();
  };

  const submitTyped = () => {
    if (!typed.trim() || phase === 'thinking') return;
    if (ask(typed, false)) setTyped('');
  };

  const onListeningChange = (on: boolean) => {
    if (on) {
      gotResult.current = false;
      stopSpeaking();
      setPhase('listening');
      return;
    }
    if (gotResult.current) return;
    // Nothing heard, cancelled, denied or unsupported (the mic button explains which with a toast).
    setPhase(p => (p === 'listening' ? (latest.current.answer ? 'answer' : 'idle') : p));
    // One cough or a cancelled tap is not a reason to leave the voice flow: offer typing only
    // after repeated failures, and keep the mic usable either way.
    micFailures.current += 1;
    if (micFailures.current >= MIC_FAILURES_BEFORE_TYPING) {
      setMicTrouble(true);
      setTyping(true);
    }
  };

  const onSpeech = (text: string) => {
    gotResult.current = true;
    micFailures.current = 0;
    // Internet or AI dropped while listening: leave the listening state instead of hanging there.
    if (!ask(text, true)) setPhase(latest.current.answer ? 'answer' : 'idle');
  };

  const speaking = !!answer && speakingId === answer.id;
  const listening = phase === 'listening';

  let statusTitle: string;
  let statusHint: string;
  if (!configured) {
    statusTitle = t('ai.notConfigured.title');
    statusHint = t('ai.notConfigured.body');
  } else if (!online) {
    statusTitle = t('ui.error.offlineTitle');
    statusHint = t('ai.voice.offline');
  } else if (phase === 'listening') {
    statusTitle = t('ai.voice.listening');
    statusHint = t('ai.voice.listeningHint');
  } else if (phase === 'thinking') {
    statusTitle = t('ai.voice.thinking');
    statusHint = t('ai.voice.thinkingHint');
  } else if (phase === 'answer') {
    statusTitle = t('ai.voice.answered');
    statusHint = t('ai.voice.answeredHint');
  } else if (phase === 'error') {
    statusTitle = t('ai.voice.errorTitle');
    statusHint = t(errorKey);
  } else if (!voiceSupported) {
    statusTitle = t('ai.voice.typeInstead');
    statusHint = t('ai.voice.unsupported');
  } else {
    statusTitle = t('ai.voice.idle');
    statusHint = t('ai.voice.idleHint');
  }

  const kinds = useMemo(() => (answer ? disclaimersFor(answer, question ?? undefined) : []), [answer, question]);

  return (
    <Screen title={t('ai.voice.title')} subtitle={t('ai.voice.subtitle')}>
      <section className="flex flex-col items-center pt-2 text-center">
        <div className="relative flex size-44 items-center justify-center">
          <span aria-hidden className={cx('absolute inset-0 rounded-full', listening ? 'bg-tint-red' : 'bg-brand-50')} />
          {listening && <span aria-hidden className="absolute inset-0 animate-listen rounded-full bg-tint-red motion-reduce:hidden" />}
          <span aria-hidden className={cx('absolute inset-7 rounded-full', listening ? 'bg-danger/15' : 'bg-brand-100')} />
          <div ref={micWrap} className="relative">
            <MicButton
              size="lg"
              variant="solid"
              label={t('ai.voice.micLabel')}
              disabled={!canAsk || !voiceSupported || phase === 'thinking'}
              onListeningChange={onListeningChange}
              onResult={onSpeech}
            />
          </div>
        </div>
        <div role="status" aria-live="polite" className="mt-4 min-h-[4.5rem] max-w-xs">
          <p className="text-section font-bold text-ink">{statusTitle}</p>
          <p className="mt-1 text-small text-ink-2">{statusHint}</p>
        </div>
      </section>

      {question && <UserBubble m={question} />}

      {phase === 'thinking' && (
        <AssistantShell>
          <SkeletonText lines={3} />
        </AssistantShell>
      )}

      {phase === 'error' && <ErrorBubble live message={t(errorKey)} onRetry={retry} retryDisabled={!canAsk} />}

      {answer && phase !== 'thinking' && (
        <AssistantShell>
          <Paragraphs text={answer.text} />
          <SourceLinks sources={answer.sources || []} />
          <AnswerDisclaimers kinds={kinds} />
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
            {speaking ? (
              <Button variant="secondary" icon={Square} aria-pressed onClick={() => stopSpeaking()}>
                {t('ai.voice.stop')}
              </Button>
            ) : (
              <Button
                variant="secondary"
                icon={RotateCcw}
                onClick={() => speak(answer.id, spokenAnswer(answer, t, question ?? undefined)).catch(() => {})}
              >
                {t('ai.voice.replay')}
              </Button>
            )}
          </div>
        </AssistantShell>
      )}

      {(answer || phase === 'error') && phase !== 'thinking' && (
        <div className="flex flex-col gap-2">
          <Button fullWidth size="lg" icon={Mic} disabled={!canAsk} onClick={askAgain}>
            {t('ai.voice.askAgain')}
          </Button>
          {conversationId && (
            <Button fullWidth variant="ghost" icon={MessagesSquare} onClick={() => openConversation(nav, conversationId)}>
              {t('ai.voice.viewChat')}
            </Button>
          )}
        </div>
      )}

      {canAsk &&
        (typing ? (
          <Card>
            {micTrouble && voiceSupported && <p className="mb-3 text-small text-ink-2">{t('ai.voice.trouble')}</p>}
            <TextField
              ref={typedRef}
              label={t('ai.voice.inputLabel')}
              value={typed}
              onValueChange={setTyped}
              placeholder={t('ai.voice.inputPlaceholder')}
              maxLength={500}
              enterKeyHint="send"
              onKeyDown={(e: any) => {
                if (e.key === 'Enter' && !e.nativeEvent?.isComposing) {
                  e.preventDefault();
                  submitTyped();
                }
              }}
            />
            <Button fullWidth className="mt-3" icon={SendHorizontal} disabled={!typed.trim() || phase === 'thinking'} onClick={submitTyped}>
              {t('ai.voice.ask')}
            </Button>
          </Card>
        ) : (
          <div className="flex justify-center">
            <Button variant="ghost" icon={Keyboard} onClick={() => setTyping(true)}>
              {t('ai.voice.typeInstead')}
            </Button>
          </div>
        ))}
    </Screen>
  );
}
