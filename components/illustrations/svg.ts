// Shared plumbing for the illustration set. Kept framework-light so every piece stays a pure,
// prop-driven SVG that is cheap to memoise and renders identically on the server (contact sheets).
import { memo, useId } from 'react';
import type { CSSProperties, ReactNode } from 'react';

export interface ArtProps {
  className?: string;
  style?: CSSProperties;
  /** Accessible name. Without it the art is decorative and hidden from screen readers. */
  title?: string;
}

/** memo() that keeps the component's own prop types, whatever React's typings resolve to. */
export function pure<P extends object>(component: (props: P) => ReactNode): (props: P) => ReactNode {
  return memo(component);
}

/** Per-instance prefix for gradient ids: two scenes on one screen must never share <defs>. */
export function useSvgId(): string {
  return 'ka' + useId().replace(/[^\w-]/g, '');
}

type A11yAttrs = { role: 'img'; 'aria-label': string } | { 'aria-hidden': true; focusable: 'false' };

/** Decorative by default; a title turns the art into a labelled image. */
export function a11y(title?: string): A11yAttrs {
  return title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true, focusable: 'false' };
}

/** Closed star/rosette path, used for calyxes, bracts and sparkles. */
export function star(cx: number, cy: number, outer: number, inner: number, points: number, rotateDeg = -90): string {
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const a = ((rotateDeg + (i * 180) / points) * Math.PI) / 180;
    const r = i % 2 ? inner : outer;
    d += (i ? 'L' : 'M') + +(cx + r * Math.cos(a)).toFixed(1) + ' ' + +(cy + r * Math.sin(a)).toFixed(1);
  }
  return d + 'Z';
}

/** Rotation transform about a point; undefined for 0 so the markup stays small. */
export const rot = (deg: number, x: number, y: number): string | undefined =>
  deg ? `rotate(${deg} ${x} ${y})` : undefined;
