import { useState } from 'react';
import { cx } from './cx';
import { TINT_BG, TONE_TEXT, toneFor } from './tones';

export interface AvatarProps {
  name: string;
  src?: string | null;
  /** sm 32px, md 40px, lg 56px, xl 80px (profile header). */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE = {
  sm: 'size-8 text-caption',
  md: 'size-10 text-small',
  lg: 'size-14 text-section',
  xl: 'size-20 text-[1.75rem]',
} as const;

// Nukta signs of the Indic scripts: "ज़" stays "ज़", but matras are dropped so initials read
// as letters ("रक"), not a syllable ("राकु").
const NUKTA = /^[\u093C\u09BC\u0A3C\u0ABC\u0B3C\u0CBC]$/;

function firstLetter(word: string): string {
  const chars = Array.from(word);
  return (chars[0] ?? '') + (chars[1] && NUKTA.test(chars[1]) ? chars[1] : '');
}

/** "राम कुमार" → "रक", "Sita Devi" → "SD". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const first = firstLetter(words[0]);
  const last = words.length > 1 ? firstLetter(words[words.length - 1]) : '';
  return (first + last).toUpperCase();
}

/** Initials on a deterministic pastel circle, or the photo when available. */
export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const tone = toneFor(name.trim().toLowerCase());
  const showImg = !!src && !failed;
  return (
    <span
      role="img"
      aria-label={name}
      className={cx(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold select-none',
        SIZE[size],
        !showImg && cx(TINT_BG[tone], TONE_TEXT[tone]),
        className,
      )}
    >
      {showImg ? (
        <img src={src} alt="" onError={() => setFailed(true)} className="size-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <span aria-hidden className="pt-[0.1em] leading-none">
          {initials(name)}
        </span>
      )}
    </span>
  );
}
