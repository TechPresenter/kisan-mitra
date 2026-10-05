import type { KeyboardEvent, ReactNode, Ref } from 'react';
import { cx } from './cx';
import type { CommonAttrs } from './types';

export type CardTone = 'default' | 'muted' | 'brand' | 'tech' | 'warning' | 'danger' | 'sky';

export interface CardProps extends CommonAttrs {
  tone?: CardTone;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** card = 20px (default), list = 16px. */
  radius?: 'card' | 'list';
  /** Floating cards (over illustrations) get the soft shadow; regular cards use the border. */
  elevated?: boolean;
  /** Makes the whole card a button (Enter/Space work, press feedback). */
  onPress?: () => void;
  as?: 'div' | 'section' | 'article' | 'li';
  children?: ReactNode;
  ref?: Ref<HTMLElement>;
}

const TONE: Record<CardTone, string> = {
  default: 'bg-surface border border-line',
  muted: 'bg-surface-2 border border-transparent hc:border-line',
  brand: 'bg-brand-50 border border-brand-100',
  tech: 'bg-tech-tint border border-tech/15',
  warning: 'bg-tint-amber border border-transparent hc:border-line',
  danger: 'bg-tint-red border border-transparent hc:border-line',
  sky: 'bg-tint-sky border border-transparent hc:border-line',
};

const PAD = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-5' } as const;

/** White rounded surface with a soft 1px border (DESIGN: mostly borders, few shadows). */
export function Card({
  tone = 'default',
  padding = 'md',
  radius = 'card',
  elevated = false,
  onPress,
  as: Tag = 'div',
  className,
  children,
  ref,
  ...rest
}: CardProps) {
  const pressProps = onPress
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onClick: onPress,
        onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onPress();
          }
        },
      }
    : {};
  return (
    <Tag
      ref={ref as Ref<never>}
      className={cx(
        TONE[tone],
        PAD[padding],
        radius === 'card' ? 'rounded-card' : 'rounded-list',
        elevated && 'shadow-float',
        onPress && 'press cursor-pointer select-none hover:border-line-strong',
        className,
      )}
      {...pressProps}
      {...rest}
    >
      {children}
    </Tag>
  );
}
