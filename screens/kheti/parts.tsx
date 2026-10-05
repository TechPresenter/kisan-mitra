// Shared pieces of the Kheti module: technique tone/icon mapping, the technique card (list and
// hub "आज की तकनीक") and an external-link row used by technique sources and the soil screens.
import {
  Bean,
  Bug,
  ChevronRight,
  CloudRain,
  Droplet,
  Drone,
  ExternalLink,
  FlaskConical,
  Globe,
  Layers,
  Leaf,
  Lightbulb,
  Recycle,
  RefreshCcw,
  ShowerHead,
  Shrub,
  Sprout,
  TestTube,
  Wheat,
  Worm,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge, Card, ToneIcon, cx, type IconLike, type Tone } from '../../components/ui';
import { catalogText } from '../../data/crops';
import type { Technique, TechniqueTone } from '../../data/techniques';
import { translate, useT } from '../../lib/i18n';
import { isNative } from '../../services/native';
import './strings';

/** Catalog tones → UI kit tones (purple is the kit's "tech" violet, blue its "sky"). */
export const TECHNIQUE_TONE: Record<TechniqueTone, Tone> = {
  green: 'green',
  blue: 'sky',
  purple: 'tech',
  amber: 'amber',
  teal: 'teal',
  orange: 'orange',
};

const ICONS: Record<string, IconLike> = {
  vermicompost: Worm,
  mulching: Layers,
  'drone-spray': Drone,
  'soil-test': FlaskConical,
  'drip-irrigation': Droplet,
  'sprinkler-irrigation': ShowerHead,
  'natural-farming': Leaf,
  ipm: Bug,
  'seed-treatment': Bean,
  'crop-rotation': RefreshCcw,
  'green-manure': Sprout,
  'crop-residue-management': Recycle,
  inm: Shrub,
  'rainwater-harvesting': CloudRain,
  'nano-urea': TestTube,
  dsr: Wheat,
};

export const techniqueIcon = (id: string): IconLike => ICONS[id] ?? Lightbulb;

/**
 * Languages written in Devanagari. A TTS voice for these can read the Hindi technique text and
 * Hindi AI advice; voices for other scripts (en, bn, ta…) garble or skip it.
 */
export const DEVANAGARI_LANGS: ReadonlySet<string> = new Set(['hi', 'mr', 'mai', 'ne', 'kok', 'doi', 'brx', 'sa']);
export const isDevanagariLang = (lang: string) => DEVANAGARI_LANGS.has(lang);

/**
 * The original app's four technique cards were translated in translations.ts (bn, te, mr, ta…).
 * Those keys keep the titles and summaries in the farmer's language for the same techniques.
 */
const LEGACY_TEXT: Record<string, { title: string; summary: string }> = {
  vermicompost: { title: 'vermicompost', summary: 'vermicompostDesc' },
  mulching: { title: 'mulching', summary: 'mulchingDesc' },
  'drone-spray': { title: 'droneSpray', summary: 'droneSprayDesc' },
  'soil-test': { title: 'soilTest', summary: 'soilTestDesc' },
};
/** Legacy tag keys by the catalog's English tag. */
const LEGACY_TAG: Record<string, string> = {
  Organic: 'organic',
  Irrigation: 'irrigation',
  Technology: 'technology',
  'Smart farming': 'smartFarming',
};

/** A legacy string in `lang` itself (not the Hindi fallback), or undefined. */
function legacyText(lang: string, key: string | undefined): string | undefined {
  if (!key || lang === 'hi' || lang === 'en') return undefined;
  const s = translate(lang, key);
  return s !== key && s !== translate('hi', key) ? s : undefined;
}

/** A technique tag in the UI language (catalog Hindi/English, legacy translations for others). */
export function techniqueTagText(tag: { hi: string; en: string }, lang: string): string {
  return legacyText(lang, LEGACY_TAG[tag.en]) ?? catalogText(lang, tag.hi, tag.en);
}

/** Title, summary and tag in the UI language where available (the body text is Hindi only). */
export function techniqueText(tech: Technique, lang: string) {
  const legacy = LEGACY_TEXT[tech.id];
  return {
    title: legacyText(lang, legacy?.title) ?? catalogText(lang, tech.titleHi, tech.titleEn),
    summary: legacyText(lang, legacy?.summary) ?? catalogText(lang, tech.summaryHi, tech.summaryEn),
    tag: techniqueTagText({ hi: tech.tagHi, en: tech.tagEn }, lang),
  };
}

export interface TechniqueCardProps {
  tech: Technique;
  lang: string;
  onPress: () => void;
  /** Small line above the title, e.g. "आज की तकनीक". */
  eyebrow?: ReactNode;
  className?: string;
}

/** The original app's technique card: tag pill in the tone colour, title, summary, chevron. */
export function TechniqueCard({ tech, lang, onPress, eyebrow, className }: TechniqueCardProps) {
  const tone = TECHNIQUE_TONE[tech.tone];
  const { title, summary, tag } = techniqueText(tech, lang);
  return (
    <Card as="article" onPress={onPress} padding="lg" className={className}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge tone={tone} variant="solid">
            {tag}
          </Badge>
          {eyebrow != null && <span className="text-caption font-semibold text-ink-2">{eyebrow}</span>}
        </div>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-3" />
      </div>
      <div className="mt-3 flex items-start gap-3">
        <ToneIcon icon={techniqueIcon(tech.id)} tone={tone} size="md" shape="rounded" />
        <div className="min-w-0 flex-1">
          <h3 className="text-card-title leading-snug font-semibold text-ink">{title}</h3>
          <p className="mt-1 line-clamp-2 text-small leading-relaxed text-ink-2">{summary}</p>
        </div>
      </div>
    </Card>
  );
}

export interface ExternalLinkRowProps {
  href: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Leading icon saying what the site is (default Globe); the trailing arrow marks it external. */
  icon?: IconLike;
  tone?: Tone;
  className?: string;
}

/**
 * A list row that is a real link to an outside website. On Android a plain link leaves the
 * WebView and Capacitor hands it to the browser; on the web it opens a new tab.
 */
export function ExternalLinkRow({ href, title, subtitle, icon = Globe, tone = 'sky', className }: ExternalLinkRowProps) {
  const t = useT();
  return (
    <a
      href={href}
      target={isNative ? undefined : '_blank'}
      rel="noopener noreferrer"
      className={cx(
        'press flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2/60 active:bg-surface-2',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--focus)]',
        className,
      )}
    >
      <ToneIcon icon={icon} tone={tone} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block text-body leading-snug font-semibold text-ink">{title}</span>
        {subtitle != null && <span className="mt-0.5 block text-small break-words text-ink-2">{subtitle}</span>}
        <span className="sr-only"> {t('kheti.tech.externalLink')}</span>
      </span>
      <ExternalLink aria-hidden className="size-5 shrink-0 text-ink-3" />
    </a>
  );
}

/** "soilhealth.dac.gov.in" from a URL, for row subtitles. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
