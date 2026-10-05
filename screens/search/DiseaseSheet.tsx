// Disease / pest detail sheet: name, crops, symptoms, when it spreads, organic and chemical
// control (with the label and safety note), prevention and sources, plus "फसल डॉक्टर से जांचें".
// There is no disease screen, so search hits and saved disease guides open this sheet.
import { useMemo, useRef, type ReactNode } from 'react';
import { Bookmark, BookmarkCheck, Bug, ExternalLink, FlaskConical, Leaf, ShieldCheck, Stethoscope, Sprout, ThermometerSun } from 'lucide-react';
import { Badge, Button, Disclaimer, ListenButton, SectionHeader, Sheet, toast, type IconLike, type Tone } from '../../components/ui';
import { CropArt } from '../../components/illustrations';
import { formatDate } from '../../lib/format';
import { useLanguage, useT } from '../../lib/i18n';
import { useNav } from '../../lib/nav';
import { KEYS, useCollection } from '../../lib/store';
import { CROP_NAMES } from '../../data/crop-keys';
import { CHEMICAL_NOTE_HI, CHEMICAL_SAFETY_HI, DISEASES_REVIEWED_ON, getDisease, type DiseaseInfo } from '../../data/diseases';
import { useSaved } from '../../services/saved';
import type { Crop, RiskLevel } from '../../types/models';
// The light helpers, not services/search, so reusing this sheet doesn't pull in the search index.
import { diseaseSavedRef, diseaseTarget, diseaseTypeKey } from './disease-utils';
import './strings';

export { diseaseSavedRef };

const SEVERITY_TONE: Record<RiskLevel, Tone> = { high: 'red', medium: 'amber', low: 'green' };

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((text, i) => (
        <li key={i} className="flex gap-2.5 text-body text-ink">
          <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-ink-3" />
          <span className="min-w-0">{text}</span>
        </li>
      ))}
    </ul>
  );
}

function Part({ title, icon, children }: { title: string; icon: IconLike; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <SectionHeader as="h3" title={title} icon={icon} />
      {children}
    </section>
  );
}

export interface DiseaseDetailSheetProps {
  /** Disease id or alias (data/diseases.ts). Unknown ids render nothing. */
  id: string | null;
  open: boolean;
  onClose: () => void;
}

export function DiseaseDetailSheet({ id, open, onClose }: DiseaseDetailSheetProps) {
  const t = useT();
  const nav = useNav();
  const { language } = useLanguage();
  const myCrops = useCollection<Crop>(KEYS.crops).items;
  const saved = useSaved();

  // Keep the last disease while the sheet animates out.
  const lastRef = useRef<DiseaseInfo | undefined>(undefined);
  const found = id ? getDisease(id) : undefined;
  if (found) lastRef.current = found;
  const d = found ?? lastRef.current;

  const isEn = language.code === 'en';
  // The advice is Hindi-only, and the speaker uses the app language's voice, so read it aloud
  // only in Hindi (an English or Marathi voice would garble the Devanagari text).
  const canListen = language.code === 'hi';
  const chemical = useMemo(() => (d ? d.chemicalHi.filter(l => l !== CHEMICAL_NOTE_HI && l !== CHEMICAL_SAFETY_HI) : []), [d]);

  if (!d) return null;

  const name = isEn ? d.nameEn : d.nameHi;
  const cropLabel = (k: keyof typeof CROP_NAMES) => (isEn ? CROP_NAMES[k].en : CROP_NAMES[k].hi);
  const isSavedNow = saved.isSaved('guide', diseaseSavedRef(d.id));
  const TypeIcon = d.type === 'pest' ? Bug : d.type === 'nutrient' || d.type === 'physiological' ? FlaskConical : Leaf;

  // The farmer's own crop first, so Crop Doctor opens on the crop they actually grow.
  const myKeys = new Set(myCrops.map(c => c.cropKey));
  const doctorCrop = d.cropKeys.find(k => myKeys.has(k)) ?? d.cropKeys[0];

  const listenText = [
    d.nameHi,
    `${t('search.disease.symptoms')}: ${d.symptomsHi.join('। ')}`,
    `${t('search.disease.organic')}: ${d.organicHi.join('। ')}`,
    `${t('search.disease.prevention')}: ${d.preventionHi.join('। ')}`,
  ].join('। ');

  const toggleSave = () => {
    const nowSaved = saved.toggle({
      type: 'guide',
      refId: diseaseSavedRef(d.id),
      title: name,
      snippet: d.symptomsHi[0] ?? '',
      target: diseaseTarget(d.id),
    });
    if (nowSaved) toast.success(t('common.saved'));
    else toast(t('search.disease.removed'));
  };

  const checkWithDoctor = () => {
    onClose();
    nav.push('crop-doctor', { cropKey: doctorCrop });
  };

  return (
    <Sheet
      open={open && !!found}
      onClose={onClose}
      size="tall"
      title={name}
      description={[isEn ? d.nameHi : d.nameEn, d.scientificName].filter(Boolean).join(' • ')}
      footer={
        <Button fullWidth size="lg" icon={Stethoscope} onClick={checkWithDoctor}>
          {t('search.disease.checkDoctor')}
        </Button>
      }
    >
      <div className="flex flex-col gap-6 pb-2">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={SEVERITY_TONE[d.severityHint]}>{t(`search.disease.severity.${d.severityHint}`)}</Badge>
            <Badge tone="gray" icon={TypeIcon}>
              {t(diseaseTypeKey(d.type))}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {canListen && <ListenButton id={`disease-${d.id}`} text={listenText} />}
            <Button variant={isSavedNow ? 'soft' : 'secondary'} icon={isSavedNow ? BookmarkCheck : Bookmark} aria-pressed={isSavedNow} onClick={toggleSave}>
              {isSavedNow ? t('search.disease.savedLabel') : t('search.disease.save')}
            </Button>
          </div>
          <Disclaimer variant="info">{t('search.disease.general')}</Disclaimer>
          {isEn && <p className="text-small text-ink-2">{t('search.disease.hindiOnly')}</p>}
        </div>

        <Part title={t('search.disease.crops')} icon={Sprout}>
          <ul className="flex flex-wrap gap-2">
            {d.cropKeys.map(k => (
              <li key={k} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface py-1 pr-3.5 pl-1">
                <CropArt crop={k} size={32} />
                <span className="pt-0.5 text-small font-medium text-ink">{cropLabel(k)}</span>
              </li>
            ))}
          </ul>
        </Part>

        <Part title={t('search.disease.symptoms')} icon={TypeIcon}>
          <Bullets items={d.symptomsHi} />
        </Part>

        {d.favourableConditionsHi && (
          <Part title={t('search.disease.conditions')} icon={ThermometerSun}>
            <p className="text-body text-ink">{d.favourableConditionsHi}</p>
          </Part>
        )}

        {d.organicHi.length > 0 && (
          <Part title={t('search.disease.organic')} icon={Leaf}>
            <Bullets items={d.organicHi} />
          </Part>
        )}

        {chemical.length > 0 && (
          <Part title={t('search.disease.chemical')} icon={FlaskConical}>
            <Bullets items={chemical} />
            <Disclaimer variant="warning">{`${CHEMICAL_NOTE_HI} ${CHEMICAL_SAFETY_HI}`}</Disclaimer>
          </Part>
        )}

        {d.preventionHi.length > 0 && (
          <Part title={t('search.disease.prevention')} icon={ShieldCheck}>
            <Bullets items={d.preventionHi} />
          </Part>
        )}

        {d.sources.length > 0 && (
          <Part title={t('search.disease.sources')} icon={ExternalLink}>
            <ul className="flex flex-col">
              {d.sources.map(s => (
                <li key={s.uri}>
                  <a
                    href={s.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('search.disease.sourceLink', { title: s.title })}
                    className="flex min-h-11 items-start gap-2 py-2 text-small text-brand underline-offset-2 hover:underline"
                  >
                    <ExternalLink aria-hidden className="mt-0.5 size-4 shrink-0" />
                    <span className="min-w-0">{s.title}</span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="text-caption text-ink-3">{t('search.disease.reviewed', { date: formatDate(DISEASES_REVIEWED_ON, { year: true }) })}</p>
          </Part>
        )}
      </div>
    </Sheet>
  );
}

export default DiseaseDetailSheet;
