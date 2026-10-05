// Applies Settings → theme / high contrast / text size to <html>, where index.css reads them.
import { useEffect } from 'react';
import { useSettings } from '../../lib/app-state';
import type { AppSettings } from '../../types/models';

export type Appearance = Pick<AppSettings, 'theme' | 'highContrast' | 'textScale'>;

const THEME_COLOR = { light: '#14532d', dark: '#0f3d22' } as const;

export function applyAppearance({ theme, highContrast, textScale }: Appearance, root: HTMLElement = document.documentElement) {
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('hc', !!highContrast);
  root.style.setProperty('--text-scale', String(textScale || 1));
  // Browser chrome / PWA status bar follows the app bar colour.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme] ?? THEME_COLOR.light);
}

/** Mount once in the app shell: keeps <html> in sync with the saved settings. */
export function useApplyAppearance() {
  const [settings] = useSettings();
  const { theme, highContrast, textScale } = settings;
  useEffect(() => {
    applyAppearance({ theme, highContrast, textScale });
  }, [theme, highContrast, textScale]);
}
