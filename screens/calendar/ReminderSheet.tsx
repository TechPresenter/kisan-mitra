// "याद कब दिलाएं?" sheet: same day 7 AM, day before 6 PM, or a custom date + time.
import { useEffect, useMemo, useRef, useState } from 'react';
import { BellOff, CalendarClock, Clock, Settings, Sunrise, Sunset } from 'lucide-react';
import { Button, Callout, DateField, RadioCards, Sheet, TextField, toast, type RadioCardOption } from '../../components/ui';
import { useSettings } from '../../lib/app-state';
import { addDays, formatDate, toISODate, todayISO } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { useNav } from '../../lib/nav';
import { isNative } from '../../services/native';
import { clearTaskReminder, setTaskReminder, taskText } from '../../services/tasks';
import type { FarmingTask } from '../../types/models';
import { atLocal, hasActiveReminder, timeOf, whenLabel } from './helpers';
import './strings';

type Choice = 'sameDay' | 'dayBefore' | 'custom';

export interface ReminderSheetProps {
  /** The task to remind about; null closes the sheet. */
  task: FarmingTask | null;
  lang: string;
  onClose: () => void;
}

/** The next full hour from now (custom default when the presets have passed). */
function nextHour(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

export function ReminderSheet({ task: taskProp, lang, onClose }: ReminderSheetProps) {
  const t = useT();
  const nav = useNav();
  const [settings] = useSettings();
  const open = taskProp != null;
  // Keep showing the last task while the sheet slides closed.
  const lastTask = useRef<FarmingTask | null>(taskProp);
  if (taskProp) lastTask.current = taskProp;
  const task = taskProp ?? lastTask.current;

  const [choice, setChoice] = useState<Choice>('sameDay');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('07:00');
  const [busy, setBusy] = useState(false);
  // Blocks a second tap while saving and while the sheet slides closed (it stays tappable then).
  const busyRef = useRef(false);

  const presets = useMemo(() => {
    if (!task) return null;
    return {
      sameDay: atLocal(task.dueDate, '07:00'),
      dayBefore: atLocal(addDays(task.dueDate, -1), '18:00'),
    };
  }, [task?.dueDate]);

  // Fresh defaults each time the sheet opens for a task.
  useEffect(() => {
    if (!open || !task || !presets) return;
    const now = Date.now();
    const current = hasActiveReminder(task) ? new Date(task.reminderAt as string) : null;
    const isFuture = (d: Date | null) => !!d && d.getTime() > now;
    if (current && presets.sameDay && current.getTime() === presets.sameDay.getTime()) setChoice('sameDay');
    else if (current && presets.dayBefore && current.getTime() === presets.dayBefore.getTime()) setChoice('dayBefore');
    else if (current) setChoice('custom');
    else if (isFuture(presets.sameDay)) setChoice('sameDay');
    else if (isFuture(presets.dayBefore)) setChoice('dayBefore');
    else setChoice('custom');

    const today = todayISO();
    if (current) {
      setDate(toISODate(current));
      setTime(timeOf(current));
    } else if (task.dueDate > today) {
      setDate(task.dueDate);
      setTime('07:00');
    } else {
      const soon = nextHour();
      setDate(toISODate(soon));
      setTime(timeOf(soon));
    }
    busyRef.current = false;
    setBusy(false);
    // Only when the sheet opens or another task opens: store updates to the same task (e.g. the
    // reminder just saved) must not reset what the farmer picked.
  }, [open, task?.id]);

  if (!task) return <Sheet open={false} onClose={onClose} />;

  const { title } = taskText(task, lang);
  const now = Date.now();
  const passed = (d: Date | null) => !d || d.getTime() <= now;
  const active = hasActiveReminder(task);
  const remindersOff = !settings.notifications.enabled || !settings.notifications.reminders;

  const options: RadioCardOption<Choice>[] = [
    {
      value: 'sameDay',
      label: t('calendar.reminder.sameDay'),
      description: passed(presets?.sameDay ?? null) ? t('calendar.reminder.passed') : formatDate(task.dueDate, { weekday: true }),
      icon: Sunrise,
      tone: 'amber',
      disabled: passed(presets?.sameDay ?? null),
    },
    {
      value: 'dayBefore',
      label: t('calendar.reminder.dayBefore'),
      description: passed(presets?.dayBefore ?? null) ? t('calendar.reminder.passed') : formatDate(addDays(task.dueDate, -1), { weekday: true }),
      icon: Sunset,
      tone: 'orange',
      disabled: passed(presets?.dayBefore ?? null),
    },
    { value: 'custom', label: t('calendar.reminder.custom'), icon: CalendarClock, tone: 'sky' },
  ];

  const resolve = (): Date | null =>
    choice === 'sameDay' ? presets?.sameDay ?? null : choice === 'dayBefore' ? presets?.dayBefore ?? null : atLocal(date, time);

  /** Runs a footer action once; `busy` stays on after success until the sheet opens again. */
  const run = async (action: () => Promise<boolean>) => {
    if (!open || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    let done = false;
    try {
      done = await action();
    } finally {
      if (!done) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };

  const save = () =>
    run(async () => {
      const at = resolve();
      if (!at) {
        toast.error(t('calendar.reminder.invalid'));
        return false;
      }
      if (at.getTime() <= Date.now()) {
        toast.error(t('calendar.reminder.pastError'));
        return false;
      }
      try {
        if (await setTaskReminder(task, at)) {
          toast.success(t('calendar.reminder.setToast', { when: whenLabel(at) }));
          onClose();
          return true;
        }
        toast.error(t('calendar.reminder.denied'), { duration: 8000 });
      } catch {
        toast.error(t('calendar.reminder.failed'));
      }
      return false;
    });

  const remove = () =>
    run(async () => {
      try {
        await clearTaskReminder(task);
        toast(t('calendar.reminder.removedToast'));
        onClose();
        return true;
      } catch {
        toast.error(t('common.error.generic'));
        return false;
      }
    });

  const openSettings = () => {
    if (!open) return;
    onClose();
    nav.push('settings');
  };

  const customInvalid = choice === 'custom' && !atLocal(date, time);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('calendar.reminder.title')}
      description={title}
      footer={
        <div className="flex flex-col gap-2">
          {remindersOff ? (
            // Reminders are off in Settings: a reminder set now would never ring, so the main
            // action takes the farmer to the switch instead.
            <Button fullWidth size="lg" icon={Settings} onClick={openSettings}>
              {t('calendar.reminder.offAction')}
            </Button>
          ) : (
            <Button fullWidth size="lg" icon={Clock} loading={busy} disabled={customInvalid} onClick={save}>
              {t('calendar.reminder.save')}
            </Button>
          )}
          {active && (
            <Button fullWidth variant="ghost" icon={BellOff} disabled={busy} onClick={remove}>
              {t('calendar.reminder.remove')}
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {active && (
          <p className="text-small font-semibold text-brand">
            {t('calendar.reminder.current', { when: whenLabel(new Date(task.reminderAt as string)) })}
          </p>
        )}
        {remindersOff ? (
          <Callout tone="warning" title={t('calendar.reminder.offTitle')}>
            {t('calendar.reminder.offBody')}
          </Callout>
        ) : (
          <>
            <RadioCards label={t('calendar.reminder.choice')} value={choice} onChange={setChoice} options={options} />
            {choice === 'custom' && (
              <div className="flex flex-col gap-3">
                <DateField label={t('calendar.reminder.date')} value={date} onChange={setDate} min={todayISO()} />
                <TextField
                  label={t('calendar.reminder.time')}
                  type="time"
                  value={time}
                  onValueChange={setTime}
                  error={customInvalid && date ? t('calendar.reminder.invalid') : undefined}
                />
              </div>
            )}
          </>
        )}
        {!isNative && !remindersOff && <p className="text-caption text-ink-2">{t('calendar.reminder.webNote')}</p>}
      </div>
    </Sheet>
  );
}
