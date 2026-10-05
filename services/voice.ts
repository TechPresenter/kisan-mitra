// Voice-first helpers shared by every screen: speech-to-text (tap mic → speak) and
// text-to-speech ("सुनें"). Android uses native plugins; the web uses the Web Speech API.
import { useCallback, useEffect, useState } from 'react';
import { getSettings } from '../lib/app-state';
import { getLanguage } from '../lib/i18n';
import { isNative, listenOnce, speakNative, stopNativeSpeech } from './native';

export function isVoiceInputSupported(): boolean {
  if (isNative) return true;
  return typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

const currentTtsCode = () => getLanguage(getSettings().languageCode).ttsCode;

/** One utterance → text (null when nothing was heard). Throws when unsupported / denied. */
export function listen(language = currentTtsCode()): Promise<string | null> {
  if (isNative) return listenOnce(language);
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) return Promise.reject(new Error('unsupported'));
  return new Promise((resolve, reject) => {
    const rec = new SR();
    rec.lang = language;
    rec.continuous = false;
    rec.interimResults = false;
    let settled = false;
    rec.onresult = (e: any) => {
      settled = true;
      resolve(e.results?.[0]?.[0]?.transcript ?? null);
    };
    rec.onerror = (e: any) => {
      if (settled) return;
      settled = true;
      e?.error === 'no-speech' || e?.error === 'aborted' ? resolve(null) : reject(new Error(e?.error || 'speech-error'));
    };
    rec.onend = () => {
      if (!settled) resolve(null);
    };
    try {
      rec.start();
    } catch (e) {
      reject(e);
    }
  });
}

/** Strip markdown and split into sentence-sized chunks (handles the Devanagari danda). */
export function toSpeechChunks(text: string): string[] {
  const clean = text.replace(/[*#_~`]/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1').trim();
  if (!clean) return [];
  const parts = clean.match(/[^.!?।\n]+(?:[.!?।\n]+|$)/g) || [clean];
  return parts.map(s => s.trim()).filter(Boolean);
}

// ---- Text to speech with a single global "now speaking" id ----
let speakingId: string | null = null;
const speakingListeners = new Set<(id: string | null) => void>();
const setSpeaking = (id: string | null) => {
  speakingId = id;
  speakingListeners.forEach(l => l(id));
};
let webGeneration = 0;

export function stopSpeaking() {
  webGeneration++;
  if (isNative) stopNativeSpeech().catch(() => {});
  else if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  setSpeaking(null);
}

/** Speak `text`; `id` identifies the item so its button can show a stop state. */
export async function speak(id: string, text: string): Promise<void> {
  stopSpeaking();
  const chunks = toSpeechChunks(text);
  if (!chunks.length) return;
  const settings = getSettings();
  const lang = getLanguage(settings.languageCode).ttsCode;
  setSpeaking(id);
  try {
    if (isNative) {
      await speakNative(chunks, lang, settings.voiceURI ?? null);
    } else if ('speechSynthesis' in window) {
      const gen = ++webGeneration;
      const voices = window.speechSynthesis.getVoices();
      const voice =
        voices.find(v => v.voiceURI === settings.voiceURI) ||
        voices.find(v => v.lang.toLowerCase().startsWith(lang.split('-')[0].toLowerCase()));
      for (const chunk of chunks) {
        if (gen !== webGeneration) return;
        await new Promise<void>(resolve => {
          const u = new SpeechSynthesisUtterance(chunk);
          u.lang = lang;
          if (voice) u.voice = voice;
          u.onend = () => resolve();
          u.onerror = () => resolve();
          (window as any).__kmUtterance = u; // keep a reference so Chrome doesn't GC it mid-speech
          window.speechSynthesis.speak(u);
        });
      }
    }
  } finally {
    if (speakingId === id) setSpeaking(null);
  }
}

/** Hook for "सुनें" buttons: `toggle(id, text)` starts or stops; `speakingId` drives the UI. */
export function useSpeaker() {
  const [current, setCurrent] = useState<string | null>(speakingId);
  useEffect(() => {
    speakingListeners.add(setCurrent);
    return () => {
      speakingListeners.delete(setCurrent);
    };
  }, []);
  const toggle = useCallback((id: string, text: string) => {
    if (speakingId === id) stopSpeaking();
    else speak(id, text).catch(() => setSpeaking(null));
  }, []);
  return { speakingId: current, toggle, stop: stopSpeaking };
}
