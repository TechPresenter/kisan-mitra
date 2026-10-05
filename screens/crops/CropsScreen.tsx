// मेरी फसलें: every crop with its art, area, sowing date and current stage (reference 8).
// Grouped by farm once the farmer has more than one farm. Data is local, so there is no
// loading or network state here — only the empty state.
import './strings';
import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Button, EmptyState, ListRow, Screen, SectionHeader, TONE_TEXT, cx } from '../../components/ui';
import { CropArt, EmptyArt } from '../../components/illustrations';
import { stageForCrop, type StageStatus } from '../../data/crops';
import { placeLabel, useSettings } from '../../lib/app-state';
import { useLanguage, useT } from '../../lib/i18n';
import { useNav } from '../../lib/nav';
import { KEYS, useCollection } from '../../lib/store';
import type { Crop, Farm } from '../../types/models';
import { STAGE_TONE, areaText, cropLabel, plantingLine, stageShort, totalAreaText } from './helpers';
import { useToday } from './parts';

interface Row {
  crop: Crop;
  status: StageStatus;
}

interface Group {
  key: string;
  title?: string;
  subtitle?: string;
  rows: Row[];
}

/** Growing crops first, then planned ones, harvested last; newest first within each. */
const rank = (s: StageStatus) => (s.stage === 'harvested' ? 2 : s.stage === 'planned' ? 1 : 0);

export default function CropsScreen() {
  const t = useT();
  const nav = useNav();
  const { language } = useLanguage();
  const lang = language.code;
  const [settings] = useSettings();
  const crops = useCollection<Crop>(KEYS.crops).items;
  const farms = useCollection<Farm>(KEYS.farms).items;
  const today = useToday();

  const rows = useMemo<Row[]>(
    () =>
      crops
        .map(crop => ({ crop, status: stageForCrop(crop, today) }))
        .sort((a, b) => rank(a.status) - rank(b.status) || b.crop.createdAt.localeCompare(a.crop.createdAt)),
    [crops, today],
  );

  const groups = useMemo<Group[]>(() => {
    if (farms.length < 2) return [{ key: 'all', rows }];
    const known = new Set(farms.map(f => f.id));
    const list: Group[] = farms.map(f => ({
      key: f.id,
      title: f.name,
      subtitle: [f.area > 0 ? areaText(f.area, f.unit, t) : null, f.place ? placeLabel(f.place) : null].filter(Boolean).join(' • '),
      rows: rows.filter(r => r.crop.farmId === f.id),
    }));
    list.push({ key: 'none', title: t('crops.noFarm'), rows: rows.filter(r => !r.crop.farmId || !known.has(r.crop.farmId)) });
    return list.filter(g => g.rows.length);
  }, [farms, rows, t]);

  const total = useMemo(() => totalAreaText(crops, settings.bighaSqm, t), [crops, settings.bighaSqm, t]);
  const add = () => nav.push('crop-edit');

  return (
    <Screen
      title={t('crops.title')}
      subtitle={crops.length ? (crops.length === 1 ? t('crops.count.one') : t('crops.count', { n: crops.length })) : undefined}
      actions={[{ icon: Plus, label: t('crops.add'), onPress: add }]}
    >
      {!crops.length ? (
        <EmptyState
          art={<EmptyArt kind="crops" />}
          title={t('crops.empty.title')}
          body={t('crops.empty.body')}
          action={{ label: t('crops.add'), icon: Plus, onPress: add }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            {total ? <p className="text-small font-medium text-ink-2">{total}</p> : <span />}
            <Button icon={Plus} onClick={add} className="rounded-full!">
              {t('crops.add')}
            </Button>
          </div>
          {groups.map(g => (
            <section key={g.key} aria-label={g.title ?? t('crops.listLabel')} className="flex flex-col gap-3">
              {g.title ? <SectionHeader title={g.title} subtitle={g.subtitle || undefined} /> : null}
              <ul className="flex flex-col gap-3">
                {g.rows.map(({ crop, status }) => {
                  const name = cropLabel(crop, lang);
                  const area = areaText(crop.area, crop.unit, t);
                  const planted = plantingLine(crop, t);
                  const stage = t('crops.currentStage', { stage: stageShort(status, lang) });
                  return (
                    <li key={crop.id}>
                      <ListRow
                        leading={<CropArt crop={crop.cropKey} size={56} />}
                        title={
                          <>
                            {name}
                            {crop.variety ? <span className="font-normal text-ink-2"> ({crop.variety})</span> : null}
                          </>
                        }
                        subtitle={`${area} • ${planted}`}
                        meta={<span className={cx('text-small font-semibold', TONE_TEXT[STAGE_TONE[status.stage]])}>{stage}</span>}
                        ariaLabel={[crop.variety ? `${name} (${crop.variety})` : name, area, planted, stage].join(', ')}
                        onPress={() => nav.push('crop-detail', { id: crop.id })}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </Screen>
  );
}
