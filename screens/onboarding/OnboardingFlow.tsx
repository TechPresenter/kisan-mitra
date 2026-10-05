// First-run questionnaire (spec §20): eight one-question screens with a progress bar
// ("चरण 3 / 8"), back and skip on each, then the "आपका किसान मित्र तैयार है ✓" summary.
// Answers persist in usePersisted('onboarding.draft') so leaving the app keeps progress.
// Finishing writes the profile, a default farm ("मेरा खेत") and planned crop records.
import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleAlert, Rocket } from 'lucide-react';
import { Button, Screen, toast } from '../../components/ui';
import { usePlace, useProfile, useSettings } from '../../lib/app-state';
import { track } from '../../lib/analytics';
import { useBackHandler } from '../../lib/back';
import { useLanguage, useT } from '../../lib/i18n';
import { store, usePersisted } from '../../lib/store';
import { isNative, syncSystemBars } from '../../services/native';
import { ensureNotificationPermission } from '../../services/reminders';
import type { GeoPlace, UserProfile } from '../../types/models';
import { placeMatchesDistrict } from '../auth/place-match';
import {
  DONE_STEP,
  DRAFT_KEY,
  EMPTY_DRAFT,
  QUESTION_COUNT,
  STEPS,
  clampStep,
  cleanCropKeys,
  completeOnboarding,
  validLand,
  type OnboardingDraft,
  type StepKey,
} from './draft';
import { CropsStep, DoneStep, IrrigationStep, LandStep, LanguageStep, NameStep, NotifyStep, PlaceStep, SoilStep, type TypedPlace } from './steps';
import './strings';

/** The signup place (or a GPS pick) counts as chosen when it is the profile's district. */
function prefilledPlace(profile: UserProfile | null, place: GeoPlace): GeoPlace | null {
  return placeMatchesDistrict(place, profile?.district, profile?.state) ? place : null;
}

/** District/state typed at signup that is not (yet) a real place for weather and mandi. */
function typedPlaceOf(profile: UserProfile | null): TypedPlace | null {
  const district = profile?.district?.trim();
  return district ? { district, ...(profile?.state ? { state: profile.state } : {}) } : null;
}

/** Error key when a step's answer is missing, else null. */
function missingAnswer(key: StepKey, draft: OnboardingDraft, name: string, place: GeoPlace | null): string | null {
  switch (key) {
    case 'name':
      return name.replace(/[^\p{L}\p{M}]/gu, '').length >= 2 ? null : 'onboarding.name.error';
    case 'place':
      return place ? null : 'onboarding.place.error';
    case 'land':
      return validLand(draft.landArea) ? null : 'onboarding.land.error';
    case 'crops':
      return cleanCropKeys(draft.cropKeys).length ? null : 'onboarding.crops.error';
    case 'irrigation':
      return draft.irrigation ? null : 'onboarding.irrigation.error';
    case 'soil':
      return draft.soilType ? null : 'onboarding.soil.error';
    default:
      return null;
  }
}

/** White segments in the green header: one per question. */
function StepProgress({ step, label }: { step: number; label: string }) {
  const done = Math.min(step + 1, QUESTION_COUNT);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={QUESTION_COUNT}
      aria-valuenow={done}
      aria-valuetext={label}
      className="flex gap-1.5"
    >
      {STEPS.map((k, i) => (
        <span key={k} aria-hidden className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${i < done ? 'bg-white' : 'bg-white/30'}`} />
      ))}
    </div>
  );
}

export default function OnboardingFlow({ onDone }: { onDone: () => void }) {
  const t = useT();
  const { language } = useLanguage();
  const [profile, updateProfile] = useProfile();
  const [settings, updateSettings] = useSettings();
  const [appPlace] = usePlace();
  const [draft, setDraft] = usePersisted<OnboardingDraft>(DRAFT_KEY, EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const finished = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const step = clampStep(draft.step);
  const stepRef = useRef(step);
  stepRef.current = step;
  const editing = !!draft.editing;
  const key: StepKey | 'done' = step < QUESTION_COUNT ? STEPS[step] : 'done';
  const name = draft.name ?? profile?.name ?? '';
  const place = useMemo(
    () => (draft.place !== undefined ? draft.place : prefilledPlace(profile, appPlace)),
    [draft.place, profile, appPlace],
  );
  // Typed at signup but not matched to a real place: shown so the farmer can confirm it.
  const typedPlace = place ? null : typedPlaceOf(profile);

  // The green app bar needs light status-bar icons (the app shell only does this in the main app).
  useEffect(() => {
    syncSystemBars(settings.theme === 'light');
  }, [settings.theme]);

  const patch = (p: Partial<OnboardingDraft>) => {
    setError(null);
    setDraft(d => ({ ...(d || {}), ...p }));
  };

  /** Next question, or back to the summary when one answer was being changed from there. */
  const advance = () => {
    setError(null);
    setDraft(d => {
      const cur = d || {};
      return cur.editing ? { ...cur, editing: undefined, step: DONE_STEP } : { ...cur, step: clampStep(clampStep(cur.step) + 1) };
    });
  };

  const back = () => {
    // A permission prompt is open: going back now would leave it answering a step we left.
    if (asking) return;
    setError(null);
    setDraft(d => {
      const cur = d || {};
      if (cur.editing) return { ...cur, editing: undefined, step: DONE_STEP };
      const s = clampStep(cur.step);
      return s > 0 ? { ...cur, step: s - 1 } : cur;
    });
  };

  const canGoBack = step > 0 || editing;
  // Kept on while asking so Android back does not fall through to "exit app" mid-prompt.
  useBackHandler(back, canGoBack || asking);

  // New step: back to the top, and screen-reader focus on its question (not on first render).
  const firstRender = useRef(true);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const next = () => {
    if (key === 'done') return;
    const missing = missingAnswer(key, draft, name, place);
    if (missing) {
      setError(missing);
      if (key === 'name' || key === 'land') inputRef.current?.focus();
      return;
    }
    advance();
  };

  const askNotifications = async () => {
    const from = stepRef.current;
    setAsking(true);
    let granted = false;
    try {
      granted = await ensureNotificationPermission();
    } catch {
      granted = false;
    }
    setAsking(false);
    patch({ notify: granted ? 'granted' : 'denied' });
    if (granted) {
      if (!settings.notifications.enabled) updateSettings({ notifications: { ...settings.notifications, enabled: true } });
      toast.success(t('onboarding.notify.granted'), { id: 'onboarding-notify' });
    } else {
      toast.warning(t('onboarding.notify.denied'), { id: 'onboarding-notify' });
    }
    // Only move on if the farmer is still on the question the prompt was for.
    if (stepRef.current === from) advance();
  };

  const later = () => {
    patch({ notify: draft.notify ?? 'later' });
    advance();
  };

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    try {
      const { profilePatch, cropsCreated } = completeOnboarding({
        draft,
        profile,
        place,
        lang: language.code,
        farmName: t('onboarding.farmName'),
      });
      // onboardedAt in this patch moves the shell to the main app, so the profile goes last.
      store.remove(DRAFT_KEY);
      updateProfile(profilePatch);
      track('onboarding_complete', {
        crops: cropsCreated,
        land: validLand(draft.landArea),
        place: !!place,
        irrigation: draft.irrigation ?? 'none',
        soil: draft.soilType ?? 'none',
        notify: draft.notify ?? 'none',
        lang: language.code,
      });
      onDone();
    } catch {
      finished.current = false;
      toast.error(t('common.error.generic'));
    }
  };

  const skip = () => {
    if (asking) return;
    if (key === 'notify') {
      later();
      return;
    }
    // A cleared or half-typed name falls back to the name given at login.
    if (key === 'name' && missingAnswer('name', draft, name, place)) patch({ name: undefined });
    advance();
  };

  // On the web there is no system prompt to show (reminders appear while the app is open),
  // so the notification step only explains and moves on.
  const notifyButtons = isNative ? (
    <>
      <Button fullWidth size="lg" loading={asking} onClick={askNotifications}>
        {t('onboarding.notify.allow')}
      </Button>
      <Button fullWidth variant="ghost" disabled={asking} onClick={later}>
        {t('onboarding.notify.later')}
      </Button>
    </>
  ) : (
    <Button fullWidth size="lg" onClick={later}>
      {t('common.next')}
    </Button>
  );

  const footer =
    key === 'done' ? (
      <Button fullWidth size="lg" icon={Rocket} onClick={finish}>
        {t('onboarding.done.start')}
      </Button>
    ) : (
      <div className="flex flex-col gap-2">
        {error && (
          <p role="alert" className="flex items-start gap-1.5 text-small font-medium text-tone-red">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>{t(error)}</span>
          </p>
        )}
        {key === 'notify' ? (
          notifyButtons
        ) : (
          <Button fullWidth size="lg" onClick={next}>
            {t('common.next')}
          </Button>
        )}
      </div>
    );

  const progressLabel = t('onboarding.stepOf', { n: Math.min(step + 1, QUESTION_COUNT), total: QUESTION_COUNT });

  return (
    <Screen
      title={key === 'done' ? t('onboarding.readyTitle') : progressLabel}
      back={canGoBack && !asking ? back : false}
      bottomNav={false}
      scrollRef={scrollRef}
      actions={
        key === 'done' ? undefined : (
          <button
            type="button"
            onClick={skip}
            disabled={asking}
            className="press inline-flex min-h-12 items-center rounded-full px-4 text-body font-semibold text-white hover:bg-white/10 disabled:opacity-50"
          >
            {t('common.skip')}
          </button>
        )
      }
      headerContent={<StepProgress step={step} label={progressLabel} />}
      footer={footer}
    >
      <div key={step} className="flex animate-fade-in flex-col gap-5">
        {key === 'name' && <NameStep name={name} patch={patch} headingRef={headingRef} inputRef={inputRef} />}
        {key === 'place' && <PlaceStep place={place} typed={typedPlace} patch={patch} headingRef={headingRef} />}
        {key === 'land' && <LandStep draft={draft} patch={patch} headingRef={headingRef} inputRef={inputRef} />}
        {key === 'crops' && <CropsStep draft={draft} patch={patch} headingRef={headingRef} />}
        {key === 'irrigation' && <IrrigationStep draft={draft} patch={patch} headingRef={headingRef} />}
        {key === 'soil' && <SoilStep draft={draft} patch={patch} headingRef={headingRef} />}
        {key === 'language' && <LanguageStep headingRef={headingRef} />}
        {key === 'notify' && <NotifyStep headingRef={headingRef} native={isNative} />}
        {key === 'done' && (
          <DoneStep
            name={name}
            place={place}
            typedPlace={typedPlace}
            draft={draft}
            headingRef={headingRef}
            onEdit={n => {
              setError(null);
              setDraft(d => ({ ...(d || {}), editing: true, step: clampStep(n) }));
            }}
          />
        )}
      </div>
    </Screen>
  );
}
