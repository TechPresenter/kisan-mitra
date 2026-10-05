// Screen 14 — AI chat ("AI किसान मित्र"), the AI tab root. Params: { conversationId?, prompt?, cropId? }.
import './strings';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CircleAlert, History, LifeBuoy, Mic, SendHorizontal, Sprout, SquarePen, TrendingUp, WifiOff, X } from 'lucide-react';
import {
  Button,
  Callout,
  Card,
  Chip,
  IconButton,
  IconTile,
  MicButton,
  Screen,
  SectionHeader,
  Spinner,
  TextArea,
  TileGrid,
  toast,
  type AppBarAction,
} from '../../components/ui';
import { CropArt } from '../../components/illustrations';
import { useProfile, usePlace, useSettings } from '../../lib/app-state';
import { isOnline, useOnline } from '../../lib/cache';
import { useT } from '../../lib/i18n';
import { compressImage } from '../../lib/image';
import { useNav, useRoute } from '../../lib/nav';
import { KEYS, useCollection } from '../../lib/store';
import { ai } from '../../services/ai';
import { isNative, pickCropPhoto } from '../../services/native';
import { useSaved } from '../../services/saved';
import { speak, stopSpeaking, useSpeaker } from '../../services/voice';
import type { Crop } from '../../types/models';
import { catalogText, stageForCrop } from '../../data/crops';
import {
  adviceStarter,
  areaLabel,
  buildSuggestions,
  cropDisplayName,
  farmerCrops,
  getConversation,
  isPending,
  marketStarter,
  placeName,
  questionBefore,
  retryTurn,
  session,
  spokenAnswer,
  startTurn,
  useConversations,
  usePending,
  type ChatMessage,
  type CropRef,
  type TurnResult,
} from './engine';
import { AnswerCard, ErrorBubble, TypingBubble, UserBubble, WelcomeBubble, WRAP_CHIP } from './parts';

interface ChatParams {
  conversationId?: string;
  /** With conversationId: scroll to this answer (a saved answer opened from the saved list). */
  messageId?: string;
  prompt?: string;
  cropId?: string;
}

/** The photo copy stored in the conversation: small, so saving the chat stays fast. */
const STORED_PHOTO = { maxDim: 320, quality: 0.55 };

interface Photo {
  full: string;
  thumb: string;
}

const EMPTY: ChatMessage[] = [];

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const hasCoarsePointer = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

export default function AIChatScreen() {
  const t = useT();
  const nav = useNav();
  const route = useRoute<ChatParams>();
  const params = route.params || {};
  const [settings] = useSettings();
  const lang = settings.languageCode;
  const [place] = usePlace();
  const [profile] = useProfile();
  const online = useOnline();
  const configured = ai.available();
  const canAsk = configured && online;
  const conversations = useConversations();
  const crops = useCollection<Crop>(KEYS.crops).items;
  const saved = useSaved();
  const { speakingId } = useSpeaker();

  // Route params apply once per route; a remount (after a tab switch) resumes what was shown.
  const freshRoute = !session.handledRoutes.has(route.key);
  const [activeId, setActiveId] = useState<string | null>(() => {
    if (freshRoute && params.prompt) return null;
    if (freshRoute && params.conversationId) return params.conversationId;
    if (freshRoute && params.cropId) return null;
    return session.lastActiveId;
  });
  const [cropId, setCropId] = useState<string | undefined>(() => (freshRoute ? params.cropId : undefined));
  // A saved answer opened from the saved list: scroll to it once instead of to the bottom.
  const focusMessageRef = useRef<string | undefined>(
    freshRoute && params.conversationId && !params.prompt && typeof params.messageId === 'string' ? params.messageId : undefined,
  );
  // Touch keyboards: Enter adds a new line (the key says so); the send button sends.
  const touch = useMemo(hasCoarsePointer, []);

  const conv = useMemo(() => (activeId ? conversations.find(c => c.id === activeId) : undefined), [conversations, activeId]);
  const messages = conv?.messages ?? EMPTY;
  const pending = usePending(conv?.id);
  const focusCropId = conv ? conv.cropId : cropId;
  const focusCrop = useMemo(() => (focusCropId ? crops.find(c => c.id === focusCropId) : undefined), [crops, focusCropId]);

  useEffect(() => {
    session.lastActiveId = conv ? conv.id : null;
  }, [conv?.id]);

  // ---- Composer state (drafts survive a tab switch) ----
  const draftKey = activeId || 'new';
  const draftKeyRef = useRef(draftKey);
  const [input, setInputState] = useState(() => session.drafts.get(draftKey) || '');
  const setInput = useCallback((value: string) => {
    session.drafts.set(draftKeyRef.current, value);
    setInputState(value);
  }, []);
  useEffect(() => {
    if (draftKeyRef.current === draftKey) return;
    draftKeyRef.current = draftKey;
    setInputState(session.drafts.get(draftKey) || '');
  }, [draftKey]);

  const [photo, setPhoto] = useState<Photo | null>(null);
  const [picking, setPicking] = useState(false);
  const viaVoiceRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastMsgRef = useRef<HTMLDivElement | null>(null);
  const alive = useRef(true);

  // Latest values for stable callbacks.
  const latest = useRef({ input, photo, canAsk, activeId, cropId, t, messages, speakingId });
  latest.current = { input, photo, canAsk, activeId, cropId, t, messages, speakingId };

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      // Leaving the AI tab: stop reading out an answer from this conversation.
      const { speakingId: id, messages: msgs } = latest.current;
      if (id && msgs.some(m => m.id === id)) stopSpeaking();
    };
  }, []);

  // ---- Sending ----
  /** Reads a voice question's answer aloud, with its disclaimers. */
  const speakAnswer = useCallback((res: TurnResult) => {
    if (!res.message || !alive.current) return;
    speak(res.message.id, spokenAnswer(res.message, latest.current.t, res.question)).catch(() => {});
  }, []);

  /**
   * Sends the composer (no argument), or a chip / follow-up / starter question (`override`).
   * An override leaves the farmer's typed draft and attached photo in the composer.
   */
  const send = useCallback(
    (override?: string) => {
      const s = latest.current;
      const fromComposer = override == null;
      const text = (override ?? s.input).trim();
      const img = fromComposer ? s.photo : null;
      if ((!text && !img) || !s.canAsk || isPending(s.activeId)) return;
      const viaVoice = fromComposer && viaVoiceRef.current;
      stopSpeaking();
      const turn = startTurn({
        mode: 'chat',
        conversationId: s.activeId,
        text,
        image: img ?? undefined,
        viaVoice,
        cropId: s.cropId,
      });
      if (fromComposer) {
        session.drafts.delete('new');
        session.drafts.delete(turn.conversationId);
        setInput('');
        setPhoto(null);
        viaVoiceRef.current = false;
      } else if (!s.activeId) {
        // A new chat started from a chip: carry the unsent draft over to it.
        const draft = session.drafts.get('new');
        session.drafts.delete('new');
        if (draft) session.drafts.set(turn.conversationId, draft);
      }
      setActiveId(turn.conversationId);
      if (viaVoice) turn.done.then(speakAnswer);
    },
    [setInput, speakAnswer],
  );

  const retry = useCallback(() => {
    const s = latest.current;
    if (!s.activeId || !s.canAsk) return;
    const last = [...s.messages].reverse().find(m => m.role === 'user');
    const turn = retryTurn(s.activeId, 'chat');
    if (turn && last?.viaVoice) turn.done.then(speakAnswer);
  }, [speakAnswer]);

  const focusInput = useCallback(() => inputRef.current?.focus(), []);

  const newChat = useCallback(() => {
    setActiveId(null);
    setCropId(undefined);
    setPhoto(null);
    viaVoiceRef.current = false;
    scrollRef.current?.scrollTo({ top: 0 });
  }, []);

  // ---- Params: open a conversation, or pre-send a question once (StrictMode-safe) ----
  useEffect(() => {
    if (session.handledRoutes.has(route.key)) return;
    session.handledRoutes.add(route.key);
    if (params.conversationId && !params.prompt && !getConversation(params.conversationId)) {
      toast.info(t('ai.chat.missing'), { id: 'ai-missing' });
      setActiveId(null);
    }
    const prompt = typeof params.prompt === 'string' ? params.prompt.trim() : '';
    if (!prompt) return;
    if (!ai.available() || !isOnline()) setInput(prompt);
    else send(prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Photo ----
  const acceptPhoto = useCallback(
    async (src: string | Blob) => {
      setPicking(true);
      try {
        const full = await compressImage(src, { maxDim: 1280 });
        const thumb = await compressImage(full, STORED_PHOTO);
        if (alive.current) setPhoto({ full, thumb });
      } catch {
        toast.error(t('ai.photo.error'), { id: 'ai-photo' });
      } finally {
        if (alive.current) setPicking(false);
      }
    },
    [t],
  );

  const pickPhoto = async () => {
    if (!isNative) {
      fileRef.current?.click();
      return;
    }
    try {
      const dataUrl = await pickCropPhoto({
        header: t('ai.photo.header'),
        camera: t('ai.photo.camera'),
        gallery: t('ai.photo.gallery'),
        cancel: t('common.cancel'),
      });
      if (dataUrl) await acceptPhoto(dataUrl);
    } catch {
      toast.error(t('ai.photo.error'), { id: 'ai-photo' });
    }
  };

  // ---- Auto-scroll to the newest message (smooth unless reduced motion) ----
  const seen = useRef({ id: undefined as string | null | undefined, count: -1, pending: false });
  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    const prev = seen.current;
    const next = { id: activeId, count: messages.length, pending };
    const switched = prev.id !== activeId;
    const grew = messages.length > prev.count;
    const startedWaiting = pending && !prev.pending;
    if (!messages.length) {
      seen.current = next;
      if (switched) box.scrollTo({ top: 0 });
      return;
    }
    if (!switched && !grew && !startedWaiting) {
      seen.current = next;
      return;
    }
    const topOf = (el: HTMLElement) => el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 12;
    // Marked seen only once the scroll ran, so a cancelled frame (StrictMode, quick updates) retries.
    const raf = requestAnimationFrame(() => {
      seen.current = next;
      const focusId = focusMessageRef.current;
      if (switched && focusId) {
        focusMessageRef.current = undefined;
        const el = (Array.from(box.querySelectorAll('[data-message-id]')) as HTMLElement[]).find(x => x.dataset.messageId === focusId);
        if (el) {
          box.scrollTo({ top: topOf(el), behavior: 'auto' });
          return;
        }
      }
      const last = messages[messages.length - 1];
      let top = box.scrollHeight;
      // A new answer: show its beginning, not its end.
      if (!switched && !pending && last.role === 'assistant' && !last.error && lastMsgRef.current) top = topOf(lastMsgRef.current);
      box.scrollTo({ top, behavior: switched || prefersReducedMotion() ? 'auto' : 'smooth' });
    });
    return () => cancelAnimationFrame(raf);
  }, [activeId, messages, pending]);

  // ---- Empty-state content: action cards and suggestion chips ----
  const myCrops = useMemo(() => farmerCrops(crops, profile?.cropKeys, lang), [crops, profile?.cropKeys, lang]);
  const focusRef = useMemo<CropRef | undefined>(() => {
    if (!focusCrop) return undefined;
    const st = stageForCrop(focusCrop);
    return {
      key: focusCrop.cropKey,
      name: cropDisplayName(focusCrop, lang),
      stage: st.stage,
      stageLabel: catalogText(lang, st.labelHi, st.labelEn),
    };
  }, [focusCrop, lang]);
  const suggestions = useMemo(
    () => buildSuggestions(focusRef ? [focusRef, ...myCrops.list.filter(c => c.key !== focusRef.key)] : myCrops.list, lang, t),
    [focusRef, myCrops, lang, t],
  );

  // ---- Derived message info ----
  const lastAnswerIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'assistant' && !messages[i].error) return i;
    return -1;
  }, [messages]);
  const last = messages[messages.length - 1];
  const unanswered = !!last && last.role === 'user' && !pending;

  const onVoiceText = useCallback(
    (text: string) => {
      const current = latest.current.input.trim();
      setInput(current ? `${current} ${text}` : text);
      viaVoiceRef.current = true;
    },
    [setInput],
  );

  const onInputChange = (value: string) => {
    setInput(value);
    if (!value.trim()) viaVoiceRef.current = false;
  };

  const onKeyDown = (e: any) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing && !touch) {
      e.preventDefault();
      send();
    }
  };

  const canSend = canAsk && !pending && !picking && (!!input.trim() || !!photo);

  const actions: AppBarAction[] = [
    { key: 'history', icon: History, label: t('ai.chat.history'), onPress: () => nav.push('ai-history') },
    { key: 'new', icon: SquarePen, label: t('ai.chat.new'), onPress: newChat, disabled: !conv && !cropId },
  ];

  const footer = !configured ? (
    <p className="flex min-h-12 items-center gap-2 text-small text-ink-2">
      <CircleAlert aria-hidden className="size-5 shrink-0 text-ink-3" />
      <span>{t('ai.composer.notConfigured')}</span>
    </p>
  ) : (
    <div className="flex flex-col gap-2">
      {!online && (
        <p role="status" className="flex items-start gap-2 text-caption font-medium text-tone-amber">
          <WifiOff aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{t('ai.composer.offline')}</span>
        </p>
      )}
      {photo && (
        <div className="relative mt-3 w-fit">
          <img src={photo.thumb} alt={t('ai.composer.photoPreview')} className="size-20 rounded-xl border border-line object-cover" />
          <IconButton
            icon={X}
            label={t('ai.composer.removePhoto')}
            variant="outline"
            className="absolute -top-3 -right-5"
            onClick={() => setPhoto(null)}
          />
        </div>
      )}
      <div className="flex items-end gap-2">
        <IconButton
          icon={picking ? <Spinner size="md" /> : Camera}
          label={t('ai.composer.photo')}
          variant="soft"
          className="mb-0.5"
          disabled={!canAsk || picking}
          onClick={pickPhoto}
        />
        <TextArea
          ref={inputRef}
          containerClassName="min-w-0 flex-1"
          rows={1}
          maxRows={5}
          maxLength={1000}
          showCount={false}
          value={input}
          onChange={onInputChange}
          aria-label={t('ai.composer.label')}
          placeholder={photo ? t('ai.composer.placeholderPhoto') : t('ai.composer.placeholder')}
          enterKeyHint={touch ? 'enter' : 'send'}
          onKeyDown={onKeyDown}
          disabled={!canAsk}
          trailing={<MicButton size="sm" variant="ghost" onResult={onVoiceText} disabled={!canAsk} />}
        />
        <IconButton
          icon={SendHorizontal}
          label={t('ai.composer.send')}
          variant="solid"
          className="mb-0.5"
          disabled={!canSend}
          onClick={() => send()}
        />
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        tabIndex={-1}
        aria-hidden
        onChange={(e: any) => {
          const file: File | undefined = e.target.files?.[0];
          e.target.value = '';
          if (file) acceptPhoto(file);
        }}
      />
    </div>
  );

  return (
    <Screen title={t('ai.chat.title')} subtitle={t('ai.chat.subtitle')} actions={actions} footer={footer} scrollRef={scrollRef}>
      {focusCrop && (
        <Card tone="brand" padding="sm" radius="list" className="flex items-center gap-3">
          <CropArt crop={focusCrop.cropKey} size={48} />
          <div className="min-w-0">
            <p className="text-body leading-snug font-semibold text-ink">{focusRef?.name}</p>
            <p className="text-small text-ink-2">{t('ai.crop.meta', { area: areaLabel(focusCrop, t), stage: focusRef?.stageLabel || '' })}</p>
            <p className="text-caption text-ink-2">{t('ai.crop.note')}</p>
          </div>
        </Card>
      )}

      {!conv ? (
        <>
          <WelcomeBubble />

          {!configured && (
            <Callout
              tone="warning"
              title={t('ai.notConfigured.title')}
              action={
                <Button variant="secondary" icon={LifeBuoy} onClick={() => nav.push('help')}>
                  {t('ai.notConfigured.help')}
                </Button>
              }
            >
              {t('ai.notConfigured.body')}
            </Callout>
          )}

          <section aria-label={t('ai.chat.quickTitle')}>
            <SectionHeader title={t('ai.chat.quickTitle')} className="mb-3" />
            <TileGrid columns={2}>
              <IconTile variant="card" icon={Camera} tone="green" label={t('ai.card.photo')} description={t('ai.card.photoDesc')} onPress={() => nav.push('crop-doctor')} />
              <IconTile variant="card" icon={Mic} tone="sky" label={t('ai.card.voice')} description={t('ai.card.voiceDesc')} onPress={() => nav.push('ai-voice')} />
              <IconTile
                variant="card"
                icon={Sprout}
                tone="amber"
                label={t('ai.card.advice')}
                description={t('ai.card.adviceDesc')}
                disabled={!canAsk}
                onPress={() => send(adviceStarter(t, lang, myCrops, placeName(place, lang), focusRef))}
              />
              <IconTile
                variant="card"
                icon={TrendingUp}
                tone="tech"
                label={t('ai.card.market')}
                description={t('ai.card.marketDesc')}
                disabled={!canAsk}
                onPress={() => send(marketStarter(t, myCrops, placeName(place, lang), focusRef))}
              />
            </TileGrid>
          </section>

          <section aria-label={t('ai.suggest.title')}>
            <SectionHeader title={t('ai.suggest.title')} className="mb-3" />
            <div className="flex flex-wrap gap-2">
              {suggestions.map(s => (
                <Chip key={s} label={s} aria-pressed={undefined} className={WRAP_CHIP} disabled={!canAsk} onClick={() => send(s)} />
              ))}
            </div>
          </section>
        </>
      ) : (
        <div role="log" aria-label={conv.title} className="flex flex-col gap-5">
          {messages.map((m, i) => {
            const isLast = i === messages.length - 1;
            let el;
            if (m.role === 'user') el = <UserBubble m={m} />;
            else if (m.error)
              // Only the newest error offers a retry (and is announced); older ones just say what happened.
              el = isLast ? (
                <ErrorBubble live message={t(m.errorKey || 'common.error.generic')} onRetry={retry} retryDisabled={!canAsk || pending} />
              ) : (
                <ErrorBubble message={t('ai.chat.errorPast')} />
              );
            else
              el = (
                <AnswerCard
                  m={m}
                  question={questionBefore(messages, i)}
                  conversationId={conv.id}
                  isLatest={i === lastAnswerIndex && isLast}
                  saved={saved.isSaved('ai-answer', m.id)}
                  busy={pending || !canAsk}
                  onFollowUp={send}
                  onAskMore={focusInput}
                />
              );
            return (
              <div key={m.id} data-message-id={m.id} ref={isLast ? lastMsgRef : undefined}>
                {el}
              </div>
            );
          })}
          {pending && <TypingBubble />}
          {unanswered && <ErrorBubble message={t('ai.chat.unanswered')} onRetry={retry} retryDisabled={!canAsk} />}
        </div>
      )}
    </Screen>
  );
}
