// Task details: the full description (rows clamp it), when, crop, reminder, read-aloud, and
// the actions — done / undo, reminder, ask AI, and edit / delete for the farmer's own tasks.
import { useRef, type ReactNode } from 'react';
import { BellRing, CalendarDays, Check, ChevronRight, Pencil, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import { Button, Disclaimer, IconButton, ListenButton, Sheet, ToneIcon } from '../../components/ui';
import { CropArt } from '../../components/illustrations';
import { daysBetween, formatDate } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { taskText } from '../../services/tasks';
import type { Crop, FarmingTask, ISODate } from '../../types/models';
import { cropLabel, hasActiveReminder, whenLabel } from './helpers';
import { taskGuidance, taskTypeMeta } from './task-types';
import './strings';

export interface TaskDetailSheetProps {
  /** null closes the sheet. */
  task: FarmingTask | null;
  crop?: Crop;
  /**
   * Days late as the list shows it (0 for history tasks that were due before the crop was
   * added), so the sheet and the row never disagree.
   */
  lateDays: number;
  lang: string;
  today: ISODate;
  onClose: () => void;
  onToggle: (id: string, done: boolean) => void;
  onReminder: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (task: FarmingTask) => void;
  onAskAi: (task: FarmingTask) => void;
  onViewCrop: (cropId: string) => void;
}

function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center gap-3 py-2">
      {icon}
      <div className="min-w-0 flex-1">
        <p className="text-caption text-ink-2">{label}</p>
        <div className="text-body font-semibold text-ink">{children}</div>
      </div>
    </div>
  );
}

interface Shown {
  task: FarmingTask;
  crop?: Crop;
  lateDays: number;
}

export function TaskDetailSheet({
  task: taskProp,
  crop: cropProp,
  lateDays: lateProp,
  lang,
  today,
  onClose,
  onToggle,
  onReminder,
  onEdit,
  onDelete,
  onAskAi,
  onViewCrop,
}: TaskDetailSheetProps) {
  const t = useT();
  // Keep showing the last task (and its crop row) while the sheet slides closed, so the layout
  // does not jump mid-animation.
  const last = useRef<Shown | null>(null);
  if (taskProp) last.current = { task: taskProp, crop: cropProp, lateDays: lateProp };
  const shown = last.current;
  if (!shown) return <Sheet open={false} onClose={onClose} />;
  const { task, crop, lateDays } = shown;
  const open = taskProp != null;

  // While closing, the stale sheet is still on screen for a moment: ignore taps on it.
  const act = (fn: () => void) => () => {
    if (open) fn();
  };

  const { title, desc } = taskText(task, lang);
  const meta = taskTypeMeta(task.type);
  const guidance = taskGuidance(task);
  const diff = daysBetween(today, task.dueDate);
  const late = !task.done && lateDays > 0;
  const relative =
    diff === 0
      ? t('common.today')
      : diff === 1
        ? t('common.tomorrow')
        : diff > 1
          ? t('calendar.inDays', { n: diff })
          : late
            ? lateDays === 1
              ? t('calendar.overdue.late1')
              : t('calendar.overdue.late', { n: lateDays })
            : '';
  const reminderOn = hasActiveReminder(task);
  const isUser = task.source === 'user';
  const listenText = [title, desc].filter(Boolean).join(lang === 'en' ? '. ' : '। ');

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex items-center gap-2">
          {isUser && (
            <>
              <IconButton icon={Pencil} variant="outline" label={t('calendar.detail.editTask')} onClick={act(() => onEdit(task.id))} />
              <IconButton icon={Trash2} variant="outline" label={t('calendar.detail.deleteTask')} onClick={act(() => onDelete(task))} />
            </>
          )}
          <Button
            className="flex-1"
            size="lg"
            variant={task.done ? 'secondary' : 'primary'}
            icon={task.done ? RotateCcw : Check}
            onClick={act(() => {
              onToggle(task.id, !task.done);
              onClose();
            })}
          >
            {task.done ? t('calendar.detail.reopen') : t('calendar.detail.markDone')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <div className="flex items-start gap-3">
          {desc ? <p className="min-w-0 flex-1 text-body leading-relaxed text-ink">{desc}</p> : <div className="flex-1" />}
          <ListenButton id={`task-${task.id}`} text={listenText} />
        </div>

        <div className="divide-y divide-line rounded-list border border-line px-4">
          <Fact icon={<ToneIcon icon={CalendarDays} tone={late ? 'amber' : 'orange'} size="sm" />} label={t('calendar.detail.when')}>
            <span>{formatDate(task.dueDate, { weekday: true })}</span>
            {relative && <span className={late ? 'font-semibold text-tone-amber' : 'font-normal text-ink-2'}> · {relative}</span>}
          </Fact>
          <Fact icon={<ToneIcon icon={meta.icon} tone={meta.tone} size="sm" />} label={t('calendar.detail.type')}>
            {t(meta.labelKey)}
          </Fact>
          {crop && (
            <div className="flex min-h-12 items-center gap-3 py-2">
              <CropArt crop={crop.cropKey} size={36} />
              <div className="min-w-0 flex-1">
                <p className="text-caption text-ink-2">{t('calendar.detail.crop')}</p>
                <p className="text-body font-semibold text-ink">{cropLabel(crop, lang)}</p>
              </div>
              <Button variant="ghost" iconRight={ChevronRight} onClick={act(() => onViewCrop(crop.id))}>
                {t('calendar.detail.viewCrop')}
              </Button>
            </div>
          )}
          {!task.done && (
            <div className="flex min-h-12 items-center gap-3 py-2">
              <ToneIcon icon={BellRing} tone={reminderOn ? 'green' : 'gray'} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-caption text-ink-2">{t('calendar.detail.reminder')}</p>
                <p className={reminderOn ? 'text-body font-semibold text-brand' : 'text-body text-ink-2'}>
                  {reminderOn ? whenLabel(new Date(task.reminderAt as string)) : t('calendar.detail.noReminder')}
                </p>
              </div>
              <Button variant={reminderOn ? 'ghost' : 'soft'} onClick={act(() => onReminder(task.id))}>
                {reminderOn ? t('calendar.detail.changeReminder') : t('calendar.detail.setReminder')}
              </Button>
            </div>
          )}
        </div>

        {guidance.fertilizer && <Disclaimer kind="fertilizer" />}
        {guidance.chemical && <Disclaimer variant="warning">{t('calendar.detail.protection')}</Disclaimer>}
        {task.source === 'auto' && <p className="text-caption text-ink-2">{t('calendar.detail.auto')}</p>}

        <Button variant="secondary" icon={Sparkles} fullWidth onClick={act(() => onAskAi(task))}>
          {t('calendar.detail.askAi')}
        </Button>
      </div>
    </Sheet>
  );
}
