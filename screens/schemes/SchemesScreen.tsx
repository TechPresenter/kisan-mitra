// Screen 25 — सरकारी योजनाएं (reference screen 15): category chips, voice search, the
// "सबसे ज़्यादा उपयोगी" picks and one row per scheme. Content is the verified static catalog
// in data/schemes.ts, bundled with the app, so it works offline and never shows a spinner.
import './strings';
import { useCallback, useId, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Callout, ChipGroup, EmptyState, SearchBar, SectionHeader, Screen, TONE_TEXT, cx, type ChipOption } from '../../components/ui';
import { EmptyArt } from '../../components/illustrations';
import { SCHEMES, SCHEMES_LAST_VERIFIED, SCHEME_CATEGORIES, getScheme, searchSchemes } from '../../data/schemes';
import { track } from '../../lib/analytics';
import { formatDate } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { useNav, useRoute } from '../../lib/nav';
import type { GovernmentScheme, SchemeCategory } from '../../types/models';
import { SchemeRow, schemeCategoryKey, schemeCategoryVisual } from './parts';

type Filter = SchemeCategory | 'all';

/** Shown first when no filter is active (only the ones present in the catalog). */
const FEATURED_IDS = ['pm-kisan', 'pmfby', 'kcc'];
const FEATURED: GovernmentScheme[] = FEATURED_IDS.map(id => getScheme(id)).filter((s): s is GovernmentScheme => !!s);
const FEATURED_SET = new Set(FEATURED.map(s => s.id));
const OTHERS: GovernmentScheme[] = SCHEMES.filter(s => !FEATURED_SET.has(s.id));

const isCategory = (v: unknown): v is SchemeCategory => typeof v === 'string' && SCHEME_CATEGORIES.some(c => c.id === v);

export default function SchemesScreen() {
  const t = useT();
  // push is stable per tab (the nav object itself changes on every stack change), so the
  // memoised rows do not re-render on navigation.
  const { push } = useNav();
  const uid = useId();
  const { params } = useRoute<{ category?: string }>();
  const [category, setCategory] = useState<Filter>(() => (isCategory(params.category) ? params.category : 'all'));
  const [query, setQuery] = useState('');

  const q = query.trim();
  const filtered = category !== 'all' || q.length > 0;

  const results = useMemo(() => {
    const base = q ? searchSchemes(q) : [...SCHEMES];
    return category === 'all' ? base : base.filter(s => s.category === category);
  }, [q, category]);

  const chipOptions = useMemo<ChipOption<Filter>[]>(
    () => [
      { value: 'all', label: t('schemes.all') },
      ...SCHEME_CATEGORIES.map(c => {
        const { icon: Icon } = schemeCategoryVisual(c.id);
        // Tinted icon on unselected chips; white (inherited) on the green selected chip.
        return {
          value: c.id,
          label: t(schemeCategoryKey(c.id)),
          icon: <Icon aria-hidden className={cx('size-4 shrink-0', category !== c.id && TONE_TEXT[c.tone])} strokeWidth={2.25} />,
        };
      }),
    ],
    [t, category],
  );

  const open = useCallback((id: string) => push('scheme', { id }), [push]);

  const onSubmit = useCallback(
    (value: string) => {
      if (!value) return;
      const n = (category === 'all' ? searchSchemes(value) : searchSchemes(value).filter(s => s.category === category)).length;
      track('search', { source: 'schemes', results: n });
    },
    [category],
  );

  const checkedOn = formatDate(SCHEMES_LAST_VERIFIED, { year: true });

  return (
    <Screen title={t('schemes.title')} subtitle={t('schemes.subtitle')}>
      <div className="flex flex-col gap-3">
        <SearchBar
          value={query}
          onChange={setQuery}
          onSubmit={onSubmit}
          voice
          ariaLabel={t('schemes.search.label')}
          placeholder={t('schemes.search.placeholder')}
        />
        <ChipGroup ariaLabel={t('schemes.filter')} value={category} onChange={setCategory} options={chipOptions} />
      </div>

      {!filtered ? (
        <>
          <section aria-labelledby={`${uid}-featured`} className="flex flex-col gap-3">
            <SectionHeader title={<span id={`${uid}-featured`}>{t('schemes.featured')}</span>} subtitle={t('schemes.featured.sub')} />
            <SchemeList schemes={FEATURED} onOpen={open} />
          </section>
          {OTHERS.length > 0 && (
            <section aria-labelledby={`${uid}-more`} className="flex flex-col gap-3">
              <SectionHeader title={<span id={`${uid}-more`}>{t('schemes.more')}</span>} />
              <SchemeList schemes={OTHERS} onOpen={open} />
            </section>
          )}
        </>
      ) : results.length > 0 ? (
        <section aria-labelledby={`${uid}-results`} className="flex flex-col gap-3">
          <p id={`${uid}-results`} role="status" className="text-small font-medium text-ink-2">
            {t(`${q ? 'schemes.results' : 'schemes.inCategory'}${results.length === 1 ? '.one' : ''}`, { n: results.length })}
          </p>
          <SchemeList schemes={results} onOpen={open} />
        </section>
      ) : (
        <EmptyState
          art={<EmptyArt kind="search" />}
          title={t('schemes.empty.title')}
          body={t('schemes.empty.body')}
          action={
            category !== 'all'
              ? { label: t(q ? 'schemes.empty.searchAll' : 'schemes.missing.action'), icon: Search, onPress: () => setCategory('all') }
              : { label: t('schemes.empty.clear'), onPress: () => setQuery('') }
          }
          secondaryAction={category !== 'all' && q ? { label: t('schemes.empty.clear'), onPress: () => setQuery('') } : undefined}
        />
      )}

      <Callout tone="info" title={t('schemes.note.title')}>
        <p>{t('schemes.note.body')}</p>
        <p className="mt-1 font-medium text-ink">{t('schemes.note.checked', { date: checkedOn })}</p>
      </Callout>
    </Screen>
  );
}

function SchemeList({ schemes, onOpen }: { schemes: GovernmentScheme[]; onOpen: (id: string) => void }) {
  return (
    <ul className="flex flex-col gap-3">
      {schemes.map(s => (
        <li key={s.id}>
          <SchemeRow scheme={s} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  );
}
