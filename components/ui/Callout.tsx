import type { ReactNode } from 'react';
import { CircleCheck, Info, Sparkles, TriangleAlert } from 'lucide-react';
import { useT } from '../../lib/i18n';
import { cx } from './cx';
import { DUOTONE, renderIcon, type IconLike } from './icon';
import '../../lib/common-strings';

export type CalloutTone = 'brand' | 'tech' | 'warning' | 'danger' | 'info' | 'neutral';

export interface CalloutProps {
  tone?: CalloutTone;
  /** Defaults per tone; pass null for none. */
  icon?: IconLike | null;
  title?: ReactNode;
  children?: ReactNode;
  /** Buttons / links under the text. */
  action?: ReactNode;
  /** Right side (e.g. a ListenButton). */
  aside?: ReactNode;
  role?: 'note' | 'status' | 'alert';
  className?: string;
}

const STYLE: Record<CalloutTone, { box: string; icon: string; Icon: IconLike }> = {
  brand: { box: 'bg-brand-50 border-brand-100', icon: 'bg-surface text-brand', Icon: CircleCheck },
  tech: { box: 'bg-tech-tint border-tech/15', icon: 'bg-surface text-tech', Icon: Sparkles },
  warning: { box: 'bg-tint-amber border-transparent hc:border-line', icon: 'bg-surface/70 text-tone-amber', Icon: TriangleAlert },
  danger: { box: 'bg-tint-red border-transparent hc:border-line', icon: 'bg-surface/70 text-tone-red', Icon: TriangleAlert },
  info: { box: 'bg-tint-sky border-transparent hc:border-line', icon: 'bg-surface/70 text-tone-sky', Icon: Info },
  neutral: { box: 'bg-surface-2 border-line', icon: 'bg-surface text-ink-2', Icon: Info },
};

/**
 * Tinted info card: green "क्या आज स्प्रे करना सही है?" tip, lavender "AI बाजार संकेत",
 * amber warnings. Text stays in ink colours; the tint and icon carry the meaning.
 */
export function Callout({ tone = 'brand', icon, title, children, action, aside, role = 'note', className }: CalloutProps) {
  const s = STYLE[tone];
  const glyph = icon === null ? null : (icon ?? s.Icon);
  return (
    <div role={role} className={cx('flex items-start gap-3 rounded-list border p-4', s.box, className)}>
      {glyph && (
        <span aria-hidden className={cx('inline-flex size-10 shrink-0 items-center justify-center rounded-full', s.icon)}>
          {renderIcon(glyph, { className: 'size-5.5', strokeWidth: 2, ...DUOTONE })}
        </span>
      )}
      <div className="min-w-0 flex-1 pt-0.5">
        {title != null && <p className="text-body leading-snug font-semibold text-ink">{title}</p>}
        {children != null && <div className={cx('text-small text-ink-2', title != null && 'mt-0.5')}>{children}</div>}
        {action != null && <div className="mt-3 flex flex-wrap gap-2">{action}</div>}
      </div>
      {aside != null && <div className="shrink-0">{aside}</div>}
    </div>
  );
}

export interface DisclaimerProps {
  /** info (default), warning, ai (lavender with sparkles). */
  variant?: 'info' | 'warning' | 'ai';
  /** Picks the standard text when no children: common.disclaimer.{ai|fertilizer|price}. */
  kind?: 'ai' | 'fertilizer' | 'price';
  children?: ReactNode;
  className?: string;
}

/** Required next to AI diagnosis, fertilizer and price guidance. */
export function Disclaimer({ variant, kind, children, className }: DisclaimerProps) {
  const t = useT();
  const v = variant ?? (kind === 'ai' || (!kind && !children) ? 'ai' : 'info');
  const text = children ?? t(`common.disclaimer.${kind ?? 'ai'}`);
  const tone = v === 'ai' ? 'bg-tech-tint text-ink-2' : v === 'warning' ? 'bg-tint-amber text-ink-2' : 'bg-surface-2 text-ink-2';
  const Icon = v === 'ai' ? Sparkles : v === 'warning' ? TriangleAlert : Info;
  const iconCls = v === 'ai' ? 'text-tech' : v === 'warning' ? 'text-tone-amber' : 'text-ink-3';
  return (
    <div role="note" className={cx('flex items-start gap-2.5 rounded-xl px-3.5 py-3 hc:border hc:border-line', tone, className)}>
      <Icon aria-hidden className={cx('mt-0.5 size-4.5 shrink-0', iconCls)} />
      <p className="text-caption leading-relaxed">{text}</p>
    </div>
  );
}
