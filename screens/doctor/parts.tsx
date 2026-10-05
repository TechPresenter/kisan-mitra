// Building blocks shared by the Crop Doctor screens: stepper, step cards, camera viewfinder,
// bullet lists, photo tips, the "उदाहरण देखें" examples and the history row.
import { useEffect, useState, type ReactNode } from 'react';
import { Check, Focus, Hand, Leaf, Lightbulb, ScanSearch, SunMedium, X } from 'lucide-react';
import { CropArt, LeafExample, type LeafExampleKind } from '../../components/illustrations';
import { Badge, Card, ListRow, SectionHeader, Sheet, Thumbnail, ToneIcon, cx, type IconLike, type Tone } from '../../components/ui';
import { formatDate, toISODate } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { HIGH_CONFIDENCE, LOW_CONFIDENCE, diagnosisCropName } from '../../services/diagnosis';
import type { CropDiagnosis } from '../../types/models';
import './strings';

// ---------------- Confidence ----------------

/** green ≥ 70, amber 50–69, gray < 50. */
export function confidenceTone(n: number): Tone {
  return n >= HIGH_CONFIDENCE ? 'green' : n >= LOW_CONFIDENCE ? 'amber' : 'gray';
}

// ---------------- Stepper ----------------

export interface StepInfo {
  label: string;
  done: boolean;
}

/** Small "1 फसल — 2 फोटो — 3 विवरण" progress row. */
export function Stepper({ steps, ariaLabel }: { steps: StepInfo[]; ariaLabel: string }) {
  const t = useT();
  const current = steps.findIndex(s => !s.done);
  return (
    <ol aria-label={ariaLabel} className="flex items-center gap-2">
      {steps.map((s, i) => {
        const active = i === current;
        return (
          <li key={s.label} className="flex min-w-0 flex-1 items-center gap-2" aria-current={active ? 'step' : undefined}>
            <span
              aria-hidden
              className={cx(
                'inline-flex size-8 shrink-0 items-center justify-center rounded-full text-small font-bold',
                s.done ? 'bg-brand-700 text-white' : active ? 'border-2 border-brand-700 bg-surface text-brand' : 'border-2 border-control bg-surface text-ink-3',
              )}
            >
              {s.done ? <Check className="size-4.5" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cx('truncate pt-0.5 text-small leading-snug', s.done || active ? 'font-semibold text-ink' : 'text-ink-2')}>
              <span className="sr-only">{t('doctor.step.n', { n: i + 1 })}: </span>
              {s.label}
              {s.done && <span className="sr-only"> ({t('doctor.step.done')})</span>}
            </span>
            {i < steps.length - 1 && <span aria-hidden className={cx('h-0.5 min-w-3 flex-1 rounded-full', s.done ? 'bg-brand-600' : 'bg-line')} />}
          </li>
        );
      })}
    </ol>
  );
}

/** A numbered step section ("1 फसल चुनें"). */
export function StepCard({
  n,
  title,
  done,
  aside,
  children,
  headingId,
}: {
  n: number;
  title: ReactNode;
  done?: boolean;
  aside?: ReactNode;
  children: ReactNode;
  headingId?: string;
}) {
  return (
    <Card as="section" aria-labelledby={headingId}>
      <div className="mb-3 flex items-center gap-3">
        <span
          aria-hidden
          className={cx(
            'inline-flex size-7 shrink-0 items-center justify-center rounded-full text-caption font-bold',
            done ? 'bg-brand-700 text-white' : 'bg-brand-50 text-brand',
          )}
        >
          {done ? <Check className="size-4" strokeWidth={3} /> : n}
        </span>
        <h2 id={headingId} className="min-w-0 flex-1 text-card-title leading-snug font-semibold text-ink">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </Card>
  );
}

// ---------------- Viewfinder ----------------

const CORNERS = [
  'left-3 top-3 border-l-[3px] border-t-[3px] rounded-tl-xl',
  'right-3 top-3 border-r-[3px] border-t-[3px] rounded-tr-xl',
  'left-3 bottom-3 border-l-[3px] border-b-[3px] rounded-bl-xl',
  'right-3 bottom-3 border-r-[3px] border-b-[3px] rounded-br-xl',
];

/** Camera-style frame with corner brackets around the chosen photo (or a placeholder). */
export function Viewfinder({
  src,
  alt,
  placeholder,
  busyText,
  preparing,
  preparingText,
  onRemove,
  removeLabel,
}: {
  src: string | null;
  alt: string;
  placeholder: string;
  /** Shown over the photo while it is being analysed. */
  busyText?: string;
  preparing?: boolean;
  preparingText?: string;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  const busy = !!busyText;
  return (
    <div className={cx('relative aspect-[4/3] w-full overflow-hidden rounded-list', src ? 'bg-black' : 'bg-brand-50')}>
      {src ? (
        <img src={src} alt={alt} decoding="async" className="size-full object-contain" />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-3 px-8 text-center">
          <LeafExample kind="healthy" size={72} className="opacity-60" />
          <p className="text-small font-medium text-ink-2">{preparing ? preparingText : placeholder}</p>
        </div>
      )}
      {CORNERS.map(c => (
        <span
          key={c}
          aria-hidden
          className={cx('pointer-events-none absolute size-9', c, src ? 'border-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.5)]' : 'border-brand-600')}
        />
      ))}
      {src && onRemove && !busy && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="press absolute top-2 right-2 inline-flex size-12 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/70"
        >
          <X aria-hidden className="size-5" strokeWidth={2.5} />
        </button>
      )}
      {(busy || (preparing && src)) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 px-6 text-center text-white">
          {/* Static icon: the footer button already shows the only spinner (no looping animation). */}
          <ScanSearch aria-hidden className="size-8" strokeWidth={2} />
          <p role="status" aria-live="polite" className="text-body font-semibold">
            {busyText || preparingText}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------- Bullet list ----------------

const DOT: Record<string, string> = {
  green: 'bg-tone-green',
  orange: 'bg-tone-orange',
  red: 'bg-tone-red',
  amber: 'bg-tone-amber',
  sky: 'bg-tone-sky',
  teal: 'bg-tone-teal',
  indigo: 'bg-tone-indigo',
  rose: 'bg-tone-rose',
  tech: 'bg-tone-tech',
  gray: 'bg-tone-gray',
};

export function BulletList({ items, tone = 'green', className }: { items: string[]; tone?: Tone; className?: string }) {
  return (
    <ul className={cx('space-y-2.5', className)}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-body leading-relaxed text-ink">
          <span aria-hidden className={cx('mt-[0.6em] size-2 shrink-0 rounded-full', DOT[tone])} />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Card with an icon heading and a bullet list; renders nothing for an empty list. */
export function ListSection({
  title,
  icon,
  tone,
  items,
  aside,
  children,
}: {
  title: string;
  icon: IconLike;
  tone: Tone;
  items: string[];
  aside?: ReactNode;
  children?: ReactNode;
}) {
  // `children` may be false (e.g. {cond && <Disclaimer/>}): treat every falsy value as empty.
  if (!items.length && !children) return null;
  return (
    <Card as="section">
      <div className="mb-3 flex items-center gap-3">
        <ToneIcon icon={icon} tone={tone} size="sm" />
        <h3 className="min-w-0 flex-1 text-card-title leading-snug font-semibold text-ink">{title}</h3>
        {aside}
      </div>
      {items.length > 0 && <BulletList items={items} tone={tone} />}
      {children}
    </Card>
  );
}

// ---------------- Photo tips ----------------

export function PhotoTips() {
  const t = useT();
  const tips: { icon: IconLike; tone: Tone; key: string }[] = [
    { icon: Leaf, tone: 'green', key: 'doctor.tips.close' },
    { icon: SunMedium, tone: 'amber', key: 'doctor.tips.light' },
    { icon: Focus, tone: 'sky', key: 'doctor.tips.focus' },
    { icon: Hand, tone: 'teal', key: 'doctor.tips.both' },
  ];
  return (
    <Card as="section">
      <SectionHeader title={t('doctor.tips.title')} icon={Lightbulb} as="h2" className="mb-3" />
      <ul className="space-y-3">
        {tips.map(tip => (
          <li key={tip.key} className="flex items-start gap-3">
            <ToneIcon icon={tip.icon} tone={tip.tone} size="sm" />
            <span className="pt-1.5 text-small leading-relaxed text-ink">{t(tip.key)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---------------- "उदाहरण देखें" ----------------

const EXAMPLES: LeafExampleKind[] = ['rust', 'blight', 'yellowing', 'healthy'];

/** `disabled` while a check runs, so its sheet can never stay open over the result screen. */
export function ExampleGallery({ disabled = false }: { disabled?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState<LeafExampleKind | null>(null);
  const [shown, setShown] = useState<LeafExampleKind>('rust');
  useEffect(() => {
    if (disabled) setOpen(null);
  }, [disabled]);
  const show = (k: LeafExampleKind) => {
    setShown(k);
    setOpen(k);
  };
  const name = t(`doctor.example.${shown}`);
  return (
    <section aria-labelledby="doctor-examples">
      <SectionHeader title={<span id="doctor-examples">{t('doctor.examples.title')}</span>} subtitle={t('doctor.examples.subtitle')} className="mb-3" />
      <ul aria-label={t('doctor.example.list')} className="grid grid-cols-4 gap-2.5">
        {EXAMPLES.map(k => (
          <li key={k}>
            <button
              type="button"
              onClick={() => show(k)}
              disabled={disabled}
              aria-label={t('doctor.example.open', { name: t(`doctor.example.${k}`) })}
              className="press flex w-full flex-col items-center gap-1.5 rounded-list p-1 hover:bg-surface-2 disabled:opacity-60"
            >
              <LeafExample kind={k} size={72} className="aspect-square h-auto w-full max-w-18" />
              <span aria-hidden className="text-caption leading-snug font-medium text-ink-2">
                {t(`doctor.example.${k}`)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Sheet
        open={open != null}
        onClose={() => setOpen(null)}
        title={t('doctor.example.sheetTitle', { name })}
        description={t('doctor.example.sheetDesc')}
      >
        <div className="flex flex-col gap-5">
          <div className="flex justify-center">
            <LeafExample kind={shown} size={176} title={name} />
          </div>
          <div className="flex justify-center gap-2" role="group" aria-label={t('doctor.example.list')}>
            {EXAMPLES.map(k => (
              <button
                key={k}
                type="button"
                onClick={() => setShown(k)}
                aria-pressed={k === shown}
                aria-label={t(`doctor.example.${k}`)}
                className={cx('press rounded-xl p-0.5 ring-2', k === shown ? 'ring-brand-600' : 'ring-transparent')}
              >
                <LeafExample kind={k} size={52} />
              </button>
            ))}
          </div>
          <BulletList items={[t(`doctor.example.${shown}.1`), t(`doctor.example.${shown}.2`)]} tone="green" />
          <div className="rounded-list bg-surface-2 p-4">
            <p className="mb-2 text-small font-semibold text-ink">{t('doctor.example.always')}</p>
            <BulletList items={[t('doctor.example.always.1'), t('doctor.example.always.2'), t('doctor.example.always.3')]} tone="gray" />
          </div>
        </div>
      </Sheet>
    </section>
  );
}

// ---------------- History row ----------------

export function diagnosisTitle(d: CropDiagnosis, t: (k: string) => string): string {
  if (d.unusableReason) return t('doctor.history.unusable');
  if (d.healthy) return t('doctor.history.healthy');
  return d.issueEn && d.issueEn.toLowerCase() !== d.issue.toLowerCase() ? `${d.issue} (${d.issueEn})` : d.issue;
}

/** One past check: photo, issue, crop • date and the AI confidence. */
export function DiagnosisRow({
  d,
  lang,
  onPress,
  trailing,
}: {
  d: CropDiagnosis;
  lang: string;
  onPress: () => void;
  trailing?: ReactNode;
}) {
  const t = useT();
  const crop = diagnosisCropName(d, lang);
  const showConfidence = !d.unusableReason;
  // Same colour as on the result screen: a healthy result at 30% is still an unsure estimate.
  const tone = confidenceTone(d.confidence);
  return (
    <ListRow
      leading={<Thumbnail src={d.image || null} alt="" size="md" fallback={<CropArt crop={d.cropKey} size={56} />} />}
      title={diagnosisTitle(d, t)}
      subtitle={`${crop} • ${formatDate(toISODate(new Date(d.createdAt)))}`}
      meta={showConfidence ? <Badge tone={tone}>{t('doctor.result.confidence', { n: d.confidence })}</Badge> : undefined}
      trailing={trailing}
      chevron={trailing == null}
      onPress={onPress}
    />
  );
}
