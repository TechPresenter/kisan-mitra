// Lightweight checks run when the main app opens: today's/overdue tasks become in-app
// notifications (deduplicated per task per day). Weather and mandi alerts are raised by
// their services whenever fresh data arrives.
import { todayISO } from '../lib/format';
import { tNow } from '../lib/i18n';
import { KEYS, collection } from '../lib/store';
import type { Crop, FarmingTask } from '../types/models';
import { pushNotification } from './notifications';
import { reconcileAutoTasks, taskText, tasksInRange } from './tasks';
import './startup-strings';

let ran = false;

export function runStartupChecks() {
  if (ran) return;
  ran = true;
  try {
    const today = todayISO();
    // Fix missing/orphaned auto tasks before Home reads them (the calendar may never have been opened).
    reconcileAutoTasks(collection<Crop>(KEYS.crops).all());
    const all = collection<FarmingTask>(KEYS.tasks).all();
    const due = [...tasksInRange(all, 'today', today), ...tasksInRange(all, 'overdue', today).slice(0, 3)];
    for (const task of due.slice(0, 5)) {
      const { title, desc } = taskText(task);
      const overdue = task.dueDate < today;
      pushNotification({
        category: 'reminder',
        priority: overdue ? 'important' : 'normal',
        title: overdue ? tNow('startup.taskOverdue', { title }) : tNow('startup.taskToday', { title }),
        body: desc || title,
        dedupeKey: `task:${task.id}:${today}`,
        target: { screen: 'calendar', params: task.cropId ? { cropId: task.cropId } : {} },
      });
    }
  } catch (e) {
    console.warn('[startup] checks failed', e);
  }
}
