// The Kisan Mitra brand logo (bundled, works offline).
// - 'full': the complete logo card with "किसान मित्र" + tagline — splash, login, about.
// - 'mark': leaves + sun only, for small placements (app bars, avatars) where text can't be read.
import logoFull from './logo-full.webp';
import logoMark from './logo-mark.webp';

export interface BrandLogoProps {
  variant?: 'full' | 'mark';
  /** Rendered width/height in px (the logo is square). */
  size?: number;
  className?: string;
  /** Accessible name; pass '' when the brand name is already shown next to it. */
  alt?: string;
}

export function BrandLogo({ variant = 'full', size = 96, className = '', alt = 'किसान मित्र' }: BrandLogoProps) {
  return (
    <img
      src={variant === 'full' ? logoFull : logoMark}
      width={size}
      height={size}
      alt={alt}
      aria-hidden={alt === '' ? true : undefined}
      draggable={false}
      decoding="async"
      className={`select-none shrink-0 object-contain ${variant === 'mark' ? 'rounded-[24%]' : ''} ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export default BrandLogo;
