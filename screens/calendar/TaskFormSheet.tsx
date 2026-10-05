// "+ काम जोड़ें" / "काम बदलें" sheet for the farmer's own tasks: name (with voice), type chips,
// date, crop and an optional note.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { Button, ChipGroup, DateField, MicButton, Sheet, TextArea, TextField, toast, type ChipOption } from '../../components/ui';
import { CropArt } from '../../components/illustrations';
import { daysBetween } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { KEYS, collection } from '../../lib/store';
import { addUserTask, clearTaskReminder, rescheduleTaskReminder } from '../../services/tasks';
import type { Crop, FarmingTask, ISODate, TaskType } from '../../types/models';
import { cropLabel } from './helpers';
import { TASK_TYPE_META, TASK_TYPE_ORDER } from './task-types';
import './strings';

const NO_CROP = 'none';
const TITLE_MAX = 80;
const NOTE_MAX = 300;

export interface TaskFormSheetProps {
  open: boolean;
  onClose: () => void;
  /** A user task to edit; absent = add a new task. */
  editing?: FarmingTask | null;
  crops: Crop[];
  lang: string;
  /** Prefill for a new task (the crop filter and the tab being viewed). */
  defaultCropId?: string;
  defaultDate: ISODate;
  /** Called after a new task is stored (e.g. to offer a reminder). */
  onAdded?: (task: FarmingTask) => void;
}

const isISODate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const appendSpoken = (prev: string, text: string) => (prev.trim() ? `${prev.trim()} ${text}` : text);

export function TaskFormSheet({ open, onClose, editing, crops, lang, defaultCropId, defaultDate, onAdded }: TaskFormSheetProps) {
  const t = useT();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<TaskType>('other');
  const [date, setDate] = useState<string>(defaultDate);
  const [cropId, setCropId] = useState<string>(NO_CROP);
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  // Keep the edit-mode title while the sheet slides closed.
  const wasEditing = useRef(!!editing);
  if (open) wasEditing.current = !!editing;
  // The task being edited, fixed when the sheet opens: once it closes the screen passes
  // editing=null, and a late second tap must never turn an edit into a new task.
  const editRef = useRef<FarmingTask | null>(null);
  // One save per opening: blocks double taps and taps while the sheet slides closed.
  const savingRef = useRef(false);

  // Reset the form every time it opens.
  useEffect(() => {
    if (!open) return;
    editRef.current = editing ?? null;
    savingRef.current = false;
    setSubmitted(false);
    setBusy(false);
    if (editing) {
      setTitle(editing.title);
      setType(editing.type);
      setDate(editing.dueDate);
      setCropId(editing.cropId && crops.some(c => c.id === editing.cropId) ? editing.cropId : NO_CROP);
      setNote(editing.note ?? '');
    } else {
      setTitle('');
      setType('other');
      setDate(defaultDate);
      setCropId(defaultCropId && crops.some(c => c.id === defaultCropId) ? defaultCropId : NO_CROP);
      setNote('');
    }
    // Only on open / switching task: live store updates must not wipe what the farmer typed.
  }, [open, editing?.id]);

  const typeOptions = useMemo<ChipOption<TaskType>[]>(
    () => TASK_TYPE_ORDER.map(k => ({ value: k, label: t(TASK_TYPE_META[k].labelKey), icon: TASK_TYPE_META[k].icon })),
    [t],
  );

  const cropOptions = useMemo<ChipOption[]>(
    () => [
      { value: NO_CROP, label: t('calendar.form.noCrop') },
      ...crops.map(c => ({ value: c.id, label: cropLabel(c, lang), icon: <CropArt crop={c.cropKey} size={24} background={false} /> })),
    ],
    [crops, lang, t],
  );

  const titleError = submitted && !title.trim() ? t('calendar.form.nameError') : undefined;
  const dateError = submitted && !isISODate(date) ? t('calendar.form.dateError') : undefined;

  const save = async () => {
    if (!open || savingRef.current) return;
    setSubmitted(true);
    const name = title.trim().slice(0, TITLE_MAX);
    if (!name || !isISODate(date)) return;
    const fields = {
      title: name,
      type,
      dueDate: date,
      cropId: cropId === NO_CROP ? undefined : cropId,
      note: note.trim() ? note.trim().slice(0, NOTE_MAX) : undefined,
    };

    savingRef.current = true;
    // Stays on until the sheet opens again, so the closing sheet shows no second live button.
    setBusy(true);
    try {
      const target = editRef.current;
      if (!target) {
        const task = addUserTask(fields);
        onClose();
        onAdded?.(task);
        return;
      }

      const col = collection<FarmingTask>(KEYS.tasks);
      const before = col.get(target.id) ?? target;
      col.update(before.id, fields);
      await moveReminder(before, { ...before, ...fields });
      toast.success(t('calendar.toast.updated'));
      onClose();
    } catch {
      savingRef.current = false;
      setBusy(false);
      toast.error(t('common.error.generic'));
    }
  };

  /**
   * A reminder follows its task: same offset from the new date, re-sent when what the
   * notification shows (name, note, crop, date) changed. Not counted as a new 'reminder_set'.
   */
  const moveReminder = async (before: FarmingTask, after: FarmingTask) => {
    if (!before.reminderAt || before.done) return;
    const old = new Date(before.reminderAt);
    if (!(old.getTime() > Date.now())) return;
    const dateChanged = before.dueDate !== after.dueDate;
    const shownChanged = dateChanged || before.title !== after.title || before.note !== after.note || before.cropId !== after.cropId;
    if (!shownChanged) return;
    const moved = new Date(old);
    moved.setDate(moved.getDate() + daysBetween(before.dueDate, after.dueDate));
    const ok = moved.getTime() > Date.now() && (await rescheduleTaskReminder(after, moved).catch(() => false));
    if (ok) return;
    await clearTaskReminder(after).catch(() => undefined);
    toast.info(dateChanged ? t('calendar.reminder.lostOnEdit') : t('calendar.reminder.lostOnUpdate'));
  };

  const editingMode = open ? !!editing : wasEditing.current;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="tall"
      title={editingMode ? t('calendar.edit.title') : t('calendar.add.title')}
      footer={
        <Button fullWidth size="lg" icon={editingMode ? Check : Plus} loading={busy} onClick={save}>
          {editingMode ? t('calendar.form.update') : t('calendar.form.save')}
        </Button>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        <TextField
          label={t('calendar.form.name')}
          value={title}
          onValueChange={setTitle}
          placeholder={t('calendar.form.namePlaceholder')}
          maxLength={TITLE_MAX}
          enterKeyHint="done"
          error={titleError}
          trailing={<MicButton variant="ghost" onResult={text => setTitle(prev => appendSpoken(prev, text).slice(0, TITLE_MAX))} />}
        />

        <div className="flex flex-col gap-2">
          <p className="text-small font-semibold text-ink">{t('calendar.form.type')}</p>
          <ChipGroup ariaLabel={t('calendar.form.type')} wrap value={type} onChange={setType} options={typeOptions} />
        </div>

        <DateField label={t('calendar.form.date')} value={date} onChange={setDate} error={dateError} />

        {crops.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-small font-semibold text-ink">{t('calendar.form.crop')}</p>
            <ChipGroup ariaLabel={t('calendar.form.crop')} value={cropId} onChange={setCropId} options={cropOptions} bleed={false} className="-mx-5 scroll-px-5 px-5" />
          </div>
        )}

        <TextArea
          label={t('calendar.form.note')}
          optional
          value={note}
          onChange={setNote}
          placeholder={t('calendar.form.notePlaceholder')}
          maxLength={NOTE_MAX}
          rows={2}
          trailing={<MicButton variant="ghost" onResult={text => setNote(prev => appendSpoken(prev, text).slice(0, NOTE_MAX))} />}
        />
      </div>
    </Sheet>
  );
}
