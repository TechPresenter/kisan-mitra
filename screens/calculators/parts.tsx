// Building blocks shared by the calculator kinds: land input with the local bigha, the bigha
// preset picker, crop picker row, live result card, "कैसे निकाला?" and number formatting.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Calculator, ChevronDown, Eraser, Sprout } from 'lucide-react';
import {
  Button,
  Callout,
  Card,
  ListRow,
  NumberField,
  SelectField,
  Sheet,
  ToneIcon,
  cx,
} from '../../components/ui';
import { CropArt } from '../../components/illustrations';
import { CropPicker } from '../../components/shared/CropPicker';
import { cropName } from '../../data/crop-keys';
import {
  BIGHA_PRESETS,
  SQM_PER_SQFT,
  SQM_PER_SQYD,
  bighaPresetById,
  convertArea,
  safeBighaSqm,
  type LandUnit,
} from '../../data/units';
import { track } from '../../lib/analytics';
import { getProfile, useSettings } from '../../lib/app-state';
import { formatDate, formatNumber } from '../../lib/format';
import { useLanguage, useT, type TFunction } from '../../lib/i18n';
import type { AppSettings } from '../../types/models';
import { decimalsFor } from './calc-math';
import type { CalcKind } from './catalog';
import './strings';

// ---------- Formatting ----------

/** Number with sensible decimals ("62.5", "0.63", "1,250"). */
export const num = (n: number, maxDecimals?: number) => formatNumber(n, maxDecimals ?? decimalsFor(n));

/** Weight in kg as "60 ग्राम", "12.5 किलो" or "1,500 किलो (15 क्विंटल)". */
export function fmtKg(t: TFunction, kg: number): string {
  if (kg > 0 && kg < 1) return t('calc.q.g', { n: num(kg * 1000, 0) });
  if (kg >= 100) return t('calc.q.kgQtl', { n: num(kg, 0), q: num(kg / 100, 1) });
  return t('calc.q.kg', { n: num(kg) });
}

/** Range of kg values ("50 – 62.5 किलो"), or one value when both ends match. */
export function fmtKgRange(t: TFunction, min: number, max: number): string {
  if (Math.abs(max - min) < 1e-9) return fmtKg(t, min);
  return t('calc.q.range', { min: fmtKg(t, min), max: fmtKg(t, max) });
}

/** Spray product in ml or g; big amounts in litres / kg. */
export function fmtDose(t: TFunction, n: number, unit: 'ml' | 'g'): string {
  if (unit === 'g') return fmtKg(t, n / 1000);
  if (n >= 1000) return t('calc.q.l', { n: num(n / 1000) });
  return t('calc.q.ml', { n: num(n) });
}

export function unitLabel(t: TFunction, u: LandUnit | 'sqft' | 'sqyd'): string {
  if (u === 'sqm' || u === 'sqft' || u === 'sqyd') return t(`calc.unit.${u}`);
  return t(`common.${u}`);
}

// ---------- Defaults & analytics ----------

export interface AreaValue {
  value: number | null;
  unit: LandUnit;
}

/** The farmer's reported land from onboarding, else 1 acre. */
export function defaultArea(): AreaValue {
  const p = getProfile();
  if (p?.landArea && p.landArea > 0) return { value: p.landArea, unit: p.landUnit ?? 'acre' };
  return { value: 1, unit: 'acre' };
}

/** Acres for an AreaValue, or null when it is empty / not positive. */
export function acresOf(a: AreaValue, bighaSqm: number): number | null {
  if (a.value == null || !(a.value > 0)) return null;
  const acres = convertArea(a.value, a.unit, 'acre', bighaSqm);
  return Number.isFinite(acres) && acres > 0 ? acres : null;
}

/** "2 बीघा" */
export const areaText = (t: TFunction, a: AreaValue) => `${num(a.value ?? 0)} ${unitLabel(t, a.unit)}`;

/**
 * Records one 'calculator_used' event per visit: once there is a result AND the farmer has
 * changed an input. Prefilled values (profile land, saved numbers) show a result on open, so a
 * plain visit is not counted. Returns `edit`, which wraps an input handler to mark the edit:
 * `onChange={edit(setDepth)}`.
 */
export function useTrackOnce(kind: CalcKind, ready: boolean) {
  const done = useRef(false);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (ready && touched && !done.current) {
      done.current = true;
      track('calculator_used', { kind });
    }
  }, [kind, ready, touched]);
  return useCallback(
    <A extends unknown[]>(fn: (...args: A) => void) =>
      (...args: A) => {
        setTouched(true);
        fn(...args);
      },
    [],
  );
}

// ---------- Bigha ----------

/** The preset in use: the saved id, else a preset with the same size, else custom. */
export function currentBigha(settings: Pick<AppSettings, 'bighaSqm' | 'bighaPreset'>) {
  const sqm = safeBighaSqm(settings.bighaSqm);
  const preset =
    bighaPresetById(settings.bighaPreset) ??
    BIGHA_PRESETS.find(p => p.id !== 'custom' && Math.abs(p.sqm - sqm) < 0.5) ??
    bighaPresetById('custom')!;
  return { preset, sqm };
}

export function bighaName(t: TFunction, lang: string, id: string): string {
  if (id === 'custom') return t('calc.bigha.customName');
  const p = bighaPresetById(id);
  return p ? (lang === 'en' ? p.labelEn : p.labelHi) : t('calc.bigha.customName');
}

const CUSTOM_MIN_SQM = 100;
const CUSTOM_MAX_SQM = 10_000;
type CustomUnit = 'sqft' | 'sqyd' | 'sqm';
const PER_UNIT: Record<CustomUnit, number> = { sqft: SQM_PER_SQFT, sqyd: SQM_PER_SQYD, sqm: 1 };
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * Bigha preset picker + custom size. Writes settings.bighaSqm / bighaPreset (used app-wide).
 * The custom size is a local draft while typing and is saved (and checked) when the field
 * loses focus, so half-typed sizes never reach the rest of the app.
 */
export function BighaSettings({ className, onEdit }: { className?: string; onEdit?: () => void }) {
  const t = useT();
  const { language } = useLanguage();
  const [settings, update] = useSettings();
  const { preset, sqm } = currentBigha(settings);
  const [customUnit, setCustomUnit] = useState<CustomUnit>('sqft');
  const [customValue, setCustomValue] = useState<number | null>(() => round(sqm / PER_UNIT.sqft, 0));
  // Latest typed value, read on blur (NumberField calls onChange before onBlur).
  const draft = useRef<number | null>(customValue);
  const [error, setError] = useState<string>();

  const options = useMemo(
    () =>
      BIGHA_PRESETS.map(p => ({
        value: p.id,
        label:
          p.id === 'custom'
            ? language.code === 'en'
              ? p.labelEn
              : p.labelHi
            : `${language.code === 'en' ? p.labelEn : p.labelHi} — ${num(convertArea(p.sqm, 'sqm', 'acre', 1), 3)} ${t('common.acre')}`,
      })),
    [language.code, t],
  );

  const showCustom = (value: number | null) => {
    draft.current = value;
    setCustomValue(value);
  };

  const pickPreset = (id: string) => {
    setError(undefined);
    onEdit?.();
    if (id === 'custom') {
      update({ bighaPreset: 'custom', bighaSqm: sqm });
      showCustom(round(sqm / PER_UNIT[customUnit], customUnit === 'sqm' ? 1 : 0));
      return;
    }
    const p = bighaPresetById(id);
    if (p) update({ bighaPreset: p.id, bighaSqm: p.sqm });
  };

  const typeCustom = (v: number | null) => {
    showCustom(v);
    if (error) setError(undefined);
  };

  /** Checks the typed size and saves it app-wide; an empty field goes back to the saved size. */
  const saveCustom = () => {
    const v = draft.current;
    if (v == null) {
      setError(undefined);
      showCustom(round(sqm / PER_UNIT[customUnit], customUnit === 'sqm' ? 1 : 0));
      return;
    }
    const m = v * PER_UNIT[customUnit];
    if (m >= CUSTOM_MIN_SQM && m <= CUSTOM_MAX_SQM) {
      setError(undefined);
      const next = round(m, 1);
      if (next !== sqm || settings.bighaPreset !== 'custom') {
        update({ bighaPreset: 'custom', bighaSqm: next });
        onEdit?.();
      }
    } else {
      setError(t('calc.bigha.customError', { min: formatNumber(CUSTOM_MIN_SQM), max: formatNumber(CUSTOM_MAX_SQM) }));
    }
  };

  const changeCustomUnit = (u: string) => {
    const unit = u as CustomUnit;
    setCustomUnit(unit);
    setError(undefined);
    showCustom(round(sqm / PER_UNIT[unit], unit === 'sqm' ? 1 : 0));
  };

  const acres = convertArea(1, 'bigha', 'acre', sqm);

  return (
    <div className={cx('flex flex-col gap-4', className)}>
      <SelectField label={t('calc.bigha.preset')} value={preset.id} onChange={pickPreset} options={options} />
      {preset.id === 'custom' && (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,9rem)] items-start gap-3">
          <NumberField
            label={t('calc.bigha.custom')}
            value={customValue}
            onChange={typeCustom}
            onBlur={saveCustom}
            min={0}
            hint={error ? undefined : t('calc.bigha.customHint')}
            error={error}
          />
          <SelectField
            label={t('calc.bigha.customUnit')}
            value={customUnit}
            onChange={changeCustomUnit}
            options={(['sqft', 'sqyd', 'sqm'] as const).map(u => ({ value: u, label: unitLabel(t, u) }))}
          />
        </div>
      )}
      {preset.id === 'custom' && customValue != null && Math.abs(round(customValue * PER_UNIT[customUnit], 1) - sqm) >= 0.1 && (
        <Button size="md" variant="soft" className="-mt-1 self-start" onClick={saveCustom}>
          {t('calc.bigha.apply')}
        </Button>
      )}
      <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-body font-semibold text-ink" aria-live="polite">
        {t('calc.bigha.current', { sqm: formatNumber(sqm, 1), acre: num(acres, 3) })}
      </p>
      <Callout tone="info">
        {t('calc.bigha.note')} {t('calc.bigha.usedEverywhere')}
      </Callout>
    </div>
  );
}

export function BighaSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('calc.bigha.sheet')}
      size="tall"
      footer={
        <Button fullWidth size="lg" onClick={onClose}>
          {t('common.done')}
        </Button>
      }
    >
      {open && <BighaSettings />}
    </Sheet>
  );
}

// ---------- Land input ----------

export interface AreaFieldProps {
  value: AreaValue;
  onChange: (v: AreaValue) => void;
  units?: readonly LandUnit[];
  label?: ReactNode;
  optional?: boolean;
  error?: ReactNode;
  hint?: ReactNode;
  /** Default true: "बीघा का माप बदलें" opens the bigha sheet (off where the picker is inline). */
  bighaLink?: boolean;
}

/** Land amount + unit, with "= x एकड़" and the local bigha size (changeable in a sheet). */
export function AreaField({ value, onChange, units = ['acre', 'bigha', 'hectare'], label, optional, error, hint, bighaLink = true }: AreaFieldProps) {
  const t = useT();
  const { language } = useLanguage();
  const [settings] = useSettings();
  const [sheet, setSheet] = useState(false);
  const { preset, sqm } = currentBigha(settings);
  const acres = acresOf(value, sqm);
  const showAcres = value.unit !== 'acre' && acres != null;
  const isBigha = value.unit === 'bigha';

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,8.5rem)] items-start gap-3">
        <NumberField
          label={label ?? t('calc.area.label')}
          optional={optional}
          value={value.value}
          onChange={v => onChange({ ...value, value: v })}
          min={0}
          max={1_000_000}
          error={error}
          hint={hint}
        />
        <SelectField
          label={t('calc.area.unit')}
          value={value.unit}
          onChange={u => onChange({ ...value, unit: u as LandUnit })}
          options={units.map(u => ({ value: u, label: unitLabel(t, u) }))}
        />
      </div>
      {showAcres || isBigha ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-caption text-ink-2">
            {showAcres && <span className="font-semibold text-ink">{t('calc.area.inAcres', { n: num(acres!, 3) })}</span>}
            {isBigha && (
              <>
                {showAcres && ' · '}
                {t('calc.area.bighaIs', { acre: num(convertArea(1, 'bigha', 'acre', sqm), 3), name: bighaName(t, language.code, preset.id) })}
              </>
            )}
          </p>
          {isBigha && bighaLink && (
            <Button size="md" variant="ghost" className="-ml-2" onClick={() => setSheet(true)}>
              {t('calc.area.changeBigha')}
            </Button>
          )}
        </div>
      ) : null}
      {bighaLink && <BighaSheet open={sheet} onClose={() => setSheet(false)} />}
    </div>
  );
}

// ---------- Crop picker row ----------

export function CropSelect({
  value,
  onChange,
  label,
}: {
  value: string | null;
  onChange: (key: string) => void;
  label?: string;
}) {
  const t = useT();
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const name = value ? cropName(value, language.code) : null;
  const fieldLabel = label ?? t('calc.crop.label');
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-small font-semibold text-ink">{fieldLabel}</span>
      <ListRow
        leading={value ? <CropArt crop={value} size={44} /> : <ToneIcon icon={Sprout} tone="green" />}
        title={name ?? t('calc.crop.pick')}
        subtitle={value ? t('calc.crop.change') : undefined}
        subtitleLines={1}
        chevron
        ariaLabel={`${fieldLabel}: ${name ?? t('calc.crop.none')}. ${value ? t('calc.crop.change') : t('calc.crop.pick')}`}
        onPress={() => setOpen(true)}
        className="min-h-14"
      />
      <Sheet open={open} onClose={() => setOpen(false)} title={t('calc.crop.sheet')} size="tall">
        {open && (
          <CropPicker
            searchable
            value={value}
            onChange={k => {
              onChange(k);
              setOpen(false);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

// ---------- Result & explanation ----------

/** `text` once it has stopped changing for `ms` (typing a number changes it on every digit). */
function useSettled(text: string, ms: number): string {
  const [settled, setSettled] = useState(text);
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(text), ms);
    return () => window.clearTimeout(id);
  }, [text, ms]);
  return settled;
}

export function ResultCard({
  label,
  value,
  sub,
  ready,
  tone = 'brand',
  waiting,
  announce,
  children,
}: {
  label: ReactNode;
  value?: ReactNode;
  sub?: ReactNode;
  ready: boolean;
  /** 'loss' colours the value red (profit calculator). */
  tone?: 'brand' | 'loss';
  /** Replaces the default "fill in the details" line. */
  waiting?: ReactNode;
  /** Short spoken summary of the answer; defaults to "label: value" when both are text. */
  announce?: string;
  children?: ReactNode;
}) {
  const t = useT();
  // Screen readers hear only the headline answer, after typing pauses, not the whole card on
  // every digit.
  const spoken = !ready
    ? ''
    : (announce ?? (typeof label === 'string' && (typeof value === 'string' || typeof value === 'number') ? `${label}: ${value}` : ''));
  const live = useSettled(spoken, 700);
  return (
    <Card tone={ready ? (tone === 'loss' ? 'danger' : 'brand') : 'muted'} as="section">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {live}
      </p>
      <h2 className="text-small font-semibold text-ink-2">{label}</h2>
      {ready ? (
        <>
          {value != null && (
            <p
              className={cx(
                'mt-1 text-[2.25rem] leading-tight font-bold [overflow-wrap:anywhere]',
                tone === 'loss' ? 'text-tone-red' : 'text-brand',
              )}
            >
              {value}
            </p>
          )}
          {sub != null && <p className="mt-1 text-small text-ink-2">{sub}</p>}
          {children != null && (
            <div
              className={cx(
                'flex flex-col gap-1.5 text-body text-ink',
                value != null || sub != null ? 'mt-3 border-t pt-3' : 'mt-2',
                tone === 'loss' ? 'border-danger/15' : 'border-brand-100',
              )}
            >
              {children}
            </div>
          )}
        </>
      ) : (
        <p className="mt-1 text-body text-ink-2">{waiting ?? t('calc.result.waiting')}</p>
      )}
    </Card>
  );
}

/** Collapsible "कैसे निकाला?" with the formula steps using the farmer's own numbers. */
export function HowItWorks({ steps }: { steps: (string | false | null | undefined)[] }) {
  const t = useT();
  const list = steps.filter((s): s is string => !!s);
  if (!list.length) return null;
  return (
    <Card padding="none">
      <details className="group">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-card px-4 py-3 text-body font-semibold text-ink [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2.5">
            <Calculator aria-hidden className="size-5 text-brand" />
            {t('calc.how.title')}
          </span>
          <ChevronDown aria-hidden className="size-5 shrink-0 text-ink-2 transition-transform duration-150 group-open:rotate-180" />
        </summary>
        <ol className="flex list-decimal flex-col gap-2 pr-4 pb-4 pl-9 text-small text-ink-2 marker:font-semibold marker:text-ink-3">
          {list.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </details>
    </Card>
  );
}

/**
 * For numbers kept from an earlier visit: "ये आंकड़े पिछली बार 3 अक्टूबर को भरे थे" plus
 * "सब खाली करें", so last season's inputs are not taken for this season's.
 * `savedAt`: the date they were saved; undefined when unknown (older saves).
 */
export function RestoredNote({ savedAt, onClear }: { savedAt?: string; onClear: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <p className="min-w-0 flex-1 text-caption text-ink-2">
        {savedAt ? t('calc.saved.on', { date: formatDate(savedAt) }) : t('calc.saved.old')}
      </p>
      <Button variant="ghost" icon={Eraser} className="-mr-2 shrink-0" onClick={onClear}>
        {t('calc.cost.clear')}
      </Button>
    </div>
  );
}

/** Bullet list inside a Callout / Card. */
export function Bullets({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cx('flex list-disc flex-col gap-1.5 pl-5 text-small text-ink-2 marker:text-ink-3', className)}>
      {items.map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </ul>
  );
}
