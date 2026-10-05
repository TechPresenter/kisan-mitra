// "खोजें" — one search box for crops, my crops, diseases & pests, techniques, schemes, mandi
// prices, past AI chats, saved items and app features. Works offline (services/search.ts).
// Params: { q?: string; disease?: string } — `disease` opens that disease's detail sheet. Opened
// with only `disease` (a saved guide, a notification), the screen is just a host for the sheet:
// closing it goes straight back.
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Bookmark,
  BookOpen,
  Bug,
  Calculator,
  CalendarDays,
  CloudSun,
  FlaskConical,
  HandCoins,
  History,
  Landmark,
  Leaf,
  LifeBuoy,
  Lightbulb,
  MessageCircle,
  Mic,
  BadgePercent,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sprout,
  Stethoscope,
  Tractor,
  TrendingUp,
  Wallet,
  X,
  Droplets,
  type LucideIcon,
} from 'lucide-react';
import {
  Badge,
  Callout,
  Chip,
  EmptyState,
  IconButton,
  ListGroup,
  ListRow,
  Screen,
  SearchBar,
  SectionHeader,
  Button,
  ToneIcon,
  cx,
  toast,
  type Tone,
} from '../../components/ui';
import { CropArt, EmptyArt } from '../../components/illustrations';
import { track } from '../../lib/analytics';
import { formatNumber } from '../../lib/format';
import { useLanguage, useT } from '../../lib/i18n';
import { useNav, useRoute } from '../../lib/nav';
import { KEYS, useCollection } from '../../lib/store';
import { getDisease } from '../../data/diseases';
import { getSchemeCategory, type SchemeIconName } from '../../data/schemes';
import type { TechniqueTone } from '../../data/techniques';
import {
  MIN_QUERY_LENGTH,
  SEARCH_SUGGESTIONS,
  addRecentSearch,
  clearRecentSearches,
  normalizeText,
  removeRecentSearch,
  restoreRecentSearches,
  searchEverything,
  useRecentSearches,
  type SearchResult,
  type SearchResultType,
} from '../../services/search';
import type { AIConversation, Crop, SavedItem, SchemeCategory } from '../../types/models';
import { savedTypeMeta } from '../saved/meta';
import { DiseaseDetailSheet } from './DiseaseSheet';
import { canOpenTarget } from './targets';
import './strings';

/** Rows shown per group before "और देखें". */
const GROUP_PREVIEW = 4;

const FEATURE_VISUAL: Record<string, { icon: LucideIcon; tone: Tone }> = {
  weather: { icon: CloudSun, tone: 'sky' },
  mandi: { icon: TrendingUp, tone: 'amber' },
  'crop-doctor': { icon: Stethoscope, tone: 'red' },
  soil: { icon: FlaskConical, tone: 'orange' },
  calendar: { icon: CalendarDays, tone: 'orange' },
  calculators: { icon: Calculator, tone: 'teal' },
  hisab: { icon: Wallet, tone: 'green' },
  schemes: { icon: Landmark, tone: 'indigo' },
  crops: { icon: Sprout, tone: 'green' },
  techniques: { icon: Lightbulb, tone: 'teal' },
  ai: { icon: Sparkles, tone: 'tech' },
  saved: { icon: Bookmark, tone: 'green' },
  notifications: { icon: Bell, tone: 'sky' },
  settings: { icon: Settings, tone: 'gray' },
  help: { icon: LifeBuoy, tone: 'sky' },
  farms: { icon: Tractor, tone: 'green' },
};

const TECHNIQUE_TONE: Record<TechniqueTone, Tone> = { green: 'green', blue: 'sky', purple: 'tech', amber: 'amber', teal: 'teal', orange: 'orange' };

const SCHEME_ICON: Record<SchemeIconName, LucideIcon> = {
  HandCoins,
  ShieldCheck,
  Landmark,
  BadgePercent,
  Tractor,
  Sprout,
  Droplets,
};

function ResultLeading({ r }: { r: SearchResult }) {
  switch (r.type) {
    case 'my-crop':
    case 'crop':
    case 'mandi':
      return <CropArt crop={r.cropKey ?? ''} size={44} />;
    case 'feature': {
      const v = FEATURE_VISUAL[r.kind ?? ''] ?? { icon: Search, tone: 'green' as Tone };
      return <ToneIcon icon={v.icon} tone={v.tone} />;
    }
    case 'disease':
      return r.kind === 'pest' ? (
        <ToneIcon icon={Bug} tone="orange" />
      ) : r.kind === 'nutrient' || r.kind === 'physiological' ? (
        <ToneIcon icon={FlaskConical} tone="amber" />
      ) : (
        <ToneIcon icon={Leaf} tone="red" />
      );
    case 'technique':
      return <ToneIcon icon={Lightbulb} tone={TECHNIQUE_TONE[r.kind as TechniqueTone] ?? 'green'} />;
    case 'scheme': {
      const cat = getSchemeCategory((r.kind ?? 'support') as SchemeCategory);
      return <ToneIcon icon={SCHEME_ICON[cat.icon] ?? Landmark} tone={cat.tone} />;
    }
    case 'conversation':
      return <ToneIcon icon={MessageCircle} tone="tech" />;
    case 'saved': {
      const meta = savedTypeMeta(r.kind ?? 'guide');
      return <ToneIcon icon={meta.icon} tone={meta.tone} />;
    }
    default:
      return <ToneIcon icon={BookOpen} tone="gray" />;
  }
}

type SubmitSource = 'typed' | 'suggestion' | 'recent';

export default function SearchScreen() {
  const t = useT();
  const nav = useNav();
  const { language } = useLanguage();
  const { params } = useRoute<{ q?: unknown; disease?: unknown }>();
  const initialQ = typeof params.q === 'string' ? params.q : '';
  const initialDisease = typeof params.disease === 'string' ? (getDisease(params.disease)?.id ?? null) : null;

  const [query, setQueryState] = useState(initialQ);
  const deferred = useDeferredValue(query);
  const [diseaseId, setDiseaseId] = useState<string | null>(initialDisease);
  const [diseaseOpen, setDiseaseOpen] = useState(!!initialDisease);
  // Opened by a link to one disease: until the farmer types or opens something else, closing the
  // sheet (or Android back) returns to where they came from instead of an empty search page.
  const [linkMode, setLinkMode] = useState(!!initialDisease && !initialQ);
  // A submitted query waiting for its results, so analytics reuses the search already shown.
  const [pendingTrack, setPendingTrack] = useState<{ q: string; source: SubmitSource } | null>(null);
  // Expanded groups belong to one query, so a new query starts collapsed.
  const [expanded, setExpanded] = useState<{ q: string; types: SearchResultType[] }>({ q: '', types: [] });

  const recent = useRecentSearches();
  const crops = useCollection<Crop>(KEYS.crops).items;
  const conversations = useCollection<AIConversation>(KEYS.conversations).items;
  const saved = useCollection<SavedItem>(KEYS.saved).items;

  useEffect(() => {
    if (typeof params.disease === 'string' && !initialDisease) toast.info(t('search.disease.notFound'), { id: 'search-disease-missing' });
    // Only for the params this screen was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lang = language.code;
  const sources = useMemo(() => ({ crops, conversations, saved }), [crops, conversations, saved]);
  const response = useMemo(() => searchEverything(deferred, { lang, sources }), [deferred, lang, sources]);

  const typed = query.trim();
  const letters = normalizeText(typed).replace(/ /g, '').length;
  const tooShort = typed.length > 0 && letters < MIN_QUERY_LENGTH;
  const idle = typed.length === 0;
  const settling = query !== deferred;

  const setQuery = (value: string) => {
    setLinkMode(false);
    setQueryState(value);
  };

  useEffect(() => {
    if (!pendingTrack || normalizeText(response.query) !== normalizeText(pendingTrack.q)) return;
    track('search', { source: pendingTrack.source, results: response.total, intent: response.intent ?? 'none' });
    setPendingTrack(null);
  }, [pendingTrack, response]);

  const submit = (value: string, source: SubmitSource) => {
    const q = value.trim();
    if (q !== query) setQuery(q);
    if (!q) return;
    addRecentSearch(q);
    setPendingTrack({ q, source });
  };

  const closeDisease = () => {
    setDiseaseOpen(false);
    if (linkMode) {
      setLinkMode(false);
      nav.pop();
    }
  };

  const openResult = (r: SearchResult) => {
    setLinkMode(false);
    addRecentSearch(query);
    track('search', { action: 'open', type: r.type });
    // Disease hits, and saved disease guides (whose target is this screen), open the sheet here.
    const targetParams = r.target.params ?? {};
    const diseaseRef = r.type === 'disease' ? r.id : r.target.screen === 'search' ? targetParams.disease : undefined;
    const disease = typeof diseaseRef === 'string' ? getDisease(diseaseRef) : undefined;
    if (disease) {
      setDiseaseId(disease.id);
      setDiseaseOpen(true);
      return;
    }
    if (r.target.screen === 'search') {
      if (typeof targetParams.q === 'string') setQuery(targetParams.q);
      return;
    }
    if (canOpenTarget(r.target, 'search')) nav.open(r.target);
    else nav.push('saved');
  };

  const askAI = () => {
    const prompt = query.trim();
    track('search', { action: 'ask-ai' });
    nav.switchTab('ai', { screen: 'ai', params: prompt ? { prompt } : {} });
  };

  const clearRecent = () => {
    const before = [...recent];
    clearRecentSearches();
    toast(t('search.recentCleared'), { action: { label: t('search.undo'), onPress: () => restoreRecentSearches(before) } });
  };

  const isExpanded = (type: SearchResultType) => expanded.q === response.query && expanded.types.includes(type);
  const toggleGroup = (type: SearchResultType) =>
    setExpanded(prev => {
      const types = prev.q === response.query ? prev.types : [];
      return { q: response.query, types: types.includes(type) ? types.filter(x => x !== type) : [...types, type] };
    });

  const suggestions = SEARCH_SUGGESTIONS.map(s => (lang === 'en' ? s.en : s.hi));

  return (
    <Screen
      title={t('search.title')}
      headerContent={
        <SearchBar
          variant="onDark"
          value={query}
          onChange={setQuery}
          onSubmit={v => submit(v, 'typed')}
          voice
          placeholder={t('search.placeholder')}
          ariaLabel={t('search.inputLabel')}
          autoFocus={!initialQ && !initialDisease}
          maxLength={80}
        />
      }
    >
      {/* Opened for one disease: only its sheet, nothing behind it (closing goes straight back). */}
      {linkMode ? null : idle ? (
        <>
          {recent.length > 0 && (
            <section aria-labelledby="search-recent" className="flex flex-col gap-3">
              <SectionHeader
                title={<span id="search-recent">{t('search.recent')}</span>}
                action={
                  <Button variant="ghost" className="-my-2 -mr-2" onClick={clearRecent}>
                    {t('search.clearRecent')}
                  </Button>
                }
              />
              <ListGroup ariaLabel={t('search.recent')}>
                {recent.map(q => (
                  <ListRow
                    key={q}
                    variant="plain"
                    leading={<ToneIcon icon={History} tone="gray" size="sm" />}
                    title={q}
                    trailing={
                      <IconButton icon={X} className="-mr-2" label={t('search.removeRecent', { q })} onClick={() => removeRecentSearch(q)} />
                    }
                    onPress={() => submit(q, 'recent')}
                  />
                ))}
              </ListGroup>
            </section>
          )}

          <section aria-labelledby="search-popular" className="flex flex-col gap-3">
            <SectionHeader title={<span id="search-popular">{t('search.popular')}</span>} />
            <div className="flex flex-wrap gap-2">
              {suggestions.map(s => (
                <Chip key={s} label={s} icon={TrendingUp} aria-pressed={undefined} onClick={() => submit(s, 'suggestion')} />
              ))}
            </div>
          </section>

          {recent.length === 0 && (
            <Callout tone="neutral" icon={Mic} title={t('search.hint.title')}>
              {t('search.hint.body')}
            </Callout>
          )}
        </>
      ) : tooShort ? (
        <p className="px-1 text-small text-ink-2" role="status">
          {t('search.typeMore')}
        </p>
      ) : response.total === 0 ? (
        // While the deferred query catches up, show nothing rather than a flash of "no results".
        settling ? null : (
        <EmptyState
          art={<EmptyArt kind="search" />}
          title={t('search.noResults.title', { q: typed })}
          body={t('search.noResults.body')}
          action={{ label: t('search.askAI'), icon: Sparkles, onPress: askAI }}
          secondaryAction={{ label: t('search.clearQuery'), icon: X, onPress: () => setQuery('') }}
        />
        )
      ) : (
        <div className={cx('flex flex-col gap-6 transition-opacity duration-150', settling && 'opacity-60')} aria-busy={settling || undefined}>
          <p className="px-1 text-small text-ink-2" role="status">
            {response.total === 1
              ? t('search.resultsOne', { q: response.query })
              : t('search.resultsMany', { q: response.query, n: response.total })}
          </p>

          {response.groups.map(g => {
            const label = t(`search.group.${g.type}`);
            const open = isExpanded(g.type);
            const shown = open ? g.results : g.results.slice(0, GROUP_PREVIEW);
            const hidden = g.results.length - shown.length;
            const capped = g.found > g.results.length;
            return (
              <section key={g.type} aria-labelledby={`search-g-${g.type}`} className="flex flex-col gap-3">
                <SectionHeader
                  title={<span id={`search-g-${g.type}`}>{label}</span>}
                  action={
                    <Badge tone="gray" size="md">
                      {formatNumber(g.found)}
                    </Badge>
                  }
                />
                <ListGroup ariaLabel={label}>
                  {shown.map(r => (
                    <ListRow
                      key={`${r.type}:${r.id}`}
                      variant="plain"
                      leading={<ResultLeading r={r} />}
                      title={r.title}
                      // Own clamp: ListRow's subtitle `block` class currently overrides its line-clamp.
                      subtitle={r.subtitle ? <span className="line-clamp-2">{r.subtitle}</span> : undefined}
                      onPress={() => openResult(r)}
                    />
                  ))}
                </ListGroup>
                {open && capped && <p className="px-1 text-small text-ink-2">{t('search.capped', { shown: g.results.length })}</p>}
                {(hidden > 0 || open) && g.results.length > GROUP_PREVIEW && (
                  <Button variant="ghost" className="-ml-3 self-start" aria-expanded={open} onClick={() => toggleGroup(g.type)}>
                    {open ? t('search.showLess') : t('search.showMore', { n: hidden })}
                  </Button>
                )}
              </section>
            );
          })}

          <Callout
            tone="tech"
            title={t('search.askAI.title')}
            action={
              <Button variant="tech" icon={Sparkles} onClick={askAI}>
                {t('search.askAI')}
              </Button>
            }
          >
            {t('search.askAI.body')}
          </Callout>
        </div>
      )}

      <DiseaseDetailSheet id={diseaseId} open={diseaseOpen} onClose={closeDisease} />
    </Screen>
  );
}
