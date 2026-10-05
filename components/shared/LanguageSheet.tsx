// Language picker. Fully translated languages are listed first; the rest fall back to Hindi
// for untranslated text (AI answers still come back in the chosen language).
import { Check } from 'lucide-react';
import { Badge, ListGroup, ListRow, Sheet } from '../ui';
import { LANGUAGES, useLanguage, useT } from '../../lib/i18n';
import './strings';

export interface LanguageSheetProps {
  open: boolean;
  onClose: () => void;
  onSelect?: (code: string) => void;
}

const ORDERED = [...LANGUAGES].sort((a, b) => Number(b.complete) - Number(a.complete));

export function LanguageSheet({ open, onClose, onSelect }: LanguageSheetProps) {
  const t = useT();
  const { language, setLanguage } = useLanguage();
  return (
    <Sheet open={open} onClose={onClose} size="tall" title={t('shared.language.title')} description={t('shared.language.note')}>
      <ListGroup ariaLabel={t('shared.language.title')}>
        {ORDERED.map(l => (
          <ListRow
            key={l.code}
            variant="plain"
            title={<span lang={l.code}>{l.label}</span>}
            subtitle={l.nameEn}
            trailing={
              l.code === language.code ? (
                <Check className="w-6 h-6 text-brand-700" aria-label={t('shared.language.selected')} />
              ) : !l.complete ? (
                <Badge tone="gray" size="sm">{t('shared.language.partial')}</Badge>
              ) : undefined
            }
            onPress={() => {
              setLanguage(l.code);
              onSelect?.(l.code);
              onClose();
            }}
          />
        ))}
      </ListGroup>
    </Sheet>
  );
}

export default LanguageSheet;
