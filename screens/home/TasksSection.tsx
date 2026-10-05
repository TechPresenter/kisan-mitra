// Home: "आने वाले काम" — the next 3 open tasks of the coming week, each ticked off in place.
import './strings';
import { memo, useMemo } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import { Card, Checkbox, DateTile, EmptyState, ListRow, SectionHeader, toast } from '../../components/ui';
import { EmptyArt } from '../../components/illustrations';
import { relativeDay } from '../../lib/format';
import { useLanguage, useT } from '../../lib/i18n';
import { taskText } from '../../services/tasks';
import type { Crop, FarmingTask } from '../../types/models';
import { displayCropName, type HomeNav } from './util';

export interface TasksSectionProps {
  /**
   * The open tasks to list (Home computes them once with tasksInRange(…, 'week', today), so after
   * midnight yesterday's undone task drops off, and "आज किसान के लिए" can skip the same tasks).
   */
  upcoming: FarmingTask[];
  crops: Crop[];
  setDone: (id: string, done: boolean) => void;
  go: HomeNav;
}

export const TasksSection = memo(function TasksSection({ upcoming, crops, setDone, go }: TasksSectionProps) {
  const t = useT();
  const { language } = useLanguage();
  const lang = language.code;

  const cropById = useMemo(() => new Map(crops.map(c => [c.id, c])), [crops]);
  const openCalendar = () => go.push('calendar');

  const complete = (task: FarmingTask, done: boolean) => {
    setDone(task.id, done);
    if (done) {
      toast.success(t('home.tasks.doneToast'), {
        id: `task-${task.id}`,
        action: { label: t('home.tasks.undo'), onPress: () => setDone(task.id, false) },
      });
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader title={t('home.tasks.title')} action={{ onPress: openCalendar }} />
      {upcoming.length === 0 ? (
        <Card padding="sm">
          {crops.length ? (
            <EmptyState
              compact
              art={<EmptyArt kind="calendar" size={120} />}
              title={t('home.tasks.emptyTitle')}
              body={t('home.tasks.emptyBody')}
              action={{ label: t('home.tasks.open'), icon: CalendarDays, onPress: openCalendar }}
            />
          ) : (
            // Without a crop there is nothing to plan yet: the useful step is adding one.
            <EmptyState
              compact
              art={<EmptyArt kind="calendar" size={120} />}
              title={t('home.tasks.emptyTitle')}
              body={t('home.tasks.emptyNoCrops')}
              action={{ label: t('home.crops.emptyAction'), icon: Plus, onPress: () => go.push('crop-edit') }}
              secondaryAction={{ label: t('home.tasks.open'), icon: CalendarDays, onPress: openCalendar }}
            />
          )}
        </Card>
      ) : (
        <div role="list" aria-label={t('home.tasks.title')} className="flex flex-col gap-3">
          {upcoming.map(task => {
            const { title } = taskText(task, lang);
            const crop = task.cropId ? cropById.get(task.cropId) : undefined;
            const cropLabel = crop ? displayCropName(crop, lang) : t('home.tasks.general');
            return (
              <div role="listitem" key={task.id}>
                <ListRow
                  leading={<DateTile date={task.dueDate} />}
                  title={title}
                  subtitle={`${cropLabel} • ${relativeDay(task.dueDate)}`}
                  subtitleLines={1}
                  trailing={
                    <Checkbox
                      checked={task.done}
                      onChange={done => complete(task, done)}
                      aria-label={t('home.tasks.markDone', { task: title })}
                    />
                  }
                  onPress={openCalendar}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
});
