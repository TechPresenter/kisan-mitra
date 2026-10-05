import { useCallback, useEffect, useState, type ReactNode, type Ref, type UIEvent } from 'react';
import { RefreshCw } from 'lucide-react';
import { useT } from '../../lib/i18n';
import { AppBar, AppBarActions, isActionList, type AppBarAction } from './AppBar';
import { cx } from './cx';
import { useOptionalNav } from './hooks';
import '../../lib/common-strings';

export interface ScreenProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  /**
   * Back arrow. Default: shown when the tab stack can go back, calling nav.pop().
   * `false` hides it; a function replaces the default action.
   */
  back?: boolean | (() => void);
  /** Replaces the back arrow (e.g. Home's logo tile). */
  leading?: ReactNode;
  actions?: AppBarAction[] | ReactNode;
  /** Extra content inside the green header (Home location pill, search…). */
  headerContent?: ReactNode;
  /** Adds a refresh action to the app bar. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Default true: 16px gutter, top spacing and 20px gaps between direct children. */
  padded?: boolean;
  /** 'hero': the app bar floats transparent over `hero` and turns green once scrolled. */
  tone?: 'default' | 'hero';
  /** Full-bleed illustrated header for tone="hero" (start its content with `appbar-pt`). */
  hero?: ReactNode;
  /** Sticky footer above the bottom nav (primary actions). */
  footer?: ReactNode;
  /** Default true: reserve space for the fixed bottom navigation. */
  bottomNav?: boolean;
  /** Default true. False hides the app bar (splash, onboarding). */
  header?: boolean;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  /** The scroll container, e.g. to scroll to top. */
  scrollRef?: Ref<HTMLDivElement>;
}

// Hero app bars turn solid once the illustration starts scrolling under them.
const HERO_SOLID_AFTER = 24;

// Sticky footers publish their height as --footer-h on <html> so toasts and FABs (nav-bottom)
// float above the footer's button instead of covering it. Kept per footer because tab stacks
// may keep several screens mounted: hidden ones measure 0, so the tallest is the visible one.
const footerHeights = new Map<symbol, number>();

function publishFooterHeight() {
  const h = Math.max(0, ...footerHeights.values());
  const style = document.documentElement.style;
  if (h > 0) style.setProperty('--footer-h', `${h}px`);
  else style.removeProperty('--footer-h');
}

function useFooterHeight(): (el: HTMLDivElement | null) => void {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!el) return;
    const key = Symbol('footer');
    const measure = () => {
      footerHeights.set(key, el.offsetHeight);
      publishFooterHeight();
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      footerHeights.delete(key);
      publishFooterHeight();
    };
  }, [el]);
  return setEl;
}

/**
 * Page layout: app bar + its own scroll area (safe-area aware) + optional sticky footer.
 * The parent (app shell) must give it a height, e.g. h-dvh.
 */
export function Screen({
  title,
  subtitle,
  back,
  leading,
  actions,
  headerContent,
  onRefresh,
  refreshing = false,
  padded = true,
  tone = 'default',
  hero,
  footer,
  bottomNav = true,
  header = true,
  children,
  className,
  contentClassName,
  scrollRef,
}: ScreenProps) {
  const t = useT();
  const nav = useOptionalNav();
  const [scrolled, setScrolled] = useState(false);
  const setFooterEl = useFooterHeight();

  const setScrollEl = useCallback(
    (el: HTMLDivElement | null) => {
      if (typeof scrollRef === 'function') scrollRef(el);
      else if (scrollRef) (scrollRef as { current: HTMLDivElement | null }).current = el;
    },
    [scrollRef],
  );

  const onBack =
    typeof back === 'function'
      ? back
      : back === false || !(back === true || nav?.canGoBack)
        ? undefined
        : () => {
            nav?.pop();
          };

  let barActions: AppBarAction[] | ReactNode = actions;
  if (onRefresh) {
    const refresh: AppBarAction = {
      key: 'refresh',
      icon: RefreshCw,
      label: t('common.refresh'),
      onPress: onRefresh,
      disabled: refreshing,
      busy: refreshing,
    };
    if (actions == null) barActions = [refresh];
    else if (isActionList(actions)) barActions = [...actions, refresh];
    else
      barActions = (
        <>
          {actions}
          <AppBarActions actions={[refresh]} />
        </>
      );
  }

  const isHero = tone === 'hero';
  const onScroll = isHero
    ? (e: UIEvent<HTMLDivElement>) => {
        const next = e.currentTarget.scrollTop > HERO_SOLID_AFTER;
        setScrolled(prev => (prev === next ? prev : next));
      }
    : undefined;

  // With a footer the footer itself clears the nav; otherwise the content does.
  const bottomPad = footer != null ? 'pb-6' : bottomNav ? 'nav-pb' : 'pb-[calc(1.5rem+var(--inset-bottom))]';

  return (
    <div className={cx('relative flex h-full min-h-0 flex-col bg-canvas', className)}>
      {header && (
        <AppBar
          title={title}
          subtitle={subtitle}
          onBack={onBack}
          leading={leading}
          actions={barActions}
          transparent={isHero && !scrolled}
          overlay={isHero}
        >
          {headerContent}
        </AppBar>
      )}
      <div
        ref={setScrollEl}
        onScroll={onScroll}
        className={cx('min-h-0 flex-1 overflow-y-auto overscroll-contain', !header && 'safe-pt')}
      >
        {isHero && hero}
        <main
          className={cx(
            padded && 'flex flex-col gap-5 px-4',
            padded && (isHero && hero ? 'pt-5' : 'pt-4'),
            bottomPad,
            contentClassName,
          )}
        >
          {children}
        </main>
      </div>
      {footer != null && (
        <div
          ref={setFooterEl}
          className={cx(
            'shrink-0 border-t border-line bg-surface px-4 pt-3',
            bottomNav ? 'nav-mb pb-3' : 'pb-[calc(0.75rem+var(--inset-bottom))]',
          )}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
