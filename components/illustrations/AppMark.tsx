// The app logo mark: the brand logo's leaves + sun (components/brand), matching the launcher
// icon and splash generated from the same artwork, so the brand looks the same everywhere.
import type { ReactNode } from 'react';
import { BrandLogo } from '../brand/BrandLogo';
import { pure } from './svg';
import type { ArtProps } from './svg';

export interface AppMarkProps extends ArtProps {
  /** Rendered width and height in px. */
  size?: number;
}

function AppMarkBase({ size = 40, className, style, title }: AppMarkProps) {
  return (
    <span className={className} style={{ display: 'inline-flex', ...style }}>
      <BrandLogo variant="mark" size={size} alt={title ?? ''} />
    </span>
  );
}

export const AppMark = pure(AppMarkBase);

export interface WordmarkProps extends Omit<ArtProps, 'title'> {
  /** Logo tile size in px. */
  size?: number;
  /** The name (and optional tagline) as the caller's translated, styled text; it is the accessible name. */
  children?: ReactNode;
}

/** Decorative logo tile followed by caller-supplied text, e.g. <Wordmark>{t('app.name')}</Wordmark>. */
export function Wordmark({ size = 40, className, style, children }: WordmarkProps) {
  return (
    <span className={'inline-flex items-center gap-3' + (className ? ' ' + className : '')} style={style}>
      <AppMark size={size} />
      {children}
    </span>
  );
}
