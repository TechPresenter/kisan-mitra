// One farming technique: what it is, benefits, step-by-step method (read aloud), cost,
// precautions, suitable crops, the related scheme, sources and the review date.
// Params: technique { id }
import { useMemo } from 'react';
import { Bookmark, BookmarkCheck, CircleCheck, FileText, IndianRupee, Info, Landmark, ListOrdered, Share2, Sprout } from 'lucide-react';
import '../../lib/common-strings';
import './strings';
import { CropArt, EmptyArt } from '../../components/illustrations';
import {
  Badge,
  Button,
  Callout,
  Card,
  Disclaimer,
  EmptyState,
  ListenButton,
  Screen,
  SectionHeader,
  DUOTONE,
  TINT_BG,
  TONE_TEXT,
  cx,
  renderIcon,
  toast,
} from '../../components/ui';
import { catalogText } from '../../data/crops';
import { CROP_NAMES } from '../../data/crop-keys';
import { getScheme } from '../../data/schemes';
import { TECHNIQUES_REVIEWED_ON, getTechnique, type Technique } from '../../data/techniques';
import { track } from '../../lib/analytics';
import { formatDate } from '../../lib/format';
import { translate, useLanguage, useT } from '../../lib/i18n';
import { useNav, useRoute } from '../../lib/nav';
import { shareText } from '../../services/native';
import { useSaved } from '../../services/saved';
import { ExternalLinkRow, TECHNIQUE_TONE, hostOf, isDevanagariLang, techniqueIcon, techniqueText } from './parts';

/** Schemes in data/schemes.ts that a technique's scheme hint refers to. */
const SCHEME_FOR: Record<string, string> = {
  vermicompost: 'pkvy',
  'drone-spray': 'smam',
  'soil-test': 'soil-health-card',
  inm: 'soil-health-card',
  'drip-irrigation': 'pdmc',
  'sprinkler-irrigation': 'pdmc',
  'natural-farming': 'nmnf',
};

/** Techniques whose content includes fertilizer quantities. */
const FERTILIZER_CONTENT = new Set(['inm', 'nano-urea', 'soil-test', 'green-manure', 'vermicompost']);
/** Techniques whose steps give pesticide / herbicide / seed doses: a warning-level note. */
const CHEMICAL_DOSE_CONTENT = new Set(['seed-treatment', 'dsr']);

export default function TechniqueDetailScreen() {
  const t = useT();
  const nav = useNav();
  const { params } = useRoute<{ id?: string }>();
  const tech = params.id ? getTechnique(params.id) : undefined;

  if (!tech) {
    return (
      <Screen title={t('kheti.tech.title')}>
        <EmptyState
          art={<EmptyArt kind="search" />}
          title={t('kheti.tech.notFoundTitle')}
          body={t('kheti.tech.notFoundBody')}
          action={{ label: t('kheti.tech.showAll'), onPress: () => nav.replace('techniques') }}
        />
      </Screen>
    );
  }
  return <TechniqueDetail tech={tech} />;
}

function TechniqueDetail({ tech }: { tech: Technique }) {
  const t = useT();
  const nav = useNav();
  const { language } = useLanguage();
  const lang = language.code;
  const saved = useSaved();
  const tone = TECHNIQUE_TONE[tech.tone];
  const { title, summary, tag } = techniqueText(tech, lang);
  const refId = `technique:${tech.id}`;
  const isSaved = saved.isSaved('guide', refId);

  // The steps exist only in Hindi and speak() uses the UI language's voice, so read them aloud
  // only where that voice reads Devanagari (an en/bn/ta voice garbles it). Intro in Hindi too.
  const canListen = isDevanagariLang(lang);
  const stepsSpeech = useMemo(
    () =>
      [`${tech.titleHi}।`, translate('hi', 'kheti.tech.stepsSpeech'), ...tech.stepsHi.map((s, i) => `${i + 1}. ${s}`)].join(' '),
    [tech],
  );

  const scheme = SCHEME_FOR[tech.id] ? getScheme(SCHEME_FOR[tech.id]) : undefined;

  const toggleSave = () => {
    const now = saved.toggle({
      type: 'guide',
      refId,
      title,
      snippet: summary,
      target: { screen: 'technique', params: { id: tech.id } },
    });
    if (now) toast.success(t('common.saved'));
    else toast(t('kheti.tech.removed'));
  };

  const share = async () => {
    const body = [
      title,
      '',
      summary,
      '',
      `${t('kheti.tech.steps')}:`,
      ...tech.stepsHi.map((s, i) => `${i + 1}. ${s}`),
      '',
      CHEMICAL_DOSE_CONTENT.has(tech.id)
        ? t('kheti.tech.doseNote')
        : FERTILIZER_CONTENT.has(tech.id)
          ? t('common.disclaimer.fertilizer')
          : t('kheti.tech.localNote'),
      t('kheti.tech.shareFooter'),
    ].join('\n');
    const result = await shareText(title, body);
    if (result === 'copied') toast(t('common.copied'));
    if (result !== 'failed') track('share', { type: 'technique', id: tech.id });
  };

  const cropKeys = tech.suitableCropKeys;

  return (
    <Screen title={t('kheti.tech.title')}>
      {/* Hero */}
      <section className={cx('rounded-card p-5 hc:border hc:border-line', TINT_BG[tone])}>
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className={cx('inline-flex size-14 shrink-0 items-center justify-center rounded-tile bg-surface/80', TONE_TEXT[tone])}
          >
            {renderIcon(techniqueIcon(tech.id), { className: 'size-7', strokeWidth: 2, ...DUOTONE })}
          </span>
          <div className="min-w-0 flex-1">
            <Badge tone={tone} variant="solid">
              {tag}
            </Badge>
            <h2 className="mt-2 text-[1.375rem] leading-snug font-bold text-ink">{title}</h2>
          </div>
        </div>
        <p className="mt-3 text-body leading-relaxed text-ink-2">{summary}</p>
        {lang !== 'hi' && <p className="mt-2 text-caption text-ink-2">{t('kheti.tech.hindiOnly')}</p>}
        <div role="group" aria-label={t('kheti.tech.actions')} className="mt-4 flex flex-wrap gap-2">
          {canListen && <ListenButton id={`technique-${tech.id}`} text={stepsSpeech} />}
          <Button variant="secondary" icon={isSaved ? BookmarkCheck : Bookmark} onClick={toggleSave} aria-pressed={isSaved}>
            {isSaved ? t('kheti.tech.isSaved') : t('common.save')}
          </Button>
          <Button variant="secondary" icon={Share2} onClick={share}>
            {t('common.share')}
          </Button>
        </div>
      </section>

      {/* What it is */}
      <Card as="section">
        <SectionHeader title={t('kheti.tech.whatIs')} icon={Info} className="mb-2" />
        <p className="text-body leading-relaxed text-ink">{tech.whatIsHi}</p>
      </Card>

      {/* Benefits */}
      <Card as="section">
        <SectionHeader title={t('kheti.tech.benefits')} icon={CircleCheck} className="mb-3" />
        <ul className="flex flex-col gap-2.5">
          {tech.benefitsHi.map((b, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-tone-green" strokeWidth={2.25} />
              <span className="text-body leading-relaxed text-ink">{b}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Steps */}
      <Card as="section">
        <SectionHeader
          title={t('kheti.tech.steps')}
          icon={ListOrdered}
          className="mb-4"
          action={canListen ? <ListenButton id={`technique-${tech.id}`} text={stepsSpeech} /> : undefined}
        />
        <ol className="flex flex-col gap-4">
          {tech.stepsHi.map((s, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                aria-hidden
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-body font-bold text-white tabular-nums"
              >
                {i + 1}
              </span>
              <span className="pt-1 text-[1.0625rem] leading-relaxed text-ink">{s}</span>
            </li>
          ))}
        </ol>
      </Card>

      {/* Cost */}
      <Card as="section">
        <SectionHeader title={t('kheti.tech.cost')} icon={IndianRupee} className="mb-2" />
        <p className="text-body leading-relaxed text-ink">{tech.costHi}</p>
        <p className="mt-2 text-caption text-ink-2">{t('kheti.tech.costNote')}</p>
      </Card>

      {/* Cautions */}
      {tech.cautionsHi.length > 0 && (
        <Callout tone="warning" title={t('kheti.tech.cautions')}>
          <ul className="mt-1 flex list-disc flex-col gap-1.5 pl-5 text-body leading-relaxed text-ink">
            {tech.cautionsHi.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </Callout>
      )}

      {/* Suitable crops */}
      <Card as="section">
        <SectionHeader title={t('kheti.tech.crops')} icon={Sprout} className="mb-3" />
        {tech.forAllCrops ? (
          <p className="flex items-center gap-2 text-body text-ink">
            <CircleCheck aria-hidden className="size-5 shrink-0 text-tone-green" />
            {t('kheti.tech.allCrops')}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {cropKeys.map(k => (
              <li key={k} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pr-3.5 pl-1">
                <CropArt crop={k} size={32} />
                <span className="text-small font-medium text-ink">{catalogText(lang, CROP_NAMES[k].hi, CROP_NAMES[k].en)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Related scheme */}
      {tech.relatedSchemeHint && (
        <Callout
          tone="info"
          icon={Landmark}
          title={t('kheti.tech.scheme')}
          action={
            <Button
              variant="secondary"
              onClick={() => (scheme ? nav.push('scheme', { id: scheme.id }) : nav.push('schemes'))}
            >
              {scheme ? t('kheti.tech.schemeOpen', { name: lang === 'en' ? scheme.name : scheme.nameHi }) : t('kheti.tech.schemesOpen')}
            </Button>
          }
        >
          <p className="text-body leading-relaxed text-ink">{tech.relatedSchemeHint}</p>
        </Callout>
      )}

      {CHEMICAL_DOSE_CONTENT.has(tech.id) ? (
        <Disclaimer variant="warning">{t('kheti.tech.doseNote')}</Disclaimer>
      ) : FERTILIZER_CONTENT.has(tech.id) ? (
        <Disclaimer kind="fertilizer" />
      ) : (
        <Disclaimer variant="info">{t('kheti.tech.localNote')}</Disclaimer>
      )}

      {/* Sources */}
      <section className="flex flex-col gap-3">
        <SectionHeader title={t('kheti.tech.sources')} as="h2" />
        <div role="list" className="overflow-hidden rounded-list border border-line bg-surface">
          {tech.sources.map((s, i) => (
            <div role="listitem" key={s.uri} className={cx(i > 0 && 'border-t border-line')}>
              <ExternalLinkRow href={s.uri} title={s.title} subtitle={hostOf(s.uri)} icon={FileText} />
            </div>
          ))}
        </div>
        <p className="text-caption text-ink-2">
          {t('kheti.tech.reviewed', { date: formatDate(TECHNIQUES_REVIEWED_ON, { year: true }) })}
        </p>
      </section>
    </Screen>
  );
}
