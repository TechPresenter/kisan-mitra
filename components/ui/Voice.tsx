import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Volume2 } from 'lucide-react';
import { useT } from '../../lib/i18n';
import { isVoiceInputSupported, listen, useSpeaker } from '../../services/voice';
import { cx } from './cx';
import { toast } from './Toast';
import './strings';
import '../../lib/common-strings';

export interface MicButtonProps {
  /** Recognised text (trimmed, never empty). */
  onResult: (text: string) => void;
  /** sm 44px (inside fields), md 48px, lg 64px (chat / crop doctor). */
  size?: 'sm' | 'md' | 'lg';
  /** soft = tinted (default), solid = green, ghost = icon only, onDark = inside the green header. */
  variant?: 'soft' | 'solid' | 'ghost' | 'onDark';
  /** Accessible name; defaults to "बोलकर लिखें". */
  label?: string;
  /** BCP-47 code; defaults to the app language. */
  lang?: string;
  disabled?: boolean;
  onListeningChange?: (listening: boolean) => void;
  className?: string;
}

const SIZE = { sm: 'size-11', md: 'size-12', lg: 'size-16' } as const;
const ICON = { sm: 'size-5', md: 'size-6', lg: 'size-7' } as const;
const VARIANT = {
  soft: 'bg-brand-50 text-brand hover:bg-brand-100',
  solid: 'bg-brand-700 text-white hover:bg-brand-800',
  ghost: 'text-ink-2 hover:bg-surface-2',
  onDark: 'text-white hover:bg-white/10',
} as const;

// The signal lets listen() stop the recogniser on cancel / unmount once services/voice.ts accepts
// one; until then the extra argument is ignored and a cancelled session's result is just dropped.
const listenFor: (lang?: string, signal?: AbortSignal) => Promise<string | null> = listen;

interface ListenSession {
  ctrl: AbortController;
  /** False once the user cancelled or the button unmounted: the result must not be delivered. */
  wanted: boolean;
}

/**
 * Tap → speak → text; tap again to stop (aria-pressed is a real toggle). Shows a listening pulse
 * and explains an unsupported / denied mic with a toast.
 */
export function MicButton({ onResult, size = 'md', variant = 'soft', label, lang, disabled, onListeningChange, className }: MicButtonProps) {
  const t = useT();
  const [listening, setListening] = useState(false);
  const alive = useRef(true);
  const session = useRef<ListenSession | null>(null);
  const resultRef = useRef(onResult);
  resultRef.current = onResult;
  const changeRef = useRef(onListeningChange);
  changeRef.current = onListeningChange;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      // A screen popped mid-listen must not search or navigate later from its stale callback.
      const s = session.current;
      if (s) {
        s.wanted = false;
        s.ctrl.abort();
      }
    };
  }, []);

  const setState = (on: boolean) => {
    if (!alive.current) return;
    setListening(on);
    changeRef.current?.(on);
  };

  const press = async () => {
    const running = session.current;
    if (running) {
      if (running.wanted) {
        running.wanted = false;
        running.ctrl.abort();
        setState(false);
      } else {
        // A cancelled recogniser that could not be stopped is still listening: take it back
        // rather than starting a second one next to it.
        running.wanted = true;
        setState(true);
      }
      return;
    }
    if (!isVoiceInputSupported()) {
      toast.error(t('common.voice.unsupported'), { id: 'voice' });
      return;
    }
    const s: ListenSession = { ctrl: new AbortController(), wanted: true };
    session.current = s;
    setState(true);
    try {
      const text = (await listenFor(lang, s.ctrl.signal))?.trim();
      if (!s.wanted || !alive.current) return;
      if (text) resultRef.current(text);
      else toast(t('ui.voice.noSpeech'), { id: 'voice' });
    } catch (e) {
      if (!s.wanted || !alive.current) return;
      const msg = e instanceof Error ? e.message : String(e);
      const key = /denied|not-allowed|permission/i.test(msg)
        ? 'common.voice.denied'
        : /unsupported|unavailable|not supported/i.test(msg)
          ? 'common.voice.unsupported'
          : 'ui.voice.error';
      toast.error(t(key), { id: 'voice' });
    } finally {
      if (session.current === s) session.current = null;
      if (s.wanted) setState(false);
    }
  };

  const active = listening;
  return (
    <button
      type="button"
      onClick={press}
      disabled={disabled}
      // A stable name: aria-pressed carries the on/off state and the status line announces listening.
      aria-label={label ?? t('ui.voice.start')}
      aria-pressed={active}
      className={cx(
        'press relative inline-flex shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-40',
        SIZE[size],
        active ? 'bg-danger-fill text-white' : VARIANT[variant],
        // Static ring stands in for the pulse when motion is reduced.
        active && 'motion-reduce:ring-4 motion-reduce:ring-danger/30',
        className,
      )}
    >
      {active && <span aria-hidden className="absolute inset-0 animate-listen rounded-full bg-danger-fill motion-reduce:hidden" />}
      <Mic aria-hidden className={cx('relative', ICON[size])} strokeWidth={2.25} />
      {active && (
        <span role="status" className="sr-only">
          {t('common.voice.listening')}
        </span>
      )}
    </button>
  );
}

export interface ListenButtonProps {
  /** Stable id of the item being read (so only its button shows "रोकें"). */
  id: string;
  text: string;
  /** pill = icon + "सुनें"/"रोकें" (default); icon = round icon button. */
  variant?: 'pill' | 'icon';
  size?: 'sm' | 'md';
  className?: string;
}

/** Read-aloud toggle for advice, answers and alerts. */
export function ListenButton({ id, text, variant = 'pill', size = 'md', className }: ListenButtonProps) {
  const t = useT();
  const { speakingId, toggle } = useSpeaker();
  const active = speakingId === id;
  const label = active ? t('common.stop') : t('common.listen');
  const Icon = active ? Square : Volume2;
  const disabled = !text.trim();

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={() => toggle(id, text)}
        disabled={disabled}
        aria-label={label}
        aria-pressed={active}
        className={cx(
          'press inline-flex shrink-0 items-center justify-center rounded-full disabled:opacity-40',
          size === 'sm' ? 'size-11' : 'size-12',
          active ? 'bg-brand-700 text-white' : 'bg-brand-50 text-brand hover:bg-brand-100',
          className,
        )}
      >
        <Icon aria-hidden className={size === 'sm' ? 'size-5' : 'size-5.5'} strokeWidth={2.25} fill={active ? 'currentColor' : 'none'} />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => toggle(id, text)}
      disabled={disabled}
      aria-pressed={active}
      className={cx(
        'press inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold disabled:opacity-40',
        size === 'sm' ? 'min-h-11 px-3.5 text-caption' : 'min-h-12 px-4 text-small',
        active ? 'bg-brand-700 text-white' : 'bg-brand-50 text-brand hover:bg-brand-100',
        className,
      )}
    >
      <Icon aria-hidden className="size-4" strokeWidth={2.5} fill={active ? 'currentColor' : 'none'} />
      <span className="pt-0.5">{label}</span>
    </button>
  );
}
