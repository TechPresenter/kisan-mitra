// Icon, tone and label key for every farming task type. Other modules (Home, crop details)
// may import this to show the same icon for a task as the calendar does.
import { Bean, Bug, ClipboardList, Droplets, FlaskConical, ShieldCheck, Shovel, Sprout, Wheat, type LucideIcon } from 'lucide-react';
import type { Tone } from '../../components/ui';
import { findTemplate } from '../../data/task-templates';
import type { FarmingTask, TaskType } from '../../types/models';
import './strings';

export interface TaskTypeMeta {
  icon: LucideIcon;
  tone: Tone;
  /** i18n key, e.g. t(TASK_TYPE_META.irrigation.labelKey) → "सिंचाई". */
  labelKey: string;
}

export const TASK_TYPE_META: Record<TaskType, TaskTypeMeta> = {
  'seed-treatment': { icon: Bean, tone: 'teal', labelKey: 'calendar.type.seed-treatment' },
  sowing: { icon: Sprout, tone: 'green', labelKey: 'calendar.type.sowing' },
  irrigation: { icon: Droplets, tone: 'sky', labelKey: 'calendar.type.irrigation' },
  fertilizer: { icon: FlaskConical, tone: 'indigo', labelKey: 'calendar.type.fertilizer' },
  'pest-scouting': { icon: Bug, tone: 'orange', labelKey: 'calendar.type.pest-scouting' },
  'crop-protection': { icon: ShieldCheck, tone: 'red', labelKey: 'calendar.type.crop-protection' },
  weeding: { icon: Shovel, tone: 'amber', labelKey: 'calendar.type.weeding' },
  harvest: { icon: Wheat, tone: 'amber', labelKey: 'calendar.type.harvest' },
  other: { icon: ClipboardList, tone: 'gray', labelKey: 'calendar.type.other' },
};

/** Order of the type chips in the add-task form (field work sequence, "अन्य" last). */
export const TASK_TYPE_ORDER: TaskType[] = [
  'seed-treatment',
  'sowing',
  'irrigation',
  'fertilizer',
  'pest-scouting',
  'crop-protection',
  'weeding',
  'harvest',
  'other',
];

/** Meta for a stored type; unknown or legacy values fall back to "अन्य". */
export const taskTypeMeta = (type: TaskType | string | undefined): TaskTypeMeta =>
  typeof type === 'string' && Object.prototype.hasOwnProperty.call(TASK_TYPE_META, type)
    ? TASK_TYPE_META[type as TaskType]
    : TASK_TYPE_META.other;

export interface TaskGuidance {
  /** Fertilizer doses (top dressing, basal NPK at sowing): show common.disclaimer.fertilizer. */
  fertilizer: boolean;
  /** Seed-treatment chemicals, herbicides or sprays: show the "ask your KVK, wear gloves" warning. */
  chemical: boolean;
}

// Auto tasks whose catalog text tells the farmer to use a chemical (spray, herbicide, fungicide…).
const CHEMICAL_TEXT = /दवा|नाशी|नाशक|कार्बेन्डाजिम|थायरम|कैप्टान|कार्बोक्सिन/;
const chemicalByTemplate = new Map<string, boolean>();

function templateMentionsChemical(templateId: string): boolean {
  let hit = chemicalByTemplate.get(templateId);
  if (hit === undefined) {
    const tpl = findTemplate(templateId);
    hit = !!tpl && CHEMICAL_TEXT.test(`${tpl.titleHi} ${tpl.descHi}`);
    chemicalByTemplate.set(templateId, hit);
  }
  return hit;
}

/**
 * Which safety note a task needs. Auto tasks carry the catalog's dose guidance (basal fertilizer
 * at sowing, seed-treatment chemicals, herbicides, "spray if needed"); the farmer's own tasks only
 * carry their own words, so for them just the fertilizer and crop-protection types count.
 */
export function taskGuidance(task: Pick<FarmingTask, 'type' | 'source' | 'templateId'>): TaskGuidance {
  const auto = task.source === 'auto';
  const fertilizer = task.type === 'fertilizer' || (auto && task.type === 'sowing');
  const chemical =
    task.type === 'crop-protection' ||
    (auto && (task.type === 'seed-treatment' || (!!task.templateId && templateMentionsChemical(task.templateId))));
  return { fertilizer, chemical };
}
