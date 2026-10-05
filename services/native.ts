// Android (Capacitor) replacements for browser APIs that the Android WebView
// does not provide: Web Speech recognition/synthesis and a camera-or-gallery picker.
import { Capacitor, SystemBars, SystemBarsStyle, SystemBarType } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { TextToSpeech, QueueStrategy } from '@capacitor-community/text-to-speech';

export const isNative = Capacitor.isNativePlatform();

export interface NativeVoice {
  name: string;
  lang: string;
  voiceURI: string;
}

// Resolves to a JPEG data URL, or null if the user cancelled.
export const pickCropPhoto = async (labels: {
  header: string;
  camera: string;
  gallery: string;
  cancel: string;
}): Promise<string | null> => {
  try {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt,
      quality: 80,
      width: 1280,
      correctOrientation: true,
      promptLabelHeader: labels.header,
      promptLabelPicture: labels.camera,
      promptLabelPhoto: labels.gallery,
      promptLabelCancel: labels.cancel,
    });
    return photo.dataUrl ?? null;
  } catch (e: any) {
    if (/cancel/i.test(e?.message || '')) return null;
    throw e;
  }
};

// Shows the system speech dialog and resolves with the recognised text (or null).
export const listenOnce = async (language: string): Promise<string | null> => {
  const { available } = await SpeechRecognition.available();
  if (!available) throw new Error('Speech recognition unavailable');

  let perm = await SpeechRecognition.checkPermissions();
  if (perm.speechRecognition !== 'granted') {
    perm = await SpeechRecognition.requestPermissions();
  }
  if (perm.speechRecognition !== 'granted') throw new Error('Microphone permission denied');

  const { matches } = await SpeechRecognition.start({
    language,
    maxResults: 1,
    popup: true,
    partialResults: false,
  });
  return matches?.[0] ?? null;
};

export const getNativeVoices = async (): Promise<NativeVoice[]> => {
  const { voices } = await TextToSpeech.getSupportedVoices();
  return voices;
};

// speak() never settles once stop() interrupts it, so each run gets a generation
// number and bails out as soon as a newer run (or a stop) has started.
let ttsGeneration = 0;

export const speakNative = async (
  chunks: string[],
  lang: string,
  voiceURI: string | null,
): Promise<void> => {
  const generation = ++ttsGeneration;
  let voice: number | undefined;
  if (voiceURI) {
    const voices = await getNativeVoices();
    const index = voices.findIndex(v => v.voiceURI === voiceURI);
    if (index >= 0) voice = index;
  }
  for (const text of chunks) {
    if (generation !== ttsGeneration) return;
    await TextToSpeech.speak({
      text,
      lang,
      voice,
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      queueStrategy: QueueStrategy.Flush,
    });
  }
};

export const stopNativeSpeech = async (): Promise<void> => {
  ttsGeneration++;
  await TextToSpeech.stop();
};

// The status bar always sits on the dark green header; the navigation bar sits on
// the bottom nav, which is white only in the logged-in light theme.
export const syncSystemBars = (lightBottom: boolean): void => {
  if (!isNative) return;
  SystemBars.setStyle({ style: SystemBarsStyle.Dark, bar: SystemBarType.StatusBar }).catch(() => {});
  SystemBars.setStyle({
    style: lightBottom ? SystemBarsStyle.Light : SystemBarsStyle.Dark,
    bar: SystemBarType.NavigationBar,
  }).catch(() => {});
};

/** Share text via the Android share sheet (Web Share / clipboard fallback on the web). */
export const shareText = async (title: string, text: string): Promise<'shared' | 'copied' | 'failed'> => {
  try {
    if (isNative) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, text, dialogTitle: title });
      return 'shared';
    }
    if (navigator.share) {
      await navigator.share({ title, text });
      return 'shared';
    }
  } catch (e: any) {
    if (/cancel|abort/i.test(e?.message || e?.name || '')) return 'failed';
  }
  return (await copyText(text)) ? 'copied' : 'failed';
};

export const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
};
