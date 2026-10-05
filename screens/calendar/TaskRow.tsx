// One calendar task (reference screen 12): orange date tile, title + description in the UI
// language, crop with its art, a reminder bell and a big round done checkbox.
import { memo } from 'react';
import { Bell, BellRing, UserRound } from 'lucide-react';
import { Checkbox, DateTile, IconButton, ListRow } from '../../components/ui';
import { CropArt } from '../../components/illustrations';
import { useT } from '../../lib/i18n';
import { taskText } from '../../services/tasks';
import type { Crop, FarmingTask } from '../../types/models';
import { cropLabel, hasActiveReminder, reminderLabel } from './helpers';
import './strings';

export interface TaskRowProps {
  task: FarmingTask;
  /** The task's crop, when it has one that still exists. */
  crop?: Crop;
  lang: string;
  /** Days late (> 0 shows the amber date tile and "3 दिन की देरी"). */
  lateDays?: number;
  /** History (due before the crop was added): gray date tile, not counted as late. */
  muted?: boolean;
  onToggle: (id: string, done: boolean) => void;
  /** Bell button; omitted → no bell (e.g. read-only lists). */
  onReminder?: (id: string) => void;
  /** Row tap → details. */
  onOpen?: (id: string) => void;
}

function TaskRowView({ task, crop, lang, lateDays = 0, muted = false, onToggle, onReminder, onOpen }: TaskRowProps) {
  const t = useT();
  const { title, desc } = taskText(task, lang);
  const reminderOn = hasActiveReminder(task);
  const reminderText = reminderOn ? reminderLabel(task.reminderAt as string, task.dueDate) : '';
  const tone = task.done || muted ? 'gray' : lateDays > 0 ? 'amber' : 'orange';

  const meta = (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-2">
      {crop && (
        <span className="inline-flex items-center gap-1.5">
          <CropArt crop={crop.cropKey} size={22} />
          <span className="pt-0.5">{cropLabel(crop, lang)}</span>
        </span>
      )}
      {task.source === 'user' && (
        <span className="inline-flex items-center gap-1">
          <UserRound aria-hidden className="size-3.5 shrink-0" />
          <span className="pt-0.5">{t('calendar.myTask')}</span>
        </span>
      )}
      {lateDays > 0 && (
        <span className="pt-0.5 font-semibold text-tone-amber">
          {lateDays === 1 ? t('calendar.overdue.late1') : t('calendar.overdue.late', { n: lateDays })}
        </span>
      )}
      {reminderOn && (
        <span className="inline-flex items-center gap-1 font-semibold text-brand">
          <BellRing aria-hidden className="size-3.5 shrink-0" />
          <span className="pt-0.5">{reminderText}</span>
        </span>
      )}
    </span>
  );

  return (
    <ListRow
      leading={<DateTile date={task.dueDate} tone={tone} />}
      title={task.done ? <span className="text-ink-2 line-through decoration-ink-3">{title}</span> : title}
      subtitle={desc || undefined}
      subtitleLines={task.done ? 1 : 2}
      meta={meta}
      onPress={onOpen ? () => onOpen(task.id) : undefined}
      chevron={false}
      trailing={
        // Stacked (done on top, bell below) so the title keeps its width on 320–360px phones.
        <div className="-my-1 flex flex-col items-center">
          <Checkbox checked={task.done} onChange={done => onToggle(task.id, done)} aria-label={t('calendar.doneLabel', { task: title })} />
          {onReminder && !task.done && (
            <IconButton
              icon={reminderOn ? BellRing : Bell}
              label={reminderOn ? t('calendar.reminder.change', { task: title, when: reminderText }) : t('calendar.reminder.set', { task: title })}
              iconClassName={reminderOn ? 'text-brand' : undefined}
              onClick={() => onReminder(task.id)}
            />
          )}
        </div>
      }
    />
  );
}

/** Memoised: long month lists only re-render the rows whose task changed. */
export const TaskRow = memo(TaskRowView);
