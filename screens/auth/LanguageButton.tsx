// Language switch for the screens before onboarding (welcome, login), so a farmer who does not
// read Hindi can change the language straight away. Opens the shared LanguageSheet.
import { useState } from 'react';
import { Languages } from 'lucide-react';
import { LanguageSheet } from '../../components/shared/LanguageSheet';
import { cx } from '../../components/ui';
import { useLanguage, useT } from '../../lib/i18n';
import '../../components/shared/strings';

export function LanguageButton({ onDark = false, className }: { onDark?: boolean; className?: string }) {
  const t = useT();
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${t('shared.language.title')}: ${language.label}`}
        className={cx(
          'press inline-flex min-h-12 items-center gap-1.5 rounded-full px-3 text-small font-semibold',
          onDark ? 'text-white hover:bg-white/10' : 'text-brand hover:bg-brand-50',
          className,
        )}
      >
        <Languages aria-hidden className="size-5 shrink-0" />
        <span lang={language.code}>{language.label}</span>
      </button>
      <LanguageSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
