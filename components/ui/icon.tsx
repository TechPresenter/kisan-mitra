import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/** A lucide icon component (preferred, so the kit can size/colour it) or a ready element. */
export type IconLike = LucideIcon | ReactElement;

/** The SVG props the kit passes to icons (spelled out: LucideProps is empty without @types/react). */
export interface IconProps {
  className?: string;
  strokeWidth?: number;
  fill?: string;
  fillOpacity?: number;
  size?: number | string;
}

/** Two-tone look for stroke icons: a faint fill of the same colour behind the stroke. */
export const DUOTONE: IconProps = { fill: 'currentColor', fillOpacity: 0.18 };

export function renderIcon(icon: IconLike | null | undefined, props: IconProps = {}): ReactNode {
  if (!icon) return null;
  if (isValidElement(icon)) return icon;
  return createElement(icon, { 'aria-hidden': true, focusable: 'false', ...props });
}
