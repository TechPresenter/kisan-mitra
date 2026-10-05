// Crop selection grid with crop art — onboarding ("आप कौन-कौन सी फसल उगाते हैं?"),
// add-crop form and Crop Doctor's "फसल चुनें" step.
import { useMemo, useState } from 'react';
import { CropArt } from '../illustrations';
import { RadioCards, SearchBar } from '../ui';
import { CROP_LIST } from '../../data/crops';
import { useLanguage, useT } from '../../lib/i18n';
import './strings';

interface Common {
  label?: string;
  hint?: string;
  error?: string;
  /** Show a search box above the grid (useful with all 24 crops). */
  searchable?: boolean;
  /** Limit to these crop keys (e.g. seasonal crops). */
  only?: readonly string[];
  columns?: 2 | 3;
}

type Single = Common & { multiple?: false; value: string | null; onChange: (key: string) => void };
type Multi = Common & { multiple: true; value: string[]; onChange: (keys: string[]) => void };

export type CropPickerProps = Single | Multi;

export function CropPicker(props: CropPickerProps) {
  const t = useT();
  const { language } = useLanguage();
  const [q, setQ] = useState('');
  const options = useMemo(() => {
    const query = q.trim().toLowerCase();
    return CROP_LIST.filter(c => !props.only || props.only.includes(c.key))
      .filter(c => !query || c.nameHi.includes(query) || c.nameEn.toLowerCase().includes(query) || (c.otherNamesHi || []).some(n => n.includes(query)))
      .map(c => ({
        value: c.key as string,
        label: language.code === 'en' ? c.nameEn : c.nameHi,
        media: <CropArt crop={c.key} size={48} />,
      }));
  }, [q, props.only, language.code]);

  return (
    <div className="space-y-3">
      {props.searchable && <SearchBar value={q} onChange={setQ} voice placeholder={t('shared.crops.search')} />}
      {props.multiple === true ? (
        <RadioCards
          multiple
          columns={props.columns ?? 3}
          label={props.label}
          hint={props.hint}
          error={props.error}
          value={(props as Multi).value}
          onChange={(props as Multi).onChange}
          options={options}
        />
      ) : (
        <RadioCards
          columns={props.columns ?? 3}
          label={props.label}
          hint={props.hint}
          error={props.error}
          value={(props as Single).value}
          onChange={(props as Single).onChange}
          options={options}
        />
      )}
      {!options.length && <p className="text-center text-ink-2 py-4">{t('shared.crops.none')}</p>}
    </div>
  );
}

export default CropPicker;
