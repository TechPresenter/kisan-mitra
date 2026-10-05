// Home: "बोलकर पूछें" card with a big mic, opening the voice assistant.
import './strings';
import { memo } from 'react';
import { Mic } from 'lucide-react';
import { Card } from '../../components/ui';
import { useT } from '../../lib/i18n';
import type { HomeNav } from './util';

export const VoiceCta = memo(function VoiceCta({ go }: { go: HomeNav }) {
  const t = useT();
  return (
    <Card tone="brand" onPress={() => go.push('ai-voice')} aria-label={t('home.voice.aria')} className="flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-card-title leading-snug font-semibold text-ink">{t('home.voice.title')}</p>
        <p className="mt-0.5 text-small text-ink-2">{t('home.voice.body')}</p>
        <p className="mt-1.5 text-caption text-ink-2">{t('home.voice.example')}</p>
      </div>
      {/* Decorative: the whole card is the button (the mic itself listens on the next screen). */}
      <span aria-hidden className="inline-flex size-16 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white shadow-float">
        <Mic className="size-7" strokeWidth={2.25} />
      </span>
    </Card>
  );
});
