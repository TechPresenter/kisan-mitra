import { LoaderCircle } from 'lucide-react';
import { cx } from './cx';

export interface SpinnerProps {
  /** sm = 1rem (inside small buttons), md = 1.25rem. */
  size?: 'sm' | 'md';
  /** Screen-reader text; omit when the parent already says it is busy (e.g. a loading Button). */
  label?: string;
  className?: string;
}

/** Small inline spinner for buttons and inline refreshes. Whole screens use skeletons instead. */
export function Spinner({ size = 'md', label, className }: SpinnerProps) {
  const icon = (
    <LoaderCircle aria-hidden className={cx('shrink-0 animate-spin', size === 'sm' ? 'size-4' : 'size-5', className)} />
  );
  if (!label) return icon;
  return (
    <span role="status" className="inline-flex">
      {icon}
      <span className="sr-only">{label}</span>
    </span>
  );
}
