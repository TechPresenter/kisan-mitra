// 01 Splash: full-bleed farm landscape, the real brand logo and the tagline. Moves on by
// itself after ~1.4 s (sooner with reduced motion) or on a tap.
import { useEffect, useMemo, useRef } from 'react';
import { BrandLogo } from '../../components/brand/BrandLogo';
import { FarmScene, SCENE_INK } from '../../components/illustrations';
import { Screen } from '../../components/ui';
import { useT } from '../../lib/i18n';
import './strings';

const DELAY_MS = 1400;
const REDUCED_DELAY_MS = 700;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

export function SplashStep({ onNext }: { onNext: () => void }) {
  const t = useT();
  const done = useRef(false);
  const nextRef = useRef(onNext);
  nextRef.current = onNext;

  const advance = () => {
    if (done.current) return;
    done.current = true;
    nextRef.current();
  };

  useEffect(() => {
    const timer = window.setTimeout(advance, prefersReducedMotion() ? REDUCED_DELAY_MS : DELAY_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ~45% of the screen width, kept readable on small phones and modest on tablets.
  const logoSize = useMemo(() => {
    const w = Math.min((typeof window !== 'undefined' && window.innerWidth) || 360, 544);
    return Math.round(Math.min(240, Math.max(140, w * 0.45)));
  }, []);

  return (
    <Screen header={false} bottomNav={false} padded={false}>
      <button
        type="button"
        onClick={advance}
        aria-label={t('auth.splash.tap')}
        // Buttons centre their content vertically; the logo belongs in the calm sky up top.
        className="absolute inset-0 flex flex-col items-center justify-start overflow-hidden text-center outline-none"
      >
        <FarmScene variant="splash" className="absolute inset-0 size-full" />
        {/* vh first: WebViews older than Chrome 108 drop a dvh rule (inset included) entirely. */}
        <span className="relative flex flex-col items-center px-6 pt-[calc(15vh+var(--inset-top))] supports-[height:1dvh]:pt-[calc(15dvh+var(--inset-top))]">
          {/* The logo card has transparent corners, so a drop-shadow follows its rounded shape. */}
          <span className="block animate-pop-in" style={{ filter: 'drop-shadow(0 10px 22px rgb(16 24 20 / 0.20))' }}>
            <BrandLogo variant="full" size={logoSize} alt={t('auth.appName')} />
          </span>
          <span className="mt-5 block max-w-xs text-card-title leading-snug font-semibold" style={{ color: SCENE_INK.splash }}>
            {t('auth.tagline')}
          </span>
        </span>
      </button>
    </Screen>
  );
}
