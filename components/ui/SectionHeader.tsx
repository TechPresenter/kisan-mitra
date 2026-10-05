import { isValidElement, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { useT } from '../../lib/i18n';
import { cx } from './cx';
import { renderIcon, type IconLike } from './icon';
import '../../lib/common-strings';

export interface SectionAction {
  /** Defaults to "सभी देखें". */
  label?: string;
  onPress: () => void;
}

export interface SectionHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: IconLike;
  /** `{ onPress }` renders a "सभी देखें ›" link; any node renders as is. */
  action?: SectionAction | ReactNode;
  as?: 'h2' | 'h3';
  className?: string;
}

function isSectionAction(a: unknown): a is SectionAction {
  return !!a && typeof a === 'object' && !isValidElement(a) && 'onPress' in a;
}

/** Section title (18px bold) with an optional "सभी देखें" action on the right. */
export function SectionHeader({ title, subtitle, icon, action, as: Tag = 'h2', className }: SectionHeaderProps) {
  const t = useT();
  return (
    <div className={cx('flex items-end justify-between gap-3', className)}>
      <div className="flex min-w-0 items-center gap-2">
        {renderIcon(icon, { className: 'size-5 shrink-0 text-brand-700', strokeWidth: 2.25 })}
        <div className="min-w-0">
          <Tag className="text-section font-bold text-ink">{title}</Tag>
          {subtitle != null && <p className="text-small text-ink-2">{subtitle}</p>}
        </div>
      </div>
      {isSectionAction(action) ? (
        <button
          type="button"
          onClick={action.onPress}
          className="press -my-2 -mr-2 inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-full px-2 text-small font-semibold text-brand hover:bg-brand-50"
        >
          <span className="pt-0.5">{action.label ?? t('common.seeAll')}</span>
          <ChevronRight aria-hidden className="size-4" strokeWidth={2.5} />
        </button>
      ) : (
        action
      )}
    </div>
  );
}
