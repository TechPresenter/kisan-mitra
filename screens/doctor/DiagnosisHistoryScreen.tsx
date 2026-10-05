// पिछली जांच: every saved Crop Doctor check on this phone (newest first, max 40), with a crop
// filter, delete and an empty state that leads to a new check.
import './strings';
import { useMemo, useState } from 'react';
import { ScanSearch, Trash2 } from 'lucide-react';
import { EmptyArt } from '../../components/illustrations';
import { Button, ChipGroup, EmptyState, IconButton, Screen, confirm, toast } from '../../components/ui';
import { useLanguage, useT } from '../../lib/i18n';
import { useNav } from '../../lib/nav';
import { MAX_DIAGNOSES, diagnosisCropName, useDiagnoses } from '../../services/diagnosis';
import type { CropDiagnosis } from '../../types/models';
import { DiagnosisRow, diagnosisTitle } from './parts';

const ALL = 'all';

export default function DiagnosisHistoryScreen() {
  const t = useT();
  const nav = useNav();
  const { language } = useLanguage();
  const lang = language.code;
  const { items, remove } = useDiagnoses();
  const [filter, setFilter] = useState<string>(ALL);

  const cropOptions = useMemo(() => {
    const keys: string[] = [];
    for (const d of items) if (!keys.includes(d.cropKey)) keys.push(d.cropKey);
    return keys.map(k => {
      const sample = items.find(d => d.cropKey === k)!;
      return { value: k, label: diagnosisCropName(sample, lang), count: items.filter(d => d.cropKey === k).length };
    });
  }, [items, lang]);

  const active = filter !== ALL && cropOptions.some(o => o.value === filter) ? filter : ALL;
  const visible = useMemo(() => (active === ALL ? items : items.filter(d => d.cropKey === active)), [items, active]);

  const newCheck = () => {
    const prev = nav.stack[nav.stack.length - 2]?.screen;
    if (prev === 'crop-doctor') nav.pop();
    else nav.push('crop-doctor', active !== ALL ? { cropKey: active } : {});
  };

  const askDelete = async (d: CropDiagnosis) => {
    const ok = await confirm({
      title: t('doctor.history.delete'),
      message: t('doctor.history.deleteBody'),
      tone: 'danger',
      icon: Trash2,
    });
    if (!ok) return;
    remove(d.id);
    toast(t('doctor.history.deleted'), { id: 'doctor-deleted' });
  };

  return (
    <Screen
      title={t('doctor.history.title')}
      subtitle={items.length ? t('doctor.history.count', { n: items.length }) : undefined}
      footer={
        items.length ? (
          <Button fullWidth size="lg" icon={ScanSearch} onClick={newCheck}>
            {t('doctor.history.new')}
          </Button>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <EmptyState
          art={<EmptyArt kind="search" />}
          title={t('doctor.history.emptyTitle')}
          body={t('doctor.history.emptyBody')}
          action={{ label: t('doctor.history.emptyAction'), icon: ScanSearch, onPress: newCheck }}
        />
      ) : (
        <>
          {cropOptions.length >= 2 && (
            <ChipGroup
              ariaLabel={t('doctor.history.filter')}
              value={active}
              onChange={setFilter}
              options={[{ value: ALL, label: t('doctor.history.all'), count: items.length }, ...cropOptions]}
            />
          )}
          <ul aria-label={t('doctor.history.list')} className="flex flex-col gap-2.5">
            {visible.map(d => (
              <li key={d.id}>
                <DiagnosisRow
                  d={d}
                  lang={lang}
                  onPress={() => nav.push('diagnosis', { id: d.id })}
                  trailing={
                    <IconButton
                      icon={Trash2}
                      label={t('doctor.history.deleteAria', { issue: diagnosisTitle(d, t) })}
                      onClick={() => askDelete(d)}
                    />
                  }
                />
              </li>
            ))}
          </ul>
          {items.length >= MAX_DIAGNOSES - 5 && <p className="text-center text-caption text-ink-2">{t('doctor.history.keep', { n: MAX_DIAGNOSES })}</p>}
        </>
      )}
    </Screen>
  );
}
