// Home: "मेरी फसलें" — horizontal crop cards (art, area, stage, progress, next task) + an add card.
import './strings';
import { memo, useMemo } from 'react';
import { CalendarClock, Plus } from 'lucide-react';
import { Card, EmptyState, ProgressBar, SectionHeader, ToneIcon } from '../../components/ui';
import { CropArt, EmptyArt } from '../../components/illustrations';
import { catalogText, stageForCrop } from '../../data/crops';
import { formatDate, formatNumber, relativeDay } from '../../lib/format';
import { useLanguage, useT } from '../../lib/i18n';
import { nextTaskForCrop, taskText } from '../../services/tasks';
import type { Crop, FarmingTask } from '../../types/models';
import { displayCropName, type HomeNav } from './util';

/** Cards shown on Home; the rest are one tap away in "सभी देखें". */
const MAX_CARDS = 8;

export interface MyCropsSectionProps {
  crops: Crop[];
  tasks: FarmingTask[];
  /** Today's date (YYYY-MM-DD), from Home so stages move on after midnight. */
  today: string;
  go: HomeNav;
}

export const MyCropsSection = memo(function MyCropsSection({ crops, tasks, today, go }: MyCropsSectionProps) {
  const t = useT();
  const { language } = useLanguage();
  const lang = language.code;

  const cards = useMemo(
    () =>
      crops
        .map(crop => {
          const stage = stageForCrop(crop, today);
          const next = nextTaskForCrop(crop.id, tasks);
          return { crop, stage, next };
        })
        // Growing crops first; harvested ones go to the end.
        .sort((a, b) => Number(a.stage.stage === 'harvested') - Number(b.stage.stage === 'harvested'))
        .slice(0, MAX_CARDS),
    [crops, tasks, today],
  );

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title={t('home.crops.title')} action={crops.length ? { onPress: () => go.push('crops') } : undefined} />
      {crops.length === 0 ? (
        <Card padding="sm">
          <EmptyState
            compact
            art={<EmptyArt kind="crops" size={120} />}
            title={t('home.crops.emptyTitle')}
            body={t('home.crops.emptyBody')}
            action={{ label: t('home.crops.emptyAction'), icon: Plus, onPress: () => go.push('crop-edit') }}
          />
        </Card>
      ) : (
        <div role="list" aria-label={t('home.crops.title')} className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 scrollbar-none">
          {cards.map(({ crop, stage, next }) => {
            const name = displayCropName(crop, lang);
            const pct = Math.round(stage.progressPct);
            const overdue = !!next && next.dueDate < today;
            const nextText = !next
              ? t('home.crops.noTask')
              : overdue
                ? t('home.crops.overdue', { task: taskText(next, lang).title, date: formatDate(next.dueDate) })
                : t('home.crops.next', { task: taskText(next, lang).title, when: relativeDay(next.dueDate) });
            // Onboarding saves area 0 when the farmer skipped the land question.
            const area = crop.area > 0 ? t('home.crops.area', { n: formatNumber(crop.area), unit: t(`common.${crop.unit}`) }) : t('home.crops.noArea');
            return (
              <div role="listitem" key={crop.id} className="flex w-[15.5rem] shrink-0 snap-start">
                <Card onPress={() => go.push('crop-detail', { id: crop.id })} className="flex w-full flex-col">
                  <div className="flex items-center gap-3">
                    <CropArt crop={crop.cropKey} size={48} />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-body leading-snug font-semibold text-ink">{name}</p>
                      <p className="text-caption text-ink-2">{area}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <p className="line-clamp-1 min-w-0 flex-1 text-small leading-snug font-medium text-ink">
                      {catalogText(lang, stage.labelHi, stage.labelEn)}
                    </p>
                    <span className="shrink-0 text-caption text-ink-2 tabular-nums">{pct}%</span>
                  </div>
                  <ProgressBar value={pct} size="sm" ariaLabel={t('home.crops.progress', { pct })} className="mt-1.5" />
                  <p className="mt-3 flex items-start gap-1.5 text-caption text-ink-2">
                    <CalendarClock aria-hidden className={overdue ? 'mt-0.5 size-4 shrink-0 text-tone-red' : 'mt-0.5 size-4 shrink-0 text-tone-orange'} />
                    <span className="line-clamp-2 leading-snug">{nextText}</span>
                  </p>
                </Card>
              </div>
            );
          })}
          <div role="listitem" className="flex w-[8.5rem] shrink-0 snap-start">
            <Card
              onPress={() => go.push('crop-edit')}
              aria-label={t('home.crops.addAria')}
              className="flex w-full flex-col items-center justify-center gap-2 border-dashed text-center"
            >
              <ToneIcon icon={Plus} tone="green" size="lg" />
              <span className="text-small font-semibold text-brand">{t('home.crops.add')}</span>
            </Card>
          </div>
        </div>
      )}
    </section>
  );
});
