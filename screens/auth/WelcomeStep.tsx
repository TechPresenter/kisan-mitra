// 02 Welcome: three swipeable slides (illustration card, title, one line), page dots,
// "आगे बढ़ें" and a "छोड़ें" link. Swipe with a finger, the buttons, the dots or ←/→ keys.
// While a finger drags, the track is moved directly (no React re-render per pointer move),
// which keeps the swipe smooth on low-end phones.
import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { Camera, CloudSun, Mic, ScanLine, Sparkles, TrendingUp } from 'lucide-react';
import { BrandLogo } from '../../components/brand/BrandLogo';
import { CropArt, FarmScene, LeafExample, SkyScene } from '../../components/illustrations';
import { Button, PaginationDots, Screen, cx, renderIcon, DUOTONE, TINT_BG, TONE_TEXT, type IconLike, type Tone } from '../../components/ui';
import { useLanguage, useT } from '../../lib/i18n';
import { LanguageButton } from './LanguageButton';
import './strings';

const SWIPE_PX = 48;

/** Small white tile with a tinted icon, floating over a slide's art. */
function FloatTile({ icon, tone, className }: { icon: IconLike; tone: Tone; className?: string }) {
  return (
    <span aria-hidden className={cx('absolute inline-flex size-12 items-center justify-center rounded-tile bg-surface shadow-float', className)}>
      <span className={cx('inline-flex size-9 items-center justify-center rounded-xl', TINT_BG[tone], TONE_TEXT[tone])}>
        {renderIcon(icon, { className: 'size-5', strokeWidth: 2.25, ...DUOTONE })}
      </span>
    </span>
  );
}

function ArtCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('relative aspect-[4/3] w-full overflow-hidden rounded-card border border-line', className)}>{children}</div>
  );
}

/** Corner brackets of a camera viewfinder. */
function Viewfinder() {
  const corner = 'absolute size-7 border-brand-700 dark:border-brand-600';
  return (
    <span aria-hidden className="absolute inset-0">
      <span className={cx(corner, 'top-0 left-0 rounded-tl-xl border-t-4 border-l-4')} />
      <span className={cx(corner, 'top-0 right-0 rounded-tr-xl border-t-4 border-r-4')} />
      <span className={cx(corner, 'bottom-0 left-0 rounded-bl-xl border-b-4 border-l-4')} />
      <span className={cx(corner, 'right-0 bottom-0 rounded-br-xl border-r-4 border-b-4')} />
    </span>
  );
}

const SLIDES: { key: 's1' | 's2' | 's3'; art: () => ReactNode }[] = [
  {
    key: 's1',
    art: () => (
      <ArtCard>
        <FarmScene variant="welcome" className="absolute inset-0 size-full" />
        <FloatTile icon={Sparkles} tone="tech" className="top-3 left-3" />
        {/* A speech bubble above the farmer: "ask by voice". */}
        <span
          aria-hidden
          className="absolute top-[30%] left-[58%] inline-flex size-12 items-center justify-center rounded-2xl rounded-bl-sm bg-surface text-brand shadow-float"
        >
          <Mic className="size-6" strokeWidth={2.25} />
        </span>
      </ArtCard>
    ),
  },
  {
    key: 's2',
    art: () => (
      <ArtCard>
        <SkyScene condition="clear-day" className="absolute inset-0 size-full" />
        <FloatTile icon={CloudSun} tone="sky" className="top-3 left-3" />
        <FloatTile icon={TrendingUp} tone="green" className="top-[4.25rem] left-3" />
      </ArtCard>
    ),
  },
  {
    key: 's3',
    art: () => (
      <ArtCard className="flex items-center justify-center bg-brand-50">
        <CropArt crop="wheat" size={52} className="absolute top-4 left-4 -rotate-6" />
        <CropArt crop="tomato" size={56} className="absolute bottom-4 left-6 rotate-3" />
        <span className="relative inline-flex p-3">
          <Viewfinder />
          <LeafExample kind="rust" size={128} />
        </span>
        <FloatTile icon={ScanLine} tone="green" className="top-4 right-4" />
        <FloatTile icon={Camera} tone="orange" className="right-5 bottom-4" />
      </ArtCard>
    ),
  },
];

export function WelcomeStep({ onDone, headingRef }: { onDone: () => void; headingRef?: { current: HTMLHeadingElement | null } }) {
  const t = useT();
  const { language } = useLanguage();
  const [index, setIndex] = useState(0);
  const drag = useRef<{ id: number; x: number; y: number; horizontal: boolean | null } | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  // The art has no text, so it is built once instead of on every render.
  const arts = useMemo(() => SLIDES.map(s => s.art()), []);
  const count = SLIDES.length;
  const last = index === count - 1;
  // Slides run left → right in every script; in RTL a swipe to the right moves forward.
  const dirSign = language.rtl ? -1 : 1;
  const offset = language.rtl ? index : -index;

  /** Positions the track: the current slide plus `dx` px of finger drag (animated when 0). */
  const place = (dx: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.style.transition = dx === 0 ? '' : 'none';
    el.style.transform = `translateX(calc(${offset * 100}% + ${dx}px))`;
  };

  // After each render (slide change, language direction), unless a finger is mid-swipe.
  useLayoutEffect(() => {
    if (!drag.current?.horizontal) place(0);
  });

  const goTo = (i: number) => setIndex(Math.max(0, Math.min(count - 1, i)));
  const next = () => (last ? onDone() : goTo(index + 1));

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, horizontal: null };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (d.horizontal === null && Math.abs(dx) + Math.abs(dy) > 8) {
      d.horizontal = Math.abs(dx) > Math.abs(dy);
      if (d.horizontal) e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    if (d.horizontal) {
      // Resist past the first and last slide.
      const forward = dx * dirSign < 0;
      const atEdge = forward ? index === count - 1 : index === 0;
      place(atEdge ? dx / 3 : dx);
    }
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const dx = e.clientX - d.x;
    // Snap back; when the index changes the layout effect moves the track on from here.
    place(0);
    if (!d.horizontal || Math.abs(dx) < SWIPE_PX) return;
    goTo(index + (dx < 0 ? 1 : -1) * dirSign);
  };

  // The browser took the gesture over (e.g. a vertical scroll): just snap back.
  const cancelDrag = () => {
    drag.current = null;
    place(0);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') goTo(index + dirSign);
    else if (e.key === 'ArrowLeft') goTo(index - dirSign);
  };

  return (
    <Screen
      header={false}
      bottomNav={false}
      footer={
        <div className="flex flex-col gap-2">
          <PaginationDots count={count} index={index} onSelect={goTo} />
          <Button fullWidth size="lg" onClick={next}>
            {last ? t('auth.welcome.start') : t('common.next')}
          </Button>
        </div>
      }
    >
      <div className="flex min-h-12 items-center justify-between gap-2 pt-2">
        {/* The heading below already names the app; the mark alone keeps this row fitting 320px phones. */}
        <BrandLogo variant="mark" size={40} alt={t('auth.appName')} />
        <span className="flex min-w-0 items-center">
          <LanguageButton />
          <Button variant="ghost" onClick={onDone}>
            {t('common.skip')}
          </Button>
        </span>
      </div>

      <h1 ref={headingRef} tabIndex={-1} className="text-[1.5rem] leading-snug font-bold text-ink outline-none">
        {t('auth.welcome.title')}
      </h1>

      <div
        role="region"
        aria-roledescription="carousel"
        aria-label={t('auth.welcome.carousel')}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="-mx-4 overflow-hidden rounded-card outline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
      >
        <div
          ref={trackRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={cancelDrag}
          className="flex touch-pan-y transition-transform duration-200 ease-out select-none"
        >
          {SLIDES.map((s, i) => {
            const active = i === index;
            return (
              <div
                key={s.key}
                role="group"
                aria-roledescription="slide"
                aria-label={t('auth.welcome.slide', { n: i + 1, total: count })}
                aria-hidden={!active}
                inert={!active}
                className="w-full shrink-0 px-4"
              >
                {arts[i]}
                <h2 className="mt-5 text-section leading-snug font-bold text-ink">{t(`auth.welcome.${s.key}.title`)}</h2>
                <p className="mt-1.5 text-body text-ink-2">{t(`auth.welcome.${s.key}.body`)}</p>
              </div>
            );
          })}
        </div>
        <p className="sr-only" aria-live="polite">
          {t('auth.welcome.slide', { n: index + 1, total: count })}: {t(`auth.welcome.${SLIDES[index].key}.title`)}
        </p>
      </div>
    </Screen>
  );
}
