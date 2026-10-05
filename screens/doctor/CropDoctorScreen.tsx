// फसल डॉक्टर (reference screen 6): choose the crop, take or pick a photo, optionally say what
// you see, then "विश्लेषण करें" → preliminary AI diagnosis → Diagnosis Result.
// The check itself runs in ./session so that switching bottom tabs (which unmounts this screen)
// neither cancels it nor loses the photo and note.
import './strings';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, History, Images, ScanSearch, Sprout, WifiOff } from 'lucide-react';
import { CropArt } from '../../components/illustrations';
import { CropPicker } from '../../components/shared/CropPicker';
import {
  Badge,
  Button,
  Callout,
  ChipGroup,
  ErrorState,
  MicButton,
  Screen,
  SectionHeader,
  Sheet,
  TextArea,
  toast,
} from '../../components/ui';
import { stageForCrop } from '../../data/crops';
import { cropName, isCropKey } from '../../data/crop-keys';
import { useProfile } from '../../lib/app-state';
import { useOnline } from '../../lib/cache';
import { useLanguage, useT } from '../../lib/i18n';
import { useIsActiveScreen, useNav, useRoute } from '../../lib/nav';
import { KEYS, useCollection, usePersisted } from '../../lib/store';
import { ai } from '../../services/ai';
import { activeCropRecord, capturePhoto, getDiagnosis, preparePhoto, useDiagnoses } from '../../services/diagnosis';
import { isNative } from '../../services/native';
import type { Crop } from '../../types/models';
import { DiagnosisRow, ExampleGallery, PhotoTips, StepCard, Stepper, Viewfinder } from './parts';
import {
  LAST_CROP_KEY,
  PENDING_KEY,
  cancelAnalysis,
  clearFailure,
  errorKey,
  readDraft,
  registerHost,
  startAnalysis,
  takePendingResult,
  useDoctorFailure,
  useDoctorJob,
  writeDraft,
  type PendingResult,
} from './session';

/** When each progress line ("फोटो जांच रहे हैं…" → …) appears, in ms after the start. */
const PROGRESS_AT = [0, 4000, 10000, 22000];

const byUpdated = (a: Crop, b: Crop) => (b.updatedAt || '').localeCompare(a.updatedAt || '');

export default function CropDoctorScreen() {
  const t = useT();
  const nav = useNav();
  const { params, key: routeKey } = useRoute<{ cropKey?: string }>();
  const { language } = useLanguage();
  const lang = language.code;
  const online = useOnline();
  const aiReady = ai.available();
  const active = useIsActiveScreen();
  const history = useDiagnoses();

  // What this route instance had before a tab switch unmounted it (read once).
  const [saved] = useState(() => readDraft(routeKey));

  // ---- Crop ----
  const crops = useCollection<Crop>(KEYS.crops).items;
  const [profile] = useProfile();
  const [lastCrop] = usePersisted<string | null>(LAST_CROP_KEY, null);
  const myKeys = useMemo(() => {
    const out: string[] = [];
    for (const c of [...crops].sort(byUpdated)) if (isCropKey(c.cropKey) && !out.includes(c.cropKey)) out.push(c.cropKey);
    for (const k of profile?.cropKeys || []) if (isCropKey(k) && !out.includes(k)) out.push(k);
    return out;
  }, [crops, profile?.cropKeys]);

  const [cropKey, setCropKey] = useState<string | null>(() => {
    if (saved) return saved.cropKey;
    if (params.cropKey && isCropKey(params.cropKey)) return params.cropKey;
    if (lastCrop && myKeys.includes(lastCrop)) return lastCrop;
    if (myKeys.length) return myKeys[0];
    return lastCrop && isCropKey(lastCrop) ? lastCrop : null;
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  // The current (not yet harvested) field of this crop, as the diagnosis prompt uses it.
  const myCrop = useMemo(() => (cropKey ? activeCropRecord(crops, cropKey) : undefined), [crops, cropKey]);
  const stageLabel = useMemo(() => {
    if (!myCrop) return null;
    const st = stageForCrop(myCrop);
    return lang === 'en' ? st.labelEn : st.labelHi;
  }, [myCrop, lang]);
  const cropLabel = cropKey ? cropName(cropKey, lang) : '';

  const pickCrop = (key: string) => {
    setCropKey(key);
    setPickerOpen(false);
  };

  // ---- Photo and note (kept in the session draft across tab switches) ----
  const [photo, setPhoto] = useState<string | null>(() => saved?.photo ?? null);
  const [note, setNote] = useState(() => saved?.note ?? '');
  const [preparing, setPreparing] = useState(false);
  const cameraInput = useRef<HTMLInputElement | null>(null);
  const galleryInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    writeDraft(routeKey, { cropKey, photo, note });
  }, [routeKey, cropKey, photo, note]);

  const choosePhoto = (p: string) => {
    clearFailure();
    setPhoto(p);
  };

  const takePhoto = async (source: 'camera' | 'gallery') => {
    if (!isNative) {
      (source === 'camera' ? cameraInput : galleryInput).current?.click();
      return;
    }
    setPreparing(true);
    try {
      const p = await capturePhoto(source);
      if (p) choosePhoto(p);
    } catch (e) {
      toast.error(t(errorKey(e)), { id: 'doctor-photo' });
    } finally {
      setPreparing(false);
    }
  };

  const onFile = async (e: any) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // the same photo can be picked again
    if (!file) return;
    setPreparing(true);
    try {
      choosePhoto(await preparePhoto(file));
    } catch (err) {
      toast.error(t(errorKey(err)), { id: 'doctor-photo' });
    } finally {
      setPreparing(false);
    }
  };

  // ---- Analysis ----
  const job = useDoctorJob();
  const busy = job != null;
  const mine = job?.routeKey === routeKey;
  const error = useDoctorFailure(routeKey);
  const errorRef = useRef<HTMLDivElement | null>(null);

  const navRef = useRef(nav);
  navRef.current = nav;
  const activeRef = useRef(active);
  activeRef.current = active;

  // Lets ./session clear this screen and open the result while it is mounted (visible or not).
  useEffect(
    () =>
      registerHost({
        routeKey,
        isActive: () => activeRef.current,
        onResult: d => {
          setPhoto(null);
          if (!d.unusableReason) setNote('');
        },
        open: id => navRef.current.push('diagnosis', { id }),
      }),
    [routeKey],
  );

  // A check that finished while this screen was hidden or unmounted opens once it is visible.
  const [pending] = usePersisted<PendingResult | null>(PENDING_KEY, null);
  useEffect(() => {
    if (!active || !pending) return;
    const id = takePendingResult(); // reads the store, so a repeated effect run cannot push twice
    if (id && getDiagnosis(id)) nav.push('diagnosis', { id });
  }, [active, pending, nav]);

  // Friendly progress text while the AI works (plain text swaps, no animation). Counted from the
  // start of the check, so coming back from another tab shows the right line.
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!job) return;
    const elapsed = Date.now() - job.startedAt;
    let reached = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    PROGRESS_AT.forEach((ms, i) => {
      if (ms <= elapsed) reached = i;
      else timers.push(setTimeout(() => setProgress(i), ms - elapsed));
    });
    setProgress(reached);
    return () => timers.forEach(clearTimeout);
  }, [job]);

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: 'nearest' });
  }, [error]);

  const canAnalyse = aiReady && online && !!cropKey && !!photo && !preparing && !busy;

  const analyse = () => {
    if (!cropKey || !photo || busy) return;
    startAnalysis({ cropKey, photo, note: note.trim() || undefined }, { routeKey, tab: nav.tab, switchTab: nav.switchTab });
  };

  const hint = !aiReady
    ? t('ai.error.not-configured')
    : !online
      ? t('doctor.offlineShort')
      : !cropKey
        ? t('doctor.need.crop')
        : !photo
          ? t('doctor.need.photo')
          : null;

  const progressText = t(`doctor.progress.${progress + 1}`);
  const recent = history.items.slice(0, 2);

  return (
    <Screen
      title={t('doctor.title')}
      subtitle={t('doctor.subtitle')}
      actions={[{ key: 'history', icon: History, label: t('doctor.historyAction'), onPress: () => nav.push('diagnosis-history') }]}
      footer={
        <div className="flex flex-col gap-2">
          <Button fullWidth size="lg" icon={ScanSearch} loading={busy} disabled={!canAnalyse} onClick={analyse}>
            {busy ? progressText : t('doctor.analyse')}
          </Button>
          {busy ? (
            <Button fullWidth variant="ghost" onClick={cancelAnalysis}>
              {t('doctor.cancel')}
            </Button>
          ) : (
            hint && <p className="text-center text-caption text-ink-2">{hint}</p>
          )}
        </div>
      }
    >
      {!online && (
        <Callout tone="warning" icon={WifiOff} role="status">
          {t('doctor.offline')}
        </Callout>
      )}

      <Stepper
        ariaLabel={t('doctor.steps')}
        steps={[
          { label: t('doctor.step.crop'), done: !!cropKey },
          { label: t('doctor.step.photo'), done: !!photo },
          { label: t('doctor.step.note'), done: !!note.trim() },
        ]}
      />

      {/* 1. Crop */}
      <StepCard n={1} title={t('doctor.crop.title')} done={!!cropKey} headingId="doctor-step-crop">
        {cropKey ? (
          <div className="flex items-center gap-3">
            <CropArt crop={cropKey} size={56} />
            <div className="min-w-0 flex-1">
              <p className="text-body leading-snug font-semibold text-ink">{cropLabel}</p>
              <p className="text-small text-ink-2">{stageLabel ? t('doctor.crop.yours', { stage: stageLabel }) : t('doctor.crop.picked')}</p>
            </div>
            <Button variant="soft" disabled={busy} onClick={() => setPickerOpen(true)} aria-label={t('doctor.crop.changeAria', { crop: cropLabel })}>
              {t('doctor.crop.change')}
            </Button>
          </div>
        ) : (
          <Button fullWidth variant="secondary" icon={Sprout} disabled={busy} onClick={() => setPickerOpen(true)}>
            {t('doctor.crop.choose')}
          </Button>
        )}
        {myKeys.length >= 2 && (
          <ChipGroup
            className="mt-3"
            bleed={false}
            ariaLabel={t('doctor.crop.mine')}
            value={cropKey ?? ''}
            onChange={k => !busy && setCropKey(k)}
            options={myKeys.map(k => ({ value: k, label: cropName(k, lang) }))}
          />
        )}
      </StepCard>

      {/* 2. Photo */}
      <StepCard n={2} title={t('doctor.photo.title')} done={!!photo} headingId="doctor-step-photo">
        <p className="-mt-1 mb-3 text-small text-ink-2">{t('doctor.photo.hint')}</p>
        <Viewfinder
          src={photo}
          alt={t('doctor.photo.alt', { crop: cropLabel || t('doctor.step.crop') })}
          placeholder={t('doctor.photo.placeholder')}
          busyText={mine ? progressText : undefined}
          preparing={preparing}
          preparingText={t('doctor.photo.preparing')}
          onRemove={busy ? undefined : () => setPhoto(null)}
          removeLabel={t('doctor.photo.remove')}
        />
        <div className="mt-3 flex flex-col gap-2.5">
          <Button fullWidth variant={photo ? 'secondary' : 'primary'} icon={Camera} disabled={busy || preparing} onClick={() => takePhoto('camera')}>
            {photo ? t('doctor.photo.retake') : t('doctor.photo.take')}
          </Button>
          <Button fullWidth variant="secondary" icon={Images} disabled={busy || preparing} onClick={() => takePhoto('gallery')}>
            {photo ? t('doctor.photo.another') : t('doctor.photo.gallery')}
          </Button>
        </div>
        {!isNative && (
          <>
            <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" tabIndex={-1} aria-hidden onChange={onFile} />
            <input ref={galleryInput} type="file" accept="image/*" className="hidden" tabIndex={-1} aria-hidden onChange={onFile} />
          </>
        )}
      </StepCard>

      {/* 3. Note */}
      <StepCard
        n={3}
        title={t('doctor.note.title')}
        done={!!note.trim()}
        headingId="doctor-step-note"
        aside={<Badge tone="gray">{t('common.optional')}</Badge>}
      >
        <TextArea
          label={t('doctor.note.label')}
          value={note}
          onChange={setNote}
          rows={2}
          maxLength={300}
          placeholder={t('doctor.note.placeholder')}
          hint={t('doctor.note.hint')}
          trailing={
            <MicButton
              size="md"
              label={t('doctor.note.mic')}
              disabled={busy}
              onResult={text => setNote(n => (n ? `${n} ${text}` : text).slice(0, 300))}
            />
          }
        />
      </StepCard>

      {error != null && !busy && (
        <div ref={errorRef}>
          <ErrorState compact error={error} title={t('doctor.error.title')} onRetry={canAnalyse ? analyse : undefined} />
        </div>
      )}

      <ExampleGallery disabled={busy} />
      <PhotoTips />

      {recent.length > 0 && (
        <section aria-labelledby="doctor-recent">
          <SectionHeader
            title={<span id="doctor-recent">{t('doctor.recent')}</span>}
            action={{ onPress: () => nav.push('diagnosis-history') }}
            className="mb-3"
          />
          <div className="flex flex-col gap-2.5">
            {recent.map(d => (
              <DiagnosisRow key={d.id} d={d} lang={lang} onPress={() => nav.push('diagnosis', { id: d.id })} />
            ))}
          </div>
        </section>
      )}

      <Sheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={t('doctor.crop.title')}
        description={t('doctor.crop.sheetDesc')}
        size="tall"
      >
        <div className="flex flex-col gap-6">
          {myKeys.length > 0 && <CropPicker label={t('doctor.crop.mine')} only={myKeys} value={cropKey} onChange={pickCrop} />}
          <CropPicker label={t('doctor.crop.all')} searchable value={cropKey} onChange={pickCrop} />
        </div>
      </Sheet>
    </Screen>
  );
}
