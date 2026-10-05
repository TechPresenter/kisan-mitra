// Privacy-first product analytics. Events carry no personal data (no names, phone numbers,
// emails, photos, free text or precise coordinates) — only feature usage counters.
// The sink is pluggable so a backend can be attached later; by default events stay local.

export type AnalyticsEvent =
  | 'app_open'
  | 'screen_view'
  | 'tab_view'
  | 'onboarding_complete'
  | 'ai_question'
  | 'ai_voice_question'
  | 'ai_photo_question'
  | 'crop_diagnosis'
  | 'crop_added'
  | 'mandi_view'
  | 'weather_view'
  | 'scheme_view'
  | 'search'
  | 'saved'
  | 'task_added'
  | 'task_completed'
  | 'reminder_set'
  | 'soil_report'
  | 'expense_added'
  | 'calculator_used'
  | 'share'
  | 'error';

export type AnalyticsProps = Record<string, string | number | boolean | undefined>;

type Sink = (event: AnalyticsEvent, props: AnalyticsProps, at: number) => void;

let sink: Sink | null = null;
const counters = new Map<string, number>();

export function setAnalyticsSink(s: Sink | null) {
  sink = s;
}

/** Record a usage event. Only pass enums/ids/counts — never user content. */
export function track(event: AnalyticsEvent, props: AnalyticsProps = {}) {
  counters.set(event, (counters.get(event) || 0) + 1);
  try {
    sink?.(event, props, Date.now());
  } catch {
    /* analytics must never break the app */
  }
}

export function analyticsSnapshot(): Record<string, number> {
  return Object.fromEntries(counters);
}
